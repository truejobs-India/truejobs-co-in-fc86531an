
-- Table: en_issues
CREATE TABLE public.en_issues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_number integer NOT NULL UNIQUE,
  volume_number integer,
  week_start date NOT NULL,
  week_end date NOT NULL,
  week_label text NOT NULL,
  total_pages integer,
  price text,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.en_issues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view en_issues" ON public.en_issues FOR SELECT USING (true);
CREATE POLICY "Admins can manage en_issues" ON public.en_issues FOR ALL USING (public.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Table: gov_jobs
CREATE TABLE public.gov_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id uuid NOT NULL REFERENCES public.en_issues(id) ON DELETE CASCADE,
  issue_number integer NOT NULL,
  job_index text NOT NULL UNIQUE,
  title text NOT NULL,
  organization text NOT NULL,
  department text,
  location text,
  gov_type text NOT NULL CHECK (gov_type IN ('Central Government','State Government','PSU','Autonomous Body','Defence','Railway','Banking','Research Institute','University/Education')),
  posts_detail text,
  total_vacancies text,
  pay_scale text,
  age_limit text,
  qualification text,
  last_date text,
  application_mode text,
  application_fee text,
  website text,
  advt_number text,
  en_reference text,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_gov_jobs_issue_id ON public.gov_jobs(issue_id);
CREATE INDEX idx_gov_jobs_gov_type ON public.gov_jobs(gov_type);
CREATE INDEX idx_gov_jobs_is_active ON public.gov_jobs(is_active);
CREATE INDEX idx_gov_jobs_issue_number ON public.gov_jobs(issue_number);

ALTER TABLE public.gov_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view gov_jobs" ON public.gov_jobs FOR SELECT USING (true);
CREATE POLICY "Admins can manage gov_jobs" ON public.gov_jobs FOR ALL USING (public.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- updated_at trigger
CREATE TRIGGER gov_jobs_updated_at BEFORE UPDATE ON public.gov_jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
