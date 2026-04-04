import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { AzureEmpNewsWorkspace } from './emp-news/azure-based-extraction/AzureEmpNewsWorkspace';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle as AlertTitle,
} from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useAdminToast as useToast } from '@/contexts/AdminMessagesContext';
import { supabase } from '@/integrations/supabase/client';
import mammoth from 'mammoth';
import { getRecommendedModelsForTarget } from '@/lib/aiModels';
import { AiModelSelector, getLastUsedModel } from '@/components/admin/AiModelSelector';
import {
  Upload, FileText, Sparkles, CheckCircle, XCircle, Eye, Pencil, Trash2,
  Search, ChevronLeft, ChevronRight, Loader2, AlertCircle, Info
} from 'lucide-react';

type EmpNewsJob = {
  id: string;
  org_name: string | null;
  post: string | null;
  vacancies: number | null;
  qualification: string | null;
  age_limit: string | null;
  salary: string | null;
  job_type: string | null;
  experience_required: string | null;
  location: string | null;
  application_mode: string | null;
  apply_link: string | null;
  application_start_date: string | null;
  last_date: string | null;
  last_date_raw: string | null;
  last_date_resolved: string | null;
  notification_reference_number: string | null;
  advertisement_number: string | null;
  source: string;
  description: string | null;
  status: string;
  enriched_description: string | null;
  enriched_title: string | null;
  meta_title: string | null;
  meta_description: string | null;
  slug: string | null;
  schema_markup: any;
  faq_html: string | null;
  keywords: string[] | null;
  upload_batch_id: string | null;
  created_at: string;
  published_at: string | null;
  job_category: string | null;
  state: string | null;
  enrichment_error: string | null;
  enrichment_attempts: number;
};

type UploadBatch = {
  id: string;
  filename: string;
  issue_details: string | null;
  uploaded_at: string;
  total_extracted: number;
  status: string;
  total_chunks: number;
  completed_chunks: number;
  extraction_status: string;
  ai_model_used: string | null;
  new_count: number;
  updated_count: number;
};

const CHUNK_SIZE = 7500;
const CHUNK_OVERLAP = 300;
const INTER_CHUNK_DELAY_MS = 5000;

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-muted text-muted-foreground',
  enriched: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  published: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  rejected: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  enrichment_failed: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
};

const JOB_TYPE_COLORS: Record<string, string> = {
  permanent: 'bg-emerald-100 text-emerald-800',
  contract: 'bg-amber-100 text-amber-800',
  deputation: 'bg-purple-100 text-purple-800',
  fellowship: 'bg-cyan-100 text-cyan-800',
  'short-term contract': 'bg-orange-100 text-orange-800',
  'direct recruitment': 'bg-indigo-100 text-indigo-800',
};

function splitIntoChunks(text: string): string[] {
  const cleaned = text.trim();
  if (!cleaned) return [];

  const chunks: string[] = [];
  const step = Math.max(1, CHUNK_SIZE - CHUNK_OVERLAP);

  for (let start = 0; start < cleaned.length; start += step) {
    const end = Math.min(start + CHUNK_SIZE, cleaned.length);
    chunks.push(cleaned.slice(start, end));
    if (end >= cleaned.length) break;
  }

  return chunks;
}

export function EmploymentNewsManager() {
  const { toast } = useToast();
  const toastRef = useRef(toast);
  toastRef.current = toast;
  const [workspace, setWorkspace] = useState<'classic' | 'azure'>('classic');
  const [view, setView] = useState<'upload' | 'pipeline'>('pipeline');

  // Upload state
  const [file, setFile] = useState<File | null>(null);
  const [pastedText, setPastedText] = useState('');
  const [issueDetails, setIssueDetails] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractProgress, setExtractProgress] = useState({ current: 0, total: 0, newCount: 0, updatedCount: 0 });
  const stopExtractionRef = useRef(false);
  const [extractAiModel, setExtractAiModel] = useState<string>(() => getLastUsedModel('text', 'vertex-flash'));

  // Pipeline state
  const [jobs, setJobs] = useState<EmpNewsJob[]>([]);
  const [batches, setBatches] = useState<UploadBatch[]>([]);
  const [isLoadingJobs, setIsLoadingJobs] = useState(true);
  const [isRefetching, setIsRefetching] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [jobTypeFilter, setJobTypeFilter] = useState('all');
  const [batchFilter, setBatchFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [stateFilter, setStateFilter] = useState('all');
  const [perPage, setPerPage] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Stats
  const [stats, setStats] = useState({ total: 0, pending: 0, enriched: 0, published: 0, rejected: 0, failed: 0 });
  const [isRetryingFailed, setIsRetryingFailed] = useState(false);

  // Modals
  const [viewJob, setViewJob] = useState<EmpNewsJob | null>(null);
  const [editJob, setEditJob] = useState<EmpNewsJob | null>(null);
  const [enrichProgress, setEnrichProgress] = useState<{ current: number; total: number } | null>(null);
  const [isEnrichingAll, setIsEnrichingAll] = useState(false);
  const [isScanningUnenriched, setIsScanningUnenriched] = useState(false);
  const [unenrichedCount, setUnenrichedCount] = useState<number | null>(null);
  const [isPublishingAll, setIsPublishingAll] = useState(false);
  const [isCheckingUnpublished, setIsCheckingUnpublished] = useState(false);
  const [unpublishedReport, setUnpublishedReport] = useState<{
    pending: EmpNewsJob[];
    enriched: EmpNewsJob[];
    rejected: EmpNewsJob[];
    failed: EmpNewsJob[];
  } | null>(null);
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});
  // Delete edition state
  const [deletingBatchId, setDeletingBatchId] = useState<string | null>(null);
  const [isDeletingEdition, setIsDeletingEdition] = useState(false);
  // AI Model selection for enrichment (persisted in localStorage)
  const [enrichAiModel, setEnrichAiModel] = useState<string>(() => {
    try { return localStorage.getItem('empnews_enrich_ai_model') || 'gemini'; } catch { return 'gemini'; }
  });
  // Track keywords as comma-separated string during editing
  const [editKeywordsStr, setEditKeywordsStr] = useState('');
  // Track schema_markup as pretty-printed string during editing
  const [editSchemaStr, setEditSchemaStr] = useState('');

  // Persist AI model selection
  const handleEnrichModelChange = useCallback((model: string) => {
    setEnrichAiModel(model);
    try { localStorage.setItem('empnews_enrich_ai_model', model); } catch {}
  }, []);

  // Load data
  const fetchStats = useCallback(async () => {
    const [total, pending, enriched, published, rejected, failed] = await Promise.all([
      supabase.from('employment_news_jobs').select('id', { count: 'exact', head: true }),
      supabase.from('employment_news_jobs').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('employment_news_jobs').select('id', { count: 'exact', head: true }).eq('status', 'enriched'),
      supabase.from('employment_news_jobs').select('id', { count: 'exact', head: true }).eq('status', 'published'),
      supabase.from('employment_news_jobs').select('id', { count: 'exact', head: true }).eq('status', 'rejected'),
      supabase.from('employment_news_jobs').select('id', { count: 'exact', head: true }).eq('status', 'enrichment_failed'),
    ]);
    setStats({
      total: total.count || 0,
      pending: pending.count || 0,
      enriched: enriched.count || 0,
      published: published.count || 0,
      rejected: rejected.count || 0,
      failed: failed.count || 0,
    });
  }, []);

  const fetchBatches = useCallback(async () => {
    const { data } = await supabase
      .from('upload_batches')
      .select('*')
      .order('uploaded_at', { ascending: false });
    if (data) setBatches(data as UploadBatch[]);
  }, []);

  const fetchJobs = useCallback(async () => {
    const hasExistingData = jobs.length > 0;
    if (hasExistingData) {
      setIsRefetching(true);
    } else {
      setIsLoadingJobs(true);
    }
    let query = supabase
      .from('employment_news_jobs')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false });

    if (statusFilter !== 'all') query = query.eq('status', statusFilter);
    if (jobTypeFilter !== 'all') query = query.eq('job_type', jobTypeFilter);
    if (batchFilter !== 'all') query = query.eq('upload_batch_id', batchFilter);
    if (categoryFilter !== 'all') query = query.eq('job_category', categoryFilter);
    if (stateFilter !== 'all') query = query.eq('state', stateFilter);
    if (searchQuery.trim()) {
      query = query.or(`org_name.ilike.%${searchQuery}%,post.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`);
    }

    const from = (currentPage - 1) * perPage;
    query = query.range(from, from + perPage - 1);

    const { data, count, error } = await query;
    if (error) {
      console.error('Fetch jobs error:', error);
      toastRef.current({ title: 'Error', description: 'Failed to load jobs', variant: 'destructive' });
    } else {
      setJobs((data || []) as EmpNewsJob[]);
      setTotalCount(count || 0);
    }
    setIsLoadingJobs(false);
    setIsRefetching(false);
  }, [statusFilter, jobTypeFilter, batchFilter, categoryFilter, stateFilter, searchQuery, currentPage, perPage]);

  useEffect(() => {
    fetchStats();
    fetchBatches();
  }, [fetchStats, fetchBatches]);

  // On mount: check for any batch that was mid-extraction (e.g. after page refresh)
  useEffect(() => {
    const extractingBatch = batches.find(b => b.extraction_status === 'extracting');
    if (extractingBatch && !isExtracting) {
      // Show persistent progress from DB state
      setExtractProgress({
        current: extractingBatch.completed_chunks,
        total: extractingBatch.total_chunks,
        newCount: extractingBatch.new_count || 0,
        updatedCount: extractingBatch.updated_count || 0,
      });
    }
  }, [batches, isExtracting]);

  useEffect(() => {
    if (view === 'pipeline') fetchJobs();
  }, [view, fetchJobs]);

  // Delete entire edition (batch + all its jobs)
  const handleDeleteEdition = useCallback(async () => {
    if (!deletingBatchId) return;
    setIsDeletingEdition(true);
    try {
      const { data, error } = await supabase.rpc('delete_employment_news_edition', {
        p_batch_id: deletingBatchId,
      });
      if (error) throw error;
      const result = data as any;
      if (!result?.success) throw new Error(result?.error || 'Delete failed');
      toast({
        title: 'Edition Deleted',
        description: `Removed "${result.batch_filename}" and ${result.deleted_jobs} job(s).`,
      });
      if (batchFilter === deletingBatchId) setBatchFilter('all');
      setDeletingBatchId(null);
      fetchBatches();
      fetchStats();
      fetchJobs();
    } catch (err: any) {
      toast({ title: 'Delete Failed', description: err.message || 'Unknown error', variant: 'destructive' });
    } finally {
      setIsDeletingEdition(false);
    }
  }, [deletingBatchId, batchFilter, toast, fetchBatches, fetchStats, fetchJobs]);


  const uniqueCategories = useMemo(() => {
    const cats = new Set(jobs.map(j => j.job_category).filter(Boolean));
    return Array.from(cats) as string[];
  }, [jobs]);

  const uniqueStates = useMemo(() => {
    const s = new Set(jobs.map(j => j.state).filter(Boolean));
    return Array.from(s) as string[];
  }, [jobs]);

  // ───── UPLOAD LOGIC ─────
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) setFile(f);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) setFile(f);
  };

  const extractText = async (): Promise<string> => {
    if (pastedText.trim()) return pastedText;
    if (!file) throw new Error('No file selected');

    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext === 'txt') {
      return await file.text();
    }
    if (ext === 'docx') {
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer });
      return result.value;
    }
    throw new Error('Unsupported file type. Use .docx or .txt, or paste text for PDF.');
  };

  const handleExtract = async () => {
    setIsExtracting(true);
    stopExtractionRef.current = false;
    setExtractProgress({ current: 0, total: 0, newCount: 0, updatedCount: 0 });
    let activeBatchId: string | null = null;
    let completedChunksCount = 0;
    let totalChunksCount = 0;

    try {
      const text = await extractText();
      if (text.length < 100) {
        toast({ title: 'Error', description: 'Text is too short to extract jobs from', variant: 'destructive' });
        setIsExtracting(false);
        return;
      }

      const chunks = splitIntoChunks(text);
      totalChunksCount = chunks.length;
      setExtractProgress(p => ({ ...p, total: chunks.length }));

      let batchId: string | null = null;
      let totalNew = 0;
      let totalUpdated = 0;
      let completedChunks = 0;
      let stoppedEarly = false;
      const chunkWarnings: string[] = [];
      let degradedChunks = 0;

      for (let i = 0; i < chunks.length; i++) {
        setExtractProgress(p => ({ ...p, current: i + 1 }));

        const payload: any = {
          text: chunks[i],
          filename: file?.name || 'pasted-text.txt',
          issueDetails: issueDetails,
          aiModel: extractAiModel,
          chunkIndex: i,
          totalChunks: chunks.length,
        };
        if (batchId) payload.batchId = batchId;

        const { data, error } = await supabase.functions.invoke('extract-employment-news', {
          body: payload,
        });

        // Infrastructure errors (network failure, no data at all)
        if (error && !data) {
          const errMsg = error instanceof Error ? error.message : 'Unknown error';
          const isRateLimit = /429|rate.?limit/i.test(errMsg);
          if (isRateLimit && completedChunks > 0) {
            stoppedEarly = true;
            console.warn(`[extract] Rate limited after ${completedChunks}/${chunks.length} chunks`);
            break;
          }
          throw new Error(errMsg);
        }

        // Handled business error codes (rate limit, timeout)
        if (data?.code === 'VERTEX_RATE_LIMITED' || data?.code === 'VERTEX_TIMEOUT') {
          if (completedChunks > 0) {
            stoppedEarly = true;
            console.warn(`[extract] ${data.code} after ${completedChunks}/${chunks.length} chunks`);
            break;
          }
          throw new Error(data?.error || `AI error: ${data?.code}`);
        }

        // Collect warnings from degraded extraction (not a crash)
        if (Array.isArray(data?.warnings) && data.warnings.length > 0) {
          chunkWarnings.push(...data.warnings.map((w: string) => `Chunk ${i + 1}: ${w}`));
        }
        if (data?.degraded) degradedChunks++;

        // Accumulate counts safely
        if (!batchId && data?.batchId) batchId = data.batchId;
        if (batchId) activeBatchId = batchId;
        totalNew += data?.newCount ?? 0;
        totalUpdated += data?.updatedCount ?? 0;
        completedChunks++;
        completedChunksCount = completedChunks;
        setExtractProgress(p => ({ ...p, newCount: totalNew, updatedCount: totalUpdated }));

        // Throttle between chunks
        if (i < chunks.length - 1) {
          await new Promise(r => setTimeout(r, INTER_CHUNK_DELAY_MS));
        }
      }

      if (stoppedEarly) {
        if (batchId) {
          await supabase.from('upload_batches').update({ extraction_status: 'partial' }).eq('id', batchId);
        }
        toast({
          title: 'Partial Extraction',
          description: `Extracted ${totalNew} new, ${totalUpdated} updated from ${completedChunks}/${chunks.length} chunks. AI was rate-limited — remaining chunks can be retried by re-uploading.`,
        });
      } else if (chunkWarnings.length > 0) {
        const warnSummary = chunkWarnings.slice(0, 3).join('; ');
        const extra = chunkWarnings.length > 3 ? ` (+${chunkWarnings.length - 3} more)` : '';
        toast({
          title: 'Extraction Completed with Warnings',
          description: `${totalNew} new, ${totalUpdated} updated. ${degradedChunks} chunk(s) degraded. ${warnSummary}${extra}`,
        });
      } else {
        toast({
          title: 'Extraction Complete',
          description: `${totalNew} new jobs extracted, ${totalUpdated} updated across ${chunks.length} chunk(s).`,
        });
      }

      // Reset and go to pipeline
      setFile(null);
      setPastedText('');
      setIssueDetails('');
      if (batchId) setBatchFilter(batchId);
      setView('pipeline');
      fetchStats();
      fetchBatches();
      fetchJobs();
    } catch (err) {
      console.error('Extract error:', err);
      if (activeBatchId) {
        const fallbackStatus = completedChunksCount > 0 && completedChunksCount < totalChunksCount ? 'partial' : 'failed';
        await supabase
          .from('upload_batches')
          .update({ extraction_status: fallbackStatus, status: fallbackStatus === 'partial' ? 'completed' : 'failed' })
          .eq('id', activeBatchId);
      }
      toast({ title: 'Extraction Failed', description: err instanceof Error ? err.message : 'Unknown error', variant: 'destructive' });
      fetchBatches();
    } finally {
      setIsExtracting(false);
    }
  };

  // Resume extraction for a batch that was partially completed
  const handleResumeExtraction = async (batch: UploadBatch) => {
    toast({
      title: 'Resume Not Supported Yet',
      description: `Batch "${batch.filename}" completed ${batch.completed_chunks}/${batch.total_chunks} chunks. To resume, re-upload the same file — already-extracted jobs will be de-duplicated automatically.`,
    });
  };

  // ───── PIPELINE ACTIONS ─────
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === jobs.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(jobs.map(j => j.id)));
    }
  };

  const bulkUpdateStatus = async (ids: string[], status: string) => {
    const updateData: any = { status };
    if (status === 'published') updateData.published_at = new Date().toISOString();

    const { error } = await supabase
      .from('employment_news_jobs')
      .update(updateData)
      .in('id', ids);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: `${ids.length} job(s) ${status}` });
      fetchJobs();
      fetchStats();
      setSelectedIds(new Set());
    }
  };

  const bulkEnrich = async (ids: string[]) => {
    setEnrichProgress({ current: 0, total: ids.length });

    // Process in batches of 3 to avoid edge function timeouts
    const batchSize = 3;
    let successTotal = 0;
    let failTotal = 0;

    for (let i = 0; i < ids.length; i += batchSize) {
      const batch = ids.slice(i, i + batchSize);
      setEnrichProgress({ current: i, total: ids.length });

      const { data, error } = await supabase.functions.invoke('enrich-employment-news', {
        body: { jobIds: batch, aiModel: enrichAiModel },
      });

      if (error) {
        failTotal += batch.length;
        console.error('Enrich batch error:', error);
      } else if (data?.error) {
        failTotal += batch.length;
        console.error('Enrich batch data error:', data.error);
      } else {
        successTotal += data?.successCount || 0;
        failTotal += data?.failCount || 0;
        // Non-blocking word count warnings with model recommendation
        const wcFails = (data?.results || []).filter((r: any) => r.wordCountValidation?.status === 'fail').length;
        const wcWarns = (data?.results || []).filter((r: any) => r.wordCountValidation?.status === 'warn').length;
        if (wcFails > 0) {
          const betterModels = getRecommendedModelsForTarget(1200).filter(m => m.value !== enrichAiModel);
          const suggestion = betterModels.length > 0 ? ` Try ${betterModels[0].label}.` : '';
          console.log(`[enrich] ${wcFails} items significantly under target.${suggestion}`);
        }
        if (wcWarns > 0) {
          console.log(`[enrich] ${wcWarns} items slightly outside target range`);
        }
      }

      setEnrichProgress({ current: Math.min(i + batchSize, ids.length), total: ids.length });
    }

    setEnrichProgress(null);
    toast({
      title: 'Enrichment Complete',
      description: `${successTotal} enriched, ${failTotal} failed`,
    });
    fetchJobs();
    fetchStats();
    setSelectedIds(new Set());
  };

  const enrichAllPending = async () => {
    setIsEnrichingAll(true);
    try {
      // Fetch ALL pending job IDs (not just current page)
      const { data: pendingJobs, error: fetchErr } = await supabase
        .from('employment_news_jobs')
        .select('id')
        .eq('status', 'pending');

      if (fetchErr) throw fetchErr;
      if (!pendingJobs || pendingJobs.length === 0) {
        toast({ title: 'No pending jobs', description: 'There are no pending jobs to enrich.' });
        setIsEnrichingAll(false);
        return;
      }

      const ids = pendingJobs.map(j => j.id);
      await bulkEnrich(ids);
    } catch (err) {
      console.error('Enrich all pending error:', err);
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Unknown error', variant: 'destructive' });
    } finally {
      setIsEnrichingAll(false);
    }
  };

  const findAndEnrichUnenriched = async () => {
    setIsScanningUnenriched(true);
    try {
      // Fetch all jobs that lack enrichment fields, regardless of status
      const { data: unenrichedJobs, error: fetchErr } = await supabase
        .from('employment_news_jobs')
        .select('id, status')
        .or('enriched_title.is.null,enriched_description.is.null,slug.is.null,meta_title.is.null,meta_description.is.null');

      if (fetchErr) throw fetchErr;
      if (!unenrichedJobs || unenrichedJobs.length === 0) {
        setUnenrichedCount(0);
        toast({ title: 'All jobs enriched', description: 'No unenriched jobs found across all statuses.' });
        setIsScanningUnenriched(false);
        return;
      }

      setUnenrichedCount(unenrichedJobs.length);
      const ids = unenrichedJobs.map(j => j.id);

      toast({
        title: `Found ${ids.length} unenriched jobs`,
        description: 'Starting enrichment in background...',
      });

      await bulkEnrich(ids);
      setUnenrichedCount(null);
    } catch (err) {
      console.error('Find & enrich unenriched error:', err);
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Unknown error', variant: 'destructive' });
    } finally {
      setIsScanningUnenriched(false);
    }
  };

  const publishAllEnriched = async () => {
    setIsPublishingAll(true);
    try {
      // Fetch all enriched job IDs
      const { data: enrichedJobs, error: fetchErr } = await supabase
        .from('employment_news_jobs')
        .select('id')
        .eq('status', 'enriched');

      if (fetchErr) throw fetchErr;
      if (!enrichedJobs || enrichedJobs.length === 0) {
        toast({ title: 'No enriched jobs', description: 'There are no enriched jobs to publish.' });
        setIsPublishingAll(false);
        return;
      }

      const ids = enrichedJobs.map(j => j.id);
      await bulkUpdateStatus(ids, 'published');
      toast({ title: 'Published', description: `${ids.length} enriched jobs published.` });
    } catch (err) {
      console.error('Publish all enriched error:', err);
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Unknown error', variant: 'destructive' });
    } finally {
      setIsPublishingAll(false);
    }
  };

  const retryFailedJobs = async () => {
    setIsRetryingFailed(true);
    try {
      const { data: failedJobs, error: fetchErr } = await supabase
        .from('employment_news_jobs')
        .select('id')
        .eq('status', 'enrichment_failed');

      if (fetchErr) throw fetchErr;
      if (!failedJobs || failedJobs.length === 0) {
        toast({ title: 'No failed jobs', description: 'There are no failed jobs to retry.' });
        setIsRetryingFailed(false);
        return;
      }

      // Reset failed jobs to pending with cleared error and attempts
      const ids = failedJobs.map(j => j.id);
      const { error: updateErr } = await supabase
        .from('employment_news_jobs')
        .update({ status: 'pending', enrichment_error: null, enrichment_attempts: 0 } as any)
        .in('id', ids);

      if (updateErr) throw updateErr;

      toast({ title: 'Reset', description: `${ids.length} failed job(s) reset to pending. Run enrichment again.` });
      fetchJobs();
      fetchStats();
    } catch (err) {
      console.error('Retry failed jobs error:', err);
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Unknown error', variant: 'destructive' });
    } finally {
      setIsRetryingFailed(false);
    }
  };

  const checkUnpublishedJobs = async () => {
    setIsCheckingUnpublished(true);
    try {
      const [pendingRes, enrichedRes, rejectedRes, failedRes] = await Promise.all([
        supabase.from('employment_news_jobs').select('*').eq('status', 'pending').order('created_at', { ascending: false }).limit(500),
        supabase.from('employment_news_jobs').select('*').eq('status', 'enriched').order('created_at', { ascending: false }).limit(500),
        supabase.from('employment_news_jobs').select('*').eq('status', 'rejected').order('created_at', { ascending: false }).limit(500),
        supabase.from('employment_news_jobs').select('*').eq('status', 'enrichment_failed').order('created_at', { ascending: false }).limit(500),
      ]);
      setUnpublishedReport({
        pending: (pendingRes.data || []) as EmpNewsJob[],
        enriched: (enrichedRes.data || []) as EmpNewsJob[],
        rejected: (rejectedRes.data || []) as EmpNewsJob[],
        failed: (failedRes.data || []) as EmpNewsJob[],
      });
    } catch (err) {
      console.error('Check unpublished error:', err);
      toastRef.current({ title: 'Error', description: 'Failed to fetch unpublished jobs', variant: 'destructive' });
    } finally {
      setIsCheckingUnpublished(false);
    }
  };

  const saveEdit = async () => {
    if (!editJob) return;
    const errors: Record<string, string> = {};

    // Validate slug uniqueness
    if (editJob.slug) {
      const { data: existing } = await supabase
        .from('employment_news_jobs')
        .select('id')
        .eq('slug', editJob.slug)
        .neq('id', editJob.id)
        .limit(1);
      if (existing && existing.length > 0) {
        errors.slug = 'This slug is already in use by another job.';
      }
    }

    // Parse schema_markup JSON
    let parsedSchema: any = null;
    if (editSchemaStr.trim()) {
      try {
        parsedSchema = JSON.parse(editSchemaStr);
      } catch {
        errors.schema_markup = 'Invalid JSON. Please fix before saving.';
      }
    }

    if (Object.keys(errors).length > 0) {
      setEditErrors(errors);
      return;
    }
    setEditErrors({});

    // Convert keywords string to array
    const keywordsArray = editKeywordsStr.trim()
      ? editKeywordsStr.split(',').map(k => k.trim()).filter(k => k.length > 0)
      : null;

    const { id, created_at, published_at, ...updateData } = editJob;
    const payload = {
      ...updateData,
      keywords: keywordsArray,
      schema_markup: parsedSchema,
    } as any;

    const { error } = await supabase
      .from('employment_news_jobs')
      .update(payload)
      .eq('id', id);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Saved' });
      setEditJob(null);
      fetchJobs();
    }
  };

  const totalPages = Math.ceil(totalCount / perPage);

  // ───── RENDER ─────
  return (
    <div className="space-y-6">
      {/* Workspace switcher */}
      <div className="flex items-center gap-2 border-b pb-3">
        <Button
          variant={workspace === 'classic' ? 'default' : 'outline'}
          onClick={() => setWorkspace('classic')}
          size="sm"
        >
          Classic Pipeline
        </Button>
        <Button
          variant={workspace === 'azure' ? 'default' : 'outline'}
          onClick={() => setWorkspace('azure')}
          size="sm"
        >
          Azure Based Extraction
        </Button>
      </div>

      {workspace === 'azure' ? (
        <AzureEmpNewsWorkspace />
      ) : (
      <>
      {/* Tab switcher */}
      <div className="flex items-center gap-2">
        <Button
          variant={view === 'upload' ? 'default' : 'outline'}
          onClick={() => setView('upload')}
          size="sm"
        >
          <Upload className="h-4 w-4 mr-2" /> Upload Issue
        </Button>
        <Button
          variant={view === 'pipeline' ? 'default' : 'outline'}
          onClick={() => setView('pipeline')}
          size="sm"
        >
          <FileText className="h-4 w-4 mr-2" /> Pipeline
        </Button>
      </div>

      {view === 'upload' ? (
        <UploadView
          file={file}
          pastedText={pastedText}
          issueDetails={issueDetails}
          isExtracting={isExtracting}
          extractProgress={extractProgress}
          aiModel={extractAiModel}
          onAiModelChange={setExtractAiModel}
          onFileChange={handleFileChange}
          onDrop={handleDrop}
          onPastedTextChange={setPastedText}
          onIssueDetailsChange={setIssueDetails}
          onExtract={handleExtract}
        />
      ) : (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
            {[
              { label: 'Total', value: stats.total, color: 'text-foreground' },
              { label: 'Pending', value: stats.pending, color: 'text-muted-foreground' },
              { label: 'Enriched', value: stats.enriched, color: 'text-blue-600' },
              { label: 'Published', value: stats.published, color: 'text-green-600' },
              { label: 'Rejected', value: stats.rejected, color: 'text-red-600' },
              { label: 'Failed', value: stats.failed, color: 'text-orange-600' },
            ].map(s => (
              <Card key={s.label} className={s.label === 'Failed' && stats.failed > 0 ? 'border-orange-300 dark:border-orange-700' : ''}>
                <CardContent className="p-3 text-center">
                  <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Uploaded Volumes */}
          {batches.length > 0 && (
            <Card>
              <CardHeader className="pb-2 pt-3 px-4">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Uploaded Volumes ({batches.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3">
                <div className="flex flex-wrap gap-2">
                  {batches.map(b => (
                    <div key={b.id} className="flex items-center gap-0.5">
                      <Badge
                        variant="outline"
                        className={`cursor-pointer text-xs py-1 px-2 rounded-r-none ${batchFilter === b.id ? 'border-primary bg-primary/10 text-primary' : ''}`}
                        onClick={() => { setBatchFilter(batchFilter === b.id ? 'all' : b.id); setCurrentPage(1); }}
                      >
                        {b.issue_details || b.filename}
                        <span className="ml-1 opacity-70">({b.total_extracted})</span>
                        {b.extraction_status === 'extracting' && (
                          <span className="ml-1 text-muted-foreground">
                            <Loader2 className="inline h-3 w-3 animate-spin mr-0.5" />
                            {b.completed_chunks}/{b.total_chunks}
                          </span>
                        )}
                        {b.extraction_status === 'partial' && (
                          <span className="ml-1 text-orange-600">⚠ {b.completed_chunks}/{b.total_chunks}</span>
                        )}
                        {b.extraction_status === 'completed' && <CheckCircle className="ml-1 h-3 w-3 text-green-600" />}
                        {b.extraction_status === 'failed' && <XCircle className="ml-1 h-3 w-3 text-destructive" />}
                      </Badge>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-6 w-6 rounded-l-none border-l-0 text-destructive hover:bg-destructive/10"
                        onClick={(e) => { e.stopPropagation(); setDeletingBatchId(b.id); }}
                        title="Delete this edition and all its jobs"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Delete Edition Confirmation */}
          <AlertDialog open={!!deletingBatchId} onOpenChange={v => !v && setDeletingBatchId(null)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertTitle>Delete Edition</AlertTitle>
                <AlertDialogDescription>
                  This will permanently delete this newspaper edition and <strong>all</strong> jobs extracted from it (published or unpublished). This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={isDeletingEdition}>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDeleteEdition}
                  disabled={isDeletingEdition}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {isDeletingEdition ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Deleting…</> : 'Delete Edition'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* Filters */}
          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search org, post, description…"
                value={searchQuery}
                onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={v => { setStatusFilter(v); setCurrentPage(1); }}>
              <SelectTrigger className="w-[130px]"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="enriched">Enriched</SelectItem>
                <SelectItem value="published">Published</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="enrichment_failed">Failed</SelectItem>
              </SelectContent>
            </Select>
            <Select value={jobTypeFilter} onValueChange={v => { setJobTypeFilter(v); setCurrentPage(1); }}>
              <SelectTrigger className="w-[140px]"><SelectValue placeholder="Job Type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="permanent">Permanent</SelectItem>
                <SelectItem value="contract">Contract</SelectItem>
                <SelectItem value="deputation">Deputation</SelectItem>
                <SelectItem value="fellowship">Fellowship</SelectItem>
                <SelectItem value="direct recruitment">Direct Recruitment</SelectItem>
              </SelectContent>
            </Select>
            <Select value={categoryFilter} onValueChange={v => { setCategoryFilter(v); setCurrentPage(1); }}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="Category" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {['Central Government', 'State Government', 'Defence', 'Railway', 'Banking', 'SSC', 'PSU', 'University/Research', 'Teaching', 'Police', 'Medical/Health', 'Engineering', 'Other'].map(c => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={stateFilter} onValueChange={v => { setStateFilter(v); setCurrentPage(1); }}>
              <SelectTrigger className="w-[130px]"><SelectValue placeholder="State" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All States</SelectItem>
                {uniqueStates.map(s => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={batchFilter} onValueChange={v => { setBatchFilter(v); setCurrentPage(1); }}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="Batch" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Batches</SelectItem>
                {batches.map(b => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.filename} ({b.total_extracted})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={String(perPage)} onValueChange={v => { setPerPage(Number(v)); setCurrentPage(1); }}>
              <SelectTrigger className="w-[80px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="25">25</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* AI Model Selector + Bulk Actions */}
          <div className="flex flex-wrap gap-2 items-center">
            <div className="flex items-center gap-1.5 bg-muted/50 rounded-md px-2 py-1 border">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs font-medium text-muted-foreground">AI Model:</span>
              <Select value={enrichAiModel} onValueChange={handleEnrichModelChange}>
                <SelectTrigger className="w-[200px] h-7 text-xs border-0 bg-transparent p-0 pl-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gemini">Gemini 2.5 Flash</SelectItem>
                  <SelectItem value="lovable-gemini">Lovable Gemini</SelectItem>
                  <SelectItem value="mistral">Mistral 7B (Bedrock)</SelectItem>
                  <SelectItem value="claude-sonnet">Claude Sonnet 4.6 (API)</SelectItem>
                  <SelectItem value="vertex-flash">Gemini 2.5 Flash (From API)</SelectItem>
                  <SelectItem value="vertex-pro">Gemini 2.5 Pro (From API)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="border-l h-6 mx-1" />
            <span className="text-sm text-muted-foreground">{selectedIds.size} selected</span>
            <Button size="sm" onClick={() => bulkUpdateStatus(Array.from(selectedIds), 'published')} disabled={selectedIds.size === 0}>
              <CheckCircle className="h-3 w-3 mr-1" /> Publish Selected
            </Button>
            <Button size="sm" variant="secondary" onClick={() => bulkEnrich(Array.from(selectedIds))} disabled={selectedIds.size === 0}>
              <Sparkles className="h-3 w-3 mr-1" /> Enrich Selected
            </Button>
            <Button size="sm" variant="destructive" onClick={() => bulkUpdateStatus(Array.from(selectedIds), 'rejected')} disabled={selectedIds.size === 0}>
              <XCircle className="h-3 w-3 mr-1" /> Reject Selected
            </Button>
            <div className="border-l h-6 mx-1" />
            <Button size="sm" variant="outline" onClick={() => {
              const unpublished = jobs.filter(j => j.status !== 'published').map(j => j.id);
              if (unpublished.length === 0) {
                toast({ title: 'Nothing to publish', description: 'All jobs on this page are already published.' });
              } else {
                bulkUpdateStatus(unpublished, 'published');
              }
            }}>
              Publish All on Page
            </Button>
            <Button size="sm" variant="outline" onClick={() => bulkEnrich(jobs.map(j => j.id))}>
              Enrich All on Page
            </Button>
            <div className="border-l h-6 mx-1" />
            <Button size="sm" variant="default" onClick={enrichAllPending} disabled={isEnrichingAll || stats.pending === 0}>
              {isEnrichingAll ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Sparkles className="h-3 w-3 mr-1" />}
              Enrich All Pending ({stats.pending})
            </Button>
            <Button size="sm" variant="default" onClick={publishAllEnriched} disabled={isPublishingAll || stats.enriched === 0}>
              {isPublishingAll ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <CheckCircle className="h-3 w-3 mr-1" />}
              Publish All Enriched ({stats.enriched})
            </Button>
            <Button size="sm" variant="secondary" onClick={findAndEnrichUnenriched} disabled={isScanningUnenriched}>
              {isScanningUnenriched ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Search className="h-3 w-3 mr-1" />}
              {isScanningUnenriched
                ? `Enriching${unenrichedCount ? ` ${unenrichedCount}` : ''}...`
                : 'Find & Enrich Unenriched'}
            </Button>
            {stats.failed > 0 && (
              <Button size="sm" variant="outline" className="border-orange-300 text-orange-700 hover:bg-orange-50 dark:border-orange-700 dark:text-orange-400 dark:hover:bg-orange-950" onClick={retryFailedJobs} disabled={isRetryingFailed}>
                {isRetryingFailed ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <AlertCircle className="h-3 w-3 mr-1" />}
                Retry Failed ({stats.failed})
              </Button>
            )}
            <div className="border-l h-6 mx-1" />
            <Button size="sm" variant="outline" onClick={checkUnpublishedJobs} disabled={isCheckingUnpublished}>
              {isCheckingUnpublished ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Eye className="h-3 w-3 mr-1" />}
              Check All Not Published
            </Button>
          </div>

          {/* Table */}
          <div className="border rounded-md overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={jobs.length > 0 && selectedIds.size === jobs.length}
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead className="w-10">#</TableHead>
                  <TableHead>Organisation</TableHead>
                  <TableHead>Post</TableHead>
                  <TableHead className="w-16">Vac.</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Last Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-16">Enriched</TableHead>
                  <TableHead className="w-16">Words</TableHead>
                  <TableHead className="w-24">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoadingJobs ? (
                  <TableRow>
                    <TableCell colSpan={12} className="text-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                    </TableCell>
                  </TableRow>
                ) : jobs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={12} className="text-center py-8 text-muted-foreground">
                      No jobs found
                    </TableCell>
                  </TableRow>
                ) : jobs.map((job, idx) => (
                  <TableRow key={job.id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.has(job.id)}
                        onCheckedChange={() => toggleSelect(job.id)}
                      />
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {(currentPage - 1) * perPage + idx + 1}
                    </TableCell>
                    <TableCell className="font-medium text-sm max-w-[180px] truncate">
                      {job.org_name || '—'}
                    </TableCell>
                    <TableCell className="text-sm max-w-[160px] truncate">
                      {job.post || '—'}
                    </TableCell>
                    <TableCell className="text-sm">{job.vacancies ?? '—'}</TableCell>
                    <TableCell>
                      {job.job_type && (
                        <Badge variant="outline" className={`text-xs ${JOB_TYPE_COLORS[job.job_type] || ''}`}>
                          {job.job_type}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">{job.job_category || '—'}</TableCell>
                    <TableCell className="text-xs">{job.location || '—'}</TableCell>
                    <TableCell className="text-xs">{job.last_date || '—'}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Badge className={`text-xs ${STATUS_COLORS[job.status] || ''}`}>
                          {job.status === 'enrichment_failed' ? 'failed' : job.status}
                        </Badge>
                        {job.status === 'enrichment_failed' && job.enrichment_error && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <AlertCircle className="h-3.5 w-3.5 text-orange-500 cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                              <p className="text-xs font-medium">Attempt {job.enrichment_attempts}/3</p>
                              <p className="text-xs text-muted-foreground mt-1">{job.enrichment_error}</p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                        {job.status === 'pending' && job.enrichment_attempts > 0 && (
                          <span className="text-[10px] text-muted-foreground">#{job.enrichment_attempts}</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {job.enriched_title && job.enriched_description && job.slug && job.meta_title && job.meta_description ? (
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-500" />
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {(() => {
                        const text = job.enriched_description || job.description || '';
                        const count = text.trim() ? text.trim().split(/\s+/).length : 0;
                        return count > 0 ? count : '—';
                      })()}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setViewJob(job)}>
                          <Eye className="h-3 w-3" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => {
                          setEditJob({ ...job });
                          setEditKeywordsStr(job.keywords?.join(', ') || '');
                          setEditSchemaStr(job.schema_markup ? JSON.stringify(job.schema_markup, null, 2) : '');
                          setEditErrors({});
                        }}>
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => bulkEnrich([job.id])}>
                          <Sparkles className="h-3 w-3" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => bulkUpdateStatus([job.id], 'published')}>
                          <CheckCircle className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              Showing {Math.min((currentPage - 1) * perPage + 1, totalCount)}–{Math.min(currentPage * perPage, totalCount)} of {totalCount}
            </span>
            <div className="flex gap-1">
              <Button size="sm" variant="outline" disabled={currentPage <= 1} onClick={() => setCurrentPage(p => p - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="px-3 py-1">Page {currentPage} of {totalPages || 1}</span>
              <Button size="sm" variant="outline" disabled={currentPage >= totalPages} onClick={() => setCurrentPage(p => p + 1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </>
      )}

      {/* VIEW MODAL */}
      <Dialog open={!!viewJob} onOpenChange={() => setViewJob(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{viewJob?.org_name} — {viewJob?.post}</DialogTitle>
          </DialogHeader>
          {viewJob && (
            <Tabs defaultValue="original">
              <TabsList>
                <TabsTrigger value="original">Original</TabsTrigger>
                <TabsTrigger value="enriched" disabled={!viewJob.enriched_description && !viewJob.enriched_title}>Enriched</TabsTrigger>
                <TabsTrigger value="seo" disabled={!viewJob.meta_title && !viewJob.slug}>SEO</TabsTrigger>
              </TabsList>
              <TabsContent value="original" className="space-y-3 mt-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {([
                    ['Organisation', viewJob.org_name],
                    ['Post', viewJob.post],
                    ['Vacancies', viewJob.vacancies],
                    ['Qualification', viewJob.qualification],
                    ['Age Limit', viewJob.age_limit],
                    ['Salary', viewJob.salary],
                    ['Job Type', viewJob.job_type],
                    ['Experience', viewJob.experience_required],
                    ['Location', viewJob.location],
                    ['Application Mode', viewJob.application_mode],
                    ['Last Date', viewJob.last_date],
                    ['Last Date (Resolved)', viewJob.last_date_resolved],
                    ['Category', viewJob.job_category],
                    ['State', viewJob.state],
                    ['Adv. No.', viewJob.advertisement_number],
                    ['Ref. No.', viewJob.notification_reference_number],
                  ] as [string, any][]).map(([label, value]) => (
                    <div key={label}>
                      <p className="text-muted-foreground text-xs">{label}</p>
                      <p className="font-medium">{value || '—'}</p>
                    </div>
                  ))}
                </div>
                {viewJob.apply_link && (
                  <div>
                    <p className="text-muted-foreground text-xs">Apply Link</p>
                    <a href={viewJob.apply_link} target="_blank" rel="noopener noreferrer" className="text-primary underline text-sm break-all">{viewJob.apply_link}</a>
                  </div>
                )}
                <div>
                  <p className="text-muted-foreground text-xs mb-1">Description</p>
                  <p className="text-sm whitespace-pre-wrap">{viewJob.description || '—'}</p>
                </div>
              </TabsContent>
              <TabsContent value="enriched" className="mt-4 space-y-4">
                {viewJob.enriched_title && (
                  <div>
                    <p className="text-muted-foreground text-xs">Enriched Title</p>
                    <p className="text-lg font-bold">{viewJob.enriched_title}</p>
                  </div>
                )}
                {viewJob.enriched_description ? (
                  <div className="prose prose-sm max-w-none dark:prose-invert" dangerouslySetInnerHTML={{ __html: viewJob.enriched_description }} />
                ) : (
                  <p className="text-muted-foreground">Not enriched yet</p>
                )}
                {viewJob.faq_html && (
                  <div className="border-t pt-4">
                    <p className="text-muted-foreground text-xs mb-2">FAQ HTML</p>
                    <div className="prose prose-sm max-w-none dark:prose-invert" dangerouslySetInnerHTML={{ __html: viewJob.faq_html }} />
                  </div>
                )}
              </TabsContent>
              <TabsContent value="seo" className="mt-4 space-y-3">
                <div className="grid grid-cols-1 gap-3 text-sm">
                  {([
                    ['Meta Title', viewJob.meta_title],
                    ['Meta Description', viewJob.meta_description],
                    ['Slug', viewJob.slug],
                  ] as [string, any][]).map(([label, value]) => (
                    <div key={label}>
                      <p className="text-muted-foreground text-xs">{label}</p>
                      <p className="font-medium">{value || '—'}</p>
                    </div>
                  ))}
                </div>
                {viewJob.keywords && viewJob.keywords.length > 0 && (
                  <div>
                    <p className="text-muted-foreground text-xs mb-1">Keywords</p>
                    <div className="flex flex-wrap gap-1">
                      {viewJob.keywords.map((kw: string, i: number) => (
                        <Badge key={i} variant="secondary" className="text-xs">{kw}</Badge>
                      ))}
                    </div>
                  </div>
                )}
                {viewJob.schema_markup && (
                  <div>
                    <p className="text-muted-foreground text-xs mb-1">Schema Markup (JSON-LD)</p>
                    <pre className="text-xs bg-muted p-3 rounded-md overflow-auto max-h-60">
                      {JSON.stringify(viewJob.schema_markup, null, 2)}
                    </pre>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>

      {/* EDIT MODAL */}
      <Dialog open={!!editJob} onOpenChange={() => { setEditJob(null); setEditErrors({}); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Edit Job
              {editJob?.enriched_title && (
                <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 text-xs">Enriched</Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          {editJob && (
            <div className="grid grid-cols-2 gap-3">
              {([
                ['org_name', 'Organisation'],
                ['post', 'Post'],
                ['qualification', 'Qualification'],
                ['age_limit', 'Age Limit'],
                ['salary', 'Salary'],
                ['job_type', 'Job Type'],
                ['experience_required', 'Experience'],
                ['location', 'Location'],
                ['application_mode', 'Application Mode'],
                ['apply_link', 'Apply Link'],
                ['last_date', 'Last Date'],
                ['job_category', 'Category'],
                ['state', 'State'],
                ['advertisement_number', 'Adv. Number'],
                ['notification_reference_number', 'Ref. Number'],
              ] as [keyof EmpNewsJob, string][]).map(([field, label]) => (
                <div key={field}>
                  <label className="text-xs text-muted-foreground">{label}</label>
                  <Input
                    value={String(editJob[field] || '')}
                    onChange={e => setEditJob({ ...editJob, [field]: e.target.value || null })}
                  />
                </div>
              ))}
              <div className="col-span-2">
                <label className="text-xs text-muted-foreground">Vacancies</label>
                <Input
                  type="number"
                  value={editJob.vacancies ?? ''}
                  onChange={e => setEditJob({ ...editJob, vacancies: e.target.value ? parseInt(e.target.value) : null })}
                />
              </div>
              <div className="col-span-2">
                <label className="text-xs text-muted-foreground">Description</label>
                <Textarea
                  value={editJob.description || ''}
                  onChange={e => setEditJob({ ...editJob, description: e.target.value })}
                  rows={4}
                />
              </div>

              {/* ── Enriched / SEO Fields ── */}
              <div className="col-span-2 border-t pt-4 mt-2">
                <h4 className="text-sm font-semibold text-foreground mb-3">Enriched / SEO Fields</h4>
              </div>

              <div className="col-span-2">
                <label className="text-xs text-muted-foreground">Enriched Title</label>
                <Input
                  value={editJob.enriched_title || ''}
                  onChange={e => setEditJob({ ...editJob, enriched_title: e.target.value || null })}
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Meta Title</label>
                <Input
                  value={editJob.meta_title || ''}
                  onChange={e => setEditJob({ ...editJob, meta_title: e.target.value || null })}
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Meta Description</label>
                <Input
                  value={editJob.meta_description || ''}
                  onChange={e => setEditJob({ ...editJob, meta_description: e.target.value || null })}
                />
              </div>
              <div className="col-span-2">
                <label className="text-xs text-muted-foreground">Slug</label>
                <Input
                  value={editJob.slug || ''}
                  onChange={e => {
                    setEditJob({ ...editJob, slug: e.target.value || null });
                    if (editErrors.slug) setEditErrors(prev => ({ ...prev, slug: '' }));
                  }}
                />
                {editErrors.slug && <p className="text-xs text-destructive mt-1">{editErrors.slug}</p>}
              </div>
              <div className="col-span-2">
                <label className="text-xs text-muted-foreground">Keywords (comma-separated)</label>
                <Input
                  value={editKeywordsStr}
                  onChange={e => setEditKeywordsStr(e.target.value)}
                  placeholder="sarkari naukri, govt job, ..."
                />
              </div>
              <div className="col-span-2">
                <label className="text-xs text-muted-foreground">Enriched Description (HTML)</label>
                <Textarea
                  value={editJob.enriched_description || ''}
                  onChange={e => setEditJob({ ...editJob, enriched_description: e.target.value || null })}
                  rows={6}
                />
              </div>
              <div className="col-span-2">
                <label className="text-xs text-muted-foreground">FAQ HTML</label>
                <Textarea
                  value={editJob.faq_html || ''}
                  onChange={e => setEditJob({ ...editJob, faq_html: e.target.value || null })}
                  rows={4}
                />
              </div>
              <div className="col-span-2">
                <label className="text-xs text-muted-foreground flex items-center gap-1">
                  Schema Markup (JSON-LD) <Badge variant="outline" className="text-[10px] px-1">Advanced</Badge>
                </label>
                <Textarea
                  value={editSchemaStr}
                  onChange={e => {
                    setEditSchemaStr(e.target.value);
                    if (editErrors.schema_markup) setEditErrors(prev => ({ ...prev, schema_markup: '' }));
                  }}
                  rows={6}
                  className="font-mono text-xs"
                />
                {editErrors.schema_markup && <p className="text-xs text-destructive mt-1">{editErrors.schema_markup}</p>}
              </div>

              <div className="col-span-2 flex justify-end gap-2">
                <Button variant="outline" onClick={() => { setEditJob(null); setEditErrors({}); }}>Cancel</Button>
                <Button
                  onClick={saveEdit}
                  disabled={Object.values(editErrors).some(v => !!v)}
                >Save</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ENRICH PROGRESS MODAL */}
      <Dialog open={!!enrichProgress} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary animate-pulse" />
              Enriching Jobs with AI
            </DialogTitle>
          </DialogHeader>
          {enrichProgress && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Enriching job {enrichProgress.current} of {enrichProgress.total}…
              </p>
              <Progress value={(enrichProgress.current / enrichProgress.total) * 100} />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Unpublished Report Dialog */}
      <Dialog open={!!unpublishedReport} onOpenChange={(open) => !open && setUnpublishedReport(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>All Not Published Jobs Report</DialogTitle>
          </DialogHeader>
          {unpublishedReport && (() => {
            const total = unpublishedReport.pending.length + unpublishedReport.enriched.length + unpublishedReport.rejected.length + unpublishedReport.failed.length;
            const sections = [
              { label: 'Pending (Not Enriched)', jobs: unpublishedReport.pending, color: 'text-muted-foreground' },
              { label: 'Enriched (Ready to Publish)', jobs: unpublishedReport.enriched, color: 'text-blue-600' },
              { label: 'Rejected', jobs: unpublishedReport.rejected, color: 'text-destructive' },
              { label: 'Enrichment Failed', jobs: unpublishedReport.failed, color: 'text-orange-600' },
            ];
            return (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Total not-published jobs: <span className="font-bold text-foreground">{total}</span>
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {sections.map(s => (
                    <Card key={s.label} className="p-3">
                      <p className="text-xs text-muted-foreground">{s.label}</p>
                      <p className={`text-2xl font-bold ${s.color}`}>{s.jobs.length}</p>
                    </Card>
                  ))}
                </div>
                {sections.filter(s => s.jobs.length > 0).map(s => (
                  <div key={s.label}>
                    <h3 className={`text-sm font-semibold mb-2 ${s.color}`}>{s.label} ({s.jobs.length})</h3>
                    <div className="border rounded-md overflow-auto max-h-48">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-xs">Organisation</TableHead>
                            <TableHead className="text-xs">Post</TableHead>
                            <TableHead className="text-xs">Category</TableHead>
                            <TableHead className="text-xs">Created</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {s.jobs.slice(0, 50).map(job => (
                            <TableRow key={job.id}>
                              <TableCell className="text-xs truncate max-w-[150px]">{job.org_name || '—'}</TableCell>
                              <TableCell className="text-xs truncate max-w-[150px]">{job.post || '—'}</TableCell>
                              <TableCell className="text-xs">{job.job_category || '—'}</TableCell>
                              <TableCell className="text-xs">{new Date(job.created_at).toLocaleDateString()}</TableCell>
                            </TableRow>
                          ))}
                          {s.jobs.length > 50 && (
                            <TableRow>
                              <TableCell colSpan={4} className="text-xs text-center text-muted-foreground">
                                ...and {s.jobs.length - 50} more
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
      </>
      )}
    </div>
  );
}

// ─── Upload View Sub-Component ───
function UploadView({
  file, pastedText, issueDetails, isExtracting, extractProgress,
  aiModel, onAiModelChange,
  onFileChange, onDrop, onPastedTextChange, onIssueDetailsChange, onExtract,
}: {
  file: File | null;
  pastedText: string;
  issueDetails: string;
  isExtracting: boolean;
  extractProgress: { current: number; total: number; newCount: number; updatedCount: number };
  aiModel: string;
  onAiModelChange: (v: string) => void;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onDrop: (e: React.DragEvent) => void;
  onPastedTextChange: (v: string) => void;
  onIssueDetailsChange: (v: string) => void;
  onExtract: () => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Upload Employment News Issue</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <label className="text-sm font-medium">Issue Details</label>
            <Input
              placeholder='e.g. "Vol. L Issue 48, Feb 28 – Mar 6 2026"'
              value={issueDetails}
              onChange={e => onIssueDetailsChange(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm font-medium">AI Model</label>
            <AiModelSelector
              value={aiModel}
              onValueChange={onAiModelChange}
              capability="text"
              triggerClassName="w-[220px]"
              size="default"
            />
          </div>
        </div>

        {/* File drop zone */}
        <div
          className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
          onDrop={onDrop}
          onDragOver={e => e.preventDefault()}
          onClick={() => document.getElementById('emp-news-file')?.click()}
        >
          <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-sm font-medium">Drop .docx or .txt file here, or click to browse</p>
          <div className="flex items-center justify-center gap-1 mt-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="text-xs text-muted-foreground flex items-center gap-1 cursor-help">
                  <Info className="h-3 w-3" /> For PDF, paste OCR text below
                </span>
              </TooltipTrigger>
              <TooltipContent>
                <p>For best results, use the .docx version of Employment News</p>
              </TooltipContent>
            </Tooltip>
          </div>
          <input
            id="emp-news-file"
            type="file"
            accept=".docx,.txt"
            className="hidden"
            onChange={onFileChange}
          />
        </div>

        {file && (
          <div className="flex items-center gap-2 p-3 bg-muted rounded-md">
            <FileText className="h-4 w-4" />
            <span className="text-sm font-medium">{file.name}</span>
            <span className="text-xs text-muted-foreground">({(file.size / 1024).toFixed(1)} KB)</span>
          </div>
        )}

        <div>
          <label className="text-sm font-medium">Or paste OCR-converted text (for PDF)</label>
          <Textarea
            rows={6}
            placeholder="Paste the full text content of the Employment News issue here…"
            value={pastedText}
            onChange={e => onPastedTextChange(e.target.value)}
          />
        </div>

        {isExtracting && extractProgress.total > 0 && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Processing chunk {extractProgress.current} of {extractProgress.total}</span>
              <span>{extractProgress.newCount} new, {extractProgress.updatedCount} updated</span>
            </div>
            <Progress value={(extractProgress.current / extractProgress.total) * 100} />
          </div>
        )}

        {/* Show last known progress from DB after page refresh */}
        {!isExtracting && extractProgress.total > 0 && extractProgress.current < extractProgress.total && (
          <div className="space-y-2 rounded-md border border-orange-300 bg-orange-50 dark:bg-orange-950/20 p-3">
            <div className="flex justify-between text-sm">
              <span className="font-medium text-orange-700 dark:text-orange-400">
                ⚠ Extraction was interrupted at chunk {extractProgress.current}/{extractProgress.total}
              </span>
              <span>{extractProgress.newCount} new, {extractProgress.updatedCount} updated so far</span>
            </div>
            <Progress value={(extractProgress.current / extractProgress.total) * 100} className="bg-orange-100" />
            <p className="text-xs text-muted-foreground">
              Re-upload the same file to continue — already-extracted jobs will be de-duplicated automatically.
            </p>
          </div>
        )}

        <Button
          onClick={onExtract}
          disabled={isExtracting || (!file && !pastedText.trim())}
          className="w-full"
          size="lg"
        >
          {isExtracting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Extracting Jobs…
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4 mr-2" />
              Extract Jobs with AI
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
