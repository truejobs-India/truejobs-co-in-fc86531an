
-- Fix search_path on new validation functions
CREATE OR REPLACE FUNCTION public.validate_azure_emp_news_issues()
RETURNS trigger LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.ocr_status NOT IN ('pending','processing','partially_completed','completed','failed') THEN
    RAISE EXCEPTION 'Invalid ocr_status: %', NEW.ocr_status;
  END IF;
  IF NEW.reconstruction_status NOT IN ('pending','processing','completed','failed') THEN
    RAISE EXCEPTION 'Invalid reconstruction_status: %', NEW.reconstruction_status;
  END IF;
  IF NEW.ai_status NOT IN ('pending','processing','completed','failed') THEN
    RAISE EXCEPTION 'Invalid ai_status: %', NEW.ai_status;
  END IF;
  IF NEW.publish_status NOT IN ('pending','partially_published','published') THEN
    RAISE EXCEPTION 'Invalid publish_status: %', NEW.publish_status;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_azure_emp_news_pages()
RETURNS trigger LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.ocr_status NOT IN ('pending','processing','completed','failed') THEN
    RAISE EXCEPTION 'Invalid ocr_status: %', NEW.ocr_status;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_azure_emp_news_fragments()
RETURNS trigger LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.fragment_type NOT IN ('job_notice','admission','editorial','advertisement','unknown','continuation') THEN
    RAISE EXCEPTION 'Invalid fragment_type: %', NEW.fragment_type;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_azure_emp_news_reconstructed_notices()
RETURNS trigger LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.ai_status NOT IN ('pending','processing','completed','failed') THEN
    RAISE EXCEPTION 'Invalid ai_status: %', NEW.ai_status;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_azure_emp_news_draft_jobs()
RETURNS trigger LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.validation_status NOT IN ('pending','passed','failed','review_needed') THEN
    RAISE EXCEPTION 'Invalid validation_status: %', NEW.validation_status;
  END IF;
  IF NEW.publish_status NOT IN ('draft','published','failed') THEN
    RAISE EXCEPTION 'Invalid publish_status: %', NEW.publish_status;
  END IF;
  RETURN NEW;
END;
$$;
