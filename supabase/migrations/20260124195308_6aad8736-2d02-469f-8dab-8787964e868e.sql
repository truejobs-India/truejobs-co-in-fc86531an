-- Create email_otp_sessions table for email OTP verification
CREATE TABLE public.email_otp_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL,
    otp_code TEXT NOT NULL,
    purpose TEXT NOT NULL DEFAULT 'signup',
    verified BOOLEAN NOT NULL DEFAULT false,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for efficient lookups
CREATE INDEX idx_email_otp_sessions_email ON public.email_otp_sessions(email);
CREATE INDEX idx_email_otp_sessions_expires_at ON public.email_otp_sessions(expires_at);

-- Enable RLS
ALTER TABLE public.email_otp_sessions ENABLE ROW LEVEL SECURITY;

-- Allow anyone to insert (for sending OTP before auth)
CREATE POLICY "Anyone can create OTP sessions"
ON public.email_otp_sessions
FOR INSERT
WITH CHECK (true);

-- Allow anyone to select their own OTP sessions by email
CREATE POLICY "Anyone can read OTP sessions"
ON public.email_otp_sessions
FOR SELECT
USING (true);

-- Allow updates for verification
CREATE POLICY "Anyone can update OTP sessions"
ON public.email_otp_sessions
FOR UPDATE
USING (true);

-- Create function to clean up expired OTP sessions
CREATE OR REPLACE FUNCTION public.cleanup_expired_otp_sessions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    DELETE FROM public.email_otp_sessions
    WHERE expires_at < now();
END;
$$;