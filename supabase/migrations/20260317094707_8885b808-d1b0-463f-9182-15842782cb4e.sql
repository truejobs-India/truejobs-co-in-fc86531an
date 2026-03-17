
-- ═══════════════════════════════════════════════════════════════
-- Board Result Batch Pipeline — Hardened Migration
-- ═══════════════════════════════════════════════════════════════

-- 1. Concurrency-safe batch numbering sequence
CREATE SEQUENCE IF NOT EXISTS import_batch_number_seq START WITH 1 INCREMENT BY 1;

-- 2. Add batch_number column (nullable first for safe backfill)
ALTER TABLE import_batches ADD COLUMN IF NOT EXISTS batch_number INTEGER;
ALTER TABLE import_batches ADD COLUMN IF NOT EXISTS source_file_path TEXT;
ALTER TABLE import_batches ADD COLUMN IF NOT EXISTS enriched_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE import_batches ADD COLUMN IF NOT EXISTS skipped_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE import_batches ADD COLUMN IF NOT EXISTS duplicate_count INTEGER NOT NULL DEFAULT 0;

-- 3. Backfill existing rows deterministically
WITH ordered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at) AS rn
  FROM import_batches WHERE batch_number IS NULL
)
UPDATE import_batches SET batch_number = ordered.rn
FROM ordered WHERE import_batches.id = ordered.id;

-- 4. Advance sequence past backfilled values
SELECT setval('import_batch_number_seq', COALESCE((SELECT MAX(batch_number) FROM import_batches), 0));

-- 5. Set default, then NOT NULL
ALTER TABLE import_batches ALTER COLUMN batch_number SET DEFAULT nextval('import_batch_number_seq');

-- For rows that might still be null (edge case), set them
UPDATE import_batches SET batch_number = nextval('import_batch_number_seq') WHERE batch_number IS NULL;

ALTER TABLE import_batches ALTER COLUMN batch_number SET NOT NULL;

-- 6. Unique index (idempotent)
CREATE UNIQUE INDEX IF NOT EXISTS idx_import_batches_batch_number ON import_batches(batch_number);

-- ═══════════════════════════════════════════════════════════════
-- 7. Extend board_result_batch_rows with workflow columns
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE board_result_batch_rows ADD COLUMN IF NOT EXISTS source_payload JSONB NOT NULL DEFAULT '{}';
ALTER TABLE board_result_batch_rows ADD COLUMN IF NOT EXISTS workflow_status TEXT NOT NULL DEFAULT 'draft';
ALTER TABLE board_result_batch_rows ADD COLUMN IF NOT EXISTS duplicate_status TEXT NOT NULL DEFAULT 'unchecked';
ALTER TABLE board_result_batch_rows ADD COLUMN IF NOT EXISTS validation_status TEXT NOT NULL DEFAULT 'valid';
ALTER TABLE board_result_batch_rows ADD COLUMN IF NOT EXISTS duplicate_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE board_result_batch_rows ADD COLUMN IF NOT EXISTS top_duplicate_reason TEXT;
ALTER TABLE board_result_batch_rows ADD COLUMN IF NOT EXISTS enriched_content JSONB;
ALTER TABLE board_result_batch_rows ADD COLUMN IF NOT EXISTS seo_fixes JSONB;
ALTER TABLE board_result_batch_rows ADD COLUMN IF NOT EXISTS published_page_id UUID REFERENCES custom_pages(id) ON DELETE SET NULL;
ALTER TABLE board_result_batch_rows ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;
ALTER TABLE board_result_batch_rows ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE board_result_batch_rows ADD COLUMN IF NOT EXISTS deleted_by UUID;
ALTER TABLE board_result_batch_rows ADD COLUMN IF NOT EXISTS delete_reason TEXT;
ALTER TABLE board_result_batch_rows ADD COLUMN IF NOT EXISTS display_title TEXT;
ALTER TABLE board_result_batch_rows ADD COLUMN IF NOT EXISTS meta_title TEXT;
ALTER TABLE board_result_batch_rows ADD COLUMN IF NOT EXISTS meta_description TEXT;
ALTER TABLE board_result_batch_rows ADD COLUMN IF NOT EXISTS excerpt TEXT;
ALTER TABLE board_result_batch_rows ADD COLUMN IF NOT EXISTS content TEXT DEFAULT '';
ALTER TABLE board_result_batch_rows ADD COLUMN IF NOT EXISTS word_count INTEGER DEFAULT 0;
ALTER TABLE board_result_batch_rows ADD COLUMN IF NOT EXISTS faq_schema JSONB DEFAULT '[]';
ALTER TABLE board_result_batch_rows ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';
ALTER TABLE board_result_batch_rows ADD COLUMN IF NOT EXISTS quality_score INTEGER;

-- CHECK constraints (idempotent via pg_constraint check)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_workflow_status') THEN
    ALTER TABLE board_result_batch_rows ADD CONSTRAINT chk_workflow_status CHECK (
      workflow_status IN ('draft','enriched','seo_fixed','ready_to_publish','published','skipped','deleted','failed','review_needed')
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_duplicate_status') THEN
    ALTER TABLE board_result_batch_rows ADD CONSTRAINT chk_duplicate_status CHECK (
      duplicate_status IN ('unchecked','clean','possible_duplicate','confirmed_duplicate')
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_validation_status') THEN
    ALTER TABLE board_result_batch_rows ADD CONSTRAINT chk_validation_status CHECK (
      validation_status IN ('valid','invalid','warning_only')
    );
  END IF;
END $$;

-- Indexes for filtering
CREATE INDEX IF NOT EXISTS idx_batch_rows_workflow ON board_result_batch_rows(workflow_status);
CREATE INDEX IF NOT EXISTS idx_batch_rows_dup_status ON board_result_batch_rows(duplicate_status);
CREATE INDEX IF NOT EXISTS idx_batch_rows_validation ON board_result_batch_rows(validation_status);
CREATE INDEX IF NOT EXISTS idx_batch_rows_deleted ON board_result_batch_rows(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_batch_rows_published_page ON board_result_batch_rows(published_page_id) WHERE published_page_id IS NOT NULL;

-- ═══════════════════════════════════════════════════════════════
-- 8. Create duplicate_matches table
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS duplicate_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_row_id UUID NOT NULL REFERENCES board_result_batch_rows(id) ON DELETE CASCADE,
  duplicate_type TEXT NOT NULL CHECK (
    duplicate_type IN (
      'exact_slug_match','exact_board_name_match','near_board_name_match',
      'exact_result_url_match','exact_official_url_match',
      'exact_structured_field_identity','same_board_variant_fields','possible_overlap'
    )
  ),
  matched_custom_page_id UUID REFERENCES custom_pages(id) ON DELETE SET NULL,
  matched_batch_row_id UUID REFERENCES board_result_batch_rows(id) ON DELETE SET NULL,
  matched_url TEXT,
  matched_title TEXT,
  matched_slug TEXT,
  confidence NUMERIC(3,2) NOT NULL DEFAULT 0 CHECK (confidence >= 0 AND confidence <= 1),
  reason TEXT NOT NULL,
  recommended_action TEXT NOT NULL DEFAULT 'review' CHECK (
    recommended_action IN ('delete_new','skip_new','update_existing','review','keep')
  ),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_checked_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dup_matches_row ON duplicate_matches(batch_row_id);
CREATE INDEX IF NOT EXISTS idx_dup_matches_type ON duplicate_matches(duplicate_type);

ALTER TABLE duplicate_matches ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins can manage duplicate matches' AND tablename = 'duplicate_matches') THEN
    CREATE POLICY "Admins can manage duplicate matches" ON duplicate_matches
      FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════
-- 9. Transactional publish RPC (uses auth.uid(), not passed UUID)
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.publish_board_result_row(p_batch_row_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_caller_id UUID;
  v_row RECORD;
  v_page_id UUID;
  v_existing_page_id UUID;
BEGIN
  -- Auth: use auth.uid() as sole identity source
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authentication required');
  END IF;
  IF NOT public.has_role(v_caller_id, 'admin') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Admin role required');
  END IF;

  -- Lock and fetch the row
  SELECT * INTO v_row FROM board_result_batch_rows WHERE id = p_batch_row_id FOR UPDATE;
  IF v_row IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Row not found');
  END IF;

  -- Validation: not deleted
  IF v_row.deleted_at IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Row is deleted');
  END IF;

  -- Validation: validation_status acceptable
  IF v_row.validation_status = 'invalid' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Row has validation errors');
  END IF;

  -- Validation: duplicate_status does not block
  IF v_row.duplicate_status = 'confirmed_duplicate' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unresolved confirmed duplicate');
  END IF;

  -- Validation: slug present and valid format
  IF v_row.slug IS NULL OR v_row.slug = '' OR v_row.slug !~ '^[a-z0-9][a-z0-9-]{1,68}[a-z0-9]$' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid or missing slug');
  END IF;

  -- Validation: content minimum (300 words backend minimum; frontend enforces 800)
  IF v_row.word_count IS NULL OR v_row.word_count < 300 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Content too thin (minimum 300 words required, enrich first)');
  END IF;

  -- Validation: meta fields
  IF v_row.meta_title IS NULL OR length(v_row.meta_title) < 10 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Meta title missing or too short');
  END IF;
  IF v_row.meta_description IS NULL OR length(v_row.meta_description) < 30 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Meta description missing or too short');
  END IF;

  -- Validation: required board result fields
  IF v_row.state_ut IS NULL OR v_row.state_ut = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'state_ut is required');
  END IF;
  IF v_row.board_name IS NULL OR v_row.board_name = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'board_name is required');
  END IF;

  -- Check if already published (idempotent update)
  IF v_row.published_page_id IS NOT NULL THEN
    v_existing_page_id := v_row.published_page_id;
  ELSE
    SELECT id INTO v_existing_page_id FROM custom_pages WHERE slug = v_row.slug LIMIT 1;
  END IF;

  -- Upsert custom_pages
  IF v_existing_page_id IS NOT NULL THEN
    UPDATE custom_pages SET
      title = COALESCE(v_row.display_title, v_row.board_name),
      content = v_row.content,
      excerpt = v_row.excerpt,
      meta_title = v_row.meta_title,
      meta_description = v_row.meta_description,
      faq_schema = v_row.faq_schema,
      tags = v_row.tags,
      word_count = v_row.word_count,
      is_published = true,
      status = 'published',
      published_at = COALESCE(custom_pages.published_at, now()),
      updated_at = now(),
      state_ut = v_row.state_ut,
      board_name = v_row.board_name,
      result_url = v_row.result_url,
      official_board_url = v_row.official_board_url,
      result_variant = v_row.variant,
      import_batch_id = v_row.batch_id,
      source_row_index = v_row.row_index,
      source_payload = v_row.source_payload,
      page_type = 'result-landing',
      author_id = v_caller_id
    WHERE id = v_existing_page_id;
    v_page_id := v_existing_page_id;
  ELSE
    INSERT INTO custom_pages (
      title, slug, content, excerpt, meta_title, meta_description,
      faq_schema, tags, word_count, is_published, status, published_at,
      state_ut, board_name, result_url, official_board_url, result_variant,
      import_batch_id, source_row_index, source_payload, page_type, author_id, category
    ) VALUES (
      COALESCE(v_row.display_title, v_row.board_name), v_row.slug, v_row.content,
      v_row.excerpt, v_row.meta_title, v_row.meta_description,
      v_row.faq_schema, v_row.tags, v_row.word_count, true, 'published', now(),
      v_row.state_ut, v_row.board_name, v_row.result_url, v_row.official_board_url,
      v_row.variant, v_row.batch_id, v_row.row_index, v_row.source_payload,
      'result-landing', v_caller_id, 'Board Results'
    ) RETURNING id INTO v_page_id;
  END IF;

  -- Update batch row — set published linkage + timestamps in sync
  UPDATE board_result_batch_rows SET
    published_page_id = v_page_id,
    published_at = now(),
    updated_at = now(),
    workflow_status = 'published'
  WHERE id = p_batch_row_id;

  -- Backend-authoritative counter resync (sole source of truth for publish)
  UPDATE import_batches SET
    published_count = (SELECT count(*) FROM board_result_batch_rows WHERE batch_id = v_row.batch_id AND workflow_status = 'published' AND deleted_at IS NULL),
    enriched_count = (SELECT count(*) FROM board_result_batch_rows WHERE batch_id = v_row.batch_id AND workflow_status IN ('enriched','seo_fixed','ready_to_publish','published') AND deleted_at IS NULL),
    skipped_count = (SELECT count(*) FROM board_result_batch_rows WHERE batch_id = v_row.batch_id AND workflow_status = 'skipped' AND deleted_at IS NULL),
    failed_count = (SELECT count(*) FROM board_result_batch_rows WHERE batch_id = v_row.batch_id AND workflow_status = 'failed' AND deleted_at IS NULL),
    duplicate_count = (SELECT count(*) FROM board_result_batch_rows WHERE batch_id = v_row.batch_id AND duplicate_status NOT IN ('unchecked','clean') AND deleted_at IS NULL),
    updated_at = now()
  WHERE id = v_row.batch_id;

  RETURN jsonb_build_object('success', true, 'page_id', v_page_id);
END;
$$;

-- ═══════════════════════════════════════════════════════════════
-- 10. Counter resync RPC (non-publish state changes)
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.resync_batch_counters(p_batch_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_caller_id UUID;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF NOT public.has_role(v_caller_id, 'admin') THEN
    RAISE EXCEPTION 'Admin role required';
  END IF;

  UPDATE import_batches SET
    published_count = (SELECT count(*) FROM board_result_batch_rows WHERE batch_id = p_batch_id AND workflow_status = 'published' AND deleted_at IS NULL),
    enriched_count = (SELECT count(*) FROM board_result_batch_rows WHERE batch_id = p_batch_id AND workflow_status IN ('enriched','seo_fixed','ready_to_publish','published') AND deleted_at IS NULL),
    failed_count = (SELECT count(*) FROM board_result_batch_rows WHERE batch_id = p_batch_id AND workflow_status = 'failed' AND deleted_at IS NULL),
    skipped_count = (SELECT count(*) FROM board_result_batch_rows WHERE batch_id = p_batch_id AND workflow_status = 'skipped' AND deleted_at IS NULL),
    duplicate_count = (SELECT count(*) FROM board_result_batch_rows WHERE batch_id = p_batch_id AND duplicate_status NOT IN ('unchecked','clean') AND deleted_at IS NULL),
    completed_count = (SELECT count(*) FROM board_result_batch_rows WHERE batch_id = p_batch_id AND workflow_status IN ('published','enriched','seo_fixed','ready_to_publish') AND deleted_at IS NULL),
    updated_at = now()
  WHERE id = p_batch_id;
END;
$$;
