
-- 1. Fix CASCADE → SET NULL on jobs.company_id
ALTER TABLE jobs DROP CONSTRAINT IF EXISTS jobs_company_id_fkey;
ALTER TABLE jobs ADD CONSTRAINT jobs_company_id_fkey
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL;

-- 2. Fix CASCADE → SET NULL on job_posting_drafts.company_id  
ALTER TABLE job_posting_drafts DROP CONSTRAINT IF EXISTS job_posting_drafts_company_id_fkey;
ALTER TABLE job_posting_drafts ADD CONSTRAINT job_posting_drafts_company_id_fkey
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL;
ALTER TABLE job_posting_drafts ALTER COLUMN company_id DROP NOT NULL;

-- 3. Create blocked_companies table
CREATE TABLE public.blocked_companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  normalized_name text NOT NULL,
  original_name text NOT NULL,
  aliases text[] NOT NULL DEFAULT '{}',
  website_domain text,
  reason text NOT NULL DEFAULT 'Permanently removed by admin',
  blocked_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  is_active boolean NOT NULL DEFAULT true,
  UNIQUE(normalized_name)
);

ALTER TABLE blocked_companies ENABLE ROW LEVEL SECURITY;

-- Admin-only policy (no public/anon access)
CREATE POLICY "Admins manage blocked companies"
  ON blocked_companies FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 4. is_company_blocked: SECURITY DEFINER, returns boolean only
CREATE OR REPLACE FUNCTION public.is_company_blocked(p_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM blocked_companies
    WHERE is_active = true
    AND (
      normalized_name = lower(trim(p_name))
      OR lower(trim(p_name)) = ANY(
        SELECT lower(trim(a)) FROM unnest(aliases) AS a
      )
    )
  )
$$;

-- 5. permanently_remove_and_block_company RPC
CREATE OR REPLACE FUNCTION public.permanently_remove_and_block_company(
  p_company_id uuid,
  p_company_name text,
  p_aliases text[] DEFAULT '{}',
  p_reason text DEFAULT 'Permanently removed by admin'
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_caller uuid;
  v_normalized text;
  v_website_domain text;
  v_company_slug text;
  v_logo_url text;
  v_cover_image_url text;
  v_deleted_jobs_by_id int := 0;
  v_deleted_jobs_by_name int := 0;
  v_deleted_drafts int := 0;
  v_tmp int;
  v_storage_paths text[] := '{}';
BEGIN
  -- Auth check
  v_caller := auth.uid();
  IF v_caller IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authentication required');
  END IF;
  IF NOT public.has_role(v_caller, 'admin') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Admin role required');
  END IF;

  v_normalized := lower(trim(p_company_name));

  -- STEP 1: Capture identifiers BEFORE any deletion
  IF p_company_id IS NOT NULL THEN
    SELECT
      NULLIF(regexp_replace(COALESCE(website_url, ''), '^https?://(www\.)?', ''), ''),
      slug,
      logo_url,
      cover_image_url
    INTO v_website_domain, v_company_slug, v_logo_url, v_cover_image_url
    FROM companies WHERE id = p_company_id;

    -- Build storage paths from URLs
    IF v_logo_url IS NOT NULL AND v_logo_url LIKE '%company-assets%' THEN
      v_storage_paths := v_storage_paths || regexp_replace(v_logo_url, '^.*/company-assets/', '');
    END IF;
    IF v_cover_image_url IS NOT NULL AND v_cover_image_url LIKE '%company-assets%' THEN
      v_storage_paths := v_storage_paths || regexp_replace(v_cover_image_url, '^.*/company-assets/', '');
    END IF;
  END IF;

  -- STEP 2: Delete jobs by company_id
  IF p_company_id IS NOT NULL THEN
    DELETE FROM jobs WHERE company_id = p_company_id;
    GET DIAGNOSTICS v_tmp = ROW_COUNT;
    v_deleted_jobs_by_id := v_tmp;

    DELETE FROM job_posting_drafts WHERE company_id = p_company_id;
    GET DIAGNOSTICS v_tmp = ROW_COUNT;
    v_deleted_drafts := v_tmp;
  END IF;

  -- STEP 3: Delete jobs by normalized company_name (only orphans not already caught)
  DELETE FROM jobs
    WHERE lower(trim(company_name)) = v_normalized
    AND (company_id IS NULL OR company_id != p_company_id);
  GET DIAGNOSTICS v_tmp = ROW_COUNT;
  v_deleted_jobs_by_name := v_tmp;

  -- STEP 4: Delete the company row
  IF p_company_id IS NOT NULL THEN
    DELETE FROM companies WHERE id = p_company_id;
  END IF;

  -- STEP 5: Insert blocklist entry
  INSERT INTO blocked_companies (normalized_name, original_name, aliases, website_domain, reason, blocked_by)
  VALUES (v_normalized, p_company_name, COALESCE(p_aliases, '{}'), v_website_domain, p_reason, v_caller)
  ON CONFLICT (normalized_name) DO UPDATE SET
    is_active = true,
    aliases = EXCLUDED.aliases,
    website_domain = COALESCE(EXCLUDED.website_domain, blocked_companies.website_domain),
    reason = EXCLUDED.reason,
    blocked_by = EXCLUDED.blocked_by;

  -- STEP 6: Precise cache purge
  DELETE FROM seo_page_cache WHERE slug = 'companies';
  IF v_company_slug IS NOT NULL THEN
    DELETE FROM seo_page_cache WHERE slug = 'companies/' || v_company_slug;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'deleted_jobs_by_id', v_deleted_jobs_by_id,
    'deleted_jobs_by_name', v_deleted_jobs_by_name,
    'deleted_drafts', v_deleted_drafts,
    'blocked_name', v_normalized,
    'blocked_domain', v_website_domain,
    'storage_paths', to_jsonb(v_storage_paths)
  );
END;
$$;
