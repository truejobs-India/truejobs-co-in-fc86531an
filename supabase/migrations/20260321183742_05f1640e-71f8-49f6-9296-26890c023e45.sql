
CREATE TABLE public.seo_audit_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_type text NOT NULL DEFAULT 'audit',
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  ai_model text,
  total_scanned jsonb DEFAULT '{}'::jsonb,
  total_issues integer DEFAULT 0,
  total_fixed integer DEFAULT 0,
  total_skipped integer DEFAULT 0,
  total_failed integer DEFAULT 0,
  total_review_required integer DEFAULT 0,
  warnings text[] DEFAULT '{}'::text[],
  issue_summary jsonb DEFAULT '{}'::jsonb,
  fix_details jsonb DEFAULT '[]'::jsonb,
  started_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.seo_audit_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage audit runs"
  ON public.seo_audit_runs
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
