
-- ============================================
-- PHASE 1: Government Jobs Infrastructure
-- 6 tables, indexes, triggers, UPSERT, RLS
-- ============================================

-- 1. govt_exams (core table)
CREATE TABLE public.govt_exams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_name text NOT NULL,
  slug text UNIQUE NOT NULL,
  conducting_body text,
  department_slug text,
  exam_category text NOT NULL DEFAULT 'central',
  states text[] DEFAULT '{}',
  total_vacancies integer DEFAULT 0,
  posts jsonb DEFAULT '[]',
  qualification_required text,
  age_limit text,
  age_relaxation text,
  application_fee text,
  salary_range text,
  pay_scale text,
  application_start date,
  application_end date,
  exam_date text,
  admit_card_date text,
  result_date text,
  apply_link text,
  official_notification_url text,
  official_website text,
  notification_pdf_url text,
  exam_pattern jsonb DEFAULT '[]',
  syllabus jsonb DEFAULT '[]',
  selection_stages text,
  how_to_apply text,
  important_dates jsonb DEFAULT '[]',
  faqs jsonb DEFAULT '[]',
  status text NOT NULL DEFAULT 'upcoming',
  is_featured boolean DEFAULT false,
  is_hot boolean DEFAULT false,
  published_date date,
  seo_keywords text[] DEFAULT '{}',
  meta_title text,
  meta_description text,
  seo_content text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. govt_results
CREATE TABLE public.govt_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id uuid REFERENCES public.govt_exams(id) ON DELETE CASCADE NOT NULL,
  result_title text NOT NULL,
  result_date date,
  result_link text,
  cutoff_data jsonb DEFAULT '{}',
  previous_cutoffs jsonb DEFAULT '[]',
  merit_list_url text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3. govt_admit_cards
CREATE TABLE public.govt_admit_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id uuid REFERENCES public.govt_exams(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  release_date date,
  download_link text,
  exam_date text,
  instructions text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 4. govt_answer_keys
CREATE TABLE public.govt_answer_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id uuid REFERENCES public.govt_exams(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  release_date date,
  download_link text,
  objection_deadline date,
  objection_link text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 5. saved_govt_exams
CREATE TABLE public.saved_govt_exams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  exam_id uuid REFERENCES public.govt_exams(id) ON DELETE CASCADE NOT NULL,
  saved_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, exam_id)
);

-- 6. search_queries
CREATE TABLE public.search_queries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  query_text text UNIQUE NOT NULL,
  source text DEFAULT 'web',
  search_count integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX idx_govt_exams_slug ON public.govt_exams(slug);
CREATE INDEX idx_govt_exams_category ON public.govt_exams(exam_category);
CREATE INDEX idx_govt_exams_states ON public.govt_exams USING GIN(states);
CREATE INDEX idx_govt_exams_status ON public.govt_exams(status);
CREATE INDEX idx_govt_exams_app_end ON public.govt_exams(application_end);
CREATE INDEX idx_govt_exams_created_at ON public.govt_exams(created_at DESC);
CREATE INDEX idx_govt_exams_dept_slug ON public.govt_exams(department_slug);
CREATE INDEX idx_search_queries_text ON public.search_queries(query_text);
CREATE INDEX idx_search_queries_count ON public.search_queries(search_count DESC);

-- ============================================
-- TRIGGER: auto-update updated_at on govt_exams
-- ============================================
CREATE TRIGGER update_govt_exams_updated_at
  BEFORE UPDATE ON public.govt_exams
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- UPSERT FUNCTION for search queries
-- ============================================
CREATE OR REPLACE FUNCTION public.upsert_search_query(p_query text, p_source text)
RETURNS void AS $$
INSERT INTO public.search_queries (query_text, source, search_count, created_at, updated_at)
VALUES (p_query, p_source, 1, now(), now())
ON CONFLICT (query_text)
DO UPDATE SET search_count = public.search_queries.search_count + 1, updated_at = now();
$$ LANGUAGE SQL SECURITY DEFINER SET search_path = public;

-- ============================================
-- RLS: Enable on all tables
-- ============================================
ALTER TABLE public.govt_exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.govt_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.govt_admit_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.govt_answer_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_govt_exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.search_queries ENABLE ROW LEVEL SECURITY;

-- govt_exams: public read, admin write
CREATE POLICY "Anyone can view govt exams" ON public.govt_exams FOR SELECT USING (true);
CREATE POLICY "Admins can insert govt exams" ON public.govt_exams FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update govt exams" ON public.govt_exams FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete govt exams" ON public.govt_exams FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- govt_results: public read, admin write
CREATE POLICY "Anyone can view govt results" ON public.govt_results FOR SELECT USING (true);
CREATE POLICY "Admins can insert govt results" ON public.govt_results FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update govt results" ON public.govt_results FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete govt results" ON public.govt_results FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- govt_admit_cards: public read, admin write
CREATE POLICY "Anyone can view govt admit cards" ON public.govt_admit_cards FOR SELECT USING (true);
CREATE POLICY "Admins can insert govt admit cards" ON public.govt_admit_cards FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update govt admit cards" ON public.govt_admit_cards FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete govt admit cards" ON public.govt_admit_cards FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- govt_answer_keys: public read, admin write
CREATE POLICY "Anyone can view govt answer keys" ON public.govt_answer_keys FOR SELECT USING (true);
CREATE POLICY "Admins can insert govt answer keys" ON public.govt_answer_keys FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update govt answer keys" ON public.govt_answer_keys FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete govt answer keys" ON public.govt_answer_keys FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- saved_govt_exams: user-scoped
CREATE POLICY "Users can view saved govt exams" ON public.saved_govt_exams FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can save govt exams" ON public.saved_govt_exams FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can unsave govt exams" ON public.saved_govt_exams FOR DELETE USING (auth.uid() = user_id);

-- search_queries: public read, anyone can call upsert function
CREATE POLICY "Anyone can view search queries" ON public.search_queries FOR SELECT USING (true);
CREATE POLICY "Service role can manage search queries" ON public.search_queries FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
