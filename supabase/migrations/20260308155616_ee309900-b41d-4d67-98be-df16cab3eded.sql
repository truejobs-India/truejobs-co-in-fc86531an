
CREATE TABLE public.content_enrichments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_slug text NOT NULL,
  page_type text NOT NULL,
  current_word_count integer DEFAULT 0,
  current_section_count integer DEFAULT 0,
  enrichment_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'draft',
  sections_added text[] DEFAULT '{}',
  internal_links_added text[] DEFAULT '{}',
  quality_score jsonb DEFAULT '{}',
  flags text[] DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(page_slug)
);

ALTER TABLE public.content_enrichments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage enrichments"
  ON public.content_enrichments FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
