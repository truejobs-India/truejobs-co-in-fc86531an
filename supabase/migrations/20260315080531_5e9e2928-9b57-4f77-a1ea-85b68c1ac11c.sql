ALTER TABLE public.blog_bulk_workflow_sessions
  DROP CONSTRAINT IF EXISTS blog_bulk_workflow_sessions_workflow_type_check;
ALTER TABLE public.blog_bulk_workflow_sessions
  ADD CONSTRAINT blog_bulk_workflow_sessions_workflow_type_check
  CHECK (workflow_type IN ('fix', 'enrich', 'publish'));