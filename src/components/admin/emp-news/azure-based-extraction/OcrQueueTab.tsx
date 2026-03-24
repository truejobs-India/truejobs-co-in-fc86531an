import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/components/ui/use-toast';
import { Play, RotateCcw, RefreshCw, Loader2 } from 'lucide-react';
import type { AzureEmpNewsIssue, AzureEmpNewsPage } from '@/types/azureEmpNews';

export function OcrQueueTab() {
  const [issues, setIssues] = useState<AzureEmpNewsIssue[]>([]);
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);
  const [pages, setPages] = useState<AzureEmpNewsPage[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchIssues = useCallback(async () => {
    const { data } = await supabase
      .from('azure_emp_news_issues')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) setIssues(data as unknown as AzureEmpNewsIssue[]);
  }, []);

  const fetchPages = useCallback(async () => {
    if (!selectedIssueId) { setPages([]); return; }
    const { data } = await supabase
      .from('azure_emp_news_pages')
      .select('*')
      .eq('issue_id', selectedIssueId)
      .order('page_no', { ascending: true });
    if (data) setPages(data as unknown as AzureEmpNewsPage[]);
  }, [selectedIssueId]);

  useEffect(() => { fetchIssues(); }, [fetchIssues]);
  useEffect(() => { fetchPages(); }, [fetchPages]);

  // Auto-poll when processing
  const selectedIssue = issues.find(i => i.id === selectedIssueId);
  const isProcessing = selectedIssue?.ocr_status === 'processing';

  useEffect(() => {
    if (isProcessing) {
      pollRef.current = setInterval(() => {
        fetchPages();
        fetchIssues();
      }, 5000);
    } else if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [isProcessing, fetchPages, fetchIssues]);

  const handleStartOcr = async () => {
    if (!selectedIssueId) return;
    setActionInProgress('start');
    try {
      const { data, error } = await supabase.functions.invoke('azure-emp-news-start-ocr', {
        body: { issue_id: selectedIssueId },
      });
      if (error) throw error;
      toast({ title: 'OCR Started', description: `Processing ${data?.processed || 0} pages` });
      await fetchPages();
      await fetchIssues();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to start OCR', variant: 'destructive' });
    } finally {
      setActionInProgress(null);
    }
  };

  const handleRetryPage = async (pageId: string) => {
    setActionInProgress(pageId);
    try {
      const { data, error } = await supabase.functions.invoke('azure-emp-news-retry-page', {
        body: { page_id: pageId },
      });
      if (error) throw error;
      toast({ title: 'Retry complete', description: data?.success ? 'Page processed successfully' : (data?.error || 'Failed') });
      await fetchPages();
      await fetchIssues();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Retry failed', variant: 'destructive' });
    } finally {
      setActionInProgress(null);
    }
  };

  const handleRetryAllFailed = async () => {
    if (!selectedIssueId) return;
    setActionInProgress('retry-all');
    try {
      const { data, error } = await supabase.functions.invoke('azure-emp-news-retry-failed', {
        body: { issue_id: selectedIssueId },
      });
      if (error) throw error;
      toast({ title: 'Retry All', description: `Retrying ${data?.retried || 0} failed pages` });
      await fetchPages();
      await fetchIssues();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Retry failed', variant: 'destructive' });
    } finally {
      setActionInProgress(null);
    }
  };

  const pendingCount = pages.filter(p => p.ocr_status === 'pending').length;
  const processingCount = pages.filter(p => p.ocr_status === 'processing').length;
  const completedCount = pages.filter(p => p.ocr_status === 'completed').length;
  const failedCount = pages.filter(p => p.ocr_status === 'failed').length;
  const totalCount = pages.length;
  const progressPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const statusBadge = (status: string) => {
    switch (status) {
      case 'completed': return <Badge className="bg-green-600 text-white">Completed</Badge>;
      case 'processing': return <Badge className="bg-blue-600 text-white">Processing</Badge>;
      case 'failed': return <Badge variant="destructive">Failed</Badge>;
      default: return <Badge variant="secondary">Pending</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      {/* Issue Selector */}
      <div className="flex items-center gap-3">
        <Select value={selectedIssueId || ''} onValueChange={setSelectedIssueId}>
          <SelectTrigger className="w-[300px]">
            <SelectValue placeholder="Select an issue" />
          </SelectTrigger>
          <SelectContent>
            {issues.map(issue => (
              <SelectItem key={issue.id} value={issue.id}>
                {issue.issue_name} ({issue.uploaded_pages} pages)
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button size="sm" variant="outline" onClick={() => { fetchIssues(); fetchPages(); }}>
          <RefreshCw className="h-3.5 w-3.5 mr-1" /> Refresh
        </Button>
      </div>

      {selectedIssueId && (
        <>
          {/* Progress Summary */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">OCR Progress</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Progress value={progressPct} className="h-2" />
              <div className="grid grid-cols-4 gap-3 text-sm">
                <div className="text-center p-2 rounded bg-muted">
                  <div className="font-semibold text-lg">{totalCount}</div>
                  <div className="text-muted-foreground text-xs">Total</div>
                </div>
                <div className="text-center p-2 rounded bg-green-50 dark:bg-green-950">
                  <div className="font-semibold text-lg text-green-700 dark:text-green-400">{completedCount}</div>
                  <div className="text-muted-foreground text-xs">Completed</div>
                </div>
                <div className="text-center p-2 rounded bg-yellow-50 dark:bg-yellow-950">
                  <div className="font-semibold text-lg text-yellow-700 dark:text-yellow-400">{pendingCount + processingCount}</div>
                  <div className="text-muted-foreground text-xs">Pending</div>
                </div>
                <div className="text-center p-2 rounded bg-red-50 dark:bg-red-950">
                  <div className="font-semibold text-lg text-red-700 dark:text-red-400">{failedCount}</div>
                  <div className="text-muted-foreground text-xs">Failed</div>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={handleStartOcr}
                  disabled={pendingCount === 0 || actionInProgress !== null}
                >
                  {actionInProgress === 'start' ? (
                    <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                  ) : (
                    <Play className="h-3.5 w-3.5 mr-1" />
                  )}
                  Start OCR ({pendingCount} pending)
                </Button>
                {failedCount > 0 && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleRetryAllFailed}
                    disabled={actionInProgress !== null}
                  >
                    {actionInProgress === 'retry-all' ? (
                      <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                    ) : (
                      <RotateCcw className="h-3.5 w-3.5 mr-1" />
                    )}
                    Retry All Failed ({failedCount})
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Pages Table */}
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">Page</TableHead>
                    <TableHead>Filename</TableHead>
                    <TableHead className="w-24">Status</TableHead>
                    <TableHead className="w-16">Retries</TableHead>
                    <TableHead className="w-40">Processed At</TableHead>
                    <TableHead>Error</TableHead>
                    <TableHead className="w-20">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pages.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                        No pages uploaded for this issue yet
                      </TableCell>
                    </TableRow>
                  ) : (
                    pages.map(page => (
                      <TableRow key={page.id}>
                        <TableCell className="font-mono text-xs">{String(page.page_no).padStart(3, '0')}</TableCell>
                        <TableCell className="text-xs">{page.original_filename}</TableCell>
                        <TableCell>{statusBadge(page.ocr_status)}</TableCell>
                        <TableCell className="text-center text-xs">{page.retry_count}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {page.processed_at ? new Date(page.processed_at).toLocaleString() : '—'}
                        </TableCell>
                        <TableCell className="text-xs text-destructive max-w-[200px] truncate" title={page.error_message || ''}>
                          {page.error_message || '—'}
                        </TableCell>
                        <TableCell>
                          {page.ocr_status === 'failed' && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleRetryPage(page.id)}
                              disabled={actionInProgress !== null}
                              className="h-7 px-2"
                            >
                              {actionInProgress === page.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <RotateCcw className="h-3 w-3" />
                              )}
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
