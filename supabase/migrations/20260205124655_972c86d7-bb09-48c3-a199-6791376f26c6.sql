-- Create campaign_enrollments table for jobs campaign registrations
CREATE TABLE public.campaign_enrollments (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT NOT NULL,
    experience TEXT NOT NULL,
    job_role TEXT,
    preferred_location TEXT,
    skills TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.campaign_enrollments ENABLE ROW LEVEL SECURITY;

-- Allow anyone to insert (public form)
CREATE POLICY "Anyone can submit enrollment"
ON public.campaign_enrollments
FOR INSERT
WITH CHECK (true);

-- Only admins can view enrollments
CREATE POLICY "Admins can view enrollments"
ON public.campaign_enrollments
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- Only admins can update enrollments
CREATE POLICY "Admins can update enrollments"
ON public.campaign_enrollments
FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

-- Add trigger for updated_at
CREATE TRIGGER update_campaign_enrollments_updated_at
BEFORE UPDATE ON public.campaign_enrollments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index on email for duplicate checks
CREATE INDEX idx_campaign_enrollments_email ON public.campaign_enrollments(email);

-- Create index on created_at for sorting
CREATE INDEX idx_campaign_enrollments_created_at ON public.campaign_enrollments(created_at DESC);