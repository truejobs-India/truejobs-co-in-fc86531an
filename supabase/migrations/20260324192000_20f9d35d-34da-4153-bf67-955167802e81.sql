
-- ============================================================
-- Azure Emp News: 6 tables + storage bucket + RLS + indexes
-- ============================================================

-- 1. azure_emp_news_issues
CREATE TABLE public.azure_emp_news_issues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_name text NOT NULL,
  issue_date date,
  total_pages integer NOT NULL DEFAULT 0,
  uploaded_pages integer NOT NULL DEFAULT 0,
  ocr_completed_pages integer NOT NULL DEFAULT 0,
  ocr_failed_pages integer NOT NULL DEFAULT 0,
  ocr_status text NOT NULL DEFAULT 'pending',
  reconstruction_status text NOT NULL DEFAULT 'pending',
  ai_status text NOT NULL DEFAULT 'pending',
  publish_status text NOT NULL DEFAULT 'pending',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Validation triggers instead of CHECK constraints
CREATE OR REPLACE FUNCTION public.validate_azure_emp_news_issues()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.ocr_status NOT IN ('pending','processing','partially_completed','completed','failed') THEN
    RAISE EXCEPTION 'Invalid ocr_status: %', NEW.ocr_status;
  END IF;
  IF NEW.reconstruction_status NOT IN ('pending','processing','completed','failed') THEN
    RAISE EXCEPTION 'Invalid reconstruction_status: %', NEW.reconstruction_status;
  END IF;
  IF NEW.ai_status NOT IN ('pending','processing','completed','failed') THEN
    RAISE EXCEPTION 'Invalid ai_status: %', NEW.ai_status;
  END IF;
  IF NEW.publish_status NOT IN ('pending','partially_published','published') THEN
    RAISE EXCEPTION 'Invalid publish_status: %', NEW.publish_status;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_azure_emp_news_issues
  BEFORE INSERT OR UPDATE ON public.azure_emp_news_issues
  FOR EACH ROW EXECUTE FUNCTION public.validate_azure_emp_news_issues();

ALTER TABLE public.azure_emp_news_issues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage azure_emp_news_issues"
  ON public.azure_emp_news_issues FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_azure_emp_news_issues_created_at ON public.azure_emp_news_issues (created_at);
CREATE INDEX idx_azure_emp_news_issues_publish_status ON public.azure_emp_news_issues (publish_status);

-- 2. azure_emp_news_pages
CREATE TABLE public.azure_emp_news_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id uuid NOT NULL REFERENCES public.azure_emp_news_issues(id) ON DELETE CASCADE,
  page_no integer NOT NULL,
  original_filename text NOT NULL,
  storage_path text NOT NULL,
  file_size bigint,
  mime_type text,
  ocr_status text NOT NULL DEFAULT 'pending',
  retry_count integer NOT NULL DEFAULT 0,
  azure_operation_url text,
  azure_result_json jsonb,
  extracted_content text,
  cleaned_content text,
  error_message text,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(issue_id, page_no)
);

CREATE OR REPLACE FUNCTION public.validate_azure_emp_news_pages()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.ocr_status NOT IN ('pending','processing','completed','failed') THEN
    RAISE EXCEPTION 'Invalid ocr_status: %', NEW.ocr_status;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_azure_emp_news_pages
  BEFORE INSERT OR UPDATE ON public.azure_emp_news_pages
  FOR EACH ROW EXECUTE FUNCTION public.validate_azure_emp_news_pages();

ALTER TABLE public.azure_emp_news_pages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage azure_emp_news_pages"
  ON public.azure_emp_news_pages FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_azure_emp_news_pages_issue_id ON public.azure_emp_news_pages (issue_id);
CREATE INDEX idx_azure_emp_news_pages_page_no ON public.azure_emp_news_pages (page_no);
CREATE INDEX idx_azure_emp_news_pages_ocr_status ON public.azure_emp_news_pages (ocr_status);

-- 3. azure_emp_news_fragments
CREATE TABLE public.azure_emp_news_fragments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id uuid NOT NULL REFERENCES public.azure_emp_news_issues(id) ON DELETE CASCADE,
  page_id uuid NOT NULL REFERENCES public.azure_emp_news_pages(id) ON DELETE CASCADE,
  page_no integer NOT NULL,
  fragment_index integer NOT NULL,
  fragment_type text NOT NULL DEFAULT 'unknown',
  raw_text text NOT NULL DEFAULT '',
  cleaned_text text NOT NULL DEFAULT '',
  bbox jsonb,
  continuation_hint text,
  continuation_to_page integer,
  continuation_from_page integer,
  confidence numeric,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.validate_azure_emp_news_fragments()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.fragment_type NOT IN ('job_notice','admission','editorial','advertisement','unknown','continuation') THEN
    RAISE EXCEPTION 'Invalid fragment_type: %', NEW.fragment_type;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_azure_emp_news_fragments
  BEFORE INSERT OR UPDATE ON public.azure_emp_news_fragments
  FOR EACH ROW EXECUTE FUNCTION public.validate_azure_emp_news_fragments();

ALTER TABLE public.azure_emp_news_fragments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage azure_emp_news_fragments"
  ON public.azure_emp_news_fragments FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_azure_emp_news_fragments_issue_id ON public.azure_emp_news_fragments (issue_id);
CREATE INDEX idx_azure_emp_news_fragments_page_id ON public.azure_emp_news_fragments (page_id);

-- 4. azure_emp_news_reconstructed_notices
CREATE TABLE public.azure_emp_news_reconstructed_notices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id uuid NOT NULL REFERENCES public.azure_emp_news_issues(id) ON DELETE CASCADE,
  notice_key text NOT NULL,
  start_page integer,
  end_page integer,
  notice_title text,
  employer_name text,
  merged_text text NOT NULL DEFAULT '',
  merged_blocks_json jsonb,
  reconstruction_confidence numeric,
  ai_status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.validate_azure_emp_news_reconstructed_notices()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.ai_status NOT IN ('pending','processing','completed','failed') THEN
    RAISE EXCEPTION 'Invalid ai_status: %', NEW.ai_status;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_azure_emp_news_reconstructed_notices
  BEFORE INSERT OR UPDATE ON public.azure_emp_news_reconstructed_notices
  FOR EACH ROW EXECUTE FUNCTION public.validate_azure_emp_news_reconstructed_notices();

ALTER TABLE public.azure_emp_news_reconstructed_notices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage azure_emp_news_reconstructed_notices"
  ON public.azure_emp_news_reconstructed_notices FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_azure_emp_news_reconstructed_notices_issue_id ON public.azure_emp_news_reconstructed_notices (issue_id);

-- 5. azure_emp_news_draft_jobs
CREATE TABLE public.azure_emp_news_draft_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id uuid NOT NULL REFERENCES public.azure_emp_news_issues(id) ON DELETE CASCADE,
  reconstructed_notice_id uuid REFERENCES public.azure_emp_news_reconstructed_notices(id) ON DELETE SET NULL,
  draft_title text NOT NULL DEFAULT '',
  draft_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  ai_cleaned_data jsonb,
  validation_status text NOT NULL DEFAULT 'pending',
  validation_notes text[] NOT NULL DEFAULT '{}',
  publish_status text NOT NULL DEFAULT 'draft',
  linked_live_job_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.validate_azure_emp_news_draft_jobs()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.validation_status NOT IN ('pending','passed','failed','review_needed') THEN
    RAISE EXCEPTION 'Invalid validation_status: %', NEW.validation_status;
  END IF;
  IF NEW.publish_status NOT IN ('draft','published','failed') THEN
    RAISE EXCEPTION 'Invalid publish_status: %', NEW.publish_status;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_azure_emp_news_draft_jobs
  BEFORE INSERT OR UPDATE ON public.azure_emp_news_draft_jobs
  FOR EACH ROW EXECUTE FUNCTION public.validate_azure_emp_news_draft_jobs();

ALTER TABLE public.azure_emp_news_draft_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage azure_emp_news_draft_jobs"
  ON public.azure_emp_news_draft_jobs FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_azure_emp_news_draft_jobs_issue_id ON public.azure_emp_news_draft_jobs (issue_id);
CREATE INDEX idx_azure_emp_news_draft_jobs_publish_status ON public.azure_emp_news_draft_jobs (publish_status);

-- 6. azure_emp_news_publish_logs
CREATE TABLE public.azure_emp_news_publish_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id uuid NOT NULL REFERENCES public.azure_emp_news_issues(id) ON DELETE CASCADE,
  draft_job_id uuid REFERENCES public.azure_emp_news_draft_jobs(id) ON DELETE SET NULL,
  action text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT '',
  message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.azure_emp_news_publish_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage azure_emp_news_publish_logs"
  ON public.azure_emp_news_publish_logs FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_azure_emp_news_publish_logs_issue_id ON public.azure_emp_news_publish_logs (issue_id);
CREATE INDEX idx_azure_emp_news_publish_logs_created_at ON public.azure_emp_news_publish_logs (created_at);

-- 7. Storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('employment-news-azure', 'employment-news-azure', true)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS policies
CREATE POLICY "Admins can upload azure emp news images"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'employment-news-azure' AND public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can read azure emp news images"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'employment-news-azure' AND public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete azure emp news images"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'employment-news-azure' AND public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Public can view azure emp news images"
  ON storage.objects FOR SELECT TO anon
  USING (bucket_id = 'employment-news-azure');
