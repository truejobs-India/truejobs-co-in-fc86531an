-- Add 16 production-format columns + lossless backup + parsed date + unified import identity
ALTER TABLE public.intake_drafts
  ADD COLUMN IF NOT EXISTS record_id text,
  ADD COLUMN IF NOT EXISTS publish_status text,
  ADD COLUMN IF NOT EXISTS category_family text,
  ADD COLUMN IF NOT EXISTS update_type text,
  ADD COLUMN IF NOT EXISTS organization_authority text,
  ADD COLUMN IF NOT EXISTS publish_title text,
  ADD COLUMN IF NOT EXISTS official_website_url text,
  ADD COLUMN IF NOT EXISTS official_reference_url text,
  ADD COLUMN IF NOT EXISTS primary_cta_label text,
  ADD COLUMN IF NOT EXISTS primary_cta_url text,
  ADD COLUMN IF NOT EXISTS secondary_official_url text,
  ADD COLUMN IF NOT EXISTS verification_status text,
  ADD COLUMN IF NOT EXISTS verification_confidence text,
  ADD COLUMN IF NOT EXISTS official_source_used text,
  ADD COLUMN IF NOT EXISTS source_verified_on text,
  ADD COLUMN IF NOT EXISTS production_notes text,
  ADD COLUMN IF NOT EXISTS source_row_json jsonb,
  ADD COLUMN IF NOT EXISTS source_verified_on_date date,
  ADD COLUMN IF NOT EXISTS import_identity text;

-- Backfill import_identity for ALL existing rows (not scoped to chatgpt_agent)
UPDATE public.intake_drafts
SET import_identity = id::text
WHERE import_identity IS NULL;

-- Enforce NOT NULL after backfill
ALTER TABLE public.intake_drafts
  ALTER COLUMN import_identity SET NOT NULL;

-- Single plain unique index for upsert conflict target
CREATE UNIQUE INDEX IF NOT EXISTS intake_drafts_source_identity_uidx
  ON public.intake_drafts (source_channel, import_identity);