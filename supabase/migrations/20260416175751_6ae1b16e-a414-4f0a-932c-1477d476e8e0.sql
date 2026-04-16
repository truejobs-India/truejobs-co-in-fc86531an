ALTER TABLE public.intake_drafts
  ADD COLUMN IF NOT EXISTS pipeline_status text,
  ADD COLUMN IF NOT EXISTS pipeline_current_step text,
  ADD COLUMN IF NOT EXISTS pipeline_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS pipeline_finished_at timestamptz,
  ADD COLUMN IF NOT EXISTS pipeline_lock_token uuid,
  ADD COLUMN IF NOT EXISTS pipeline_lock_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS pipeline_last_error text;

CREATE TABLE IF NOT EXISTS public.intake_pipeline_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_id uuid NOT NULL REFERENCES public.intake_drafts(id) ON DELETE CASCADE,
  step text NOT NULL,
  status text NOT NULL,
  reason text,
  fields_updated text[] NOT NULL DEFAULT '{}',
  ai_model text,
  duration_ms integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pipeline_runs_draft ON public.intake_pipeline_runs(draft_id, created_at DESC);

ALTER TABLE public.intake_pipeline_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins read pipeline runs" ON public.intake_pipeline_runs;
CREATE POLICY "admins read pipeline runs" ON public.intake_pipeline_runs
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.validate_pipeline_runs()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.status NOT IN ('ok','skipped','error') THEN
    RAISE EXCEPTION 'Invalid intake_pipeline_runs.status: %', NEW.status;
  END IF;
  IF NEW.step NOT IN ('deterministic','classify','enrich','improve_title','improve_summary','generate_slug','seo_fix','validate') THEN
    RAISE EXCEPTION 'Invalid intake_pipeline_runs.step: %', NEW.step;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_validate_pipeline_runs ON public.intake_pipeline_runs;
CREATE TRIGGER trg_validate_pipeline_runs
  BEFORE INSERT OR UPDATE ON public.intake_pipeline_runs
  FOR EACH ROW EXECUTE FUNCTION public.validate_pipeline_runs();