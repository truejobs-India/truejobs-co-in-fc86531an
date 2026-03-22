
-- Phase 3: Draft jobs table for field-first reconstructed extraction output

CREATE TABLE public.firecrawl_draft_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staged_item_id uuid NOT NULL REFERENCES public.firecrawl_staged_items(id) ON DELETE CASCADE,
  firecrawl_source_id uuid NOT NULL REFERENCES public.firecrawl_sources(id) ON DELETE CASCADE,

  -- Source attribution (internal only, never public-facing)
  source_name text,
  source_url text,
  source_seed_url text,
  source_page_url text,
  source_bucket text,

  -- Extracted structured fields
  title text,
  normalized_title text,
  organization_name text,
  post_name text,
  job_role text,
  category text,
  department text,
  location text,
  city text,
  state text,
  total_vacancies integer,
  application_mode text,
  qualification text,
  age_limit text,
  application_fee text,
  salary text,
  pay_scale text,
  opening_date text,
  closing_date text,
  last_date_of_application text,
  exam_date text,
  selection_process text,

  -- Official URLs extracted from page (not source URLs)
  official_notification_url text,
  official_apply_url text,
  official_website_url text,
  canonical_url text,

  -- Field-first reconstructed content
  description_summary text,

  -- Extraction metadata
  extraction_confidence text NOT NULL DEFAULT 'low',
  fields_extracted integer NOT NULL DEFAULT 0,
  fields_missing text[] NOT NULL DEFAULT '{}',
  extraction_warnings text[] NOT NULL DEFAULT '{}',

  -- Raw evidence (internal audit, never published)
  raw_scraped_text text,
  raw_links_found text[],
  extracted_raw_fields jsonb NOT NULL DEFAULT '{}',
  cleaning_log text[] NOT NULL DEFAULT '{}',

  -- Workflow
  status text NOT NULL DEFAULT 'draft',
  reviewed_at timestamptz,
  reviewed_by uuid,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE(staged_item_id)
);

-- Validation trigger
CREATE OR REPLACE FUNCTION public.validate_firecrawl_draft_jobs_fields()
  RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.status NOT IN ('draft', 'reviewed', 'approved', 'rejected', 'promoted') THEN
    RAISE EXCEPTION 'Invalid firecrawl_draft_jobs.status: %', NEW.status;
  END IF;
  IF NEW.extraction_confidence NOT IN ('high', 'medium', 'low', 'none') THEN
    RAISE EXCEPTION 'Invalid firecrawl_draft_jobs.extraction_confidence: %', NEW.extraction_confidence;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_validate_firecrawl_draft_jobs
  BEFORE INSERT OR UPDATE ON public.firecrawl_draft_jobs
  FOR EACH ROW EXECUTE FUNCTION public.validate_firecrawl_draft_jobs_fields();

CREATE TRIGGER trg_firecrawl_draft_jobs_updated_at
  BEFORE UPDATE ON public.firecrawl_draft_jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS: admin-only
ALTER TABLE public.firecrawl_draft_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage firecrawl_draft_jobs" ON public.firecrawl_draft_jobs
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Add extraction_status to staged items for tracking
ALTER TABLE public.firecrawl_staged_items
  ADD COLUMN extraction_status text NOT NULL DEFAULT 'pending';

-- Update staged items validation
CREATE OR REPLACE FUNCTION public.validate_firecrawl_staged_items_fields()
  RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.status NOT IN ('staged', 'reviewed', 'promoted', 'discarded', 'duplicate') THEN
    RAISE EXCEPTION 'Invalid firecrawl_staged_items.status: %', NEW.status;
  END IF;
  IF NEW.bucket NOT IN ('single_recruitment', 'collection_roundup', 'exam_update', 'prep_resource', 'rejected') THEN
    RAISE EXCEPTION 'Invalid firecrawl_staged_items.bucket: %', NEW.bucket;
  END IF;
  IF NEW.extraction_status NOT IN ('pending', 'extracting', 'extracted', 'failed', 'skipped') THEN
    RAISE EXCEPTION 'Invalid firecrawl_staged_items.extraction_status: %', NEW.extraction_status;
  END IF;
  RETURN NEW;
END; $$;
