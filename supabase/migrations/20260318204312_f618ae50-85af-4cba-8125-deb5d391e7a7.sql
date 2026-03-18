-- RSS Taxonomy Upgrade: Add primary_domain and display_group to rss_items and monitoring_review_queue
-- Expand item_type values, update validation triggers, backfill existing data

-- 1. Add columns to rss_items
ALTER TABLE public.rss_items
  ADD COLUMN IF NOT EXISTS primary_domain text NOT NULL DEFAULT 'general_alerts',
  ADD COLUMN IF NOT EXISTS display_group text NOT NULL DEFAULT 'General Alerts';

-- 2. Add columns to monitoring_review_queue
ALTER TABLE public.monitoring_review_queue
  ADD COLUMN IF NOT EXISTS primary_domain text,
  ADD COLUMN IF NOT EXISTS display_group text;

-- 3. Add indexes
CREATE INDEX IF NOT EXISTS idx_rss_items_primary_domain ON public.rss_items (primary_domain);
CREATE INDEX IF NOT EXISTS idx_rss_items_display_group ON public.rss_items (display_group);
CREATE INDEX IF NOT EXISTS idx_mrq_primary_domain ON public.monitoring_review_queue (primary_domain);

-- 4. Update validate_rss_items_fields trigger function
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
  RETURN NEW;
END; $function$;