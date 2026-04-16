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

import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import {
  Upload, Search, Sparkles, Loader2, Copy, ChevronDown,
  Send, AlertTriangle, Link2Off, Link2, RefreshCw, Wand2, StopCircle, CheckCircle2,
} from 'lucide-react';
import { AiModelSelector, getLastUsedModel } from '@/components/admin/AiModelSelector';
import { useAdminMessages } from '@/hooks/useAdminMessages';
import { AdminMessageLog } from '@/components/admin/AdminMessageLog';
import { parseExcelWorkbook, SECTION_BUCKET_LABELS, type ParseResult, type ParsedRow, type SectionBucket } from './chatgptAgentExcelParser';
import { ChatGptAgentDraftEditor } from './ChatGptAgentDraftEditor';
import { ChatGptAgentDuplicateFinder } from './ChatGptAgentDuplicateFinder';
import { PipelineStepBadges, type PipelineRun } from './PipelineStepBadges';

const ALL_SECTIONS: SectionBucket[] = [
  'job_postings', 'admit_cards', 'results', 'answer_keys',
  'exam_dates', 'admissions', 'scholarships', 'other_updates',
];

type LinkFilter = 'all' | 'with_link' | 'missing_link';

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
  const [activeSection, setActiveSection] = useState<SectionBucket>('job_postings');
  const [drafts, setDrafts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [linkFilter, setLinkFilter] = useState<LinkFilter>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 20;
  const [aiModel, setAiModel] = useState(() => getLastUsedModel('text', 'gemini-flash', [...ALLOWED_MODELS]));

  // Upload state
  const [uploadOpen, setUploadOpen] = useState(false);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [importing, setImporting] = useState(false);

  // Editor & dedup
  const [editDraft, setEditDraft] = useState<any>(null);
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

  const fetchDrafts = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await (supabase
        .from('intake_drafts')
        .select('*') as any)
        .eq('source_channel', 'chatgpt_agent')
        .eq('section_bucket', activeSection)
        .order('created_at', { ascending: false })
        .limit(500);
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

  const filteredDrafts = useMemo(() => {
    if (linkFilter === 'all') return drafts;
    return drafts.filter(d =>
      linkFilter === 'with_link' ? !!d.official_notification_link : !d.official_notification_link
    );
  }, [drafts, linkFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredDrafts.length / PAGE_SIZE));
  const paginatedDrafts = useMemo(
    () => filteredDrafts.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [filteredDrafts, currentPage],
  );

  useEffect(() => { setCurrentPage(1); }, [linkFilter, activeSection, drafts.length]);

  // ── Upload Excel ──
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const buffer = await file.arrayBuffer();
      const result = parseExcelWorkbook(buffer);
      setParseResult(result);
      setUploadOpen(true);
    } catch (err) {
      addMessage('error', 'Failed to parse Excel file', err instanceof Error ? err.message : 'Unknown error');
    }
    e.target.value = '';
  };

  const handleImportConfirm = async () => {
    if (!parseResult) return;
    setImporting(true);
    try {
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

  // ── AI Actions ──
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
      const { data: { session } } = await supabase.auth.getSession();
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
          const res = await supabase.functions.invoke('intake-ai-pipeline', {
            body: { draft_id: draftId, aiModel, step: 'auto' },
            headers: { Authorization: `Bearer ${session?.access_token}` },
          });
          if (res.error) {
            failed.push({ id: draftId, title: titleOf(draftId), step: lastStep || '?', error: res.error.message || String(res.error) });
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
          <Tabs value={activeSection} onValueChange={v => { setActiveSection(v as SectionBucket); setSelected(new Set()); setLinkFilter('all'); }}>
            <TabsList className="flex flex-wrap !h-auto gap-1 p-2 mb-3">
              {ALL_SECTIONS.map(s => (
                <TabsTrigger key={s} value={s} className="text-xs gap-1.5">
                  {SECTION_BUCKET_LABELS[s]}
                  {(sectionCounts[s] || 0) > 0 && (
                    <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4">{sectionCounts[s]}</Badge>
                  )}
                </TabsTrigger>
              ))}
            </TabsList>

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
              {selected.size > 0 && (
                <Badge variant="outline" className="ml-auto">{selected.size} selected</Badge>
              )}
            </div>

            {/* Shared table content for all tabs */}
            {ALL_SECTIONS.map(s => (
              <TabsContent key={s} value={s} className="mt-0">
                {loading ? (
                  <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
                ) : filteredDrafts.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground text-sm">
                    No drafts in {SECTION_BUCKET_LABELS[s]}
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
                            <TableHead className="min-w-[200px]">Title</TableHead>
                            <TableHead>Organization</TableHead>
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
                                <TableCell>
                                  <div className="flex items-start gap-1.5">
                                    <span className="text-sm font-medium line-clamp-2">{d.normalized_title || d.raw_title}</span>
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
                                <TableCell className="text-xs text-muted-foreground">{d.organisation_name || '—'}</TableCell>
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
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 text-xs"
                                    disabled={d.processing_status === 'published'}
                                    onClick={() => handlePublish(d.id)}
                                  >
                                    <Send className="h-3 w-3" />
                                  </Button>
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

      {/* Upload Preview Dialog */}
      <Dialog open={uploadOpen} onOpenChange={v => { if (!v) { setUploadOpen(false); setParseResult(null); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Import Preview</DialogTitle>
          </DialogHeader>
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
            <Button variant="outline" onClick={() => { setUploadOpen(false); setParseResult(null); }}>Cancel</Button>
            <Button onClick={handleImportConfirm} disabled={importing || !parseResult?.summary.imported}>
              {importing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Import {parseResult?.summary.imported || 0} Rows
            </Button>
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
