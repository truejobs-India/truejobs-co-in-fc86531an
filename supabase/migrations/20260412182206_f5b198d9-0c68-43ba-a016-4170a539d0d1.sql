-- Add Firecrawl enrichment columns to rss_items
ALTER TABLE public.rss_items
  ADD COLUMN IF NOT EXISTS firecrawl_status text NOT NULL DEFAULT 'not_needed',
  ADD COLUMN IF NOT EXISTS firecrawl_reason text,
  ADD COLUMN IF NOT EXISTS firecrawl_last_run_at timestamptz,
  ADD COLUMN IF NOT EXISTS firecrawl_source_url text,
  ADD COLUMN IF NOT EXISTS firecrawl_content_markdown text,
  ADD COLUMN IF NOT EXISTS firecrawl_content_meta jsonb,
  ADD COLUMN IF NOT EXISTS firecrawl_pdf_mode text,
  ADD COLUMN IF NOT EXISTS firecrawl_error text;

-- Update the validation trigger to also validate firecrawl_status
CREATE OR REPLACE FUNCTION public.validate_rss_items_fields()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.item_type NOT IN (
    'recruitment', 'vacancy', 'exam', 'admit_card', 'result', 'answer_key', 'syllabus',
    'scholarship', 'certificate', 'marksheet', 'school_service', 'university_service', 'document_service',
    'policy', 'circular', 'notification', 'signal', 'unknown'
  ) THEN
    RAISE EXCEPTION 'Invalid rss_items.item_type: %', NEW.item_type;
  END IF;
  IF NEW.relevance_level NOT IN ('High', 'Medium', 'Low') THEN
    RAISE EXCEPTION 'Invalid rss_items.relevance_level: %', NEW.relevance_level;
  END IF;
  IF NEW.current_status NOT IN ('new', 'updated', 'queued', 'reviewed', 'ignored', 'duplicate') THEN
    RAISE EXCEPTION 'Invalid rss_items.current_status: %', NEW.current_status;
  END IF;
  IF NEW.primary_domain NOT IN ('jobs', 'education_services', 'exam_updates', 'public_services', 'policy_updates', 'general_alerts') THEN
    RAISE EXCEPTION 'Invalid rss_items.primary_domain: %', NEW.primary_domain;
  END IF;
  IF NEW.display_group NOT IN ('Government Jobs', 'Education Services', 'Exam Updates', 'Public Services', 'Policy Updates', 'General Alerts') THEN
    RAISE EXCEPTION 'Invalid rss_items.display_group: %', NEW.display_group;
  END IF;
  IF NEW.firecrawl_status NOT IN ('not_needed', 'queued', 'running', 'success', 'failed', 'skipped', 'partial') THEN
    RAISE EXCEPTION 'Invalid rss_items.firecrawl_status: %', NEW.firecrawl_status;
  END IF;
  RETURN NEW;
END;
$function$;