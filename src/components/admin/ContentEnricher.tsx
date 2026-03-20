import { useState, useEffect, useMemo, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { useAdminToast as useToast, useAdminMessagesContext } from '@/contexts/AdminMessagesContext';
import { AdminMessageLog } from '@/components/admin/AdminMessageLog';
import { supabase } from '@/integrations/supabase/client';
import { getAllExamAuthoritySlugs, getExamAuthorityConfig } from '@/data/examAuthority';
import { getAllPYPSlugs, getPYPConfig } from '@/data/previousYearPapers/types';
import { getAllStateGovtSlugs, getStateGovtJobConfig } from '@/pages/seo/stateGovtJobsData';
import { Loader2, CheckCircle, AlertTriangle, XCircle, Sparkles, Eye, Upload, Undo2, History, Clock, X, Info, Square } from 'lucide-react';
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

function countWordsInHtml(html: string): number {
  return html.replace(/<[^>]+>/g, ' ').trim().split(/\s+/).filter(Boolean).length;
}

function countSectionsInHtml(html: string): number {
  return (html.match(/<h[23][^>]*>/gi) || []).length;
}

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

import { getTextModels, getModelSpeed, getModelDef } from '@/lib/aiModels';
import { AiModelSelector, getLastUsedModel } from '@/components/admin/AiModelSelector';

function formatTime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

export function ContentEnricher() {
  const { toast } = useToast();
  const [family, setFamily] = useState<PageFamily>('notification');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isEnriching, setIsEnriching] = useState(false);
  const [isPublishingAll, setIsPublishingAll] = useState(false);
  const [isApprovingAll, setIsApprovingAll] = useState(false);
  const [batchReport, setBatchReport] = useState<{ results: EnrichmentResult[] } | null>(null);
  const [drafts, setDrafts] = useState<Map<string, EnrichmentDraft[]>>(new Map());
  const [previewSlug, setPreviewSlug] = useState<string | null>(null);
  const [historySlug, setHistorySlug] = useState<string | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [aiModel, setAiModel] = useState<string>(() => getLastUsedModel('text', 'gemini-flash'));
  const { messages, addMessage, dismissMessage, clearAll, toggleExpand } = useAdminMessagesContext();

  // Sequential processing state
  const [currentSlug, setCurrentSlug] = useState<string | null>(null);
  const [progressState, setProgressState] = useState<{
    current: number;
    total: number;
    succeeded: number;
    failed: number;
  } | null>(null);
  const cancelRef = useRef(false);

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
          slug, name: config.state, wordCount: wc, sectionCount: sc,
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
          slug, name: config.examName, wordCount: wc, sectionCount: sc,
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
          slug, name: config.examName || slug, wordCount: wc, sectionCount: sc,
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
      else next.add(slug);
      return next;
    });
  };

  // ── Core sequential enrichment loop ──
  const enrichSequentially = async (slugsToProcess: string[]) => {
    if (slugsToProcess.length === 0) return;

    setIsEnriching(true);
    cancelRef.current = false;
    setBatchReport(null);

    const modelLabel = getModelDef(aiModel)?.label || aiModel;
    const estimatedSeconds = slugsToProcess.length * getModelSpeed(aiModel);

    addMessage('info', `Starting enrichment: ${slugsToProcess.length} pages`,
      `Using ${modelLabel} · Estimated time: ${formatTime(estimatedSeconds)}`);

    const allResults: EnrichmentResult[] = [];
    let succeeded = 0;
    let failed = 0;

    setProgressState({ current: 0, total: slugsToProcess.length, succeeded: 0, failed: 0 });

    for (let i = 0; i < slugsToProcess.length; i++) {
      // Check cancel
      if (cancelRef.current) {
        addMessage('warning', 'Enrichment stopped',
          `${succeeded + failed} of ${slugsToProcess.length} pages completed. ${slugsToProcess.length - i} remaining — you can enrich them later.`);
        break;
      }

      const slug = slugsToProcess[i];
      const row = pageRows.find(r => r.slug === slug);
      setCurrentSlug(slug);
      setProgressState({ current: i + 1, total: slugsToProcess.length, succeeded, failed });

      const currentContent = {
        slug,
        examName: row?.name || slug,
        existingWordCount: row?.wordCount || 0,
        existingSections: [],
      };

      try {
        const { data, error } = await supabase.functions.invoke('enrich-authority-pages', {
          body: { slug, pageType: family, currentContent, aiModel },
        });

        if (error) throw error;

        const result: EnrichmentResult = data?.results?.[0] || {
          slug, status: 'failed', sectionsAdded: [], qualityScore: {},
          flags: [], totalWords: 0, failureReason: 'No result returned',
        };

        allResults.push(result);

        if (result.status === 'success' || result.status === 'flagged') {
          succeeded++;
          const wcv = data?.wordCountValidation;
          let wcNote = '';
          if (wcv?.status === 'fail') {
            const betterModels = getRecommendedModelsForTarget(wcv.targetWordCount).filter(m => m.value !== aiModel);
            const suggestion = betterModels.length > 0 ? ` Try ${betterModels[0].label}.` : '';
            wcNote = ` · ⚠ ${wcv.actualWordCount}/${wcv.targetWordCount}w — off target.${suggestion}`;
          } else if (wcv?.status === 'warn') {
            wcNote = ` · ℹ ${wcv.actualWordCount}/${wcv.targetWordCount}w — slightly outside range`;
          }
          addMessage(
            result.status === 'flagged' ? 'warning' : 'success',
            `✓ ${slug}`,
            `${result.totalWords} words · ${result.sectionsAdded.length} sections · Score: W${result.qualityScore.wordScore}/S${result.qualityScore.sectionScore}${wcNote}`);
        } else {
          failed++;
          addMessage('error', `✗ ${slug}`, result.failureReason || 'Unknown error');
        }
      } catch (err) {
        failed++;
        const reason = err instanceof Error ? err.message : 'Unknown error';
        allResults.push({
          slug, status: 'failed', sectionsAdded: [], qualityScore: {},
          flags: [], totalWords: 0, failureReason: reason,
        });
        addMessage('error', `✗ ${slug}`, reason);
      }

      setProgressState({ current: i + 1, total: slugsToProcess.length, succeeded, failed });

      // Refresh drafts after each slug
      await loadDrafts();

      // Breathing room between invocations (skip after last)
      if (i + 1 < slugsToProcess.length && !cancelRef.current) {
        await new Promise(r => setTimeout(r, 2000));
      }
    }

    setBatchReport({ results: allResults });
    setCurrentSlug(null);
    setProgressState(null);
    setIsEnriching(false);

    if (!cancelRef.current) {
      addMessage(failed > 0 ? 'warning' : 'success', 'Enrichment complete',
        `${succeeded} enriched, ${failed} failed out of ${slugsToProcess.length} pages`);
    }
  };

  const handleEnrichBatch = async () => {
    if (selected.size === 0) return;
    await enrichSequentially(Array.from(selected));
  };

  const handleEnrichAllPending = async () => {
    const pending = pageRows.filter(r => getLatest(r.slug) === undefined);
    if (pending.length === 0) return;
    await enrichSequentially(pending.map(r => r.slug));
  };

  const handleStopEnrichment = () => {
    cancelRef.current = true;
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

  const handlePublishAllEnriched = async () => {
    if (isPublishingAll) return;

    const publishable = pageRows.reduce<Array<{ row: PageHealthRow; latest: EnrichmentDraft }>>((acc, row) => {
      const latest = getLatest(row.slug);
      const published = getPublished(row.slug);
      if (!latest || published) return acc;
      if (!canPublish(latest, row).ok) return acc;
      acc.push({ row, latest });
      return acc;
    }, []);

    if (publishable.length === 0) {
      toast({ title: 'No publishable pages', description: 'No approved enriched pages are ready to publish yet.' });
      return;
    }

    setIsPublishingAll(true);
    addMessage('info', 'Publishing enriched pages', `Publishing ${publishable.length} page${publishable.length === 1 ? '' : 's'}...`);

    let success = 0;
    let failed = 0;

    try {
      for (const item of publishable) {
        const { row, latest } = item;
        const { data, error } = await supabase.rpc('publish_enrichment_version', {
          p_page_slug: row.slug,
          p_version: latest.version,
        });

        if (error) {
          failed++;
          addMessage('error', `✗ Publish ${row.slug}`, error.message);
          continue;
        }

        const result = data as unknown as { success: boolean; error?: string };
        if (!result.success) {
          failed++;
          addMessage('error', `✗ Publish ${row.slug}`, result.error || 'Unknown publish error');
          continue;
        }

        success++;
        addMessage('success', `✓ Published ${row.slug}`, `Version ${latest.version} is now live`);
      }

      await loadDrafts();

      if (failed > 0) {
        toast({ title: 'Publish completed with issues', description: `${success} published, ${failed} failed`, variant: 'destructive' });
      } else {
        toast({ title: 'Published all enriched pages', description: `${success} page${success === 1 ? '' : 's'} are now live` });
      }

      addMessage(failed > 0 ? 'warning' : 'success', 'Publish all complete', `${success} published, ${failed} failed`);
    } finally {
      setIsPublishingAll(false);
    }
  };

  const handleApproveAllEnriched = async () => {
    if (isApprovingAll) return;

    const approvable = pageRows.reduce<Array<{ slug: string; version: number }>>((acc, row) => {
      const latest = getLatest(row.slug);
      if (!latest || latest.status !== 'draft') return acc;
      if (latest.flags?.includes('PARSE_ERROR')) return acc;
      if ((latest.current_word_count || 0) < 500) return acc;
      acc.push({ slug: row.slug, version: latest.version });
      return acc;
    }, []);

    if (approvable.length === 0) {
      toast({ title: 'Nothing to approve', description: 'No draft enrichments are eligible for approval.' });
      return;
    }

    setIsApprovingAll(true);
    addMessage('info', 'Approving enriched pages', `Approving ${approvable.length} draft${approvable.length === 1 ? '' : 's'}...`);

    let success = 0;
    let failed = 0;
    const now = new Date().toISOString();

    for (const item of approvable) {
      const { error } = await supabase
        .from('content_enrichments')
        .update({
          status: 'approved',
          approved_at: now,
          updated_at: now,
        })
        .eq('page_slug', item.slug)
        .eq('version', item.version);

      if (error) {
        failed++;
        addMessage('error', `✗ Approve ${item.slug}`, error.message);
      } else {
        success++;
      }
    }

    await loadDrafts();

    if (failed > 0) {
      toast({ title: 'Approval completed with issues', description: `${success} approved, ${failed} failed`, variant: 'destructive' });
    } else {
      toast({ title: 'All drafts approved', description: `${success} enrichment${success === 1 ? '' : 's'} approved` });
    }

    addMessage(failed > 0 ? 'warning' : 'success', 'Approve all complete', `${success} approved, ${failed} failed`);
    setIsApprovingAll(false);
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

  const selectedModelInfo = getModelDef(aiModel);
  const previewDrafts = previewSlug ? drafts.get(previewSlug) : null;
  const previewDraft = previewDrafts?.[0] ?? null;
  const historyVersions = historySlug ? drafts.get(historySlug) : null;

  // Time estimate for selected pages
  const estimatedTime = selected.size > 0
    ? formatTime(selected.size * getModelSpeed(aiModel))
    : null;

  const pendingCount = pageRows.filter(r => getLatest(r.slug) === undefined).length;
  const approvableCount = pageRows.reduce((count, row) => {
    const latest = getLatest(row.slug);
    if (!latest || latest.status !== 'draft') return count;
    if (latest.flags?.includes('PARSE_ERROR')) return count;
    if ((latest.current_word_count || 0) < 500) return count;
    return count + 1;
  }, 0);
  const publishableCount = pageRows.reduce((count, row) => {
    const latest = getLatest(row.slug);
    const published = getPublished(row.slug);
    if (!latest || published) return count;
    return canPublish(latest, row).ok ? count + 1 : count;
  }, 0);

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

            <AiModelSelector value={aiModel} onValueChange={setAiModel} capability="text" triggerClassName="w-[280px] h-10 text-sm" size="default" />

            {!isEnriching ? (
              <>
                <Button onClick={handleEnrichBatch} disabled={selected.size === 0}>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Enrich {selected.size} page{selected.size !== 1 ? 's' : ''}
                  {estimatedTime && <span className="ml-1 text-xs opacity-75">(~{estimatedTime})</span>}
                </Button>

                <Button
                  variant="outline"
                  onClick={() => {
                    const pending = pageRows.filter(r => getLatest(r.slug) === undefined);
                    setSelected(new Set(pending.map(r => r.slug)));
                  }}
                >
                  Select All Pending
                </Button>

                <Button
                  variant="secondary"
                  disabled={pendingCount === 0}
                  onClick={handleEnrichAllPending}
                >
                  <Sparkles className="h-4 w-4 mr-2" />
                  Enrich All Pending ({pendingCount})
                </Button>

                <Button
                  variant="outline"
                  disabled={approvableCount === 0 || isApprovingAll}
                  onClick={handleApproveAllEnriched}
                >
                  {isApprovingAll ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-2" />}
                  Approve All Enriched ({approvableCount})
                </Button>

                <Button
                  variant="outline"
                  disabled={publishableCount === 0 || isPublishingAll}
                  onClick={handlePublishAllEnriched}
                >
                  {isPublishingAll ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                  Publish All Enriched ({publishableCount})
                </Button>
              </>
            ) : (
              <Button variant="destructive" onClick={handleStopEnrichment}>
                <Square className="h-4 w-4 mr-2" />
                Stop Enrichment
              </Button>
            )}

            <span className="text-sm text-muted-foreground">
              {pageRows.length} pages · {pageRows.filter(r => r.healthColor === 'red').length} thin
            </span>
          </div>

          {/* Model info */}
          {selectedModelInfo && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Info className="h-3 w-3 shrink-0" />
              <span>{selectedModelInfo.desc}. Each page gets its own dedicated processing time — no timeouts.</span>
            </div>
          )}

          {/* Progress bar during enrichment */}
          {progressState && (
            <div className="space-y-2 p-3 rounded-lg bg-blue-50 border border-blue-200">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                  <span className="text-blue-700 font-medium">
                    Enriching page {progressState.current} of {progressState.total}
                    {currentSlug && <span className="text-blue-500"> — {currentSlug}</span>}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span className="text-emerald-600">{progressState.succeeded} succeeded</span>
                  {progressState.failed > 0 && <span className="text-red-600">{progressState.failed} failed</span>}
                  <span className="text-muted-foreground">{progressState.total - progressState.current} remaining</span>
                </div>
              </div>
              <Progress value={(progressState.current / progressState.total) * 100} className="h-2" />
              <div className="text-xs text-blue-500">
                Est. remaining: ~{formatTime((progressState.total - progressState.current) * getModelSpeed(aiModel))}
              </div>
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
                  const isCurrentlyProcessing = currentSlug === row.slug;
                  return (
                    <TableRow key={row.slug} className={isCurrentlyProcessing ? 'bg-blue-50/50' : undefined}>
                      <TableCell>
                        <Checkbox checked={selected.has(row.slug)} onCheckedChange={() => toggleSelection(row.slug)} disabled={isEnriching} />
                      </TableCell>
                      <TableCell className="font-medium text-sm">
                        {isCurrentlyProcessing && <Loader2 className="h-3 w-3 animate-spin inline mr-1 text-blue-600" />}
                        {row.name}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-xs">{row.wordCount}</TableCell>
                      <TableCell className="text-right tabular-nums text-xs">{row.sectionCount}</TableCell>
                      <TableCell className="text-right tabular-nums text-xs">{latest?.current_word_count ?? '—'}</TableCell>
                      <TableCell className="text-right tabular-nums text-xs">{latest?.current_section_count ?? '—'}</TableCell>
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
                              disabled={isPublishingAll}
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
            <CardTitle className="text-lg">Enrichment Report</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="p-3 rounded-lg bg-muted">
                <p className="text-2xl font-bold">{batchReport.results.length}</p>
                <p className="text-xs text-muted-foreground">Pages processed</p>
              </div>
              <div className="p-3 rounded-lg bg-muted">
                <p className="text-2xl font-bold text-emerald-600">
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
                <p className="text-2xl font-bold">
                  {Math.round(batchReport.results.reduce((s, r) => s + r.totalWords, 0) / (batchReport.results.filter(r => r.totalWords > 0).length || 1))}
                </p>
                <p className="text-xs text-muted-foreground">Avg words</p>
              </div>
            </div>

            {batchReport.results.map(r => (
              <div key={r.slug} className="flex items-start gap-3 p-3 rounded-lg border">
                {r.status === 'failed' ? (
                  <XCircle className="h-5 w-5 text-red-500 mt-0.5 shrink-0" />
                ) : r.flags.length > 0 ? (
                  <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
                ) : (
                  <CheckCircle className="h-5 w-5 text-emerald-500 mt-0.5 shrink-0" />
                )}
                <div className="min-w-0">
                  <p className="font-medium text-sm">{r.slug}</p>
                  {r.status === 'failed' ? (
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
                    placeholder="Add review notes..."
                    rows={2}
                  />
                  <div className="flex gap-2 mt-3">
                    <Button onClick={() => handleApprove(previewSlug!)} className="bg-emerald-600 hover:bg-emerald-700">
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Approve
                    </Button>
                    <Button variant="destructive" onClick={() => handleReject(previewSlug!)}>
                      <XCircle className="h-4 w-4 mr-2" />
                      Reject
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* History Dialog */}
      <Dialog open={!!historySlug} onOpenChange={(open) => { if (!open) setHistorySlug(null); }}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Version History: {historySlug}</DialogTitle>
          </DialogHeader>
          {historyVersions && (
            <div className="space-y-3">
              {historyVersions.map(v => (
                <div key={v.id} className="flex items-start gap-3 p-3 rounded-lg border">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm">v{v.version}</span>
                      {statusBadge(v.status)}
                      {v.published_at && <Badge className="bg-blue-500/20 text-blue-700 border-blue-300">Live</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {v.current_word_count} words · {v.current_section_count} sections
                    </p>
                    {v.failure_reason && <p className="text-xs text-red-600 mt-1">{v.failure_reason}</p>}
                    {v.review_notes && <p className="text-xs text-muted-foreground mt-1">Notes: {v.review_notes}</p>}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button size="sm" variant="ghost" onClick={() => { setHistorySlug(null); setPreviewSlug(historySlug); }}>
                      <Eye className="h-3 w-3" />
                    </Button>
                    {v.status === 'approved' && !v.published_at && (
                      <Button size="sm" variant="ghost" className="text-blue-600" onClick={() => handlePublish(historySlug!, v.version)}>
                        <Upload className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
