-- Step 1: Store the RSS cron secret in app_settings (same pattern as seo_rebuild_secret)
INSERT INTO public.app_settings (key, value, description, is_internal)
VALUES (
  'rss_cron_secret',
  to_jsonb('King@1234#'::text),
  'Shared secret for RSS cron job authentication with rss-ingest edge function',
  true
)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();

-- Step 2: Remove the broken cron job
SELECT cron.unschedule(8);

-- Step 3: Create the correct cron job
SELECT cron.schedule(
  'rss-ingest-due-sources',
  '0 */6 * * *',
  $$
  SELECT net.http_post(
    url := 'https://riktrtfgpnrqiwatppcq.supabase.co/functions/v1/rss-ingest',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT value #>> '{}' FROM public.app_settings WHERE key = 'rss_cron_secret')
    ),
    body := '{"action": "run-due-sources"}'::jsonb
  ) AS request_id;
  $$
);