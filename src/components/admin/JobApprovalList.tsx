import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useAdminToast as useToast } from '@/contexts/AdminMessagesContext';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  CheckCircle, XCircle, Eye, Briefcase, Loader2, ExternalLink, Globe,
  User, Search, Filter, ChevronLeft, ChevronRight, FileText,
  MapPin, Calendar, Building2, IndianRupee,
  Clock, Link2, Pencil, Trash2,
} from 'lucide-react';
import { format } from 'date-fns';
import { ScrollArea } from '@/components/ui/scroll-area';

interface PipelineJob {
  id: string;
  title: string;
  description: string;
  location: string | null;
  job_type: string;
  experience_level: string;
  source: 'manual' | 'scraped';
  source_url: string | null;
  created_at: string;
  company_name: string | null;
  ai_processed_at: string | null;
  is_featured: boolean | null;
  pay_scale: string | null;
  apply_url: string | null;
  job_role: string | null;
  last_date_of_application: string | null;
  job_opening_date: string | null;
  salary_min: number | null;
  salary_max: number | null;
  city: string | null;
  state: string | null;
  company?: { name: string } | null;
}

interface JobApprovalListProps {
  onStatsChange?: () => void;
}

const ITEMS_PER_PAGE = 10;

export function JobApprovalList({ onStatsChange }: JobApprovalListProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [jobs, setJobs] = useState<PipelineJob[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedJob, setSelectedJob] = useState<PipelineJob | null>(null);
  const [editingJob, setEditingJob] = useState<PipelineJob | null>(null);
  const [editForm, setEditForm] = useState<Record<string, any>>({});
  const [savingEdit, setSavingEdit] = useState(false);
  const [processingJob, setProcessingJob] = useState<string | null>(null);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'manual' | 'scraped'>('all');
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => { fetchJobs(); }, []);
  useEffect(() => { setCurrentPage(1); }, [searchQuery, sourceFilter]);

  const JOB_SELECT = `
    id, title, description, location, job_type, experience_level,
    source, source_url, created_at, company_name,
    ai_processed_at, is_featured, pay_scale, apply_url, job_role,
    last_date_of_application, job_opening_date, salary_min, salary_max,
    city, state, company:companies(name)
  `;

  const fetchJobs = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.from('jobs').select(JOB_SELECT)
        .in('status', ['draft', 'pending_approval'])
        .order('created_at', { ascending: false });

      if (error) throw error;
      setJobs(data || []);
    } catch (error) {
      console.error('Error fetching jobs:', error);
      toast({ title: 'Error', description: 'Failed to load jobs', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const filteredJobs = useMemo(() => {
    return jobs.filter(job => {
      const matchesSearch = searchQuery === '' || 
        job.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        job.company?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        job.company_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        job.location?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesSource = sourceFilter === 'all' || job.source === sourceFilter;
      return matchesSearch && matchesSource;
    });
  }, [jobs, searchQuery, sourceFilter]);

  const totalPages = Math.ceil(filteredJobs.length / ITEMS_PER_PAGE);
  const paginatedJobs = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredJobs.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredJobs, currentPage]);

  const handleApprove = async (jobId: string) => {
    setProcessingJob(jobId);
    try {
      const { error } = await supabase.from('jobs').update({
        status: 'active', approved_at: new Date().toISOString(), approved_by: user?.id,
      }).eq('id', jobId);
      if (error) throw error;
      toast({ title: 'Job Approved', description: 'The job is now live' });
      setJobs(prev => prev.filter(j => j.id !== jobId));
      setSelectedJob(null);
      onStatsChange?.();
    } catch (error) {
      console.error('Error approving job:', error);
      toast({ title: 'Error', description: 'Failed to approve job', variant: 'destructive' });
    } finally { setProcessingJob(null); }
  };

  const handleReject = async (jobId: string) => {
    setProcessingJob(jobId);
    try {
      const { error } = await supabase.from('jobs').update({ status: 'closed' }).eq('id', jobId);
      if (error) throw error;
      toast({ title: 'Job Rejected', description: 'The job has been rejected' });
      setJobs(prev => prev.filter(j => j.id !== jobId));
      setSelectedJob(null);
      onStatsChange?.();
    } catch (error) {
      console.error('Error rejecting job:', error);
      toast({ title: 'Error', description: 'Failed to reject job', variant: 'destructive' });
    } finally { setProcessingJob(null); }
  };

  const openEditDialog = (job: PipelineJob) => {
    setEditingJob(job);
    setEditForm({
      title: job.title,
      description: job.description,
      company_name: job.company_name || '',
      location: job.location || '',
      city: job.city || '',
      state: job.state || '',
      pay_scale: job.pay_scale || '',
      apply_url: job.apply_url || '',
      job_role: job.job_role || '',
      last_date_of_application: job.last_date_of_application || '',
      job_opening_date: job.job_opening_date || '',
    });
  };

  const handleSaveEdit = async () => {
    if (!editingJob) return;
    setSavingEdit(true);
    try {
      const { error } = await supabase.from('jobs').update({
        title: editForm.title,
        description: editForm.description,
        company_name: editForm.company_name || null,
        location: editForm.location || null,
        city: editForm.city || null,
        state: editForm.state || null,
        pay_scale: editForm.pay_scale || null,
        apply_url: editForm.apply_url || null,
        job_role: editForm.job_role || null,
        last_date_of_application: editForm.last_date_of_application || null,
        job_opening_date: editForm.job_opening_date || null,
        updated_at: new Date().toISOString(),
      }).eq('id', editingJob.id);
      if (error) throw error;
      toast({ title: 'Saved', description: 'Job details updated' });
      setEditingJob(null);
      fetchJobs();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to save', variant: 'destructive' });
    } finally { setSavingEdit(false); }
  };

  const handleBulkApprove = async () => {
    const jobIds = paginatedJobs.map(j => j.id);
    if (jobIds.length === 0) return;
    setProcessingJob('bulk');
    try {
      const { error } = await supabase.from('jobs').update({
        status: 'active', approved_at: new Date().toISOString(), approved_by: user?.id,
      }).in('id', jobIds);
      if (error) throw error;
      toast({ title: 'Jobs Approved', description: `${jobIds.length} jobs are now live` });
      fetchJobs();
      onStatsChange?.();
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to approve jobs', variant: 'destructive' });
    } finally { setProcessingJob(null); }
  };

  const handleBulkReject = async () => {
    const jobIds = paginatedJobs.map(j => j.id);
    if (jobIds.length === 0) return;
    setProcessingJob('bulk-reject');
    try {
      const { error } = await supabase.from('jobs').update({ status: 'closed' }).in('id', jobIds);
      if (error) throw error;
      toast({ title: 'Jobs Rejected', description: `${jobIds.length} jobs have been rejected` });
      fetchJobs();
      onStatsChange?.();
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to reject jobs', variant: 'destructive' });
    } finally { setProcessingJob(null); }
  };

  const handleRemoveArticles = async () => {
    setProcessingJob('remove-articles');
    try {
      const ARTICLE_KEYWORDS = [
        'guide', 'tips', 'how to', 'blog', 'article', 'review', 'career advice',
        'strategy', 'course', 'essential skills', 'what is', 'top books',
        'syllabus', 'preparation', 'study material', 'mock test', 'previous year',
        'cut off', 'current affairs', 'general knowledge', 'gk quiz',
        'best books', 'interview tips', 'resume tips', 'cover letter',
        'salary negotiation', 'work life balance', 'productivity',
        'e-book', 'ebook', 'webinar', 'podcast', 'tutorial',
        'ranking', 'top colleges', 'university', 'admit card',
        'answer key', 'merit list', 'counselling', 'counseling',
        'leadership', 'kindness', 'soft skills', 'converters',
      ];

      const ARTICLE_SOURCES = [
        'career – simply life tips', 'career mantra', 'career guidance – chegg india',
        'safalta', 'mindler', 'rightguruji',
      ];

      const articleIds = filteredJobs.filter(job => {
        const titleLower = (job.title || '').toLowerCase();
        const companyLower = (job.company_name || '').toLowerCase();
        const descLower = (job.description || '').toLowerCase().substring(0, 500);

        if (ARTICLE_SOURCES.some(s => companyLower.includes(s))) return true;

        if (ARTICLE_KEYWORDS.some(kw => titleLower.includes(kw))) {
          const JOB_SIGNALS = ['recruitment', 'vacancy', 'vacancies', 'hiring', 'opening',
            'walk-in', 'apply online', 'notification', 'bharti', 'posts', 'jobs'];
          if (JOB_SIGNALS.some(s => titleLower.includes(s))) return false;
          return true;
        }

        if (descLower.includes('appeared first on') && !descLower.includes('recruitment') && !descLower.includes('vacancy')) {
          return true;
        }

        return false;
      }).map(j => j.id);

      if (articleIds.length === 0) {
        toast({ title: 'No Articles Found', description: 'Pipeline looks clean — no articles detected', variant: 'default' });
        setProcessingJob(null);
        return;
      }

      let deleted = 0;
      for (let i = 0; i < articleIds.length; i += 100) {
        const batch = articleIds.slice(i, i + 100);
        const { error } = await supabase.from('jobs').update({
          is_deleted: true, status: 'archived', updated_at: new Date().toISOString(),
        }).in('id', batch);
        if (!error) deleted += batch.length;
      }

      toast({ title: 'Articles Removed', description: `${deleted} articles/non-job content removed from pipeline` });
      fetchJobs();
      onStatsChange?.();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to remove articles', variant: 'destructive' });
    } finally { setProcessingJob(null); }
  };

  const getJobTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      full_time: 'Full-time', part_time: 'Part-time', contract: 'Contract',
      internship: 'Internship', remote: 'Remote',
    };
    return labels[type] || type;
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Briefcase className="h-5 w-5" />
            Job Approval
          </CardTitle>
          <CardDescription>
            Review and approve pending job listings
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Bulk Actions */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b">
            <div>
              <p className="text-sm text-muted-foreground">
                {filteredJobs.length} pending jobs
              </p>
            </div>
            <div className="flex gap-2 flex-wrap">
              {paginatedJobs.length > 0 && (
                <>
                  <Button variant="outline" onClick={handleRemoveArticles} disabled={!!processingJob} size="sm" className="gap-1.5 border-destructive text-destructive hover:bg-destructive/10">
                    {processingJob === 'remove-articles' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    Remove Articles
                  </Button>
                  <Button variant="destructive" onClick={handleBulkReject} disabled={!!processingJob} size="sm">
                    {processingJob === 'bulk-reject' ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <XCircle className="h-4 w-4 mr-2" />}
                    Reject All on Page
                  </Button>
                  <Button onClick={handleBulkApprove} disabled={!!processingJob} size="sm">
                    {processingJob === 'bulk' ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-2" />}
                    Approve All on Page
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Search & Filter */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search by title, company, or location..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
            </div>
            <Select value={sourceFilter} onValueChange={(v) => setSourceFilter(v as any)}>
              <SelectTrigger className="w-[130px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Source" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sources</SelectItem>
                <SelectItem value="scraped">Scraped</SelectItem>
                <SelectItem value="manual">Manual</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Job Cards */}
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredJobs.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Pending Jobs</h3>
              <p className="text-muted-foreground">
                All jobs have been reviewed. New jobs will appear here when posted.
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-3">
                {paginatedJobs.map((job) => (
                  <Card key={job.id} className="border">
                    <CardContent className="p-4">
                      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-start gap-2">
                            <div className="flex-1">
                              <h4 className="font-semibold text-base">{job.title}</h4>
                              <p className="text-sm text-muted-foreground flex items-center gap-1">
                                <Building2 className="h-3 w-3" />
                                {job.company?.name || job.company_name || 'Unknown'}
                              </p>
                            </div>
                            <div className="flex gap-1 flex-wrap">
                              <Badge variant="outline">{getJobTypeLabel(job.job_type)}</Badge>
                              <Badge variant={job.source === 'scraped' ? 'secondary' : 'outline'}>
                                {job.source === 'scraped' ? 'Scraped' : 'Manual'}
                              </Badge>
                            </div>
                          </div>

                          {/* Job details grid */}
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                            {(job.location || job.city || job.state) && (
                              <div className="flex items-center gap-1 text-muted-foreground">
                                <MapPin className="h-3 w-3 shrink-0" />
                                <span>{[job.city, job.state, job.location].filter(Boolean).join(', ')}</span>
                              </div>
                            )}
                            {job.pay_scale && (
                              <div className="flex items-center gap-1 text-muted-foreground">
                                <IndianRupee className="h-3 w-3 shrink-0" />
                                <span className="truncate">{job.pay_scale}</span>
                              </div>
                            )}
                            {(job.salary_min || job.salary_max) && !job.pay_scale && (
                              <div className="flex items-center gap-1 text-muted-foreground">
                                <IndianRupee className="h-3 w-3 shrink-0" />
                                <span>₹{job.salary_min?.toLocaleString() || '—'} – ₹{job.salary_max?.toLocaleString() || '—'}</span>
                              </div>
                            )}
                            {job.job_role && (
                              <div className="flex items-center gap-1 text-muted-foreground">
                                <Briefcase className="h-3 w-3 shrink-0" />
                                <span>{job.job_role}</span>
                              </div>
                            )}
                            {job.last_date_of_application && (
                              <div className="flex items-center gap-1 text-muted-foreground">
                                <Clock className="h-3 w-3 shrink-0" />
                                <span>Last date: {job.last_date_of_application}</span>
                              </div>
                            )}
                            {job.job_opening_date && (
                              <div className="flex items-center gap-1 text-muted-foreground">
                                <Calendar className="h-3 w-3 shrink-0" />
                                <span>Opens: {job.job_opening_date}</span>
                              </div>
                            )}
                          </div>

                          <p className="text-sm text-muted-foreground line-clamp-2">{job.description}</p>

                          {job.apply_url && (
                            <div className="flex gap-3 flex-wrap">
                              <a href={job.apply_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1 font-medium">
                                <Link2 className="h-3 w-3" /> Apply Online
                              </a>
                            </div>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex lg:flex-col gap-2 shrink-0">
                          <Button variant="outline" size="sm" onClick={() => setSelectedJob(job)} className="gap-1">
                            <Eye className="h-4 w-4" /> Preview
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => openEditDialog(job)} className="gap-1">
                            <Pencil className="h-4 w-4" /> Edit
                          </Button>
                          <Button size="sm" onClick={() => handleApprove(job.id)} disabled={!!processingJob} className="gap-1 bg-green-600 hover:bg-green-700 text-white">
                            {processingJob === job.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                            Approve
                          </Button>
                          <Button variant="destructive" size="sm" onClick={() => handleReject(job.id)} disabled={!!processingJob} className="gap-1">
                            <XCircle className="h-4 w-4" /> Reject
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-4 border-t">
                  <p className="text-sm text-muted-foreground">
                    Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, filteredJobs.length)} of {filteredJobs.length}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>
                      <ChevronLeft className="h-4 w-4" /> Previous
                    </Button>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let pageNum: number;
                        if (totalPages <= 5) pageNum = i + 1;
                        else if (currentPage <= 3) pageNum = i + 1;
                        else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
                        else pageNum = currentPage - 2 + i;
                        return (
                          <Button key={pageNum} variant={currentPage === pageNum ? 'default' : 'outline'} size="sm" onClick={() => setCurrentPage(pageNum)} className="w-8 h-8 p-0">
                            {pageNum}
                          </Button>
                        );
                      })}
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>
                      Next <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Job Detail Dialog */}
      <Dialog open={!!selectedJob} onOpenChange={() => setSelectedJob(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedJob?.title}</DialogTitle>
            <DialogDescription>
              {selectedJob?.company?.name || selectedJob?.company_name || 'Unknown'} • {selectedJob?.location || selectedJob?.state || 'India'}
            </DialogDescription>
          </DialogHeader>
          {selectedJob && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Badge>{getJobTypeLabel(selectedJob.job_type)}</Badge>
                <Badge variant="outline">{selectedJob.experience_level}</Badge>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm border rounded-lg p-3 bg-muted/30">
                {selectedJob.pay_scale && (
                  <div><span className="font-medium text-muted-foreground">Pay Scale:</span> {selectedJob.pay_scale}</div>
                )}
                {selectedJob.job_role && (
                  <div><span className="font-medium text-muted-foreground">Role:</span> {selectedJob.job_role}</div>
                )}
                {selectedJob.last_date_of_application && (
                  <div><span className="font-medium text-muted-foreground">Last Date:</span> {selectedJob.last_date_of_application}</div>
                )}
                {selectedJob.job_opening_date && (
                  <div><span className="font-medium text-muted-foreground">Opening Date:</span> {selectedJob.job_opening_date}</div>
                )}
                {(selectedJob.city || selectedJob.state) && (
                  <div><span className="font-medium text-muted-foreground">Location:</span> {[selectedJob.city, selectedJob.state].filter(Boolean).join(', ')}</div>
                )}
              </div>

              {selectedJob.apply_url && (
                <div className="flex gap-3 flex-wrap">
                  <a href={selectedJob.apply_url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline flex items-center gap-1 font-semibold">
                    <Link2 className="h-3 w-3" /> Apply Online
                  </a>
                </div>
              )}

              <ScrollArea className="h-[300px] border rounded-lg p-4">
                <div className="prose prose-sm max-w-none">
                  <p className="whitespace-pre-wrap">{selectedJob.description}</p>
                </div>
              </ScrollArea>
              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button variant="outline" onClick={() => setSelectedJob(null)}>Cancel</Button>
                <Button variant="outline" onClick={() => { setSelectedJob(null); openEditDialog(selectedJob); }}>
                  <Pencil className="h-4 w-4 mr-2" /> Edit
                </Button>
                <Button variant="destructive" onClick={() => handleReject(selectedJob.id)} disabled={!!processingJob}>
                  <XCircle className="h-4 w-4 mr-2" /> Reject
                </Button>
                <Button onClick={() => handleApprove(selectedJob.id)} disabled={!!processingJob} className="bg-green-600 hover:bg-green-700 text-white">
                  {processingJob === selectedJob.id ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-2" />}
                  Approve
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Job Dialog */}
      <Dialog open={!!editingJob} onOpenChange={() => setEditingJob(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Job Details</DialogTitle>
            <DialogDescription>
              Modify any fields before approving
            </DialogDescription>
          </DialogHeader>
          {editingJob && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <Label htmlFor="edit-title">Title</Label>
                  <Input id="edit-title" value={editForm.title || ''} onChange={(e) => setEditForm(f => ({ ...f, title: e.target.value }))} />
                </div>
                <div>
                  <Label htmlFor="edit-company">Company</Label>
                  <Input id="edit-company" value={editForm.company_name || ''} onChange={(e) => setEditForm(f => ({ ...f, company_name: e.target.value }))} />
                </div>
                <div>
                  <Label htmlFor="edit-role">Job Role</Label>
                  <Input id="edit-role" value={editForm.job_role || ''} onChange={(e) => setEditForm(f => ({ ...f, job_role: e.target.value }))} />
                </div>
                <div>
                  <Label htmlFor="edit-location">Location</Label>
                  <Input id="edit-location" value={editForm.location || ''} onChange={(e) => setEditForm(f => ({ ...f, location: e.target.value }))} />
                </div>
                <div>
                  <Label htmlFor="edit-city">City</Label>
                  <Input id="edit-city" value={editForm.city || ''} onChange={(e) => setEditForm(f => ({ ...f, city: e.target.value }))} />
                </div>
                <div>
                  <Label htmlFor="edit-state">State</Label>
                  <Input id="edit-state" value={editForm.state || ''} onChange={(e) => setEditForm(f => ({ ...f, state: e.target.value }))} />
                </div>
                <div>
                  <Label htmlFor="edit-pay">Pay Scale</Label>
                  <Input id="edit-pay" value={editForm.pay_scale || ''} onChange={(e) => setEditForm(f => ({ ...f, pay_scale: e.target.value }))} />
                </div>
                <div>
                  <Label htmlFor="edit-apply">Apply URL</Label>
                  <Input id="edit-apply" value={editForm.apply_url || ''} onChange={(e) => setEditForm(f => ({ ...f, apply_url: e.target.value }))} />
                </div>
                <div>
                  <Label htmlFor="edit-last-date">Last Date of Application</Label>
                  <Input id="edit-last-date" value={editForm.last_date_of_application || ''} onChange={(e) => setEditForm(f => ({ ...f, last_date_of_application: e.target.value }))} />
                </div>
                <div>
                  <Label htmlFor="edit-opening">Opening Date</Label>
                  <Input id="edit-opening" value={editForm.job_opening_date || ''} onChange={(e) => setEditForm(f => ({ ...f, job_opening_date: e.target.value }))} />
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="edit-desc">Description</Label>
                  <Textarea id="edit-desc" value={editForm.description || ''} onChange={(e) => setEditForm(f => ({ ...f, description: e.target.value }))} rows={8} />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button variant="outline" onClick={() => setEditingJob(null)}>Cancel</Button>
                <Button onClick={handleSaveEdit} disabled={savingEdit}>
                  {savingEdit ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                  Save Changes
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
