-- Add company_name column for scraped jobs without a company record
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS company_name text;

-- Backfill existing scraped jobs by extracting company name from description
UPDATE public.jobs
SET company_name = SUBSTRING(description FROM '\*\*Company:\*\* ([^\n]+)')
WHERE source = 'scraped' AND company_name IS NULL AND description LIKE '**Company:**%';