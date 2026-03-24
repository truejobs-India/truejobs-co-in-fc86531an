import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from '@/components/ui/use-toast';
import { Sparkles, Eye, Loader2, Send, Pencil, CheckCircle2, Link2 } from 'lucide-react';
import { AiModelSelector, getLastUsedModel } from '@/components/admin/AiModelSelector';
import type { AzureEmpNewsIssue, AzureEmpNewsDraftJob } from '@/types/azureEmpNews';

// Direct-API-only models — NO Lovable Gateway models
const AZURE_EMP_NEWS_AI_MODELS = [
  'vertex-flash', 'vertex-pro', 'vertex-3.1-pro', 'vertex-3-flash', 'vertex-3.1-flash-lite',
  'nova-pro', 'nova-premier', 'mistral',
  'sarvam-30b', 'sarvam-105b',
] as const;

const EDITABLE_FIELDS = [
  { key: 'employer_name', label: 'Employer Name' },
  { key: 'post_names', label: 'Post Names (comma-separated)' },
  { key: 'total_vacancies', label: 'Total Vacancies' },
  { key: 'qualification', label: 'Qualification' },
  { key: 'age_limit', label: 'Age Limit' },
  { key: 'salary', label: 'Salary / Pay' },
  { key: 'location', label: 'Location' },
  { key: 'application_method', label: 'Application Method' },
  { key: 'official_website', label: 'Official Website' },
  { key: 'last_date', label: 'Last Date' },
  { key: 'ad_reference', label: 'Ad / Ref Number' },
] as const;

export function DraftJobsTab() {
  const [issues, setIssues] = useState<AzureEmpNewsIssue[]>([]);
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<AzureEmpNewsDraftJob[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editDraft, setEditDraft] = useState<AzureEmpNewsDraftJob | null>(null);
  const [editFields, setEditFields] = useState<Record<string, string>>({});
  const [editSaving, setEditSaving] = useState(false);
  const [editTitleValue, setEditTitleValue] = useState('');
  const [aiModel, setAiModel] = useState(() =>
    getLastUsedModel('text', 'vertex-flash', AZURE_EMP_NEWS_AI_MODELS as unknown as readonly string[])
  );

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
  useEffect(() => { fetchDrafts(); setSelectedIds(new Set()); }, [fetchDrafts]);

  const selectedIssue = issues.find(i => i.id === selectedIssueId);
  const canGenerate = selectedIssue && selectedIssue.reconstruction_status === 'completed';

  const handleGenerate = async () => {
    if (!selectedIssueId) return;
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('azure-emp-news-ai-clean-drafts', {
        body: { issue_id: selectedIssueId, aiModel },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: 'AI Drafts Generated', description: `Model: ${aiModel} — Processed: ${data.processed}, Skipped: ${data.skipped}, Failed: ${data.failed}` });
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

  // --- Publish ---
  const doPublish = async (ids: string[]) => {
    if (ids.length === 0) return;
    setPublishing(true);
    try {
      const { data, error } = await supabase.functions.invoke('azure-emp-news-publish-drafts', {
        body: { draft_ids: ids },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const msg = `Published: ${data.published}, Skipped: ${data.skipped}, Failed: ${data.failed}`;
      toast({ title: 'Publish Complete', description: msg });
      if (data.errors?.length) {
        toast({ title: 'Publish Errors', description: data.errors.join('\n'), variant: 'destructive' });
      }
      setSelectedIds(new Set());
      fetchDrafts();
      fetchIssues();
    } catch (e: any) {
      toast({ title: 'Publish Error', description: e.message || 'Failed to publish', variant: 'destructive' });
    } finally {
      setPublishing(false);
    }
  };

  const publishSingle = (id: string) => doPublish([id]);
  const publishSelected = () => doPublish(Array.from(selectedIds));
  const publishAllPassed = () => {
    const passedIds = drafts
      .filter(d => d.validation_status === 'passed' && d.publish_status !== 'published')
      .map(d => d.id);
    doPublish(passedIds);
  };

  // --- Edit ---
  const openEdit = (d: AzureEmpNewsDraftJob) => {
    const cleaned = (d.ai_cleaned_data || d.draft_data) as Record<string, unknown>;
    const fields: Record<string, string> = {};
    for (const f of EDITABLE_FIELDS) {
      const val = cleaned[f.key];
      fields[f.key] = Array.isArray(val) ? (val as string[]).join(', ') : String(val || '');
    }
    setEditFields(fields);
    setEditTitleValue(d.draft_title);
    setEditDraft(d);
  };

  const saveEdit = async () => {
    if (!editDraft) return;
    setEditSaving(true);
    try {
      const existing = (editDraft.ai_cleaned_data || editDraft.draft_data) as Record<string, unknown>;
      const updated = { ...existing };
      for (const f of EDITABLE_FIELDS) {
        if (f.key === 'post_names') {
          updated[f.key] = editFields[f.key]?.split(',').map(s => s.trim()).filter(Boolean) || [];
        } else {
          updated[f.key] = editFields[f.key] || null;
        }
      }
      const { error } = await supabase
        .from('azure_emp_news_draft_jobs')
        .update({
          draft_title: editTitleValue,
          ai_cleaned_data: updated as any,
        })
        .eq('id', editDraft.id);
      if (error) throw error;
      toast({ title: 'Draft Updated' });
      setEditDraft(null);
      fetchDrafts();
    } catch (e: any) {
      toast({ title: 'Save Error', description: e.message, variant: 'destructive' });
    } finally {
      setEditSaving(false);
    }
  };

  // --- Selection ---
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };
  const toggleAll = () => {
    if (selectedIds.size === drafts.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(drafts.map(d => d.id)));
    }
  };

  const validationBadge = (status: string) => {
    switch (status) {
      case 'passed': return <Badge className="bg-green-600 text-white">Passed</Badge>;
      case 'failed': return <Badge variant="destructive">Failed</Badge>;
      case 'review_needed': return <Badge className="bg-yellow-600 text-white">Review</Badge>;
      default: return <Badge variant="secondary">Pending</Badge>;
    }
  };

  const publishBadge = (d: AzureEmpNewsDraftJob) => {
    if (d.publish_status === 'published') {
      return (
        <Badge className="bg-green-600 text-white gap-1">
          <Link2 className="h-3 w-3" /> Published
        </Badge>
      );
    }
    if (d.publish_status === 'failed') {
      return <Badge variant="destructive">Failed</Badge>;
    }
    return <Badge variant="secondary">Draft</Badge>;
  };

  const passedCount = drafts.filter(d => d.validation_status === 'passed').length;
  const reviewCount = drafts.filter(d => d.validation_status === 'review_needed').length;
  const failedCount = drafts.filter(d => d.validation_status === 'failed').length;
  const publishedCount = drafts.filter(d => d.publish_status === 'published').length;
  const unpublishedPassedCount = drafts.filter(d => d.validation_status === 'passed' && d.publish_status !== 'published').length;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
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

        <AiModelSelector
          value={aiModel}
          onValueChange={setAiModel}
          capability="text"
          allowedValues={AZURE_EMP_NEWS_AI_MODELS as unknown as readonly string[]}
          size="sm"
        />

        <Button size="sm" onClick={handleGenerate} disabled={!canGenerate || generating}>
          {generating ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Sparkles className="h-4 w-4 mr-1" />}
          Generate AI Drafts
        </Button>

        {selectedIds.size > 0 && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="sm" variant="outline" disabled={publishing}>
                <Send className="h-4 w-4 mr-1" /> Publish Selected ({selectedIds.size})
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Publish {selectedIds.size} draft(s)?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will create live job entries in pending status. Already-published drafts will be skipped.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={publishSelected}>Publish</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}

        {unpublishedPassedCount > 0 && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="sm" disabled={publishing}>
                <CheckCircle2 className="h-4 w-4 mr-1" /> Publish All Passed ({unpublishedPassedCount})
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Publish all {unpublishedPassedCount} passed drafts?</AlertDialogTitle>
                <AlertDialogDescription>
                  Only drafts with validation status "passed" will be published. Review-needed and failed drafts are excluded.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={publishAllPassed}>Publish All Passed</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      {selectedIssue && drafts.length > 0 && (
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm">Summary</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-5 gap-4 text-sm">
            <div><span className="text-muted-foreground">Total:</span> <strong>{drafts.length}</strong></div>
            <div><span className="text-muted-foreground">Passed:</span> <strong className="text-green-600">{passedCount}</strong></div>
            <div><span className="text-muted-foreground">Review:</span> <strong className="text-yellow-600">{reviewCount}</strong></div>
            <div><span className="text-muted-foreground">Failed:</span> <strong className="text-red-600">{failedCount}</strong></div>
            <div><span className="text-muted-foreground">Published:</span> <strong className="text-green-600">{publishedCount}</strong></div>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : drafts.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  checked={selectedIds.size === drafts.length && drafts.length > 0}
                  onCheckedChange={toggleAll}
                />
              </TableHead>
              <TableHead>Draft Title</TableHead>
              <TableHead className="w-24">Validation</TableHead>
              <TableHead className="w-28">Publish</TableHead>
              <TableHead className="w-40">Notes</TableHead>
              <TableHead className="w-28">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {drafts.map(d => (
              <TableRow key={d.id}>
                <TableCell>
                  <Checkbox
                    checked={selectedIds.has(d.id)}
                    onCheckedChange={() => toggleSelect(d.id)}
                  />
                </TableCell>
                <TableCell className="text-xs max-w-[280px] truncate" title={d.draft_title}>
                  {d.draft_title}
                </TableCell>
                <TableCell>{validationBadge(d.validation_status)}</TableCell>
                <TableCell>{publishBadge(d)}</TableCell>
                <TableCell className="text-xs text-muted-foreground max-w-[180px]">
                  {d.validation_notes?.length > 0 ? (
                    <ul className="list-disc list-inside">
                      {d.validation_notes.slice(0, 2).map((n, i) => <li key={i} className="truncate" title={n}>{n}</li>)}
                      {d.validation_notes.length > 2 && <li>+{d.validation_notes.length - 2} more</li>}
                    </ul>
                  ) : '—'}
                </TableCell>
                <TableCell className="flex gap-1">
                  <Button size="icon" variant="ghost" onClick={() => openEdit(d)} title="Edit">
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button size="icon" variant="ghost" title="View JSON"><Eye className="h-4 w-4" /></Button>
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
                  {d.publish_status !== 'published' && (
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => publishSingle(d.id)}
                      disabled={publishing}
                      title="Publish"
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  )}
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

      {/* Edit Dialog */}
      <Dialog open={!!editDraft} onOpenChange={(open) => { if (!open) setEditDraft(null); }}>
        <DialogContent className="max-w-lg max-h-[85vh]">
          <DialogHeader>
            <DialogTitle className="text-sm">Edit Draft</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] pr-4">
            <div className="space-y-3">
              <div>
                <Label className="text-xs">Draft Title</Label>
                <Input
                  value={editTitleValue}
                  onChange={e => setEditTitleValue(e.target.value)}
                  className="text-sm"
                />
              </div>
              {EDITABLE_FIELDS.map(f => (
                <div key={f.key}>
                  <Label className="text-xs">{f.label}</Label>
                  <Input
                    value={editFields[f.key] || ''}
                    onChange={e => setEditFields(prev => ({ ...prev, [f.key]: e.target.value }))}
                    className="text-sm"
                  />
                </div>
              ))}
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDraft(null)}>Cancel</Button>
            <Button onClick={saveEdit} disabled={editSaving}>
              {editSaving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
