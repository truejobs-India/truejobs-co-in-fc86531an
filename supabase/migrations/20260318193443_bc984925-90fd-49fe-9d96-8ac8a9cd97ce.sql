
-- ========================================
-- RSS Ingestion Module — 4 tables + indexes + validation triggers + RLS + sync function
-- ========================================

-- 1. rss_sources
CREATE TABLE public.rss_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_name text NOT NULL,
  official_site text,
  feed_url text NOT NULL,
  source_type text NOT NULL DEFAULT 'rss',
  focus text,
  priority text NOT NULL DEFAULT 'Medium',
  status text NOT NULL DEFAULT 'Testing',
  language text,
  category text,
  state_or_scope text,
  fetch_enabled boolean NOT NULL DEFAULT true,
  check_interval_hours integer NOT NULL DEFAULT 6,
  last_fetched_at timestamptz,
  last_success_at timestamptz,
  last_error text,
  etag text,
  last_modified text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rss_sources_feed_url_unique UNIQUE (feed_url)
);

-- 2. rss_fetch_runs
CREATE TABLE public.rss_fetch_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rss_source_id uuid NOT NULL REFERENCES public.rss_sources(id) ON DELETE CASCADE,
  run_mode text NOT NULL DEFAULT 'manual',
  status text NOT NULL,
  http_status integer,
  content_type text,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  items_seen integer NOT NULL DEFAULT 0,
  items_new integer NOT NULL DEFAULT 0,
  items_updated integer NOT NULL DEFAULT 0,
  items_skipped integer NOT NULL DEFAULT 0,
  error_log text,
  response_meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 3. rss_items
CREATE TABLE public.rss_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rss_source_id uuid NOT NULL REFERENCES public.rss_sources(id) ON DELETE CASCADE,
  item_guid text,
  item_title text NOT NULL,
  item_link text,
  canonical_link text,
  published_at timestamptz,
  author text,
  item_summary text,
  item_content text,
  categories text[] NOT NULL DEFAULT '{}',
  item_type text NOT NULL DEFAULT 'unknown',
  relevance_level text NOT NULL DEFAULT 'Low',
  detection_reason text,
  first_pdf_url text,
  linked_pdf_urls text[] NOT NULL DEFAULT '{}',
  normalized_hash text NOT NULL,
  raw_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  current_status text NOT NULL DEFAULT 'new',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 4. monitoring_review_queue
CREATE TABLE public.monitoring_review_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel text NOT NULL,
  source_id uuid,
  source_item_id uuid,
  title text NOT NULL,
  source_url text,
  pdf_url text,
  published_at timestamptz,
  item_type text,
  review_status text NOT NULL DEFAULT 'pending',
  action_decision text,
  qa_notes text,
  raw_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  parsed_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ========================================
-- Indexes
-- ========================================

-- rss_items: 3-tier dedup indexes
CREATE UNIQUE INDEX idx_rss_items_source_guid ON public.rss_items (rss_source_id, item_guid) WHERE item_guid IS NOT NULL;
CREATE UNIQUE INDEX idx_rss_items_source_canonical ON public.rss_items (rss_source_id, canonical_link) WHERE canonical_link IS NOT NULL;
CREATE UNIQUE INDEX idx_rss_items_normalized_hash ON public.rss_items (normalized_hash);

-- rss_items: query indexes
CREATE INDEX idx_rss_items_source_id ON public.rss_items (rss_source_id);
CREATE INDEX idx_rss_items_current_status ON public.rss_items (current_status);
CREATE INDEX idx_rss_items_published_at ON public.rss_items (published_at);
CREATE INDEX idx_rss_items_item_type ON public.rss_items (item_type);
CREATE INDEX idx_rss_items_relevance_level ON public.rss_items (relevance_level);

-- rss_fetch_runs
CREATE INDEX idx_rss_fetch_runs_source_id ON public.rss_fetch_runs (rss_source_id);

-- monitoring_review_queue: partial unique for channel + source_item_id
CREATE UNIQUE INDEX idx_review_queue_channel_source_item ON public.monitoring_review_queue (channel, source_item_id) WHERE source_item_id IS NOT NULL;
CREATE INDEX idx_review_queue_status ON public.monitoring_review_queue (review_status);

-- ========================================
-- Validation Triggers
-- ========================================

CREATE OR REPLACE FUNCTION public.validate_rss_sources_fields()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.priority NOT IN ('High', 'Medium', 'Low') THEN
    RAISE EXCEPTION 'Invalid rss_sources.priority: %', NEW.priority;
  END IF;
  IF NEW.status NOT IN ('Live now', 'Needs verification', 'Not useful for jobs', 'Testing', 'Paused', 'Broken') THEN
    RAISE EXCEPTION 'Invalid rss_sources.status: %', NEW.status;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_validate_rss_sources
BEFORE INSERT OR UPDATE ON public.rss_sources
FOR EACH ROW EXECUTE FUNCTION public.validate_rss_sources_fields();

CREATE OR REPLACE FUNCTION public.validate_rss_fetch_runs_fields()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.run_mode NOT IN ('manual', 'scheduled', 'test', 'manual_admin', 'cron_secret') THEN
    RAISE EXCEPTION 'Invalid rss_fetch_runs.run_mode: %', NEW.run_mode;
  END IF;
  IF NEW.status NOT IN ('running', 'success', 'partial', 'error') THEN
    RAISE EXCEPTION 'Invalid rss_fetch_runs.status: %', NEW.status;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_validate_rss_fetch_runs
BEFORE INSERT OR UPDATE ON public.rss_fetch_runs
FOR EACH ROW EXECUTE FUNCTION public.validate_rss_fetch_runs_fields();

CREATE OR REPLACE FUNCTION public.validate_rss_items_fields()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.item_type NOT IN ('recruitment', 'vacancy', 'exam', 'admit_card', 'result', 'answer_key', 'syllabus', 'policy', 'signal', 'unknown') THEN
    RAISE EXCEPTION 'Invalid rss_items.item_type: %', NEW.item_type;
  END IF;
  IF NEW.relevance_level NOT IN ('High', 'Medium', 'Low') THEN
    RAISE EXCEPTION 'Invalid rss_items.relevance_level: %', NEW.relevance_level;
  END IF;
  IF NEW.current_status NOT IN ('new', 'updated', 'queued', 'reviewed', 'ignored', 'duplicate') THEN
    RAISE EXCEPTION 'Invalid rss_items.current_status: %', NEW.current_status;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_validate_rss_items
BEFORE INSERT OR UPDATE ON public.rss_items
FOR EACH ROW EXECUTE FUNCTION public.validate_rss_items_fields();

CREATE OR REPLACE FUNCTION public.validate_review_queue_fields()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.channel NOT IN ('rss', 'distill', 'crawler') THEN
    RAISE EXCEPTION 'Invalid monitoring_review_queue.channel: %', NEW.channel;
  END IF;
  IF NEW.review_status NOT IN ('pending', 'approved', 'rejected', 'duplicate', 'ignored', 'on_hold') THEN
    RAISE EXCEPTION 'Invalid monitoring_review_queue.review_status: %', NEW.review_status;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_validate_review_queue
BEFORE INSERT OR UPDATE ON public.monitoring_review_queue
FOR EACH ROW EXECUTE FUNCTION public.validate_review_queue_fields();

-- ========================================
-- updated_at Triggers
-- ========================================

CREATE TRIGGER set_rss_sources_updated_at
BEFORE UPDATE ON public.rss_sources
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER set_rss_items_updated_at
BEFORE UPDATE ON public.rss_items
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER set_review_queue_updated_at
BEFORE UPDATE ON public.monitoring_review_queue
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ========================================
-- RLS Policies
-- ========================================

ALTER TABLE public.rss_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rss_fetch_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rss_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monitoring_review_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access on rss_sources"
ON public.rss_sources FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin full access on rss_fetch_runs"
ON public.rss_fetch_runs FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin full access on rss_items"
ON public.rss_items FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin full access on monitoring_review_queue"
ON public.monitoring_review_queue FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ========================================
-- sync_rss_review_status — server-side atomic status sync
-- ========================================

CREATE OR REPLACE FUNCTION public.sync_rss_review_status(
  p_review_queue_id uuid,
  p_new_status text,
  p_qa_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_caller_id uuid;
  v_queue_row RECORD;
  v_rss_status text;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authentication required');
  END IF;
  IF NOT public.has_role(v_caller_id, 'admin') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Admin role required');
  END IF;

  IF p_new_status NOT IN ('pending', 'approved', 'rejected', 'duplicate', 'ignored', 'on_hold') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid review status: ' || p_new_status);
  END IF;

  SELECT * INTO v_queue_row FROM monitoring_review_queue WHERE id = p_review_queue_id FOR UPDATE;
  IF v_queue_row IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Review queue entry not found');
  END IF;

  -- Update review queue
  UPDATE monitoring_review_queue SET
    review_status = p_new_status,
    reviewed_at = CASE WHEN p_new_status IN ('approved','rejected','duplicate','ignored') THEN now() ELSE reviewed_at END,
    qa_notes = COALESCE(p_qa_notes, qa_notes)
  WHERE id = p_review_queue_id;

  -- Map review status to rss_items.current_status
  v_rss_status := CASE p_new_status
    WHEN 'approved' THEN 'reviewed'
    WHEN 'rejected' THEN 'reviewed'
    WHEN 'ignored' THEN 'ignored'
    WHEN 'duplicate' THEN 'duplicate'
    WHEN 'on_hold' THEN 'queued'
    WHEN 'pending' THEN 'queued'
    ELSE NULL
  END;

  -- Sync rss_items if this is an RSS channel entry with a linked source_item_id
  IF v_queue_row.channel = 'rss' AND v_queue_row.source_item_id IS NOT NULL AND v_rss_status IS NOT NULL THEN
    UPDATE rss_items SET current_status = v_rss_status WHERE id = v_queue_row.source_item_id;
  END IF;

  RETURN jsonb_build_object('success', true, 'review_status', p_new_status, 'rss_status', v_rss_status);
END;
$$;
