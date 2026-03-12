import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Layout } from '@/components/layout/Layout';
import { Application, SavedJob, Job, Profile } from '@/types/database';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Briefcase, Building2, MapPin, Clock, FileText, Bookmark, 
  TrendingUp, CheckCircle, Eye, Send, XCircle, User, Sparkles, PenTool, ClipboardList,
  Landmark, Heart, BookmarkCheck
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { 
  rankJobsForProfile, 
  createPersonalizedConfig, 
  getMatchScoreDisplay,
  MatchResult 
} from '@/lib/jobMatcher';
import { AIResumeWriter } from '@/components/resume/AIResumeWriter';
import { ApplicationTracker } from '@/components/jobs/ApplicationTracker';

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  applied: { label: 'Applied', color: 'bg-blue-500', icon: Send },
  viewed: { label: 'Viewed', color: 'bg-purple-500', icon: Eye },
  shortlisted: { label: 'Shortlisted', color: 'bg-amber-500', icon: TrendingUp },
  interviewing: { label: 'Interviewing', color: 'bg-cyan-500', icon: User },
  offered: { label: 'Offered', color: 'bg-green-500', icon: CheckCircle },
  rejected: { label: 'Rejected', color: 'bg-red-500', icon: XCircle },
  withdrawn: { label: 'Withdrawn', color: 'bg-gray-500', icon: XCircle },
};

export default function JobSeekerDashboard() {
  const { user, profile } = useAuth();
  const { t } = useLanguage();
  const [applications, setApplications] = useState<(Application & { job: Job })[]>([]);
  const [savedJobs, setSavedJobs] = useState<(SavedJob & { job: Job })[]>([]);
  const [savedGovJobs, setSavedGovJobs] = useState<any[]>([]);
  const [matchedJobs, setMatchedJobs] = useState<MatchResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    setIsLoading(true);

    // Fetch applications with job details
    const { data: appsData } = await supabase
      .from('applications')
      .select('*, job:jobs(*, company:companies(*))')
      .eq('applicant_id', user!.id)
      .order('applied_at', { ascending: false });

    if (appsData) {
      const mappedApps = appsData.map((app: any) => ({
        ...app,
        job: app.job
      })) as (Application & { job: Job })[];
      setApplications(mappedApps);
    }

    // Fetch saved jobs
    const { data: savedData } = await supabase
      .from('saved_jobs')
      .select('*, job:jobs(*, company:companies(*))')
      .eq('user_id', user!.id)
      .order('saved_at', { ascending: false });

    if (savedData) {
      setSavedJobs(savedData as (SavedJob & { job: Job })[]);
    }


    // Fetch all active jobs for matching
    const { data: allJobsData } = await supabase
      .from('jobs')
      .select('*, company:companies(*)')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(50); // Get more jobs for better matching

    if (allJobsData && profile) {
      // Get applied job IDs for learning
      const appliedJobIds = appsData?.map(app => app.job_id) || [];
      const appliedJobs = appsData?.map(app => app.job).filter(Boolean) as Job[] || [];
      
      // Create personalized config based on application history
      const personalizedConfig = createPersonalizedConfig(
        undefined as any, // Use default config
        appliedJobs,
        profile as Profile
      );
      
      // Rank jobs using the matching algorithm
      const rankedJobs = rankJobsForProfile(
        profile as Profile,
        allJobsData as Job[],
        personalizedConfig,
        appliedJobIds
      );
      
      // Take top 5 matches
      setMatchedJobs(rankedJobs.slice(0, 5));
    } else if (allJobsData) {
      // No profile - just show latest jobs with default scores
      setMatchedJobs(allJobsData.slice(0, 5).map(job => ({
        job: job as Job,
        score: 50,
        breakdown: { skills: 0.5, jobType: 0.5, experience: 0.5, location: 0.5, salary: 0.5 }
      })));
    }

    setIsLoading(false);
  };

  const calculateProfileCompletion = () => {
    if (!profile) return 0;
    const fields = [
      profile.full_name,
      profile.headline,
      profile.bio,
      profile.location,
      profile.skills?.length > 0,
      profile.resume_url,
      profile.phone,
      profile.linkedin_url,
    ];
    const filled = fields.filter(Boolean).length;
    return Math.round((filled / fields.length) * 100);
  };

  const profileCompletion = calculateProfileCompletion();

  const applicationStats = {
    total: applications.length,
    pending: applications.filter((a) => ['applied', 'viewed'].includes(a.status)).length,
    inProgress: applications.filter((a) => ['shortlisted', 'interviewing'].includes(a.status)).length,
    completed: applications.filter((a) => ['offered', 'rejected', 'withdrawn'].includes(a.status)).length,
  };

  if (isLoading) {
    return (
      <Layout noAds>
        <div className="min-h-screen bg-gradient-hero">
          <div className="container mx-auto px-4 py-8">
            <Skeleton className="h-8 w-64 mb-8" />
            <div className="grid md:grid-cols-4 gap-6 mb-8">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-32 rounded-2xl" />
              ))}
            </div>
            <Skeleton className="h-96 rounded-2xl" />
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout noAds>
      <div className="min-h-screen bg-gradient-hero relative overflow-hidden">
        {/* Premium background effects */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-primary/5 rounded-full blur-3xl transform translate-x-1/2 -translate-y-1/2" />
          <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-accent/5 rounded-full blur-3xl transform -translate-x-1/2 translate-y-1/2" />
        </div>
        
        <div className="container mx-auto px-4 py-8 relative z-10">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-foreground via-foreground to-primary">
                {t('dashboard.welcome')}, {profile?.full_name || 'there'}! 👋
              </h1>
              <p className="text-muted-foreground mt-2 text-lg">
                {t('dashboard.whatsHappening')}
              </p>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="backdrop-blur-sm bg-white/50 dark:bg-card/50 border-white/20 hover:bg-white/70 dark:hover:bg-card/70 shadow-sm" asChild>
                <Link to="/profile">
                  <User className="h-4 w-4 mr-2" />
                  {t('dashboard.editProfile')}
                </Link>
              </Button>
              <Button className="shadow-primary bg-gradient-primary hover:opacity-90 transition-opacity" asChild>
                <Link to="/jobs">
                  <Briefcase className="h-4 w-4 mr-2" />
                  {t('dashboard.browseJobs')}
                </Link>
              </Button>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <Card className="group backdrop-blur-xl bg-white/70 dark:bg-card/70 border-white/20 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 rounded-2xl overflow-hidden">
              <CardContent className="p-6 relative">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="flex items-center justify-between relative z-10">
                  <div>
                    <p className="text-sm text-muted-foreground font-medium">{t('dashboard.totalApplications')}</p>
                    <p className="text-4xl font-bold mt-1 text-gradient-primary">{applicationStats.total}</p>
                  </div>
                  <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
                    <Send className="h-7 w-7 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="group backdrop-blur-xl bg-white/70 dark:bg-card/70 border-white/20 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 rounded-2xl overflow-hidden">
              <CardContent className="p-6 relative">
                <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="flex items-center justify-between relative z-10">
                  <div>
                    <p className="text-sm text-muted-foreground font-medium">{t('dashboard.inReview')}</p>
                    <p className="text-4xl font-bold mt-1 text-gradient-primary">{applicationStats.pending}</p>
                  </div>
                  <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center shadow-lg shadow-purple-500/25">
                    <Eye className="h-7 w-7 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="group backdrop-blur-xl bg-white/70 dark:bg-card/70 border-white/20 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 rounded-2xl overflow-hidden">
              <CardContent className="p-6 relative">
                <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="flex items-center justify-between relative z-10">
                  <div>
                    <p className="text-sm text-muted-foreground font-medium">{t('dashboard.interviews')}</p>
                    <p className="text-4xl font-bold mt-1 text-gradient-primary">{applicationStats.inProgress}</p>
                  </div>
                  <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/25">
                    <TrendingUp className="h-7 w-7 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="group backdrop-blur-xl bg-white/70 dark:bg-card/70 border-white/20 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 rounded-2xl overflow-hidden">
              <CardContent className="p-6 relative">
                <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="flex items-center justify-between relative z-10">
                  <div>
                    <p className="text-sm text-muted-foreground font-medium">{t('dashboard.savedJobs')}</p>
                    <p className="text-4xl font-bold mt-1 text-gradient-primary">{savedJobs.length}</p>
                  </div>
                  <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center shadow-lg shadow-green-500/25">
                    <Bookmark className="h-7 w-7 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Profile Completion */}
          {profileCompletion < 100 && (
            <Card className="mb-8 backdrop-blur-xl bg-gradient-to-r from-primary/10 via-accent/10 to-primary/10 border-primary/20 shadow-lg rounded-2xl overflow-hidden">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-semibold text-lg">{t('dashboard.completeProfile')}</h3>
                    <p className="text-sm text-muted-foreground">
                      {t('dashboard.completeProfileDesc')}
                    </p>
                  </div>
                  <Button variant="outline" size="sm" className="backdrop-blur-sm bg-white/50 dark:bg-card/50" asChild>
                    <Link to="/profile">{t('dashboard.completeProfile')}</Link>
                  </Button>
                </div>
                <div className="flex items-center gap-4">
                  <Progress value={profileCompletion} className="flex-1 h-3" />
                  <span className="text-sm font-bold text-primary">{profileCompletion}%</span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Main Content */}
          <div className="grid lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
              <Tabs defaultValue="tracker">
                <TabsList className="mb-6 backdrop-blur-xl bg-white/70 dark:bg-card/70 border border-white/20 shadow-lg p-1 rounded-xl">
                  <TabsTrigger value="tracker" className="gap-2 rounded-lg data-[state=active]:bg-gradient-primary data-[state=active]:text-white data-[state=active]:shadow-md">
                    <ClipboardList className="h-4 w-4" />
                    <span className="hidden sm:inline">{t('dashboard.tracker')}</span>
                  </TabsTrigger>
                  <TabsTrigger value="applications" className="gap-2 rounded-lg data-[state=active]:bg-gradient-primary data-[state=active]:text-white data-[state=active]:shadow-md">
                    <FileText className="h-4 w-4" />
                    <span className="hidden sm:inline">{t('dashboard.applications')}</span> ({applications.length})
                  </TabsTrigger>
                  <TabsTrigger value="saved" className="gap-2 rounded-lg data-[state=active]:bg-gradient-primary data-[state=active]:text-white data-[state=active]:shadow-md">
                    <Bookmark className="h-4 w-4" />
                    <span className="hidden sm:inline">{t('dashboard.savedJobs')}</span> ({savedJobs.length + savedGovJobs.length})
                  </TabsTrigger>
                  <TabsTrigger value="resume" className="gap-2 rounded-lg data-[state=active]:bg-gradient-primary data-[state=active]:text-white data-[state=active]:shadow-md">
                    <PenTool className="h-4 w-4" />
                    <span className="hidden sm:inline">{t('dashboard.aiResume')}</span>
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="tracker">
                  <ApplicationTracker />
                </TabsContent>

                <TabsContent value="applications">
                  {applications.length === 0 ? (
                    <Card className="backdrop-blur-xl bg-white/70 dark:bg-card/70 border-white/20 shadow-lg rounded-2xl">
                      <CardContent className="p-12 text-center">
                        <div className="h-16 w-16 mx-auto rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center mb-4">
                          <FileText className="h-8 w-8 text-primary" />
                        </div>
                        <h3 className="text-lg font-semibold mb-2">{t('dashboard.noApplications')}</h3>
                        <p className="text-muted-foreground mb-4">
                          {t('dashboard.noApplicationsDesc')}
                        </p>
                        <Button className="bg-gradient-primary shadow-primary" asChild>
                          <Link to="/jobs">{t('dashboard.browseJobs')}</Link>
                        </Button>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="space-y-4">
                    {applications.map((app) => {
                      const statusConfig = STATUS_CONFIG[app.status];
                      const StatusIcon = statusConfig.icon;
                      return (
                        <Card key={app.id} className="backdrop-blur-xl bg-white/70 dark:bg-card/70 border-white/20 shadow-sm hover:shadow-lg transition-all duration-300 rounded-xl overflow-hidden group">
                          <CardContent className="p-4">
                            <div className="flex gap-4">
                              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary/10 to-accent/10 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                                {app.job?.company?.logo_url ? (
                                  <img
                                    src={app.job.company.logo_url}
                                    alt={`${app.job.company.name} logo`}
                                    className="h-8 w-8 object-contain"
                                  />
                                ) : (
                                  <Building2 className="h-6 w-6 text-primary" />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-2">
                                  <div>
                                    <Link
                                      to={`/jobs/${app.job_id}`}
                                      className="font-semibold hover:text-primary transition-colors"
                                    >
                                      {app.job?.title}
                                    </Link>
                                    <p className="text-sm text-muted-foreground">
                                      {app.job?.company?.name}
                                    </p>
                                  </div>
                                  <Badge className={`${statusConfig.color} text-white shrink-0 shadow-sm`}>
                                    <StatusIcon className="h-3 w-3 mr-1" />
                                    {statusConfig.label}
                                  </Badge>
                                </div>
                                <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                                  <span className="flex items-center gap-1">
                                    <MapPin className="h-3 w-3" />
                                    {app.job?.location || 'Remote'}
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    Applied {formatDistanceToNow(new Date(app.applied_at), { addSuffix: true })}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="saved">
                {savedJobs.length === 0 && savedGovJobs.length === 0 ? (
                  <Card className="backdrop-blur-xl bg-white/70 dark:bg-card/70 border-white/20 shadow-lg rounded-2xl">
                    <CardContent className="p-12 text-center">
                      <div className="h-16 w-16 mx-auto rounded-2xl bg-gradient-to-br from-green-500/20 to-emerald-500/20 flex items-center justify-center mb-4">
                        <Bookmark className="h-8 w-8 text-green-600" />
                      </div>
                      <h3 className="text-lg font-semibold mb-2">{t('dashboard.noSavedJobs')}</h3>
                      <p className="text-muted-foreground mb-4">
                        {t('dashboard.noSavedJobsDesc')}
                      </p>
                      <div className="flex gap-3 justify-center">
                        <Button className="bg-gradient-primary shadow-primary" asChild>
                          <Link to="/jobs">{t('dashboard.browseJobs')}</Link>
                        </Button>
                        <Button variant="outline" asChild>
                          <Link to="/government-jobs">Government Jobs</Link>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-4">
                    {/* Saved Government Jobs */}
                    {savedGovJobs.length > 0 && (
                      <>
                        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                          <Landmark className="h-4 w-4" /> Government Jobs ({savedGovJobs.length})
                        </h3>
                        {savedGovJobs.map((saved) => (
                          <Card key={saved.id} className="backdrop-blur-xl bg-white/70 dark:bg-card/70 border-white/20 shadow-sm hover:shadow-lg transition-all duration-300 rounded-xl overflow-hidden group">
                            <CardContent className="p-4">
                              <div className="flex gap-4">
                                <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-amber-500/10 to-orange-500/10 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                                  <Landmark className="h-6 w-6 text-amber-600" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-start justify-between gap-2">
                                    <div>
                                      <Link
                                        to={`/government-jobs/${saved.gov_job_id}`}
                                        className="font-semibold hover:text-primary transition-colors"
                                      >
                                        {saved.gov_job?.title}
                                      </Link>
                                      <p className="text-sm text-muted-foreground">
                                        {saved.gov_job?.organization}
                                      </p>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                      <Badge className={`text-xs ${saved.status === 'applied' ? 'bg-amber-500 text-white' : 'bg-primary text-primary-foreground'}`}>
                                        {saved.status === 'applied' ? (
                                          <><Heart className="h-3 w-3 mr-1 fill-current" /> Applied</>
                                        ) : (
                                          <><BookmarkCheck className="h-3 w-3 mr-1" /> Interested</>
                                        )}
                                      </Badge>
                                      <Button variant="outline" size="sm" className="backdrop-blur-sm bg-white/50 hover:bg-gradient-primary hover:text-white hover:border-transparent transition-all" asChild>
                                        <Link to={`/government-jobs/${saved.gov_job_id}`}>View</Link>
                                      </Button>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                                    {saved.gov_job?.location && (
                                      <span className="flex items-center gap-1">
                                        <MapPin className="h-3 w-3" />
                                        {saved.gov_job.location}
                                      </span>
                                    )}
                                    {saved.gov_job?.last_date && (
                                      <span className="flex items-center gap-1">
                                        <Clock className="h-3 w-3" />
                                        Last Date: {saved.gov_job.last_date}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </>
                    )}

                    {/* Saved Private Jobs */}
                    {savedJobs.length > 0 && (
                      <>
                        {savedGovJobs.length > 0 && (
                          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2 mt-6">
                            <Briefcase className="h-4 w-4" /> Private Jobs ({savedJobs.length})
                          </h3>
                        )}
                        {savedJobs.map((saved) => (
                          <Card key={saved.id} className="backdrop-blur-xl bg-white/70 dark:bg-card/70 border-white/20 shadow-sm hover:shadow-lg transition-all duration-300 rounded-xl overflow-hidden group">
                            <CardContent className="p-4">
                              <div className="flex gap-4">
                                <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary/10 to-accent/10 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                                  {saved.job?.company?.logo_url ? (
                                    <img
                                      src={saved.job.company.logo_url}
                                      alt={`${saved.job.company.name} logo`}
                                      className="h-8 w-8 object-contain"
                                    />
                                  ) : (
                                    <Building2 className="h-6 w-6 text-primary" />
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-start justify-between gap-2">
                                    <div>
                                      <Link
                                        to={`/jobs/${saved.job_id}`}
                                        className="font-semibold hover:text-primary transition-colors"
                                      >
                                        {saved.job?.title}
                                      </Link>
                                      <p className="text-sm text-muted-foreground">
                                        {saved.job?.company?.name}
                                      </p>
                                    </div>
                                    <Button variant="outline" size="sm" className="backdrop-blur-sm bg-white/50 hover:bg-gradient-primary hover:text-white hover:border-transparent transition-all" asChild>
                                      <Link to={`/jobs/${saved.job_id}`}>Apply</Link>
                                    </Button>
                                  </div>
                                  <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                                    <span className="flex items-center gap-1">
                                      <MapPin className="h-3 w-3" />
                                      {saved.job?.location || 'Remote'}
                                    </span>
                                    <span className="flex items-center gap-1">
                                      <Clock className="h-3 w-3" />
                                      Saved {formatDistanceToNow(new Date(saved.saved_at), { addSuffix: true })}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </>
                    )}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="resume">
                <AIResumeWriter />
              </TabsContent>
            </Tabs>
          </div>

          {/* Sidebar - AI-Matched Jobs */}
          <div>
            <Card className="backdrop-blur-xl bg-white/70 dark:bg-card/70 border-white/20 shadow-xl rounded-2xl overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-primary/5 via-accent/5 to-primary/5 border-b border-white/20">
                <CardTitle className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg bg-gradient-primary flex items-center justify-center shadow-lg shadow-primary/25">
                    <Sparkles className="h-4 w-4 text-white" />
                  </div>
                  <span className="text-gradient-primary">{t('dashboard.recommendations')}</span>
                </CardTitle>
                <CardDescription>
                  AI-powered matches based on your profile
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4">
                {matchedJobs.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-sm text-muted-foreground mb-4">
                      Add skills to your profile to get personalized recommendations
                    </p>
                    <Button variant="outline" size="sm" className="backdrop-blur-sm bg-white/50" asChild>
                      <Link to="/profile">Update Skills</Link>
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {matchedJobs.map((match) => {
                      const scoreDisplay = getMatchScoreDisplay(match.score);
                      return (
                        <Link
                          key={match.job.id}
                          to={`/jobs/${match.job.id}`}
                          className="block p-3 rounded-xl hover:bg-gradient-to-r hover:from-primary/5 hover:to-accent/5 transition-all duration-300 border border-white/20 hover:border-primary/20 hover:shadow-md group"
                        >
                          <div className="flex items-start gap-3">
                            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary/10 to-accent/10 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                              {match.job.company?.logo_url ? (
                                <img
                                  src={match.job.company.logo_url}
                                  alt={`${match.job.company.name} logo`}
                                  className="h-6 w-6 object-contain"
                                />
                              ) : (
                                <Building2 className="h-5 w-5 text-primary" />
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-2">
                                <h4 className="font-medium text-sm line-clamp-1">{match.job.title}</h4>
                                <Badge 
                                  variant="secondary" 
                                  className={`${scoreDisplay.bgColor} ${scoreDisplay.color} text-xs shrink-0 shadow-sm`}
                                >
                                  {match.score}%
                                </Badge>
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {match.job.company?.name}
                              </p>
                              <p className="text-xs text-muted-foreground mt-1">
                                {scoreDisplay.label}
                              </p>
                            </div>
                          </div>
                        </Link>
                      );
                    })}
                    <Button variant="outline" className="w-full backdrop-blur-sm bg-white/50 hover:bg-gradient-primary hover:text-white hover:border-transparent transition-all" asChild>
                      <Link to="/jobs">View All Jobs</Link>
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
        </div>
      </div>
    </Layout>
  );
}
