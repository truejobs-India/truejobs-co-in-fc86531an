/**
 * ChatGPT Agent Manager — main admin panel for Excel-based content drafts.
 */
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import {
  Upload, Search, Sparkles, Loader2, Copy, ChevronDown,
  Send, AlertTriangle, Link2Off, Link2, RefreshCw, Wand2, StopCircle, Eye, EyeOff, ExternalLink,
} from 'lucide-react';

const LIVE_SITE_ORIGIN = 'https://truejobs.co.in';
const TABLE_TO_PATH: Record<string, string> = {
  employment_news_jobs: '/jobs/employment-news',
  govt_exams: '/sarkari-jobs',
  govt_results: '/sarkari-jobs',
  govt_admit_cards: '/sarkari-jobs',
  govt_answer_keys: '/sarkari-jobs',
};
const buildLiveUrl = (d: any): string | null => {
  if (!d?.slug) return null;
  const prefix = TABLE_TO_PATH[d.published_table_name as string];
  if (!prefix) return null;
  return `${LIVE_SITE_ORIGIN}${prefix}/${d.slug}`;
};
import { IntakeDraftPreviewDialog } from '@/components/admin/intake/IntakeDraftPreviewDialog';
import { AiModelSelector, getLastUsedModel } from '@/components/admin/AiModelSelector';
import { useAdminMessages } from '@/hooks/useAdminMessages';
import { AdminMessageLog } from '@/components/admin/AdminMessageLog';
import {
  parseExcelWorkbook,
  parseProductionExcelWorkbook,
  detectProductionFormat,
  SECTION_BUCKET_LABELS,
  type ParseResult,
  type ParsedRow,
  type ProductionParseResult,
  type ProductionParsedRow,
  type SectionBucket,
} from './chatgptAgentExcelParser';
import { ChatGptAgentDraftEditor } from './ChatGptAgentDraftEditor';
import { ChatGptAgentDuplicateFinder } from './ChatGptAgentDuplicateFinder';
import { PipelineStepBadges, type PipelineRun } from './PipelineStepBadges';

const ALL_SECTIONS: SectionBucket[] = [
  'job_postings', 'admit_cards', 'results', 'answer_keys',
  'exam_dates', 'admissions', 'scholarships', 'other_updates',
];

const ALL_SECTIONS_VALUE = '__all__' as const;
type ActiveSection = SectionBucket | typeof ALL_SECTIONS_VALUE;

type LinkFilter = 'all' | 'with_link' | 'missing_link' | 'published';

/** Only models that the intake-ai-classify edge function can actually route */
const ALLOWED_MODELS = [
  'gemini-flash', 'gemini-pro', 'gpt5', 'gpt5-mini', 'lovable-gemini',
  'vertex-flash', 'vertex-pro', 'vertex-3.1-pro', 'vertex-3-flash', 'vertex-3.1-flash-lite',
  'nova-pro', 'nova-premier', 'mistral', 'nemotron-120b',
  'azure-gpt4o-mini', 'azure-gpt41-mini', 'azure-gpt5-mini',
  'azure-deepseek-v3', 'azure-deepseek-r1',
] as const;

export function ChatGptAgentManager() {
  const { messages, addMessage, dismissMessage, clearAll, toggleExpand } = useAdminMessages('chatgpt-agent');
  const [activeSection, setActiveSection] = useState<ActiveSection>('job_postings');
  const [drafts, setDrafts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [linkFilter, setLinkFilter] = useState<LinkFilter>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 20;
  const [aiModel, setAiModel] = useState(() => getLastUsedModel('text', 'gemini-flash', [...ALLOWED_MODELS]));

  // Upload state — supports BOTH legacy and new production format
  const [uploadOpen, setUploadOpen] = useState(false);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [productionResult, setProductionResult] = useState<ProductionParseResult | null>(null);
  const [productionPreClassify, setProductionPreClassify] = useState<{ insert: number; update: number } | null>(null);
  const [existingIdentitiesAttempted, setExistingIdentitiesAttempted] = useState<Set<string>>(new Set());
  const [productionImportSummary, setProductionImportSummary] = useState<{ total: number; inserted_new: number; updated_existing: number; skipped_empty: number; failed: { row: number; reason: string }[] } | null>(null);
  const [importing, setImporting] = useState(false);

  // Editor & dedup
  const [editDraft, setEditDraft] = useState<any>(null);
  const [previewDraftId, setPreviewDraftId] = useState<string | null>(null);
  const [dedupOpen, setDedupOpen] = useState(false);

  // AI processing
  const [aiProcessing, setAiProcessing] = useState(false);
  const [aiProgress, setAiProgress] = useState<{ action: string; current: number; total: number; batchIndex: number; totalBatches: number } | null>(null);
  const [processingChunkIds, setProcessingChunkIds] = useState<Set<string>>(new Set());

  // Pipeline state
  const [pipelineProgress, setPipelineProgress] = useState<{ draftIndex: number; totalDrafts: number; currentStep: string; stepIndex: number; draftId: string } | null>(null);
  const [draftRuns, setDraftRuns] = useState<Record<string, PipelineRun[]>>({});
  const stopRequestedRef = useRef(false);
  const [stopping, setStopping] = useState(false);

  // A draft is "AI Fixed" when latest validate run is ok and no step has latest status 'error'.
  const isAiFixed = useCallback((runs?: PipelineRun[]): boolean => {
    if (!runs || runs.length === 0) return false;
    const latest: Record<string, PipelineRun> = {};
    for (const r of runs) {
      if (!latest[r.step] || new Date(r.created_at) > new Date(latest[r.step].created_at)) {
        latest[r.step] = r;
      }
    }
    if (!latest['validate'] || latest['validate'].status !== 'ok') return false;
    return !Object.values(latest).some(r => r.status === 'error');
  }, []);

  // Section counts
  const [sectionCounts, setSectionCounts] = useState<Record<string, number>>({});

  // Search + production-format filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterPublishStatus, setFilterPublishStatus] = useState<string>('__all__');
  const [filterCategoryFamily, setFilterCategoryFamily] = useState<string>('__all__');
  const [filterUpdateType, setFilterUpdateType] = useState<string>('__all__');
  const [filterVerificationStatus, setFilterVerificationStatus] = useState<string>('__all__');
  const [filterVerificationConfidence, setFilterVerificationConfidence] = useState<string>('__all__');
  const fetchDrafts = useCallback(async () => {
    setLoading(true);
    try {
      let q = (supabase
        .from('intake_drafts')
        .select('*') as any)
        .eq('source_channel', 'chatgpt_agent');
      if (activeSection !== ALL_SECTIONS_VALUE) {
        q = q.eq('section_bucket', activeSection);
      }
      const { data, error } = await q
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .limit(activeSection === ALL_SECTIONS_VALUE ? 2000 : 500);
      if (error) throw error;
      setDrafts(data || []);
    } catch (err) {
      console.error('Fetch error:', err);
      addMessage('error', 'Failed to load drafts', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [activeSection, addMessage]);

  const fetchCounts = useCallback(async () => {
    const counts: Record<string, number> = {};
    for (const section of ALL_SECTIONS) {
      const { count } = await (supabase
        .from('intake_drafts')
        .select('id', { count: 'exact', head: true }) as any)
        .eq('source_channel', 'chatgpt_agent')
        .eq('section_bucket', section);
      counts[section] = count || 0;
    }
    setSectionCounts(counts);
  }, []);

  const fetchRunsForDrafts = useCallback(async (ids: string[]) => {
    if (ids.length === 0) return;
    try {
      const { data } = await (supabase as any)
        .from('intake_pipeline_runs')
        .select('draft_id, step, status, reason, created_at')
        .in('draft_id', ids)
        .order('created_at', { ascending: false })
        .limit(ids.length * 16);
      const map: Record<string, PipelineRun[]> = {};
      (data || []).forEach((r: any) => {
        if (!map[r.draft_id]) map[r.draft_id] = [];
        map[r.draft_id].push({ step: r.step, status: r.status, reason: r.reason, created_at: r.created_at });
      });
      setDraftRuns(prev => ({ ...prev, ...map }));
    } catch (err) {
      console.error('fetch runs error:', err);
    }
  }, []);

  useEffect(() => { fetchDrafts(); }, [fetchDrafts]);
  useEffect(() => { fetchCounts(); }, [fetchCounts]);
  useEffect(() => {
    const ids = drafts.map(d => d.id);
    if (ids.length > 0) fetchRunsForDrafts(ids);
  }, [drafts, fetchRunsForDrafts]);

  // Distinct values for filter dropdowns (built from current section's drafts)
  const distinct = useCallback((key: string): string[] => {
    const set = new Set<string>();
    for (const d of drafts) {
      const v = d?.[key];
      if (v != null && String(v).trim() !== '') set.add(String(v).trim());
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [drafts]);

  const distinctPublishStatus = useMemo(() => distinct('publish_status'), [distinct]);
  const distinctCategoryFamily = useMemo(() => distinct('category_family'), [distinct]);
  const distinctUpdateType = useMemo(() => distinct('update_type'), [distinct]);
  const distinctVerificationStatus = useMemo(() => distinct('verification_status'), [distinct]);
  const distinctVerificationConfidence = useMemo(() => distinct('verification_confidence'), [distinct]);

  const SEARCH_FIELDS = [
    'publish_title', 'normalized_title', 'organization_authority', 'organisation_name',
    'record_id', 'official_source_used', 'production_notes',
    'official_website_url', 'official_reference_url', 'primary_cta_url',
  ] as const;

  const filteredDrafts = useMemo(() => {
    let out = drafts;
    if (linkFilter === 'published') out = out.filter(d => d.processing_status === 'published');
    else if (linkFilter === 'with_link') out = out.filter(d => !!d.official_notification_link);
    else if (linkFilter === 'missing_link') out = out.filter(d => !d.official_notification_link);

    if (filterPublishStatus !== '__all__') out = out.filter(d => d.publish_status === filterPublishStatus);
    if (filterCategoryFamily !== '__all__') out = out.filter(d => d.category_family === filterCategoryFamily);
    if (filterUpdateType !== '__all__') out = out.filter(d => d.update_type === filterUpdateType);
    if (filterVerificationStatus !== '__all__') out = out.filter(d => d.verification_status === filterVerificationStatus);
    if (filterVerificationConfidence !== '__all__') out = out.filter(d => d.verification_confidence === filterVerificationConfidence);

    const q = searchQuery.trim().toLowerCase();
    if (q) {
      out = out.filter(d => SEARCH_FIELDS.some(f => {
        const v = d?.[f];
        return v != null && String(v).toLowerCase().includes(q);
      }));
    }
    return out;
  }, [
    drafts, linkFilter, searchQuery,
    filterPublishStatus, filterCategoryFamily, filterUpdateType,
    filterVerificationStatus, filterVerificationConfidence,
  ]);

  const publishedCount = useMemo(() => drafts.filter(d => d.processing_status === 'published').length, [drafts]);

  const totalPages = Math.max(1, Math.ceil(filteredDrafts.length / PAGE_SIZE));
  const paginatedDrafts = useMemo(
    () => filteredDrafts.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [filteredDrafts, currentPage],
  );

  useEffect(() => { setCurrentPage(1); }, [
    linkFilter, activeSection, drafts.length, searchQuery,
    filterPublishStatus, filterCategoryFamily, filterUpdateType,
    filterVerificationStatus, filterVerificationConfidence,
  ]);

  // ── Upload Excel ──
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const buffer = await file.arrayBuffer();

      // Format detection: try production format first (16-header signature)
      const isProduction = detectProductionFormat(buffer);

      if (isProduction) {
        const prod = await parseProductionExcelWorkbook(buffer);
        if (prod.ok !== true) {
          addMessage('error', `Production format detected but invalid`,
            `Sheet "${prod.sheetUsed ?? '?'}" — ${prod.reason} Missing headers: ${prod.missing.join(', ')}`);
          e.target.value = '';
          return;
        }
        setProductionResult(prod);
        setParseResult(null);

        // Pre-classify each row as insert vs update by checking existing import_identity values
        const identities = prod.rows.map(r => r.import_identity);
        const existing = new Set<string>();
        // paginate to avoid 1000-row default limit
        const PAGE = 1000;
        for (let i = 0; i < identities.length; i += PAGE) {
          const chunk = identities.slice(i, i + PAGE);
          const { data, error } = await (supabase
            .from('intake_drafts') as any)
            .select('import_identity')
            .eq('source_channel', 'chatgpt_agent')
            .in('import_identity', chunk);
          if (error) throw error;
          for (const row of (data || [])) existing.add(row.import_identity);
        }
        const update = prod.rows.filter(r => existing.has(r.import_identity)).length;
        const insert = prod.rows.length - update;
        setProductionPreClassify({ insert, update });
        setExistingIdentitiesAttempted(existing);
        setProductionImportSummary(null);
        setUploadOpen(true);
      } else {
        // Legacy path — unchanged
        const result = parseExcelWorkbook(buffer);
        setParseResult(result);
        setProductionResult(null);
        setProductionPreClassify(null);
        setProductionImportSummary(null);
        setUploadOpen(true);
      }
    } catch (err) {
      addMessage('error', 'Failed to parse Excel file', err instanceof Error ? err.message : 'Unknown error');
    }
    e.target.value = '';
  };

  const handleImportConfirm = async () => {
    setImporting(true);
    try {
      // ── PRODUCTION FORMAT PATH ──
      if (productionResult) {
        const rows = productionResult.rows.map((r: ProductionParsedRow) => ({
          // status stamps (verified against validate_intake_drafts_fields trigger)
          source_type: 'manual' as const,
          source_channel: 'chatgpt_agent',
          raw_file_type: 'unknown' as const,
          processing_status: 'imported' as const,
          review_status: 'pending' as const,
          primary_status: r.primary_status,
          // identity + lossless backup
          import_identity: r.import_identity,
          source_row_json: r.source_row_json as any,
          // 16 production fields
          record_id: r.record_id,
          publish_status: r.publish_status,
          category_family: r.category_family,
          update_type: r.update_type,
          organization_authority: r.organization_authority,
          publish_title: r.publish_title,
          official_website_url: r.official_website_url,
          official_reference_url: r.official_reference_url,
          primary_cta_label: r.primary_cta_label,
          primary_cta_url: r.primary_cta_url,
          secondary_official_url: r.secondary_official_url,
          verification_status: r.verification_status,
          verification_confidence: r.verification_confidence,
          official_source_used: r.official_source_used,
          source_verified_on: r.source_verified_on,
          source_verified_on_date: r.source_verified_on_date,
          production_notes: r.production_notes,
          // legacy mirrors
          raw_title: r.raw_title,
          normalized_title: r.normalized_title,
          organisation_name: r.organisation_name,
          official_notification_link: r.official_notification_link,
          structured_data_json: r.structured_data_json as any,
          section_bucket: r.section_bucket,
          content_type: r.content_type,
          publish_target: r.publish_target,
          import_source_sheet: r.import_source_sheet,
          import_row_number: r.import_row_number,
        }));

        const failed: { row: number; reason: string }[] = [];
        for (let i = 0; i < rows.length; i += 50) {
          const batch = rows.slice(i, i + 50);
          const { error } = await (supabase.from('intake_drafts') as any).upsert(batch, {
            onConflict: 'source_channel,import_identity',
            ignoreDuplicates: false,
          });
          if (error) {
            // record entire batch as failed with the first row number for diagnostics
            for (const b of batch) failed.push({ row: b.import_row_number, reason: error.message });
          }
        }
        // Reconcile counts: classify each row attempted vs failed.
        // total = inserted_new + updated_existing + skipped_empty + failed
        const wasUpdate = (r: any) => existingIdentitiesAttempted.has(r.import_identity);
        const failedIdentities = new Set(failed.map(f => f.row));
        let updated_existing_final = 0;
        let inserted_new_final = 0;
        for (const r of rows) {
          if (failedIdentities.has(r.import_row_number)) continue;
          if (wasUpdate(r)) updated_existing_final++;
          else inserted_new_final++;
        }
        const summary = {
          total: productionResult.summary.total,
          inserted_new: inserted_new_final,
          updated_existing: updated_existing_final,
          skipped_empty: productionResult.summary.skipped_empty,
          failed,
        };
        setProductionImportSummary(summary);
        // Per-upload section breakdown (this run only — never mixed with totals)
        const perBucket: Record<string, number> = {};
        for (const r of productionResult.rows) {
          const k = r.section_bucket || 'unknown';
          perBucket[k] = (perBucket[k] || 0) + 1;
        }
        const breakdown = Object.entries(perBucket)
          .sort((a, b) => b[1] - a[1])
          .map(([k, v]) => `${SECTION_BUCKET_LABELS[k as SectionBucket] || k} ${v}`)
          .join(' · ');
        addMessage(
          failed.length === 0 ? 'success' : 'warning',
          `Imported this run: ${rows.length - failed.length} of ${rows.length}`,
          `New: ${summary.inserted_new} · Updated: ${summary.updated_existing} · Skipped: ${summary.skipped_empty} · Failed: ${failed.length}\nThis upload by section → ${breakdown}`,
        );
        fetchDrafts();
        fetchCounts();
        return;
      }

      // ── LEGACY PATH ──
      if (!parseResult) return;
      const rows = parseResult.rows.map((r: ParsedRow) => ({
        source_type: 'manual' as const,
        source_channel: 'chatgpt_agent',
        raw_title: r.raw_title,
        normalized_title: r.normalized_title,
        organisation_name: r.organisation_name,
        post_name: r.post_name,
        exam_name: r.exam_name,
        official_notification_link: r.official_notification_link,
        closing_date: r.closing_date,
        opening_date: r.opening_date,
        exam_date: r.exam_date,
        result_date: r.result_date,
        admit_card_date: r.admit_card_date,
        vacancy_count: r.vacancy_count,
        qualification_text: r.qualification_text,
        age_limit_text: r.age_limit_text,
        application_mode: r.application_mode,
        review_notes: r.review_notes,
        structured_data_json: r.structured_data_json,
        section_bucket: r.section_bucket,
        content_type: r.content_type,
        publish_target: r.publish_target,
        primary_status: r.primary_status,
        import_source_sheet: r.import_source_sheet,
        import_row_number: r.import_row_number,
        processing_status: 'imported' as const,
        review_status: 'pending' as const,
        raw_file_type: 'unknown' as const,
      }));

      for (let i = 0; i < rows.length; i += 50) {
        const batch = rows.slice(i, i + 50);
        const { error } = await supabase.from('intake_drafts').insert(batch as any);
        if (error) throw error;
      }

      addMessage('success', `Imported ${rows.length} drafts`, `${parseResult.summary.needsReview} need review, ${parseResult.summary.missingLinkCount} missing links`);
      setUploadOpen(false);
      setParseResult(null);
      fetchDrafts();
      fetchCounts();
    } catch (err: any) {
      console.error('Import error:', err);
      addMessage('error', 'Import failed', err?.message || 'Unknown error');
    } finally {
      setImporting(false);
    }
  };

  // ── Publish ──
  const handlePublish = async (id: string) => {
    try {
      await supabase.from('intake_drafts').update({ review_status: 'approved' } as any).eq('id', id);
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token;
      if (!token) throw new Error('Not authenticated');

      const res = await supabase.functions.invoke('intake-publish', {
        body: { draft_id: id },
      });
      if (res.error) throw new Error(res.error.message);
      if (res.data?.error) {
        await supabase.from('intake_drafts').update({
          review_status: 'pending',
          processing_status: 'publish_failed',
          publish_error: res.data.error,
        } as any).eq('id', id);
        addMessage('error', 'Publish failed', res.data.error);
      } else {
        addMessage('success', 'Published successfully');
        fetchDrafts();
        fetchCounts();
      }
    } catch (err: any) {
      addMessage('error', 'Publish error', err?.message || 'Unknown error');
    }
  };

  // ── Unpublish (mirrors Blog "EyeOff" toggle) ──
  const handleUnpublish = async (draft: any) => {
    try {
      const table = draft.published_table_name as string | null;
      const recordId = draft.published_record_id as string | null;
      if (table && recordId) {
        // Most intake-published targets use a `status` column; set to 'draft' to hide from public.
        const { error: tErr } = await (supabase as any).from(table).update({ status: 'draft' }).eq('id', recordId);
        if (tErr) throw tErr;
      }
      const { error } = await (supabase.from('intake_drafts').update({
        processing_status: 'reviewed',
        published_at: null,
        review_status: 'pending',
      } as any) as any).eq('id', draft.id);
      if (error) throw error;
      addMessage('success', 'Unpublished', draft.normalized_title || draft.raw_title || draft.id);
      fetchDrafts();
      fetchCounts();
    } catch (err: any) {
      addMessage('error', 'Unpublish failed', err?.message || 'Unknown error');
    }
  };
  const AI_ACTIONS = [
    { label: 'Fix', action: 'fix' },
    { label: 'Enrich', action: 'enrich' },
    { label: 'SEO Fix', action: 'seo_fix' },
    { label: 'Improve Title', action: 'improve_title' },
    { label: 'Improve Summary', action: 'improve_summary' },
    { label: 'Generate Slug', action: 'generate_slug' },
    { label: 'Normalize Fields', action: 'normalize_fields' },
  ];

  const handleAiAction = async (action: string) => {
    const ids = Array.from(selected);
    if (ids.length === 0) {
      addMessage('info', 'Select drafts first');
      return;
    }
    setAiProcessing(true);
    addMessage('info', `⏳ AI ${action} started`, `Processing ${ids.length} draft(s) with model ${aiModel}…`);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      // Process drafts one-by-one to avoid edge timeouts and provide accurate per-row progress.
      const allResults: any[] = [];
      let invokeError: string | null = null;
      const totalBatches = ids.length;
      for (let i = 0; i < ids.length; i++) {
        const singleId = ids[i];
        const batchIndex = i + 1;
        setProcessingChunkIds(new Set([singleId]));
        setAiProgress({ action, current: i, total: ids.length, batchIndex, totalBatches });
        const res = await supabase.functions.invoke('intake-ai-classify', {
          body: { draft_ids: [singleId], aiModel, action },
          headers: { Authorization: `Bearer ${session?.access_token}` },
        });
        if (res.error) { invokeError = res.error.message || String(res.error); break; }
        if (res.data?.error) { invokeError = res.data.error; break; }
        allResults.push(...(res.data?.results || []));
        setAiProgress({ action, current: i + 1, total: ids.length, batchIndex, totalBatches });
      }
      if (invokeError) {
        addMessage('error', `AI ${action} failed`, invokeError);
      } else {
        const ok = allResults.filter((r: any) => r.status === 'ok').length;
        const fail = allResults.filter((r: any) => r.status === 'error').length;
        const errors = allResults.filter((r: any) => r.error).map((r: any) => `${r.id.slice(0, 8)}: ${r.error}`).join('\n');
        addMessage(
          fail > 0 ? 'warning' : 'success',
          `AI ${action}: ${ok} done, ${fail} failed`,
          errors || `All ${ok} drafts processed successfully.`
        );
      }
    } catch (err: any) {
      addMessage('error', `AI ${action} error`, err?.message || 'Unknown error');
    }
    setAiProcessing(false);
    setAiProgress(null);
    setProcessingChunkIds(new Set());
    setSelected(new Set());
    fetchDrafts();
  };

  // ── Pipeline (Run All Needed Fixes) ──
  const runFullPipeline = async (ids: string[]) => {
    if (ids.length === 0) { addMessage('info', 'Select drafts first'); return; }
    setAiProcessing(true);
    stopRequestedRef.current = false;
    setStopping(false);
    addMessage('info', `✨ Pipeline started`, `Processing ${ids.length} draft(s) sequentially with model ${aiModel}…`);

    const draftMap = new Map(drafts.map(d => [d.id, d]));
    const titleOf = (id: string) => {
      const d = draftMap.get(id);
      return (d?.normalized_title || d?.raw_title || id.slice(0, 8)) as string;
    };

    const succeeded: string[] = [];
    const failed: { id: string; title: string; step: string; error: string }[] = [];
    const skipped: { id: string; title: string }[] = [];
    let stoppedEarly = false;

    try {
      for (let i = 0; i < ids.length; i++) {
        if (stopRequestedRef.current) {
          stoppedEarly = true;
          for (let k = i; k < ids.length; k++) skipped.push({ id: ids[k], title: titleOf(ids[k]) });
          break;
        }
        const draftId = ids[i];
        setProcessingChunkIds(new Set([draftId]));
        let safety = 0;
        let lastStep = '';
        let draftFailed = false;
        while (safety++ < 10) {
          if (stopRequestedRef.current) break;
          // Refresh session before each step — long Gemini calls can expire the JWT mid-run
          const { data: { session: freshSession } } = await supabase.auth.getSession();
          // Retry-once safety net for transient transport errors (cold-start / network blip).
          // Only retries on "Failed to send a request" / "Failed to fetch" — never on in-function errors.
          let res = await supabase.functions.invoke('intake-ai-pipeline', {
            body: { draft_id: draftId, aiModel, step: 'auto' },
            headers: { Authorization: `Bearer ${freshSession?.access_token}` },
          });
          let transportRetry = false;
          {
            const errMsg = res.error?.message || '';
            const isTransport = !!res.error && /failed to (send a request|fetch)|networkerror|load failed/i.test(errMsg);
            if (isTransport) {
              transportRetry = true;
              await new Promise(r => setTimeout(r, 2000));
              res = await supabase.functions.invoke('intake-ai-pipeline', {
                body: { draft_id: draftId, aiModel, step: 'auto' },
                headers: { Authorization: `Bearer ${freshSession?.access_token}` },
              });
            }
          }
          if (res.error) {
            const errMsg = res.error.message || String(res.error);
            const label = transportRetry ? `${errMsg} (transport error, retry failed)` : errMsg;
            failed.push({ id: draftId, title: titleOf(draftId), step: lastStep || '?', error: label });
            draftFailed = true;
            break;
          }
          if (res.data?.error) {
            failed.push({ id: draftId, title: titleOf(draftId), step: res.data.ran_step || lastStep || '?', error: res.data.error });
            draftFailed = true;
            break;
          }
          lastStep = res.data?.ran_step || lastStep;
          setPipelineProgress({
            draftIndex: i + 1, totalDrafts: ids.length,
            currentStep: lastStep, stepIndex: safety, draftId,
          });
          if (!res.data?.next_step) break;
        }
        if (stopRequestedRef.current && !draftFailed && !succeeded.includes(draftId)) {
          // current draft was interrupted between steps — count as skipped (partial)
          skipped.push({ id: draftId, title: titleOf(draftId) });
          stoppedEarly = true;
          await fetchRunsForDrafts([draftId]);
          for (let k = i + 1; k < ids.length; k++) skipped.push({ id: ids[k], title: titleOf(ids[k]) });
          break;
        }
        if (!draftFailed) succeeded.push(draftId);
        await fetchRunsForDrafts([draftId]);
      }

      // Final summary
      const total = ids.length;
      const okCount = succeeded.length;
      const failCount = failed.length;
      const skipCount = skipped.length;
      const fmtList = (items: string[], max = 8) =>
        items.slice(0, max).map(s => `• ${s}`).join('\n') +
        (items.length > max ? `\n… and ${items.length - max} more` : '');
      const failLines = failed.map(f => `• ${f.title}: ${f.step} — ${f.error}`);
      const skipLines = skipped.map(s => `• ${s.title}`);
      const descParts: string[] = [];
      if (failLines.length) descParts.push(`Failed:\n${fmtList(failLines)}`);
      if (skipLines.length) descParts.push(`Skipped:\n${fmtList(skipLines)}`);
      if (!descParts.length) descParts.push(`All ${okCount} draft(s) processed successfully.`);
      const type = failCount > 0 ? 'error' : (stoppedEarly ? 'warning' : 'success');
      const titleIcon = stoppedEarly ? '⏹ Pipeline stopped' : 'Pipeline finished';
      addMessage(
        type,
        `${titleIcon} — ✅ ${okCount} succeeded · ❌ ${failCount} failed · ⏭ ${skipCount} skipped (of ${total})`,
        descParts.join('\n\n'),
      );
    } catch (err: any) {
      addMessage('error', 'Pipeline error', err?.message || 'Unknown error');
    }
    setAiProcessing(false);
    setPipelineProgress(null);
    setProcessingChunkIds(new Set());
    stopRequestedRef.current = false;
    setStopping(false);
    setSelected(new Set());
    fetchDrafts();
  };

  // ── Selection ──
  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === filteredDrafts.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filteredDrafts.map(d => d.id)));
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    addMessage('info', 'Copied to clipboard');
  };

  const truncateUrl = (url: string, maxLen = 40) => {
    if (url.length <= maxLen) return url;
    return url.slice(0, maxLen) + '…';
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center gap-3">
            <CardTitle className="text-lg">ChatGPT Agent</CardTitle>
            <div className="flex-1" />

            {/* Upload */}
            <label>
              <input type="file" accept=".xlsx,.xls" onChange={handleFileSelect} className="hidden" />
              <Button variant="outline" size="sm" asChild>
                <span><Upload className="h-4 w-4 mr-1" />Upload Excel</span>
              </Button>
            </label>

            {/* AI Model — restricted to routable models only */}
            <AiModelSelector
              value={aiModel}
              onValueChange={setAiModel}
              capability="text"
              size="sm"
              allowedValues={[...ALLOWED_MODELS]}
            />

            {/* Primary: Run All Needed Fixes (sequential per-draft pipeline) */}
            <Button
              size="sm"
              disabled={selected.size === 0 || aiProcessing}
              onClick={() => runFullPipeline(Array.from(selected))}
              className="gap-1"
            >
              {aiProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
              Run All Needed Fixes{selected.size > 0 ? ` (${selected.size})` : ''}
            </Button>

            {/* Stop button — visible only while pipeline is running */}
            {aiProcessing && pipelineProgress && (
              <Button
                size="sm"
                variant="destructive"
                disabled={stopping}
                onClick={() => { stopRequestedRef.current = true; setStopping(true); }}
                className="gap-1"
                title="Finish current step, then stop"
              >
                {stopping ? <Loader2 className="h-4 w-4 animate-spin" /> : <StopCircle className="h-4 w-4" />}
                {stopping ? 'Stopping…' : 'Stop'}
              </Button>
            )}

            {/* Advanced (manual) — legacy single-action dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" disabled={selected.size === 0 || aiProcessing}>
                  {aiProcessing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Sparkles className="h-4 w-4 mr-1" />}
                  Advanced (manual) <ChevronDown className="h-3 w-3 ml-1" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {AI_ACTIONS.map(a => (
                  <DropdownMenuItem key={a.action} onSelect={() => handleAiAction(a.action)}>
                    {a.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Duplicate Finder */}
            <Button variant="outline" size="sm" onClick={() => setDedupOpen(true)}>
              <Search className="h-4 w-4 mr-1" />Find Duplicates
            </Button>

            <Button variant="ghost" size="icon" onClick={() => { fetchDrafts(); fetchCounts(); }}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          {/* Persistent Admin Messages */}
          <AdminMessageLog
            messages={messages}
            onDismiss={dismissMessage}
            onClearAll={clearAll}
            onToggleExpand={toggleExpand}
          />

          {/* Pipeline Progress Banner (Run All Needed Fixes) */}
          {aiProcessing && pipelineProgress && (
            <div className="mb-4 p-3 rounded-md border border-l-4 border-l-primary bg-primary/5">
              <div className="flex items-center gap-2.5 mb-2">
                <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">
                    Pipeline · Draft {pipelineProgress.draftIndex} of {pipelineProgress.totalDrafts}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Step {pipelineProgress.stepIndex} of 8: <span className="font-mono">{pipelineProgress.currentStep}</span> · Model: {aiModel}
                  </p>
                </div>
                <span className="text-xs font-medium text-primary shrink-0">
                  {Math.round((pipelineProgress.draftIndex / pipelineProgress.totalDrafts) * 100)}%
                </span>
              </div>
              <Progress value={(pipelineProgress.draftIndex / pipelineProgress.totalDrafts) * 100} className="h-1.5" />
            </div>
          )}

          {/* AI Processing Banner (legacy single-action) */}
          {aiProcessing && aiProgress && !pipelineProgress && (
            <div className="mb-4 p-3 rounded-md border border-l-4 border-l-blue-500 bg-blue-50 dark:bg-blue-950/30">
              <div className="flex items-center gap-2.5 mb-2">
                <Loader2 className="h-4 w-4 animate-spin text-blue-600 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">
                    AI {aiProgress.action} in progress
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Batch {aiProgress.batchIndex} of {aiProgress.totalBatches} · Processing {aiProgress.current} of {aiProgress.total} drafts · Model: {aiModel}
                  </p>
                </div>
                <span className="text-xs font-medium text-blue-600 shrink-0">
                  {Math.round((aiProgress.current / aiProgress.total) * 100)}%
                </span>
              </div>
              <Progress value={(aiProgress.current / aiProgress.total) * 100} className="h-1.5" />
            </div>
          )}

          {/* Section Tabs */}
          <Tabs value={activeSection} onValueChange={v => { setActiveSection(v as ActiveSection); setSelected(new Set()); setLinkFilter('all'); }}>
            <TabsList className="flex flex-wrap !h-auto gap-1 p-2 mb-3">
              <TabsTrigger value={ALL_SECTIONS_VALUE} className="text-xs gap-1.5">
                All Sections
                <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4">
                  {Object.values(sectionCounts).reduce((a, b) => a + (b || 0), 0)}
                </Badge>
              </TabsTrigger>
              {ALL_SECTIONS.map(s => (
                <TabsTrigger key={s} value={s} className="text-xs gap-1.5">
                  {SECTION_BUCKET_LABELS[s]}
                  {(sectionCounts[s] || 0) > 0 && (
                    <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4">{sectionCounts[s]}</Badge>
                  )}
                </TabsTrigger>
              ))}
            </TabsList>

            {/* Scope clarity (All Sections only) */}
            {activeSection === ALL_SECTIONS_VALUE && (
              <div className="mb-3 px-3 py-2 rounded-md border bg-muted/40 text-xs">
                <div className="text-foreground font-medium">
                  Viewing all ChatGPT Agent drafts: {Object.values(sectionCounts).reduce((a, b) => a + (b || 0), 0)} total
                </div>
                {filteredDrafts.length !== drafts.length && (
                  <div className="text-muted-foreground mt-0.5">
                    {filteredDrafts.length} visible after filters
                  </div>
                )}
              </div>
            )}

            {/* Search box (production fields) */}
            <div className="mb-3">
              <div className="relative">
                <Search className="h-4 w-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                <Input
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search title, organization, record ID, source, notes, URL…"
                  className="pl-8 h-8 text-sm"
                />
              </div>
            </div>

            {/* Production-format filter row (5 dropdowns) */}
            <div className="flex flex-wrap gap-2 mb-3">
              {[
                { label: 'Publish Status', value: filterPublishStatus, onChange: setFilterPublishStatus, options: distinctPublishStatus },
                { label: 'Category Family', value: filterCategoryFamily, onChange: setFilterCategoryFamily, options: distinctCategoryFamily },
                { label: 'Update Type', value: filterUpdateType, onChange: setFilterUpdateType, options: distinctUpdateType },
                { label: 'Verification Status', value: filterVerificationStatus, onChange: setFilterVerificationStatus, options: distinctVerificationStatus },
                { label: 'Verification Confidence', value: filterVerificationConfidence, onChange: setFilterVerificationConfidence, options: distinctVerificationConfidence },
              ].map(f => (
                <Select key={f.label} value={f.value} onValueChange={f.onChange}>
                  <SelectTrigger className="h-7 text-xs w-auto min-w-[160px]">
                    <SelectValue placeholder={f.label} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">{f.label}: All</SelectItem>
                    {f.options.map(opt => (
                      <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ))}
              {(searchQuery || filterPublishStatus !== '__all__' || filterCategoryFamily !== '__all__' ||
                filterUpdateType !== '__all__' || filterVerificationStatus !== '__all__' ||
                filterVerificationConfidence !== '__all__') && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs"
                  onClick={() => {
                    setSearchQuery('');
                    setFilterPublishStatus('__all__');
                    setFilterCategoryFamily('__all__');
                    setFilterUpdateType('__all__');
                    setFilterVerificationStatus('__all__');
                    setFilterVerificationConfidence('__all__');
                  }}
                >
                  Clear filters
                </Button>
              )}
            </div>

            {/* Link filter */}
            <div className="flex gap-2 mb-3">
              <Button size="sm" variant={linkFilter === 'all' ? 'default' : 'ghost'} onClick={() => setLinkFilter('all')} className="text-xs h-7">
                All ({drafts.length})
              </Button>
              <Button size="sm" variant={linkFilter === 'with_link' ? 'default' : 'ghost'} onClick={() => setLinkFilter('with_link')} className="text-xs h-7">
                <Link2 className="h-3 w-3 mr-1" />With Link ({drafts.filter(d => d.official_notification_link).length})
              </Button>
              <Button size="sm" variant={linkFilter === 'missing_link' ? 'default' : 'ghost'} onClick={() => setLinkFilter('missing_link')} className="text-xs h-7">
                <Link2Off className="h-3 w-3 mr-1" />Missing Link ({drafts.filter(d => !d.official_notification_link).length})
              </Button>
              <Button size="sm" variant={linkFilter === 'published' ? 'default' : 'ghost'} onClick={() => setLinkFilter('published')} className="text-xs h-7">
                <ExternalLink className="h-3 w-3 mr-1" />Published ({publishedCount})
              </Button>
              {selected.size > 0 && (
                <Badge variant="outline" className="ml-auto">{selected.size} selected</Badge>
              )}
            </div>

            {/* Select-all-visible labeled control */}
            <div className="flex items-center gap-2 mb-2">
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                onClick={toggleSelectAll}
                disabled={filteredDrafts.length === 0}
              >
                {selected.size === filteredDrafts.length && filteredDrafts.length > 0
                  ? `Clear selection (${selected.size})`
                  : `Select all visible (${filteredDrafts.length})`}
              </Button>
              {activeSection === ALL_SECTIONS_VALUE && (
                <span className="text-[11px] text-muted-foreground">
                  Across all sections
                </span>
              )}
            </div>

            {/* Shared table content for all tabs */}
            {[ALL_SECTIONS_VALUE, ...ALL_SECTIONS].map(s => (
              <TabsContent key={s} value={s} className="mt-0">
                {loading ? (
                  <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
                ) : filteredDrafts.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground text-sm">
                    {s === ALL_SECTIONS_VALUE ? 'No drafts' : `No drafts in ${SECTION_BUCKET_LABELS[s as SectionBucket]}`}
                    {linkFilter !== 'all' && ' (try changing filter)'}
                  </div>
                ) : (
                  <div className="border rounded-lg overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-10">
                              <Checkbox checked={selected.size === filteredDrafts.length && filteredDrafts.length > 0} onCheckedChange={toggleSelectAll} />
                            </TableHead>
                            {s === ALL_SECTIONS_VALUE && <TableHead>Section</TableHead>}
                            <TableHead className="min-w-[220px]">Publish Title</TableHead>
                            <TableHead className="min-w-[160px]">Org / Board / Authority</TableHead>
                            <TableHead>Category Family</TableHead>
                            <TableHead>Update Type</TableHead>
                            <TableHead>Verification Status</TableHead>
                            <TableHead>Verification Confidence</TableHead>
                            <TableHead>Source Verified On</TableHead>
                            <TableHead className="min-w-[160px]">Primary CTA</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="min-w-[180px]">Official Link</TableHead>
                            <TableHead>Last Date</TableHead>
                            <TableHead>Priority</TableHead>
                            <TableHead className="w-20">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {paginatedDrafts.map(d => {
                            const sd = d.structured_data_json as any || {};
                            return (
                              <TableRow
                                key={d.id}
                                className="cursor-pointer hover:bg-muted/50"
                                onClick={() => setEditDraft(d)}
                              >
                                <TableCell onClick={e => e.stopPropagation()}>
                                  <Checkbox checked={selected.has(d.id)} onCheckedChange={() => toggleSelect(d.id)} />
                                </TableCell>
                                {s === ALL_SECTIONS_VALUE && (
                                  <TableCell className="text-xs">
                                    <Badge variant="outline" className="text-[10px]">
                                      {SECTION_BUCKET_LABELS[d.section_bucket as SectionBucket] || d.section_bucket || '—'}
                                    </Badge>
                                  </TableCell>
                                )}
                                <TableCell>
                                  <div className="flex items-start gap-1.5 flex-wrap">
                                    <span className="text-sm font-medium line-clamp-2">{d.publish_title || d.normalized_title || d.raw_title}</span>
                                    {isAiFixed(draftRuns[d.id]) && (
                                      <Badge variant="outline" className="text-[10px] gap-1 border-green-500 text-green-700 bg-green-50 dark:bg-green-950/30 dark:text-green-400 shrink-0">
                                        <Sparkles className="h-2.5 w-2.5" />
                                        AI Fixed
                                      </Badge>
                                    )}
                                    {processingChunkIds.has(d.id) && (
                                      <Badge variant="outline" className="text-[10px] gap-1 border-blue-500 text-blue-600 shrink-0">
                                        <Loader2 className="h-2.5 w-2.5 animate-spin" />
                                        Processing…
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="mt-1">
                                    <PipelineStepBadges
                                      runs={draftRuns[d.id] || []}
                                      currentStep={pipelineProgress?.draftId === d.id ? pipelineProgress.currentStep : null}
                                      isProcessing={pipelineProgress?.draftId === d.id}
                                    />
                                  </div>
                                </TableCell>
                                <TableCell className="text-xs text-muted-foreground">{d.organization_authority || d.organisation_name || '—'}</TableCell>
                                <TableCell className="text-xs">{d.category_family || '—'}</TableCell>
                                <TableCell className="text-xs">{d.update_type || '—'}</TableCell>
                                <TableCell className="text-xs">
                                  {d.verification_status ? (
                                    <Badge variant="outline" className="text-[10px]">{d.verification_status}</Badge>
                                  ) : '—'}
                                </TableCell>
                                <TableCell className="text-xs">{d.verification_confidence || '—'}</TableCell>
                                <TableCell className="text-xs whitespace-nowrap">{d.source_verified_on_date || d.source_verified_on || '—'}</TableCell>
                                <TableCell onClick={e => e.stopPropagation()}>
                                  {d.primary_cta_url ? (
                                    <a
                                      href={d.primary_cta_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                                      title={d.primary_cta_url}
                                    >
                                      {d.primary_cta_label || 'Open'}
                                      <ExternalLink className="h-3 w-3" />
                                    </a>
                                  ) : (d.primary_cta_label || '—')}
                                </TableCell>
                                <TableCell>
                                  <Badge variant={
                                    d.processing_status === 'published' ? 'default' :
                                    d.primary_status === 'manual_check' ? 'secondary' :
                                    d.processing_status === 'publish_failed' ? 'destructive' : 'outline'
                                  } className="text-[10px]">
                                    {d.processing_status === 'published' ? 'Published' :
                                     d.processing_status === 'publish_failed' ? 'Failed' :
                                     d.primary_status === 'manual_check' ? 'Review' : d.primary_status || 'Draft'}
                                  </Badge>
                                </TableCell>
                                <TableCell onClick={e => e.stopPropagation()}>
                                  {d.official_notification_link ? (
                                    <div className="flex items-center gap-1">
                                      <a
                                        href={d.official_notification_link}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-xs text-primary hover:underline truncate max-w-[150px]"
                                        title={d.official_notification_link}
                                      >
                                        {truncateUrl(d.official_notification_link)}
                                      </a>
                                      <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => copyToClipboard(d.official_notification_link)}>
                                        <Copy className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  ) : (
                                    <Badge variant="destructive" className="text-[10px]">
                                      <AlertTriangle className="h-3 w-3 mr-1" />Missing
                                    </Badge>
                                  )}
                                </TableCell>
                                <TableCell className="text-xs">{d.closing_date || '—'}</TableCell>
                                <TableCell>
                                  {sd.priority ? (
                                    <Badge variant="outline" className="text-[10px]">{sd.priority}</Badge>
                                  ) : '—'}
                                </TableCell>
                                <TableCell onClick={e => e.stopPropagation()}>
                                  <div className="flex items-center gap-0.5">
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-7 w-7 p-0"
                                      title="Preview"
                                      onClick={() => setPreviewDraftId(d.id)}
                                    >
                                      <Eye className="h-3.5 w-3.5" />
                                    </Button>
                                    {d.processing_status === 'published' && buildLiveUrl(d) && (
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-7 w-7 p-0"
                                        title="Open live page"
                                        onClick={() => window.open(buildLiveUrl(d)!, '_blank', 'noopener,noreferrer')}
                                      >
                                        <ExternalLink className="h-3.5 w-3.5 text-primary" />
                                      </Button>
                                    )}
                                    {d.processing_status === 'published' ? (
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-7 w-7 p-0"
                                        title="Unpublish"
                                        onClick={() => handleUnpublish(d)}
                                      >
                                        <EyeOff className="h-3.5 w-3.5" />
                                      </Button>
                                    ) : (
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-7 w-7 p-0"
                                        title="Publish"
                                        onClick={() => handlePublish(d.id)}
                                      >
                                        <Send className="h-3.5 w-3.5" />
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
                )}
                {!loading && filteredDrafts.length > PAGE_SIZE && (
                  <div className="flex items-center justify-between mt-3 px-1">
                    <div className="text-xs text-muted-foreground">
                      Showing {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filteredDrafts.length)} of {filteredDrafts.length}
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        disabled={currentPage === 1}
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      >
                        Previous
                      </Button>
                      {Array.from({ length: totalPages }, (_, i) => i + 1)
                        .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                        .reduce<(number | 'ellipsis')[]>((acc, p, idx, arr) => {
                          if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push('ellipsis');
                          acc.push(p);
                          return acc;
                        }, [])
                        .map((p, idx) =>
                          p === 'ellipsis' ? (
                            <span key={`e-${idx}`} className="px-1 text-xs text-muted-foreground">…</span>
                          ) : (
                            <Button
                              key={p}
                              size="sm"
                              variant={p === currentPage ? 'default' : 'ghost'}
                              className="h-7 w-7 p-0 text-xs"
                              onClick={() => setCurrentPage(p as number)}
                            >
                              {p}
                            </Button>
                          ),
                        )}
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        disabled={currentPage === totalPages}
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>

      {/* Upload Preview Dialog — handles BOTH legacy and production formats */}
      <Dialog open={uploadOpen} onOpenChange={v => {
        if (!v) {
          setUploadOpen(false);
          setParseResult(null);
          setProductionResult(null);
          setProductionPreClassify(null);
          setProductionImportSummary(null);
        }
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {productionResult ? 'Import Preview — Production Format (16-column)' : 'Import Preview'}
            </DialogTitle>
          </DialogHeader>

          {/* ── PRODUCTION FORMAT PREVIEW ── */}
          {productionResult && !productionImportSummary && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div className="text-muted-foreground">Sheet used</div>
                <div className="font-medium font-mono text-xs">{productionResult.sheetUsed}</div>
                <div className="text-muted-foreground">Total rows scanned</div>
                <div>{productionResult.summary.total}</div>
                <div className="text-muted-foreground">To import</div>
                <div className="font-medium text-primary">{productionResult.summary.parsed}</div>
                <div className="text-muted-foreground">Skipped (empty rows)</div>
                <div>{productionResult.summary.skipped_empty}</div>
                {productionPreClassify && (
                  <>
                    <div className="text-muted-foreground">→ New (insert)</div>
                    <div className="font-medium text-primary">{productionPreClassify.insert}</div>
                    <div className="text-muted-foreground">→ Updates (existing)</div>
                    <div>{productionPreClassify.update}</div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* ── PRODUCTION FORMAT POST-IMPORT SUMMARY ── */}
          {productionImportSummary && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div className="text-muted-foreground">Total rows</div>
                <div>{productionImportSummary.total}</div>
                <div className="text-muted-foreground">Inserted (new)</div>
                <div className="font-medium text-primary">{productionImportSummary.inserted_new}</div>
                <div className="text-muted-foreground">Updated (existing)</div>
                <div>{productionImportSummary.updated_existing}</div>
                <div className="text-muted-foreground">Skipped empty</div>
                <div>{productionImportSummary.skipped_empty}</div>
                <div className="text-muted-foreground">Failed</div>
                <div className={productionImportSummary.failed.length > 0 ? 'text-destructive font-medium' : ''}>
                  {productionImportSummary.failed.length}
                </div>
              </div>
              {productionImportSummary.failed.length > 0 && (
                <div className="border-t pt-2 max-h-48 overflow-y-auto">
                  <p className="font-medium mb-1 text-xs text-destructive">Failed rows</p>
                  {productionImportSummary.failed.map((f, idx) => (
                    <div key={idx} className="text-xs flex gap-2">
                      <span className="text-muted-foreground font-mono shrink-0">Row {f.row}:</span>
                      <span className="break-all">{f.reason}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── LEGACY FORMAT PREVIEW ── */}
          {parseResult && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div className="text-muted-foreground">Sheets detected</div>
                <div>{parseResult.summary.sheetsDetected.join(', ')}</div>
                <div className="text-muted-foreground">Sheets used</div>
                <div className="font-medium">{parseResult.summary.sheetsUsed.join(', ') || 'None'}</div>
                <div className="text-muted-foreground">Sheets skipped</div>
                <div>{parseResult.summary.sheetsSkipped.join(', ') || 'None'}</div>
                <div className="text-muted-foreground">Total rows found</div>
                <div>{parseResult.summary.total}</div>
                <div className="text-muted-foreground">To import</div>
                <div className="font-medium text-primary">{parseResult.summary.imported}</div>
                <div className="text-muted-foreground">Skipped (invalid)</div>
                <div>{parseResult.summary.skipped}</div>
                <div className="text-muted-foreground">Duplicate skipped</div>
                <div>{parseResult.summary.duplicateSkipped}</div>
                <div className="text-muted-foreground">Needs review</div>
                <div className="text-amber-600">{parseResult.summary.needsReview}</div>
                <div className="text-muted-foreground">Missing official link</div>
                <div className="text-destructive">{parseResult.summary.missingLinkCount}</div>
              </div>
              {Object.keys(parseResult.summary.perSection).length > 0 && (
                <div className="border-t pt-2">
                  <p className="font-medium mb-1">Per Section</p>
                  {Object.entries(parseResult.summary.perSection).map(([k, v]) => (
                    <div key={k} className="flex justify-between text-xs">
                      <span>{SECTION_BUCKET_LABELS[k as SectionBucket] || k}</span>
                      <span className="font-medium">{v}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setUploadOpen(false);
              setParseResult(null);
              setProductionResult(null);
              setProductionPreClassify(null);
              setProductionImportSummary(null);
            }}>
              {productionImportSummary ? 'Close' : 'Cancel'}
            </Button>
            {!productionImportSummary && (
              <Button onClick={handleImportConfirm} disabled={importing || (!parseResult?.summary.imported && !productionResult?.summary.parsed)}>
                {importing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                Import {productionResult?.summary.parsed ?? parseResult?.summary.imported ?? 0} Rows
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Draft Editor */}
      {editDraft && (
        <ChatGptAgentDraftEditor
          draft={editDraft}
          onClose={() => setEditDraft(null)}
          onSaved={() => { setEditDraft(null); fetchDrafts(); fetchCounts(); }}
          onPublish={handlePublish}
        />
      )}

      {/* Per-row Preview */}
      <IntakeDraftPreviewDialog
        draftId={previewDraftId}
        open={!!previewDraftId}
        onClose={() => setPreviewDraftId(null)}
      />

      {/* Duplicate Finder */}
      <ChatGptAgentDuplicateFinder
        open={dedupOpen}
        onClose={() => setDedupOpen(false)}
        drafts={drafts}
        sectionLabel={SECTION_BUCKET_LABELS[activeSection]}
        onDeleted={() => { fetchDrafts(); fetchCounts(); }}
      />
    </div>
  );
}
