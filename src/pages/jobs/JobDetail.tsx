import { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Layout } from '@/components/layout/Layout';
import { Job, Application } from '@/types/database';
import { CompanyResearch } from '@/components/jobs/CompanyResearch';
import { SEO } from '@/components/SEO';
import { JobPostingSchema, JobBreadcrumbSchema } from '@/components/seo/JobPostingSchema';
import { getJobRedirect } from '@/lib/redirectUtils';
import { AuthPromptModal } from '@/components/auth/AuthPromptModal';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { JobAlertCTA } from '@/components/shared/JobAlertCTA';
import { AdPlaceholder } from '@/components/ads/AdPlaceholder';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { 
  MapPin, Clock, IndianRupee, Building2, Bookmark, BookmarkCheck, 
  Briefcase, GraduationCap, Users, Globe, Share2, ChevronLeft,
  CheckCircle, Loader2, ExternalLink, Landmark
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

const JOB_TYPES: Record<string, string> = {
  full_time: 'Full Time',
  part_time: 'Part Time',
  contract: 'Contract',
  internship: 'Internship',
  remote: 'Remote',
};

const EXPERIENCE_LEVELS: Record<string, string> = {
  fresher: 'Fresher (0-1 years)',
  junior: 'Junior (1-2 years)',
  mid: 'Mid Level (3-5 years)',
  senior: 'Senior (5-8 years)',
  lead: 'Lead (8+ years)',
  executive: 'Executive',
};

/**
 * Resolves canonical job slug and renders a <link rel="canonical"> tag
 */
function CanonicalJobMeta({ canonicalJobId }: { canonicalJobId: string }) {
  const [canonicalSlug, setCanonicalSlug] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from('jobs')
      .select('slug')
      .eq('id', canonicalJobId)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.slug) setCanonicalSlug(data.slug);
      });
  }, [canonicalJobId]);

  if (!canonicalSlug) return null;

  return (
    <Helmet>
      <link rel="canonical" href={`https://truejobs.co.in/jobs/${canonicalSlug}`} />
    </Helmet>
  );
}

export default function JobDetail() {
  const { id } = useParams<{ id: string }>();
  const { user, role, profile } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [job, setJob] = useState<Job | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaved, setIsSaved] = useState(false);
  const [hasApplied, setHasApplied] = useState(false);
  const [application, setApplication] = useState<Application | null>(null);
  const [isApplyDialogOpen, setIsApplyDialogOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalAction, setAuthModalAction] = useState<'apply' | 'save'>('apply');
  const [coverLetter, setCoverLetter] = useState('');
  const [isApplying, setIsApplying] = useState(false);

  useEffect(() => {
    if (id) {
      fetchJob();
      incrementViews();
      if (user) {
        checkSavedStatus();
        checkApplicationStatus();
      }
    }
  }, [id, user]);

  const cacheJobForOffline = (jobData: Job) => {
    try {
      const cached = localStorage.getItem('cachedJobs');
      let cachedJobs = cached ? JSON.parse(cached) : [];
      
      // Remove if already exists to avoid duplicates
      cachedJobs = cachedJobs.filter((j: any) => j.id !== jobData.id);
      
      // Add to front of array
      cachedJobs.unshift({
        id: jobData.id,
        slug: jobData.slug || jobData.id,
        title: jobData.title,
        company_name: jobData.company?.name || (jobData as any).company_name,
        location: jobData.location,
        job_type: jobData.job_type,
      });
      
      // Keep only last 20 jobs
      cachedJobs = cachedJobs.slice(0, 20);
      
      localStorage.setItem('cachedJobs', JSON.stringify(cachedJobs));
    } catch (e) {
      console.error('Failed to cache job for offline:', e);
    }
  };

  const fetchJob = async () => {
    // Try slug first, then fall back to UUID lookup
    let { data, error } = await supabase
      .from('jobs')
      .select('*, company:companies(*)')
      .eq('slug', id)
      .maybeSingle();

    if (!data && id) {
      // Fallback: try matching by UUID id
      const fallback = await supabase
        .from('jobs')
        .select('*, company:companies(*)')
        .eq('id', id)
        .maybeSingle();
      data = fallback.data;
      error = fallback.error;
    }

    if (!error && data) {
      const jobData = data as Job;
      
      // SEO-safe redirect: Handle soft-deleted or duplicate jobs
      if (jobData.is_deleted === true || jobData.is_duplicate === true) {
        const redirectUrl = await getJobRedirect(jobData.id);
        if (redirectUrl && redirectUrl !== `/jobs/${jobData.slug}`) {
          navigate(redirectUrl, { replace: true });
          return;
        }
      }

      setJob(jobData);
      cacheJobForOffline(jobData);

    }
    setIsLoading(false);
  };

  const incrementViews = async () => {
    await supabase.rpc('increment_job_views', { job_id: id });
  };

  const checkSavedStatus = async () => {
    const { data } = await supabase
      .from('saved_jobs')
      .select('id')
      .eq('user_id', user!.id)
      .eq('job_id', id)
      .maybeSingle();

    setIsSaved(!!data);
  };

  const checkApplicationStatus = async () => {
    const { data } = await supabase
      .from('applications')
      .select('*')
      .eq('applicant_id', user!.id)
      .eq('job_id', id)
      .maybeSingle();

    if (data) {
      setHasApplied(true);
      setApplication(data as unknown as Application);
    }
  };

  const toggleSaveJob = async () => {
    if (!user) {
      setAuthModalAction('save');
      setIsAuthModalOpen(true);
      return;
    }

    if (isSaved) {
      const { error } = await supabase
        .from('saved_jobs')
        .delete()
        .eq('user_id', user.id)
        .eq('job_id', id);

      if (!error) {
        setIsSaved(false);
        toast({ title: 'Job removed from saved' });
      }
    } else {
      const { error } = await supabase
        .from('saved_jobs')
        .insert({ user_id: user.id, job_id: id });

      if (!error) {
        setIsSaved(true);
        toast({ title: 'Job saved!' });
      }
    }
  };

  const handleApply = async () => {
    if (!user) {
      setAuthModalAction('apply');
      setIsAuthModalOpen(true);
      return;
    }

    if (role !== 'job_seeker') {
      toast({
        title: t('common.noResults'),
        description: t('jobDetail.onlyJobSeekers'),
        variant: 'destructive',
      });
      return;
    }

    setIsApplying(true);

    const { error } = await supabase
      .from('applications')
      .insert({
        job_id: id,
        applicant_id: user.id,
        resume_url: profile?.resume_url,
        cover_letter: coverLetter || null,
      });

    if (error) {
      toast({
        title: t('jobDetail.applicationFailed'),
        description: error.message,
        variant: 'destructive',
      });
    } else {
      setHasApplied(true);
      setIsApplyDialogOpen(false);
      toast({
        title: t('jobDetail.applicationSuccess'),
        description: t('jobDetail.applicationSuccessDesc'),
      });

      // Send email notifications (fire and forget)
      supabase.functions.invoke('notify-employer-application', {
        body: { jobId: id, applicantId: user.id }
      }).catch(err => console.error('Failed to send employer notification:', err));

      // Send application confirmation email to candidate
      supabase.functions.invoke('notify-application-confirmation', {
        body: { jobId: id, applicantId: user.id }
      }).catch(err => console.error('Failed to send application confirmation:', err));
    }

    setIsApplying(false);
  };

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      await navigator.share({
        title: job?.title,
        text: `Check out this job: ${job?.title} at ${job?.company?.name}`,
        url,
      });
    } else {
      await navigator.clipboard.writeText(url);
      toast({ title: t('jobDetail.linkCopied') });
    }
  };

  const formatSalary = (min: number | null, max: number | null, currency: string) => {
    if (!min && !max) return t('jobDetail.notDisclosed');
    const formatter = new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: currency || 'INR',
      maximumFractionDigits: 0,
    });
    if (min && max) return `${formatter.format(min)} - ${formatter.format(max)} ${t('jobDetail.perYear')}`;
    if (min) return `${formatter.format(min)}+ ${t('jobDetail.perYear')}`;
    return `Up to ${formatter.format(max!)} ${t('jobDetail.perYear')}`;
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-8 max-w-5xl">
          <Skeleton className="h-8 w-32 mb-6" />
          <div className="grid lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <Skeleton className="h-48 w-full" />
              <Skeleton className="h-64 w-full" />
            </div>
            <Skeleton className="h-96 w-full" />
          </div>
        </div>
      </Layout>
    );
  }

  if (!job) {
    return (
      <Layout>
        <Helmet>
          <meta name="robots" content="noindex, nofollow" />
        </Helmet>
        <div className="container mx-auto px-4 py-16 text-center">
          <Briefcase className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
          <h1 className="text-2xl font-bold mb-2">{t('jobDetail.jobNotFound')}</h1>
          <p className="text-muted-foreground mb-6">
            {t('jobDetail.jobNotFoundDesc')}
          </p>
          <Button asChild>
            <Link to="/jobs">{t('jobDetail.browseAllJobs')}</Link>
          </Button>
        </div>
      </Layout>
    );
  }

  // SEO overrides for specific job slugs
  const SEO_OVERRIDES: Record<string, { title: string; description: string }> = {
    'academics-doubt-expert-as-freelancer-vedantu-1769026775640': {
      title: 'Vedantu Hiring Doubt Expert Freelancer 2026 – Work From Home',
      description: 'Vedantu is hiring Academic Doubt Experts as freelancers. Work from home, flexible hours, earn ₹500–₹1,500/hr. Graduation required. Apply online today – limited openings.',
    },
    'faculty-vacancy-bundelkhand-university-jhansi-1771868772174': {
      title: 'Bundelkhand University Jhansi Faculty Vacancy 2026 – Apply Now',
      description: 'Bundelkhand University Jhansi recruiting faculty members 2026. Teaching posts across departments. Check eligibility, pay scale & last date. Apply online at TrueJobs.',
    },
    'aadhar-supervisor-operator-csc-aadhar-seva-kendras-1771659304865': {
      title: 'Aadhar Supervisor & Operator Jobs 2026 at CSC Aadhar Seva Kendras',
      description: 'CSC Aadhar Seva Kendra hiring Aadhar Supervisors & Operators 2026. Work at enrollment centres near you. 10th/12th pass eligible. Salary + incentives. Apply online today.',
    },
  };

  // Build SEO description from job details
  const companyName = job.company?.name || (job as any).company_name || 'Company';
  const seoOverride = SEO_OVERRIDES[job.slug];
  const seoTitle = seoOverride?.title || `${job.title} - ${companyName}`;
  const seoDescription = seoOverride?.description || `${job.title} at ${companyName}. ${job.location || 'Remote'}. ${JOB_TYPES[job.job_type]}. ${job.is_salary_visible && job.salary_min ? `Salary: ₹${job.salary_min.toLocaleString()}${job.salary_max ? ` - ₹${job.salary_max.toLocaleString()}` : '+'}` : ''} Apply now on TrueJobs.`;

  return (
    <Layout>
      {/* SEO Meta Tags with Canonical Links */}
      <SEO
        title={seoTitle}
        description={seoDescription}
        url={`/jobs/${job.slug}`}
        type="job"
        canonical={job.canonical_job_id ? undefined : undefined}
      />
      {/* Canonical tag for duplicate jobs pointing to the canonical version */}
      {job.canonical_job_id && <CanonicalJobMeta canonicalJobId={job.canonical_job_id} />}
      
      {/* JSON-LD Structured Data */}
      <JobPostingSchema
        job={job}
        companyName={companyName}
        companyLogo={job.company?.logo_url || undefined}
        companyWebsite={job.company?.website_url || undefined}
      />
      <JobBreadcrumbSchema job={job} />

      <div className="container mx-auto px-4 py-8 max-w-5xl">
        {/* Back Button */}
        <Button variant="ghost" className="mb-6" onClick={() => navigate(-1)}>
          <ChevronLeft className="h-4 w-4 mr-2" />
          {t('jobDetail.backToJobs')}
        </Button>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6 content-area">
            {/* Header Card */}
            <Card>
              <CardContent className="p-6">
                <div className="flex gap-4 mb-4">
                  <div className="h-16 w-16 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    {job.company?.logo_url ? (
                      <img
                        src={job.company.logo_url}
                        alt={`${job.company.name} logo`}
                        className="h-12 w-12 object-contain"
                      />
                    ) : (
                      <Building2 className="h-8 w-8 text-primary" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h1 className="text-2xl font-bold mb-1">{job.title}</h1>
                        {job.company?.slug ? (
                          <Link 
                            to={`/companies/${job.company.slug}`}
                            className="text-lg text-muted-foreground hover:text-primary transition-colors"
                          >
                            {job.company.name}
                          </Link>
                        ) : (
                          <span className="text-lg text-muted-foreground">
                            {(job as any).company_name || 'Company'}
                          </span>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="icon" onClick={toggleSaveJob}>
                          {isSaved ? (
                            <BookmarkCheck className="h-5 w-5 text-primary" />
                          ) : (
                            <Bookmark className="h-5 w-5" />
                          )}
                        </Button>
                        <Button variant="ghost" size="icon" onClick={handleShare}>
                          <Share2 className="h-5 w-5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 mb-4">
                  {job.is_featured && (
                    <Badge className="bg-amber-500">{t('jobDetail.featured')}</Badge>
                  )}
                  <Badge variant="secondary">{t(`job.${job.job_type.replace('_', '')}`) || job.job_type}</Badge>
                  {job.is_remote && <Badge variant="outline">{t('job.remote')}</Badge>}
                </div>

                <div className="grid sm:grid-cols-2 gap-4 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <MapPin className="h-4 w-4 shrink-0" />
                    <span>{job.location || 'Remote'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <GraduationCap className="h-4 w-4 shrink-0" />
                    <span>{EXPERIENCE_LEVELS[job.experience_level]}</span>
                  </div>
                  {job.is_salary_visible && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <IndianRupee className="h-4 w-4 shrink-0" />
                      <span>{formatSalary(job.salary_min, job.salary_max, job.salary_currency)}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="h-4 w-4 shrink-0" />
                    <span>{t('jobDetail.posted')} {formatDistanceToNow(new Date(job.created_at), { addSuffix: true })}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Government Job Details */}
            {((job as any).pay_scale || (job as any).job_opening_date || (job as any).last_date_of_application || (job as any).government_type || (job as any).apply_url || (job as any).job_role) && (
              <Card className="border-2 border-primary/20 bg-primary/5">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Landmark className="h-5 w-5 text-primary" />
                    Government Job Details
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid sm:grid-cols-2 gap-4">
                    {(job as any).job_role && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Job Role</p>
                        <p className="font-semibold mt-1">{(job as any).job_role}</p>
                      </div>
                    )}
                    {(job as any).government_type && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Government Type</p>
                        <Badge variant="secondary" className="mt-1 capitalize">{(job as any).government_type}</Badge>
                      </div>
                    )}
                    {(job as any).pay_scale && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Pay Scale</p>
                        <p className="font-semibold mt-1">{(job as any).pay_scale}</p>
                      </div>
                    )}
                    {(job as any).job_opening_date && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Opening Date</p>
                        <p className="font-semibold mt-1">{format(new Date((job as any).job_opening_date), 'dd MMM yyyy')}</p>
                      </div>
                    )}
                    {(job as any).last_date_of_application && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Last Date to Apply</p>
                        <p className="font-semibold mt-1 text-destructive">{format(new Date((job as any).last_date_of_application), 'dd MMM yyyy')}</p>
                      </div>
                    )}
                    {(job as any).apply_url && (
                      <div className="sm:col-span-2">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Where to Apply</p>
                        <p className="font-mono text-sm mt-1 break-all bg-muted p-2 rounded">{(job as any).apply_url}</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Description */}
            <Card>
              <CardHeader>
                <CardTitle>{t('jobDetail.jobDescription')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="prose prose-sm max-w-none dark:prose-invert">
                  <p className="whitespace-pre-wrap">{job.description}</p>
                </div>
              </CardContent>
            </Card>

            <AdPlaceholder variant="banner" />

            {/* Requirements */}
            {job.requirements && (
              <Card>
                <CardHeader>
                  <CardTitle>{t('jobDetail.requirements')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="prose prose-sm max-w-none dark:prose-invert">
                    <p className="whitespace-pre-wrap">{job.requirements}</p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Responsibilities */}
            {job.responsibilities && (
              <Card>
                <CardHeader>
                  <CardTitle>{t('jobDetail.responsibilities')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="prose prose-sm max-w-none dark:prose-invert">
                    <p className="whitespace-pre-wrap">{job.responsibilities}</p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Second In-Content Ad — substantial job pages only */}
            {job.description && job.description.length > 500 && (
              <AdPlaceholder variant="in-content" />
            )}

            {/* Skills */}
            {job.skills_required.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>{t('jobDetail.requiredSkills')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {job.skills_required.map((skill) => (
                      <Badge key={skill} variant="secondary">
                        {skill}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Benefits */}
            {job.benefits.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>{t('jobDetail.benefits')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="grid sm:grid-cols-2 gap-2">
                    {job.benefits.map((benefit) => (
                      <li key={benefit} className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        <span>{benefit}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            <AdPlaceholder variant="in-content" />
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Apply Card */}
            <Card className="sticky top-24">
              <CardContent className="p-6">
                {hasApplied ? (
                  <div className="text-center">
                    <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-3" />
                    <h3 className="font-semibold mb-1">{t('jobDetail.applicationSubmitted')}</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      {t('jobDetail.applied')} {application?.applied_at && formatDistanceToNow(new Date(application.applied_at), { addSuffix: true })}
                    </p>
                    <Badge variant="outline" className="capitalize">
                      {t('jobDetail.status')}: {application?.status.replace('_', ' ')}
                    </Badge>
                  </div>
                ) : (
                  <>
                    <h3 className="font-semibold mb-4">{t('jobDetail.applyForThisJob')}</h3>
                    {role === 'job_seeker' && !profile?.resume_url && (
                      <p className="text-sm text-amber-600 bg-amber-50 dark:bg-amber-950 p-3 rounded-lg mb-4">
                        {t('jobDetail.uploadResumeHint')}
                      </p>
                    )}
                    <Button 
                      className="w-full" 
                      size="lg"
                      onClick={() => setIsApplyDialogOpen(true)}
                    >
                      {t('common.apply')}
                    </Button>
                    <p className="text-xs text-center text-muted-foreground mt-3">
                      {job.applications_count} {t('jobDetail.applicants')}
                    </p>
                  </>
                )}

                <div className="border-t mt-6 pt-6">
                  <Button 
                    variant="outline" 
                    className="w-full"
                    onClick={toggleSaveJob}
                  >
                    {isSaved ? (
                      <>
                        <BookmarkCheck className="h-4 w-4 mr-2" />
                        {t('common.saved')}
                      </>
                    ) : (
                      <>
                        <Bookmark className="h-4 w-4 mr-2" />
                        {t('jobDetail.saveJob')}
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Company Card */}
            {job.company && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">{t('jobDetail.aboutCompany')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                      {job.company.logo_url ? (
                        <img
                          src={job.company.logo_url}
                          alt={`${job.company.name} logo`}
                          className="h-8 w-8 object-contain"
                        />
                      ) : (
                        <Building2 className="h-6 w-6 text-primary" />
                      )}
                    </div>
                    <div>
                      <h4 className="font-medium">{job.company.name}</h4>
                      {job.company.industry && (
                        <p className="text-sm text-muted-foreground">{job.company.industry}</p>
                      )}
                    </div>
                  </div>

                  {job.company.description && (
                    <p className="text-sm text-muted-foreground mb-4 line-clamp-3">
                      {job.company.description}
                    </p>
                  )}

                  <div className="space-y-2 text-sm">
                    {job.company.company_size && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Users className="h-4 w-4" />
                        <span>{job.company.company_size} employees</span>
                      </div>
                    )}
                    {job.company.location && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <MapPin className="h-4 w-4" />
                        <span>{job.company.location}</span>
                      </div>
                    )}
                    {job.company.website_url && (
                      <a
                        href={job.company.website_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-primary hover:underline"
                      >
                        <Globe className="h-4 w-4" />
                        <span>{t('jobDetail.visitWebsite')}</span>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>

                  <Button variant="outline" className="w-full mt-4" asChild>
                    <Link to={`/companies/${job.company.slug}`}>
                      {t('jobDetail.viewCompanyProfile')}
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Company Research */}
            {job.company && (
              <CompanyResearch
                companyName={job.company.name}
                companyWebsite={job.company.website_url}
                jobTitle={job.title}
              />
            )}
            <JobAlertCTA variant="compact" context="Job Updates" className="mt-4" />
            <div className="mt-4 hidden lg:block">
              <AdPlaceholder variant="sidebar" />
            </div>
          </div>
        </div>
      </div>

      {/* Apply Dialog */}
      <Dialog open={isApplyDialogOpen} onOpenChange={setIsApplyDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Apply for {job.title}</DialogTitle>
            <DialogDescription>
              at {job.company?.name || (job as any).company_name || 'Company'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {profile?.resume_url ? (
              <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                <CheckCircle className="h-5 w-5 text-green-500" />
                <div>
                  <p className="text-sm font-medium">Resume attached</p>
                  <p className="text-xs text-muted-foreground">From your profile</p>
                </div>
              </div>
            ) : (
              <div className="p-3 bg-amber-50 dark:bg-amber-950 rounded-lg">
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  No resume found. Consider{' '}
                  <Link to="/profile" className="underline">uploading one</Link>{' '}
                  for better chances.
                </p>
              </div>
            )}

            <div>
              <Label htmlFor="coverLetter">{t('jobDetail.coverLetter')} (Optional)</Label>
              <Textarea
                id="coverLetter"
                value={coverLetter}
                onChange={(e) => setCoverLetter(e.target.value)}
                placeholder={t('jobDetail.coverLetterPlaceholder')}
                rows={5}
                className="mt-2"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsApplyDialogOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleApply} disabled={isApplying}>
              {isApplying && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {isApplying ? t('jobDetail.submitting') : t('jobDetail.submitApplication')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Auth Prompt Modal for unauthenticated users */}
      <AuthPromptModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        title={t('jobDetail.loginRequired')}
        description={authModalAction === 'apply' ? t('jobDetail.loginToApply') : t('jobDetail.loginToSave')}
      />
    </Layout>
  );
}
