ALTER TABLE upload_batches 
  ADD COLUMN IF NOT EXISTS total_chunks integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS completed_chunks integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS extraction_status text DEFAULT 'idle' CHECK (extraction_status IN ('idle', 'extracting', 'completed', 'partial', 'failed')),
  ADD COLUMN IF NOT EXISTS ai_model_used text;