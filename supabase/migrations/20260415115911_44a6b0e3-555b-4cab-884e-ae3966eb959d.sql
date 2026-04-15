ALTER TABLE public.blog_posts
  ADD COLUMN IF NOT EXISTS show_on_homepage boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_blog_posts_homepage
  ON public.blog_posts (show_on_homepage, published_at DESC)
  WHERE is_published = true AND show_on_homepage = true;