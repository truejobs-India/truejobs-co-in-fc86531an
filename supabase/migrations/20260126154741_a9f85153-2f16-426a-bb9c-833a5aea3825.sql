-- Add new columns to blog_posts table for enhanced blog functionality
ALTER TABLE public.blog_posts 
ADD COLUMN IF NOT EXISTS category text DEFAULT 'Career Advice',
ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS reading_time integer DEFAULT 5,
ADD COLUMN IF NOT EXISTS featured_image_alt text,
ADD COLUMN IF NOT EXISTS author_name text DEFAULT 'TrueJobs Editorial Team',
ADD COLUMN IF NOT EXISTS faq_schema jsonb,
ADD COLUMN IF NOT EXISTS canonical_url text;

-- Create blog_category enum type for validation (using check constraint)
ALTER TABLE public.blog_posts 
ADD CONSTRAINT blog_posts_category_check 
CHECK (category IN ('Job Search', 'Career Advice', 'Resume', 'Interview', 'HR & Recruitment', 'Hiring Trends', 'AI in Recruitment'));

-- Create index for category filtering
CREATE INDEX IF NOT EXISTS idx_blog_posts_category ON public.blog_posts(category);

-- Create index for published posts ordering
CREATE INDEX IF NOT EXISTS idx_blog_posts_published ON public.blog_posts(is_published, published_at DESC);

-- Create index for slug lookups
CREATE INDEX IF NOT EXISTS idx_blog_posts_slug ON public.blog_posts(slug);