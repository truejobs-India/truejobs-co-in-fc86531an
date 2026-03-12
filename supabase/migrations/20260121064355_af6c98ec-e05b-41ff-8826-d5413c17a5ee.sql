-- Add job seeker notes and follow-up reminders to applications table
ALTER TABLE public.applications 
ADD COLUMN IF NOT EXISTS seeker_notes text,
ADD COLUMN IF NOT EXISTS follow_up_date timestamp with time zone,
ADD COLUMN IF NOT EXISTS reminder_sent boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS company_research jsonb;

-- Create index for follow-up reminders
CREATE INDEX IF NOT EXISTS idx_applications_follow_up ON public.applications(follow_up_date) WHERE follow_up_date IS NOT NULL;