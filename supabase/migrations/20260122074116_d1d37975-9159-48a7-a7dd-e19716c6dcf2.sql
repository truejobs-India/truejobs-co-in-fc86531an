-- =============================================
-- PART 1: Scraping Restriction System
-- =============================================

-- Create restricted_domains table
CREATE TABLE public.restricted_domains (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  domain TEXT NOT NULL UNIQUE,
  reason TEXT DEFAULT 'Job portal - ToS restrictions',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Pre-populate with common job portals
INSERT INTO public.restricted_domains (domain, reason) VALUES
  ('naukri.com', 'Job portal - ToS restrictions'),
  ('indeed.com', 'Job portal - ToS restrictions'),
  ('foundit.com', 'Job portal - ToS restrictions'),
  ('monster.com', 'Job portal - ToS restrictions'),
  ('linkedin.com', 'Professional network - ToS restrictions'),
  ('shine.com', 'Job portal - ToS restrictions'),
  ('glassdoor.com', 'Job portal - ToS restrictions'),
  ('timesjobs.com', 'Job portal - ToS restrictions'),
  ('ziprecruiter.com', 'Job portal - ToS restrictions'),
  ('careerbuilder.com', 'Job portal - ToS restrictions'),
  ('simplyhired.com', 'Job portal - ToS restrictions'),
  ('dice.com', 'Job portal - ToS restrictions'),
  ('flexjobs.com', 'Job portal - ToS restrictions'),
  ('wellfound.com', 'Startup job board - ToS restrictions'),
  ('angel.co', 'Startup job board - ToS restrictions'),
  ('hired.com', 'Job portal - ToS restrictions'),
  ('upwork.com', 'Freelance platform - ToS restrictions'),
  ('fiverr.com', 'Freelance platform - ToS restrictions'),
  ('toptal.com', 'Talent platform - ToS restrictions'),
  ('remote.co', 'Remote job board - ToS restrictions'),
  ('weworkremotely.com', 'Remote job board - ToS restrictions'),
  ('remoteok.com', 'Remote job board - ToS restrictions');

-- Create app_settings table for global toggles
CREATE TABLE public.app_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  value JSONB NOT NULL DEFAULT '{}',
  description TEXT,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);

-- Insert default settings
INSERT INTO public.app_settings (key, value, description) VALUES
  ('scraping_block_job_portals', '{"enabled": true}', 'Block scraping of restricted job portal domains'),
  ('scraping_show_warnings', '{"enabled": true}', 'Show warnings before scraping restricted domains when blocking is disabled');

-- =============================================
-- PART 2: Enhanced Job Data Structure
-- =============================================

-- Create new enums for job classification
CREATE TYPE public.job_level AS ENUM (
  'intern',
  'fresher',
  'junior',
  'mid',
  'senior',
  'lead',
  'manager',
  'director',
  'executive'
);

CREATE TYPE public.location_type AS ENUM (
  'onsite',
  'hybrid',
  'remote',
  'work_from_home'
);

CREATE TYPE public.employment_type AS ENUM (
  'full_time',
  'part_time',
  'contract',
  'freelancing',
  'internship',
  'temporary'
);

CREATE TYPE public.salary_period AS ENUM (
  'hourly',
  'daily',
  'weekly',
  'monthly',
  'yearly'
);

-- Add normalized columns to jobs table
ALTER TABLE public.jobs 
  ADD COLUMN IF NOT EXISTS job_designation_normalized TEXT,
  ADD COLUMN IF NOT EXISTS job_level public.job_level,
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS state TEXT,
  ADD COLUMN IF NOT EXISTS country TEXT,
  ADD COLUMN IF NOT EXISTS location_type public.location_type,
  ADD COLUMN IF NOT EXISTS employment_type public.employment_type,
  ADD COLUMN IF NOT EXISTS salary_period public.salary_period DEFAULT 'yearly',
  ADD COLUMN IF NOT EXISTS is_work_from_home BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_freelance BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS experience_min_years NUMERIC(4,1),
  ADD COLUMN IF NOT EXISTS experience_max_years NUMERIC(4,1),
  ADD COLUMN IF NOT EXISTS raw_description TEXT,
  ADD COLUMN IF NOT EXISTS ai_processed_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS extraction_confidence NUMERIC(3,2);

-- Add blocked status to scraping source status enum
ALTER TYPE public.scraping_source_status ADD VALUE IF NOT EXISTS 'blocked';

-- Add blocked_reason to scraping_sources
ALTER TABLE public.scraping_sources
  ADD COLUMN IF NOT EXISTS blocked_reason TEXT;

-- =============================================
-- RLS Policies
-- =============================================

-- Enable RLS on new tables
ALTER TABLE public.restricted_domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Restricted domains: readable by all authenticated, writable by admins
CREATE POLICY "Authenticated users can view restricted domains"
  ON public.restricted_domains FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage restricted domains"
  ON public.restricted_domains FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- App settings: readable by all authenticated, writable by admins
CREATE POLICY "Authenticated users can view app settings"
  ON public.app_settings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage app settings"
  ON public.app_settings FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- =============================================
-- Indexes for Performance
-- =============================================

CREATE INDEX IF NOT EXISTS idx_jobs_job_level ON public.jobs(job_level);
CREATE INDEX IF NOT EXISTS idx_jobs_location_type ON public.jobs(location_type);
CREATE INDEX IF NOT EXISTS idx_jobs_employment_type ON public.jobs(employment_type);
CREATE INDEX IF NOT EXISTS idx_jobs_city ON public.jobs(city);
CREATE INDEX IF NOT EXISTS idx_jobs_country ON public.jobs(country);
CREATE INDEX IF NOT EXISTS idx_jobs_is_work_from_home ON public.jobs(is_work_from_home) WHERE is_work_from_home = true;
CREATE INDEX IF NOT EXISTS idx_jobs_is_freelance ON public.jobs(is_freelance) WHERE is_freelance = true;
CREATE INDEX IF NOT EXISTS idx_restricted_domains_domain ON public.restricted_domains(domain);
CREATE INDEX IF NOT EXISTS idx_restricted_domains_active ON public.restricted_domains(is_active) WHERE is_active = true;