-- Drop trigger (depends on normalize_job_fields function)
DROP TRIGGER IF EXISTS trg_normalize_job_fields ON public.jobs;

-- Drop scraping-only tables (scrape_results first due to FK to scraping_sources)
DROP TABLE IF EXISTS public.scrape_results CASCADE;
DROP TABLE IF EXISTS public.scrape_urls_ats_success CASCADE;
DROP TABLE IF EXISTS public.scrape_urls_ats_fail CASCADE;
DROP TABLE IF EXISTS public.scrape_urls_non_ats_success CASCADE;
DROP TABLE IF EXISTS public.scrape_urls_non_ats_fail CASCADE;
DROP TABLE IF EXISTS public.duplicate_audit_log CASCADE;
DROP TABLE IF EXISTS public.scraping_sources CASCADE;

-- Drop scraping-only DB functions (exact arg types, no names)
DROP FUNCTION IF EXISTS public.normalize_job_fields();
DROP FUNCTION IF EXISTS public.normalize_job_text(text);
DROP FUNCTION IF EXISTS public.generate_source_hash(text);
DROP FUNCTION IF EXISTS public.check_duplicate_before_insert(text, text, text, text);
DROP FUNCTION IF EXISTS public.detect_duplicate_jobs(integer);
DROP FUNCTION IF EXISTS public.mark_duplicates_from_detection();
DROP FUNCTION IF EXISTS public.get_enrichment_counts();
DROP FUNCTION IF EXISTS public.classify_unclassified_jobs();

-- Drop scraping-only enum (only used by now-dropped scraping_sources.status)
DROP TYPE IF EXISTS public.scraping_source_status;