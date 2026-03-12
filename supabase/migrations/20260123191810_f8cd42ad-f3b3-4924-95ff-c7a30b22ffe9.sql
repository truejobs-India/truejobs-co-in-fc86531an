-- Drop the SECURITY DEFINER view as it causes security warnings
-- We'll use the RPC function approach instead for applicants
DROP VIEW IF EXISTS public.applicant_applications;