import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Application, Job, CompanyResearch as CompanyResearchType } from '@/types/database';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Briefcase, Building2, MapPin, Clock, FileText, CalendarDays, 
  Bell, StickyNote, ChevronRight, Send, Eye, TrendingUp, 
  User, CheckCircle, XCircle, Search, Filter
} from 'lucide-react';
import { formatDistanceToNow, format, isPast, isToday, addDays } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { CompanyResearch } from './CompanyResearch';
import { cn } from '@/lib/utils';

interface ApplicationWithJob extends Application {
  job: Job & { company?: { name: string; logo_url?: string; website_url?: string } };
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  applied: { label: 'Applied', color: 'bg-blue-500', icon: Send },
  viewed: { label: 'Viewed', color: 'bg-purple-500', icon: Eye },
  shortlisted: { label: 'Shortlisted', color: 'bg-amber-500', icon: TrendingUp },
  interviewing: { label: 'Interviewing', color: 'bg-cyan-500', icon: User },
  offered: { label: 'Offered', color: 'bg-green-500', icon: CheckCircle },
  rejected: { label: 'Rejected', color: 'bg-red-500', icon: XCircle },
  withdrawn: { label: 'Withdrawn', color: 'bg-gray-500', icon: XCircle },
};

export function ApplicationTracker() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [applications, setApplications] = useState<ApplicationWithJob[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedApp, setSelectedApp] = useState<ApplicationWithJob | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  useEffect(() => {
    if (user) {
      fetchApplications();
    }
  }, [user]);

  const fetchApplications = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('applications')
      .select('*, job:jobs(*, company:companies(name, logo_url, website_url))')
      .eq('applicant_id', user!.id)
      .order('applied_at', { ascending: false });

    if (error) {
      console.error('Error fetching applications:', error);
      toast({ title: 'Error loading applications', variant: 'destructive' });
    } else if (data) {
      setApplications(data.map((app: any) => ({
        ...app,
        job: app.job
      })) as ApplicationWithJob[]);
    }
    setIsLoading(false);
  };

  const updateApplication = async (appId: string, updates: Record<string, unknown>) => {
    const { error } = await supabase
      .from('applications')
      .update(updates)
      .eq('id', appId);

    if (error) {
      toast({ title: 'Error updating application', variant: 'destructive' });
    } else {
      toast({ title: 'Application updated' });
      fetchApplications();
      if (selectedApp?.id === appId) {
        setSelectedApp({ ...selectedApp, ...updates } as ApplicationWithJob);
      }
    }
  };

  const saveNotes = async (appId: string, notes: string) => {
    await updateApplication(appId, { seeker_notes: notes });
  };

  const setFollowUpDate = async (appId: string, date: Date | undefined) => {
    await updateApplication(appId, { 
      follow_up_date: date?.toISOString() || null,
      reminder_sent: false 
    });
  };

  const handleResearchFetched = async (appId: string, research: CompanyResearchType) => {
    await updateApplication(appId, { company_research: research as unknown as Record<string, unknown> });
  };

  const filteredApplications = applications.filter((app) => {
    const matchesSearch = 
      app.job?.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.job?.company?.name?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || app.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const upcomingReminders = applications.filter(
    (app) => app.follow_up_date && !isPast(new Date(app.follow_up_date))
  ).sort((a, b) => 
    new Date(a.follow_up_date!).getTime() - new Date(b.follow_up_date!).getTime()
  );

  const stats = {
    total: applications.length,
    active: applications.filter((a) => !['rejected', 'withdrawn'].includes(a.status)).length,
    interviewing: applications.filter((a) => a.status === 'interviewing').length,
    offers: applications.filter((a) => a.status === 'offered').length,
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-xs text-muted-foreground">Total Applications</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.active}</p>
                <p className="text-xs text-muted-foreground">Active</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-cyan-100 dark:bg-cyan-900 flex items-center justify-center">
                <User className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.interviewing}</p>
                <p className="text-xs text-muted-foreground">Interviewing</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-amber-100 dark:bg-amber-900 flex items-center justify-center">
                <CheckCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.offers}</p>
                <p className="text-xs text-muted-foreground">Offers</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Upcoming Reminders */}
      {upcomingReminders.length > 0 && (
        <Card className="border-amber-500 bg-amber-50 dark:bg-amber-950">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Bell className="h-4 w-4 text-amber-600" />
              Upcoming Follow-ups
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {upcomingReminders.slice(0, 5).map((app) => (
                <Badge 
                  key={app.id} 
                  variant="outline"
                  className={cn(
                    "cursor-pointer",
                    isToday(new Date(app.follow_up_date!)) && "bg-amber-200 dark:bg-amber-800"
                  )}
                  onClick={() => {
                    setSelectedApp(app);
                    setIsDetailsOpen(true);
                  }}
                >
                  {app.job?.company?.name} - {format(new Date(app.follow_up_date!), 'MMM d')}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search and Filter */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by job or company..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2 sm:pb-0">
          <Button
            variant={statusFilter === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter('all')}
          >
            All
          </Button>
          {Object.entries(STATUS_CONFIG).slice(0, 4).map(([key, config]) => (
            <Button
              key={key}
              variant={statusFilter === key ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter(key)}
            >
              {config.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Applications List */}
      <Card>
        <CardContent className="p-0">
          {filteredApplications.length === 0 ? (
            <div className="text-center py-12">
              <Briefcase className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No applications found</h3>
              <p className="text-muted-foreground mb-4">
                {applications.length === 0 
                  ? "Start applying to jobs to track them here"
                  : "Try adjusting your search or filters"}
              </p>
              {applications.length === 0 && (
                <Button asChild>
                  <Link to="/jobs">Browse Jobs</Link>
                </Button>
              )}
            </div>
          ) : (
            <ScrollArea className="h-[500px]">
              <div className="divide-y">
                {filteredApplications.map((app) => {
                  const statusConfig = STATUS_CONFIG[app.status];
                  const StatusIcon = statusConfig?.icon || Send;

                  return (
                    <div
                      key={app.id}
                      className="p-4 hover:bg-muted/50 cursor-pointer transition-colors"
                      onClick={() => {
                        setSelectedApp(app);
                        setIsDetailsOpen(true);
                      }}
                    >
                      <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center shrink-0">
                          {app.job?.company?.logo_url ? (
                            <img 
                              src={app.job.company.logo_url} 
                              alt={`${app.job.company.name} logo`}
                              className="h-10 w-10 object-contain rounded"
                            />
                          ) : (
                            <Building2 className="h-6 w-6 text-muted-foreground" />
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-semibold truncate">{app.job?.title}</h4>
                            <Badge className={`${statusConfig?.color} text-white text-xs shrink-0`}>
                              <StatusIcon className="h-3 w-3 mr-1" />
                              {statusConfig?.label}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-3 text-sm text-muted-foreground">
                            <span className="truncate">{app.job?.company?.name}</span>
                            {app.job?.location && (
                              <span className="flex items-center gap-1 shrink-0">
                                <MapPin className="h-3 w-3" />
                                {app.job.location}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="text-right shrink-0 hidden sm:block">
                          <p className="text-sm text-muted-foreground">
                            {formatDistanceToNow(new Date(app.applied_at), { addSuffix: true })}
                          </p>
                          <div className="flex items-center gap-2 mt-1 justify-end">
                            {app.follow_up_date && (
                              <Badge variant="outline" className="text-xs">
                                <Bell className="h-3 w-3 mr-1" />
                                {format(new Date(app.follow_up_date), 'MMM d')}
                              </Badge>
                            )}
                            {app.seeker_notes && (
                              <StickyNote className="h-4 w-4 text-amber-500" />
                            )}
                          </div>
                        </div>

                        <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Application Details Dialog */}
      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedApp?.job?.title}
              {selectedApp && (
                <Badge className={`${STATUS_CONFIG[selectedApp.status]?.color} text-white`}>
                  {STATUS_CONFIG[selectedApp.status]?.label}
                </Badge>
              )}
            </DialogTitle>
            <DialogDescription>
              {selectedApp?.job?.company?.name} • Applied {selectedApp && formatDistanceToNow(new Date(selectedApp.applied_at), { addSuffix: true })}
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="flex-1 -mx-6 px-6">
            <Tabs defaultValue="details" className="w-full">
              <TabsList className="grid grid-cols-3 w-full">
                <TabsTrigger value="details">Details</TabsTrigger>
                <TabsTrigger value="notes">Notes</TabsTrigger>
                <TabsTrigger value="research">Research</TabsTrigger>
              </TabsList>

              <TabsContent value="details" className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Status</label>
                    <p className="text-sm text-muted-foreground mt-1">
                      {STATUS_CONFIG[selectedApp?.status || 'applied']?.label}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Match Score</label>
                    <p className="text-sm text-muted-foreground mt-1">
                      {selectedApp?.match_score ? `${selectedApp.match_score}%` : 'N/A'}
                    </p>
                  </div>
                </div>

                {selectedApp?.cover_letter && (
                  <div>
                    <label className="text-sm font-medium">Cover Letter</label>
                    <p className="text-sm text-muted-foreground mt-1 whitespace-pre-line">
                      {selectedApp.cover_letter}
                    </p>
                  </div>
                )}

                <div>
                  <label className="text-sm font-medium mb-2 block">Follow-up Reminder</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start">
                        <CalendarDays className="h-4 w-4 mr-2" />
                        {selectedApp?.follow_up_date 
                          ? format(new Date(selectedApp.follow_up_date), 'PPP')
                          : 'Set reminder date'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={selectedApp?.follow_up_date ? new Date(selectedApp.follow_up_date) : undefined}
                        onSelect={(date) => selectedApp && setFollowUpDate(selectedApp.id, date)}
                        disabled={(date) => date < new Date()}
                        initialFocus
                      />
                      <div className="p-2 border-t flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => selectedApp && setFollowUpDate(selectedApp.id, addDays(new Date(), 3))}
                        >
                          In 3 days
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => selectedApp && setFollowUpDate(selectedApp.id, addDays(new Date(), 7))}
                        >
                          In 1 week
                        </Button>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="flex gap-2 pt-4">
                  <Button variant="outline" asChild className="flex-1">
                    <Link to={`/jobs/${selectedApp?.job_id}`}>
                      View Job
                    </Link>
                  </Button>
                  {selectedApp?.status === 'applied' && (
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => selectedApp && updateApplication(selectedApp.id, { status: 'withdrawn' })}
                    >
                      Withdraw
                    </Button>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="notes" className="mt-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Your Notes</label>
                  <Textarea
                    placeholder="Add notes about this application, interview prep, contacts, etc."
                    value={selectedApp?.seeker_notes || ''}
                    onChange={(e) => {
                      if (selectedApp) {
                        setSelectedApp({ ...selectedApp, seeker_notes: e.target.value });
                      }
                    }}
                    className="min-h-[200px]"
                  />
                  <Button
                    className="mt-4 w-full"
                    onClick={() => selectedApp && saveNotes(selectedApp.id, selectedApp.seeker_notes || '')}
                  >
                    Save Notes
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="research" className="mt-4">
                {selectedApp?.job?.company?.name && (
                  <CompanyResearch
                    companyName={selectedApp.job.company.name}
                    companyWebsite={selectedApp.job.company.website_url}
                    jobTitle={selectedApp.job.title}
                    existingResearch={selectedApp.company_research}
                    onResearchFetched={(research) => handleResearchFetched(selectedApp.id, research)}
                  />
                )}
              </TabsContent>
            </Tabs>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
