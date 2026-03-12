-- Add is_internal flag to app_settings for hiding sensitive rows from non-admin users
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS is_internal boolean NOT NULL DEFAULT false;

-- Mark the seo_rebuild_secret as internal
UPDATE public.app_settings SET is_internal = true WHERE key = 'seo_rebuild_secret';

-- Drop the old authenticated SELECT policy that exposes all settings
DROP POLICY IF EXISTS "Authenticated users can view app settings" ON public.app_settings;

-- Create new policy: authenticated users can only see non-internal settings
CREATE POLICY "Authenticated users can view non-internal settings"
ON public.app_settings FOR SELECT TO authenticated
USING (is_internal = false);

-- Admins already have ALL via the existing admin policy, so they can still see internal rows