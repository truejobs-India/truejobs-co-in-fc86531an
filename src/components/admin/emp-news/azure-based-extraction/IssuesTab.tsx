import { useState, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAdminToast as useToast } from '@/contexts/AdminMessagesContext';
import { supabase } from '@/integrations/supabase/client';
import { Plus, Trash2, Loader2, Calendar } from 'lucide-react';
import type { AzureEmpNewsIssue } from '@/types/azureEmpNews';

interface IssuesTabProps {
  onSelectIssue: (issue: AzureEmpNewsIssue) => void;
}

export function IssuesTab({ onSelectIssue }: IssuesTabProps) {
  const { toast } = useToast();
  const [issues, setIssues] = useState<AzureEmpNewsIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDate, setNewDate] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchIssues = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('azure_emp_news_issues')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      setIssues((data || []) as unknown as AzureEmpNewsIssue[]);
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => { fetchIssues(); }, [fetchIssues]);

  const handleCreate = async () => {
    if (!newName.trim()) {
      toast({ title: 'Error', description: 'Issue name is required', variant: 'destructive' });
      return;
    }
    setCreating(true);
    const { data: userData } = await supabase.auth.getUser();
    const insertData: Record<string, unknown> = {
      issue_name: newName.trim(),
      created_by: userData?.user?.id || null,
    };
    if (newDate) insertData.issue_date = newDate;

    const { error } = await supabase.from('azure_emp_news_issues').insert(insertData as any);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Issue Created', description: `"${newName.trim()}" created successfully` });
      setNewName('');
      setNewDate('');
      fetchIssues();
    }
    setCreating(false);
  };

  const handleDelete = async (issue: AzureEmpNewsIssue) => {
    setDeletingId(issue.id);
    // Delete storage files first
    const { data: pages } = await supabase
      .from('azure_emp_news_pages')
      .select('storage_path')
      .eq('issue_id', issue.id);

    if (pages && pages.length > 0) {
      const paths = pages.map((p: any) => p.storage_path);
      await supabase.storage.from('employment-news-azure').remove(paths);
    }

    const { error } = await supabase.from('azure_emp_news_issues').delete().eq('id', issue.id);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Deleted', description: `"${issue.issue_name}" deleted` });
      fetchIssues();
    }
    setDeletingId(null);
  };

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-muted text-muted-foreground',
      processing: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      completed: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      partially_completed: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
      failed: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
      published: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      partially_published: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
    };
    return <Badge className={colors[status] || 'bg-muted text-muted-foreground'}>{status}</Badge>;
  };

  return (
    <div className="space-y-4">
      {/* Create new issue */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Create New Issue</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[200px]">
              <label className="text-sm font-medium text-foreground mb-1 block">Issue Name *</label>
              <Input
                placeholder="e.g. Employment News Vol. XLVIII No. 12"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </div>
            <div className="w-[180px]">
              <label className="text-sm font-medium text-foreground mb-1 block">Issue Date</label>
              <Input
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
              />
            </div>
            <Button onClick={handleCreate} disabled={creating || !newName.trim()}>
              {creating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
              Create Issue
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Issues list */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Issues ({issues.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : issues.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">No issues yet. Create one above.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Issue Name</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Pages</TableHead>
                  <TableHead>OCR</TableHead>
                  <TableHead>Recon</TableHead>
                  <TableHead>AI</TableHead>
                  <TableHead>Publish</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {issues.map((issue) => (
                  <TableRow key={issue.id} className="cursor-pointer hover:bg-muted/50" onClick={() => onSelectIssue(issue)}>
                    <TableCell className="font-medium">{issue.issue_name}</TableCell>
                    <TableCell>
                      {issue.issue_date ? (
                        <span className="flex items-center gap-1 text-sm">
                          <Calendar className="h-3 w-3" />
                          {issue.issue_date}
                        </span>
                      ) : '—'}
                    </TableCell>
                    <TableCell>{issue.uploaded_pages}/{issue.total_pages}</TableCell>
                    <TableCell>{statusBadge(issue.ocr_status)}</TableCell>
                    <TableCell>{statusBadge(issue.reconstruction_status)}</TableCell>
                    <TableCell>{statusBadge(issue.ai_status)}</TableCell>
                    <TableCell>{statusBadge(issue.publish_status)}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => { e.stopPropagation(); handleDelete(issue); }}
                        disabled={deletingId === issue.id}
                      >
                        {deletingId === issue.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4 text-destructive" />}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
