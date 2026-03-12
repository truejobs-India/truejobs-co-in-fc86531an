ALTER TABLE public.govt_exams ADD COLUMN IF NOT EXISTS selection_type text;

CREATE INDEX IF NOT EXISTS idx_govt_exams_selection_type ON public.govt_exams(selection_type);