-- Fix storage policies: use explicit alias to avoid 'name' resolving to companies.name
DROP POLICY IF EXISTS "Company owners can upload assets" ON storage.objects;
DROP POLICY IF EXISTS "Company owners can update assets" ON storage.objects;
DROP POLICY IF EXISTS "Company owners can delete assets" ON storage.objects;

CREATE POLICY "Company owners can upload assets"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'company-assets'
  AND EXISTS (
    SELECT 1 FROM public.companies c
    WHERE c.owner_id = auth.uid()
      AND c.id::text = (storage.foldername(storage.objects.name))[1]
  )
);

CREATE POLICY "Company owners can update assets"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'company-assets'
  AND EXISTS (
    SELECT 1 FROM public.companies c
    WHERE c.owner_id = auth.uid()
      AND c.id::text = (storage.foldername(storage.objects.name))[1]
  )
);

CREATE POLICY "Company owners can delete assets"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'company-assets'
  AND EXISTS (
    SELECT 1 FROM public.companies c
    WHERE c.owner_id = auth.uid()
      AND c.id::text = (storage.foldername(storage.objects.name))[1]
  )
);