-- Create OTP sessions table for SMS verification
CREATE TABLE public.otp_sessions (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    phone TEXT NOT NULL UNIQUE,
    session_id TEXT NOT NULL,
    purpose TEXT NOT NULL CHECK (purpose IN ('signup', 'reset_password', 'login')),
    verified BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

-- Enable RLS
ALTER TABLE public.otp_sessions ENABLE ROW LEVEL SECURITY;

-- Allow service role full access (edge functions use service role)
CREATE POLICY "Service role has full access to otp_sessions"
ON public.otp_sessions
FOR ALL
USING (true)
WITH CHECK (true);

-- Add phone column to profiles if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'profiles' 
        AND column_name = 'phone'
    ) THEN
        ALTER TABLE public.profiles ADD COLUMN phone TEXT;
    END IF;
END $$;

-- Create index for faster lookups
CREATE INDEX idx_otp_sessions_phone ON public.otp_sessions(phone);
CREATE INDEX idx_otp_sessions_expires ON public.otp_sessions(expires_at);