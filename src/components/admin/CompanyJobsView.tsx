import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { useAdminToast as useToast } from '@/contexts/AdminMessagesContext';
import { 
  Building2, 
  MapPin, 
  Clock, 
  Eye, 
  ExternalLink,
  CheckCircle,
  XCircle,
  Briefcase,
  Trash2
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface Job {
  id: string;
  title: string;
  location: string | null;
  status: string;
  source: string;
  created_at: string;
  views_count: number;
  applications_count: number;
  source_url: string | null;
  is_deleted: boolean | null;
}

interface CompanyJobsViewProps {
  companyName: string;
  onJobClick?: (jobId: string) => void;
  onJobsChanged?: () => void;
}

export function CompanyJobsView({ companyName, onJobClick, onJobsChanged }: CompanyJobsViewProps) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchJobs();
  }, [companyName]);

  const fetchJobs = async () => {
    setIsLoading(true);
    try {
      // First try by company_name
      let { data, error } = await supabase
        .from('jobs')
        .select('id, title, location, status, source, created_at, views_count, applications_count, source_url, is_deleted')
        .ilike('company_name', companyName)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Also find jobs linked via company_id (where company_name is null)
      const { data: companyRecord } = await supabase
        .from('companies')
        .select('id')
        .eq('name', companyName)
        .limit(1)
        .maybeSingle();

      if (companyRecord) {
        const { data: linkedJobs, error: linkedError } = await supabase
          .from('jobs')
          .select('id, title, location, status, source, created_at, views_count, applications_count, source_url, is_deleted')
          .eq('company_id', companyRecord.id)
          .is('company_name', null)
          .order('created_at', { ascending: false });

        if (!linkedError && linkedJobs) {
          data = [...(data || []), ...linkedJobs];
        }
      }

      // Filter out already-deleted jobs
      setJobs((data || []).filter(j => !j.is_deleted));
    } catch (error) {
      console.error('Error fetching jobs:', error);
      toast({
        title: 'Error',
        description: 'Failed to load jobs for this company',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleApprove = async (jobId: string) => {
    try {
      const { error } = await supabase
        .from('jobs')
        .update({ status: 'active', approved_at: new Date().toISOString() })
        .eq('id', jobId);

      if (error) throw error;
      
      toast({ title: 'Job approved successfully' });
      fetchJobs();
    } catch (error) {
      console.error('Error approving job:', error);
      toast({
        title: 'Error',
        description: 'Failed to approve job',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (jobId: string) => {
    try {
      const { error } = await supabase
        .from('jobs')
        .update({ is_deleted: true, status: 'archived' as any })
        .eq('id', jobId);

      if (error) throw error;
      
      toast({ title: 'Job deleted successfully' });
      fetchJobs();
      onJobsChanged?.();
    } catch (error) {
      console.error('Error deleting job:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete job',
        variant: 'destructive',
      });
    }
  };

  const handleReject = async (jobId: string) => {
    try {
      const { error } = await supabase
        .from('jobs')
        .update({ status: 'closed' })
        .eq('id', jobId);

      if (error) throw error;
      
      toast({ title: 'Job closed' });
      fetchJobs();
    } catch (error) {
      console.error('Error rejecting job:', error);
      toast({
        title: 'Error',
        description: 'Failed to reject job',
        variant: 'destructive',
      });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-500/10 text-green-600 border-green-500/20">Active</Badge>;
      case 'pending_approval':
        return <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">Pending</Badge>;
      case 'rejected':
        return <Badge className="bg-red-500/10 text-red-600 border-red-500/20">Rejected</Badge>;
      case 'closed':
        return <Badge className="bg-gray-500/10 text-gray-600 border-gray-500/20">Closed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5" />
          {companyName}
          <Badge variant="secondary" className="ml-2">
            {jobs.length} job{jobs.length !== 1 ? 's' : ''}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        ) : jobs.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            No jobs found for this company
          </p>
        ) : (
          <div className="space-y-3">
            {jobs.map((job) => (
              <div
                key={job.id}
                className="border rounded-lg p-4 hover:bg-muted/50 transition-colors"
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold truncate">{job.title}</h3>
                      {getStatusBadge(job.status)}
                      {job.source === 'scraped' && (
                        <Badge variant="outline" className="text-xs">Scraped</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground flex-wrap">
                      {job.location && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5" />
                          {job.location}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        {formatDistanceToNow(new Date(job.created_at), { addSuffix: true })}
                      </span>
                      <span className="flex items-center gap-1">
                        <Eye className="h-3.5 w-3.5" />
                        {job.views_count} views
                      </span>
                      <span className="flex items-center gap-1">
                        <Briefcase className="h-3.5 w-3.5" />
                        {job.applications_count} applications
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {job.source_url && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(job.source_url!, '_blank')}
                      >
                        <ExternalLink className="h-3.5 w-3.5 mr-1" />
                        Source
                      </Button>
                    )}
                    {job.status === 'pending_approval' && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-green-600 hover:bg-green-50"
                          onClick={() => handleApprove(job.id)}
                        >
                          <CheckCircle className="h-3.5 w-3.5 mr-1" />
                          Approve
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-red-600 hover:bg-red-50"
                          onClick={() => handleReject(job.id)}
                        >
                          <XCircle className="h-3.5 w-3.5 mr-1" />
                          Reject
                        </Button>
                      </>
                    )}
                    {!job.is_deleted && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive hover:bg-destructive/10"
                        onClick={() => handleDelete(job.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-1" />
                        Delete
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
