-- Drop the current non-unique index
DROP INDEX IF EXISTS idx_jobs_source_url_hash;

-- Create unique partial index excluding NULL, empty-hash, and deleted records
CREATE UNIQUE INDEX idx_jobs_unique_source_url_hash
ON public.jobs (source_url_hash)
WHERE source_url_hash IS NOT NULL
  AND source_url_hash != md5('')
  AND is_deleted = false;