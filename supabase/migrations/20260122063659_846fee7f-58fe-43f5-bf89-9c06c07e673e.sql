-- Create enum for scraping source status
CREATE TYPE scraping_source_status AS ENUM ('not_scraped', 'scraped', 'failed', 'disabled');

-- Add new columns to scraping_sources table
ALTER TABLE public.scraping_sources 
ADD COLUMN IF NOT EXISTS status scraping_source_status NOT NULL DEFAULT 'not_scraped',
ADD COLUMN IF NOT EXISTS scrape_count integer NOT NULL DEFAULT 0;

-- Update existing sources based on their current state:
-- If last_scraped_at is not null, they've been scraped
UPDATE public.scraping_sources 
SET status = 'scraped', 
    scrape_count = GREATEST(1, jobs_scraped_count)
WHERE last_scraped_at IS NOT NULL;

-- If consecutive_failures >= 3, mark as failed
UPDATE public.scraping_sources 
SET status = 'failed'
WHERE consecutive_failures >= 3;

-- If is_active = false and not failed, mark as disabled
UPDATE public.scraping_sources 
SET status = 'disabled'
WHERE is_active = false AND status != 'failed';

-- Create index for filtering by status
CREATE INDEX IF NOT EXISTS idx_scraping_sources_status ON public.scraping_sources(status);

-- Create index for filtering by last_scraped_at
CREATE INDEX IF NOT EXISTS idx_scraping_sources_last_scraped ON public.scraping_sources(last_scraped_at DESC NULLS LAST);