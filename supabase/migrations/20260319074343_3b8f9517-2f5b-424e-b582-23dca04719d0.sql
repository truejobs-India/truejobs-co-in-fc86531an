
-- RSS AI Processing table — stores AI analysis, enrichment, image, and SEO check outputs per rss_item
-- Separate table design to avoid bloating rss_items and keep AI layers cleanly isolated

CREATE TABLE public.rss_ai_processing (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rss_item_id uuid NOT NULL REFERENCES public.rss_items(id) ON DELETE CASCADE,
  
  -- Analysis layer
  analysis_status text NOT NULL DEFAULT 'pending',
  analysis_model text,
  analysis_output jsonb,
  analysis_run_at timestamptz,
  analysis_error text,
  
  -- Enrichment layer
  enrichment_status text NOT NULL DEFAULT 'pending',
  enrichment_model text,
  enrichment_word_limit integer,
  enrichment_output jsonb,
  enrichment_run_at timestamptz,
  enrichment_error text,
  
  -- Image layer
  image_status text NOT NULL DEFAULT 'pending',
  image_model text,
  cover_image_url text,
  image_prompt_used text,
  image_run_at timestamptz,
  image_error text,
  
  -- SEO layer
  seo_check_status text NOT NULL DEFAULT 'pending',
  seo_model text,
  seo_output jsonb,
  seo_score integer,
  seo_run_at timestamptz,
  seo_error text,
  
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  
  UNIQUE(rss_item_id)
);

-- Indexes
CREATE INDEX idx_rss_ai_processing_item ON public.rss_ai_processing (rss_item_id);
CREATE INDEX idx_rss_ai_processing_analysis_status ON public.rss_ai_processing (analysis_status);
CREATE INDEX idx_rss_ai_processing_enrichment_status ON public.rss_ai_processing (enrichment_status);
CREATE INDEX idx_rss_ai_processing_image_status ON public.rss_ai_processing (image_status);
CREATE INDEX idx_rss_ai_processing_seo_status ON public.rss_ai_processing (seo_check_status);

-- Validation trigger
CREATE OR REPLACE FUNCTION public.validate_rss_ai_processing_fields()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path TO 'public'
AS $function$
DECLARE
  valid_statuses text[] := ARRAY['pending', 'running', 'completed', 'failed', 'skipped'];
BEGIN
  IF NEW.analysis_status IS NOT NULL AND NOT (NEW.analysis_status = ANY(valid_statuses)) THEN
    RAISE EXCEPTION 'Invalid analysis_status: %', NEW.analysis_status;
  END IF;
  IF NEW.enrichment_status IS NOT NULL AND NOT (NEW.enrichment_status = ANY(valid_statuses)) THEN
    RAISE EXCEPTION 'Invalid enrichment_status: %', NEW.enrichment_status;
  END IF;
  IF NEW.image_status IS NOT NULL AND NOT (NEW.image_status = ANY(valid_statuses)) THEN
    RAISE EXCEPTION 'Invalid image_status: %', NEW.image_status;
  END IF;
  IF NEW.seo_check_status IS NOT NULL AND NOT (NEW.seo_check_status = ANY(valid_statuses)) THEN
    RAISE EXCEPTION 'Invalid seo_check_status: %', NEW.seo_check_status;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER trg_validate_rss_ai_processing
BEFORE INSERT OR UPDATE ON public.rss_ai_processing
FOR EACH ROW EXECUTE FUNCTION public.validate_rss_ai_processing_fields();

-- Updated_at trigger
CREATE TRIGGER set_rss_ai_processing_updated_at
BEFORE UPDATE ON public.rss_ai_processing
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.rss_ai_processing ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access on rss_ai_processing"
ON public.rss_ai_processing FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));
