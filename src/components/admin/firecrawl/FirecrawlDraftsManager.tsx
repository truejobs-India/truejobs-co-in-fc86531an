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
  ThumbsUp, Undo2, CircleDot, Circle, Ban, X, Trash2, Send,
} from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { FirecrawlSourcesManager } from './FirecrawlSourcesManager';
import { FirecrawlDraftPreviewDialog } from './FirecrawlDraftPreviewDialog';
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
  // Preview/Publish fields
  location: string | null;
  salary: string | null;
  qualification: string | null;
  age_limit: string | null;
  application_mode: string | null;
  last_date_of_application: string | null;
  total_vacancies: number | null;
  description_summary: string | null;
  intro_text: string | null;
  meta_description: string | null;
  official_apply_url: string | null;
  slug_suggestion: string | null;
  faq_suggestions: any | null;
  category: string | null;
  department: string | null;
  pay_scale: string | null;
  selection_process: string | null;
  closing_date: string | null;
  opening_date: string | null;
  exam_date: string | null;
  job_role: string | null;
  city: string | null;
  normalized_title: string | null;
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

type FilterTab = 'all' | 'draft' | 'enriched' | 'reviewed' | 'approved' | 'promoted' | 'duplicate' | 'rejected';

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
  const [purging, setPurging] = useState(false);
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

  // Bulk fix fields state
  const [bulkFixFieldsRunning, setBulkFixFieldsRunning] = useState(false);
  const [bulkFixFieldsProgress, setBulkFixFieldsProgress] = useState<BulkProgress | null>(null);
  const bulkFixFieldsCancelRef = useRef(false);

  // Image preview state
  const [previewImage, setPreviewImage] = useState<{ url: string; title: string } | null>(null);

  // Draft preview & publish state
  const [previewDraft, setPreviewDraft] = useState<DraftJob | null>(null);
  const [publishValidation, setPublishValidation] = useState<{ draft: DraftJob; errors: string[]; warnings: string[] } | null>(null);
  const [publishing, setPublishing] = useState(false);

  const fetchDrafts = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('firecrawl_draft_jobs')
      .select('id, title, organization_name, post_name, state, extraction_confidence, status, fields_extracted, fields_missing, ai_clean_at, ai_enrich_at, ai_links_at, ai_fix_missing_at, ai_seo_at, ai_cover_prompt_at, ai_cover_image_at, ai_enrichment_log, seo_title, cover_image_url, official_notification_url, official_link_confidence, source_name, source_bucket, dedup_status, dedup_reason, dedup_match_ids, created_at, updated_at, location, salary, qualification, age_limit, application_mode, last_date_of_application, total_vacancies, description_summary, intro_text, meta_description, official_apply_url, slug_suggestion, faq_suggestions, category, department, pay_scale, selection_process, closing_date, opening_date, exam_date, job_role, city, normalized_title')
      .order('created_at', { ascending: false })
      .limit(100);

    if (activeFilter === 'draft') query = query.eq('status', 'draft');
    else if (activeFilter === 'enriched') query = query.eq('status', 'enriched');
    else if (activeFilter === 'reviewed') query = query.eq('status', 'reviewed');
    else if (activeFilter === 'approved') query = query.eq('status', 'approved');
    else if (activeFilter === 'promoted') query = query.eq('status', 'promoted');
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
      (d.status === 'draft' || d.status === 'enriched') &&
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

  const runPurgeHighDuplicates = async () => {
    setPurging(true);
    try {
      const { data, error } = await supabase.functions.invoke('firecrawl-ingest', {
        body: { action: 'purge-high-duplicates' },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      toast({
        title: 'Purge complete',
        description: data.message || `Deleted ${data.deleted || 0} high-confidence duplicate(s).`,
      });
      await fetchDrafts();
    } catch (e: any) {
      toast({ title: 'Purge failed', description: e.message, variant: 'destructive' });
    } finally {
      setPurging(false);
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
      (d.status === 'draft' || d.status === 'enriched') &&
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

  // Drafts with missing fields
  const getDraftsNeedingFieldFix = useCallback(() => {
    return drafts.filter(d =>
      (d.status === 'draft' || d.status === 'enriched') &&
      d.dedup_status !== 'duplicate' &&
      (d.fields_missing?.length || 0) > 0 &&
      !busyRows[d.id]
    );
  }, [drafts, busyRows]);

  const fixFieldsEligibleCount = getDraftsNeedingFieldFix().length;

  const runBulkFixFields = async () => {
    const eligible = getDraftsNeedingFieldFix();
    if (eligible.length === 0) {
      toast({ title: 'No rows need field fixes', description: 'All eligible rows have complete fields.' });
      return;
    }
    const confirmed = window.confirm(
      `Fix missing fields on ${eligible.length} row(s) using AI?\n\nThis processes rows sequentially.`
    );
    if (!confirmed) return;

    bulkFixFieldsCancelRef.current = false;
    setBulkFixFieldsRunning(true);
    const progress: BulkProgress = {
      total: eligible.length, current: 0, currentTitle: '',
      succeeded: 0, failed: 0, skipped: 0,
    };
    setBulkFixFieldsProgress({ ...progress });

    for (let i = 0; i < eligible.length; i++) {
      if (bulkFixFieldsCancelRef.current) {
        progress.skipped += eligible.length - i;
        break;
      }
      const draft = eligible[i];
      progress.current = i + 1;
      progress.currentTitle = draft.title || 'Untitled';
      setBulkFixFieldsProgress({ ...progress });

      setBusyRows(prev => ({ ...prev, [draft.id]: 'ai-fix-fields' }));
      try {
        const { data, error } = await supabase.functions.invoke('firecrawl-ai-enrich', {
          body: { action: 'ai-fix-fields', draft_id: draft.id, aiModel: selectedModel },
        });
        if (error) throw new Error(error.message);
        if (data?.error) throw new Error(data.error);
        progress.succeeded++;
      } catch {
        progress.failed++;
      } finally {
        setBusyRows(prev => { const n = { ...prev }; delete n[draft.id]; return n; });
      }
      setBulkFixFieldsProgress({ ...progress });
    }

    setBulkFixFieldsRunning(false);
    setBulkFixFieldsProgress(null);
    await fetchDrafts();
    toast({
      title: 'Bulk Fix Fields complete',
      description: `✅ ${progress.succeeded} fixed · ❌ ${progress.failed} failed · ⏭ ${progress.skipped} skipped`,
    });
  };

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

  // ── Publish Validation & Execution ──
  const validateForPublish = (draft: DraftJob) => {
    const errors: string[] = [];
    const warnings: string[] = [];
    if (!draft.title || draft.title.length < 10) errors.push('Title is missing or too short');
    if (!draft.organization_name) errors.push('Organization name is missing');
    if (!draft.post_name && !draft.total_vacancies) errors.push('Post name or vacancies required');
    if (draft.extraction_confidence === 'none') errors.push('Extraction confidence is "none"');
    if (draft.dedup_status === 'duplicate') errors.push('Row is flagged as duplicate');
    if (!draft.ai_clean_at) errors.push('AI Clean step not completed');
    if (!draft.ai_enrich_at) errors.push('AI Enrich step not completed');
    if (!draft.ai_seo_at) errors.push('SEO metadata not generated');
    if (!draft.seo_title) errors.push('SEO title not generated');
    if (!draft.meta_description) errors.push('Meta description not generated');
    if (!draft.slug_suggestion) errors.push('URL slug not generated');
    if (!draft.cover_image_url) warnings.push('Cover image not generated');
    if (draft.status !== 'approved' && draft.status !== 'enriched' && draft.status !== 'reviewed') {
      warnings.push(`Status is "${draft.status}" — typically rows are approved before publishing`);
    }
    if (!draft.official_notification_url && !draft.official_apply_url) warnings.push('No official links found');
    if (!draft.last_date_of_application && !draft.closing_date) warnings.push('Last date of application is missing');
    if (draft.extraction_confidence === 'low') warnings.push('Extraction confidence is low');
    if ((draft.fields_missing?.length || 0) > 3) warnings.push(`${draft.fields_missing.length} fields still missing`);
    return { errors, warnings };
  };

  const handlePublishClick = (draft: DraftJob) => {
    const { errors, warnings } = validateForPublish(draft);
    setPublishValidation({ draft, errors, warnings });
  };

  const executePublish = async (draft: DraftJob) => {
    setPublishing(true);
    try {
      const slug = draft.slug_suggestion || draft.normalized_title || draft.title?.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || `job-${draft.id.slice(0, 8)}`;
      const { error } = await supabase
        .from('employment_news_jobs')
        .insert({
          org_name: draft.organization_name,
          post: draft.post_name || draft.title,
          enriched_title: draft.seo_title || draft.title,
          enriched_description: draft.intro_text || draft.description_summary || '',
          description: draft.description_summary || draft.intro_text || '',
          meta_title: draft.seo_title,
          meta_description: draft.meta_description,
          slug,
          state: draft.state,
          location: draft.location || draft.city,
          salary: draft.salary || draft.pay_scale,
          qualification: draft.qualification,
          age_limit: draft.age_limit,
          application_mode: draft.application_mode,
          last_date: draft.last_date_of_application || draft.closing_date,
          total_vacancies: draft.total_vacancies,
          apply_link: draft.official_apply_url || draft.official_notification_url,
          faq_html: draft.faq_suggestions ? (() => {
            try {
              const faqs = Array.isArray(draft.faq_suggestions) ? draft.faq_suggestions : [];
              return faqs.map((f: any) => `<div><h3>${f.question || f.q || ''}</h3><p>${f.answer || f.a || ''}</p></div>`).join('');
            } catch { return null; }
          })() : null,
          keywords: draft.category ? [draft.category] : null,
          job_category: draft.category,
          source: 'firecrawl',
          status: 'published',
          published_at: new Date().toISOString(),
        } as any);
      if (error) throw new Error(error.message);
      await supabase
        .from('firecrawl_draft_jobs')
        .update({ status: 'promoted' } as any)
        .eq('id', draft.id);
      toast({ title: 'Published!', description: `"${draft.title}" is now live on TrueJobs.` });
      setPublishValidation(null);
      await fetchDrafts();
    } catch (e: any) {
      toast({ title: 'Publish failed', description: e.message, variant: 'destructive' });
    } finally {
      setPublishing(false);
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
    { key: 'enriched', label: 'Enriched' },
    { key: 'reviewed', label: 'Reviewed' },
    { key: 'approved', label: 'Approved' },
    { key: 'promoted', label: 'Published' },
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
              {bulkFixFieldsRunning ? (
                <Button
                  variant="destructive" size="sm"
                  onClick={() => { bulkFixFieldsCancelRef.current = true; }}
                  title="Stop bulk fix fields"
                >
                  <X className="h-3.5 w-3.5 mr-1.5" />
                  Stop Fix Fields
                </Button>
              ) : (
                <Button
                  variant="outline" size="sm"
                  onClick={runBulkFixFields}
                  disabled={fixFieldsEligibleCount === 0 || loading}
                  title={`Fix missing fields on ${fixFieldsEligibleCount} rows using AI`}
                >
                  <AlertTriangle className="h-3.5 w-3.5 mr-1.5" />
                  Bulk Fix Fields{fixFieldsEligibleCount > 0 ? ` (${fixFieldsEligibleCount})` : ''}
                </Button>
              )}
              <Button
                variant="outline" size="sm"
                onClick={runDedup} disabled={dedupRunning}
              >
                {dedupRunning ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <ShieldAlert className="h-3.5 w-3.5 mr-1.5" />}
                Dedup
              </Button>
              <Button
                variant="destructive" size="sm"
                onClick={runPurgeHighDuplicates} disabled={purging || dedupRunning}
                title="Delete all high-confidence (≥5 score) duplicate rows, keeping the earliest instance"
              >
                {purging ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Trash2 className="h-3.5 w-3.5 mr-1.5" />}
                Purge Duplicates
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

          {/* Bulk fix fields progress bar */}
          {bulkFixFieldsRunning && bulkFixFieldsProgress && (
            <div className="mb-3 p-3 rounded-lg border bg-muted/50 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">
                  🔧 Fixing fields {bulkFixFieldsProgress.current}/{bulkFixFieldsProgress.total} — <span className="text-muted-foreground">{bulkFixFieldsProgress.currentTitle}</span>
                </span>
                <Button
                  size="sm" variant="ghost"
                  className="h-6 text-xs text-destructive hover:text-destructive"
                  onClick={() => { bulkFixFieldsCancelRef.current = true; }}
                >
                  <X className="h-3 w-3 mr-1" /> Cancel
                </Button>
              </div>
              <Progress value={(bulkFixFieldsProgress.current / bulkFixFieldsProgress.total) * 100} className="h-2" />
              <div className="flex gap-3 text-xs text-muted-foreground">
                <span className="text-green-600">✅ {bulkFixFieldsProgress.succeeded}</span>
                <span className="text-red-600">❌ {bulkFixFieldsProgress.failed}</span>
                <span>⏭ {bulkFixFieldsProgress.skipped}</span>
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
                            draft.status === 'promoted' ? 'default' :
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
                              onClick={() => setPreviewDraft(draft)}
                              title="Preview how this job will appear to users"
                              className="gap-1"
                            >
                              <Eye className="h-3 w-3" />
                              <span className="hidden sm:inline text-xs">Preview</span>
                            </Button>
                            <Button
                              size="sm" variant={draft.status === 'promoted' ? 'secondary' : 'default'}
                              disabled={!!busyRows[draft.id] || publishing || draft.status === 'promoted'}
                              onClick={() => handlePublishClick(draft)}
                              title={draft.status === 'promoted' ? 'Already published' : 'Publish this job to TrueJobs'}
                              className="gap-1"
                            >
                              {publishing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                              <span className="hidden sm:inline text-xs">
                                {draft.status === 'promoted' ? 'Live' : 'Publish'}
                              </span>
                            </Button>
                            <Button
                              size="sm" variant="outline"
                              disabled={!!busyRows[draft.id] || (!hasExistingImage(draft) && false)}
                              onClick={() => {
                                if (hasExistingImage(draft)) {
                                  setPreviewImage({ url: draft.cover_image_url!, title: draft.title || 'Untitled' });
                                } else {
                                  createImage(draft.id);
                                }
                              }}
                              title={hasExistingImage(draft) ? 'Click to preview cover image' : 'Generate cover image'}
                              className="gap-1"
                            >
                              {busyRows[draft.id] === 'ai-cover-image' ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : hasExistingImage(draft) ? (
                                <Eye className="h-3 w-3 text-green-500" />
                              ) : (
                                <Image className="h-3 w-3" />
                              )}
                              <span className="hidden sm:inline text-xs">
                                {hasExistingImage(draft) ? 'View' : 'Image'}
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

      {/* Cover Image Preview Dialog */}
      <Dialog open={!!previewImage} onOpenChange={(open) => !open && setPreviewImage(null)}>
        <DialogContent className="max-w-lg">
          <DialogTitle className="text-sm font-medium line-clamp-1">{previewImage?.title}</DialogTitle>
          {previewImage && (
            <img
              src={previewImage.url}
              alt={previewImage.title}
              className="w-full rounded-lg object-contain max-h-[70vh]"
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Draft Preview Dialog */}
      <FirecrawlDraftPreviewDialog
        draft={previewDraft}
        open={!!previewDraft}
        onClose={() => setPreviewDraft(null)}
      />

      {/* Publish Validation Dialog */}
      <AlertDialog open={!!publishValidation} onOpenChange={(open) => !open && setPublishValidation(null)}>
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {publishValidation?.errors.length ? '❌ Cannot Publish Yet' : publishValidation?.warnings.length ? '⚠️ Publish with Warnings?' : '✅ Ready to Publish'}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p className="text-sm">
                  <span className="font-medium">{publishValidation?.draft.title || 'Untitled'}</span>
                  {' — '}{publishValidation?.draft.organization_name || 'Unknown Org'}
                </p>

                {(publishValidation?.errors.length ?? 0) > 0 && (
                  <div className="bg-destructive/10 rounded-lg p-3 space-y-1">
                    <p className="text-sm font-semibold text-destructive">Blocking Issues (must fix):</p>
                    {publishValidation?.errors.map((e, i) => (
                      <p key={i} className="text-sm text-destructive flex items-start gap-1.5">
                        <XCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" /> {e}
                      </p>
                    ))}
                  </div>
                )}

                {(publishValidation?.warnings.length ?? 0) > 0 && (
                  <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-3 space-y-1">
                    <p className="text-sm font-semibold text-yellow-700 dark:text-yellow-400">Warnings (recommended to fix):</p>
                    {publishValidation?.warnings.map((w, i) => (
                      <p key={i} className="text-sm text-yellow-600 dark:text-yellow-400 flex items-start gap-1.5">
                        <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" /> {w}
                      </p>
                    ))}
                  </div>
                )}

                {publishValidation?.errors.length === 0 && publishValidation?.warnings.length === 0 && (
                  <p className="text-sm text-muted-foreground">All checks passed. This job is ready to go live!</p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            {publishValidation && publishValidation.errors.length === 0 && (
              <AlertDialogAction
                onClick={() => publishValidation && executePublish(publishValidation.draft)}
                disabled={publishing}
              >
                {publishing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                {publishValidation.warnings.length > 0 ? 'Publish Anyway' : 'Publish'}
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
