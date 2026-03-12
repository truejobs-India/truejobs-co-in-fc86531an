
-- Staging table for raw govt job extractions
CREATE TABLE public.govt_jobs_raw (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source_url text NOT NULL,
  source_url_hash text,
  portal text NOT NULL DEFAULT 'freejobalert.com',
  
  title text,
  organization text,
  advertisement_no text,
  state text,
  job_type text,
  vacancies text,
  posts jsonb DEFAULT '[]'::jsonb,
  qualification jsonb DEFAULT '[]'::jsonb,
  age_limit text,
  age_relaxation text,
  salary text,
  
  start_date date,
  last_date date,
  exam_date date,
  
  application_fee text,
  selection_process text,
  notification_pdf text,
  apply_link text,
  official_website text,
  employment_news_reference text,
  job_location text,
  description text,
  important_links jsonb DEFAULT '[]'::jsonb,
  
  extraction_confidence numeric(5,3) DEFAULT 0,
  extraction_model text,
  raw_markdown text,
  dedup_hash text,
  
  promoted_to_job_id uuid REFERENCES public.jobs(id),
  promoted_at timestamptz,
  promotion_status text NOT NULL DEFAULT 'pending',
  
  crawled_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Trigger to compute hashes
CREATE OR REPLACE FUNCTION public.govt_jobs_raw_compute_hashes()
  RETURNS trigger LANGUAGE plpgsql IMMUTABLE SET search_path TO 'public' AS $$
BEGIN
  NEW.source_url_hash := md5(lower(trim(NEW.source_url)));
  NEW.dedup_hash := md5(lower(coalesce(NEW.title,'') || '|' || coalesce(NEW.organization,'') || '|' || coalesce(NEW.last_date::text,'')));
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_govt_jobs_raw_hashes
  BEFORE INSERT OR UPDATE ON public.govt_jobs_raw
  FOR EACH ROW EXECUTE FUNCTION public.govt_jobs_raw_compute_hashes();

CREATE UNIQUE INDEX idx_govt_jobs_raw_source_url_hash ON public.govt_jobs_raw(source_url_hash);
CREATE INDEX idx_govt_jobs_raw_dedup_hash ON public.govt_jobs_raw(dedup_hash);
CREATE INDEX idx_govt_jobs_raw_promotion_status ON public.govt_jobs_raw(promotion_status);
CREATE INDEX idx_govt_jobs_raw_portal ON public.govt_jobs_raw(portal);
CREATE INDEX idx_govt_jobs_raw_last_date ON public.govt_jobs_raw(last_date);

ALTER TABLE public.govt_jobs_raw ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage govt_jobs_raw"
  ON public.govt_jobs_raw FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
