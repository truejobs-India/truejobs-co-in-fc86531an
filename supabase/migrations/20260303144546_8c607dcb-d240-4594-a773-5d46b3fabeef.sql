ALTER TABLE gov_jobs ADD COLUMN IF NOT EXISTS seo_description TEXT DEFAULT NULL;
ALTER TABLE gov_jobs ADD COLUMN IF NOT EXISTS seo_status TEXT DEFAULT 'pending';
ALTER TABLE gov_jobs ADD COLUMN IF NOT EXISTS seo_score INTEGER DEFAULT NULL;

-- Add validation trigger instead of CHECK constraint
CREATE OR REPLACE FUNCTION public.validate_gov_jobs_seo_status()
RETURNS trigger
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.seo_status IS NOT NULL AND NEW.seo_status NOT IN ('pending', 'processing', 'completed', 'failed') THEN
    RAISE EXCEPTION 'Invalid seo_status: %. Must be pending, processing, completed, or failed.', NEW.seo_status;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_gov_jobs_seo_status
BEFORE INSERT OR UPDATE ON gov_jobs
FOR EACH ROW
EXECUTE FUNCTION public.validate_gov_jobs_seo_status();