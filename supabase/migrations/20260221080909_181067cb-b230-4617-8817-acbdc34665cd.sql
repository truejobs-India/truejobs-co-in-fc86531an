
-- Unified scrape results table with categorization
CREATE TABLE public.scrape_results (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source_id uuid REFERENCES public.scraping_sources(id) ON DELETE SET NULL,
  url text NOT NULL,
  category text NOT NULL DEFAULT 'success' CHECK (category IN ('success', 'failed', 'retry_possible', 'not_scrapeable', 'needs_modification')),
  is_govt_source boolean NOT NULL DEFAULT false,
  jobs_found integer NOT NULL DEFAULT 0,
  jobs_inserted integer NOT NULL DEFAULT 0,
  ai_provider text,
  ats_provider text,
  error_code text,
  error_message text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  firecrawl_options jsonb DEFAULT NULL,
  recommendation_rules jsonb DEFAULT NULL,
  recommendation_ai text DEFAULT NULL,
  recommendation_generated_at timestamptz DEFAULT NULL,
  attempted_at timestamptz NOT NULL DEFAULT now(),
  rescrape_count integer NOT NULL DEFAULT 0,
  last_rescrape_at timestamptz DEFAULT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_scrape_results_category ON public.scrape_results(category);
CREATE INDEX idx_scrape_results_source_id ON public.scrape_results(source_id);
CREATE INDEX idx_scrape_results_is_govt ON public.scrape_results(is_govt_source);
CREATE INDEX idx_scrape_results_attempted_at ON public.scrape_results(attempted_at DESC);

-- Enable RLS
ALTER TABLE public.scrape_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage scrape results"
ON public.scrape_results FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Add is_govt_source flag to scraping_sources
ALTER TABLE public.scraping_sources ADD COLUMN IF NOT EXISTS is_govt_source boolean NOT NULL DEFAULT false;
