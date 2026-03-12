
ALTER TABLE public.jobs ADD COLUMN apply_url_flagged_at timestamp with time zone DEFAULT NULL;

COMMENT ON COLUMN public.jobs.apply_url_flagged_at IS 'Timestamp when apply_url was flagged as pointing to a competitor domain. Used for 7-day auto-expiry logic.';

CREATE INDEX idx_jobs_apply_url_flagged ON public.jobs (apply_url_flagged_at) WHERE apply_url_flagged_at IS NOT NULL;
