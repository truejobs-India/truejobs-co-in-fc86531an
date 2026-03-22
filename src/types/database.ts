// Extended types for better TypeScript support
export type AppRole = 'job_seeker' | 'employer' | 'admin';
export type JobType = 'full_time' | 'part_time' | 'contract' | 'internship' | 'remote';
export type ExperienceLevel = 'fresher' | 'junior' | 'mid' | 'senior' | 'lead' | 'executive';
export type ApplicationStatus = 'applied' | 'viewed' | 'shortlisted' | 'interviewing' | 'offered' | 'rejected' | 'withdrawn';
export type JobStatus = 'draft' | 'pending_approval' | 'active' | 'paused' | 'closed' | 'expired' | 'archived';
export type JobSource = 'manual' | 'scraped';

export interface Profile {
  id: string;
  user_id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  headline: string | null;
  bio: string | null;
  location: string | null;
  skills: string[];
  experience_years: number;
  resume_url: string | null;
  linkedin_url: string | null;
  github_url: string | null;
  portfolio_url: string | null;
  preferred_job_types: JobType[];
  preferred_locations: string[];
  expected_salary_min: number | null;
  expected_salary_max: number | null;
  is_available: boolean;
  language_preference: string;
  created_at: string;
  updated_at: string;
}

export interface Company {
  id: string;
  owner_id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  cover_image_url: string | null;
  description: string | null;
  industry: string | null;
  company_size: string | null;
  founded_year: number | null;
  website_url: string | null;
  linkedin_url: string | null;
  location: string | null;
  is_verified: boolean;
  is_approved: boolean;
  created_at: string;
  updated_at: string;
}

export interface Job {
  id: string;
  company_id: string | null;
  posted_by: string | null;
  title: string;
  slug: string;
  description: string;
  requirements: string | null;
  responsibilities: string | null;
  location: string | null;
  job_type: JobType;
  experience_level: ExperienceLevel;
  experience_years_min: number;
  experience_years_max: number | null;
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string;
  is_salary_visible: boolean;
  skills_required: string[];
  benefits: string[];
  status: JobStatus;
  source: JobSource;
  source_url: string | null;
  is_featured: boolean;
  is_remote: boolean;
  views_count: number;
  applications_count: number;
  expires_at: string | null;
  approved_at: string | null;
  approved_by: string | null;
  created_at: string;
  updated_at: string;
  company?: Company;
  // Duplicate detection & SEO fields
  is_deleted?: boolean;
  is_duplicate?: boolean;
  duplicate_group_id?: string | null;
  canonical_job_id?: string | null;
  duplicate_confidence_score?: number | null;
  normalized_title?: string | null;
  normalized_company?: string | null;
  normalized_location?: string | null;
  source_url_hash?: string | null;
  company_name?: string | null;
  // Government job specific fields
  pay_scale?: string | null;
  job_opening_date?: string | null;
  last_date_of_application?: string | null;
  government_type?: string | null;
  apply_url?: string | null;
  job_role?: string | null;
}

export interface CompanyResearch {
  overview: string;
  culture: string;
  recentNews: string[];
  keyPeople: string[];
  products: string[];
  competitors: string[];
  benefits: string[];
  interviewTips: string[];
  fetchedAt: string;
}

export interface Application {
  id: string;
  job_id: string;
  applicant_id: string;
  resume_url: string | null;
  cover_letter: string | null;
  status: ApplicationStatus;
  match_score: number | null;
  employer_notes: string | null;
  seeker_notes: string | null;
  follow_up_date: string | null;
  reminder_sent: boolean;
  company_research: CompanyResearch | Record<string, unknown> | null;
  applied_at: string;
  viewed_at: string | null;
  updated_at: string;
  job?: Job;
  profile?: Profile;
}

export interface SavedJob {
  id: string;
  user_id: string;
  job_id: string;
  saved_at: string;
  job?: Job;
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: string;
  link: string | null;
  is_read: boolean;
  created_at: string;
}

export interface Education {
  id: string;
  profile_id: string;
  institution: string;
  degree: string;
  field_of_study: string | null;
  start_date: string | null;
  end_date: string | null;
  is_current: boolean;
  description: string | null;
  created_at: string;
}

export interface Experience {
  id: string;
  profile_id: string;
  company_name: string;
  job_title: string;
  location: string | null;
  start_date: string | null;
  end_date: string | null;
  is_current: boolean;
  description: string | null;
  created_at: string;
}

export interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
  created_at: string;
}


export interface RestrictedDomain {
  id: string;
  domain: string;
  reason: string | null;
  is_active: boolean;
  created_at: string;
  created_by: string | null;
}

export interface AppSetting {
  id: string;
  key: string;
  value: Record<string, unknown>;
  description: string | null;
  updated_at: string;
  updated_by: string | null;
}

export interface EnhancedJob extends Job {
  // Enhanced location fields
  city?: string | null;
  state?: string | null;
  country?: string | null;
  location_type?: LocationType | null;
  
  // Enhanced classification
  job_designation_normalized?: string | null;
  job_level?: JobLevel | null;
  employment_type?: EmploymentType | null;
  
  // Enhanced salary
  salary_period?: SalaryPeriod | null;
  
  // Work mode flags
  is_work_from_home?: boolean;
  is_freelance?: boolean;
  
  // Experience
  experience_min_years?: number | null;
  experience_max_years?: number | null;
  
  // Raw data
  raw_description?: string | null;
  
  // AI Processing metadata
  ai_processed_at?: string | null;
  extraction_confidence?: number | null;
}
