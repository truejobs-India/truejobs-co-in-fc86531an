import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAdminToast as useToast } from '@/contexts/AdminMessagesContext';
import { supabase } from '@/integrations/supabase/client';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Clock,
  Play,
  RefreshCw,
  Calendar,
  Mail,
  CheckCircle2,
  Loader2,
  AlertTriangle,
} from 'lucide-react';

interface CronJob {
  id: string;
  name: string;
  description: string;
  schedule: string;
  scheduleDescription: string;
  lastRun: string | null;
  nextRun: string;
  status: 'active' | 'paused' | 'error';
  type: 'reminders';
  functionName: string;
}

const SCHEDULED_TASKS: CronJob[] = [
  {
    id: 'reminder-emails',
    name: 'Follow-up Reminders',
    description: 'Sends email notifications for upcoming application follow-ups',
    schedule: '0 8 * * *',
    scheduleDescription: 'Daily at 8:00 AM UTC',
    lastRun: null,
    nextRun: '',
    status: 'active',
    type: 'reminders',
    functionName: 'send-reminder-emails',
  },
];

export function CronJobManager() {
  const { toast } = useToast();
  const [jobs, setJobs] = useState<CronJob[]>(SCHEDULED_TASKS);
  const [isLoading, setIsLoading] = useState(false);
  const [runningJob, setRunningJob] = useState<string | null>(null);
  const [reminderStats, setReminderStats] = useState({ pending: 0, sent: 0 });

  useEffect(() => {
    fetchStats();
    calculateNextRuns();
  }, []);

  const fetchStats = async () => {
    try {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      const { count: pendingCount } = await supabase
        .from('applications')
        .select('id', { count: 'exact', head: true })
        .lte('follow_up_date', tomorrow.toISOString())
        .eq('reminder_sent', false);

      const { count: sentCount } = await supabase
        .from('applications')
        .select('id', { count: 'exact', head: true })
        .eq('reminder_sent', true);

      setReminderStats({
        pending: pendingCount || 0,
        sent: sentCount || 0,
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const calculateNextRuns = () => {
    const now = new Date();
    
    setJobs(prev => prev.map(job => {
      let nextRun = new Date();
      
      if (job.id === 'reminder-emails') {
        nextRun.setUTCHours(8, 0, 0, 0);
        if (nextRun <= now) {
          nextRun.setDate(nextRun.getDate() + 1);
        }
      }
      
      return {
        ...job,
        nextRun: nextRun.toISOString(),
      };
    }));
  };

  const runJobNow = async (job: CronJob) => {
    setRunningJob(job.id);
    
    try {
      const { data, error } = await supabase.functions.invoke(job.functionName);
      
      if (error) throw error;
      
      toast({
        title: 'Job executed successfully',
        description: `${job.name} completed. ${data?.message || ''}`,
      });
      
      setJobs(prev => prev.map(j => 
        j.id === job.id 
          ? { ...j, lastRun: new Date().toISOString() }
          : j
      ));
      
      fetchStats();
      calculateNextRuns();
    } catch (error: any) {
      console.error('Error running job:', error);
      toast({
        title: 'Error',
        description: `Failed to run ${job.name}: ${error.message}`,
        variant: 'destructive',
      });
    } finally {
      setRunningJob(null);
    }
  };

  const formatDateTime = (isoString: string | null) => {
    if (!isoString) return 'Never';
    return new Date(isoString).toLocaleString();
  };

  const getStatusBadge = (status: CronJob['status']) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-500/10 text-green-500 hover:bg-green-500/20">Active</Badge>;
      case 'paused':
        return <Badge variant="secondary">Paused</Badge>;
      case 'error':
        return <Badge variant="destructive">Error</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Scheduled Tasks</p>
                <p className="text-2xl font-bold">{jobs.length}</p>
              </div>
              <Clock className="h-8 w-8 text-primary/50" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending Reminders</p>
                <p className="text-2xl font-bold">{reminderStats.pending}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-yellow-500/50" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Reminders Sent</p>
                <p className="text-2xl font-bold">{reminderStats.sent}</p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-green-500/50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Cron Jobs Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Scheduled Tasks
              </CardTitle>
              <CardDescription>
                Manage automated background tasks and cron jobs
              </CardDescription>
            </div>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => {
                fetchStats();
                calculateNextRuns();
              }}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Task</TableHead>
                <TableHead>Schedule</TableHead>
                <TableHead>Last Run</TableHead>
                <TableHead>Next Run</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobs.map((job) => (
                <TableRow key={job.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-primary/10 rounded-lg">
                        <Mail className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="font-medium">{job.name}</p>
                        <p className="text-sm text-muted-foreground">{job.description}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="font-mono text-sm">{job.schedule}</p>
                      <p className="text-xs text-muted-foreground">{job.scheduleDescription}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">{formatDateTime(job.lastRun)}</span>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">{formatDateTime(job.nextRun)}</span>
                  </TableCell>
                  <TableCell>
                    {getStatusBadge(job.status)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => runJobNow(job)}
                      disabled={runningJob === job.id}
                    >
                      {runningJob === job.id ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Running...
                        </>
                      ) : (
                        <>
                          <Play className="h-4 w-4 mr-2" />
                          Run Now
                        </>
                      )}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card className="bg-muted/50">
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <Clock className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div className="text-sm text-muted-foreground">
              <p className="font-medium text-foreground mb-1">About Scheduled Tasks</p>
              <p>
                Follow-up reminders check for upcoming application follow-ups daily 
                and send email notifications to users.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
