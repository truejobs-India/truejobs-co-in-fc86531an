
-- Source 3: Firecrawl HTML source registry
CREATE TABLE public.firecrawl_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_name text NOT NULL,
  seed_url text NOT NULL UNIQUE,
  source_type text NOT NULL DEFAULT 'firecrawl_html',
  is_enabled boolean NOT NULL DEFAULT false,
  priority text NOT NULL DEFAULT 'Medium',
  crawl_mode text NOT NULL DEFAULT 'scrape',
  extraction_mode text NOT NULL DEFAULT 'markdown',
  allowed_domains text[] NOT NULL DEFAULT '{}',
  allowed_url_patterns text[] NOT NULL DEFAULT '{}',
  blocked_url_patterns text[] NOT NULL DEFAULT '{}',
  default_bucket text NOT NULL DEFAULT 'staging',
  check_interval_hours integer NOT NULL DEFAULT 12,
  max_pages_per_run integer NOT NULL DEFAULT 10,
  notes text,
  last_fetched_at timestamptz,
  last_success_at timestamptz,
  last_error text,
  total_items_found integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Validation trigger for firecrawl_sources
CREATE OR REPLACE FUNCTION public.validate_firecrawl_sources_fields()
  RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.source_type NOT IN ('firecrawl_html', 'firecrawl_sitemap') THEN
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

CREATE TRIGGER trg_validate_firecrawl_sources
  BEFORE INSERT OR UPDATE ON public.firecrawl_sources
  FOR EACH ROW EXECUTE FUNCTION public.validate_firecrawl_sources_fields();

-- Firecrawl fetch runs log (mirrors rss_fetch_runs pattern)
CREATE TABLE public.firecrawl_fetch_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firecrawl_source_id uuid NOT NULL REFERENCES public.firecrawl_sources(id) ON DELETE CASCADE,
  run_mode text NOT NULL DEFAULT 'manual_admin',
  status text NOT NULL DEFAULT 'running',
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  pages_fetched integer NOT NULL DEFAULT 0,
  items_found integer NOT NULL DEFAULT 0,
  items_new integer NOT NULL DEFAULT 0,
  items_skipped integer NOT NULL DEFAULT 0,
  error_log text,
  raw_response_sample jsonb
);

CREATE OR REPLACE FUNCTION public.validate_firecrawl_fetch_runs_fields()
  RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.run_mode NOT IN ('manual_admin', 'cron_secret', 'test') THEN
    RAISE EXCEPTION 'Invalid firecrawl_fetch_runs.run_mode: %', NEW.run_mode;
  END IF;
  IF NEW.status NOT IN ('running', 'success', 'partial', 'error') THEN
    RAISE EXCEPTION 'Invalid firecrawl_fetch_runs.status: %', NEW.status;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_validate_firecrawl_fetch_runs
  BEFORE INSERT OR UPDATE ON public.firecrawl_fetch_runs
  FOR EACH ROW EXECUTE FUNCTION public.validate_firecrawl_fetch_runs_fields();

-- Staging table for scraped items (isolated from production jobs/rss_items)
CREATE TABLE public.firecrawl_staged_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firecrawl_source_id uuid NOT NULL REFERENCES public.firecrawl_sources(id) ON DELETE CASCADE,
  fetch_run_id uuid REFERENCES public.firecrawl_fetch_runs(id) ON DELETE SET NULL,
  page_url text NOT NULL,
  page_title text,
  extracted_markdown text,
  extracted_links text[],
  metadata jsonb DEFAULT '{}',
  content_hash text,
  status text NOT NULL DEFAULT 'staged',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(firecrawl_source_id, content_hash)
);

CREATE OR REPLACE FUNCTION public.validate_firecrawl_staged_items_fields()
  RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.status NOT IN ('staged', 'reviewed', 'promoted', 'discarded', 'duplicate') THEN
    RAISE EXCEPTION 'Invalid firecrawl_staged_items.status: %', NEW.status;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_validate_firecrawl_staged_items
  BEFORE INSERT OR UPDATE ON public.firecrawl_staged_items
  FOR EACH ROW EXECUTE FUNCTION public.validate_firecrawl_staged_items_fields();

-- RLS: admin-only for all Source 3 tables
ALTER TABLE public.firecrawl_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.firecrawl_fetch_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.firecrawl_staged_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage firecrawl_sources" ON public.firecrawl_sources
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage firecrawl_fetch_runs" ON public.firecrawl_fetch_runs
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage firecrawl_staged_items" ON public.firecrawl_staged_items
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- updated_at triggers
CREATE TRIGGER trg_firecrawl_sources_updated_at
  BEFORE UPDATE ON public.firecrawl_sources
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_firecrawl_staged_items_updated_at
  BEFORE UPDATE ON public.firecrawl_staged_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
