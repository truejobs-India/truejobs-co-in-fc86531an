-- Create saved_resumes table for multiple resume versions
CREATE TABLE public.saved_resumes (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    name TEXT NOT NULL,
    template_style TEXT NOT NULL DEFAULT 'professional',
    custom_summary TEXT,
    custom_skills TEXT[],
    target_job_title TEXT,
    target_company TEXT,
    score INTEGER,
    score_details JSONB,
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.saved_resumes ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own saved resumes" 
ON public.saved_resumes 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own saved resumes" 
ON public.saved_resumes 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own saved resumes" 
ON public.saved_resumes 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own saved resumes" 
ON public.saved_resumes 
FOR DELETE 
USING (auth.uid() = user_id);

-- Add trigger for updated_at
CREATE TRIGGER update_saved_resumes_updated_at
BEFORE UPDATE ON public.saved_resumes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();