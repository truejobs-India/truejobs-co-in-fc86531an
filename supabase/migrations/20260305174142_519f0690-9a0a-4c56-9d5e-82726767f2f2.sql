
-- Drop govt-related tables
DROP TABLE IF EXISTS public.saved_gov_jobs CASCADE;
DROP TABLE IF EXISTS public.gov_jobs CASCADE;
DROP TABLE IF EXISTS public.govt_jobs_raw CASCADE;
DROP TABLE IF EXISTS public.en_issues CASCADE;
DROP TABLE IF EXISTS public.portal_crawl_log CASCADE;

-- Drop govt-related functions
DROP FUNCTION IF EXISTS public.govt_jobs_raw_compute_hashes() CASCADE;
DROP FUNCTION IF EXISTS public.validate_gov_jobs_seo_status() CASCADE;

-- Remove is_govt_source column from scraping_sources
ALTER TABLE public.scraping_sources DROP COLUMN IF EXISTS is_govt_source;
