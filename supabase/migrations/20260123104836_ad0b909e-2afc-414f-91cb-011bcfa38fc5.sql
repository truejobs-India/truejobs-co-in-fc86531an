-- Create enum for target audience
CREATE TYPE public.target_audience AS ENUM ('candidate', 'employer', 'all');

-- Create enum for poll/contest/survey status
CREATE TYPE public.engagement_status AS ENUM ('draft', 'active', 'closed', 'archived');

-- ================== POLLS ==================
CREATE TABLE public.polls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    target_audience target_audience NOT NULL DEFAULT 'all',
    status engagement_status NOT NULL DEFAULT 'draft',
    starts_at TIMESTAMP WITH TIME ZONE,
    ends_at TIMESTAMP WITH TIME ZONE,
    is_results_public BOOLEAN NOT NULL DEFAULT false,
    results_shared_at TIMESTAMP WITH TIME ZONE,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.poll_options (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    poll_id UUID NOT NULL REFERENCES public.polls(id) ON DELETE CASCADE,
    option_text TEXT NOT NULL,
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.poll_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    poll_id UUID NOT NULL REFERENCES public.polls(id) ON DELETE CASCADE,
    option_id UUID NOT NULL REFERENCES public.poll_options(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(poll_id, user_id)
);

-- ================== CONTESTS ==================
CREATE TABLE public.contests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    rules TEXT,
    prizes TEXT,
    target_audience target_audience NOT NULL DEFAULT 'all',
    status engagement_status NOT NULL DEFAULT 'draft',
    starts_at TIMESTAMP WITH TIME ZONE,
    ends_at TIMESTAMP WITH TIME ZONE,
    max_entries INTEGER,
    is_results_public BOOLEAN NOT NULL DEFAULT false,
    results_shared_at TIMESTAMP WITH TIME ZONE,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.contest_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contest_id UUID NOT NULL REFERENCES public.contests(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    submission_text TEXT,
    submission_url TEXT,
    score INTEGER,
    is_winner BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(contest_id, user_id)
);

-- ================== SURVEYS ==================
CREATE TABLE public.surveys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    target_audience target_audience NOT NULL DEFAULT 'all',
    status engagement_status NOT NULL DEFAULT 'draft',
    is_paid BOOLEAN NOT NULL DEFAULT false,
    reward_amount NUMERIC(10,2),
    reward_currency TEXT DEFAULT 'INR',
    starts_at TIMESTAMP WITH TIME ZONE,
    ends_at TIMESTAMP WITH TIME ZONE,
    is_results_public BOOLEAN NOT NULL DEFAULT false,
    results_shared_at TIMESTAMP WITH TIME ZONE,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.survey_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    survey_id UUID NOT NULL REFERENCES public.surveys(id) ON DELETE CASCADE,
    question_text TEXT NOT NULL,
    question_type TEXT NOT NULL DEFAULT 'text', -- text, single_choice, multiple_choice, rating
    options JSONB, -- for choice questions
    is_required BOOLEAN NOT NULL DEFAULT true,
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.survey_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    survey_id UUID NOT NULL REFERENCES public.surveys(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    answers JSONB NOT NULL, -- { question_id: answer }
    is_paid_out BOOLEAN DEFAULT false,
    paid_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(survey_id, user_id)
);

-- ================== RLS POLICIES ==================

-- Enable RLS on all tables
ALTER TABLE public.polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contest_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.surveys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.survey_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.survey_responses ENABLE ROW LEVEL SECURITY;

-- Polls policies
CREATE POLICY "Admins can manage polls" ON public.polls
    FOR ALL USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Active polls are viewable by authenticated users" ON public.polls
    FOR SELECT USING (status = 'active' AND auth.uid() IS NOT NULL);

-- Poll options policies
CREATE POLICY "Admins can manage poll options" ON public.poll_options
    FOR ALL USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Poll options are viewable for active polls" ON public.poll_options
    FOR SELECT USING (
        poll_id IN (SELECT id FROM public.polls WHERE status = 'active')
        AND auth.uid() IS NOT NULL
    );

-- Poll responses policies
CREATE POLICY "Admins can view all poll responses" ON public.poll_responses
    FOR SELECT USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can submit poll responses" ON public.poll_responses
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own poll responses" ON public.poll_responses
    FOR SELECT USING (auth.uid() = user_id);

-- Contests policies
CREATE POLICY "Admins can manage contests" ON public.contests
    FOR ALL USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Active contests are viewable by authenticated users" ON public.contests
    FOR SELECT USING (status = 'active' AND auth.uid() IS NOT NULL);

-- Contest entries policies
CREATE POLICY "Admins can manage contest entries" ON public.contest_entries
    FOR ALL USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can submit contest entries" ON public.contest_entries
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own contest entries" ON public.contest_entries
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own contest entries" ON public.contest_entries
    FOR UPDATE USING (auth.uid() = user_id);

-- Surveys policies
CREATE POLICY "Admins can manage surveys" ON public.surveys
    FOR ALL USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Active surveys are viewable by authenticated users" ON public.surveys
    FOR SELECT USING (status = 'active' AND auth.uid() IS NOT NULL);

-- Survey questions policies
CREATE POLICY "Admins can manage survey questions" ON public.survey_questions
    FOR ALL USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Survey questions are viewable for active surveys" ON public.survey_questions
    FOR SELECT USING (
        survey_id IN (SELECT id FROM public.surveys WHERE status = 'active')
        AND auth.uid() IS NOT NULL
    );

-- Survey responses policies
CREATE POLICY "Admins can view all survey responses" ON public.survey_responses
    FOR SELECT USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update survey responses" ON public.survey_responses
    FOR UPDATE USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can submit survey responses" ON public.survey_responses
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own survey responses" ON public.survey_responses
    FOR SELECT USING (auth.uid() = user_id);

-- ================== TRIGGERS ==================
CREATE TRIGGER update_polls_updated_at
    BEFORE UPDATE ON public.polls
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_contests_updated_at
    BEFORE UPDATE ON public.contests
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_surveys_updated_at
    BEFORE UPDATE ON public.surveys
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_contest_entries_updated_at
    BEFORE UPDATE ON public.contest_entries
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();