ALTER TABLE public.blog_posts DROP CONSTRAINT blog_posts_category_check;

ALTER TABLE public.blog_posts ADD CONSTRAINT blog_posts_category_check CHECK (category = ANY (ARRAY[
  'Job Search', 'Career Advice', 'Resume', 'Interview', 
  'HR & Recruitment', 'Hiring Trends', 'AI in Recruitment',
  'Results & Admit Cards', 'Exam Preparation', 'Sarkari Naukri Basics',
  'Career Guides & Tips', 'Job Information', 'Uncategorized'
]));