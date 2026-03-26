ALTER TABLE firecrawl_draft_jobs ADD COLUMN IF NOT EXISTS auto_publish_eligible boolean DEFAULT false;
ALTER TABLE firecrawl_draft_jobs ADD COLUMN IF NOT EXISTS auto_published_at timestamptz;
ALTER TABLE firecrawl_draft_jobs ADD COLUMN IF NOT EXISTS publish_rejection_reasons text[];
ALTER TABLE firecrawl_draft_jobs ADD COLUMN IF NOT EXISTS promoted_job_id uuid;
ALTER TABLE firecrawl_draft_jobs ADD COLUMN IF NOT EXISTS retry_count integer DEFAULT 0;
ALTER TABLE firecrawl_draft_jobs ADD COLUMN IF NOT EXISTS last_retry_at timestamptz;