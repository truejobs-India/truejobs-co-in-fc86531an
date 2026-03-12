-- Fix email_otp_sessions RLS policies - restrict to service role only
-- This prevents attackers from enumerating/manipulating OTP codes

-- Drop the overly permissive policies
DROP POLICY IF EXISTS "Anyone can create OTP sessions" ON public.email_otp_sessions;
DROP POLICY IF EXISTS "Anyone can read OTP sessions" ON public.email_otp_sessions;
DROP POLICY IF EXISTS "Anyone can update OTP sessions" ON public.email_otp_sessions;

-- Create new policies that restrict access to service role only
-- Edge functions use service role to manage OTP sessions
CREATE POLICY "Service role can manage OTP sessions"
ON public.email_otp_sessions
FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');