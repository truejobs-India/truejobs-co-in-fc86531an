
-- ============================================================
-- PDF Resources System: Tables, RLS, Trigger, RPC, Indexes
-- ============================================================

-- 1. pdf_resources table
CREATE TABLE public.pdf_resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_type text NOT NULL CHECK (resource_type IN ('sample_paper', 'book', 'previous_year_paper')),
  title text NOT NULL,
  slug text NOT NULL UNIQUE,
  download_filename text,
  file_url text,
  file_size_bytes bigint,
  page_count integer,
  file_hash text,
  cover_image_url text,
  featured_image_alt text,
  content text NOT NULL DEFAULT '',
  excerpt text,
  meta_title text,
  meta_description text,
  faq_schema jsonb DEFAULT '[]',
  category text,
  exam_name text,
  subject text,
  language text DEFAULT 'hindi',
  exam_year integer,
  edition_year integer,
  tags text[] DEFAULT '{}',
  status text DEFAULT 'draft' CHECK (status IN ('draft','generated','ready_for_review','published','archived')),
  is_featured boolean DEFAULT false,
  is_trending boolean DEFAULT false,
  is_published boolean DEFAULT false,
  is_noindex boolean DEFAULT false,
  duplicate_approved boolean DEFAULT false,
  review_notes text,
  published_at timestamptz,
  download_count integer DEFAULT 0,
  cta_click_count integer DEFAULT 0,
  final_download_count integer DEFAULT 0,
  word_count integer DEFAULT 0,
  reading_time integer DEFAULT 5,
  ai_model_used text,
  ai_generated_at timestamptz,
  image_model_used text,
  content_hash text,
  author_id uuid NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX idx_pdf_resources_type_status ON public.pdf_resources(resource_type, status);
CREATE INDEX idx_pdf_resources_category ON public.pdf_resources(category);
CREATE INDEX idx_pdf_resources_slug ON public.pdf_resources(slug);
CREATE INDEX idx_pdf_resources_file_hash ON public.pdf_resources(file_hash);
CREATE INDEX idx_pdf_resources_content_hash ON public.pdf_resources(content_hash);

-- RLS
ALTER TABLE public.pdf_resources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Published resources viewable by everyone"
  ON public.pdf_resources FOR SELECT USING (is_published = true);

CREATE POLICY "Admins can manage resources"
  ON public.pdf_resources FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Auto updated_at trigger (reuse existing function)
CREATE TRIGGER set_pdf_resources_updated_at
  BEFORE UPDATE ON public.pdf_resources
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. resource_events table (append-only, NO updated_at)
CREATE TABLE public.resource_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id uuid REFERENCES public.pdf_resources(id) ON DELETE CASCADE NOT NULL,
  event_type text NOT NULL CHECK (event_type IN (
    'page_view','cta_click','whatsapp_click','telegram_click','email_submit','final_download'
  )),
  user_agent text,
  referrer text,
  created_at timestamptz DEFAULT now()
);

-- RLS - NO public INSERT. Only admin SELECT. Inserts go through RPC.
ALTER TABLE public.resource_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read events"
  ON public.resource_events FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 3. Secure RPC for event logging
CREATE OR REPLACE FUNCTION public.log_resource_event(
  p_resource_id uuid,
  p_event_type text,
  p_user_agent text DEFAULT NULL,
  p_referrer text DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Validate event_type server-side
  IF p_event_type NOT IN ('page_view','cta_click','whatsapp_click','telegram_click','email_submit','final_download') THEN
    RAISE EXCEPTION 'Invalid event type: %', p_event_type;
  END IF;

  -- Validate resource exists and is published
  IF NOT EXISTS (SELECT 1 FROM pdf_resources WHERE id = p_resource_id AND is_published = true) THEN
    RETURN;
  END IF;

  -- Insert event with truncated inputs
  INSERT INTO resource_events (resource_id, event_type, user_agent, referrer)
  VALUES (p_resource_id, p_event_type, LEFT(p_user_agent, 500), LEFT(p_referrer, 500));

  -- Update aggregate counters
  IF p_event_type = 'cta_click' THEN
    UPDATE pdf_resources SET cta_click_count = cta_click_count + 1 WHERE id = p_resource_id;
  ELSIF p_event_type = 'final_download' THEN
    UPDATE pdf_resources SET final_download_count = final_download_count + 1, download_count = download_count + 1 WHERE id = p_resource_id;
  END IF;
END; $$;
