CREATE OR REPLACE FUNCTION validate_firecrawl_draft_jobs_fields()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status NOT IN ('draft', 'reviewed', 'approved', 'rejected', 'promoted', 'enriched') THEN
    RAISE EXCEPTION 'Invalid firecrawl_draft_jobs.status: %', NEW.status;
  END IF;
  IF NEW.extraction_confidence NOT IN ('high', 'medium', 'low', 'none') THEN
    RAISE EXCEPTION 'Invalid firecrawl_draft_jobs.extraction_confidence: %', NEW.extraction_confidence;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql