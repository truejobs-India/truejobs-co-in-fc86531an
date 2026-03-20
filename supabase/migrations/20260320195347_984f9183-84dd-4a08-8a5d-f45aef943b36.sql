
CREATE TABLE public.blog_enrichment_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL,
  article_id uuid NOT NULL,
  article_title text NOT NULL,
  article_slug text NOT NULL,
  original_content text NOT NULL,
  original_word_count integer NOT NULL DEFAULT 0,
  proposed_content text,
  proposed_word_count integer NOT NULL DEFAULT 0,
  target_word_count integer NOT NULL,
  word_count_delta integer GENERATED ALWAYS AS (proposed_word_count - target_word_count) STORED,
  status text NOT NULL DEFAULT 'pending_review',
  model_used text,
  error_message text,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.blog_enrichment_proposals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage enrichment proposals"
  ON public.blog_enrichment_proposals FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_bep_batch ON public.blog_enrichment_proposals(batch_id);
CREATE INDEX idx_bep_status ON public.blog_enrichment_proposals(status);
