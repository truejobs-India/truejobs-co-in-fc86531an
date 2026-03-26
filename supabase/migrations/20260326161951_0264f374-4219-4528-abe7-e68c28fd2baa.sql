ALTER TABLE public.firecrawl_staged_items
ADD COLUMN IF NOT EXISTS govt_discovery_meta JSONB DEFAULT '{}';