
-- Add new columns to employment_news_jobs
ALTER TABLE public.employment_news_jobs
  ADD COLUMN last_date_raw text,
  ADD COLUMN last_date_resolved date,
  ADD COLUMN job_category text,
  ADD COLUMN state text;

-- Add unique constraint for deduplication
CREATE UNIQUE INDEX idx_emp_news_dedup 
  ON public.employment_news_jobs (advertisement_number, org_name) 
  WHERE advertisement_number IS NOT NULL AND org_name IS NOT NULL;
