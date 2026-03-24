/**
 * Admin UI for managing Firecrawl draft jobs (Source 3 Phase 5 + hardening).
 * Lists draft jobs with row-level AI actions, dedup flags, review controls,
 * publish gating, missing-fields indicators, bulk Run All, and labeled AI step badges.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { toast } from '@/hooks/use-toast';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  RefreshCw, Loader2, MoreHorizontal, Sparkles, Wrench, Link2,
  Search, Image, FileText, Zap, CheckCircle, XCircle,
  AlertTriangle, ExternalLink, Copy, ShieldCheck, ShieldAlert, Eye,
  ThumbsUp, Undo2, CircleDot, Circle, Ban, X,
} from 'lucide-react';
import { FirecrawlSourcesManager } from './FirecrawlSourcesManager';
import { AiModelSelector, getLastUsedModel } from '@/components/admin/AiModelSelector';
import { SEO_FIX_MODEL_VALUES } from '@/lib/aiModels';

interface DraftJob {
  id: string;
  title: string | null;
  organization_name: string | null;
  post_name: string | null;
  state: string | null;
  extraction_confidence: string;
  status: string;
  fields_extracted: number;
  fields_missing: string[];
  ai_clean_at: string | null;
  ai_enrich_at: string | null;
  ai_links_at: string | null;
  ai_fix_missing_at: string | null;
  ai_seo_at: string | null;
  ai_cover_prompt_at: string | null;
  ai_cover_image_at: string | null;
  ai_enrichment_log: any[] | null;
  seo_title: string | null;
  cover_image_url: string | null;
  official_notification_url: string | null;
  official_link_confidence: string | null;
  source_name: string | null;
  source_bucket: string | null;
  dedup_status: string;
  dedup_reason: string | null;
  dedup_match_ids: string[];
  created_at: string;
  updated_at: string;
}

type AiAction = 'ai-clean' | 'ai-enrich' | 'ai-find-links' | 'ai-fix-missing' | 'ai-seo' | 'ai-cover-prompt' | 'ai-cover-image' | 'ai-run-all' | 'ai-fix-fields' | 'rollback-ai-action';

const AI_ACTIONS: { action: AiAction; label: string; icon: typeof Sparkles; description: string }[] = [
  { action: 'ai-clean', label: 'AI Clean', icon: Wrench, description: 'Remove source branding & polish' },
  { action: 'ai-enrich', label: 'AI Enrich', icon: Sparkles, description: 'Improve structured fields' },
  { action: 'ai-find-links', label: 'Find Links', icon: Link2, description: 'Find official govt URLs' },
  { action: 'ai-fix-missing', label: 'Fix Missing', icon: AlertTriangle, description: 'Fill weak/blank fields' },
  { action: 'ai-seo', label: 'AI SEO', icon: Search, description: 'Generate SEO metadata & FAQs' },
  { action: 'ai-cover-prompt', label: 'Cover Prompt', icon: FileText, description: 'Generate image prompt' },
];

// Step-to-field mapping for AI step indicators (image steps removed — handled separately)
const AI_STEP_MAP: { action: string; label: string; tsField: keyof DraftJob }[] = [
  { action: 'ai-clean', label: 'Clean', tsField: 'ai_clean_at' },
  { action: 'ai-enrich', label: 'Enrich', tsField: 'ai_enrich_at' },
  { action: 'ai-find-links', label: 'Links', tsField: 'ai_links_at' },
  { action: 'ai-fix-missing', label: 'Fix', tsField: 'ai_fix_missing_at' },
  { action: 'ai-seo', label: 'SEO', tsField: 'ai_seo_at' },
  { action: 'ai-cover-prompt', label: 'Prompt', tsField: 'ai_cover_prompt_at' },
];

type StepState = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

function getStepState(
  draft: DraftJob,
  stepAction: string,
  tsField: keyof DraftJob,
  busyAction: string | undefined,
): { state: StepState; tooltip: string } {
  // Running check
  if (busyAction === stepAction || busyAction === 'ai-run-all') {
    // If ai-run-all, we can't tell which sub-step, so show running for incomplete steps
    if (busyAction === 'ai-run-all' && draft[tsField]) {
      return { state: 'completed', tooltip: `Completed: ${draft[tsField]}` };
    }
    if (busyAction === stepAction || (busyAction === 'ai-run-all' && !draft[tsField])) {
      return { state: 'running', tooltip: 'Running...' };
    }
  }

  // Completed: timestamp exists
  if (draft[tsField]) {
    return { state: 'completed', tooltip: `Done: ${new Date(draft[tsField] as string).toLocaleString()}` };
  }

  // Check enrichment log for failure/skip info
  const log = draft.ai_enrichment_log;
  if (log && Array.isArray(log)) {
    // Find last entry for this action
    for (let i = log.length - 1; i >= 0; i--) {
      const entry = log[i] as any;
      if (entry?.action === stepAction) {
        if (entry.status === 'failed') {
          return { state: 'failed', tooltip: `Failed: ${entry.error || 'Unknown error'}` };
        }
        if (entry.status === 'skipped') {
          return { state: 'skipped', tooltip: `Skipped: ${entry.reason || 'Status guard or protection'}` };
        }
        // Legacy entry without status field but also no timestamp = treat as pending (rollback case)
        break;
      }
    }
  }

  return { state: 'pending', tooltip: 'Not yet run' };
}

const STEP_BADGE_STYLES: Record<StepState, string> = {
  pending: 'bg-muted text-muted-foreground border-border',
  running: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200 border-blue-300',
  completed: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200 border-green-300',
  failed: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200 border-red-300',
  skipped: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-200 border-yellow-300',
};

const STEP_ICONS: Record<StepState, typeof Circle> = {
  pending: Circle,
  running: Loader2,
  completed: CheckCircle,
  failed: XCircle,
  skipped: Ban,
};

type FilterTab = 'all' | 'draft' | 'reviewed' | 'approved' | 'duplicate' | 'rejected';

interface BulkProgress {
  total: number;
  current: number;
  currentTitle: string;
  succeeded: number;
  failed: number;
  skipped: number;
}

interface BulkResult {
  id: string;
  title: string;
  success: boolean;
  error?: string;
}

export function FirecrawlDraftsManager() {
  const [drafts, setDrafts] = useState<DraftJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyRows, setBusyRows] = useState<Record<string, string>>({});
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');
  const [dedupRunning, setDedupRunning] = useState(false);
  const [selectedModel, setSelectedModel] = useState(() =>
    getLastUsedModel('text', 'gemini-flash', [...SEO_FIX_MODEL_VALUES]),
  );
  const [selectedImageModel, setSelectedImageModel] = useState(() =>
    getLastUsedModel('image', 'gemini-flash-image-2'),
  );

  // Bulk run state
  const [bulkRunning, setBulkRunning] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<BulkProgress | null>(null);
  const [bulkResults, setBulkResults] = useState<BulkResult[] | null>(null);
  const bulkCancelRef = useRef(false);

  // Bulk image state
  const [bulkImageRunning, setBulkImageRunning] = useState(false);
  const [bulkImageProgress, setBulkImageProgress] = useState<BulkProgress | null>(null);
  const bulkImageCancelRef = useRef(false);

  const fetchDrafts = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('firecrawl_draft_jobs')
      .select('id, title, organization_name, post_name, state, extraction_confidence, status, fields_extracted, fields_missing, ai_clean_at, ai_enrich_at, ai_links_at, ai_fix_missing_at, ai_seo_at, ai_cover_prompt_at, ai_cover_image_at, ai_enrichment_log, seo_title, cover_image_url, official_notification_url, official_link_confidence, source_name, source_bucket, dedup_status, dedup_reason, dedup_match_ids, created_at, updated_at')
      .order('created_at', { ascending: false })
      .limit(100);

    if (activeFilter === 'draft') query = query.eq('status', 'draft');
    else if (activeFilter === 'reviewed') query = query.eq('status', 'reviewed');
    else if (activeFilter === 'approved') query = query.eq('status', 'approved');
    else if (activeFilter === 'duplicate') query = query.eq('dedup_status', 'duplicate');
    else if (activeFilter === 'rejected') query = query.eq('status', 'rejected');

    const { data, error } = await query;
    if (error) {
      toast({ title: 'Error loading drafts', description: error.message, variant: 'destructive' });
    } else {
      setDrafts((data as unknown as DraftJob[]) || []);
    }
    setLoading(false);
  }, [activeFilter]);

  useEffect(() => { fetchDrafts(); }, [fetchDrafts]);

  const runAiAction = async (draftId: string, action: AiAction) => {
    setBusyRows(prev => ({ ...prev, [draftId]: action }));
    try {
      const { data, error } = await supabase.functions.invoke('firecrawl-ai-enrich', {
        body: { action, draft_id: draftId, aiModel: selectedModel, imageModel: selectedImageModel },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      toast({
        title: `${action} complete`,
        description: action === 'ai-run-all'
          ? `${data.succeeded}/${data.total} steps succeeded`
          : data.message || 'Done',
      });
      await fetchDrafts();
    } catch (e: any) {
      toast({ title: `${action} failed`, description: e.message, variant: 'destructive' });
    } finally {
      setBusyRows(prev => { const n = { ...prev }; delete n[draftId]; return n; });
    }
  };

  // ── Bulk Run All ──
  const getEligibleDrafts = useCallback(() => {
    return drafts.filter(d =>
      d.status === 'draft' &&
      d.dedup_status !== 'duplicate' &&
      !busyRows[d.id]
    );
  }, [drafts, busyRows]);

  const runBulkAll = async () => {
    const eligible = getEligibleDrafts();
    if (eligible.length === 0) {
      toast({ title: 'No eligible rows', description: 'No draft rows available for bulk processing.' });
      return;
    }

    const confirmed = window.confirm(
      `Run all AI steps on ${eligible.length} eligible draft row(s)?\n\nThis processes rows sequentially and may take several minutes.`
    );
    if (!confirmed) return;

    bulkCancelRef.current = false;
    setBulkRunning(true);
    setBulkResults(null);
    const results: BulkResult[] = [];
    const progress: BulkProgress = {
      total: eligible.length, current: 0, currentTitle: '',
      succeeded: 0, failed: 0, skipped: 0,
    };
    setBulkProgress({ ...progress });

    for (let i = 0; i < eligible.length; i++) {
      if (bulkCancelRef.current) {
        // Mark remaining as skipped
        for (let j = i; j < eligible.length; j++) {
          results.push({ id: eligible[j].id, title: eligible[j].title || 'Untitled', success: false, error: 'Cancelled' });
          progress.skipped++;
        }
        break;
      }

      const draft = eligible[i];
      progress.current = i + 1;
      progress.currentTitle = draft.title || 'Untitled';
      setBulkProgress({ ...progress });

      // Set busy state for this row
      setBusyRows(prev => ({ ...prev, [draft.id]: 'ai-run-all' }));

      try {
        const { data, error } = await supabase.functions.invoke('firecrawl-ai-enrich', {
          body: { action: 'ai-run-all', draft_id: draft.id, aiModel: selectedModel },
        });
        if (error) throw new Error(error.message);
        if (data?.error) throw new Error(data.error);

        results.push({ id: draft.id, title: draft.title || 'Untitled', success: true });
        progress.succeeded++;
      } catch (e: any) {
        results.push({ id: draft.id, title: draft.title || 'Untitled', success: false, error: e.message });
        progress.failed++;
      } finally {
        setBusyRows(prev => { const n = { ...prev }; delete n[draft.id]; return n; });
      }

      setBulkProgress({ ...progress });
    }

    setBulkResults(results);
    setBulkRunning(false);
    setBulkProgress(null);
    await fetchDrafts();

    toast({
      title: 'Bulk Run All complete',
      description: `✅ ${progress.succeeded} succeeded · ❌ ${progress.failed} failed · ⏭ ${progress.skipped} skipped`,
    });
  };

  const runDedup = async () => {
    setDedupRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke('firecrawl-ingest', {
        body: { action: 'dedup-drafts' },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      toast({
        title: 'Dedup complete',
        description: `Checked: ${data.checked || 0}, Duplicates: ${data.duplicatesFound || 0}, Cross-source candidates: ${data.crossSourceCandidates || 0}`,
      });
      await fetchDrafts();
    } catch (e: any) {
      toast({ title: 'Dedup failed', description: e.message, variant: 'destructive' });
    } finally {
      setDedupRunning(false);
    }
  };

  // ── Per-row Create Image ──
  const hasExistingImage = (draft: DraftJob): boolean => {
    return !!(draft.cover_image_url && draft.cover_image_url.trim().length > 0);
  };

  const createImage = async (draftId: string) => {
    const draft = drafts.find(d => d.id === draftId);
    if (!draft) return;
    if (hasExistingImage(draft)) {
      toast({ title: 'Image exists', description: 'This row already has a cover image. Skipping.' });
      return;
    }
    setBusyRows(prev => ({ ...prev, [draftId]: 'ai-cover-image' }));
    try {
      // First generate prompt, then generate image
      const { data: promptData, error: promptErr } = await supabase.functions.invoke('firecrawl-ai-enrich', {
        body: { action: 'ai-cover-prompt', draft_id: draftId, aiModel: selectedModel },
      });
      if (promptErr) throw new Error(promptErr.message);
      if (promptData?.error) throw new Error(promptData.error);

      const { data, error } = await supabase.functions.invoke('firecrawl-ai-enrich', {
        body: { action: 'ai-cover-image', draft_id: draftId, imageModel: selectedImageModel },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      toast({ title: 'Cover image created', description: data.model_used || 'Done' });
      await fetchDrafts();
    } catch (e: any) {
      toast({ title: 'Image generation failed', description: e.message, variant: 'destructive' });
    } finally {
      setBusyRows(prev => { const n = { ...prev }; delete n[draftId]; return n; });
    }
  };

  // ── Bulk Create Images ──
  const getDraftsNeedingImages = useCallback(() => {
    return drafts.filter(d =>
      d.status === 'draft' &&
      d.dedup_status !== 'duplicate' &&
      !hasExistingImage(d) &&
      !busyRows[d.id]
    );
  }, [drafts, busyRows]);

  const runBulkImages = async () => {
    const eligible = getDraftsNeedingImages();
    if (eligible.length === 0) {
      toast({ title: 'No rows need images', description: 'All eligible rows already have cover images.' });
      return;
    }
    const confirmed = window.confirm(
      `Generate cover images for ${eligible.length} row(s) without images?\n\nThis processes rows sequentially and may take several minutes.`
    );
    if (!confirmed) return;

    bulkImageCancelRef.current = false;
    setBulkImageRunning(true);
    const progress: BulkProgress = {
      total: eligible.length, current: 0, currentTitle: '',
      succeeded: 0, failed: 0, skipped: 0,
    };
    setBulkImageProgress({ ...progress });

    for (let i = 0; i < eligible.length; i++) {
      if (bulkImageCancelRef.current) {
        progress.skipped += eligible.length - i;
        break;
      }
      const draft = eligible[i];
      progress.current = i + 1;
      progress.currentTitle = draft.title || 'Untitled';
      setBulkImageProgress({ ...progress });

      // Re-check image existence from DB to avoid race conditions
      const { data: freshDraft } = await supabase
        .from('firecrawl_draft_jobs')
        .select('cover_image_url')
        .eq('id', draft.id)
        .single();
      if (freshDraft?.cover_image_url && freshDraft.cover_image_url.trim().length > 0) {
        progress.skipped++;
        setBulkImageProgress({ ...progress });
        continue;
      }

      setBusyRows(prev => ({ ...prev, [draft.id]: 'ai-cover-image' }));
      try {
        // Generate prompt first
        await supabase.functions.invoke('firecrawl-ai-enrich', {
          body: { action: 'ai-cover-prompt', draft_id: draft.id, aiModel: selectedModel },
        });
        // Generate image
        const { data, error } = await supabase.functions.invoke('firecrawl-ai-enrich', {
          body: { action: 'ai-cover-image', draft_id: draft.id, imageModel: selectedImageModel },
        });
        if (error) throw new Error(error.message);
        if (data?.error) throw new Error(data.error);
        progress.succeeded++;
      } catch {
        progress.failed++;
      } finally {
        setBusyRows(prev => { const n = { ...prev }; delete n[draft.id]; return n; });
      }
      setBulkImageProgress({ ...progress });
    }

    setBulkImageRunning(false);
    setBulkImageProgress(null);
    await fetchDrafts();
    toast({
      title: 'Bulk Image Generation complete',
      description: `✅ ${progress.succeeded} created · ❌ ${progress.failed} failed · ⏭ ${progress.skipped} skipped`,
    });
  };

  const imageEligibleCount = getDraftsNeedingImages().length;

  const updateStatus = async (draftId: string, newStatus: string) => {
    if (newStatus === 'approved') {
      try {
        const { data, error } = await supabase.functions.invoke('firecrawl-ingest', {
          body: { action: 'validate-for-approval', draft_id: draftId },
        });
        if (error) throw new Error(error.message);
        if (data?.error) throw new Error(data.error);

        if (!data.can_approve) {
          toast({
            title: 'Cannot approve',
            description: `Blocking issues: ${data.errors?.join('; ') || 'Unknown'}`,
            variant: 'destructive',
          });
          if (data.warnings?.length > 0) {
            toast({ title: 'Warnings', description: data.warnings.join('; ') });
          }
          return;
        }

        if (data.warnings?.length > 0) {
          toast({ title: 'Approved with warnings', description: data.warnings.join('; ') });
        }
      } catch (e: any) {
        toast({ title: 'Validation error', description: e.message, variant: 'destructive' });
        return;
      }
    }

    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase
      .from('firecrawl_draft_jobs')
      .update({
        status: newStatus,
        reviewed_at: new Date().toISOString(),
        reviewed_by: user?.id || null,
      } as any)
      .eq('id', draftId);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: `Status → ${newStatus}` });
      await fetchDrafts();
    }
  };

  const confidenceBadge = (conf: string) => {
    const map: Record<string, string> = {
      high: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
      low: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
      none: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    };
    return <Badge className={`text-[10px] ${map[conf] || ''}`}>{conf}</Badge>;
  };

  const dedupBadge = (status: string) => {
    switch (status) {
      case 'clean': return <Badge variant="outline" className="text-[9px] gap-0.5"><ShieldCheck className="h-2.5 w-2.5" />Clean</Badge>;
      case 'duplicate': return <Badge variant="destructive" className="text-[9px] gap-0.5"><Copy className="h-2.5 w-2.5" />Dup</Badge>;
      default: return <Badge variant="secondary" className="text-[9px]">—</Badge>;
    }
  };

  const filterTabs: { key: FilterTab; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'draft', label: 'Draft' },
    { key: 'reviewed', label: 'Reviewed' },
    { key: 'approved', label: 'Approved' },
    { key: 'duplicate', label: 'Duplicates' },
    { key: 'rejected', label: 'Rejected' },
  ];

  const eligibleCount = getEligibleDrafts().length;

  return (
    <div className="space-y-4">
      <FirecrawlSourcesManager />

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              Firecrawl Draft Jobs
            </CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-muted-foreground font-medium">Text:</span>
                <AiModelSelector
                  value={selectedModel}
                  onValueChange={setSelectedModel}
                  capability="text"
                  size="sm"
                  allowedValues={[...SEO_FIX_MODEL_VALUES]}
                />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-muted-foreground font-medium">Image:</span>
                <AiModelSelector
                  value={selectedImageModel}
                  onValueChange={setSelectedImageModel}
                  capability="image"
                  size="sm"
                />
              </div>
              {bulkRunning ? (
                <Button
                  variant="destructive" size="sm"
                  onClick={() => { bulkCancelRef.current = true; }}
                  title="Stop bulk Run All processing"
                >
                  <X className="h-3.5 w-3.5 mr-1.5" />
                  Stop Run All
                </Button>
              ) : (
                <Button
                  variant="default" size="sm"
                  onClick={runBulkAll}
                  disabled={eligibleCount === 0 || loading}
                  title={`Run all AI steps on ${eligibleCount} eligible draft rows`}
                >
                  <Zap className="h-3.5 w-3.5 mr-1.5" />
                  Bulk Run All{eligibleCount > 0 ? ` (${eligibleCount})` : ''}
                </Button>
              )}
              {bulkImageRunning ? (
                <Button
                  variant="destructive" size="sm"
                  onClick={() => { bulkImageCancelRef.current = true; }}
                  title="Stop bulk image generation"
                >
                  <X className="h-3.5 w-3.5 mr-1.5" />
                  Stop Images
                </Button>
              ) : (
                <Button
                  variant="outline" size="sm"
                  onClick={runBulkImages}
                  disabled={imageEligibleCount === 0 || loading}
                  title={`Generate cover images for ${imageEligibleCount} rows without images`}
                >
                  <Image className="h-3.5 w-3.5 mr-1.5" />
                  Bulk Images{imageEligibleCount > 0 ? ` (${imageEligibleCount})` : ''}
                </Button>
              )}
              <Button
                variant="outline" size="sm"
                onClick={runDedup} disabled={dedupRunning}
              >
                {dedupRunning ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <ShieldAlert className="h-3.5 w-3.5 mr-1.5" />}
                Dedup
              </Button>
              <Button variant="outline" size="sm" onClick={fetchDrafts} disabled={loading}>
                <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filter tabs */}
          <div className="flex gap-1 mb-3">
            {filterTabs.map(tab => (
              <Button
                key={tab.key}
                variant={activeFilter === tab.key ? 'default' : 'ghost'}
                size="sm"
                className="text-xs h-7"
                onClick={() => setActiveFilter(tab.key)}
              >
                {tab.label}
              </Button>
            ))}
          </div>

          {/* Bulk progress bar */}
          {bulkRunning && bulkProgress && (
            <div className="mb-3 p-3 rounded-lg border bg-muted/50 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">
                  Processing {bulkProgress.current}/{bulkProgress.total} — <span className="text-muted-foreground">{bulkProgress.currentTitle}</span>
                </span>
                <Button
                  size="sm" variant="ghost"
                  className="h-6 text-xs text-destructive hover:text-destructive"
                  onClick={() => { bulkCancelRef.current = true; }}
                >
                  <X className="h-3 w-3 mr-1" /> Cancel
                </Button>
              </div>
              <Progress value={(bulkProgress.current / bulkProgress.total) * 100} className="h-2" />
              <div className="flex gap-3 text-xs text-muted-foreground">
                <span className="text-green-600">✅ {bulkProgress.succeeded}</span>
                <span className="text-red-600">❌ {bulkProgress.failed}</span>
                <span>⏭ {bulkProgress.skipped}</span>
              </div>
            </div>
          )}

          {/* Bulk image progress bar */}
          {bulkImageRunning && bulkImageProgress && (
            <div className="mb-3 p-3 rounded-lg border bg-muted/50 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">
                  🖼️ Creating images {bulkImageProgress.current}/{bulkImageProgress.total} — <span className="text-muted-foreground">{bulkImageProgress.currentTitle}</span>
                </span>
                <Button
                  size="sm" variant="ghost"
                  className="h-6 text-xs text-destructive hover:text-destructive"
                  onClick={() => { bulkImageCancelRef.current = true; }}
                >
                  <X className="h-3 w-3 mr-1" /> Cancel
                </Button>
              </div>
              <Progress value={(bulkImageProgress.current / bulkImageProgress.total) * 100} className="h-2" />
              <div className="flex gap-3 text-xs text-muted-foreground">
                <span className="text-green-600">✅ {bulkImageProgress.succeeded}</span>
                <span className="text-red-600">❌ {bulkImageProgress.failed}</span>
                <span>⏭ {bulkImageProgress.skipped}</span>
              </div>
            </div>
          )}

          {/* Bulk results summary */}
          {bulkResults && !bulkRunning && (
            <div className="mb-3 p-3 rounded-lg border bg-muted/30 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Bulk Run Complete</p>
                <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => setBulkResults(null)}>
                  Dismiss
                </Button>
              </div>
              <div className="flex gap-3 text-xs">
                <span className="text-green-600">✅ {bulkResults.filter(r => r.success).length} succeeded</span>
                <span className="text-red-600">❌ {bulkResults.filter(r => !r.success && r.error !== 'Cancelled').length} failed</span>
                <span>⏭ {bulkResults.filter(r => r.error === 'Cancelled').length} cancelled</span>
              </div>
              {bulkResults.filter(r => !r.success && r.error !== 'Cancelled').length > 0 && (
                <div className="text-xs space-y-0.5 mt-1">
                  <p className="font-medium text-destructive">Failed rows:</p>
                  {bulkResults.filter(r => !r.success && r.error !== 'Cancelled').map(r => (
                    <p key={r.id} className="text-muted-foreground">• {r.title}: {r.error}</p>
                  ))}
                </div>
              )}
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : drafts.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground text-sm">
              No draft jobs found for this filter.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[200px]">Title / Org</TableHead>
                    <TableHead>State</TableHead>
                    <TableHead>Ready</TableHead>
                    <TableHead>Confidence</TableHead>
                    <TableHead>Dedup</TableHead>
                    <TableHead>Fields</TableHead>
                    <TableHead className="text-center min-w-[280px]">AI Steps</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {drafts.map(draft => {
                    const missingCount = draft.fields_missing?.length || 0;
                    const blockers: string[] = [];
                    const warnings: string[] = [];
                    if (!draft.title || draft.title.length < 10) blockers.push('Title missing/short');
                    if (!draft.organization_name) blockers.push('No organization');
                    if (draft.dedup_status === 'duplicate') blockers.push('Duplicate');
                    if (draft.extraction_confidence === 'none') blockers.push('No confidence');
                    if (!draft.official_notification_url && !draft.seo_title) warnings.push('No official links');
                    if (!draft.seo_title) warnings.push('No SEO');
                    if (!draft.cover_image_url) warnings.push('No cover');
                    if (draft.extraction_confidence === 'low') warnings.push('Low confidence');
                    const readiness = blockers.length > 0 ? 'red' : warnings.length > 0 ? 'yellow' : 'green';
                    const readinessTooltip = blockers.length > 0
                      ? `Blockers: ${blockers.join(', ')}`
                      : warnings.length > 0
                        ? `Warnings: ${warnings.join(', ')}`
                        : 'Ready for review';

                    return (
                      <TableRow key={draft.id} className={busyRows[draft.id] ? 'opacity-70' : ''}>
                        <TableCell>
                          <div className="space-y-0.5">
                            <p className="font-medium text-sm line-clamp-1">{draft.title || 'Untitled'}</p>
                            <p className="text-xs text-muted-foreground line-clamp-1">{draft.organization_name || draft.post_name || '—'}</p>
                            <div className="flex items-center gap-1">
                              <span className="text-[10px] text-muted-foreground">{draft.source_name}</span>
                              {draft.source_bucket && (
                                <Badge variant="outline" className="text-[9px]">{draft.source_bucket}</Badge>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs">{draft.state || '—'}</TableCell>
                        <TableCell>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger>
                                <CircleDot className={`h-4 w-4 ${
                                  readiness === 'green' ? 'text-green-500' :
                                  readiness === 'yellow' ? 'text-yellow-500' : 'text-red-500'
                                }`} />
                              </TooltipTrigger>
                              <TooltipContent side="right" className="max-w-[250px]">
                                <p className="text-xs">{readinessTooltip}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </TableCell>
                        <TableCell>{confidenceBadge(draft.extraction_confidence)}</TableCell>
                        <TableCell>
                          <div className="space-y-0.5">
                            {dedupBadge(draft.dedup_status)}
                            {draft.dedup_reason && (
                              <p className="text-[9px] text-muted-foreground line-clamp-1" title={draft.dedup_reason}>
                                {draft.dedup_reason}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {draft.fields_extracted}
                            {missingCount > 0 && (
                              <span className="text-[10px] text-orange-500 ml-1" title={`Missing: ${draft.fields_missing?.join(', ')}`}>
                                ({missingCount} missing)
                              </span>
                            )}
                          </div>
                        </TableCell>
                        {/* AI Step Badges */}
                        <TableCell>
                          <div className="flex flex-wrap gap-1 justify-center">
                            <TooltipProvider>
                              {AI_STEP_MAP.map(({ action, label, tsField }) => {
                                const { state, tooltip } = getStepState(draft, action, tsField, busyRows[draft.id]);
                                const Icon = STEP_ICONS[state];
                                return (
                                  <Tooltip key={action}>
                                    <TooltipTrigger>
                                      <span className={`inline-flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[9px] font-medium ${STEP_BADGE_STYLES[state]}`}>
                                        <Icon className={`h-2.5 w-2.5 ${state === 'running' ? 'animate-spin' : ''}`} />
                                        {label}
                                      </span>
                                    </TooltipTrigger>
                                    <TooltipContent side="top" className="max-w-[250px]">
                                      <p className="text-xs">{tooltip}</p>
                                    </TooltipContent>
                                  </Tooltip>
                                );
                              })}
                            </TooltipProvider>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={
                            draft.status === 'approved' ? 'default' :
                            draft.status === 'reviewed' ? 'secondary' :
                            draft.status === 'rejected' ? 'destructive' : 'outline'
                          } className="text-[10px]">
                            {draft.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center gap-1 justify-end">
                            <Button
                              size="sm" variant="outline"
                              disabled={!!busyRows[draft.id] || hasExistingImage(draft)}
                              onClick={() => createImage(draft.id)}
                              title={hasExistingImage(draft) ? 'Image already exists' : 'Generate cover image'}
                              className="gap-1"
                            >
                              {busyRows[draft.id] === 'ai-cover-image' ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : hasExistingImage(draft) ? (
                                <CheckCircle className="h-3 w-3 text-green-500" />
                              ) : (
                                <Image className="h-3 w-3" />
                              )}
                              <span className="hidden sm:inline text-xs">
                                {hasExistingImage(draft) ? 'Has Image' : 'Image'}
                              </span>
                            </Button>
                            <Button
                              size="sm" variant="default"
                              disabled={!!busyRows[draft.id]}
                              onClick={() => runAiAction(draft.id, 'ai-run-all')}
                              title="Run All AI Steps (text only)"
                              className="gap-1"
                            >
                              {busyRows[draft.id] === 'ai-run-all' ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Zap className="h-3 w-3" />
                              )}
                              <span className="hidden sm:inline text-xs">Run All</span>
                            </Button>

                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button size="sm" variant="ghost" disabled={!!busyRows[draft.id]}>
                                  {busyRows[draft.id] && busyRows[draft.id] !== 'ai-run-all' ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <MoreHorizontal className="h-3 w-3" />
                                  )}
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-52">
                                <DropdownMenuItem onClick={() => updateStatus(draft.id, 'reviewed')}>
                                  <Eye className="h-3.5 w-3.5 mr-2" /> Mark Reviewed
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => updateStatus(draft.id, 'approved')}>
                                  <ThumbsUp className="h-3.5 w-3.5 mr-2" /> Approve
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => updateStatus(draft.id, 'rejected')} className="text-destructive">
                                  <XCircle className="h-3.5 w-3.5 mr-2" /> Reject
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />

                                {AI_ACTIONS.map(({ action, label, icon: Icon, description }) => (
                                  <DropdownMenuItem
                                    key={action}
                                    onClick={() => runAiAction(draft.id, action)}
                                    disabled={!!busyRows[draft.id]}
                                    className="flex items-start gap-2"
                                  >
                                    <Icon className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                                    <div>
                                      <p className="text-sm font-medium">{label}</p>
                                      <p className="text-[10px] text-muted-foreground">{description}</p>
                                    </div>
                                  </DropdownMenuItem>
                                ))}
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => runAiAction(draft.id, 'rollback-ai-action')}
                                  disabled={!!busyRows[draft.id]}
                                >
                                  <Undo2 className="h-3.5 w-3.5 mr-2" /> Undo Last AI
                                </DropdownMenuItem>
                                {draft.official_notification_url && (
                                  <DropdownMenuItem asChild>
                                    <a href={draft.official_notification_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">
                                      <ExternalLink className="h-3.5 w-3.5" />
                                      <span className="text-sm">Official Link</span>
                                      {draft.official_link_confidence && (
                                        <Badge variant="outline" className="text-[9px] ml-auto">
                                          {draft.official_link_confidence}
                                        </Badge>
                                      )}
                                    </a>
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
