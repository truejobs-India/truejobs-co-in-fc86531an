ALTER TABLE public.firecrawl_draft_jobs
  ADD COLUMN IF NOT EXISTS admin_edited_fields text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS reviewed_by uuid;

CREATE INDEX IF NOT EXISTS idx_firecrawl_drafts_dedup_status
  ON public.firecrawl_draft_jobs(dedup_status);

CREATE INDEX IF NOT EXISTS idx_firecrawl_drafts_status
  ON public.firecrawl_draft_jobs(status);