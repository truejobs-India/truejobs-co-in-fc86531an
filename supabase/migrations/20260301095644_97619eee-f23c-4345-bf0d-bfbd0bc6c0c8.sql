
-- Drop the unique constraint that prevents cleaning duplicate source_url_hash values
-- The regular idx_jobs_source_url_hash index already provides lookup performance
DROP INDEX IF EXISTS idx_jobs_unique_source_url_hash;
