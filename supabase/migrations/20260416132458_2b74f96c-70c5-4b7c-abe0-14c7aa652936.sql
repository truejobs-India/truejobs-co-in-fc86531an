ALTER TABLE intake_drafts ADD COLUMN IF NOT EXISTS source_channel text DEFAULT 'intake';
ALTER TABLE intake_drafts ADD COLUMN IF NOT EXISTS section_bucket text;
ALTER TABLE intake_drafts ADD COLUMN IF NOT EXISTS import_source_sheet text;
ALTER TABLE intake_drafts ADD COLUMN IF NOT EXISTS import_row_number integer;