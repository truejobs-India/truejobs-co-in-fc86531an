ALTER TABLE public.blog_posts
  ADD COLUMN IF NOT EXISTS last_bulk_scanned_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS last_bulk_fixed_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS last_bulk_fix_status text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS remaining_auto_fixable_count integer DEFAULT NULL;