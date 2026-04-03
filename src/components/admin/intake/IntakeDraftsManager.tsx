/**
 * AI-First Intake Dashboard: Draft-first, approval-focused.
 * Auto-processes imports, shows Ready Drafts as default view.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  CheckCircle2, AlertTriangle, XCircle, Upload as UploadIcon,
  RefreshCw, Search, Eye, Loader2, Send, Trash2, Play, Square, Zap,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAdminToast as useToast } from '@/contexts/AdminMessagesContext';
import { AiModelSelector, getLastUsedModel } from '@/components/admin/AiModelSelector';
import { IntakeCsvUploader } from './IntakeCsvUploader';
import { IntakeDraftDetailDialog } from './IntakeDraftDetailDialog';
import { IntakeDraftPreviewDialog } from './IntakeDraftPreviewDialog';

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
  closing_date: string | null;
  scrape_run_id: string | null;
  publish_error: string | null;
  enrichment_result: string | null;
  created_at: string;
};

type TabKey = 'ready' | 'low_confidence' | 'published' | 'rejected';

const TAB_LABELS: Record<TabKey, string> = {
  ready: 'Ready Drafts',
  low_confidence: 'Low Confidence',
  published: 'Published',
  rejected: 'Rejected',
};

function isLowConfidence(d: IntakeDraft): boolean {
  if (d.processing_status === 'publish_failed') return true;

  const score = d.confidence_score;
  const blockers = Array.isArray(d.publish_blockers) ? d.publish_blockers : [];
  const tags = Array.isArray(d.secondary_tags) ? d.secondary_tags : [];

  if (score !== null && score < 50) return true;
  if (blockers.length > 0) return true;
  if (d.primary_status === 'manual_check') return true;
  if (tags.includes('stale_content') || tags.includes('old_year')) return true;
  if (tags.includes('generic_title') && !d.normalized_title) return true;
  if (tags.includes('exact_duplicate') || tags.includes('probable_duplicate')) return true;
  if (tags.includes('published_duplicate_risk')) return true;

  // Missing core fields for publishable content
  const isJob = d.publish_target === 'jobs' || d.content_type === 'job';
  if (isJob && !d.organisation_name) return true;
  const isExam = ['results', 'admit_cards', 'answer_keys', 'exams'].includes(d.publish_target || '');
  if (isExam && !d.exam_name) return true;

  return false;
}

function filterDrafts(drafts: IntakeDraft[], tab: TabKey, searchQuery: string): IntakeDraft[] {
  let filtered: IntakeDraft[];
  switch (tab) {
    case 'ready':
      filtered = drafts.filter(d =>
        d.primary_status === 'publish_ready' &&
        d.processing_status === 'ai_processed' &&
        d.review_status === 'pending' &&
        !isLowConfidence(d)
      );
      break;
    case 'low_confidence':
      filtered = drafts.filter(d =>
        (d.processing_status === 'ai_processed' || d.processing_status === 'publish_failed') &&
        d.primary_status !== 'reject' &&
        isLowConfidence(d)
      );
      break;
    case 'published':
      filtered = drafts.filter(d => d.processing_status === 'published');
      break;
    case 'rejected':
      filtered = drafts.filter(d => d.primary_status === 'reject');
      break;
  }

  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase();
    filtered = filtered.filter(d =>
      (d.normalized_title || d.raw_title || '').toLowerCase().includes(q) ||
      (d.organisation_name || '').toLowerCase().includes(q) ||
      (d.source_url || '').toLowerCase().includes(q)
    );
  }

  return filtered;
}

export function IntakeDraftsManager() {
  const { toast } = useToast();
  const [allDrafts, setAllDrafts] = useState<IntakeDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>('ready');
  const [searchQuery, setSearchQuery] = useState('');
  const [aiModel, setAiModel] = useState(() => getLastUsedModel('text', 'gemini-flash'));
  const [selectedDraft, setSelectedDraft] = useState<IntakeDraft | null>(null);
  const [previewDraftId, setPreviewDraftId] = useState<string | null>(null);
  const [showUploader, setShowUploader] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Processing state
  const processingRef = useRef(false);
  const [processing, setProcessing] = useState(false);
  const [processProgress, setProcessProgress] = useState({ current: 0, total: 0, phase: '' });

  // Bulk action state
  const [bulkActioning, setBulkActioning] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleteScope, setDeleteScope] = useState<'selected' | 'all'>('selected');
  const [singleDeleteId, setSingleDeleteId] = useState<string | null>(null);
  const [fillingEmpty, setFillingEmpty] = useState(false);
  const [fillProgress, setFillProgress] = useState({ current: 0, total: 0 });

  const fetchDrafts = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch all non-imported drafts (AI processed or beyond) + any recently imported
      const { data, error } = await supabase
        .from('intake_drafts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1000);
      if (error) throw error;
      setAllDrafts((data || []) as any);
    } catch (err) {
      toast({ title: 'Error loading drafts', description: String(err), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchDrafts(); }, [fetchDrafts]);

  // Auto-processing loop
  const runAutoProcessing = async (importedIds: string[], scrapeRunId: string) => {
    if (processingRef.current) return;
    processingRef.current = true;
    setProcessing(true);

    try {
      // Refresh session to get a valid, non-expired token
      let session: { access_token: string } | null = null;
      const { data: refreshData } = await supabase.auth.refreshSession();
      if (refreshData?.session?.access_token) {
        session = refreshData.session;
      } else {
        const { data: fallbackData } = await supabase.auth.getSession();
        session = fallbackData?.session ?? null;
      }
      if (!session?.access_token) throw new Error('Not authenticated');

      // Pass 1: Classify all imported rows
      let remainingIds = [...importedIds];
      const totalPass1 = remainingIds.length;
      setProcessProgress({ current: 0, total: totalPass1, phase: 'AI Classification (Pass 1)' });

      while (remainingIds.length > 0 && processingRef.current) {
        const batch = remainingIds.slice(0, 15);
        remainingIds = remainingIds.slice(15);

        try {
          await supabase.functions.invoke('intake-ai-classify', {
            body: { draft_ids: batch, aiModel },
            headers: { Authorization: `Bearer ${session.access_token}` },
          });
        } catch (err) {
          console.error('Classification batch error:', err);
        }

        setProcessProgress(prev => ({ ...prev, current: totalPass1 - remainingIds.length }));

        if (remainingIds.length > 0 && processingRef.current) {
          await new Promise(r => setTimeout(r, 1500));
        }
      }

      if (!processingRef.current) {
        toast({ title: 'Processing Stopped', description: 'You can resume by re-importing or refreshing.' });
        return;
      }

      // Pass 2: Retry weak rows with enhanced extraction
      const { data: weakRows } = await supabase
        .from('intake_drafts')
        .select('id')
        .eq('scrape_run_id', scrapeRunId)
        .eq('primary_status', 'manual_check')
        .gt('confidence_score', 30);

      const retryIds = (weakRows || []).map((r: any) => r.id);

      if (retryIds.length > 0 && processingRef.current) {
        let retryRemaining = [...retryIds];
        setProcessProgress({ current: 0, total: retryIds.length, phase: 'AI Retry (Pass 2 — Enhanced)' });

        while (retryRemaining.length > 0 && processingRef.current) {
          const batch = retryRemaining.slice(0, 15);
          retryRemaining = retryRemaining.slice(15);

          try {
            await supabase.functions.invoke('intake-ai-classify', {
              body: { draft_ids: batch, aiModel, retry_enhanced: true },
              headers: { Authorization: `Bearer ${session.access_token}` },
            });
          } catch (err) {
            console.error('Retry batch error:', err);
          }

          setProcessProgress(prev => ({ ...prev, current: retryIds.length - retryRemaining.length }));

          if (retryRemaining.length > 0 && processingRef.current) {
            await new Promise(r => setTimeout(r, 1500));
          }
        }
      }

      toast({ title: 'AI Processing Complete', description: `Processed ${totalPass1} rows. ${retryIds.length} retried.` });
    } catch (err) {
      toast({ title: 'Processing Error', description: String(err), variant: 'destructive' });
    } finally {
      processingRef.current = false;
      setProcessing(false);
      setProcessProgress({ current: 0, total: 0, phase: '' });
      fetchDrafts();
    }
  };

  // Resume processing for interrupted imports
  const handleResumeProcessing = async () => {
    const { data: unprocessed } = await supabase
      .from('intake_drafts')
      .select('id, scrape_run_id')
      .eq('processing_status', 'imported')
      .order('created_at', { ascending: false })
      .limit(500);

    if (!unprocessed || unprocessed.length === 0) {
      toast({ title: 'Nothing to Resume', description: 'No unprocessed imports found.' });
      return;
    }

    const scrapeRunId = unprocessed[0].scrape_run_id || 'resume';
    const ids = unprocessed.map((r: any) => r.id);
    runAutoProcessing(ids, scrapeRunId);
  };

  const stopProcessing = () => {
    processingRef.current = false;
  };

  // Approve & Publish single
  const handleApproveAndPublish = async (id: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Not authenticated');

      // Set approved (edge function requires it)
      await supabase.from('intake_drafts').update({
        review_status: 'approved',
      } as any).eq('id', id);

      const resp = await supabase.functions.invoke('intake-publish', {
        body: { draft_id: id },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      const errorMsg = resp.error ? String(resp.error) : resp.data?.error;
      if (errorMsg) {
        // Revert and mark as publish_failed so row stays visible
        await supabase.from('intake_drafts').update({
          review_status: 'pending',
          processing_status: 'publish_failed',
          publish_error: String(errorMsg).slice(0, 500),
        } as any).eq('id', id);
        toast({ title: 'Publish Failed', description: String(errorMsg), variant: 'destructive' });
      } else {
        toast({ title: 'Published', description: `Published to ${resp.data?.table || 'live table'}` });
      }
      fetchDrafts();
    } catch (err) {
      // On unexpected error, also mark as publish_failed
      await supabase.from('intake_drafts').update({
        review_status: 'pending',
        processing_status: 'publish_failed',
        publish_error: String(err).slice(0, 500),
      } as any).eq('id', id);
      toast({ title: 'Publish Failed', description: String(err), variant: 'destructive' });
      fetchDrafts();
    }
  };

  // Bulk approve & publish
  const handleBulkApprovePublish = async (ids: string[]) => {
    if (ids.length === 0) return;
    setBulkActioning(true);
    let success = 0;
    let failed = 0;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Not authenticated');

      for (const id of ids) {
        try {
          await supabase.from('intake_drafts').update({
            review_status: 'approved',
          } as any).eq('id', id);

          const resp = await supabase.functions.invoke('intake-publish', {
            body: { draft_id: id },
            headers: { Authorization: `Bearer ${session.access_token}` },
          });

          const errorMsg = resp.error ? String(resp.error) : resp.data?.error;
          if (errorMsg) {
            await supabase.from('intake_drafts').update({
              review_status: 'pending',
              processing_status: 'publish_failed',
              publish_error: String(errorMsg).slice(0, 500),
            } as any).eq('id', id);
            failed++;
          } else {
            success++;
          }
        } catch (err) {
          await supabase.from('intake_drafts').update({
            review_status: 'pending',
            processing_status: 'publish_failed',
            publish_error: String(err).slice(0, 500),
          } as any).eq('id', id);
          failed++;
        }
      }

      toast({
        title: 'Bulk Publish Complete',
        description: `${success} published, ${failed} failed`,
        variant: failed > 0 ? 'destructive' : 'default',
      });
      fetchDrafts();
    } catch (err) {
      toast({ title: 'Bulk action failed', description: String(err), variant: 'destructive' });
    } finally {
      setBulkActioning(false);
      setSelectedIds(new Set());
    }
  };

  // Reject single
  const handleReject = async (id: string) => {
    await supabase.from('intake_drafts').update({
      primary_status: 'reject',
      review_status: 'rejected',
    } as any).eq('id', id);
    fetchDrafts();
  };

  // Delete permanently
  const handleDeleteIds = async (ids: string[]) => {
    if (ids.length === 0) return;
    setDeleting(true);
    try {
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

  // Fill empty fields
  const handleFillEmpty = async (ids: string[]) => {
    if (ids.length === 0) return;
    setFillingEmpty(true);
    setFillProgress({ current: 0, total: ids.length });

    try {
      let session: { access_token: string } | null = null;
      const { data: refreshData } = await supabase.auth.refreshSession();
      if (refreshData?.session?.access_token) {
        session = refreshData.session;
      } else {
        const { data: fallbackData } = await supabase.auth.getSession();
        session = fallbackData?.session ?? null;
      }
      if (!session?.access_token) throw new Error('Not authenticated');

      let remaining = [...ids];
      while (remaining.length > 0) {
        const batch = remaining.slice(0, 15);
        remaining = remaining.slice(15);

        try {
          await supabase.functions.invoke('intake-ai-classify', {
            body: { draft_ids: batch, aiModel, fill_empty_only: true },
            headers: { Authorization: `Bearer ${session.access_token}` },
          });
        } catch (err) {
          console.error('Fill empty batch error:', err);
        }

        setFillProgress(prev => ({ ...prev, current: ids.length - remaining.length }));

        if (remaining.length > 0) {
          await new Promise(r => setTimeout(r, 1500));
        }
      }

      toast({ title: 'Fill Empty Fields Complete', description: `Processed ${ids.length} draft(s)` });
    } catch (err) {
      toast({ title: 'Fill failed', description: String(err), variant: 'destructive' });
    } finally {
      setFillingEmpty(false);
      setFillProgress({ current: 0, total: 0 });
      fetchDrafts();
    }
  };

  const visibleDrafts = filterDrafts(allDrafts, activeTab, searchQuery);

  const tabCounts = {
    ready: filterDrafts(allDrafts, 'ready', '').length,
    low_confidence: filterDrafts(allDrafts, 'low_confidence', '').length,
    published: filterDrafts(allDrafts, 'published', '').length,
    rejected: filterDrafts(allDrafts, 'rejected', '').length,
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === visibleDrafts.length && visibleDrafts.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(visibleDrafts.map(d => d.id)));
    }
  };

  // Import handler
  const onImportComplete = (importedIds: string[], scrapeRunId: string) => {
    setShowUploader(false);
    if (importedIds.length > 0) {
      runAutoProcessing(importedIds, scrapeRunId);
    }
  };

  // Unprocessed count for resume button
  const unprocessedCount = allDrafts.filter(d => d.processing_status === 'imported').length;

  // Delete all scope label
  const deleteAllLabel = `Delete All ${TAB_LABELS[activeTab]}${searchQuery.trim() ? ' (filtered)' : ''}`;
  const deleteAllCount = visibleDrafts.length;

  const confirmDeleteAll = () => {
    setDeleteScope('all');
    setDeleteConfirmText('');
    setDeleteConfirmOpen(true);
  };

  const confirmDeleteSelected = () => {
    setDeleteScope('selected');
    setDeleteConfirmText('');
    setDeleteConfirmOpen(true);
  };

  const executeDelete = () => {
    if (deleteScope === 'all') {
      handleDeleteIds(visibleDrafts.map(d => d.id));
    } else {
      handleDeleteIds(Array.from(selectedIds));
    }
    setDeleteConfirmOpen(false);
    setDeleteConfirmText('');
  };

  const deleteCount = deleteScope === 'all' ? deleteAllCount : selectedIds.size;
  const deleteScopeLabel = deleteScope === 'all'
    ? `${deleteAllCount} ${TAB_LABELS[activeTab].toLowerCase()}${searchQuery.trim() ? ' matching your filter' : ''}`
    : `${selectedIds.size} selected draft(s)`;

  return (
    <div className="space-y-4">
      {/* Processing Banner */}
      {processing && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Loader2 className="h-4 w-4 animate-spin" />
                {processProgress.phase}: {processProgress.current} / {processProgress.total}
              </div>
              <Button variant="outline" size="sm" onClick={stopProcessing}>
                <Square className="h-3 w-3 mr-1" /> Stop
              </Button>
            </div>
            <Progress value={processProgress.total > 0 ? (processProgress.current / processProgress.total) * 100 : 0} className="h-2" />
          </CardContent>
        </Card>
      )}

      {/* Fill Empty Progress Banner */}
      {fillingEmpty && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Loader2 className="h-4 w-4 animate-spin" />
              AI Fill Empty Fields: {fillProgress.current} / {fillProgress.total}
            </div>
            <Progress value={fillProgress.total > 0 ? (fillProgress.current / fillProgress.total) * 100 : 0} className="h-2 mt-2" />
          </CardContent>
        </Card>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {([
          { key: 'ready' as TabKey, icon: CheckCircle2, color: 'text-green-600' },
          { key: 'low_confidence' as TabKey, icon: AlertTriangle, color: 'text-amber-600' },
          { key: 'published' as TabKey, icon: Send, color: 'text-emerald-600' },
          { key: 'rejected' as TabKey, icon: XCircle, color: 'text-red-600' },
        ]).map(c => (
          <Card key={c.key} className={`cursor-pointer transition-colors ${activeTab === c.key ? 'ring-2 ring-primary' : ''}`}
            onClick={() => setActiveTab(c.key)}>
            <CardContent className="p-3 flex items-center gap-2">
              <c.icon className={`h-4 w-4 ${c.color}`} />
              <div>
                <div className="text-lg font-bold">{tabCounts[c.key]}</div>
                <div className="text-[10px] text-muted-foreground">{TAB_LABELS[c.key]}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Controls Bar */}
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => setShowUploader(!showUploader)}>
          <UploadIcon className="h-4 w-4 mr-1" />
          {showUploader ? 'Hide Uploader' : 'Import File'}
        </Button>

        {unprocessedCount > 0 && !processing && (
          <Button variant="outline" size="sm" onClick={handleResumeProcessing}>
            <Play className="h-4 w-4 mr-1" />
            Resume Processing ({unprocessedCount})
          </Button>
        )}

        <AiModelSelector value={aiModel} onValueChange={setAiModel} capability="text" size="sm" triggerClassName="w-[180px] h-8 text-xs" />

        <Button variant="ghost" size="sm" onClick={fetchDrafts} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>

        <div className="relative ml-auto">
          <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search drafts..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="h-8 text-xs pl-7 w-[200px]"
          />
        </div>
      </div>

      {/* Uploader */}
      {showUploader && <IntakeCsvUploader onImportComplete={onImportComplete} />}

      {/* Action Bar */}
      <div className="flex flex-wrap items-center gap-2">
        {activeTab === 'ready' && visibleDrafts.length > 0 && (
          <Button size="sm" onClick={() => handleBulkApprovePublish(visibleDrafts.map(d => d.id))} disabled={bulkActioning}>
            {bulkActioning ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Zap className="h-4 w-4 mr-1" />}
            Approve & Publish All Ready ({tabCounts.ready})
          </Button>
        )}

        {selectedIds.size > 0 && (
          <>
            <Button size="sm" variant="default" onClick={() => handleBulkApprovePublish(Array.from(selectedIds))} disabled={bulkActioning}>
              {bulkActioning ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Send className="h-4 w-4 mr-1" />}
              Approve & Publish Selected ({selectedIds.size})
            </Button>
            <Button size="sm" variant="secondary" onClick={() => handleFillEmpty(Array.from(selectedIds))} disabled={fillingEmpty}>
              {fillingEmpty ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Zap className="h-4 w-4 mr-1" />}
              Fill Empty Fields for Selected ({selectedIds.size})
            </Button>
            <Button size="sm" variant="destructive" onClick={confirmDeleteSelected} disabled={deleting}>
              <Trash2 className="h-4 w-4 mr-1" />
              Delete Selected ({selectedIds.size})
            </Button>
          </>
        )}

        {visibleDrafts.length > 0 && !fillingEmpty && (
          <Button size="sm" variant="outline" onClick={() => handleFillEmpty(visibleDrafts.map(d => d.id))} disabled={fillingEmpty}>
            <Zap className="h-4 w-4 mr-1" />
            Fill Empty Fields for All {TAB_LABELS[activeTab]}
          </Button>
        )}

        {visibleDrafts.length > 0 && (
          <Button size="sm" variant="outline" className="text-destructive border-destructive/30"
            onClick={confirmDeleteAll} disabled={deleting}>
            <Trash2 className="h-4 w-4 mr-1" />
            {deleteAllLabel}
          </Button>
        )}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={v => { setActiveTab(v as TabKey); setSelectedIds(new Set()); }}>
        <TabsList className="w-full">
          {(Object.keys(TAB_LABELS) as TabKey[]).map(k => (
            <TabsTrigger key={k} value={k} className="text-xs flex-1">
              {TAB_LABELS[k]} ({tabCounts[k]})
            </TabsTrigger>
          ))}
        </TabsList>

        {(Object.keys(TAB_LABELS) as TabKey[]).map(tab => (
          <TabsContent key={tab} value={tab}>
            <div className="border rounded-md overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={selectedIds.size === visibleDrafts.length && visibleDrafts.length > 0}
                        onCheckedChange={toggleAll}
                      />
                    </TableHead>
                    <TableHead className="text-xs">Title</TableHead>
                    <TableHead className="text-xs">Target</TableHead>
                    <TableHead className="text-xs">Organisation</TableHead>
                    <TableHead className="text-xs">Date</TableHead>
                    <TableHead className="text-xs">Confidence</TableHead>
                    <TableHead className="text-xs">Tags</TableHead>
                    <TableHead className="text-xs">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow><TableCell colSpan={8} className="text-center py-8"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></TableCell></TableRow>
                  ) : visibleDrafts.length === 0 ? (
                    <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No drafts in this view</TableCell></TableRow>
                  ) : visibleDrafts.map(d => {
                    const title = d.normalized_title || d.raw_title || '(no title)';
                    const tags = Array.isArray(d.secondary_tags) ? d.secondary_tags : [];

                    return (
                      <TableRow key={d.id}>
                        <TableCell>
                          <Checkbox checked={selectedIds.has(d.id)} onCheckedChange={() => toggleSelect(d.id)} />
                        </TableCell>
                        <TableCell className="text-xs max-w-[250px] truncate" title={title}>{title}</TableCell>
                        <TableCell>
                          {d.publish_target && d.publish_target !== 'none'
                            ? <Badge variant="outline" className="text-[10px]">{d.publish_target}</Badge>
                            : '—'}
                        </TableCell>
                        <TableCell className="text-xs max-w-[120px] truncate">{d.organisation_name || '—'}</TableCell>
                        <TableCell className="text-xs">{d.closing_date || '—'}</TableCell>
                        <TableCell className="text-xs">
                          {d.confidence_score != null ? (
                            <Badge variant={d.confidence_score >= 70 ? 'default' : d.confidence_score >= 50 ? 'secondary' : 'destructive'} className="text-[10px]">
                              {d.confidence_score}%
                            </Badge>
                          ) : '—'}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-0.5">
                            {d.enrichment_result === 'enriched' && (
                              <Badge className="text-[9px] px-1 py-0 bg-green-600/15 text-green-700 border-green-600/30 dark:text-green-400">Enriched</Badge>
                            )}
                            {d.enrichment_result === 'not_enriched_tech_error' && (
                              <Badge variant="destructive" className="text-[9px] px-1 py-0">Fill Failed</Badge>
                            )}
                            {d.enrichment_result === 'not_enriched_no_data' && (
                              <Badge className="text-[9px] px-1 py-0 bg-amber-500/15 text-amber-700 border-amber-500/30 dark:text-amber-400">No Data</Badge>
                            )}
                            {d.processing_status === 'publish_failed' && (
                              <Badge variant="destructive" className="text-[9px] px-1 py-0" title={d.publish_error || 'Publish failed'}>
                                Publish Failed
                              </Badge>
                            )}
                            {d.processing_status === 'publish_failed' && d.publish_error && (
                              <span className="text-[9px] text-destructive max-w-[120px] truncate" title={d.publish_error}>
                                {d.publish_error.slice(0, 40)}
                              </span>
                            )}
                            {tags.includes('published_duplicate_risk') && (
                              <Badge className="text-[9px] px-1 py-0 bg-amber-500/20 text-amber-700 border-amber-500/30 dark:text-amber-400">
                                Possible Published Duplicate
                              </Badge>
                            )}
                            {tags.slice(0, 3).map((t: string) => (
                              <Badge key={t} variant="outline" className="text-[9px] px-1 py-0">{t}</Badge>
                            ))}
                            {tags.length > 3 && <Badge variant="outline" className="text-[9px] px-1 py-0">+{tags.length - 3}</Badge>}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setPreviewDraftId(d.id)} title="Preview">
                              <Eye className="h-3 w-3" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setSelectedDraft(d)} title="Edit">
                              <Search className="h-3 w-3" />
                            </Button>
                            {d.processing_status !== 'published' && (
                              <Button variant="ghost" size="icon" className="h-6 w-6"
                                onClick={() => handleApproveAndPublish(d.id)} title="Approve & Publish">
                                <Send className="h-3 w-3 text-green-600" />
                              </Button>
                            )}
                            {d.primary_status !== 'reject' && d.processing_status !== 'published' && (
                              <Button variant="ghost" size="icon" className="h-6 w-6"
                                onClick={() => handleReject(d.id)} title="Reject">
                                <XCircle className="h-3 w-3 text-red-600" />
                              </Button>
                            )}
                            <Button variant="ghost" size="icon" className="h-6 w-6"
                              onClick={() => setSingleDeleteId(d.id)} title="Delete Permanently">
                              <Trash2 className="h-3 w-3 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        ))}
      </Tabs>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive">Permanently Delete Drafts</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm">
              This will permanently delete <strong>{deleteCount}</strong> {deleteScopeLabel}.
            </p>
            {activeTab === 'published' && deleteScope === 'all' && (
              <p className="text-xs text-muted-foreground">
                Note: This deletes draft records only. Already published live content will NOT be affected.
              </p>
            )}
            <p className="text-sm">Type <strong>DELETE</strong> to confirm:</p>
            <Input
              value={deleteConfirmText}
              onChange={e => setDeleteConfirmText(e.target.value)}
              placeholder="Type DELETE"
              className="font-mono"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmOpen(false)}>Cancel</Button>
            <Button variant="destructive" disabled={deleteConfirmText !== 'DELETE' || deleting} onClick={executeDelete}>
              {deleting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Trash2 className="h-4 w-4 mr-1" />}
              Delete Permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Single Delete Confirmation */}
      <AlertDialog open={!!singleDeleteId} onOpenChange={(open) => { if (!open) setSingleDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Permanently delete this draft?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The draft will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { if (singleDeleteId) { handleDeleteIds([singleDeleteId]); setSingleDeleteId(null); } }}
            >
              Delete Permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Detail Dialog */}
      {selectedDraft && (
        <IntakeDraftDetailDialog
          draft={selectedDraft}
          onClose={() => { setSelectedDraft(null); fetchDrafts(); }}
          onSave={async (updates) => {
            await supabase.from('intake_drafts').update(updates as any).eq('id', selectedDraft.id);
            setSelectedDraft(null);
            fetchDrafts();
          }}
          onApprovePublish={async () => {
            await handleApproveAndPublish(selectedDraft.id);
            setSelectedDraft(null);
          }}
          onDelete={async () => {
            setSingleDeleteId(selectedDraft.id);
          }}
        />
      )}

      {/* Preview Dialog */}
      <IntakeDraftPreviewDialog
        draftId={previewDraftId}
        open={!!previewDraftId}
        onClose={() => setPreviewDraftId(null)}
      />
    </div>
  );
}
