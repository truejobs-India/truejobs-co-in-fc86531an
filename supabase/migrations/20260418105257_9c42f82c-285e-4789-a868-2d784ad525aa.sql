-- 1. New audit table
CREATE TABLE IF NOT EXISTS public.employment_news_enrichment_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.employment_news_jobs(id) ON DELETE CASCADE,
  selected_model_id text NOT NULL,
  provider text,
  api_model text,
  max_tokens integer,
  status text NOT NULL,
  error_message text,
  duration_ms integer,
  attempted_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_enrichment_runs_job_id
  ON public.employment_news_enrichment_runs(job_id, attempted_at DESC);

CREATE INDEX IF NOT EXISTS idx_enrichment_runs_model
  ON public.employment_news_enrichment_runs(selected_model_id, attempted_at DESC);

ALTER TABLE public.employment_news_enrichment_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view enrichment runs"
  ON public.employment_news_enrichment_runs
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert enrichment runs"
  ON public.employment_news_enrichment_runs
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update enrichment runs"
  ON public.employment_news_enrichment_runs
  FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete enrichment runs"
  ON public.employment_news_enrichment_runs
  FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 2. Lightweight last-attempt metadata on the job row
ALTER TABLE public.employment_news_jobs
  ADD COLUMN IF NOT EXISTS last_enrichment_model text,
  ADD COLUMN IF NOT EXISTS last_enrichment_provider text,
  ADD COLUMN IF NOT EXISTS last_enrichment_api_model text,
  ADD COLUMN IF NOT EXISTS last_enrichment_at timestamptz;