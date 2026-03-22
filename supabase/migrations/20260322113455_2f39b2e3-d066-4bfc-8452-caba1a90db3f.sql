
-- 1. Create the RPC function to delete an edition (upload_batch) and ALL its jobs
CREATE OR REPLACE FUNCTION public.delete_employment_news_edition(p_batch_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_caller_id uuid;
  v_batch RECORD;
  v_deleted_jobs integer;
BEGIN
  -- Auth check
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authentication required');
  END IF;
  IF NOT public.has_role(v_caller_id, 'admin') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Admin role required');
  END IF;

  -- Check batch exists
  SELECT * INTO v_batch FROM upload_batches WHERE id = p_batch_id;
  IF v_batch IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Batch not found');
  END IF;

  -- Delete all employment_news_jobs linked to this batch (published or not)
  DELETE FROM employment_news_jobs WHERE upload_batch_id = p_batch_id;
  GET DIAGNOSTICS v_deleted_jobs = ROW_COUNT;

  -- Delete the batch record itself
  DELETE FROM upload_batches WHERE id = p_batch_id;

  RETURN jsonb_build_object(
    'success', true,
    'deleted_jobs', v_deleted_jobs,
    'batch_filename', v_batch.filename
  );
END;
$$;

-- 2. Delete the two duplicate ISSUE NO 51 batches and their jobs now
DELETE FROM employment_news_jobs WHERE upload_batch_id IN (
  '8fb38820-cb37-4f6d-a8ef-60c6ccaee594',
  '91e5e566-1de4-4c96-bc94-095102b384c1'
);
DELETE FROM upload_batches WHERE id IN (
  '8fb38820-cb37-4f6d-a8ef-60c6ccaee594',
  '91e5e566-1de4-4c96-bc94-095102b384c1'
);
