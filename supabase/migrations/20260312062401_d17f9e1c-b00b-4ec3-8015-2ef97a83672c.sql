-- Fix 1: Restrict user_roles INSERT to job_seeker and employer only (block admin self-assignment)
DROP POLICY IF EXISTS "Users can insert their own role on signup" ON public.user_roles;
CREATE POLICY "Users can insert their own role on signup"
ON public.user_roles FOR INSERT TO authenticated
WITH CHECK (
  (select auth.uid()) = user_id
  AND role IN ('job_seeker'::app_role, 'employer'::app_role)
);

-- Fix 2: Remove permissive SELECT on email_subscribers (admin access preserved by existing ALL policy)
DROP POLICY IF EXISTS "Subscribers can view their own subscription" ON public.email_subscribers;