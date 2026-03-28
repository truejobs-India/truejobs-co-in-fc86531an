import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAdminToast } from '@/contexts/AdminMessagesContext';
import { Layers, Hammer, Eye, Loader2, Download } from 'lucide-react';
import * as XLSX from 'xlsx';
import type { AzureEmpNewsIssue, AzureEmpNewsReconstructedNotice, AzureEmpNewsFragment } from '@/types/azureEmpNews';

export function ReconstructedNoticesTab() {
  const { toast } = useAdminToast();
  const [issues, setIssues] = useState<AzureEmpNewsIssue[]>([]);
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);
  const [notices, setNotices] = useState<AzureEmpNewsReconstructedNotice[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  const fetchIssues = useCallback(async () => {
    const { data } = await supabase
      .from('azure_emp_news_issues')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) setIssues(data as unknown as AzureEmpNewsIssue[]);
  }, []);

  const fetchNotices = useCallback(async () => {
    if (!selectedIssueId) { setNotices([]); return; }
    setLoading(true);
    const { data } = await supabase
      .from('azure_emp_news_reconstructed_notices')
      .select('*')
      .eq('issue_id', selectedIssueId)
      .order('start_page', { ascending: true });
    if (data) setNotices(data as unknown as AzureEmpNewsReconstructedNotice[]);
    setLoading(false);
  }, [selectedIssueId]);

  useEffect(() => { fetchIssues(); }, [fetchIssues]);
  useEffect(() => { fetchNotices(); }, [fetchNotices]);

  const selectedIssue = issues.find(i => i.id === selectedIssueId);

  const canBuildFragments = selectedIssue && (
    selectedIssue.ocr_status === 'completed' || selectedIssue.ocr_status === 'partially_completed'
  );

  const handleBuildFragments = async () => {
    if (!selectedIssueId) return;
    setActionInProgress('build');
    try {
      const { data, error } = await supabase.functions.invoke('azure-emp-news-build-fragments', {
        body: { issue_id: selectedIssueId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: 'Fragments Built', description: `${data.fragments_created} fragments from ${data.pages_processed} pages` });
      fetchIssues();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message || 'Failed to build fragments', variant: 'destructive' });
    } finally {
      setActionInProgress(null);
    }
  };

  const handleReconstructNotices = async () => {
    if (!selectedIssueId) return;
    setActionInProgress('reconstruct');
    try {
      const { data, error } = await supabase.functions.invoke('azure-emp-news-reconstruct-notices', {
        body: { issue_id: selectedIssueId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: 'Notices Reconstructed', description: `${data.notices_created} notices (${data.job_notices} job-related)` });
      fetchNotices();
      fetchIssues();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message || 'Failed to reconstruct', variant: 'destructive' });
    } finally {
      setActionInProgress(null);
    }
  };

  const handleDownloadFragments = async () => {
    if (!selectedIssueId || !selectedIssue) return;
    setActionInProgress('download-fragments');
    try {
      const { data, error } = await supabase
        .from('azure_emp_news_fragments')
        .select('*')
        .eq('issue_id', selectedIssueId)
        .order('page_no', { ascending: true })
        .order('fragment_index', { ascending: true });
      if (error) throw error;
      if (!data || data.length === 0) {
        toast({ title: 'No Data', description: 'No fragments found for this issue', variant: 'destructive' });
        return;
      }
      const rows = (data as unknown as AzureEmpNewsFragment[]).map(f => ({
        'Page': f.page_no,
        'Index': f.fragment_index,
        'Type': f.fragment_type,
        'Confidence': f.confidence != null ? Math.round(f.confidence * 100) + '%' : '',
        'Continuation Hint': f.continuation_hint || '',
        'Cont. To Page': f.continuation_to_page ?? '',
        'Cont. From Page': f.continuation_from_page ?? '',
        'Cleaned Text': f.cleaned_text,
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      ws['!cols'] = [{ wch: 6 }, { wch: 6 }, { wch: 14 }, { wch: 10 }, { wch: 20 }, { wch: 12 }, { wch: 14 }, { wch: 80 }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Fragments');
      XLSX.writeFile(wb, `${selectedIssue.issue_name}_fragments.xlsx`);
      toast({ title: 'Downloaded', description: `${rows.length} fragments exported` });
    } catch (e: any) {
      toast({ title: 'Error', description: e.message || 'Failed to download fragments', variant: 'destructive' });
    } finally {
      setActionInProgress(null);
    }
  };

  const handleDownloadNotices = () => {
    if (!selectedIssue || notices.length === 0) return;
    const rows = notices.map(n => ({
      'Key': n.notice_key,
      'Start Page': n.start_page ?? '',
      'End Page': n.end_page ?? '',
      'Title': n.notice_title || '',
      'Employer': n.employer_name || '',
      'Confidence': n.reconstruction_confidence != null ? Math.round(n.reconstruction_confidence * 100) + '%' : '',
      'AI Status': n.ai_status,
      'Merged Text': n.merged_text,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [{ wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 30 }, { wch: 25 }, { wch: 10 }, { wch: 10 }, { wch: 80 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Notices');
    XLSX.writeFile(wb, `${selectedIssue.issue_name}_notices.xlsx`);
    toast({ title: 'Downloaded', description: `${rows.length} notices exported` });
  };

  const aiStatusBadge = (status: string) => {
    switch (status) {
      case 'completed': return <Badge className="bg-green-600 text-white">Completed</Badge>;
      case 'processing': return <Badge className="bg-blue-600 text-white">Processing</Badge>;
      case 'failed': return <Badge variant="destructive">Failed</Badge>;
      default: return <Badge variant="secondary">Pending</Badge>;
    }
  };

  const jobNotices = notices.filter(n => {
    const blocks = (n.merged_blocks_json as any) || [];
    return Array.isArray(blocks) && blocks.some((b: any) => b.fragment_type === 'job_notice' || b.fragment_type === 'unknown');
  });
  const editorialCount = notices.length - jobNotices.length;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Select value={selectedIssueId || ''} onValueChange={setSelectedIssueId}>
          <SelectTrigger className="w-72">
            <SelectValue placeholder="Select issue..." />
          </SelectTrigger>
          <SelectContent>
            {issues.map(i => (
              <SelectItem key={i.id} value={i.id}>{i.issue_name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          size="sm"
          onClick={handleBuildFragments}
          disabled={!canBuildFragments || !!actionInProgress}
        >
          {actionInProgress === 'build' ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Hammer className="h-4 w-4 mr-1" />}
          Build Fragments
        </Button>

        <Button
          size="sm"
          onClick={handleReconstructNotices}
          disabled={!canBuildFragments || !!actionInProgress}
          variant="secondary"
        >
          {actionInProgress === 'reconstruct' ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Layers className="h-4 w-4 mr-1" />}
          Reconstruct Notices
        </Button>

        <Button
          size="sm"
          variant="outline"
          onClick={handleDownloadFragments}
          disabled={!selectedIssueId || !!actionInProgress}
        >
          {actionInProgress === 'download-fragments' ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Download className="h-4 w-4 mr-1" />}
          Download Fragments
        </Button>

        <Button
          size="sm"
          variant="outline"
          onClick={handleDownloadNotices}
          disabled={!selectedIssueId || notices.length === 0 || !!actionInProgress}
        >
          <Download className="h-4 w-4 mr-1" />
          Download Notices
        </Button>
      </div>

      {selectedIssue && (
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm">Summary</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-4 gap-4 text-sm">
            <div><span className="text-muted-foreground">Total Notices:</span> <strong>{notices.length}</strong></div>
            <div><span className="text-muted-foreground">Job Notices:</span> <strong>{jobNotices.length}</strong></div>
            <div><span className="text-muted-foreground">Editorial/Other:</span> <strong>{editorialCount}</strong></div>
            <div><span className="text-muted-foreground">Reconstruction:</span> {aiStatusBadge(selectedIssue.reconstruction_status)}</div>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : notices.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-20">Key</TableHead>
              <TableHead className="w-16">Pages</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Employer</TableHead>
              <TableHead className="w-28">Confidence</TableHead>
              <TableHead className="w-24">AI Status</TableHead>
              <TableHead className="w-16">View</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {notices.map(n => (
              <TableRow key={n.id}>
                <TableCell className="font-mono text-xs">{n.notice_key}</TableCell>
                <TableCell className="text-xs">
                  {n.start_page === n.end_page ? n.start_page : `${n.start_page}–${n.end_page}`}
                </TableCell>
                <TableCell className="text-xs max-w-[200px] truncate" title={n.notice_title || ''}>
                  {n.notice_title || '—'}
                </TableCell>
                <TableCell className="text-xs max-w-[180px] truncate" title={n.employer_name || ''}>
                  {n.employer_name || '—'}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Progress value={(n.reconstruction_confidence || 0) * 100} className="h-2 w-16" />
                    <span className="text-xs text-muted-foreground">{Math.round((n.reconstruction_confidence || 0) * 100)}%</span>
                  </div>
                </TableCell>
                <TableCell>{aiStatusBadge(n.ai_status)}</TableCell>
                <TableCell>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button size="icon" variant="ghost"><Eye className="h-4 w-4" /></Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl max-h-[80vh]">
                      <DialogHeader>
                        <DialogTitle className="text-sm">{n.notice_title || n.notice_key}</DialogTitle>
                      </DialogHeader>
                      <ScrollArea className="max-h-[60vh]">
                        <pre className="text-xs whitespace-pre-wrap font-mono p-4 bg-muted rounded">
                          {n.merged_text}
                        </pre>
                      </ScrollArea>
                    </DialogContent>
                  </Dialog>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : selectedIssueId ? (
        <p className="text-sm text-muted-foreground text-center py-8">No reconstructed notices yet. Build fragments first, then reconstruct.</p>
      ) : (
        <p className="text-sm text-muted-foreground text-center py-8">Select an issue to view reconstructed notices.</p>
      )}
    </div>
  );
}
