
ALTER TABLE employment_news_jobs ADD COLUMN IF NOT EXISTS enriched_title text;
ALTER TABLE employment_news_jobs ADD COLUMN IF NOT EXISTS keywords text[];
ALTER TABLE employment_news_jobs ADD COLUMN IF NOT EXISTS meta_title text;
ALTER TABLE employment_news_jobs ADD COLUMN IF NOT EXISTS meta_description text;
ALTER TABLE employment_news_jobs ADD COLUMN IF NOT EXISTS slug text UNIQUE;
ALTER TABLE employment_news_jobs ADD COLUMN IF NOT EXISTS schema_markup jsonb;
ALTER TABLE employment_news_jobs ADD COLUMN IF NOT EXISTS faq_html text;
ALTER TABLE upload_batches ADD COLUMN IF NOT EXISTS new_count integer DEFAULT 0;
ALTER TABLE upload_batches ADD COLUMN IF NOT EXISTS updated_count integer DEFAULT 0;
