-- One-time scoped repair: clear the retry-whitelist-bug poison from pending Employment News jobs
-- so they can be re-enriched against the now-fixed dispatcher.
UPDATE public.employment_news_jobs
SET enrichment_error = NULL,
    enrichment_attempts = 0
WHERE status = 'pending'
  AND enrichment_error LIKE '%JSON parse retry not supported%';