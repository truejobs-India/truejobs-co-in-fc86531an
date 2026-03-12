
-- Structured age fields
ALTER TABLE govt_exams ADD COLUMN IF NOT EXISTS min_age integer DEFAULT 18;
ALTER TABLE govt_exams ADD COLUMN IF NOT EXISTS max_age_gen integer;
ALTER TABLE govt_exams ADD COLUMN IF NOT EXISTS max_age_obc integer;
ALTER TABLE govt_exams ADD COLUMN IF NOT EXISTS max_age_scst integer;
ALTER TABLE govt_exams ADD COLUMN IF NOT EXISTS max_age_ph integer;
ALTER TABLE govt_exams ADD COLUMN IF NOT EXISTS max_age_exservicemen integer;

-- Qualification + scope
ALTER TABLE govt_exams ADD COLUMN IF NOT EXISTS qualification_tags text[] DEFAULT '{}';
ALTER TABLE govt_exams ADD COLUMN IF NOT EXISTS exam_scope text DEFAULT 'all_india';

-- Structured fees
ALTER TABLE govt_exams ADD COLUMN IF NOT EXISTS fee_gen integer;
ALTER TABLE govt_exams ADD COLUMN IF NOT EXISTS fee_obc integer;
ALTER TABLE govt_exams ADD COLUMN IF NOT EXISTS fee_sc integer;
ALTER TABLE govt_exams ADD COLUMN IF NOT EXISTS fee_st integer;
ALTER TABLE govt_exams ADD COLUMN IF NOT EXISTS fee_female integer;

-- Attempt limits
ALTER TABLE govt_exams ADD COLUMN IF NOT EXISTS max_attempts_gen integer;
ALTER TABLE govt_exams ADD COLUMN IF NOT EXISTS max_attempts_obc integer;
ALTER TABLE govt_exams ADD COLUMN IF NOT EXISTS max_attempts_scst integer;

-- Tracking
ALTER TABLE govt_exams ADD COLUMN IF NOT EXISTS exam_year integer;
ALTER TABLE govt_exams ADD COLUMN IF NOT EXISTS notification_month integer;

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_exam_status ON govt_exams(status);
CREATE INDEX IF NOT EXISTS idx_exam_year ON govt_exams(exam_year);
CREATE INDEX IF NOT EXISTS idx_exam_qualification_tags ON govt_exams USING GIN(qualification_tags);
CREATE INDEX IF NOT EXISTS idx_exam_status_scope ON govt_exams(status, exam_scope);
CREATE INDEX IF NOT EXISTS idx_exam_notification ON govt_exams(notification_month, exam_year);
