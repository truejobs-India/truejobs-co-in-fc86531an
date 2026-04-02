
CREATE OR REPLACE FUNCTION public.stamp_bulk_fix_status(
  p_post_id uuid,
  p_status text,
  p_remaining_count integer,
  p_is_fixed boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  UPDATE blog_posts
  SET
    last_bulk_scanned_at = now(),
    last_bulk_fix_status = p_status,
    remaining_auto_fixable_count = p_remaining_count,
    last_bulk_fixed_at = CASE WHEN p_is_fixed THEN now() ELSE last_bulk_fixed_at END
  WHERE id = p_post_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.baseline_mark_posts(
  p_post_ids uuid[] DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_count integer;
BEGIN
  IF p_post_ids IS NOT NULL THEN
    UPDATE blog_posts
    SET
      last_bulk_scanned_at = now(),
      last_bulk_fix_status = 'baseline',
      remaining_auto_fixable_count = 0
    WHERE id = ANY(p_post_ids);
  ELSE
    UPDATE blog_posts
    SET
      last_bulk_scanned_at = now(),
      last_bulk_fix_status = 'baseline',
      remaining_auto_fixable_count = 0
    WHERE last_bulk_scanned_at IS NULL;
  END IF;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;
