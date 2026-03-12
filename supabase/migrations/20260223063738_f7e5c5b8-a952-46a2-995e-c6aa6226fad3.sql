
CREATE TABLE public.portal_crawl_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  portal text NOT NULL,
  crawl_type text NOT NULL DEFAULT 'full',
  urls_discovered integer DEFAULT 0,
  urls_scraped integer DEFAULT 0,
  urls_failed integer DEFAULT 0,
  jobs_extracted integer DEFAULT 0,
  jobs_promoted integer DEFAULT 0,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  status text NOT NULL DEFAULT 'running',
  error_message text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.portal_crawl_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage portal_crawl_log"
  ON public.portal_crawl_log FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
