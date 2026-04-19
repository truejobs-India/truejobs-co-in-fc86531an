ALTER TABLE public.intake_drafts
  ADD COLUMN IF NOT EXISTS enrichment_grade text,
  ADD COLUMN IF NOT EXISTS enrichment_completeness integer,
  ADD COLUMN IF NOT EXISTS enrichment_source_trace jsonb,
  ADD COLUMN IF NOT EXISTS discovered_official_url text,
  ADD COLUMN IF NOT EXISTS discovery_confidence text,
  ADD COLUMN IF NOT EXISTS discovery_status text,
  ADD COLUMN IF NOT EXISTS discovery_evidence jsonb;

CREATE INDEX IF NOT EXISTS idx_intake_drafts_enrichment_result_channel
  ON public.intake_drafts (source_channel, enrichment_result);