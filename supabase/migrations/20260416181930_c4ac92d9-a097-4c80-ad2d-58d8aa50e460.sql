ALTER TABLE public.intake_drafts
ADD COLUMN IF NOT EXISTS pipeline_lock_expires_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_intake_drafts_pipeline_lock_expires_at
ON public.intake_drafts(pipeline_lock_expires_at)
WHERE pipeline_lock_expires_at IS NOT NULL;