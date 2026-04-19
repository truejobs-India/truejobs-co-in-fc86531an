ALTER TABLE public.intake_drafts
  ADD COLUMN IF NOT EXISTS official_fetch_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS official_fetch_html_text TEXT,
  ADD COLUMN IF NOT EXISTS official_fetch_pdf_text TEXT,
  ADD COLUMN IF NOT EXISTS official_fetch_status TEXT,
  ADD COLUMN IF NOT EXISTS official_fetch_url TEXT,
  ADD COLUMN IF NOT EXISTS enrichment_reason TEXT;