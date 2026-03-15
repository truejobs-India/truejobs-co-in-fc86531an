CREATE TABLE public.blog_bulk_workflow_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_type text NOT NULL CHECK (workflow_type IN ('fix', 'enrich')),
  status text NOT NULL DEFAULT 'scanning'
    CHECK (status IN ('scanning','scan_complete','executing','stopped','completed','failed','stale','cancelled')),
  scan_report jsonb DEFAULT '{}'::jsonb,
  progress jsonb DEFAULT '{"total":0,"done":0,"success":0,"failed":0,"skipped":0,"current_article_id":null}'::jsonb,
  execution_results jsonb DEFAULT '[]'::jsonb,
  stop_requested boolean NOT NULL DEFAULT false,
  ai_model text,
  max_articles_per_run integer NOT NULL DEFAULT 50,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  last_heartbeat_at timestamptz NOT NULL DEFAULT now(),
  started_by uuid NOT NULL
);

ALTER TABLE public.blog_bulk_workflow_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage workflow sessions"
ON public.blog_bulk_workflow_sessions FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'));