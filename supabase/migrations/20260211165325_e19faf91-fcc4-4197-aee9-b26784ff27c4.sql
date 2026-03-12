
-- Replace detect_duplicate_jobs with weighted confidence scoring
-- Title: 30%, Company: 25%, Location: 15%, Description similarity: 30%
CREATE OR REPLACE FUNCTION public.detect_duplicate_jobs(p_batch_size integer DEFAULT 500)
 RETURNS TABLE(job_id uuid, duplicate_of uuid, match_level text, confidence numeric, group_id character varying)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  WITH candidates AS (
    SELECT j.id, j.normalized_title, j.normalized_company, j.normalized_location,
           j.source_url_hash, j.created_at, j.description, j.company_name, j.title, j.location
    FROM public.jobs j
    WHERE j.is_deleted = FALSE AND j.is_duplicate = FALSE
    ORDER BY j.created_at DESC
    LIMIT p_batch_size
  ),
  -- Weighted scoring: title 30% + company 25% + location 15% + description 30%
  scored_matches AS (
    SELECT
      c.id AS cid,
      e.id AS eid,
      -- Title match (30%): exact normalized = 1.0
      CASE WHEN c.normalized_title = e.normalized_title THEN 0.30
           WHEN c.normalized_title IS NOT NULL AND e.normalized_title IS NOT NULL
                AND c.normalized_title LIKE '%' || LEFT(e.normalized_title, 10) || '%' THEN 0.15
           ELSE 0.0 END AS title_score,
      -- Company match (25%): exact normalized = 1.0
      CASE WHEN c.normalized_company = e.normalized_company THEN 0.25
           WHEN c.normalized_company IS NOT NULL AND e.normalized_company IS NOT NULL
                AND c.normalized_company LIKE '%' || LEFT(e.normalized_company, 8) || '%' THEN 0.125
           ELSE 0.0 END AS company_score,
      -- Location match (15%): exact normalized = 1.0
      CASE WHEN c.normalized_location = e.normalized_location THEN 0.15
           WHEN c.normalized_location IS NOT NULL AND e.normalized_location IS NOT NULL
                AND c.normalized_location LIKE '%' || LEFT(e.normalized_location, 6) || '%' THEN 0.075
           ELSE 0.0 END AS location_score,
      -- Description similarity (30%): length-based proxy (trigram would be better but requires extension)
      CASE WHEN c.description = e.description THEN 0.30
           WHEN length(c.description) > 50 AND length(e.description) > 50
                AND abs(length(c.description) - length(e.description)) < (length(c.description) * 0.1)
                AND left(c.description, 100) = left(e.description, 100) THEN 0.24
           WHEN length(c.description) > 50 AND length(e.description) > 50
                AND abs(length(c.description) - length(e.description)) < (length(c.description) * 0.2)
                AND left(c.description, 50) = left(e.description, 50) THEN 0.15
           ELSE 0.0 END AS desc_score,
      e.created_at AS existing_created_at,
      c.created_at AS candidate_created_at
    FROM candidates c
    JOIN public.jobs e ON e.id != c.id
      AND e.is_deleted = FALSE
      AND e.created_at < c.created_at
      -- Pre-filter: at least title or company must match to avoid N^2 explosion
      AND (c.normalized_title = e.normalized_title OR c.normalized_company = e.normalized_company)
  ),
  -- Compute total weighted score and filter
  final_scored AS (
    SELECT
      cid,
      eid,
      (title_score + company_score + location_score + desc_score)::DECIMAL(5,3) AS total_score,
      CASE
        WHEN title_score = 0.30 AND company_score = 0.25 AND location_score = 0.15 AND desc_score = 0.30 THEN 'exact'
        WHEN title_score = 0.30 AND company_score = 0.25 AND desc_score >= 0.15 THEN 'near_exact'
        WHEN title_score >= 0.15 AND company_score >= 0.125 THEN 'fuzzy'
        ELSE 'partial'
      END AS match_level
    FROM scored_matches
    WHERE (title_score + company_score + location_score + desc_score) >= 0.55
  ),
  -- Deduplicate: keep highest score per candidate
  best_match AS (
    SELECT DISTINCT ON (cid)
      cid, eid, total_score, match_level
    FROM final_scored
    ORDER BY cid, total_score DESC
  )
  SELECT
    bm.cid AS job_id,
    bm.eid AS duplicate_of,
    bm.match_level::TEXT,
    bm.total_score AS confidence,
    ('grp_w_' || md5(bm.eid::text))::VARCHAR(100) AS group_id
  FROM best_match bm;
END;
$function$;

-- Also update check_duplicate_before_insert with weighted scoring
CREATE OR REPLACE FUNCTION public.check_duplicate_before_insert(p_title text, p_company_name text, p_location text, p_source_url text)
 RETURNS TABLE(is_dup boolean, existing_job_id uuid, match_level text, confidence numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  norm_title TEXT;
  norm_company TEXT;
  norm_location TEXT;
  url_hash TEXT;
  rec RECORD;
BEGIN
  norm_title := public.normalize_job_text(p_title);
  norm_company := public.normalize_job_text(p_company_name);
  norm_location := public.normalize_job_text(p_location);
  url_hash := public.generate_source_hash(p_source_url);

  -- Check URL hash match first (strongest signal)
  IF url_hash IS NOT NULL THEN
    RETURN QUERY
    SELECT TRUE, j.id, 'source_url'::TEXT, 0.98::DECIMAL(5,2)
    FROM public.jobs j
    WHERE j.source_url_hash = url_hash
      AND j.is_deleted = FALSE
    LIMIT 1;
    IF FOUND THEN RETURN; END IF;
  END IF;

  -- Weighted scoring check against recent jobs
  FOR rec IN
    SELECT j.id,
      (CASE WHEN j.normalized_title = norm_title THEN 0.30 ELSE 0.0 END +
       CASE WHEN j.normalized_company = norm_company THEN 0.25 ELSE 0.0 END +
       CASE WHEN j.normalized_location = norm_location THEN 0.15 ELSE 0.0 END) AS score
    FROM public.jobs j
    WHERE j.is_deleted = FALSE
      AND (j.normalized_title = norm_title OR j.normalized_company = norm_company)
      AND j.created_at >= now() - interval '30 days'
    ORDER BY
      (CASE WHEN j.normalized_title = norm_title THEN 0.30 ELSE 0.0 END +
       CASE WHEN j.normalized_company = norm_company THEN 0.25 ELSE 0.0 END +
       CASE WHEN j.normalized_location = norm_location THEN 0.15 ELSE 0.0 END) DESC
    LIMIT 1
  LOOP
    IF rec.score >= 0.55 THEN
      RETURN QUERY SELECT TRUE, rec.id,
        CASE WHEN rec.score >= 0.70 THEN 'exact'::TEXT
             WHEN rec.score >= 0.55 THEN 'near_exact'::TEXT
             ELSE 'partial'::TEXT END,
        rec.score::DECIMAL(5,2);
      RETURN;
    END IF;
  END LOOP;

  -- No duplicate found
  RETURN QUERY SELECT FALSE, NULL::UUID, 'none'::TEXT, 0.00::DECIMAL(5,2);
END;
$function$;
