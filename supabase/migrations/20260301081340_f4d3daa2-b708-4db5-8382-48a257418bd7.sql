
-- Create unique partial indexes after cleanup

CREATE UNIQUE INDEX IF NOT EXISTS idx_jobs_unique_source_url_hash
ON public.jobs (source_url_hash)
WHERE source_url_hash IS NOT NULL AND is_deleted = false;

CREATE UNIQUE INDEX IF NOT EXISTS idx_jobs_unique_title_company
ON public.jobs (normalized_title, normalized_company)
WHERE is_deleted = false AND status NOT IN ('archived');
