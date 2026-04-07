
ALTER TABLE blog_posts
  ADD COLUMN IF NOT EXISTS content_mode text NOT NULL DEFAULT 'article',
  ADD COLUMN IF NOT EXISTS page_template text,
  ADD COLUMN IF NOT EXISTS primary_keyword text,
  ADD COLUMN IF NOT EXISTS secondary_keywords text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS search_intent text,
  ADD COLUMN IF NOT EXISTS target_exam text,
  ADD COLUMN IF NOT EXISTS target_state text,
  ADD COLUMN IF NOT EXISTS target_department text,
  ADD COLUMN IF NOT EXISTS target_category text,
  ADD COLUMN IF NOT EXISTS target_language text,
  ADD COLUMN IF NOT EXISTS target_year text,
  ADD COLUMN IF NOT EXISTS duplicate_risk_score integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS duplicate_risk_reason text,
  ADD COLUMN IF NOT EXISTS thin_content_risk boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS thin_content_reason text,
  ADD COLUMN IF NOT EXISTS fact_confidence text DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS official_source_url text,
  ADD COLUMN IF NOT EXISTS official_source_label text,
  ADD COLUMN IF NOT EXISTS source_evidence jsonb DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS last_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS stale_after timestamptz,
  ADD COLUMN IF NOT EXISTS needs_revalidation boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS review_status text DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS long_tail_metadata jsonb DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS noindex boolean DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_blog_posts_content_mode ON blog_posts (content_mode);
CREATE INDEX IF NOT EXISTS idx_blog_posts_page_template ON blog_posts (page_template) WHERE page_template IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_blog_posts_primary_keyword ON blog_posts (primary_keyword) WHERE primary_keyword IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_blog_posts_needs_revalidation ON blog_posts (needs_revalidation) WHERE needs_revalidation = true;
CREATE INDEX IF NOT EXISTS idx_blog_posts_review_status ON blog_posts (review_status) WHERE review_status != 'none';
CREATE INDEX IF NOT EXISTS idx_blog_posts_stale_after ON blog_posts (stale_after) WHERE stale_after IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_blog_posts_noindex ON blog_posts (noindex) WHERE noindex = true;
