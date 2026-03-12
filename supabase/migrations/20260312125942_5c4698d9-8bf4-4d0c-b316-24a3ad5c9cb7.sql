ALTER TABLE public.seo_page_cache ADD COLUMN IF NOT EXISTS head_html text;
ALTER TABLE public.seo_page_cache ADD COLUMN IF NOT EXISTS body_html text;