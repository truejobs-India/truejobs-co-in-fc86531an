
CREATE OR REPLACE FUNCTION public.get_enrichment_counts()
RETURNS TABLE (
  enriched BIGINT,
  pending BIGINT,
  recently_scraped BIGINT,
  failed BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT
    COUNT(*) FILTER (WHERE ai_processed_at IS NOT NULL) as enriched,
    COUNT(*) FILTER (WHERE ai_processed_at IS NULL) as pending,
    COUNT(*) FILTER (WHERE source = 'scraped' AND created_at >= now() - interval '7 days' AND ai_processed_at IS NULL) as recently_scraped,
    COUNT(*) FILTER (WHERE ai_processed_at IS NOT NULL AND extraction_confidence < 0.3) as failed
  FROM public.jobs
  WHERE status = 'active';
$$;
