UPDATE firecrawl_draft_jobs 
SET status = 'enriched', updated_at = now() 
WHERE status = 'draft' 
  AND ai_enrichment_log IS NOT NULL 
  AND jsonb_array_length(ai_enrichment_log) > 0
  AND dedup_status != 'duplicate'