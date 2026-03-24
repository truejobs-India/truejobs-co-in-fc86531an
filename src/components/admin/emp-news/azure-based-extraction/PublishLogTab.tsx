import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';
import type { AzureEmpNewsIssue, AzureEmpNewsPublishLog } from '@/types/azureEmpNews';

export function PublishLogTab() {
  const [issues, setIssues] = useState<AzureEmpNewsIssue[]>([]);
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);
  const [logs, setLogs] = useState<AzureEmpNewsPublishLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<string>('all');

  const fetchIssues = useCallback(async () => {
    const { data } = await supabase
      .from('azure_emp_news_issues')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) setIssues(data as unknown as AzureEmpNewsIssue[]);
  }, []);

  const fetchLogs = useCallback(async () => {
    if (!selectedIssueId) { setLogs([]); return; }
    setLoading(true);
    const { data } = await supabase
      .from('azure_emp_news_publish_logs')
      .select('*')
      .eq('issue_id', selectedIssueId)
      .order('created_at', { ascending: false });
    if (data) setLogs(data as unknown as AzureEmpNewsPublishLog[]);
    setLoading(false);
  }, [selectedIssueId]);

  useEffect(() => { fetchIssues(); }, [fetchIssues]);
  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const filtered = filter === 'all' ? logs : logs.filter(l => l.status === filter);

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

        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="success">Success</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : filtered.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Action</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Message</TableHead>
              <TableHead className="w-40">Time</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map(l => (
              <TableRow key={l.id}>
                <TableCell className="text-xs font-medium">{l.action}</TableCell>
                <TableCell>
                  <Badge className={l.status === 'success' ? 'bg-green-600 text-white' : 'bg-destructive text-destructive-foreground'}>
                    {l.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground max-w-[400px] truncate" title={l.message || ''}>
                  {l.message || '—'}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {new Date(l.created_at).toLocaleString()}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : selectedIssueId ? (
        <p className="text-sm text-muted-foreground text-center py-8">No publish logs yet for this issue.</p>
      ) : (
        <p className="text-sm text-muted-foreground text-center py-8">Select an issue to view publish logs.</p>
      )}
    </div>
  );
}
