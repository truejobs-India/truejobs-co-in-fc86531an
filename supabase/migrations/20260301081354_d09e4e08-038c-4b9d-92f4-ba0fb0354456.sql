
-- Add job_sector and enrichment_attempts columns
ALTER TABLE public.jobs
ADD COLUMN IF NOT EXISTS job_sector TEXT NOT NULL DEFAULT 'unclassified';

ALTER TABLE public.jobs
ADD CONSTRAINT jobs_job_sector_check CHECK (job_sector IN ('government', 'private', 'unclassified'));

ALTER TABLE public.jobs
ADD COLUMN IF NOT EXISTS enrichment_attempts INTEGER NOT NULL DEFAULT 0;
