-- Add consecutive_failures column to track failed scrape attempts
ALTER TABLE public.scraping_sources 
ADD COLUMN IF NOT EXISTS consecutive_failures integer DEFAULT 0;

-- Add comment for documentation
COMMENT ON COLUMN public.scraping_sources.consecutive_failures IS 'Number of consecutive failed scrape attempts. Source is auto-disabled at 3 failures.';