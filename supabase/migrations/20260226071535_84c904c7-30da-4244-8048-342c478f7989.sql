
-- Fix the INSERT policy: foldername should reference the object's name (file path), not companies.name
DROP POLICY IF EXISTS "Company owners can upload assets" ON storage.objects;
CREATE POLICY "Company owners can upload assets"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'company-assets'
  AND EXISTS (
    SELECT 1 FROM public.companies
    WHERE companies.owner_id = auth.uid()
      AND companies.id::text = (storage.foldername(name))[1]
  )
);

-- Fix UPDATE policy with the same issue
DROP POLICY IF EXISTS "Company owners can update assets" ON storage.objects;
CREATE POLICY "Company owners can update assets"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'company-assets'
  AND EXISTS (
    SELECT 1 FROM public.companies
    WHERE companies.owner_id = auth.uid()
      AND companies.id::text = (storage.foldername(name))[1]
  )
);

-- Fix DELETE policy too
DROP POLICY IF EXISTS "Company owners can delete assets" ON storage.objects;
CREATE POLICY "Company owners can delete assets"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'company-assets'
  AND EXISTS (
    SELECT 1 FROM public.companies
    WHERE companies.owner_id = auth.uid()
      AND companies.id::text = (storage.foldername(name))[1]
  )
);
