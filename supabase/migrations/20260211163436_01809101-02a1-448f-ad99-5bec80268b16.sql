
-- MODULE 1: Add duplicate detection fields to jobs table
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS normalized_title TEXT,
  ADD COLUMN IF NOT EXISTS normalized_company TEXT,
  ADD COLUMN IF NOT EXISTS normalized_location TEXT,
  ADD COLUMN IF NOT EXISTS source_url_hash TEXT,
  ADD COLUMN IF NOT EXISTS is_duplicate BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS duplicate_group_id VARCHAR(100),
  ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS canonical_job_id UUID NULL,
  ADD COLUMN IF NOT EXISTS duplicate_confidence_score DECIMAL(5,2);

-- Create indexes for high-performance queries
CREATE INDEX IF NOT EXISTS idx_jobs_normalized_title ON public.jobs (normalized_title);
CREATE INDEX IF NOT EXISTS idx_jobs_normalized_company ON public.jobs (normalized_company);
CREATE INDEX IF NOT EXISTS idx_jobs_source_url_hash ON public.jobs (source_url_hash);
CREATE INDEX IF NOT EXISTS idx_jobs_duplicate_group_id ON public.jobs (duplicate_group_id);
CREATE INDEX IF NOT EXISTS idx_jobs_is_deleted ON public.jobs (is_deleted);
CREATE INDEX IF NOT EXISTS idx_jobs_is_duplicate ON public.jobs (is_duplicate);
CREATE INDEX IF NOT EXISTS idx_jobs_canonical_job_id ON public.jobs (canonical_job_id);

-- Composite index for duplicate detection queries
CREATE INDEX IF NOT EXISTS idx_jobs_dup_detection 
  ON public.jobs (normalized_title, normalized_company, normalized_location) 
  WHERE is_deleted = FALSE;

-- MODULE 2: Normalization function
CREATE OR REPLACE FUNCTION public.normalize_job_text(input_text TEXT)
RETURNS TEXT
LANGUAGE plpgsql IMMUTABLE
SET search_path = 'public'
AS $$
DECLARE
  result TEXT;
BEGIN
  IF input_text IS NULL THEN RETURN NULL; END IF;
  
  result := lower(trim(input_text));
  -- Remove special characters except spaces
  result := regexp_replace(result, '[^a-z0-9\s]', '', 'g');
  -- Remove recruitment keywords
  result := regexp_replace(result, '\m(hiring|urgent|immediate|opening|vacancy|required|wanted|needed|apply|now|asap|walk[\s-]?in)\M', '', 'g');
  -- Collapse multiple spaces
  result := regexp_replace(result, '\s+', ' ', 'g');
  result := trim(result);
  
  RETURN result;
END;
$$;

-- Function to generate source URL hash
CREATE OR REPLACE FUNCTION public.generate_source_hash(url TEXT)
RETURNS TEXT
LANGUAGE sql IMMUTABLE
SET search_path = 'public'
AS $$
  SELECT CASE WHEN url IS NULL THEN NULL ELSE md5(lower(trim(url))) END;
$$;

-- Trigger to auto-normalize on insert/update
CREATE OR REPLACE FUNCTION public.normalize_job_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = 'public'
AS $$
BEGIN
  NEW.normalized_title := public.normalize_job_text(NEW.title);
  NEW.normalized_company := public.normalize_job_text(COALESCE(NEW.company_name, ''));
  NEW.normalized_location := public.normalize_job_text(COALESCE(NEW.location, ''));
  NEW.source_url_hash := public.generate_source_hash(NEW.source_url);
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_normalize_job_fields
  BEFORE INSERT OR UPDATE OF title, company_name, location, source_url
  ON public.jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.normalize_job_fields();

-- MODULE 3: Duplicate detection function
CREATE OR REPLACE FUNCTION public.detect_duplicate_jobs(
  p_batch_size INT DEFAULT 500
)
RETURNS TABLE (
  job_id UUID,
  duplicate_of UUID,
  match_level TEXT,
  confidence DECIMAL(5,2),
  group_id VARCHAR(100)
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  RETURN QUERY
  WITH candidates AS (
    SELECT j.id, j.normalized_title, j.normalized_company, j.normalized_location,
           j.source_url_hash, j.created_at, j.description, j.company_name
    FROM public.jobs j
    WHERE j.is_deleted = FALSE AND j.is_duplicate = FALSE
    ORDER BY j.created_at DESC
    LIMIT p_batch_size
  ),
  -- Level 1: Exact match on title + company + location
  exact_matches AS (
    SELECT 
      c.id AS job_id,
      e.id AS duplicate_of,
      'exact'::TEXT AS match_level,
      1.00::DECIMAL(5,2) AS confidence,
      ('grp_' || md5(c.normalized_title || '|' || c.normalized_company || '|' || c.normalized_location))::VARCHAR(100) AS group_id
    FROM candidates c
    JOIN public.jobs e ON e.id != c.id
      AND e.normalized_title = c.normalized_title
      AND e.normalized_company = c.normalized_company
      AND e.normalized_location = c.normalized_location
      AND e.is_deleted = FALSE
      AND e.created_at < c.created_at
  ),
  -- Level 2: Source URL hash match
  url_matches AS (
    SELECT
      c.id AS job_id,
      e.id AS duplicate_of,
      'source_url'::TEXT AS match_level,
      0.95::DECIMAL(5,2) AS confidence,
      ('grp_url_' || c.source_url_hash)::VARCHAR(100) AS group_id
    FROM candidates c
    JOIN public.jobs e ON e.id != c.id
      AND c.source_url_hash IS NOT NULL
      AND e.source_url_hash = c.source_url_hash
      AND e.is_deleted = FALSE
      AND e.created_at < c.created_at
    WHERE c.id NOT IN (SELECT em.job_id FROM exact_matches em)
  ),
  -- Level 3: Same company + title within 15 days
  date_window_matches AS (
    SELECT
      c.id AS job_id,
      e.id AS duplicate_of,
      'date_window'::TEXT AS match_level,
      0.85::DECIMAL(5,2) AS confidence,
      ('grp_dw_' || md5(c.normalized_title || '|' || c.normalized_company))::VARCHAR(100) AS group_id
    FROM candidates c
    JOIN public.jobs e ON e.id != c.id
      AND e.normalized_title = c.normalized_title
      AND e.normalized_company = c.normalized_company
      AND e.is_deleted = FALSE
      AND e.created_at < c.created_at
      AND c.created_at - e.created_at <= interval '15 days'
    WHERE c.id NOT IN (SELECT em.job_id FROM exact_matches em)
      AND c.id NOT IN (SELECT um.job_id FROM url_matches um)
  )
  SELECT * FROM exact_matches
  UNION ALL
  SELECT * FROM url_matches
  UNION ALL
  SELECT * FROM date_window_matches;
END;
$$;

-- MODULE 4: Pre-insert duplicate check function
CREATE OR REPLACE FUNCTION public.check_duplicate_before_insert(
  p_title TEXT,
  p_company_name TEXT,
  p_location TEXT,
  p_source_url TEXT
)
RETURNS TABLE (
  is_dup BOOLEAN,
  existing_job_id UUID,
  match_level TEXT,
  confidence DECIMAL(5,2)
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  norm_title TEXT;
  norm_company TEXT;
  norm_location TEXT;
  url_hash TEXT;
BEGIN
  norm_title := public.normalize_job_text(p_title);
  norm_company := public.normalize_job_text(p_company_name);
  norm_location := public.normalize_job_text(p_location);
  url_hash := public.generate_source_hash(p_source_url);

  -- Check exact match
  RETURN QUERY
  SELECT TRUE, j.id, 'exact'::TEXT, 1.00::DECIMAL(5,2)
  FROM public.jobs j
  WHERE j.normalized_title = norm_title
    AND j.normalized_company = norm_company
    AND j.normalized_location = norm_location
    AND j.is_deleted = FALSE
  LIMIT 1;
  
  IF FOUND THEN RETURN; END IF;

  -- Check URL hash match
  IF url_hash IS NOT NULL THEN
    RETURN QUERY
    SELECT TRUE, j.id, 'source_url'::TEXT, 0.95::DECIMAL(5,2)
    FROM public.jobs j
    WHERE j.source_url_hash = url_hash
      AND j.is_deleted = FALSE
    LIMIT 1;
    
    IF FOUND THEN RETURN; END IF;
  END IF;

  -- Check date window match (15 days)
  RETURN QUERY
  SELECT TRUE, j.id, 'date_window'::TEXT, 0.85::DECIMAL(5,2)
  FROM public.jobs j
  WHERE j.normalized_title = norm_title
    AND j.normalized_company = norm_company
    AND j.is_deleted = FALSE
    AND j.created_at >= now() - interval '15 days'
  LIMIT 1;
  
  IF FOUND THEN RETURN; END IF;

  -- No duplicate found
  RETURN QUERY SELECT FALSE, NULL::UUID, 'none'::TEXT, 0.00::DECIMAL(5,2);
END;
$$;

-- Function to mark duplicates and set canonical jobs
CREATE OR REPLACE FUNCTION public.mark_duplicates_from_detection()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  affected INT := 0;
BEGIN
  -- Run detection and update jobs
  WITH detected AS (
    SELECT * FROM public.detect_duplicate_jobs(1000)
  )
  UPDATE public.jobs j
  SET 
    is_duplicate = TRUE,
    duplicate_group_id = d.group_id,
    duplicate_confidence_score = d.confidence,
    canonical_job_id = d.duplicate_of,
    updated_at = now()
  FROM detected d
  WHERE j.id = d.job_id
    AND j.is_duplicate = FALSE;
  
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;

-- Backfill normalized fields for existing jobs
UPDATE public.jobs
SET
  normalized_title = public.normalize_job_text(title),
  normalized_company = public.normalize_job_text(COALESCE(company_name, '')),
  normalized_location = public.normalize_job_text(COALESCE(location, '')),
  source_url_hash = public.generate_source_hash(source_url)
WHERE normalized_title IS NULL;

-- MODULE 11: Audit trail table
CREATE TABLE IF NOT EXISTS public.duplicate_audit_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_id UUID NOT NULL,
  action TEXT NOT NULL,
  job_ids UUID[] NOT NULL DEFAULT '{}',
  canonical_job_id UUID,
  duplicate_group_id VARCHAR(100),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.duplicate_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage audit log"
  ON public.duplicate_audit_log
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_dup_audit_created ON public.duplicate_audit_log (created_at DESC);
CREATE INDEX idx_dup_audit_admin ON public.duplicate_audit_log (admin_id);
