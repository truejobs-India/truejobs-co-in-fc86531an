
-- Add govt_meta JSONB column to firecrawl_sources
ALTER TABLE public.firecrawl_sources 
ADD COLUMN IF NOT EXISTS govt_meta JSONB DEFAULT '{}'::jsonb;

-- Update trigger to accept 'government' source_type
CREATE OR REPLACE FUNCTION public.validate_firecrawl_sources_fields()
  RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.source_type NOT IN ('firecrawl_html', 'firecrawl_sitemap', 'government') THEN
    RAISE EXCEPTION 'Invalid firecrawl_sources.source_type: %', NEW.source_type;
  END IF;
  IF NEW.priority NOT IN ('High', 'Medium', 'Low') THEN
    RAISE EXCEPTION 'Invalid firecrawl_sources.priority: %', NEW.priority;
  END IF;
  IF NEW.crawl_mode NOT IN ('scrape', 'map', 'crawl') THEN
    RAISE EXCEPTION 'Invalid firecrawl_sources.crawl_mode: %', NEW.crawl_mode;
  END IF;
  IF NEW.extraction_mode NOT IN ('markdown', 'html', 'links', 'json') THEN
    RAISE EXCEPTION 'Invalid firecrawl_sources.extraction_mode: %', NEW.extraction_mode;
  END IF;
  IF NEW.default_bucket NOT IN ('staging', 'review', 'discard') THEN
    RAISE EXCEPTION 'Invalid firecrawl_sources.default_bucket: %', NEW.default_bucket;
  END IF;
  RETURN NEW;
END; $$;
