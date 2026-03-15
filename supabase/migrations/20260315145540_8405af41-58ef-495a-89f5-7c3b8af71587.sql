ALTER TABLE public.blog_posts DROP CONSTRAINT blog_posts_category_check;
ALTER TABLE public.blog_posts ADD CONSTRAINT blog_posts_category_check CHECK (category = ANY (ARRAY[
  'Job Search'::text,
  'Career Advice'::text,
  'Resume'::text,
  'Interview'::text,
  'HR & Recruitment'::text,
  'Hiring Trends'::text,
  'AI in Recruitment'::text,
  'Results & Admit Cards'::text,
  'Exam Preparation'::text,
  'Sarkari Naukri Basics'::text,
  'Career Guides & Tips'::text,
  'Job Information'::text,
  'Uncategorized'::text,
  'Government Jobs'::text,
  'Syllabus'::text,
  'Current Affairs'::text,
  'Admit Cards'::text
]));