
-- Phase 3: Add government-specific fields and confidence tracking to firecrawl_draft_jobs
ALTER TABLE firecrawl_draft_jobs ADD COLUMN IF NOT EXISTS advertisement_number text;
ALTER TABLE firecrawl_draft_jobs ADD COLUMN IF NOT EXISTS last_date_for_fee text;
ALTER TABLE firecrawl_draft_jobs ADD COLUMN IF NOT EXISTS correction_window text;
ALTER TABLE firecrawl_draft_jobs ADD COLUMN IF NOT EXISTS admit_card_date text;
ALTER TABLE firecrawl_draft_jobs ADD COLUMN IF NOT EXISTS result_date text;
ALTER TABLE firecrawl_draft_jobs ADD COLUMN IF NOT EXISTS age_relaxation text;
ALTER TABLE firecrawl_draft_jobs ADD COLUMN IF NOT EXISTS how_to_apply text;
ALTER TABLE firecrawl_draft_jobs ADD COLUMN IF NOT EXISTS important_instructions text;
ALTER TABLE firecrawl_draft_jobs ADD COLUMN IF NOT EXISTS eligibility_summary text;
ALTER TABLE firecrawl_draft_jobs ADD COLUMN IF NOT EXISTS application_fee_details text;
ALTER TABLE firecrawl_draft_jobs ADD COLUMN IF NOT EXISTS selection_process_details text;
ALTER TABLE firecrawl_draft_jobs ADD COLUMN IF NOT EXISTS vacancy_details text;
ALTER TABLE firecrawl_draft_jobs ADD COLUMN IF NOT EXISTS important_dates_json jsonb DEFAULT '{}';
ALTER TABLE firecrawl_draft_jobs ADD COLUMN IF NOT EXISTS official_links_json jsonb DEFAULT '{}';
ALTER TABLE firecrawl_draft_jobs ADD COLUMN IF NOT EXISTS field_confidence jsonb DEFAULT '{}';
ALTER TABLE firecrawl_draft_jobs ADD COLUMN IF NOT EXISTS field_evidence jsonb DEFAULT '{}';
ALTER TABLE firecrawl_draft_jobs ADD COLUMN IF NOT EXISTS source_type_tag text DEFAULT 'general';
ALTER TABLE firecrawl_draft_jobs ADD COLUMN IF NOT EXISTS publish_readiness text DEFAULT 'incomplete';
ALTER TABLE firecrawl_draft_jobs ADD COLUMN IF NOT EXISTS ai_govt_extract_at timestamptz;
ALTER TABLE firecrawl_draft_jobs ADD COLUMN IF NOT EXISTS ai_govt_enrich_at timestamptz;
