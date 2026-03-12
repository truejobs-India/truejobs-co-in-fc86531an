-- Track which AI provider was used for the most recent scrape
ALTER TABLE public.scraping_sources
ADD COLUMN IF NOT EXISTS last_ai_provider TEXT,
ADD COLUMN IF NOT EXISTS last_ai_provider_at TIMESTAMPTZ;

-- Optional: small index to help with sorting/filtering later
CREATE INDEX IF NOT EXISTS idx_scraping_sources_last_ai_provider ON public.scraping_sources (last_ai_provider);
