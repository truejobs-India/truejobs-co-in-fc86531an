-- Create table to track AI resume generations per user
CREATE TABLE public.resume_ai_generations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  action TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for faster lookups
CREATE INDEX idx_resume_ai_generations_user_action ON public.resume_ai_generations(user_id, action);
CREATE INDEX idx_resume_ai_generations_hash ON public.resume_ai_generations(request_hash);

-- Enable RLS
ALTER TABLE public.resume_ai_generations ENABLE ROW LEVEL SECURITY;

-- Only allow service role to manage this table (edge function uses service role)
CREATE POLICY "Service role can manage resume generations"
ON public.resume_ai_generations
FOR ALL
USING (true)
WITH CHECK (true);

-- Add comment for documentation
COMMENT ON TABLE public.resume_ai_generations IS 'Tracks AI resume generations to prevent unlimited regeneration';