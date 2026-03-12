-- Fix overly permissive RLS policy on resume_ai_generations table
-- The current policy uses USING (true) which is flagged as a security issue

-- Drop the existing overly permissive policy
DROP POLICY IF EXISTS "Service role can manage resume generations" ON public.resume_ai_generations;

-- Create proper policies that restrict access appropriately
-- Service role can still manage all records (this is correct as edge functions use service role)
CREATE POLICY "Service role can manage resume generations"
ON public.resume_ai_generations
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Users can view their own generation records
CREATE POLICY "Users can view their own resume generations"
ON public.resume_ai_generations
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Users can insert their own generation records
CREATE POLICY "Users can insert their own resume generations"
ON public.resume_ai_generations
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());