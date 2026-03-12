
-- Create email_subscribers table for public digest capture
CREATE TABLE public.email_subscribers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  full_name TEXT,
  frequency TEXT NOT NULL DEFAULT 'daily',
  job_categories TEXT[] DEFAULT '{}'::text[],
  preferred_locations TEXT[] DEFAULT '{}'::text[],
  is_active BOOLEAN NOT NULL DEFAULT true,
  verified BOOLEAN NOT NULL DEFAULT false,
  unsubscribe_token TEXT NOT NULL DEFAULT md5(gen_random_uuid()::text),
  subscribed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  unsubscribed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT email_subscribers_email_unique UNIQUE (email),
  CONSTRAINT email_subscribers_frequency_check CHECK (frequency IN ('daily', 'weekly', 'instant'))
);

-- Enable RLS
ALTER TABLE public.email_subscribers ENABLE ROW LEVEL SECURITY;

-- Public can subscribe (insert only)
CREATE POLICY "Anyone can subscribe to email digest"
ON public.email_subscribers
FOR INSERT
WITH CHECK (true);

-- Subscribers can manage their own subscription via unsubscribe_token
CREATE POLICY "Subscribers can view their own subscription"
ON public.email_subscribers
FOR SELECT
USING (true);

-- Only admins can view all subscribers
CREATE POLICY "Admins can manage all subscribers"
ON public.email_subscribers
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_email_subscribers_updated_at
BEFORE UPDATE ON public.email_subscribers
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
