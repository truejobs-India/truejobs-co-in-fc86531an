import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import { Company } from '@/types/database';
import { Button } from '@/components/ui/button';
import { ArrowLeft, X } from 'lucide-react';
import { StepIndicator } from './StepIndicator';
import { JobDetailsStep } from './steps/JobDetailsStep';
import { CandidateRequirementsStep } from './steps/CandidateRequirementsStep';
import { InterviewInfoStep } from './steps/InterviewInfoStep';
import { JobPreviewStep } from './steps/JobPreviewStep';
import { PlanSelectionStep } from './steps/PlanSelectionStep';

export interface JobPostingData {
  // Step 1: Job Details
  title: string;
  category: string;
  otherCategory: string;
  jobType: 'full_time' | 'part_time' | 'contract' | 'internship' | 'remote';
  isNightShift: boolean;
  locationType: 'onsite' | 'remote' | 'hybrid' | 'work_from_home';
  city: string;
  state: string;
  country: string;
  payType: 'fixed' | 'fixed_incentive' | 'incentive';
  salaryMin: number | null;
  salaryMax: number | null;
  incentiveAmount: number | null;
  salaryPeriod: 'monthly' | 'yearly';
  perks: string[];
  hasJoiningFee: boolean;
  description: string;
  
  // Step 2: Candidate Requirements
  minEducation: string;
  experienceLevel: 'fresher' | 'junior' | 'mid' | 'senior' | 'lead' | 'executive';
  experienceYearsMin: number;
  experienceYearsMax: number | null;
  englishLevel: string;
  ageMin: number;
  ageMax: number;
  gender: 'any' | 'male' | 'female';
  industry: string;
  skills: string[];
  requirements: string;
  responsibilities: string;
  
  // Step 3: Interview Info
  isWalkIn: boolean;
  companyAddress: string;
  communicationPreference: 'myself' | 'other_recruiter' | 'no_contact';
  recruiterPhone: string;
  notificationPreference: 'email_myself' | 'email_other' | 'daily_summary';
  
  // Step 5: Plan
  selectedPlanId: string | null;
}

const initialJobData: JobPostingData = {
  title: '',
  category: '',
  otherCategory: '',
  jobType: 'full_time',
  isNightShift: false,
  locationType: 'onsite',
  city: '',
  state: '',
  country: 'India',
  payType: 'fixed',
  salaryMin: null,
  salaryMax: null,
  incentiveAmount: null,
  salaryPeriod: 'monthly',
  perks: [],
  hasJoiningFee: false,
  description: '',
  minEducation: '',
  experienceLevel: 'fresher',
  experienceYearsMin: 0,
  experienceYearsMax: null,
  englishLevel: 'basic',
  ageMin: 18,
  ageMax: 60,
  gender: 'any',
  industry: '',
  skills: [],
  requirements: '',
  responsibilities: '',
  isWalkIn: false,
  companyAddress: '',
  communicationPreference: 'no_contact',
  recruiterPhone: '',
  notificationPreference: 'daily_summary',
  selectedPlanId: null,
};

export function JobPostingWizard() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [currentStep, setCurrentStep] = useState(1);
  const [jobData, setJobData] = useState<JobPostingData>(initialJobData);
  const [company, setCompany] = useState<Company | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const STEPS = [
    { number: 1, label: t('wizard.step1') },
    { number: 2, label: t('wizard.step2') },
    { number: 3, label: t('wizard.step3') },
    { number: 4, label: t('wizard.step4') },
    { number: 5, label: t('wizard.step5') },
  ];

  useEffect(() => {
    fetchCompany();
  }, [user]);

  const fetchCompany = async () => {
    if (!user) return;
    setIsLoading(true);

    const { data } = await supabase
      .from('companies')
      .select('*')
      .eq('owner_id', user.id)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (data) {
      setCompany(data as Company);
      // Pre-fill company address
      setJobData(prev => ({
        ...prev,
        companyAddress: data.location || '',
      }));
    } else {
      toast({
        title: t('wizard.companyRequired'),
        description: t('wizard.createCompanyFirst'),
        variant: 'destructive',
      });
      navigate('/employer/company');
    }
    setIsLoading(false);
  };

  const updateJobData = (updates: Partial<JobPostingData>) => {
    setJobData(prev => ({ ...prev, ...updates }));
  };

  const generateSlug = (jobTitle: string) => {
    const base = jobTitle
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    return `${base}-${Date.now().toString(36)}`;
  };

  const handleNext = () => {
    if (currentStep < 5) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleSubmit = async () => {
    if (!user || !company) return;

    setIsSubmitting(true);

    try {
      // Check if company is blocked before posting
      const { isCompanyBlocked } = await import('@/utils/companyBlockCheck');
      const blocked = await isCompanyBlocked(company.name);
      if (blocked) {
        toast({
          title: 'Company Blocked',
          description: 'This company has been permanently blocked from posting jobs.',
          variant: 'destructive',
        });
        setIsSubmitting(false);
        return;
      }

      // Determine status based on company auto-approve setting
      const { data: companyData } = await supabase
        .from('companies')
        .select('auto_approve_jobs')
        .eq('id', company.id)
        .single();

      const status = companyData?.auto_approve_jobs ? 'active' : 'pending_approval';

      const { error } = await supabase.from('jobs').insert({
        company_id: company.id,
        posted_by: user.id,
        title: jobData.title,
        slug: generateSlug(jobData.title),
        description: jobData.description,
        requirements: jobData.requirements || null,
        responsibilities: jobData.responsibilities || null,
        location: `${jobData.city}, ${jobData.state}`,
        city: jobData.city,
        state: jobData.state,
        country: jobData.country,
        job_type: jobData.jobType,
        location_type: jobData.locationType,
        experience_level: jobData.experienceLevel,
        experience_years_min: jobData.experienceYearsMin,
        experience_years_max: jobData.experienceYearsMax,
        salary_min: jobData.salaryMin,
        salary_max: jobData.salaryMax,
        salary_period: jobData.salaryPeriod,
        is_salary_visible: true,
        is_remote: jobData.locationType === 'remote' || jobData.locationType === 'work_from_home',
        is_work_from_home: jobData.locationType === 'work_from_home',
        skills_required: jobData.skills,
        benefits: jobData.perks,
        status,
      });

      if (error) throw error;

      // Send job posted confirmation email to employer (fire and forget)
      supabase.functions.invoke('notify-job-posted', {
        body: {
          jobTitle: jobData.title,
          jobLocation: `${jobData.city}, ${jobData.state}`,
          jobType: jobData.jobType,
          companyName: company.name,
          employerId: user.id,
          status,
        },
      }).catch(err => console.error('Failed to send job posted notification:', err));

      toast({
        title: status === 'active' ? t('wizard.jobPostedSuccess') : t('wizard.jobSubmittedApproval'),
        description: status === 'active' 
          ? t('wizard.jobLive')
          : t('wizard.jobPendingApproval'),
      });

      navigate('/employer/dashboard');
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to post job',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <div className="bg-background border-b sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <span className="font-semibold">{t('wizard.postJob')}</span>
          </div>
          <Button variant="ghost" size="icon" onClick={() => navigate('/employer/dashboard')}>
            <X className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Step Indicator */}
      <div className="bg-background border-b py-6">
        <div className="container mx-auto px-4">
          <StepIndicator steps={STEPS} currentStep={currentStep} />
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {currentStep === 1 && (
          <JobDetailsStep
            data={jobData}
            company={company}
            onUpdate={updateJobData}
            onNext={handleNext}
          />
        )}
        {currentStep === 2 && (
          <CandidateRequirementsStep
            data={jobData}
            onUpdate={updateJobData}
            onNext={handleNext}
            onBack={handleBack}
          />
        )}
        {currentStep === 3 && (
          <InterviewInfoStep
            data={jobData}
            company={company}
            onUpdate={updateJobData}
            onNext={handleNext}
            onBack={handleBack}
          />
        )}
        {currentStep === 4 && (
          <JobPreviewStep
            data={jobData}
            company={company}
            onNext={handleNext}
            onBack={handleBack}
            onEdit={(step) => setCurrentStep(step)}
          />
        )}
        {currentStep === 5 && (
          <PlanSelectionStep
            data={jobData}
            onUpdate={updateJobData}
            onBack={handleBack}
            onSubmit={handleSubmit}
            isSubmitting={isSubmitting}
          />
        )}
      </div>
    </div>
  );
}