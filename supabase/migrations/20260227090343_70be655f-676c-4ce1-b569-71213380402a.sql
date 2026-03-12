
-- Create blog-assets storage bucket for cover images and in-article images
INSERT INTO storage.buckets (id, name, public)
VALUES ('blog-assets', 'blog-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access
CREATE POLICY "Blog assets are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'blog-assets');

-- Allow admins to upload blog assets
CREATE POLICY "Admins can upload blog assets"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'blog-assets' AND public.has_role(auth.uid(), 'admin'::public.app_role));

-- Allow admins to update blog assets
CREATE POLICY "Admins can update blog assets"
ON storage.objects FOR UPDATE
USING (bucket_id = 'blog-assets' AND public.has_role(auth.uid(), 'admin'::public.app_role));

-- Allow admins to delete blog assets
CREATE POLICY "Admins can delete blog assets"
ON storage.objects FOR DELETE
USING (bucket_id = 'blog-assets' AND public.has_role(auth.uid(), 'admin'::public.app_role));
