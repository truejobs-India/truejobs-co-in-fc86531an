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
    WHERE last_bulk_fix_status IS DISTINCT FROM 'fixed'
      AND last_bulk_fix_status IS DISTINCT FROM 'baseline';
  END IF;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;