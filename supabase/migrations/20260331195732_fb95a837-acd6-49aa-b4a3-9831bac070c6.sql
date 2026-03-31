
-- Create the intake_drafts table
CREATE TABLE public.intake_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- A. Source and identity
  source_name text,
  source_url text,
  source_domain text,
  source_type text NOT NULL DEFAULT 'manual',
  discovered_at timestamptz DEFAULT now(),
  scrape_run_id text,
  raw_title text,
  raw_text text,
  raw_html text,
  raw_file_url text,
  raw_file_type text NOT NULL DEFAULT 'unknown',

  -- B. Main classification
  content_type text,
  primary_status text, -- nullable before AI classification
  secondary_tags jsonb DEFAULT '[]'::jsonb,
  publish_target text,
  confidence_score numeric,
  classification_reason text,
  publish_blockers jsonb DEFAULT '[]'::jsonb,

  -- C. Workflow state
  processing_status text NOT NULL DEFAULT 'imported',
  review_status text NOT NULL DEFAULT 'pending',

  -- D. Normalized public fields
  normalized_title text,
  seo_title text,
  slug text,
  meta_description text,
  summary text,
  organisation_name text,
  department_name text,
  ministry_name text,
  post_name text,
  exam_name text,
  advertisement_no text,
  reference_no text,
  job_location text,
  application_mode text,

  -- E. Dates
  notification_date text,
  opening_date text,
  closing_date text,
  exam_date text,
  result_date text,
  admit_card_date text,
  answer_key_date text,
  correction_last_date text,

  -- F. Recruitment details
  vacancy_count integer,
  qualification_text text,
  age_limit_text text,
  application_fee_text text,
  selection_process_text text,
  salary_text text,
  how_to_apply_text text,

  -- G. Links
  official_notification_link text,
  official_apply_link text,
  official_website_link text,
  result_link text,
  admit_card_link text,
  answer_key_link text,

  -- H. Content payload
  key_points_json jsonb,
  faq_json jsonb,
  important_dates_json jsonb,
  important_links_json jsonb,
  structured_data_json jsonb,
  draft_content_html text,
  draft_content_text text,

  -- I. AI and review metadata
  ai_model_used text,
  ai_processed_at timestamptz,
  review_notes text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  published_record_id text,
  published_table_name text,
  published_at timestamptz,
  publish_error text,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Validation trigger
CREATE OR REPLACE FUNCTION public.validate_intake_drafts_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.source_type NOT IN ('crawler', 'rss', 'employment_news', 'manual') THEN
    RAISE EXCEPTION 'Invalid intake_drafts.source_type: %', NEW.source_type;
  END IF;
  IF NEW.raw_file_type NOT IN ('html', 'pdf', 'doc', 'image', 'unknown') THEN
    RAISE EXCEPTION 'Invalid intake_drafts.raw_file_type: %', NEW.raw_file_type;
  END IF;
  IF NEW.content_type IS NOT NULL AND NEW.content_type NOT IN (
    'job', 'result', 'admit_card', 'answer_key', 'exam', 'notification',
    'scholarship', 'certificate', 'marksheet', 'not_publishable'
  ) THEN
    RAISE EXCEPTION 'Invalid intake_drafts.content_type: %', NEW.content_type;
  END IF;
  IF NEW.primary_status IS NOT NULL AND NEW.primary_status NOT IN ('publish_ready', 'manual_check', 'reject') THEN
    RAISE EXCEPTION 'Invalid intake_drafts.primary_status: %', NEW.primary_status;
  END IF;
  IF NEW.processing_status NOT IN ('imported', 'ai_processed', 'reviewed', 'published', 'publish_failed') THEN
    RAISE EXCEPTION 'Invalid intake_drafts.processing_status: %', NEW.processing_status;
  END IF;
  IF NEW.review_status NOT IN ('pending', 'reviewed', 'approved', 'rejected') THEN
    RAISE EXCEPTION 'Invalid intake_drafts.review_status: %', NEW.review_status;
  END IF;
  IF NEW.publish_target IS NOT NULL AND NEW.publish_target NOT IN (
    'jobs', 'results', 'admit_cards', 'answer_keys', 'exams', 'notifications',
    'scholarships', 'certificates', 'marksheets', 'none'
  ) THEN
    RAISE EXCEPTION 'Invalid intake_drafts.publish_target: %', NEW.publish_target;
  END IF;
  IF NEW.application_mode IS NOT NULL AND NEW.application_mode NOT IN ('online', 'offline', 'walk_in', 'email', 'unknown') THEN
    RAISE EXCEPTION 'Invalid intake_drafts.application_mode: %', NEW.application_mode;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_intake_drafts
  BEFORE INSERT OR UPDATE ON public.intake_drafts
  FOR EACH ROW EXECUTE FUNCTION public.validate_intake_drafts_fields();

-- Updated_at trigger
CREATE TRIGGER trg_intake_drafts_updated_at
  BEFORE UPDATE ON public.intake_drafts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Indexes
CREATE INDEX idx_intake_drafts_source_url ON public.intake_drafts (source_url);
CREATE INDEX idx_intake_drafts_source_domain ON public.intake_drafts (source_domain);
CREATE INDEX idx_intake_drafts_content_type ON public.intake_drafts (content_type);
CREATE INDEX idx_intake_drafts_primary_status ON public.intake_drafts (primary_status);
CREATE INDEX idx_intake_drafts_publish_target ON public.intake_drafts (publish_target);
CREATE INDEX idx_intake_drafts_processing_status ON public.intake_drafts (processing_status);
CREATE INDEX idx_intake_drafts_review_status ON public.intake_drafts (review_status);
CREATE INDEX idx_intake_drafts_discovered_at ON public.intake_drafts (discovered_at);

-- RLS
ALTER TABLE public.intake_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin read intake_drafts"
  ON public.intake_drafts FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin insert intake_drafts"
  ON public.intake_drafts FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin update intake_drafts"
  ON public.intake_drafts FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin delete intake_drafts"
  ON public.intake_drafts FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
