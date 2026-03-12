CREATE TABLE public.saved_gov_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  gov_job_id UUID NOT NULL REFERENCES public.gov_jobs(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'interested' CHECK (status IN ('interested', 'applied')),
  saved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, gov_job_id)
);

ALTER TABLE public.saved_gov_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own saved gov jobs" ON public.saved_gov_jobs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can save gov jobs" ON public.saved_gov_jobs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own saved gov jobs" ON public.saved_gov_jobs FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own saved gov jobs" ON public.saved_gov_jobs FOR DELETE USING (auth.uid() = user_id);