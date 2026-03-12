
-- Upload batches table
CREATE TABLE public.upload_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  filename text NOT NULL,
  issue_details text,
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  total_extracted integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'processing'
);

ALTER TABLE public.upload_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage upload batches"
  ON public.upload_batches FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Employment news jobs table
CREATE TABLE public.employment_news_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_name text,
  post text,
  vacancies integer,
  qualification text,
  age_limit text,
  salary text,
  job_type text,
  experience_required text,
  location text,
  application_mode text,
  apply_link text,
  application_start_date text,
  last_date text,
  notification_reference_number text,
  advertisement_number text,
  source text NOT NULL DEFAULT 'Employment News',
  description text,
  status text NOT NULL DEFAULT 'pending',
  enriched_description text,
  upload_batch_id uuid REFERENCES public.upload_batches(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz
);

ALTER TABLE public.employment_news_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage employment news jobs"
  ON public.employment_news_jobs FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Public can view published employment news jobs"
  ON public.employment_news_jobs FOR SELECT
  USING (status = 'published');
