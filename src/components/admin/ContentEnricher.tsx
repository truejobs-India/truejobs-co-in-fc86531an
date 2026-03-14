import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { useAdminToast as useToast, useAdminMessagesContext } from '@/contexts/AdminMessagesContext';
import { AdminMessageLog } from '@/components/admin/AdminMessageLog';
import { supabase } from '@/integrations/supabase/client';
import { getAllExamAuthoritySlugs, getExamAuthorityConfig } from '@/data/examAuthority';
import { getAllPYPSlugs, getPYPConfig } from '@/data/previousYearPapers/types';
import { getAllStateGovtSlugs, getStateGovtJobConfig } from '@/pages/seo/stateGovtJobsData';
import { Loader2, CheckCircle, AlertTriangle, XCircle, Sparkles, Eye, Upload, Undo2, History, Clock, X, Info } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

type PageFamily = 'notification' | 'syllabus' | 'exam-pattern' | 'pyp' | 'state';

interface PageHealthRow {
  slug: string;
  name: string;
  wordCount: number;
  sectionCount: number;
  healthColor: 'green' | 'yellow' | 'red';
  enrichmentStatus?: string;
  publishedVersion?: number | null;
}

interface EnrichmentResult {
  slug: string;
  status: string;
  sectionsAdded: string[];
  qualityScore: Record<string, number>;
  flags: string[];
  totalWords: number;
  failureReason?: string;
}

interface EnrichmentDraft {
  id: string;
  page_slug: string;
  enrichment_data: Record<string, unknown>;
  status: string;
  sections_added: string[];
  quality_score: Record<string, number>;
  flags: string[];
  version: number;
  published_at: string | null;
  approved_at: string | null;
  approved_by: string | null;
  review_notes: string | null;
  current_word_count: number;
  current_section_count: number;
  failure_reason: string | null;
}

// PersistentMessage removed — using AdminMessagesContext

function countWordsInHtml(html: string): number {
  return html.replace(/<[^>]+>/g, ' ').trim().split(/\s+/).filter(Boolean).length;
}

function countSectionsInHtml(html: string): number {
  return (html.match(/<h[23][^>]*>/gi) || []).length;
}

/** Get the actual FAQ count from static config for a slug */
function getStaticFaqCount(slug: string): number {
  const authConfig = getExamAuthorityConfig(slug);
  if (authConfig?.faqs?.length) return authConfig.faqs.length;
  const pypConfig = getPYPConfig(slug);
  if (pypConfig && 'faqs' in pypConfig) {
    const faqs = (pypConfig as unknown as Record<string, unknown>).faqs;
    if (Array.isArray(faqs)) return faqs.length;
  }
  return 0;
}

const AI_MODELS = [
  { value: 'gemini-flash', label: 'Gemini 2.5 Flash' },
  { value: 'gemini-pro', label: 'Gemini 2.5 Pro' },
  { value: 'claude-sonnet', label: 'Claude Sonnet 4.6' },
  { value: 'mistral', label: 'Mistral (Bedrock)' },
  { value: 'lovable-gemini', label: 'Lovable Gemini (Gateway)' },
  { value: 'gpt5', label: 'GPT-5 (OpenAI)' },
  { value: 'gpt5-mini', label: 'GPT-5 Mini' },
] as const;

const MODEL_BATCH_LIMITS: Record<string, number> = {
  'gemini-flash': 8,
  'gemini-pro': 5,
  'claude-sonnet': 2,
  'mistral': 4,
  'lovable-gemini': 5,
  'gpt5': 3,
  'gpt5-mini': 4,
};

function getModelBatchLimit(model: string): number {
  return MODEL_BATCH_LIMITS[model] || 3;
}

export function ContentEnricher() {
  const { toast } = useToast();
  const [family, setFamily] = useState<PageFamily>('notification');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isEnriching, setIsEnriching] = useState(false);
  const [batchReport, setBatchReport] = useState<{ results: EnrichmentResult[] } | null>(null);
  const [drafts, setDrafts] = useState<Map<string, EnrichmentDraft[]>>(new Map());
  const [previewSlug, setPreviewSlug] = useState<string | null>(null);
  const [historySlug, setHistorySlug] = useState<string | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [bgEnriching, setBgEnriching] = useState(false);
  const [bgProgress, setBgProgress] = useState<{ done: number; total: number; failed: number } | null>(null);
  const [aiModel, setAiModel] = useState<string>('gemini-flash');
  const { messages, addMessage, dismissMessage, clearAll, toggleExpand } = useAdminMessagesContext();
  const [enrichProgress, setEnrichProgress] = useState<string | null>(null);

  useEffect(() => { loadDrafts(); }, []);

  const loadDrafts = async () => {
    const { data } = await supabase
      .from('content_enrichments')
      .select('id, page_slug, enrichment_data, status, sections_added, quality_score, flags, version, published_at, approved_at, approved_by, review_notes, current_word_count, current_section_count, failure_reason')
      .order('version', { ascending: false });
    if (data) {
      const map = new Map<string, EnrichmentDraft[]>();
      (data as unknown as EnrichmentDraft[]).forEach((d) => {
        const slug = d.page_slug;
        if (!map.has(slug)) map.set(slug, []);
        map.get(slug)!.push(d);
      });
      setDrafts(map);
    }
  };

  const getLatest = (slug: string): EnrichmentDraft | undefined => drafts.get(slug)?.[0];
  const getPublished = (slug: string): EnrichmentDraft | undefined => drafts.get(slug)?.find(d => d.published_at);

  const computeHealth = (staticWords: number, staticSections: number, slug: string): 'green' | 'yellow' | 'red' => {
    const latest = getLatest(slug);
    const totalWords = staticWords + (latest?.current_word_count || 0);
    const totalSections = staticSections + (latest?.current_section_count || 0);
    return totalWords >= 1500 && totalSections >= 8 ? 'green' : totalWords >= 900 ? 'yellow' : 'red';
  };

  const pageRows = useMemo((): PageHealthRow[] => {
    const rows: PageHealthRow[] = [];

    if (family === 'state') {
      for (const slug of getAllStateGovtSlugs()) {
        const config = getStateGovtJobConfig(slug);
        if (!config) continue;
        const wc = countWordsInHtml(config.introContent);
        const sc = countSectionsInHtml(config.introContent);
        const published = getPublished(slug);
        rows.push({
          slug,
          name: config.state,
          wordCount: wc,
          sectionCount: sc,
          healthColor: computeHealth(wc, sc, slug),
          enrichmentStatus: getLatest(slug)?.status,
          publishedVersion: published?.version ?? null,
        });
      }
    } else if (family === 'pyp') {
      for (const slug of getAllPYPSlugs()) {
        const config = getPYPConfig(slug);
        if (!config) continue;
        const wc = countWordsInHtml(config.overview || '');
        const sc = countSectionsInHtml(config.overview || '');
        const published = getPublished(slug);
        rows.push({
          slug,
          name: config.examName,
          wordCount: wc,
          sectionCount: sc,
          healthColor: computeHealth(wc, sc, slug),
          enrichmentStatus: getLatest(slug)?.status,
          publishedVersion: published?.version ?? null,
        });
      }
    } else {
      const suffixMap: Record<string, string> = {
        notification: '-notification',
        syllabus: '-syllabus',
        'exam-pattern': '-exam-pattern',
      };
      const suffix = suffixMap[family] || `-${family}`;

      for (const slug of getAllExamAuthoritySlugs()) {
        if (!slug.endsWith(suffix)) continue;
        const config = getExamAuthorityConfig(slug);
        if (!config) continue;
        const overview = config.overview || '';
        const wc = countWordsInHtml(typeof overview === 'string' ? overview : '');
        let sc = 0;
        if (config.overview) sc++;
        if (config.dates?.length) sc++;
        if (config.eligibility) sc++;
        if (config.feeStructure) sc++;
        if (config.selectionProcess?.length) sc++;
        if (config.examPattern?.length) sc++;
        if (config.syllabusSummary) sc++;
        if (config.salary) sc++;
        if (config.howToApply?.length) sc++;
        if (config.faqs?.length) sc++;
        const published = getPublished(slug);
        rows.push({
          slug,
          name: config.examName || slug,
          wordCount: wc,
          sectionCount: sc,
          healthColor: computeHealth(wc, sc, slug),
          enrichmentStatus: getLatest(slug)?.status,
          publishedVersion: published?.version ?? null,
        });
      }
    }

    return rows.sort((a, b) => a.wordCount - b.wordCount);
  }, [family, drafts]);

  const toggleSelection = (slug: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug); // No upper limit — auto-batching handles it
      return next;
    });
  };

  const handleEnrichBatch = async () => {
    if (selected.size === 0) return;
    setIsEnriching(true);
    setBatchReport(null);

    const allSlugs = Array.from(selected);
    const batchLimit = getModelBatchLimit(aiModel);
    const totalBatches = Math.ceil(allSlugs.length / batchLimit);
    const allResults: EnrichmentResult[] = [];

    if (totalBatches > 1) {
      addMessage('info', `Auto-batching ${allSlugs.length} pages`,
        `${AI_MODELS.find(m => m.value === aiModel)?.label} processes ${batchLimit} pages per batch. Queued ${totalBatches} batches automatically.`);
    }

    for (let batchIdx = 0; batchIdx < totalBatches; batchIdx++) {
      const batchSlugs = allSlugs.slice(batchIdx * batchLimit, (batchIdx + 1) * batchLimit);
      const start = batchIdx * batchLimit + 1;
      const end = start + batchSlugs.length - 1;

      setEnrichProgress(`Processing batch ${batchIdx + 1} of ${totalBatches} (pages ${start}-${end})...`);

      const currentContent = batchSlugs.map(slug => {
        const row = pageRows.find(r => r.slug === slug);
        return {
          slug,
          examName: row?.name || slug,
          existingWordCount: row?.wordCount || 0,
          existingSections: [],
        };
      });

      try {
        const { data, error } = await supabase.functions.invoke('enrich-authority-pages', {
          body: { slugs: batchSlugs, pageType: family, currentContent, aiModel },
        });

        if (error) throw error;

        const batchResults: EnrichmentResult[] = data.results || [];
        allResults.push(...batchResults);

        const succeeded = batchResults.filter(r => r.status === 'success' || r.status === 'flagged').length;
        const failed = batchResults.filter(r => r.status === 'failed').length;
        const skipped = batchResults.filter(r => r.status === 'skipped').length;

        if (failed > 0 || skipped > 0) {
          addMessage('warning', `Batch ${batchIdx + 1} of ${totalBatches} — partial`,
            `${succeeded} enriched, ${failed} failed, ${skipped} skipped`);
        } else {
          addMessage('success', `Batch ${batchIdx + 1} of ${totalBatches} — complete`,
            `${succeeded} pages enriched successfully`);
        }
      } catch (err) {
        addMessage('error', `Batch ${batchIdx + 1} of ${totalBatches} — failed`,
          err instanceof Error ? err.message : 'Unknown error');
      }

      await loadDrafts();
      if (batchIdx + 1 < totalBatches) await new Promise(r => setTimeout(r, 3000));
    }

    setBatchReport({ results: allResults });
    const totalOk = allResults.filter(r => r.status === 'success' || r.status === 'flagged').length;
    const totalFail = allResults.filter(r => r.status === 'failed').length;
    const totalSkipped = allResults.filter(r => r.status === 'skipped').length;
    addMessage(totalFail > 0 || totalSkipped > 0 ? 'warning' : 'success', 'Enrichment complete',
      `${totalOk} enriched, ${totalFail} failed, ${totalSkipped} skipped out of ${allSlugs.length} pages`);
    setEnrichProgress(null);
    setIsEnriching(false);
  };

  const handleEnrichAllPending = async () => {
    const pending = pageRows.filter(r => getLatest(r.slug) === undefined);
    if (pending.length === 0) return;

    setBgEnriching(true);
    setBgProgress({ done: 0, total: pending.length, failed: 0 });
    let done = 0;
    let failed = 0;

    const batchLimit = getModelBatchLimit(aiModel);
    const totalBatches = Math.ceil(pending.length / batchLimit);

    addMessage('info', `Enriching all ${pending.length} pending pages`,
      `Using ${AI_MODELS.find(m => m.value === aiModel)?.label} — ${totalBatches} batches of up to ${batchLimit} pages each`);

    for (let i = 0; i < pending.length; i += batchLimit) {
      const batch = pending.slice(i, i + batchLimit);
      const slugs = batch.map(r => r.slug);
      const batchIdx = Math.floor(i / batchLimit) + 1;
      const currentContent = batch.map(r => ({
        slug: r.slug,
        examName: r.name || r.slug,
        existingWordCount: r.wordCount || 0,
        existingSections: [],
      }));

      setEnrichProgress(`Enriching all: batch ${batchIdx} of ${totalBatches}...`);

      try {
        const { data, error } = await supabase.functions.invoke('enrich-authority-pages', {
          body: { slugs, pageType: family, currentContent, aiModel },
        });
        if (error) throw error;
        const batchDone = (data?.pagesEnriched || 0);
        const batchFail = (data?.pagesFailed || 0);
        const batchSkip = (data?.pagesSkipped || 0);
        done += batchDone;
        failed += batchFail + batchSkip;

        if (batchFail > 0 || batchSkip > 0) {
          addMessage('warning', `Batch ${batchIdx} partial`,
            `${batchDone} enriched, ${batchFail} failed, ${batchSkip} skipped`);
        }
      } catch {
        failed += batch.length;
        addMessage('error', `Batch ${batchIdx} failed`, `All ${batch.length} pages in this batch failed`);
      }

      setBgProgress({ done: done + failed, total: pending.length, failed });
      await loadDrafts();

      if (i + batchLimit < pending.length) {
        await new Promise(r => setTimeout(r, 3000));
      }
    }

    setBgEnriching(false);
    setEnrichProgress(null);
    addMessage(failed > 0 ? 'warning' : 'success', 'All pending enrichment complete',
      `${done} enriched, ${failed} failed out of ${pending.length} pages`);
  };

  const handleApprove = async (slug: string) => {
    const { error } = await supabase
      .from('content_enrichments')
      .update({
        status: 'approved',
        approved_at: new Date().toISOString(),
        review_notes: reviewNotes || null,
        updated_at: new Date().toISOString(),
      })
      .eq('page_slug', slug)
      .eq('version', getLatest(slug)?.version ?? 1);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Enrichment approved', description: slug });
      setReviewNotes('');
      await loadDrafts();
    }
  };

  const handleReject = async (slug: string) => {
    const { error } = await supabase
      .from('content_enrichments')
      .update({
        status: 'rejected',
        review_notes: reviewNotes || null,
        updated_at: new Date().toISOString(),
      })
      .eq('page_slug', slug)
      .eq('version', getLatest(slug)?.version ?? 1);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Enrichment rejected', description: slug });
      setReviewNotes('');
      await loadDrafts();
    }
  };

  // Publish validation: combined words ≥1200, sections ≥5, FAQ ≥3 (using actual static count), no critical flags
  const canPublish = (draft: EnrichmentDraft, row?: PageHealthRow): { ok: boolean; reason?: string } => {
    if (draft.status !== 'approved') return { ok: false, reason: 'Must be approved first' };
    const combinedWords = (row?.wordCount || 0) + (draft.current_word_count || 0);
    if (combinedWords < 1200) return { ok: false, reason: `Combined words ${combinedWords} < 1200` };
    const combinedSections = (row?.sectionCount || 0) + (draft.current_section_count || 0);
    if (combinedSections < 5) return { ok: false, reason: `Combined sections ${combinedSections} < 5` };
    const enrichmentFaqCount = Array.isArray(draft.enrichment_data?.faq) ? (draft.enrichment_data.faq as unknown[]).length : 0;
    const staticFaqCount = getStaticFaqCount(draft.page_slug);
    if (enrichmentFaqCount + staticFaqCount < 3) return { ok: false, reason: `Total FAQs ${enrichmentFaqCount + staticFaqCount} < 3` };
    if (draft.flags?.includes('PARSE_ERROR')) return { ok: false, reason: 'Has PARSE_ERROR flag' };
    return { ok: true };
  };

  const handlePublish = async (slug: string, version: number) => {
    const { data, error } = await supabase.rpc('publish_enrichment_version', {
      p_page_slug: slug,
      p_version: version,
    });

    if (error) {
      toast({ title: 'Publish failed', description: error.message, variant: 'destructive' });
      return;
    }

    const result = data as unknown as { success: boolean; error?: string };
    if (!result.success) {
      toast({ title: 'Publish failed', description: result.error || 'Unknown error', variant: 'destructive' });
    } else {
      toast({ title: 'Published', description: `${slug} v${version} is now live` });
      await loadDrafts();
    }
  };

  const handleUnpublish = async (slug: string) => {
    const { data, error } = await supabase.rpc('unpublish_enrichment', {
      p_page_slug: slug,
    });

    if (error) {
      toast({ title: 'Unpublish failed', description: error.message, variant: 'destructive' });
      return;
    }

    const result = data as unknown as { success: boolean; error?: string };
    if (!result.success) {
      toast({ title: 'Unpublish failed', description: result.error || 'Unknown error', variant: 'destructive' });
    } else {
      toast({ title: 'Unpublished', description: `${slug} removed from live` });
      await loadDrafts();
    }
  };

  const healthBadge = (color: 'green' | 'yellow' | 'red') => {
    if (color === 'green') return <Badge className="bg-emerald-500/20 text-emerald-700 border-emerald-300">Healthy</Badge>;
    if (color === 'yellow') return <Badge className="bg-amber-500/20 text-amber-700 border-amber-300">Moderate</Badge>;
    return <Badge className="bg-red-500/20 text-red-700 border-red-300">Thin</Badge>;
  };

  const statusBadge = (status?: string) => {
    if (!status) return <Badge className="bg-muted text-muted-foreground border-border"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
    if (status === 'draft') return <Badge variant="outline">Draft</Badge>;
    if (status === 'approved') return <Badge className="bg-emerald-500/20 text-emerald-700">Approved</Badge>;
    if (status === 'rejected') return <Badge variant="destructive">Rejected</Badge>;
    if (status === 'failed') return <Badge className="bg-red-500/20 text-red-700 border-red-300"><XCircle className="h-3 w-3 mr-1" />Failed</Badge>;
    return <Badge variant="outline">{status}</Badge>;
  };

  const batchLimit = getModelBatchLimit(aiModel);
  const selectedModelLabel = AI_MODELS.find(m => m.value === aiModel)?.label || aiModel;
  const previewDrafts = previewSlug ? drafts.get(previewSlug) : null;
  const previewDraft = previewDrafts?.[0] ?? null;
  const historyVersions = historySlug ? drafts.get(historySlug) : null;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Content Enrichment
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-4">
            <Select value={family} onValueChange={(v) => { setFamily(v as PageFamily); setSelected(new Set()); }}>
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="notification">Notification</SelectItem>
                <SelectItem value="syllabus">Syllabus</SelectItem>
                <SelectItem value="exam-pattern">Exam Pattern</SelectItem>
                <SelectItem value="pyp">Previous Year Papers</SelectItem>
                <SelectItem value="state">State Govt Jobs</SelectItem>
              </SelectContent>
            </Select>

            <Select value={aiModel} onValueChange={setAiModel}>
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="AI Model" />
              </SelectTrigger>
              <SelectContent>
                {AI_MODELS.map(m => (
                  <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button onClick={handleEnrichBatch} disabled={selected.size === 0 || isEnriching || bgEnriching}>
              {isEnriching ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
              Enrich {selected.size} page{selected.size !== 1 ? 's' : ''}
            </Button>

            <Button
              variant="outline"
              disabled={isEnriching || bgEnriching}
              onClick={() => {
                const pending = pageRows.filter(r => getLatest(r.slug) === undefined);
                setSelected(new Set(pending.map(r => r.slug)));
              }}
            >
              Select All Pending
            </Button>

            <Button
              variant="secondary"
              disabled={(() => {
                const pending = pageRows.filter(r => getLatest(r.slug) === undefined);
                return pending.length === 0 || isEnriching || bgEnriching;
              })()}
              onClick={handleEnrichAllPending}
            >
              {bgEnriching ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
              {bgEnriching
                ? `Enriching ${bgProgress?.done || 0}/${bgProgress?.total || 0}...`
                : `Enrich All Pending (${pageRows.filter(r => getLatest(r.slug) === undefined).length})`
              }
            </Button>

            {bgProgress && bgProgress.failed > 0 && (
              <Badge className="bg-red-500/20 text-red-700 border-red-300">
                {bgProgress.failed} failed
              </Badge>
            )}

            <span className="text-sm text-muted-foreground">
              {pageRows.length} pages · {pageRows.filter(r => r.healthColor === 'red').length} thin
            </span>
          </div>

          {/* Model batch info */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Info className="h-3 w-3 shrink-0" />
            <span>
              {selectedModelLabel} processes {batchLimit} pages per batch.
              {selected.size > batchLimit && (
                <> Remaining pages auto-queued in {Math.ceil(selected.size / batchLimit)} batches.</>
              )}
            </span>
          </div>

          {/* Claude quality note */}
          {(aiModel === 'claude-sonnet' || aiModel === 'claude') && (
            <div className="flex items-center gap-2 text-xs p-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-700">
              <Info className="h-3 w-3 shrink-0" />
              <span>Claude Sonnet produces highest quality but processes 1–2 pages per minute. For bulk enrichment, Gemini 2.5 Flash is faster.</span>
            </div>
          )}

          {/* Enrichment progress */}
          {enrichProgress && (
            <div className="flex items-center gap-2 p-2 rounded-lg bg-blue-50 border border-blue-200 text-sm text-blue-700">
              <Loader2 className="h-4 w-4 animate-spin shrink-0" />
              {enrichProgress}
            </div>
          )}

          {/* Persistent status messages */}
          <AdminMessageLog
            messages={messages}
            onDismiss={dismissMessage}
            onClearAll={clearAll}
            onToggleExpand={toggleExpand}
          />

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10"></TableHead>
                  <TableHead>Page</TableHead>
                  <TableHead className="text-right">Words</TableHead>
                  <TableHead className="text-right">Sections</TableHead>
                  <TableHead className="text-right">Enriched Words</TableHead>
                  <TableHead className="text-right">Enriched Sections</TableHead>
                  <TableHead>Health</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Live</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageRows.map(row => {
                  const latest = getLatest(row.slug);
                  const published = getPublished(row.slug);
                  return (
                    <TableRow key={row.slug}>
                      <TableCell>
                        <Checkbox checked={selected.has(row.slug)} onCheckedChange={() => toggleSelection(row.slug)} />
                      </TableCell>
                      <TableCell className="font-medium text-sm">{row.name}</TableCell>
                      <TableCell className="text-right tabular-nums text-xs">
                        {row.wordCount}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-xs">
                        {row.sectionCount}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-xs">
                        {latest?.current_word_count ?? '—'}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-xs">
                        {latest?.current_section_count ?? '—'}
                      </TableCell>
                      <TableCell>{healthBadge(row.healthColor)}</TableCell>
                      <TableCell>{statusBadge(latest?.status)}</TableCell>
                      <TableCell>
                        {published ? (
                          <Badge className="bg-blue-500/20 text-blue-700 border-blue-300">v{published.version}</Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {latest && (
                            <>
                              <Button size="sm" variant="ghost" title="Preview" onClick={() => setPreviewSlug(row.slug)}>
                                <Eye className="h-3 w-3" />
                              </Button>
                              <Button size="sm" variant="ghost" title="Version history" onClick={() => setHistorySlug(row.slug)}>
                                <History className="h-3 w-3" />
                              </Button>
                            </>
                          )}
                          {latest?.status === 'approved' && !published && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-blue-600"
                              title="Publish"
                              onClick={() => {
                                const check = canPublish(latest, row);
                                if (!check.ok) {
                                  toast({ title: 'Cannot publish', description: check.reason, variant: 'destructive' });
                                } else {
                                  handlePublish(row.slug, latest.version);
                                }
                              }}
                            >
                              <Upload className="h-3 w-3" />
                            </Button>
                          )}
                          {published && (
                            <Button size="sm" variant="ghost" className="text-red-600" title="Unpublish" onClick={() => handleUnpublish(row.slug)}>
                              <Undo2 className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {pageRows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                      No pages found for this family
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Batch Report */}
      {batchReport && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Batch Report</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div className="p-3 rounded-lg bg-muted">
                <p className="text-2xl font-bold">{batchReport.results.length}</p>
                <p className="text-xs text-muted-foreground">Pages processed</p>
              </div>
              <div className="p-3 rounded-lg bg-muted">
                <p className="text-2xl font-bold">
                  {batchReport.results.filter(r => r.status === 'success' || r.status === 'flagged').length}
                </p>
                <p className="text-xs text-muted-foreground">Enriched</p>
              </div>
              <div className="p-3 rounded-lg bg-muted">
                <p className="text-2xl font-bold text-red-600">
                  {batchReport.results.filter(r => r.status === 'failed').length}
                </p>
                <p className="text-xs text-muted-foreground">Failed</p>
              </div>
              <div className="p-3 rounded-lg bg-muted">
                <p className="text-2xl font-bold text-amber-600">
                  {batchReport.results.filter(r => r.status === 'skipped').length}
                </p>
                <p className="text-xs text-muted-foreground">Skipped</p>
              </div>
              <div className="p-3 rounded-lg bg-muted">
                <p className="text-2xl font-bold">
                  {batchReport.results.reduce((s, r) => s + r.sectionsAdded.length, 0)}
                </p>
                <p className="text-xs text-muted-foreground">Sections added</p>
              </div>
            </div>

            {batchReport.results.map(r => (
              <div key={r.slug} className="flex items-start gap-3 p-3 rounded-lg border">
                {r.status === 'failed' ? (
                  <XCircle className="h-5 w-5 text-red-500 mt-0.5 shrink-0" />
                ) : r.status === 'skipped' ? (
                  <Clock className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
                ) : r.flags.length > 0 ? (
                  <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
                ) : (
                  <CheckCircle className="h-5 w-5 text-emerald-500 mt-0.5 shrink-0" />
                )}
                <div className="min-w-0">
                  <p className="font-medium text-sm">{r.slug}</p>
                  {r.status === 'failed' || r.status === 'skipped' ? (
                    <p className="text-xs text-red-600">{r.failureReason || 'Unknown failure'}</p>
                  ) : (
                    <>
                      <p className="text-xs text-muted-foreground">
                        {r.totalWords} words · {r.sectionsAdded.length} sections · Score: W{r.qualityScore.wordScore}/S{r.qualityScore.sectionScore}
                      </p>
                      {r.flags.length > 0 && (
                        <div className="mt-1 space-y-0.5">
                          {r.flags.map((f, i) => (
                            <p key={i} className="text-xs text-amber-600">{f}</p>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Preview Dialog */}
      <Dialog open={!!previewSlug} onOpenChange={(open) => { if (!open) { setPreviewSlug(null); setReviewNotes(''); } }}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Enrichment Preview: {previewSlug} {previewDraft ? `(v${previewDraft.version})` : ''}</DialogTitle>
          </DialogHeader>
          {previewDraft && (
            <div className="space-y-4">
              <div className="flex gap-2 flex-wrap">
                {statusBadge(previewDraft.status)}
                {previewDraft.sections_added?.map(s => (
                  <Badge key={s} variant="outline">{s}</Badge>
                ))}
              </div>

              {previewDraft.failure_reason && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200">
                  <p className="text-sm font-medium text-red-700 mb-1">Failure Reason</p>
                  <p className="text-sm text-red-600">{previewDraft.failure_reason}</p>
                </div>
              )}

              {previewDraft.flags?.length > 0 && (
                <div className="p-3 rounded-lg bg-amber-50 border border-amber-200">
                  {previewDraft.flags.map((f, i) => (
                    <p key={i} className="text-sm text-amber-700">{f}</p>
                  ))}
                </div>
              )}
              {Object.entries(previewDraft.enrichment_data || {}).map(([key, value]) => (
                <div key={key} className="border rounded-lg p-4">
                  <h4 className="font-semibold text-sm mb-2 uppercase tracking-wide text-muted-foreground">{key}</h4>
                  {key === 'faq' && Array.isArray(value) ? (
                    <div className="space-y-2">
                      {(value as Array<{ question: string; answer: string }>).map((faq, i) => (
                        <div key={i}>
                          <p className="font-medium text-sm">{faq.question}</p>
                          <p className="text-sm text-muted-foreground">{faq.answer}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm whitespace-pre-wrap">{String(value)}</p>
                  )}
                </div>
              ))}

              {previewDraft.status === 'draft' && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground mb-1 block">Review Notes (optional)</label>
                  <Textarea
                    value={reviewNotes}
                    onChange={(e) => setReviewNotes(e.target.value)}
                    placeholder="Add notes about this enrichment..."
                    rows={2}
                  />
                </div>
              )}

              {previewDraft.review_notes && previewDraft.status !== 'draft' && (
                <div className="p-3 rounded-lg bg-muted">
                  <p className="text-xs font-medium text-muted-foreground mb-1">Review Notes</p>
                  <p className="text-sm">{previewDraft.review_notes}</p>
                </div>
              )}

              {previewDraft.status === 'draft' && (
                <div className="flex gap-2 pt-2">
                  <Button onClick={() => { handleApprove(previewSlug!); setPreviewSlug(null); }} className="bg-emerald-600 hover:bg-emerald-700">
                    <CheckCircle className="h-4 w-4 mr-2" /> Approve
                  </Button>
                  <Button variant="destructive" onClick={() => { handleReject(previewSlug!); setPreviewSlug(null); }}>
                    <XCircle className="h-4 w-4 mr-2" /> Reject
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Version History Dialog */}
      <Dialog open={!!historySlug} onOpenChange={(open) => !open && setHistorySlug(null)}>
        <DialogContent className="max-w-2xl max-h-[70vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Version History: {historySlug}</DialogTitle>
          </DialogHeader>
          {historyVersions && historyVersions.length > 0 ? (
            <div className="space-y-2">
              {historyVersions.map(v => (
                <div key={v.id} className="flex items-center justify-between p-3 rounded-lg border">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">v{v.version}</span>
                    {statusBadge(v.status)}
                    {v.published_at && <Badge className="bg-blue-500/20 text-blue-700">Live</Badge>}
                    {v.current_word_count > 0 && (
                      <span className="text-xs text-muted-foreground">{v.current_word_count}w</span>
                    )}
                    {v.failure_reason && (
                      <span className="text-xs text-red-600 truncate max-w-[200px]" title={v.failure_reason}>
                        {v.failure_reason}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-1">
                    {v.status === 'approved' && !v.published_at && (
                      <Button size="sm" variant="outline" onClick={() => handlePublish(historySlug!, v.version)}>
                        <Upload className="h-3 w-3 mr-1" /> Publish
                      </Button>
                    )}
                    {v.published_at && (
                      <Button size="sm" variant="outline" className="text-red-600" onClick={() => handleUnpublish(historySlug!)}>
                        <Undo2 className="h-3 w-3 mr-1" /> Unpublish
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-4 text-center">No versions found</p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
