
-- 1. Add content_hash column to seo_page_cache
ALTER TABLE public.seo_page_cache ADD COLUMN IF NOT EXISTS content_hash text;

-- 2. Create seo_rebuild_queue table
CREATE TABLE public.seo_rebuild_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL,
  page_type text NOT NULL DEFAULT 'unknown',
  reason text NOT NULL DEFAULT 'manual',
  status text NOT NULL DEFAULT 'pending',
  retry_count integer NOT NULL DEFAULT 0,
  max_retries integer NOT NULL DEFAULT 3,
  last_retry_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  error_message text
);

CREATE UNIQUE INDEX idx_rebuild_queue_pending_slug ON public.seo_rebuild_queue(slug) WHERE status = 'pending';
CREATE INDEX idx_rebuild_queue_status ON public.seo_rebuild_queue(status);

ALTER TABLE public.seo_rebuild_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage rebuild queue" ON public.seo_rebuild_queue
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role can manage rebuild queue" ON public.seo_rebuild_queue
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- 3. Create seo_rebuild_log table
CREATE TABLE public.seo_rebuild_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rebuild_type text NOT NULL,
  slugs_requested integer NOT NULL DEFAULT 0,
  slugs_rebuilt integer NOT NULL DEFAULT 0,
  slugs_skipped integer NOT NULL DEFAULT 0,
  slugs_failed integer NOT NULL DEFAULT 0,
  cf_purged integer NOT NULL DEFAULT 0,
  duration_ms integer,
  error_details jsonb,
  trigger_source text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.seo_rebuild_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage rebuild log" ON public.seo_rebuild_log
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role can manage rebuild log" ON public.seo_rebuild_log
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- 4. Create trigger function
CREATE OR REPLACE FUNCTION public.queue_seo_rebuild()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_old_slug text;
  v_new_slug text;
  v_reason text;
BEGIN
  v_reason := TG_OP || ' on ' || TG_TABLE_NAME;

  -- govt_exams
  IF TG_TABLE_NAME = 'govt_exams' THEN
    v_old_slug := CASE WHEN TG_OP IN ('UPDATE','DELETE') THEN OLD.slug END;
    v_new_slug := CASE WHEN TG_OP IN ('INSERT','UPDATE') THEN NEW.slug END;

    -- Queue new slug
    IF v_new_slug IS NOT NULL THEN
      INSERT INTO seo_rebuild_queue (slug, page_type, reason, status)
      VALUES (v_new_slug, 'govt-exam', v_reason, 'pending')
      ON CONFLICT (slug) WHERE status = 'pending'
      DO UPDATE SET reason = seo_rebuild_queue.reason || ' + ' || EXCLUDED.reason, created_at = now();
    END IF;

    -- Queue OLD slug if changed (stale)
    IF v_old_slug IS NOT NULL AND v_old_slug IS DISTINCT FROM v_new_slug THEN
      INSERT INTO seo_rebuild_queue (slug, page_type, reason, status)
      VALUES (v_old_slug, 'govt-exam-stale', v_reason || ' (old slug)', 'pending')
      ON CONFLICT (slug) WHERE status = 'pending'
      DO UPDATE SET reason = seo_rebuild_queue.reason || ' + ' || EXCLUDED.reason, created_at = now();
    END IF;

    -- Queue OLD department page if department changed
    IF TG_OP = 'UPDATE' AND OLD.department_slug IS DISTINCT FROM NEW.department_slug THEN
      IF OLD.department_slug IS NOT NULL THEN
        INSERT INTO seo_rebuild_queue (slug, page_type, reason, status)
        VALUES (OLD.department_slug, 'department', v_reason || ' (old dept)', 'pending')
        ON CONFLICT (slug) WHERE status = 'pending'
        DO UPDATE SET reason = seo_rebuild_queue.reason || ' + ' || EXCLUDED.reason, created_at = now();
      END IF;
    END IF;

    -- Queue NEW department page
    IF NEW IS NOT NULL AND NEW.department_slug IS NOT NULL THEN
      INSERT INTO seo_rebuild_queue (slug, page_type, reason, status)
      VALUES (NEW.department_slug, 'department', v_reason || ' (dept)', 'pending')
      ON CONFLICT (slug) WHERE status = 'pending'
      DO UPDATE SET reason = seo_rebuild_queue.reason || ' + ' || EXCLUDED.reason, created_at = now();
    END IF;

    -- Queue state pages for OLD states
    IF TG_OP IN ('UPDATE','DELETE') AND OLD.states IS NOT NULL AND array_length(OLD.states, 1) > 0 THEN
      FOR i IN 1..array_length(OLD.states, 1) LOOP
        INSERT INTO seo_rebuild_queue (slug, page_type, reason, status)
        VALUES (lower(replace(OLD.states[i], ' ', '-')) || '-govt-jobs', 'state-govt', v_reason || ' (old state)', 'pending')
        ON CONFLICT (slug) WHERE status = 'pending'
        DO UPDATE SET reason = seo_rebuild_queue.reason || ' + ' || EXCLUDED.reason, created_at = now();
      END LOOP;
    END IF;

    -- Queue state pages for NEW states
    IF TG_OP IN ('INSERT','UPDATE') AND NEW.states IS NOT NULL AND array_length(NEW.states, 1) > 0 THEN
      FOR i IN 1..array_length(NEW.states, 1) LOOP
        INSERT INTO seo_rebuild_queue (slug, page_type, reason, status)
        VALUES (lower(replace(NEW.states[i], ' ', '-')) || '-govt-jobs', 'state-govt', v_reason || ' (new state)', 'pending')
        ON CONFLICT (slug) WHERE status = 'pending'
        DO UPDATE SET reason = seo_rebuild_queue.reason || ' + ' || EXCLUDED.reason, created_at = now();
      END LOOP;
    END IF;
  END IF;

  -- blog_posts
  IF TG_TABLE_NAME = 'blog_posts' THEN
    v_old_slug := CASE WHEN TG_OP IN ('UPDATE','DELETE') THEN OLD.slug END;
    v_new_slug := CASE WHEN TG_OP IN ('INSERT','UPDATE') THEN NEW.slug END;

    -- Queue on publish or content change while published
    IF (NEW IS NOT NULL AND NEW.is_published = true AND v_new_slug IS NOT NULL) THEN
      INSERT INTO seo_rebuild_queue (slug, page_type, reason, status)
      VALUES (v_new_slug, 'blog', v_reason, 'pending')
      ON CONFLICT (slug) WHERE status = 'pending'
      DO UPDATE SET reason = seo_rebuild_queue.reason || ' + ' || EXCLUDED.reason, created_at = now();
    END IF;

    -- Unpublish: queue old slug for cache removal
    IF TG_OP = 'UPDATE' AND OLD.is_published = true AND NEW.is_published = false THEN
      INSERT INTO seo_rebuild_queue (slug, page_type, reason, status)
      VALUES (v_old_slug, 'blog-stale', v_reason || ' (unpublished)', 'pending')
      ON CONFLICT (slug) WHERE status = 'pending'
      DO UPDATE SET reason = seo_rebuild_queue.reason || ' + ' || EXCLUDED.reason, created_at = now();
    END IF;

    -- Slug change while published: queue old slug for removal
    IF TG_OP = 'UPDATE' AND v_old_slug IS DISTINCT FROM v_new_slug AND OLD.is_published = true THEN
      INSERT INTO seo_rebuild_queue (slug, page_type, reason, status)
      VALUES (v_old_slug, 'blog-stale', v_reason || ' (old slug)', 'pending')
      ON CONFLICT (slug) WHERE status = 'pending'
      DO UPDATE SET reason = seo_rebuild_queue.reason || ' + ' || EXCLUDED.reason, created_at = now();
    END IF;

    -- DELETE of published post
    IF TG_OP = 'DELETE' AND OLD.is_published = true THEN
      INSERT INTO seo_rebuild_queue (slug, page_type, reason, status)
      VALUES (v_old_slug, 'blog-stale', v_reason || ' (deleted)', 'pending')
      ON CONFLICT (slug) WHERE status = 'pending'
      DO UPDATE SET reason = seo_rebuild_queue.reason || ' + ' || EXCLUDED.reason, created_at = now();
    END IF;
  END IF;

  -- employment_news_jobs
  IF TG_TABLE_NAME = 'employment_news_jobs' THEN
    v_old_slug := CASE WHEN TG_OP IN ('UPDATE','DELETE') THEN OLD.slug END;
    v_new_slug := CASE WHEN TG_OP IN ('INSERT','UPDATE') THEN NEW.slug END;

    IF (NEW IS NOT NULL AND NEW.status = 'published' AND v_new_slug IS NOT NULL) THEN
      INSERT INTO seo_rebuild_queue (slug, page_type, reason, status)
      VALUES (v_new_slug, 'employment-news', v_reason, 'pending')
      ON CONFLICT (slug) WHERE status = 'pending'
      DO UPDATE SET reason = seo_rebuild_queue.reason || ' + ' || EXCLUDED.reason, created_at = now();
    END IF;

    -- Unpublish/slug-change/delete: queue old for removal
    IF (TG_OP = 'UPDATE' AND OLD.status = 'published' AND NEW.status <> 'published') OR
       (TG_OP = 'UPDATE' AND v_old_slug IS DISTINCT FROM v_new_slug AND OLD.status = 'published') OR
       (TG_OP = 'DELETE' AND OLD.status = 'published') THEN
      IF v_old_slug IS NOT NULL THEN
        INSERT INTO seo_rebuild_queue (slug, page_type, reason, status)
        VALUES (v_old_slug, 'employment-news-stale', v_reason || ' (stale)', 'pending')
        ON CONFLICT (slug) WHERE status = 'pending'
        DO UPDATE SET reason = seo_rebuild_queue.reason || ' + ' || EXCLUDED.reason, created_at = now();
      END IF;
    END IF;

    -- Queue state page if state changes
    IF TG_OP = 'UPDATE' AND OLD.state IS DISTINCT FROM NEW.state AND OLD.state IS NOT NULL THEN
      INSERT INTO seo_rebuild_queue (slug, page_type, reason, status)
      VALUES (lower(replace(OLD.state, ' ', '-')) || '-govt-jobs', 'state-govt', v_reason || ' (old state)', 'pending')
      ON CONFLICT (slug) WHERE status = 'pending'
      DO UPDATE SET reason = seo_rebuild_queue.reason || ' + ' || EXCLUDED.reason, created_at = now();
    END IF;

    IF NEW IS NOT NULL AND NEW.state IS NOT NULL THEN
      INSERT INTO seo_rebuild_queue (slug, page_type, reason, status)
      VALUES (lower(replace(NEW.state, ' ', '-')) || '-govt-jobs', 'state-govt', v_reason || ' (state)', 'pending')
      ON CONFLICT (slug) WHERE status = 'pending'
      DO UPDATE SET reason = seo_rebuild_queue.reason || ' + ' || EXCLUDED.reason, created_at = now();
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- 5. Create triggers
CREATE TRIGGER trg_govt_exams_seo_rebuild
  AFTER INSERT OR UPDATE OR DELETE ON public.govt_exams
  FOR EACH ROW EXECUTE FUNCTION public.queue_seo_rebuild();

CREATE TRIGGER trg_blog_posts_seo_rebuild
  AFTER INSERT OR UPDATE OR DELETE ON public.blog_posts
  FOR EACH ROW EXECUTE FUNCTION public.queue_seo_rebuild();

CREATE TRIGGER trg_employment_news_seo_rebuild
  AFTER INSERT OR UPDATE OR DELETE ON public.employment_news_jobs
  FOR EACH ROW EXECUTE FUNCTION public.queue_seo_rebuild();
