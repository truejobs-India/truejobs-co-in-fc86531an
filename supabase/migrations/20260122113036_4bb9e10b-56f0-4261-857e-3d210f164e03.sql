-- Create scrape outcome history tables (ATS/Non-ATS × success/fail)

CREATE TABLE IF NOT EXISTS public.scrape_urls_ats_success (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  url text NOT NULL,
  source_id uuid NULL,
  ats_provider text NULL,
  attempted_at timestamptz NOT NULL DEFAULT now(),
  jobs_found integer NOT NULL DEFAULT 0,
  jobs_inserted integer NOT NULL DEFAULT 0,
  ai_provider text NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS public.scrape_urls_ats_fail (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  url text NOT NULL,
  source_id uuid NULL,
  ats_provider text NULL,
  attempted_at timestamptz NOT NULL DEFAULT now(),
  jobs_found integer NOT NULL DEFAULT 0,
  jobs_inserted integer NOT NULL DEFAULT 0,
  ai_provider text NULL,
  error_code text NULL,
  error_message text NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS public.scrape_urls_non_ats_success (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  url text NOT NULL,
  source_id uuid NULL,
  attempted_at timestamptz NOT NULL DEFAULT now(),
  jobs_found integer NOT NULL DEFAULT 0,
  jobs_inserted integer NOT NULL DEFAULT 0,
  ai_provider text NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS public.scrape_urls_non_ats_fail (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  url text NOT NULL,
  source_id uuid NULL,
  attempted_at timestamptz NOT NULL DEFAULT now(),
  jobs_found integer NOT NULL DEFAULT 0,
  jobs_inserted integer NOT NULL DEFAULT 0,
  ai_provider text NULL,
  error_code text NULL,
  error_message text NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

-- Enable RLS
ALTER TABLE public.scrape_urls_ats_success ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scrape_urls_ats_fail ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scrape_urls_non_ats_success ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scrape_urls_non_ats_fail ENABLE ROW LEVEL SECURITY;

-- Admin-only policies
CREATE POLICY "Admins can manage ATS success scrape URLs"
ON public.scrape_urls_ats_success
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage ATS fail scrape URLs"
ON public.scrape_urls_ats_fail
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage non-ATS success scrape URLs"
ON public.scrape_urls_non_ats_success
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage non-ATS fail scrape URLs"
ON public.scrape_urls_non_ats_fail
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Helpful indexes for analytics/debugging
CREATE INDEX IF NOT EXISTS idx_scrape_urls_ats_success_attempted_at ON public.scrape_urls_ats_success (attempted_at DESC);
CREATE INDEX IF NOT EXISTS idx_scrape_urls_ats_fail_attempted_at ON public.scrape_urls_ats_fail (attempted_at DESC);
CREATE INDEX IF NOT EXISTS idx_scrape_urls_non_ats_success_attempted_at ON public.scrape_urls_non_ats_success (attempted_at DESC);
CREATE INDEX IF NOT EXISTS idx_scrape_urls_non_ats_fail_attempted_at ON public.scrape_urls_non_ats_fail (attempted_at DESC);

CREATE INDEX IF NOT EXISTS idx_scrape_urls_ats_success_url ON public.scrape_urls_ats_success (url);
CREATE INDEX IF NOT EXISTS idx_scrape_urls_ats_fail_url ON public.scrape_urls_ats_fail (url);
CREATE INDEX IF NOT EXISTS idx_scrape_urls_non_ats_success_url ON public.scrape_urls_non_ats_success (url);
CREATE INDEX IF NOT EXISTS idx_scrape_urls_non_ats_fail_url ON public.scrape_urls_non_ats_fail (url);
