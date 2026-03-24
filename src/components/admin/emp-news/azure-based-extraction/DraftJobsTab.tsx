import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from '@/components/ui/use-toast';
import { Sparkles, Eye, Loader2 } from 'lucide-react';
import type { AzureEmpNewsIssue, AzureEmpNewsDraftJob } from '@/types/azureEmpNews';

export function DraftJobsTab() {
  const [issues, setIssues] = useState<AzureEmpNewsIssue[]>([]);
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<AzureEmpNewsDraftJob[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);

  const fetchIssues = useCallback(async () => {
    const { data } = await supabase
      .from('azure_emp_news_issues')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) setIssues(data as unknown as AzureEmpNewsIssue[]);
  }, []);

  const fetchDrafts = useCallback(async () => {
    if (!selectedIssueId) { setDrafts([]); return; }
    setLoading(true);
    const { data } = await supabase
      .from('azure_emp_news_draft_jobs')
      .select('*')
      .eq('issue_id', selectedIssueId)
      .order('created_at', { ascending: true });
    if (data) setDrafts(data as unknown as AzureEmpNewsDraftJob[]);
    setLoading(false);
  }, [selectedIssueId]);

  useEffect(() => { fetchIssues(); }, [fetchIssues]);
  useEffect(() => { fetchDrafts(); }, [fetchDrafts]);

  const selectedIssue = issues.find(i => i.id === selectedIssueId);

  const canGenerate = selectedIssue && selectedIssue.reconstruction_status === 'completed';

  const handleGenerate = async () => {
    if (!selectedIssueId) return;
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('azure-emp-news-ai-clean-drafts', {
        body: { issue_id: selectedIssueId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const msg = `Processed: ${data.processed}, Skipped: ${data.skipped}, Failed: ${data.failed}`;
      toast({ title: 'AI Drafts Generated', description: msg });
      if (data.errors?.length) {
        toast({ title: 'Warnings', description: data.errors.join('\n'), variant: 'destructive' });
      }
      fetchDrafts();
      fetchIssues();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message || 'Failed to generate drafts', variant: 'destructive' });
    } finally {
      setGenerating(false);
    }
  };

  const validationBadge = (status: string) => {
    switch (status) {
      case 'passed': return <Badge className="bg-green-600 text-white">Passed</Badge>;
      case 'failed': return <Badge variant="destructive">Failed</Badge>;
      case 'review_needed': return <Badge className="bg-yellow-600 text-white">Review Needed</Badge>;
      default: return <Badge variant="secondary">Pending</Badge>;
    }
  };

  const passedCount = drafts.filter(d => d.validation_status === 'passed').length;
  const reviewCount = drafts.filter(d => d.validation_status === 'review_needed').length;
  const failedCount = drafts.filter(d => d.validation_status === 'failed').length;

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
          onClick={handleGenerate}
          disabled={!canGenerate || generating}
        >
          {generating ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Sparkles className="h-4 w-4 mr-1" />}
          Generate AI Drafts
        </Button>
      </div>

      {selectedIssue && drafts.length > 0 && (
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm">Summary</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-4 gap-4 text-sm">
            <div><span className="text-muted-foreground">Total Drafts:</span> <strong>{drafts.length}</strong></div>
            <div><span className="text-muted-foreground">Passed:</span> <strong className="text-green-600">{passedCount}</strong></div>
            <div><span className="text-muted-foreground">Review Needed:</span> <strong className="text-yellow-600">{reviewCount}</strong></div>
            <div><span className="text-muted-foreground">Failed:</span> <strong className="text-red-600">{failedCount}</strong></div>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : drafts.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Draft Title</TableHead>
              <TableHead className="w-28">Validation</TableHead>
              <TableHead className="w-24">Publish</TableHead>
              <TableHead className="w-48">Notes</TableHead>
              <TableHead className="w-16">View</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {drafts.map(d => (
              <TableRow key={d.id}>
                <TableCell className="text-xs max-w-[300px] truncate" title={d.draft_title}>
                  {d.draft_title}
                </TableCell>
                <TableCell>{validationBadge(d.validation_status)}</TableCell>
                <TableCell>
                  <Badge variant="secondary">{d.publish_status}</Badge>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground max-w-[200px]">
                  {d.validation_notes?.length > 0 ? (
                    <ul className="list-disc list-inside">
                      {d.validation_notes.map((n, i) => <li key={i} className="truncate" title={n}>{n}</li>)}
                    </ul>
                  ) : '—'}
                </TableCell>
                <TableCell>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button size="icon" variant="ghost"><Eye className="h-4 w-4" /></Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl max-h-[80vh]">
                      <DialogHeader>
                        <DialogTitle className="text-sm">{d.draft_title}</DialogTitle>
                      </DialogHeader>
                      <ScrollArea className="max-h-[60vh]">
                        <div className="space-y-4 p-2">
                          <div>
                            <h4 className="text-xs font-semibold text-muted-foreground mb-1">AI Cleaned Data</h4>
                            <pre className="text-xs whitespace-pre-wrap font-mono p-3 bg-muted rounded">
                              {JSON.stringify(d.ai_cleaned_data || d.draft_data, null, 2)}
                            </pre>
                          </div>
                          {d.validation_notes?.length > 0 && (
                            <div>
                              <h4 className="text-xs font-semibold text-muted-foreground mb-1">Validation Notes</h4>
                              <ul className="text-xs list-disc list-inside text-yellow-700">
                                {d.validation_notes.map((n, i) => <li key={i}>{n}</li>)}
                              </ul>
                            </div>
                          )}
                        </div>
                      </ScrollArea>
                    </DialogContent>
                  </Dialog>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : selectedIssueId ? (
        <p className="text-sm text-muted-foreground text-center py-8">No draft jobs yet. Reconstruct notices first, then generate AI drafts.</p>
      ) : (
        <p className="text-sm text-muted-foreground text-center py-8">Select an issue to view draft jobs.</p>
      )}
    </div>
  );
}
