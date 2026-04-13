
-- Add real scoring and skip reason columns to rss_items
ALTER TABLE rss_items ADD COLUMN IF NOT EXISTS truejobs_relevance_score smallint DEFAULT 0;
ALTER TABLE rss_items ADD COLUMN IF NOT EXISTS skip_reason text DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_rss_items_truejobs_score ON rss_items (truejobs_relevance_score);
CREATE INDEX IF NOT EXISTS idx_rss_items_skip_reason ON rss_items (skip_reason) WHERE skip_reason IS NOT NULL;

-- Add source usefulness tracking columns to rss_sources
ALTER TABLE rss_sources ADD COLUMN IF NOT EXISTS usefulness_score smallint DEFAULT 50;
ALTER TABLE rss_sources ADD COLUMN IF NOT EXISTS total_items_ingested integer DEFAULT 0;
ALTER TABLE rss_sources ADD COLUMN IF NOT EXISTS core_items_count integer DEFAULT 0;
ALTER TABLE rss_sources ADD COLUMN IF NOT EXISTS noise_items_count integer DEFAULT 0;
