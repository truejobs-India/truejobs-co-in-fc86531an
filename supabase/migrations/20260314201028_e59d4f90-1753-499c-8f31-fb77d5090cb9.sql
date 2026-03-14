
CREATE TABLE public.custom_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  slug text NOT NULL UNIQUE,
  content text NOT NULL DEFAULT '',
  excerpt text,
  meta_title text,
  meta_description text,
  category text DEFAULT 'general',
  tags text[] DEFAULT '{}',
  faq_schema jsonb DEFAULT '[]'::jsonb,
  schema_json text,
  cover_image_url text,
  featured_image_alt text,
  canonical_url text,
  word_count integer DEFAULT 0,
  reading_time integer DEFAULT 1,
  language varchar DEFAULT 'hi',
  page_type text DEFAULT 'landing' CHECK (page_type IN ('landing', 'guide', 'resource', 'comparison')),
  status text DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  is_published boolean DEFAULT false,
  published_at timestamptz,
  ai_model_used text,
  ai_generated_at timestamptz,
  author_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.custom_pages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage custom pages" ON public.custom_pages
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Published custom pages are viewable by everyone" ON public.custom_pages
  FOR SELECT TO public
  USING (is_published = true);
