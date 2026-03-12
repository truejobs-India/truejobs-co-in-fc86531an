
-- Add 'archived' to job_status enum
ALTER TYPE public.job_status ADD VALUE IF NOT EXISTS 'archived';
