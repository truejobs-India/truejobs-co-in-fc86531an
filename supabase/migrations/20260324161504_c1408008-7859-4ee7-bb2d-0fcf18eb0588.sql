UPDATE public.upload_batches
SET completed_chunks = total_chunks,
    extraction_status = 'completed'
WHERE id = '7f6fc467-8a04-4ec6-82a9-6a8503f6fa01';