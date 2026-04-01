/**
 * Phase 4: Admin Review UI for Intake Drafts.
 * Dashboard cards, filters, table, and row actions.
 */
import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import {
  FileText, CheckCircle2, AlertTriangle, XCircle, Upload as UploadIcon,
  RefreshCw, Search, Eye, RotateCcw, Check, ArrowRightCircle, Loader2, Send, Trash2,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAdminToast as useToast } from '@/contexts/AdminMessagesContext';
import { AiModelSelector, getLastUsedModel } from '@/components/admin/AiModelSelector';
import { IntakeCsvUploader } from './IntakeCsvUploader';
import { IntakeDraftDetailDialog } from './IntakeDraftDetailDialog';

type IntakeDraft = {
  id: string;
  raw_title: string | null;
  source_url: string | null;
  source_domain: string | null;
  content_type: string | null;
  primary_status: string | null;
  publish_target: string | null;
  processing_status: string;
  review_status: string;
  confidence_score: number | null;
  secondary_tags: string[] | null;
  publish_blockers: string[] | null;
  classification_reason: string | null;
  organisation_name: string | null;
  post_name: string | null;
  exam_name: string | null;
  normalized_title: string | null;
  created_at: string;
};

const STATUS_COLORS: Record<string, string> = {
  publish_ready: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  manual_check: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  reject: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
};

const PROCESSING_COLORS: Record<string, string> = {
  imported: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  ai_processed: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  reviewed: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200',
  published: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  publish_failed: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
};

export function IntakeDraftsManager() {
  const { toast } = useToast();
  const [drafts, setDrafts] = useState<IntakeDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [counts, setCounts] = useState({ total: 0, imported: 0, publishReady: 0, manualCheck: 0, reject: 0, published: 0 });
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterTarget, setFilterTarget] = useState('all');
  const [filterProcessing, setFilterProcessing] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [aiModel, setAiModel] = useState(() => getLastUsedModel('text', 'gemini-flash'));
  const [classifyingIds, setClassifyingIds] = useState<Set<string>>(new Set());
  const [publishingIds, setPublishingIds] = useState<Set<string>>(new Set());
  const [selectedDraft, setSelectedDraft] = useState<IntakeDraft | null>(null);
  const [showUploader, setShowUploader] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);

  const fetchDrafts = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase.from('intake_drafts').select('*').order('created_at', { ascending: false }).limit(200);

      if (filterStatus !== 'all') {
        if (filterStatus === 'unclassified') {
          query = query.is('primary_status', null);
        } else {
          query = query.eq('primary_status', filterStatus);
        }
      }
      if (filterTarget !== 'all') query = query.eq('publish_target', filterTarget);
      if (filterProcessing !== 'all') query = query.eq('processing_status', filterProcessing);
      if (searchQuery.trim()) {
        const s = `%${searchQuery.trim()}%`;
        query = query.or(`raw_title.ilike.${s},normalized_title.ilike.${s},organisation_name.ilike.${s},source_url.ilike.${s}`);
      }

      const { data, error } = await query;
      if (error) throw error;
      setDrafts((data || []) as any);

      // Fetch counts
      const [total, imported, publishReady, manualCheck, reject, published] = await Promise.all([
        supabase.from('intake_drafts').select('id', { count: 'exact', head: true }),
        supabase.from('intake_drafts').select('id', { count: 'exact', head: true }).eq('processing_status', 'imported'),
        supabase.from('intake_drafts').select('id', { count: 'exact', head: true }).eq('primary_status', 'publish_ready'),
        supabase.from('intake_drafts').select('id', { count: 'exact', head: true }).eq('primary_status', 'manual_check'),
        supabase.from('intake_drafts').select('id', { count: 'exact', head: true }).eq('primary_status', 'reject'),
        supabase.from('intake_drafts').select('id', { count: 'exact', head: true }).eq('processing_status', 'published'),
      ]);
      setCounts({
        total: total.count || 0,
        imported: imported.count || 0,
        publishReady: publishReady.count || 0,
        manualCheck: manualCheck.count || 0,
        reject: reject.count || 0,
        published: published.count || 0,
      });
    } catch (err) {
      toast({ title: 'Error loading drafts', description: String(err), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [filterStatus, filterTarget, filterProcessing, searchQuery, toast]);

  useEffect(() => { fetchDrafts(); }, [fetchDrafts]);

  const handleClassify = async (ids: string[]) => {
    setClassifyingIds(prev => new Set([...prev, ...ids]));
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Not authenticated');

      const resp = await supabase.functions.invoke('intake-ai-classify', {
        body: { draft_ids: ids, aiModel },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (resp.error) throw resp.error;
      toast({ title: 'AI Classification Complete', description: `Processed ${ids.length} draft(s)` });
      fetchDrafts();
    } catch (err) {
      toast({ title: 'Classification Failed', description: String(err), variant: 'destructive' });
    } finally {
      setClassifyingIds(prev => { const s = new Set(prev); ids.forEach(id => s.delete(id)); return s; });
    }
  };

  const handleStatusUpdate = async (id: string, updates: Record<string, any>) => {
    const { error } = await supabase.from('intake_drafts').update(updates as any).eq('id', id);
    if (error) {
      toast({ title: 'Update failed', description: error.message, variant: 'destructive' });
    } else {
      fetchDrafts();
    }
  };

  const handlePublish = async (id: string) => {
    setPublishingIds(prev => new Set([...prev, id]));
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Not authenticated');

      const resp = await supabase.functions.invoke('intake-publish', {
        body: { draft_id: id },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (resp.error) throw resp.error;
      const result = resp.data;
      if (result?.error) {
        toast({ title: 'Publish Blocked', description: result.error, variant: 'destructive' });
      } else {
        toast({ title: 'Published Successfully', description: `Published to ${result?.table || 'live table'}` });
      }
      fetchDrafts();
    } catch (err) {
      toast({ title: 'Publish Failed', description: String(err), variant: 'destructive' });
    } finally {
      setPublishingIds(prev => { const s = new Set(prev); s.delete(id); return s; });
    }
  };

  const handleClassifyAll = () => {
    const importedIds = drafts
      .filter(d => d.processing_status === 'imported')
      .map(d => d.id)
      .slice(0, 15);
    if (importedIds.length === 0) {
      toast({ title: 'Nothing to classify', description: 'No imported rows found' });
      return;
    }
    handleClassify(importedIds);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === drafts.length && drafts.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(drafts.map(d => d.id)));
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return;
    setDeleting(true);
    try {
      const ids = Array.from(selectedIds);
      // Delete in batches of 50
      for (let i = 0; i < ids.length; i += 50) {
        const batch = ids.slice(i, i + 50);
        const { error } = await supabase.from('intake_drafts').delete().in('id', batch);
        if (error) throw error;
      }
      toast({ title: 'Deleted', description: `Permanently deleted ${ids.length} draft(s)` });
      setSelectedIds(new Set());
      fetchDrafts();
    } catch (err) {
      toast({ title: 'Delete failed', description: String(err), variant: 'destructive' });
    } finally {
      setDeleting(false);
    }
  };

  const dashCards = [
    { label: 'Total', count: counts.total, icon: FileText, color: 'text-foreground' },
    { label: 'Imported', count: counts.imported, icon: UploadIcon, color: 'text-blue-600' },
    { label: 'Publish Ready', count: counts.publishReady, icon: CheckCircle2, color: 'text-green-600' },
    { label: 'Manual Check', count: counts.manualCheck, icon: AlertTriangle, color: 'text-amber-600' },
    { label: 'Reject', count: counts.reject, icon: XCircle, color: 'text-red-600' },
    { label: 'Published', count: counts.published, icon: Send, color: 'text-emerald-600' },
  ];

  return (
    <div className="space-y-4">
      {/* Dashboard Cards */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
        {dashCards.map(c => (
          <Card key={c.label}>
            <CardContent className="p-3 flex items-center gap-2">
              <c.icon className={`h-4 w-4 ${c.color}`} />
              <div>
                <div className="text-lg font-bold">{c.count}</div>
                <div className="text-[10px] text-muted-foreground">{c.label}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Controls Bar */}
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => setShowUploader(!showUploader)}>
          <UploadIcon className="h-4 w-4 mr-1" />
          {showUploader ? 'Hide Uploader' : 'Import CSV'}
        </Button>

        <div className="flex items-center gap-1">
          <AiModelSelector value={aiModel} onValueChange={setAiModel} capability="text" size="sm" triggerClassName="w-[180px] h-8 text-xs" />
          <Button variant="outline" size="sm" onClick={handleClassifyAll} disabled={classifyingIds.size > 0}>
            {classifyingIds.size > 0 ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RotateCcw className="h-4 w-4 mr-1" />}
            Classify Imported
          </Button>
        </div>

        <Button variant="ghost" size="sm" onClick={fetchDrafts}>
          <RefreshCw className="h-4 w-4" />
        </Button>

        {selectedIds.size > 0 && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm" disabled={deleting}>
                {deleting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Trash2 className="h-4 w-4 mr-1" />}
                Delete Selected ({selectedIds.size})
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Permanently delete {selectedIds.size} draft(s)?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. The selected drafts will be permanently removed from the database.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteSelected} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Delete Permanently
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}

        {/* Filters */}
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="h-8 text-xs w-[130px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-xs">All Status</SelectItem>
            <SelectItem value="unclassified" className="text-xs">Unclassified</SelectItem>
            <SelectItem value="publish_ready" className="text-xs">Publish Ready</SelectItem>
            <SelectItem value="manual_check" className="text-xs">Manual Check</SelectItem>
            <SelectItem value="reject" className="text-xs">Reject</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filterTarget} onValueChange={setFilterTarget}>
          <SelectTrigger className="h-8 text-xs w-[120px]"><SelectValue placeholder="Target" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-xs">All Targets</SelectItem>
            <SelectItem value="jobs" className="text-xs">Jobs</SelectItem>
            <SelectItem value="results" className="text-xs">Results</SelectItem>
            <SelectItem value="admit_cards" className="text-xs">Admit Cards</SelectItem>
            <SelectItem value="answer_keys" className="text-xs">Answer Keys</SelectItem>
            <SelectItem value="exams" className="text-xs">Exams</SelectItem>
            <SelectItem value="notifications" className="text-xs">Notifications</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filterProcessing} onValueChange={setFilterProcessing}>
          <SelectTrigger className="h-8 text-xs w-[130px]"><SelectValue placeholder="Processing" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-xs">All Processing</SelectItem>
            <SelectItem value="imported" className="text-xs">Imported</SelectItem>
            <SelectItem value="ai_processed" className="text-xs">AI Processed</SelectItem>
            <SelectItem value="reviewed" className="text-xs">Reviewed</SelectItem>
            <SelectItem value="published" className="text-xs">Published</SelectItem>
            <SelectItem value="publish_failed" className="text-xs">Failed</SelectItem>
          </SelectContent>
        </Select>

        <div className="relative">
          <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="h-8 text-xs pl-7 w-[160px]"
          />
        </div>
      </div>

      {/* CSV Uploader */}
      {showUploader && <IntakeCsvUploader onImportComplete={() => { setShowUploader(false); fetchDrafts(); }} />}

      {/* Table */}
      <div className="border rounded-md overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  checked={selectedIds.size === drafts.length && drafts.length > 0}
                  onCheckedChange={toggleAll}
                />
              </TableHead>
              <TableHead className="text-xs">Status</TableHead>
              <TableHead className="text-xs">Target</TableHead>
              <TableHead className="text-xs">Type</TableHead>
              <TableHead className="text-xs">Title</TableHead>
              <TableHead className="text-xs">Org</TableHead>
              <TableHead className="text-xs">Confidence</TableHead>
              <TableHead className="text-xs">Tags</TableHead>
              <TableHead className="text-xs">Processing</TableHead>
              <TableHead className="text-xs">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={10} className="text-center py-8"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></TableCell></TableRow>
            ) : drafts.length === 0 ? (
              <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">No drafts found</TableCell></TableRow>
            ) : drafts.map(d => {
              const title = (d as any).normalized_title || d.raw_title || '(no title)';
              const tags = Array.isArray(d.secondary_tags) ? d.secondary_tags : [];

              return (
                <TableRow key={d.id}>
                  <TableCell>
                    {d.primary_status ? (
                      <Badge className={`text-[10px] ${STATUS_COLORS[d.primary_status] || ''}`}>
                        {d.primary_status.replace('_', ' ')}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px]">—</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {d.publish_target && d.publish_target !== 'none' ? (
                      <Badge variant="outline" className="text-[10px]">{d.publish_target}</Badge>
                    ) : '—'}
                  </TableCell>
                  <TableCell className="text-xs">{d.content_type || '—'}</TableCell>
                  <TableCell className="text-xs max-w-[200px] truncate" title={title}>{title}</TableCell>
                  <TableCell className="text-xs max-w-[120px] truncate">{(d as any).organisation_name || '—'}</TableCell>
                  <TableCell className="text-xs">{d.confidence_score != null ? `${d.confidence_score}%` : '—'}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-0.5">
                      {tags.slice(0, 3).map((t: string) => (
                        <Badge key={t} variant="outline" className="text-[9px] px-1 py-0">{t}</Badge>
                      ))}
                      {tags.length > 3 && <Badge variant="outline" className="text-[9px] px-1 py-0">+{tags.length - 3}</Badge>}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={`text-[10px] ${PROCESSING_COLORS[d.processing_status] || ''}`}>
                      {d.processing_status.replace('_', ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setSelectedDraft(d)} title="View">
                        <Eye className="h-3 w-3" />
                      </Button>
                      {d.processing_status === 'imported' && (
                        <Button
                          variant="ghost" size="icon" className="h-6 w-6"
                          onClick={() => handleClassify([d.id])}
                          disabled={classifyingIds.has(d.id)}
                          title="Run AI"
                        >
                          {classifyingIds.has(d.id) ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
                        </Button>
                      )}
                      {d.processing_status !== 'published' && d.review_status !== 'approved' && (
                        <Button
                          variant="ghost" size="icon" className="h-6 w-6"
                          onClick={() => handleStatusUpdate(d.id, { review_status: 'approved', processing_status: 'reviewed' })}
                          title="Approve"
                        >
                          <Check className="h-3 w-3 text-green-600" />
                        </Button>
                      )}
                      {d.primary_status !== 'manual_check' && d.processing_status !== 'published' && (
                        <Button
                          variant="ghost" size="icon" className="h-6 w-6"
                          onClick={() => handleStatusUpdate(d.id, { primary_status: 'manual_check' })}
                          title="Manual Check"
                        >
                          <AlertTriangle className="h-3 w-3 text-amber-600" />
                        </Button>
                      )}
                      {d.primary_status !== 'reject' && d.processing_status !== 'published' && (
                        <Button
                          variant="ghost" size="icon" className="h-6 w-6"
                          onClick={() => handleStatusUpdate(d.id, { primary_status: 'reject', review_status: 'rejected' })}
                          title="Reject"
                        >
                          <XCircle className="h-3 w-3 text-red-600" />
                        </Button>
                      )}
                      {d.primary_status === 'publish_ready' && d.review_status === 'approved' && d.processing_status !== 'published' && (
                        <Button
                          variant="ghost" size="icon" className="h-6 w-6"
                          onClick={() => handlePublish(d.id)}
                          disabled={publishingIds.has(d.id)}
                          title="Publish"
                        >
                          {publishingIds.has(d.id) ? <Loader2 className="h-3 w-3 animate-spin" /> : <ArrowRightCircle className="h-3 w-3 text-emerald-600" />}
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Detail Dialog */}
      {selectedDraft && (
        <IntakeDraftDetailDialog
          draft={selectedDraft}
          onClose={() => setSelectedDraft(null)}
          onSave={async (updates) => {
            await handleStatusUpdate(selectedDraft.id, updates);
            setSelectedDraft(null);
          }}
        />
      )}
    </div>
  );
}
