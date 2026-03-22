-- Dedup status tracking on firecrawl_draft_jobs
ALTER TABLE public.firecrawl_draft_jobs
  ADD COLUMN IF NOT EXISTS dedup_status text NOT NULL DEFAULT 'unchecked',
  ADD COLUMN IF NOT EXISTS dedup_match_ids text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS dedup_reason text,
  ADD COLUMN IF NOT EXISTS dedup_checked_at timestamptz,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid;

-- Index for dedup queries
CREATE INDEX IF NOT EXISTS idx_firecrawl_drafts_dedup ON public.firecrawl_draft_jobs(dedup_status) WHERE dedup_status != 'unchecked';
CREATE INDEX IF NOT EXISTS idx_firecrawl_drafts_status ON public.firecrawl_draft_jobs(status);
CREATE INDEX IF NOT EXISTS idx_firecrawl_drafts_org_title ON public.firecrawl_draft_jobs(organization_name, normalized_title) WHERE status = 'draft';