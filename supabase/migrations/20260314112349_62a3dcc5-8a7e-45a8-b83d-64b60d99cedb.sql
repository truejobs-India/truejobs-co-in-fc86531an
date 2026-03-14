ALTER TABLE public.employment_news_jobs 
ADD COLUMN IF NOT EXISTS enrichment_error text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS enrichment_attempts integer DEFAULT 0 NOT NULL;