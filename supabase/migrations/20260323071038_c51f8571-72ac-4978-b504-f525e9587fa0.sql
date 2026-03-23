-- Reset staged items to pending for re-extraction test
UPDATE firecrawl_staged_items SET extraction_status = 'pending' WHERE extraction_status = 'extracted';
-- Delete old draft jobs to re-extract cleanly
DELETE FROM firecrawl_draft_jobs;