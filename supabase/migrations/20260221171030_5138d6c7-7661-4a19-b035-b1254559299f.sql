CREATE TABLE public.seo_page_cache (
  slug TEXT PRIMARY KEY,
  full_html TEXT NOT NULL,
  page_type TEXT NOT NULL DEFAULT 'generic',
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Allow edge functions to read/write via service role (no RLS needed for server-only table)
ALTER TABLE public.seo_page_cache ENABLE ROW LEVEL SECURITY;

-- Public read for the prerender-proxy (uses anon key)
CREATE POLICY "Allow public read of seo cache" ON public.seo_page_cache
  FOR SELECT USING (true);

-- Service role handles inserts/updates (no policy needed, bypasses RLS)