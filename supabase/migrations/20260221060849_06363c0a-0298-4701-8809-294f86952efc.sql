
-- Add government job specific columns
ALTER TABLE public.jobs
ADD COLUMN IF NOT EXISTS pay_scale text,
ADD COLUMN IF NOT EXISTS job_opening_date date,
ADD COLUMN IF NOT EXISTS last_date_of_application date,
ADD COLUMN IF NOT EXISTS government_type text,
ADD COLUMN IF NOT EXISTS apply_url text,
ADD COLUMN IF NOT EXISTS job_role text;
