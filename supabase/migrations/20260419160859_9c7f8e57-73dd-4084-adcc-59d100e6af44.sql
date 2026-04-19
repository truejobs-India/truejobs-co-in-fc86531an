CREATE OR REPLACE FUNCTION public.get_intake_drafts_columns()
RETURNS TABLE(column_name text, data_type text, ordinal_position int)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, information_schema
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Admin role required';
  END IF;

  RETURN QUERY
  SELECT c.column_name::text, c.data_type::text, c.ordinal_position::int
  FROM information_schema.columns c
  WHERE c.table_schema = 'public' AND c.table_name = 'intake_drafts'
  ORDER BY c.ordinal_position;
END;
$$;

REVOKE ALL ON FUNCTION public.get_intake_drafts_columns() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_intake_drafts_columns() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_intake_drafts_columns() TO authenticated;