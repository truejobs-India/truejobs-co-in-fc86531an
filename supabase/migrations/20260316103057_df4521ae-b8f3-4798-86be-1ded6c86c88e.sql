
-- Step 1: Create import_batches table
CREATE TABLE public.import_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_file_name text NOT NULL,
  total_rows integer NOT NULL DEFAULT 0,
  completed_count integer NOT NULL DEFAULT 0,
  failed_count integer NOT NULL DEFAULT 0,
  published_count integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  started_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  completed_at timestamp with time zone
);

-- Add validation trigger for status instead of CHECK constraint
CREATE OR REPLACE FUNCTION public.validate_import_batch_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status NOT IN ('pending', 'in_progress', 'completed', 'failed') THEN
    RAISE EXCEPTION 'Invalid import_batches status: %', NEW.status;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_import_batch_status
  BEFORE INSERT OR UPDATE ON public.import_batches
  FOR EACH ROW EXECUTE FUNCTION public.validate_import_batch_status();

-- RLS
ALTER TABLE public.import_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage import batches"
  ON public.import_batches FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Step 2: Extend custom_pages with board result columns
ALTER TABLE public.custom_pages
  ADD COLUMN IF NOT EXISTS state_ut text,
  ADD COLUMN IF NOT EXISTS board_name text,
  ADD COLUMN IF NOT EXISTS result_url text,
  ADD COLUMN IF NOT EXISTS official_board_url text,
  ADD COLUMN IF NOT EXISTS result_variant text,
  ADD COLUMN IF NOT EXISTS import_batch_id uuid REFERENCES public.import_batches(id),
  ADD COLUMN IF NOT EXISTS source_row_index integer,
  ADD COLUMN IF NOT EXISTS generation_metadata jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS qa_notes text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS internal_links jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS source_payload jsonb;

-- Validation trigger for result_variant
CREATE OR REPLACE FUNCTION public.validate_result_variant()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.result_variant IS NOT NULL AND NEW.result_variant NOT IN ('main', 'class-10', 'class-12', 'supplementary', 'revaluation') THEN
    RAISE EXCEPTION 'Invalid result_variant: %', NEW.result_variant;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_result_variant
  BEFORE INSERT OR UPDATE ON public.custom_pages
  FOR EACH ROW EXECUTE FUNCTION public.validate_result_variant();

-- Unique index on (import_batch_id, source_row_index) where both non-null
CREATE UNIQUE INDEX IF NOT EXISTS idx_custom_pages_batch_row
  ON public.custom_pages (import_batch_id, source_row_index)
  WHERE import_batch_id IS NOT NULL AND source_row_index IS NOT NULL;

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_custom_pages_page_type ON public.custom_pages (page_type);
CREATE INDEX IF NOT EXISTS idx_custom_pages_status ON public.custom_pages (status);
CREATE INDEX IF NOT EXISTS idx_custom_pages_import_batch ON public.custom_pages (import_batch_id) WHERE import_batch_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_custom_pages_result_variant ON public.custom_pages (result_variant) WHERE result_variant IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_custom_pages_state_ut ON public.custom_pages (state_ut) WHERE state_ut IS NOT NULL;
