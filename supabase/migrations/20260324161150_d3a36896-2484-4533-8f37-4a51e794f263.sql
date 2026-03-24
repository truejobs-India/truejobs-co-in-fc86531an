update public.upload_batches
set extraction_status = 'partial', status = 'completed'
where id = '7f6fc467-8a04-4ec6-82a9-6a8503f6fa01'
  and extraction_status = 'extracting'
  and completed_chunks < total_chunks;