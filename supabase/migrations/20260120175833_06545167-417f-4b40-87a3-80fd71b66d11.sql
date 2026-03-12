-- =============================================
-- JOB PORTAL DATABASE SCHEMA
-- =============================================

-- 1. Create enum types
CREATE TYPE public.app_role AS ENUM ('job_seeker', 'employer', 'admin');
CREATE TYPE public.job_type AS ENUM ('full_time', 'part_time', 'contract', 'internship', 'remote');
CREATE TYPE public.experience_level AS ENUM ('fresher', 'junior', 'mid', 'senior', 'lead', 'executive');
CREATE TYPE public.application_status AS ENUM ('applied', 'viewed', 'shortlisted', 'interviewing', 'offered', 'rejected', 'withdrawn');
CREATE TYPE public.job_status AS ENUM ('draft', 'pending_approval', 'active', 'paused', 'closed', 'expired');
CREATE TYPE public.job_source AS ENUM ('manual', 'scraped');

-- 2. User Roles Table (Critical for security - separate from profiles)
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL DEFAULT 'job_seeker',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (user_id, role)
);

-- 3. Profiles Table (for all users)
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
    email TEXT NOT NULL,
    full_name TEXT,
    phone TEXT,
    avatar_url TEXT,
    headline TEXT,
    bio TEXT,
    location TEXT,
    skills TEXT[] DEFAULT '{}',
    experience_years INTEGER DEFAULT 0,
    resume_url TEXT,
    linkedin_url TEXT,
    github_url TEXT,
    portfolio_url TEXT,
    preferred_job_types job_type[] DEFAULT '{}',
    preferred_locations TEXT[] DEFAULT '{}',
    expected_salary_min INTEGER,
    expected_salary_max INTEGER,
    is_available BOOLEAN DEFAULT true,
    language_preference TEXT DEFAULT 'en',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 4. Education Table
CREATE TABLE public.education (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    institution TEXT NOT NULL,
    degree TEXT NOT NULL,
    field_of_study TEXT,
    start_date DATE,
    end_date DATE,
    is_current BOOLEAN DEFAULT false,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 5. Experience Table
CREATE TABLE public.experience (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    company_name TEXT NOT NULL,
    job_title TEXT NOT NULL,
    location TEXT,
    start_date DATE,
    end_date DATE,
    is_current BOOLEAN DEFAULT false,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 6. Companies Table
CREATE TABLE public.companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    logo_url TEXT,
    cover_image_url TEXT,
    description TEXT,
    industry TEXT,
    company_size TEXT,
    founded_year INTEGER,
    website_url TEXT,
    linkedin_url TEXT,
    location TEXT,
    is_verified BOOLEAN DEFAULT false,
    is_approved BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 7. Jobs Table
CREATE TABLE public.jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    posted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    slug TEXT NOT NULL,
    description TEXT NOT NULL,
    requirements TEXT,
    responsibilities TEXT,
    location TEXT,
    job_type job_type NOT NULL DEFAULT 'full_time',
    experience_level experience_level NOT NULL DEFAULT 'mid',
    experience_years_min INTEGER DEFAULT 0,
    experience_years_max INTEGER,
    salary_min INTEGER,
    salary_max INTEGER,
    salary_currency TEXT DEFAULT 'INR',
    is_salary_visible BOOLEAN DEFAULT true,
    skills_required TEXT[] DEFAULT '{}',
    benefits TEXT[] DEFAULT '{}',
    status job_status NOT NULL DEFAULT 'pending_approval',
    source job_source NOT NULL DEFAULT 'manual',
    source_url TEXT,
    is_featured BOOLEAN DEFAULT false,
    is_remote BOOLEAN DEFAULT false,
    views_count INTEGER DEFAULT 0,
    applications_count INTEGER DEFAULT 0,
    expires_at TIMESTAMP WITH TIME ZONE,
    approved_at TIMESTAMP WITH TIME ZONE,
    approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (company_id, slug)
);

-- 8. Applications Table
CREATE TABLE public.applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID REFERENCES public.jobs(id) ON DELETE CASCADE NOT NULL,
    applicant_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    resume_url TEXT,
    cover_letter TEXT,
    status application_status NOT NULL DEFAULT 'applied',
    match_score INTEGER,
    employer_notes TEXT,
    applied_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    viewed_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (job_id, applicant_id)
);

-- 9. Saved Jobs Table
CREATE TABLE public.saved_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    job_id UUID REFERENCES public.jobs(id) ON DELETE CASCADE NOT NULL,
    saved_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (user_id, job_id)
);

-- 10. Notifications Table
CREATE TABLE public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'general',
    link TEXT,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 11. Scraping Sources Table (for Firecrawl)
CREATE TABLE public.scraping_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    url TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    last_scraped_at TIMESTAMP WITH TIME ZONE,
    jobs_scraped_count INTEGER DEFAULT 0,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- =============================================
-- ROW LEVEL SECURITY POLICIES
-- =============================================

-- Enable RLS on all tables
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.education ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.experience ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scraping_sources ENABLE ROW LEVEL SECURITY;

-- Security Definer Function to check roles (prevents infinite recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Function to get user's primary role
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM public.user_roles
  WHERE user_id = _user_id
  LIMIT 1
$$;

-- User Roles Policies
CREATE POLICY "Users can view their own roles"
    ON public.user_roles FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles"
    ON public.user_roles FOR SELECT
    USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can insert their own role on signup"
    ON public.user_roles FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can manage all roles"
    ON public.user_roles FOR ALL
    USING (public.has_role(auth.uid(), 'admin'));

-- Profiles Policies
CREATE POLICY "Profiles are viewable by everyone"
    ON public.profiles FOR SELECT
    USING (true);

CREATE POLICY "Users can insert their own profile"
    ON public.profiles FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = user_id);

-- Education Policies
CREATE POLICY "Education is viewable by everyone"
    ON public.education FOR SELECT
    USING (true);

CREATE POLICY "Users can manage their own education"
    ON public.education FOR ALL
    USING (profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

-- Experience Policies
CREATE POLICY "Experience is viewable by everyone"
    ON public.experience FOR SELECT
    USING (true);

CREATE POLICY "Users can manage their own experience"
    ON public.experience FOR ALL
    USING (profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

-- Companies Policies
CREATE POLICY "Approved companies are viewable by everyone"
    ON public.companies FOR SELECT
    USING (is_approved = true OR owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Employers can create companies"
    ON public.companies FOR INSERT
    WITH CHECK (auth.uid() = owner_id AND public.has_role(auth.uid(), 'employer'));

CREATE POLICY "Owners can update their companies"
    ON public.companies FOR UPDATE
    USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete companies"
    ON public.companies FOR DELETE
    USING (public.has_role(auth.uid(), 'admin'));

-- Jobs Policies
CREATE POLICY "Active jobs are viewable by everyone"
    ON public.jobs FOR SELECT
    USING (status = 'active' OR posted_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Employers can create jobs"
    ON public.jobs FOR INSERT
    WITH CHECK (auth.uid() = posted_by AND public.has_role(auth.uid(), 'employer'));

CREATE POLICY "Job owners can update their jobs"
    ON public.jobs FOR UPDATE
    USING (posted_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete jobs"
    ON public.jobs FOR DELETE
    USING (public.has_role(auth.uid(), 'admin'));

-- Applications Policies
CREATE POLICY "Applicants can view their own applications"
    ON public.applications FOR SELECT
    USING (applicant_id = auth.uid());

CREATE POLICY "Employers can view applications for their jobs"
    ON public.applications FOR SELECT
    USING (job_id IN (SELECT id FROM public.jobs WHERE posted_by = auth.uid()));

CREATE POLICY "Admins can view all applications"
    ON public.applications FOR SELECT
    USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Job seekers can apply to jobs"
    ON public.applications FOR INSERT
    WITH CHECK (auth.uid() = applicant_id AND public.has_role(auth.uid(), 'job_seeker'));

CREATE POLICY "Applicants can update their own applications"
    ON public.applications FOR UPDATE
    USING (applicant_id = auth.uid());

CREATE POLICY "Employers can update applications for their jobs"
    ON public.applications FOR UPDATE
    USING (job_id IN (SELECT id FROM public.jobs WHERE posted_by = auth.uid()));

-- Saved Jobs Policies
CREATE POLICY "Users can view their own saved jobs"
    ON public.saved_jobs FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can save jobs"
    ON public.saved_jobs FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unsave jobs"
    ON public.saved_jobs FOR DELETE
    USING (auth.uid() = user_id);

-- Notifications Policies
CREATE POLICY "Users can view their own notifications"
    ON public.notifications FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications"
    ON public.notifications FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "System can create notifications"
    ON public.notifications FOR INSERT
    WITH CHECK (true);

-- Scraping Sources Policies
CREATE POLICY "Admins can manage scraping sources"
    ON public.scraping_sources FOR ALL
    USING (public.has_role(auth.uid(), 'admin'));

-- =============================================
-- TRIGGERS AND FUNCTIONS
-- =============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_companies_updated_at
    BEFORE UPDATE ON public.companies
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_jobs_updated_at
    BEFORE UPDATE ON public.jobs
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_applications_updated_at
    BEFORE UPDATE ON public.applications
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_scraping_sources_updated_at
    BEFORE UPDATE ON public.scraping_sources
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Function to auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (user_id, email, full_name)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', '')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger to create profile on auth.users insert
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to increment job views
CREATE OR REPLACE FUNCTION public.increment_job_views(job_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE public.jobs
    SET views_count = views_count + 1
    WHERE id = job_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Function to update applications count
CREATE OR REPLACE FUNCTION public.update_applications_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE public.jobs
        SET applications_count = applications_count + 1
        WHERE id = NEW.job_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE public.jobs
        SET applications_count = applications_count - 1
        WHERE id = OLD.job_id;
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER update_job_applications_count
    AFTER INSERT OR DELETE ON public.applications
    FOR EACH ROW EXECUTE FUNCTION public.update_applications_count();

-- =============================================
-- STORAGE BUCKETS
-- =============================================

-- Create storage buckets for resumes and company assets
INSERT INTO storage.buckets (id, name, public) VALUES ('resumes', 'resumes', false);
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('company-assets', 'company-assets', true);

-- Storage policies for resumes (private)
CREATE POLICY "Users can upload their own resumes"
    ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'resumes' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view their own resumes"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'resumes' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Employers can view applicant resumes"
    ON storage.objects FOR SELECT
    USING (
        bucket_id = 'resumes' AND 
        EXISTS (
            SELECT 1 FROM public.applications a
            JOIN public.jobs j ON a.job_id = j.id
            WHERE j.posted_by = auth.uid()
            AND a.applicant_id::text = (storage.foldername(name))[1]
        )
    );

CREATE POLICY "Users can update their own resumes"
    ON storage.objects FOR UPDATE
    USING (bucket_id = 'resumes' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own resumes"
    ON storage.objects FOR DELETE
    USING (bucket_id = 'resumes' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Storage policies for avatars (public)
CREATE POLICY "Anyone can view avatars"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'avatars');

CREATE POLICY "Users can upload their own avatars"
    ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own avatars"
    ON storage.objects FOR UPDATE
    USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own avatars"
    ON storage.objects FOR DELETE
    USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Storage policies for company assets (public view, owner upload)
CREATE POLICY "Anyone can view company assets"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'company-assets');

CREATE POLICY "Company owners can upload assets"
    ON storage.objects FOR INSERT
    WITH CHECK (
        bucket_id = 'company-assets' AND
        EXISTS (
            SELECT 1 FROM public.companies
            WHERE owner_id = auth.uid()
            AND id::text = (storage.foldername(name))[1]
        )
    );

CREATE POLICY "Company owners can update assets"
    ON storage.objects FOR UPDATE
    USING (
        bucket_id = 'company-assets' AND
        EXISTS (
            SELECT 1 FROM public.companies
            WHERE owner_id = auth.uid()
            AND id::text = (storage.foldername(name))[1]
        )
    );

CREATE POLICY "Company owners can delete assets"
    ON storage.objects FOR DELETE
    USING (
        bucket_id = 'company-assets' AND
        EXISTS (
            SELECT 1 FROM public.companies
            WHERE owner_id = auth.uid()
            AND id::text = (storage.foldername(name))[1]
        )
    );

-- =============================================
-- INDEXES FOR PERFORMANCE
-- =============================================

CREATE INDEX idx_profiles_user_id ON public.profiles(user_id);
CREATE INDEX idx_profiles_skills ON public.profiles USING GIN(skills);
CREATE INDEX idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX idx_companies_owner_id ON public.companies(owner_id);
CREATE INDEX idx_companies_slug ON public.companies(slug);
CREATE INDEX idx_jobs_company_id ON public.jobs(company_id);
CREATE INDEX idx_jobs_posted_by ON public.jobs(posted_by);
CREATE INDEX idx_jobs_status ON public.jobs(status);
CREATE INDEX idx_jobs_job_type ON public.jobs(job_type);
CREATE INDEX idx_jobs_experience_level ON public.jobs(experience_level);
CREATE INDEX idx_jobs_location ON public.jobs(location);
CREATE INDEX idx_jobs_skills ON public.jobs USING GIN(skills_required);
CREATE INDEX idx_jobs_created_at ON public.jobs(created_at DESC);
CREATE INDEX idx_applications_job_id ON public.applications(job_id);
CREATE INDEX idx_applications_applicant_id ON public.applications(applicant_id);
CREATE INDEX idx_applications_status ON public.applications(status);
CREATE INDEX idx_saved_jobs_user_id ON public.saved_jobs(user_id);
CREATE INDEX idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX idx_notifications_is_read ON public.notifications(is_read);