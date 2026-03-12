
-- Create job posting plans table for admin to manage pricing
CREATE TABLE public.job_posting_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  price NUMERIC NOT NULL DEFAULT 0,
  original_price NUMERIC,
  currency TEXT NOT NULL DEFAULT 'INR',
  duration_days INTEGER NOT NULL DEFAULT 15,
  visibility_level TEXT NOT NULL DEFAULT 'basic',
  features JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_featured BOOLEAN NOT NULL DEFAULT false,
  is_urgent_hiring BOOLEAN NOT NULL DEFAULT false,
  has_whatsapp_notifications BOOLEAN NOT NULL DEFAULT false,
  has_priority_placement BOOLEAN NOT NULL DEFAULT false,
  max_applications INTEGER,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add auto-approve settings to companies table
ALTER TABLE public.companies 
ADD COLUMN IF NOT EXISTS auto_approve_jobs BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS current_plan_id UUID REFERENCES public.job_posting_plans(id),
ADD COLUMN IF NOT EXISTS plan_expires_at TIMESTAMP WITH TIME ZONE;

-- Create job posting drafts to save progress
CREATE TABLE public.job_posting_drafts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  posted_by UUID NOT NULL,
  current_step INTEGER NOT NULL DEFAULT 1,
  job_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  selected_plan_id UUID REFERENCES public.job_posting_plans(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.job_posting_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_posting_drafts ENABLE ROW LEVEL SECURITY;

-- Policies for job_posting_plans
CREATE POLICY "Anyone can view active plans" 
ON public.job_posting_plans 
FOR SELECT 
USING (is_active = true);

CREATE POLICY "Admins can manage plans" 
ON public.job_posting_plans 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Policies for job_posting_drafts
CREATE POLICY "Employers can manage their drafts" 
ON public.job_posting_drafts 
FOR ALL 
USING (posted_by = auth.uid());

CREATE POLICY "Admins can view all drafts" 
ON public.job_posting_drafts 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Insert default plans
INSERT INTO public.job_posting_plans (name, slug, price, original_price, duration_days, visibility_level, is_featured, is_urgent_hiring, has_whatsapp_notifications, has_priority_placement, display_order, features) VALUES
('Classic Job', 'classic', 699, NULL, 15, 'basic', false, false, false, false, 1, '["Job will be active for 15 days", "Basic visibility", "Standard candidate matching"]'::jsonb),
('Premium Job', 'premium', 1399, NULL, 15, 'higher', false, true, true, false, 2, '["Job will be active for 15 days", "Higher visibility", "WhatsApp notifications to top candidates", "Featured with Urgently hiring tag"]'::jsonb),
('Premium Job + AI', 'premium-ai', 2999, 3999, 15, 'higher', true, true, true, false, 3, '["Job will be active for 15 days", "Higher visibility", "WhatsApp notifications to top candidates", "Featured with Urgently hiring tag", "AI screening of applicants"]'::jsonb),
('Super Premium Job', 'super-premium', 2799, NULL, 15, 'maximum', true, true, true, true, 4, '["Job will be active for 15 days", "Maximum visibility", "2x Priority WhatsApp notifications", "Featured with Urgently hiring tag", "Top placements in job listings"]'::jsonb);

-- Create trigger for updated_at
CREATE TRIGGER update_job_posting_plans_updated_at
BEFORE UPDATE ON public.job_posting_plans
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_job_posting_drafts_updated_at
BEFORE UPDATE ON public.job_posting_drafts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
