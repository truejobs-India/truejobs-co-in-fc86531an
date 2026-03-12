
-- ═══════════════════════════════════════════════════════
-- 1. ADD AUDIT/VERSION COLUMNS
-- ═══════════════════════════════════════════════════════
ALTER TABLE content_enrichments
  ADD COLUMN IF NOT EXISTS approved_by uuid,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS published_at timestamptz,
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS review_notes text;

-- Drop old unique constraint on page_slug (used by upsert onConflict)
ALTER TABLE content_enrichments DROP CONSTRAINT IF EXISTS content_enrichments_page_slug_key;

-- ═══════════════════════════════════════════════════════
-- 2. DUPLICATE PRECHECK + TABLE-SPECIFIC IDEMPOTENT CONSTRAINT
-- ═══════════════════════════════════════════════════════
DO $$ 
DECLARE
  dup_count integer;
BEGIN
  SELECT count(*) INTO dup_count
  FROM (
    SELECT page_slug, version
    FROM content_enrichments
    GROUP BY page_slug, version
    HAVING count(*) > 1
  ) dupes;

  IF dup_count > 0 THEN
    DELETE FROM content_enrichments
    WHERE id IN (
      SELECT id FROM (
        SELECT id,
          ROW_NUMBER() OVER (PARTITION BY page_slug, version ORDER BY updated_at DESC, created_at DESC) AS rn
        FROM content_enrichments
      ) ranked
      WHERE rn > 1
    );
    RAISE NOTICE 'Cleaned % duplicate (page_slug, version) groups', dup_count;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.content_enrichments'::regclass
      AND conname = 'content_enrichments_slug_version_key'
  ) THEN
    ALTER TABLE content_enrichments
      ADD CONSTRAINT content_enrichments_slug_version_key UNIQUE (page_slug, version);
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════
-- 3. PARTIAL UNIQUE INDEX (one published row per slug)
-- ═══════════════════════════════════════════════════════
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_published_per_slug
  ON content_enrichments (page_slug)
  WHERE published_at IS NOT NULL;

-- ═══════════════════════════════════════════════════════
-- 4. IDEMPOTENT RLS POLICIES
-- ═══════════════════════════════════════════════════════
DROP POLICY IF EXISTS "Anon can read published enrichments" ON public.content_enrichments;
CREATE POLICY "Anon can read published enrichments"
  ON public.content_enrichments FOR SELECT TO anon
  USING (status = 'approved' AND published_at IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated can read published enrichments" ON public.content_enrichments;
CREATE POLICY "Authenticated can read published enrichments"
  ON public.content_enrichments FOR SELECT TO authenticated
  USING (status = 'approved' AND published_at IS NOT NULL);

-- ═══════════════════════════════════════════════════════
-- 5. ATOMIC PUBLISH RPC — ADMIN-ONLY, SECURITY DEFINER
-- ═══════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.publish_enrichment_version(
  p_page_slug text,
  p_version integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_target_id uuid;
  v_target_status text;
  v_caller_id uuid;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authentication required');
  END IF;
  IF NOT public.has_role(v_caller_id, 'admin') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Admin role required');
  END IF;

  SELECT id, status INTO v_target_id, v_target_status
  FROM content_enrichments
  WHERE page_slug = p_page_slug AND version = p_version;

  IF v_target_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Version not found');
  END IF;

  IF v_target_status <> 'approved' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Version must be approved before publishing');
  END IF;

  UPDATE content_enrichments
  SET published_at = NULL
  WHERE page_slug = p_page_slug AND published_at IS NOT NULL;

  UPDATE content_enrichments
  SET published_at = now()
  WHERE id = v_target_id;

  RETURN jsonb_build_object('success', true, 'published_version', p_version);
END;
$$;

-- ═══════════════════════════════════════════════════════
-- 6. UNPUBLISH RPC — ADMIN-ONLY, SECURITY DEFINER
-- ═══════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.unpublish_enrichment(p_page_slug text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id uuid;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authentication required');
  END IF;
  IF NOT public.has_role(v_caller_id, 'admin') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Admin role required');
  END IF;

  UPDATE content_enrichments
  SET published_at = NULL
  WHERE page_slug = p_page_slug AND published_at IS NOT NULL;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- ═══════════════════════════════════════════════════════
-- 7. REVOKE/GRANT EXECUTE — authenticated only
-- ═══════════════════════════════════════════════════════
REVOKE EXECUTE ON FUNCTION public.publish_enrichment_version(text, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.publish_enrichment_version(text, integer) FROM public;
GRANT EXECUTE ON FUNCTION public.publish_enrichment_version(text, integer) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.unpublish_enrichment(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.unpublish_enrichment(text) FROM public;
GRANT EXECUTE ON FUNCTION public.unpublish_enrichment(text) TO authenticated;
