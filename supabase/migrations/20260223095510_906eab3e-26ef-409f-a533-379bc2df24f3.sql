
-- Add exam lifecycle columns to jobs table
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS exam_name TEXT,
  ADD COLUMN IF NOT EXISTS organizing_body TEXT,
  ADD COLUMN IF NOT EXISTS exam_date DATE,
  ADD COLUMN IF NOT EXISTS admit_card_date DATE,
  ADD COLUMN IF NOT EXISTS result_date DATE,
  ADD COLUMN IF NOT EXISTS exam_pattern TEXT,
  ADD COLUMN IF NOT EXISTS application_fee TEXT,
  ADD COLUMN IF NOT EXISTS selection_stages TEXT,
  ADD COLUMN IF NOT EXISTS category_vacancies JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS previous_cutoffs JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS age_limit TEXT,
  ADD COLUMN IF NOT EXISTS age_relaxation TEXT,
  ADD COLUMN IF NOT EXISTS qualification_required TEXT,
  ADD COLUMN IF NOT EXISTS advertisement_no TEXT,
  ADD COLUMN IF NOT EXISTS notification_pdf_url TEXT,
  ADD COLUMN IF NOT EXISTS official_website TEXT;

-- Add columns to govt_jobs_raw for exam-specific data
ALTER TABLE public.govt_jobs_raw
  ADD COLUMN IF NOT EXISTS admit_card_date DATE,
  ADD COLUMN IF NOT EXISTS result_date DATE,
  ADD COLUMN IF NOT EXISTS exam_pattern TEXT,
  ADD COLUMN IF NOT EXISTS organizing_body TEXT,
  ADD COLUMN IF NOT EXISTS government_level TEXT;
