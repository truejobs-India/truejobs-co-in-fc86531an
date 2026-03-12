-- Create ATS-only scraping setting (default: enabled)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'app_settings'
      AND column_name = 'key'
  ) THEN
    -- Insert default if missing
    IF NOT EXISTS (SELECT 1 FROM public.app_settings WHERE key = 'scraping_ats_only_enabled') THEN
      INSERT INTO public.app_settings (key, value, description)
      VALUES (
        'scraping_ats_only_enabled',
        jsonb_build_object('enabled', true),
        'When enabled, scraping only accepts ATS job board URLs (Greenhouse/Lever/Ashby/Workable) and rejects generic careers pages.'
      );
    END IF;
  END IF;
END $$;
