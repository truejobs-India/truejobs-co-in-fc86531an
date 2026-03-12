import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Layout } from '@/components/layout/Layout';
import { SEO } from '@/components/SEO';
import { Job, Application, Company } from '@/types/database';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Briefcase, Building2, Users, Eye, FileText, Plus, TrendingUp,
  Clock, CheckCircle, XCircle, MoreHorizontal, Edit, Pause, Play, Trash2,
  LayoutDashboard, Settings, CreditCard, LogOut, AlertTriangle, ChevronRight,
  UserCircle, CalendarClock
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { formatDistanceToNow, differenceInDays, parseISO } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  pending_approval: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  active: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  paused: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  closed: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  expired: 'bg-muted text-muted-foreground',
};

const SIDEBAR_ITEMS = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/employer/dashboard' },
  { icon: Plus, label: 'Post a Job', path: '/employer/post-job' },
  { icon: Briefcase, label: 'Manage Jobs', path: '/employer/dashboard', section: 'jobs' },
  { icon: Users, label: 'Applications', path: '/employer/dashboard', section: 'apps' },
  { icon: Building2, label: 'Company Profile', path: '/employer/company' },
  { icon: CreditCard, label: 'Billing', path: '/employer/dashboard', section: 'billing', disabled: true },
  { icon: Settings, label: 'Settings', path: '/employer/dashboard', section: 'settings', disabled: true },
];

export default function EmployerDashboard() {
  const { user, signOut, profile } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();
  const location = useLocation();

  const [company, setCompany] = useState<Company | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [recentApplications, setRecentApplications] = useState<(Application & { job: Job; profile: any })[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeSection, setActiveSection] = useState('dashboard');
  const [stats, setStats] = useState({
    totalJobs: 0,
    activeJobs: 0,
    totalApplications: 0,
    totalViews: 0,
    expiringSoon: 0,
  });
  const [expiringJobs, setExpiringJobs] = useState<Job[]>([]);

  useEffect(() => {
    if (user) fetchData();
  }, [user]);

  const fetchData = async () => {
    setIsLoading(true);

    const { data: companyData } = await supabase
      .from('companies')
      .select('*')
      .eq('owner_id', user!.id)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (companyData) setCompany(companyData as Company);

    const { data: jobsData } = await supabase
      .from('jobs')
      .select('*')
      .eq('posted_by', user!.id)
      .or('is_deleted.is.null,is_deleted.eq.false')
      .order('created_at', { ascending: false });

    if (jobsData) {
      setJobs(jobsData as Job[]);

      const activeJobs = jobsData.filter((j) => j.status === 'active').length;
      const totalViews = jobsData.reduce((sum, j) => sum + (j.views_count || 0), 0);
      const totalApplications = jobsData.reduce((sum, j) => sum + (j.applications_count || 0), 0);

      // Find jobs expiring in next 7 days
      const expiring = jobsData.filter(j => {
        if (j.status !== 'active' || !j.expires_at) return false;
        const daysLeft = differenceInDays(parseISO(j.expires_at), new Date());
        return daysLeft >= 0 && daysLeft <= 7;
      }) as Job[];
      setExpiringJobs(expiring);

      setStats({
        totalJobs: jobsData.length,
        activeJobs,
        totalApplications,
        totalViews,
        expiringSoon: expiring.length,
      });
    }

    const { data: appsData } = await supabase
      .from('applications')
      .select('*, job:jobs(*), profile:profiles(*)')
      .in('job_id', jobsData?.map((j) => j.id) || [])
      .order('applied_at', { ascending: false })
      .limit(5);

    if (appsData) {
      setRecentApplications(appsData.map((app: any) => ({
        ...app, job: app.job, profile: app.profile
      })) as (Application & { job: Job; profile: any })[]);
    }

    setIsLoading(false);
  };

  const handleJobStatusChange = async (jobId: string, newStatus: 'draft' | 'pending_approval' | 'active' | 'paused' | 'closed' | 'expired' | 'archived') => {
    const { error } = await supabase.from('jobs').update({ status: newStatus }).eq('id', jobId);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: `Job ${newStatus === 'active' ? 'activated' : newStatus}` });
      fetchData();
    }
  };

  const handleDeleteJob = async (jobId: string) => {
    const { error, data } = await supabase
      .from('jobs')
      .update({ status: 'archived' as any, is_deleted: true })
      .eq('id', jobId)
      .eq('posted_by', user!.id)
      .select('id');

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else if (!data || data.length === 0) {
      toast({ title: 'Error', description: 'Could not delete this job.', variant: 'destructive' });
    } else {
      toast({ title: 'Job deleted successfully' });
      fetchData();
    }
  };

  if (isLoading) {
    return (
      <Layout noAds>
        <div className="container mx-auto px-4 py-8">
          <Skeleton className="h-8 w-64 mb-8" />
          <div className="grid md:grid-cols-4 gap-6 mb-8">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-32" />)}
          </div>
          <Skeleton className="h-96" />
        </div>
      </Layout>
    );
  }

  if (!company) {
    return (
      <Layout noAds>
        <div className="container mx-auto px-4 py-16 text-center">
          <Building2 className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
          <h1 className="text-2xl font-bold mb-2">Set Up Your Company</h1>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            Before you can post jobs, complete your company profile.
          </p>
          <Button asChild size="lg">
            <Link to="/employer/company">
              <Plus className="h-4 w-4 mr-2" />
              Create Company Profile
            </Link>
          </Button>
        </div>
      </Layout>
    );
  }

  const statsCards = [
    { label: 'Total Jobs', value: stats.totalJobs, icon: Briefcase, color: 'text-primary bg-primary/10' },
    { label: 'Active Jobs', value: stats.activeJobs, icon: CheckCircle, color: 'text-green-600 bg-green-100 dark:bg-green-900/30' },
    { label: 'Applications', value: stats.totalApplications, icon: FileText, color: 'text-purple-600 bg-purple-100 dark:bg-purple-900/30' },
    { label: 'Total Views', value: stats.totalViews, icon: Eye, color: 'text-amber-600 bg-amber-100 dark:bg-amber-900/30' },
  ];

  return (
    <Layout noAds>
      <SEO title="Employer Dashboard" noindex />
      <div className="flex min-h-[calc(100vh-4rem)]">
        {/* Sidebar */}
        <aside className="hidden lg:flex w-64 flex-col border-r bg-card">
          {/* Company info */}
          <div className="p-5 border-b">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                {company.logo_url ? (
                  <img src={company.logo_url} alt={company.name} className="h-8 w-8 rounded object-contain" />
                ) : (
                  <Building2 className="h-5 w-5 text-primary" />
                )}
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-sm truncate">{company.name}</p>
                <p className="text-xs text-muted-foreground truncate">{profile?.email}</p>
              </div>
            </div>
          </div>

          {/* Nav */}
          <nav className="flex-1 p-3 space-y-1">
            {SIDEBAR_ITEMS.map((item) => {
              const isActive = item.section
                ? activeSection === item.section
                : location.pathname === item.path && activeSection === 'dashboard';
              return (
                <Link
                  key={item.label}
                  to={item.disabled ? '#' : item.path}
                  onClick={(e) => {
                    if (item.disabled) { e.preventDefault(); return; }
                    if (item.section) { e.preventDefault(); setActiveSection(item.section); }
                    else setActiveSection('dashboard');
                  }}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                    item.disabled && 'opacity-40 cursor-not-allowed'
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                  {item.disabled && (
                    <Badge variant="outline" className="ml-auto text-[10px] px-1.5 py-0">Soon</Badge>
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Logout */}
          <div className="p-3 border-t">
            <button
              onClick={() => signOut()}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive w-full transition-colors"
            >
              <LogOut className="h-4 w-4" />
              Logout
            </button>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto">
          <div className="p-6 lg:p-8 max-w-6xl mx-auto space-y-8">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl lg:text-3xl font-bold">Employer Dashboard</h1>
                <p className="text-muted-foreground mt-1">
                  Welcome back, {profile?.full_name || 'Employer'}
                </p>
              </div>
              <div className="flex gap-3">
                <Button variant="outline" asChild className="lg:hidden">
                  <Link to="/employer/company">
                    <Building2 className="h-4 w-4 mr-2" />
                    Company
                  </Link>
                </Button>
                <Button asChild>
                  <Link to="/employer/post-job">
                    <Plus className="h-4 w-4 mr-2" />
                    Post a Job
                  </Link>
                </Button>
              </div>
            </div>

            {/* Stats Cards */}
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {statsCards.map((stat) => (
                <Card key={stat.label} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">{stat.label}</p>
                        <p className="text-3xl font-bold mt-1">{stat.value.toLocaleString()}</p>
                      </div>
                      <div className={cn('h-11 w-11 rounded-xl flex items-center justify-center', stat.color)}>
                        <stat.icon className="h-5 w-5" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Expiring Soon Alert */}
            {expiringJobs.length > 0 && (
              <Card className="border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2 text-amber-700 dark:text-amber-400">
                    <AlertTriangle className="h-4 w-4" />
                    {expiringJobs.length} Job{expiringJobs.length > 1 ? 's' : ''} Expiring Soon
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {expiringJobs.slice(0, 3).map(job => {
                      const daysLeft = differenceInDays(parseISO(job.expires_at!), new Date());
                      return (
                        <div key={job.id} className="flex items-center justify-between text-sm">
                          <span className="font-medium truncate mr-4">{job.title}</span>
                          <Badge variant="outline" className="text-amber-600 border-amber-300 flex-shrink-0">
                            <CalendarClock className="h-3 w-3 mr-1" />
                            {daysLeft === 0 ? 'Expires today' : `${daysLeft} day${daysLeft > 1 ? 's' : ''} left`}
                          </Badge>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Main Grid */}
            <div className="grid lg:grid-cols-3 gap-6">
              {/* Jobs List */}
              <div className="lg:col-span-2">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-4">
                    <div>
                      <CardTitle className="text-lg">Your Jobs</CardTitle>
                      <CardDescription>Manage and track your posted positions</CardDescription>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {jobs.length === 0 ? (
                      <div className="text-center py-12">
                        <Briefcase className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                        <h3 className="text-lg font-semibold mb-2">No Jobs Posted</h3>
                        <p className="text-muted-foreground mb-4">Create your first job listing to attract candidates.</p>
                        <Button asChild><Link to="/employer/post-job">Post a Job</Link></Button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {jobs.slice(0, 6).map((job) => (
                          <div key={job.id} className="flex items-center justify-between p-4 border rounded-xl hover:bg-accent/30 transition-colors">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <Link to={`/jobs/${job.id}`} className="font-semibold hover:text-primary transition-colors truncate">
                                  {job.title}
                                </Link>
                                <Badge className={cn('text-xs', STATUS_COLORS[job.status])}>
                                  {job.status.replace('_', ' ')}
                                </Badge>
                                {job.is_featured && <Badge variant="outline" className="text-xs">Featured</Badge>}
                              </div>
                              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <Users className="h-3 w-3" /> {job.applications_count} applicants
                                </span>
                                <span className="flex items-center gap-1">
                                  <Eye className="h-3 w-3" /> {job.views_count} views
                                </span>
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {formatDistanceToNow(new Date(job.created_at), { addSuffix: true })}
                                </span>
                              </div>
                            </div>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="flex-shrink-0">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem asChild>
                                  <Link to={`/jobs/${job.id}`}><Eye className="h-4 w-4 mr-2" />View</Link>
                                </DropdownMenuItem>
                                {job.status === 'active' ? (
                                  <DropdownMenuItem onClick={() => handleJobStatusChange(job.id, 'paused')}>
                                    <Pause className="h-4 w-4 mr-2" />Pause
                                  </DropdownMenuItem>
                                ) : job.status === 'paused' ? (
                                  <DropdownMenuItem onClick={() => handleJobStatusChange(job.id, 'active')}>
                                    <Play className="h-4 w-4 mr-2" />Activate
                                  </DropdownMenuItem>
                                ) : null}
                                <DropdownMenuItem onClick={() => handleJobStatusChange(job.id, 'closed')}>
                                  <XCircle className="h-4 w-4 mr-2" />Close
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleDeleteJob(job.id)} className="text-destructive">
                                  <Trash2 className="h-4 w-4 mr-2" />Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Right Column */}
              <div className="space-y-6">
                {/* Recent Applicants */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-primary" />
                      Recent Applicants
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {recentApplications.length === 0 ? (
                      <p className="text-center text-sm text-muted-foreground py-6">No applications yet</p>
                    ) : (
                      <div className="space-y-3">
                        {recentApplications.map((app) => (
                          <div key={app.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent/30 transition-colors">
                            <Avatar className="h-9 w-9">
                              <AvatarFallback className="bg-primary/10 text-primary text-xs">
                                {(app.profile?.full_name || 'A').charAt(0).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0 flex-1">
                              <p className="font-medium text-sm truncate">{app.profile?.full_name || 'Anonymous'}</p>
                              <p className="text-xs text-muted-foreground truncate">
                                Applied for {app.job?.title}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {formatDistanceToNow(new Date(app.applied_at), { addSuffix: true })}
                              </p>
                            </div>
                            <Badge variant="outline" className="text-xs flex-shrink-0">
                              {app.status}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Quick Actions */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Quick Actions</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <Button variant="outline" className="w-full justify-between" asChild>
                      <Link to="/employer/post-job">
                        Post New Job <ChevronRight className="h-4 w-4" />
                      </Link>
                    </Button>
                    <Button variant="outline" className="w-full justify-between" asChild>
                      <Link to="/employer/company">
                        Edit Company Profile <ChevronRight className="h-4 w-4" />
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </main>
      </div>
    </Layout>
  );
}
