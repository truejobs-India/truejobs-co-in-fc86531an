-- Master-File intake — add typed columns and runtime metadata
ALTER TABLE public.intake_drafts
  ADD COLUMN IF NOT EXISTS row_type text,
  ADD COLUMN IF NOT EXISTS content_status text,
  ADD COLUMN IF NOT EXISTS row_prompt text,
  ADD COLUMN IF NOT EXISTS draft_heading_h1 text,
  ADD COLUMN IF NOT EXISTS image_prompt text,
  ADD COLUMN IF NOT EXISTS image_alt_text text,
  ADD COLUMN IF NOT EXISTS image_url text,
  ADD COLUMN IF NOT EXISTS cta_label text,
  ADD COLUMN IF NOT EXISTS cta_color text,
  ADD COLUMN IF NOT EXISTS cta_url text,
  ADD COLUMN IF NOT EXISTS seo_primary_keyword text,
  ADD COLUMN IF NOT EXISTS seo_secondary_keywords text,
  ADD COLUMN IF NOT EXISTS verification_notes text,
  ADD COLUMN IF NOT EXISTS runtime_meta jsonb DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.intake_drafts.source_row_json IS 'Immutable lossless backup of the original imported row. Never written by enrichment or image generation — only by the importer.';
COMMENT ON COLUMN public.intake_drafts.runtime_meta IS 'Mutable runtime/process metadata (image errors, model used, image generated_at, etc). Safe to write from edge functions; do not write here from importer.';
COMMENT ON COLUMN public.intake_drafts.row_prompt IS 'Master-File "prompt" column — verbatim user enrichment instruction for this row.';
COMMENT ON COLUMN public.intake_drafts.cta_label IS 'CTA button label (mapped from Master-File cta_button_label at parser boundary).';
COMMENT ON COLUMN public.intake_drafts.cta_color IS 'CTA button color (mapped from Master-File cta_button_color at parser boundary).';
COMMENT ON COLUMN public.intake_drafts.cta_url IS 'CTA button URL (mapped from Master-File cta_button_url at parser boundary).';