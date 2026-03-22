
-- Phase 4: Add AI enrichment columns to firecrawl_draft_jobs

ALTER TABLE public.firecrawl_draft_jobs
  ADD COLUMN IF NOT EXISTS seo_title text,
  ADD COLUMN IF NOT EXISTS meta_description text,
  ADD COLUMN IF NOT EXISTS slug_suggestion text,
  ADD COLUMN IF NOT EXISTS intro_text text,
  ADD COLUMN IF NOT EXISTS faq_suggestions jsonb DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS cover_image_prompt text,
  ADD COLUMN IF NOT EXISTS cover_image_url text,
  ADD COLUMN IF NOT EXISTS ai_enrichment_log jsonb DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS ai_clean_at timestamptz,
  ADD COLUMN IF NOT EXISTS ai_enrich_at timestamptz,
  ADD COLUMN IF NOT EXISTS ai_links_at timestamptz,
  ADD COLUMN IF NOT EXISTS ai_fix_missing_at timestamptz,
  ADD COLUMN IF NOT EXISTS ai_seo_at timestamptz,
  ADD COLUMN IF NOT EXISTS ai_cover_prompt_at timestamptz,
  ADD COLUMN IF NOT EXISTS ai_cover_image_at timestamptz,
  ADD COLUMN IF NOT EXISTS official_link_confidence text,
  ADD COLUMN IF NOT EXISTS official_link_reason text;
