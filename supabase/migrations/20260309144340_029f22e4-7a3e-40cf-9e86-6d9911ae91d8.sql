ALTER TABLE content_enrichments ADD COLUMN IF NOT EXISTS failure_reason text;

CREATE OR REPLACE FUNCTION public.insert_enrichment_version(
  p_page_slug text,
  p_page_type text,
  p_enrichment_data jsonb,
  p_status text,
  p_sections_added text[],
  p_internal_links_added text[],
  p_quality_score jsonb,
  p_flags text[],
  p_current_word_count integer,
  p_current_section_count integer,
  p_failure_reason text DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_next_version integer;
  v_lock_key bigint;
BEGIN
  v_lock_key := hashtext(p_page_slug)::bigint;
  PERFORM pg_advisory_xact_lock(v_lock_key);
  SELECT COALESCE(MAX(version), 0) + 1 INTO v_next_version
  FROM content_enrichments
  WHERE page_slug = p_page_slug;
  INSERT INTO content_enrichments (
    page_slug, page_type, enrichment_data, status,
    sections_added, internal_links_added, quality_score, flags,
    current_word_count, current_section_count, version, failure_reason,
    updated_at
  ) VALUES (
    p_page_slug, p_page_type, p_enrichment_data, p_status,
    p_sections_added, p_internal_links_added, p_quality_score, p_flags,
    p_current_word_count, p_current_section_count, v_next_version, p_failure_reason,
    now()
  );
  RETURN v_next_version;
END;
$$;

REVOKE ALL ON FUNCTION public.insert_enrichment_version FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.insert_enrichment_version TO service_role;