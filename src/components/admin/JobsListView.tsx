import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAdminToast as useToast } from '@/contexts/AdminMessagesContext';
import { 
  Search, 
  Briefcase, 
  MapPin, 
  Clock, 
  Eye,
  Building2,
  CheckCircle,
  XCircle,
  ExternalLink,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface Job {
  id: string;
  title: string;
  company_name: string | null;
  location: string | null;
  status: string;
  source: string;
  created_at: string;
  views_count: number;
  applications_count: number;
  source_url: string | null;
}

type JobStatus = 'draft' | 'pending_approval' | 'active' | 'paused' | 'closed' | 'expired';

interface JobsListViewProps {
  filterStatus?: string;
  onCompanyClick?: (companyName: string) => void;
}

const PAGE_SIZE = 20;

const isValidJobStatus = (status: string): status is JobStatus => {
  return ['draft', 'pending_approval', 'active', 'paused', 'closed', 'expired'].includes(status);
};

export function JobsListView({ filterStatus, onCompanyClick }: JobsListViewProps) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState(filterStatus || 'all');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const { toast } = useToast();

  useEffect(() => {
    fetchJobs();
  }, [currentPage, statusFilter]);

  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, searchQuery]);

  const fetchJobs = async () => {
    setIsLoading(true);
    try {
      let query = supabase
        .from('jobs')
        .select('id, title, company_name, location, status, source, created_at, views_count, applications_count, source_url', { count: 'exact' });

      if (statusFilter !== 'all' && isValidJobStatus(statusFilter)) {
        query = query.eq('status', statusFilter);
      }

      if (searchQuery.trim()) {
        query = query.or(`title.ilike.%${searchQuery}%,company_name.ilike.%${searchQuery}%`);
      }

      const { data, error, count } = await query
        .order('created_at', { ascending: false })
        .range((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE - 1);

      if (error) throw error;
      setJobs(data || []);
      setTotalCount(count || 0);
    } catch (error) {
      console.error('Error fetching jobs:', error);
      toast({
        title: 'Error',
        description: 'Failed to load jobs',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = () => {
    setCurrentPage(1);
    fetchJobs();
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

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-4">
          <CardTitle className="flex items-center gap-2">
            <Briefcase className="h-5 w-5" />
            All Jobs ({totalCount})
          </CardTitle>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search jobs or companies..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="pending_approval">Pending</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(10)].map((_, i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        ) : jobs.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            No jobs found
          </p>
        ) : (
          <>
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
                        {job.company_name && (
                          <button
                            onClick={() => onCompanyClick?.(job.company_name!)}
                            className="flex items-center gap-1 hover:text-primary transition-colors"
                          >
                            <Building2 className="h-3.5 w-3.5" />
                            {job.company_name}
                          </button>
                        )}
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
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-6 pt-4 border-t">
                <p className="text-sm text-muted-foreground">
                  Showing {(currentPage - 1) * PAGE_SIZE + 1} - {Math.min(currentPage * PAGE_SIZE, totalCount)} of {totalCount}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(currentPage - 1)}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm">
                    Page {currentPage} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(currentPage + 1)}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
