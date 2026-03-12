-- Tighten RLS policies that were overly permissive

-- =====================
-- PROFILES: remove public read of contact info
-- =====================
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;

CREATE POLICY "Users can view their own profile"
ON public.profiles
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- =====================
-- EDUCATION: restrict read to owner/admin
-- =====================
DROP POLICY IF EXISTS "Education is viewable by everyone" ON public.education;

CREATE POLICY "Users can view their own education"
ON public.education
FOR SELECT
USING (
  profile_id IN (
    SELECT p.id FROM public.profiles p WHERE p.user_id = auth.uid()
  )
);

CREATE POLICY "Admins can view all education"
ON public.education
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- =====================
-- EXPERIENCE: restrict read to owner/admin
-- =====================
DROP POLICY IF EXISTS "Experience is viewable by everyone" ON public.experience;

CREATE POLICY "Users can view their own experience"
ON public.experience
FOR SELECT
USING (
  profile_id IN (
    SELECT p.id FROM public.profiles p WHERE p.user_id = auth.uid()
  )
);

CREATE POLICY "Admins can view all experience"
ON public.experience
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- =====================
-- NOTIFICATIONS: prevent users from creating notifications for others
-- =====================
DROP POLICY IF EXISTS "Authenticated users can create notifications" ON public.notifications;

CREATE POLICY "Users can create their own notifications"
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Allow backend/service operations to insert notifications (used by scheduled jobs)
CREATE POLICY "Service role can create notifications"
ON public.notifications
FOR INSERT
TO public
WITH CHECK (auth.role() = 'service_role');

-- =====================
-- OTP_SESSIONS: ensure only service role has access (avoid USING(true))
-- =====================
DROP POLICY IF EXISTS "Service role has full access to otp_sessions" ON public.otp_sessions;

CREATE POLICY "Service role has full access to otp_sessions"
ON public.otp_sessions
FOR ALL
TO public
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');
