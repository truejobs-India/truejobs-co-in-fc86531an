
-- Table to persist every row from Excel upload immediately, preventing data loss
CREATE TABLE public.board_result_batch_rows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES public.import_batches(id) ON DELETE CASCADE,
  row_index integer NOT NULL,
  state_ut text NOT NULL,
  board_name text NOT NULL,
  result_url text NOT NULL DEFAULT '',
  official_board_url text NOT NULL DEFAULT '',
  seo_intro_text text DEFAULT '',
  slug text NOT NULL,
  variant text NOT NULL DEFAULT 'main',
  board_abbr text NOT NULL DEFAULT '',
  is_valid boolean NOT NULL DEFAULT true,
  validation_errors text[] DEFAULT '{}',
  generation_status text NOT NULL DEFAULT 'queued',
  generated_page_id uuid REFERENCES public.custom_pages(id) ON DELETE SET NULL,
  error_message text,
  qa_notes text[] DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(batch_id, row_index),
  UNIQUE(batch_id, slug)
);

-- RLS
ALTER TABLE public.board_result_batch_rows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage batch rows"
  ON public.board_result_batch_rows
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Index for fast lookups
CREATE INDEX idx_batch_rows_batch_id ON public.board_result_batch_rows(batch_id);
CREATE INDEX idx_batch_rows_slug ON public.board_result_batch_rows(slug);
