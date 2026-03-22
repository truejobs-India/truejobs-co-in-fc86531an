
-- Phase 2: Add discovery + bucketing columns to Source 3 tables

-- Add bucket and classification columns to firecrawl_staged_items
ALTER TABLE public.firecrawl_staged_items
  ADD COLUMN bucket text NOT NULL DEFAULT 'rejected',
  ADD COLUMN classification_reason text,
  ADD COLUMN classification_signals text[] NOT NULL DEFAULT '{}',
  ADD COLUMN discovered_from_url text,
  ADD COLUMN url_normalized text;

-- Add URL-level dedup index (one URL per source, regardless of content)
CREATE UNIQUE INDEX idx_firecrawl_staged_url_dedup
  ON public.firecrawl_staged_items (firecrawl_source_id, url_normalized)
  WHERE url_normalized IS NOT NULL;

-- Add bucket counts to fetch runs
ALTER TABLE public.firecrawl_fetch_runs
  ADD COLUMN pages_accepted integer NOT NULL DEFAULT 0,
  ADD COLUMN pages_rejected integer NOT NULL DEFAULT 0,
  ADD COLUMN bucket_counts jsonb NOT NULL DEFAULT '{}';

-- Update staged items validation trigger to include bucket
CREATE OR REPLACE FUNCTION public.validate_firecrawl_staged_items_fields()
  RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.status NOT IN ('staged', 'reviewed', 'promoted', 'discarded', 'duplicate') THEN
    RAISE EXCEPTION 'Invalid firecrawl_staged_items.status: %', NEW.status;
  END IF;
  IF NEW.bucket NOT IN ('single_recruitment', 'collection_roundup', 'exam_update', 'prep_resource', 'rejected') THEN
    RAISE EXCEPTION 'Invalid firecrawl_staged_items.bucket: %', NEW.bucket;
  END IF;
  RETURN NEW;
END; $$;
