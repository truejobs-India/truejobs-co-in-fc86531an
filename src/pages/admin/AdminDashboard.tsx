import { useState, useEffect } from 'react';
import { Layout } from '@/components/layout/Layout';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AdminMessagesProvider, useAdminToast, useAdminMessagesContext } from '@/contexts/AdminMessagesContext';
import { AdminMessageLog } from '@/components/admin/AdminMessageLog';
import { supabase } from '@/integrations/supabase/client';
import { 
  Users, 
  Building2, 
  Clock,
  TrendingUp,
  RefreshCw,
  FileText,
  Calendar,
  BarChart3,
  ClipboardList,
  CreditCard,
  Landmark,
  Sparkles,
  Newspaper,
  Shield,
  Globe,
  Download,
  MessageSquare,
  Rss,
  Search,
  Bug,
  Bot,
  Bell,
} from 'lucide-react';
import { RssIntakeManager } from '@/components/admin/rss-intake/RssIntakeManager';
import { EmploymentNewsManager } from '@/components/admin/EmploymentNewsManager';
import { CompanyApprovalList } from '@/components/admin/CompanyApprovalList';
import { BlogPostEditor } from '@/components/admin/BlogPostEditor';
import { CronJobManager } from '@/components/admin/CronJobManager';
import { DrilldownBreadcrumb, BreadcrumbItem } from '@/components/admin/DrilldownBreadcrumb';
import { CompaniesListView } from '@/components/admin/CompaniesListView';
import { CompanyJobsView } from '@/components/admin/CompanyJobsView';
import { BlockedCompaniesManager } from '@/components/admin/BlockedCompaniesManager';

import { UsersListView } from '@/components/admin/UsersListView';
import { PollsManager } from '@/components/admin/PollsManager';
import { ContestsManager } from '@/components/admin/ContestsManager';
import { SurveysManager } from '@/components/admin/SurveysManager';
import { JobPlansManager } from '@/components/admin/JobPlansManager';
import { EnrollmentsManager } from '@/components/admin/EnrollmentsManager';
import { GSCUrlExport } from '@/components/admin/GSCUrlExport';
import { SEOCacheManager } from '@/components/admin/seo-cache/SEOCacheManager';
import { SEOCacheBuilder } from '@/components/admin/SEOCacheBuilder';
import { SEOContentHealth } from '@/components/admin/SEOContentHealth';
import { BulkBlogUpload } from '@/components/admin/BulkBlogUpload';
import { GovtExamsManager } from '@/components/admin/GovtExamsManager';
import { GuideGenerator } from '@/components/admin/GuideGenerator';
import { ContentEnricher } from '@/components/admin/ContentEnricher';
import { SEORoutePolicyDashboard } from '@/components/admin/seo-policy/SEORoutePolicyDashboard';
import { VertexAITestPanel } from '@/components/admin/VertexAITestPanel';
import { CustomPagesManager } from '@/components/admin/CustomPagesManager';
import { PdfResourcesManager } from '@/components/admin/PdfResourcesManager';
import { ChatbotSettingsManager } from '@/components/admin/ChatbotSettingsManager';
import { ChatbotAnalytics } from '@/components/admin/ChatbotAnalytics';
import { SitewideSeoAudit } from '@/components/admin/SitewideSeoAudit';
import { FirecrawlDraftsManager } from '@/components/admin/firecrawl/FirecrawlDraftsManager';
import { IntakeDraftsManager } from '@/components/admin/intake/IntakeDraftsManager';
import { NotificationCentre } from '@/components/admin/notifications/NotificationCentre';
import { ChatGptAgentManager } from '@/components/admin/chatgpt-agent/ChatGptAgentManager';
import { useNavigate } from 'react-router-dom';

type DrilldownView = 
  | { type: 'dashboard' }
  | { type: 'users' }
  | { type: 'companies' }
  | { type: 'company-jobs'; companyName: string };

interface DashboardStats {
  totalUsers: number;
  totalCompanies: number;
  pendingCompanies: number;
  totalApplications: number;
}

function AdminDashboardInner() {
  const { toast } = useAdminToast();
  const { messages, dismissMessage, clearAll, toggleExpand } = useAdminMessagesContext();
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats>({
    totalUsers: 0,
    totalCompanies: 0,
    pendingCompanies: 0,
    totalApplications: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [currentView, setCurrentView] = useState<DrilldownView>({ type: 'dashboard' });
  const [companyRefreshKey, setCompanyRefreshKey] = useState(0);

  useEffect(() => {
    fetchStats();
  }, []);

  // Helper function to fetch all company names with pagination
  const fetchAllCompanyNames = async (): Promise<Set<string>> => {
    const uniqueNames = new Set<string>();
    const pageSize = 1000;
    let page = 0;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabase
        .from('jobs')
        .select('company_name')
        .not('company_name', 'is', null)
        .not('company_name', 'eq', '')
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (error || !data || data.length === 0) {
        hasMore = false;
      } else {
        data.forEach((job: { company_name: string | null }) => {
          const name = job.company_name?.trim().toLowerCase();
          if (name) uniqueNames.add(name);
        });
        hasMore = data.length === pageSize;
        page++;
      }
    }

    return uniqueNames;
  };

  const fetchStats = async () => {
    try {
      const [
        usersResult,
        uniqueCompanyNames,
        pendingCompaniesResult,
        applicationsResult,
      ] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        fetchAllCompanyNames(),
        supabase.from('companies').select('id', { count: 'exact', head: true }).eq('is_approved', false),
        supabase.from('applications').select('id', { count: 'exact', head: true }),
      ]);

      setStats({
        totalUsers: usersResult.count || 0,
        totalCompanies: uniqueCompanyNames.size,
        pendingCompanies: pendingCompaniesResult.count || 0,
        totalApplications: applicationsResult.count || 0,
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
      toast({
        title: 'Error',
        description: 'Failed to load dashboard statistics',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const statCards = [
    { title: 'Total Users', value: stats.totalUsers, icon: Users, color: 'text-blue-500', onClick: () => setCurrentView({ type: 'users' }) },
    { title: 'Companies', value: stats.totalCompanies, icon: Building2, color: 'text-indigo-500', onClick: () => setCurrentView({ type: 'companies' }) },
    { title: 'Pending Companies', value: stats.pendingCompanies, icon: Clock, color: 'text-orange-500', onClick: () => {} },
    { title: 'Applications', value: stats.totalApplications, icon: TrendingUp, color: 'text-pink-500', onClick: () => {} },
  ];

  // Build breadcrumb items based on current view
  const getBreadcrumbItems = (): BreadcrumbItem[] => {
    switch (currentView.type) {
      case 'users':
        return [{ label: 'Users' }];
      case 'companies':
        return [{ label: 'Companies' }];
      case 'company-jobs':
        return [
          { label: 'Companies', onClick: () => setCurrentView({ type: 'companies' }) },
          { label: currentView.companyName }
        ];
      default:
        return [];
    }
  };

  return (
    <Layout noAds>
      <div className="w-full max-w-none py-8 px-4 xl:px-6 2xl:px-8">
        {/* Persistent Admin Messages */}
        <AdminMessageLog
          messages={messages}
          onDismiss={dismissMessage}
          onClearAll={clearAll}
          onToggleExpand={toggleExpand}
        />

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold">Admin Dashboard</h1>
            <p className="text-muted-foreground mt-1">
              Manage jobs, companies, and users
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={fetchStats} variant="outline" size="icon">
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Breadcrumb for drilldown navigation */}
        <DrilldownBreadcrumb 
          items={getBreadcrumbItems()} 
          onHomeClick={() => setCurrentView({ type: 'dashboard' })} 
        />

        {/* Conditional rendering based on current view */}
        {currentView.type === 'dashboard' ? (
          <>
            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              {statCards.map((stat) => (
                <Card 
                  key={stat.title} 
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={stat.onClick}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg bg-muted ${stat.color}`}>
                        <stat.icon className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold">
                          {isLoading ? '...' : stat.value.toLocaleString()}
                        </p>
                        <p className="text-xs text-muted-foreground">{stat.title}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Management Tabs */}
            <Tabs defaultValue="jobs" className="space-y-4">
              <TabsList className="flex flex-wrap !h-auto !w-full gap-2 p-3 overflow-visible min-h-0 items-start">
                <TabsTrigger value="users" className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  <span className="hidden sm:inline">Users</span>
                </TabsTrigger>
                <TabsTrigger value="companies" className="flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  <span className="hidden sm:inline">Companies</span>
                  {stats.pendingCompanies > 0 && (
                    <Badge variant="destructive" className="ml-1">
                      {stats.pendingCompanies}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="engagement" className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  <span className="hidden sm:inline">Engagement</span>
                </TabsTrigger>
                <TabsTrigger value="scheduler" className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  <span className="hidden sm:inline">Scheduler</span>
                </TabsTrigger>
                <TabsTrigger value="enrollments" className="flex items-center gap-2">
                  <ClipboardList className="h-4 w-4" />
                  <span className="hidden sm:inline">Enrollments</span>
                </TabsTrigger>
                <TabsTrigger value="blog" className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  <span className="hidden sm:inline">Blog</span>
                </TabsTrigger>
                <TabsTrigger value="bulk-blog" className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  <span className="hidden sm:inline">Bulk Upload</span>
                </TabsTrigger>
                <TabsTrigger value="seo" className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  <span className="hidden sm:inline">SEO</span>
                </TabsTrigger>
                <TabsTrigger value="job-plans" className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4" />
                  <span className="hidden sm:inline">Job Plans</span>
                </TabsTrigger>
                <TabsTrigger value="govt-jobs" className="flex items-center gap-2">
                  <Landmark className="h-4 w-4" />
                  <span className="hidden sm:inline">Govt Jobs</span>
                </TabsTrigger>
                <TabsTrigger value="enrichment" className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4" />
                  <span className="hidden sm:inline">Enrichment</span>
                </TabsTrigger>
                <TabsTrigger value="emp-news" className="flex items-center gap-2">
                  <Newspaper className="h-4 w-4" />
                  <span className="hidden sm:inline">Emp News</span>
                </TabsTrigger>
                <TabsTrigger value="seo-policy" className="flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  <span className="hidden sm:inline">SEO Policy</span>
                </TabsTrigger>
                <TabsTrigger value="custom-pages" className="flex items-center gap-2">
                  <Globe className="h-4 w-4" />
                  <span className="hidden sm:inline">Pages</span>
                </TabsTrigger>
                <TabsTrigger value="resources" className="flex items-center gap-2">
                  <Download className="h-4 w-4" />
                  <span className="hidden sm:inline">Resources</span>
                </TabsTrigger>
                <TabsTrigger value="ai-test" className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4" />
                  <span className="hidden sm:inline">AI Test</span>
                </TabsTrigger>
                <TabsTrigger value="chatbot" className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  <span className="hidden sm:inline">Chatbot</span>
                </TabsTrigger>
                <TabsTrigger value="rss-intake" className="flex items-center gap-2">
                  <Rss className="h-4 w-4" />
                  <span className="hidden sm:inline">RSS Intake</span>
                </TabsTrigger>
                <TabsTrigger value="seo-audit" className="flex items-center gap-2">
                  <Search className="h-4 w-4" />
                  <span className="hidden sm:inline">SEO Audit</span>
                </TabsTrigger>
                <TabsTrigger value="firecrawl" className="flex items-center gap-2">
                  <Bug className="h-4 w-4" />
                  <span className="hidden sm:inline">Firecrawl</span>
                </TabsTrigger>
                <TabsTrigger value="intake" className="flex items-center gap-2">
                  <ClipboardList className="h-4 w-4" />
                  <span className="hidden sm:inline">Intake</span>
                </TabsTrigger>
                <TabsTrigger value="notifications" className="flex items-center gap-2">
                  <Bell className="h-4 w-4" />
                  <span className="hidden sm:inline">Notifications</span>
                </TabsTrigger>
                <TabsTrigger value="chatgpt-agent" className="flex items-center gap-2">
                  <Bot className="h-4 w-4" />
                  <span className="hidden sm:inline">ChatGPT Agent</span>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="users">
                <UsersListView />
              </TabsContent>


              <TabsContent value="companies" className="space-y-6">
                <CompanyApprovalList onStatsChange={fetchStats} />
                <CompaniesListView 
                  onCompanyClick={(name) => setCurrentView({ type: 'company-jobs', companyName: name })}
                  refreshKey={companyRefreshKey}
                />
                <BlockedCompaniesManager />
              </TabsContent>

              <TabsContent value="engagement" className="space-y-6">
                <JobPlansManager />
                <PollsManager />
                <ContestsManager />
                <SurveysManager />
              </TabsContent>

              <TabsContent value="scheduler">
                <CronJobManager />
              </TabsContent>

              <TabsContent value="enrollments">
                <EnrollmentsManager />
              </TabsContent>

              <TabsContent value="blog">
                <BlogPostEditor />
              </TabsContent>

              <TabsContent value="bulk-blog">
                <BulkBlogUpload />
              </TabsContent>

              <TabsContent value="seo" className="space-y-6">
                <SEOContentHealth />
                <SEOCacheManager />
                <SEOCacheBuilder />
                <GuideGenerator />
                <GSCUrlExport />
              </TabsContent>

              <TabsContent value="job-plans">
                <JobPlansManager />
              </TabsContent>

              <TabsContent value="govt-jobs">
                <GovtExamsManager />
              </TabsContent>

              <TabsContent value="enrichment">
                <ContentEnricher />
              </TabsContent>

              <TabsContent value="emp-news">
                <EmploymentNewsManager />
              </TabsContent>

              <TabsContent value="seo-policy">
                <SEORoutePolicyDashboard />
              </TabsContent>

              <TabsContent value="custom-pages">
                <CustomPagesManager />
              </TabsContent>

              <TabsContent value="resources">
                <PdfResourcesManager />
              </TabsContent>

              <TabsContent value="ai-test">
                <VertexAITestPanel />
              </TabsContent>

              <TabsContent value="chatbot" className="space-y-6">
                <ChatbotSettingsManager />
                <ChatbotAnalytics />
              </TabsContent>

              <TabsContent value="rss-intake">
                <RssIntakeManager />
              </TabsContent>

              <TabsContent value="seo-audit">
                <SitewideSeoAudit />
              </TabsContent>

              <TabsContent value="firecrawl" className="w-full max-w-none">
                <FirecrawlDraftsManager />
              </TabsContent>

              <TabsContent value="intake" className="w-full max-w-none">
                <IntakeDraftsManager />
              </TabsContent>

              <TabsContent value="notifications">
                <NotificationCentre />
              </TabsContent>

              <TabsContent value="chatgpt-agent" className="w-full max-w-none">
                <ChatGptAgentManager />
              </TabsContent>
            </Tabs>
          </>
        ) : currentView.type === 'users' ? (
          <UsersListView />
        ) : currentView.type === 'companies' ? (
          <CompaniesListView 
            onCompanyClick={(name) => setCurrentView({ type: 'company-jobs', companyName: name })}
            refreshKey={companyRefreshKey}
          />
        ) : currentView.type === 'company-jobs' ? (
          <CompanyJobsView companyName={currentView.companyName} onJobsChanged={() => setCompanyRefreshKey(k => k + 1)} />
        ) : null}
      </div>
    </Layout>
  );
}

export default function AdminDashboard() {
  return (
    <AdminMessagesProvider>
      <AdminDashboardInner />
    </AdminMessagesProvider>
  );
}
