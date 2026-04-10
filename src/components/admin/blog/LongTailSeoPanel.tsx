/**
 * Long Tail SEO Pages — auto-first bulk generation panel.
 * Paste topics → system auto-detects template/exam/state → generates drafts → admin reviews.
 */
import { useState, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useAdminToast as useToast } from '@/contexts/AdminMessagesContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { AiModelSelector } from '@/components/admin/AiModelSelector';
import { TEMPLATE_OPTIONS, getTemplate, getTemplateLabel } from '@/lib/longTailTemplates';
import { findDuplicates, findBatchDuplicates, type TopicInput, type ExistingPage, type DuplicateMatch } from '@/lib/longTailKeywordNorm';
import { runQualityGates, computeStaleAfter } from '@/lib/longTailQualityGates';
import { autoDetectMeta, type DetectedMeta } from '@/lib/longTailAutoDetect';
import { calcLiveWordCount } from '@/lib/blogWordCount';
import { normalizeBlogCategory } from '@/lib/blogCategoryUtils';
import { ChevronDown, Sparkles, Loader2, Check, X, AlertTriangle, Search, RotateCcw, Square, ExternalLink, FileText, Settings2 } from 'lucide-react';

type ResultStatus = 'queued' | 'generating' | 'success' | 'failed';

interface GenerationResult {
  keyword: string;
  status: ResultStatus;
  articleId?: string;
  slug?: string;
  error?: string;
  thinRisk?: boolean;
  dupScore?: number;
  qualityScore?: number;
  detected?: DetectedMeta;
}

interface LongTailSeoPanelProps {
  onRefresh: () => void;
}

const WORD_PRESETS = [800, 1200, 1500];

function ConfidenceBadge({ label, confidence }: { label: string; confidence?: 'high' | 'medium' | 'low' }) {
  if (!label) return null;
  const cls = confidence === 'high'
    ? 'bg-primary/10 text-primary border-primary/20'
    : confidence === 'medium'
      ? 'bg-amber-500/10 text-amber-700 border-amber-500/20'
      : 'bg-muted text-muted-foreground border-dashed';
  return <Badge variant="outline" className={`text-[9px] px-1 h-4 ${cls}`}>{label}</Badge>;
}

export function LongTailSeoPanel({ onRefresh }: LongTailSeoPanelProps) {
  const { user } = useAuth();
  const { toast } = useToast();

  const [open, setOpen] = useState(false);
  const [keywords, setKeywords] = useState('');

  // Advanced overrides (hidden by default)
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [overrideTemplate, setOverrideTemplate] = useState('');
  const [overrideExam, setOverrideExam] = useState('');
  const [overrideState, setOverrideState] = useState('');
  const [overrideDept, setOverrideDept] = useState('');
  const [overrideYear, setOverrideYear] = useState('');
  const [overrideSourceUrl, setOverrideSourceUrl] = useState('');

  // Primary controls
  const [wordCount, setWordCount] = useState(1200);
  const [customWordCount, setCustomWordCount] = useState('');
  const [isCustomWc, setIsCustomWc] = useState(false);
  const [aiModel, setAiModel] = useState<string>(() => {
    try { return localStorage.getItem('lt_seo_ai_model') || 'gemini-flash'; } catch { return 'gemini-flash'; }
  });
  const [outputLanguage, setOutputLanguage] = useState<'auto' | 'english' | 'hindi'>(() => {
    try { return (localStorage.getItem('lt_seo_output_lang') as any) || 'auto'; } catch { return 'auto'; }
  });

  // Duplicate check state
  const [dupResults, setDupResults] = useState<{ keyword: string; matches: DuplicateMatch[] }[]>([]);
  const [isCheckingDups, setIsCheckingDups] = useState(false);

  // Generation state
  const [results, setResults] = useState<GenerationResult[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const abortRef = useRef(false);

  const topicLines = keywords.split('\n').map(t => t.trim()).filter(t => t.length > 0);

  const handleModelChange = useCallback((v: string) => {
    setAiModel(v);
    try { localStorage.setItem('lt_seo_ai_model', v); } catch {}
  }, []);

  const handleLangChange = useCallback((v: string) => {
    setOutputLanguage(v as any);
    try { localStorage.setItem('lt_seo_output_lang', v); } catch {}
  }, []);

  const effectiveWordCount = isCustomWc ? Math.min(Math.max(Number(customWordCount) || 800, 500), 3000) : wordCount;

  /** Resolve effective values: override wins over auto-detected */
  const resolveEffective = (keyword: string) => {
    const detected = autoDetectMeta(keyword);
    return {
      detected,
      template: overrideTemplate || detected.template,
      exam: overrideExam || detected.exam || null,
      state: overrideState || detected.state || null,
      department: overrideDept || detected.department || null,
      year: overrideYear || detected.year || null,
      sourceUrl: overrideSourceUrl || (detected.sourceCandidate ? `https://${detected.sourceCandidate}` : null),
      sourceCandidate: detected.sourceCandidate,
    };
  };

  // ── Duplicate Checker ──
  const handleCheckDuplicates = async () => {
    if (topicLines.length === 0) return;
    setIsCheckingDups(true);
    setDupResults([]);
    try {
      const { data: existing } = await supabase
        .from('blog_posts')
        .select('id, title, slug, primary_keyword, page_template, target_exam, target_state, content_mode');

      const existingPages: ExistingPage[] = (existing || []).map((p: any) => ({
        id: p.id, title: p.title, slug: p.slug,
        primary_keyword: p.primary_keyword, page_template: p.page_template,
        target_exam: p.target_exam, target_state: p.target_state, content_mode: p.content_mode,
      }));

      const topics: TopicInput[] = topicLines.map(kw => {
        const eff = resolveEffective(kw);
        return {
          keyword: kw, template: eff.template,
          exam: eff.exam || undefined, state: eff.state || undefined,
          department: eff.department || undefined, year: eff.year || undefined,
        };
      });

      const batchDups = findBatchDuplicates(topics);

      const results: { keyword: string; matches: DuplicateMatch[] }[] = [];
      for (const topic of topics) {
        const matches = findDuplicates(topic, existingPages, 0.60);
        results.push({ keyword: topic.keyword, matches });
      }

      setDupResults(results);
      const totalDups = results.filter(r => r.matches.length > 0).length;
      if (totalDups > 0) {
        toast({ title: `⚠ ${totalDups} topic(s) have potential duplicates`, description: 'Review warnings below before generating.' });
      } else if (batchDups.length > 0) {
        toast({ title: `⚠ ${batchDups.length} within-batch duplicate(s) found` });
      } else {
        toast({ title: '✓ No duplicates found' });
      }
    } catch (err: any) {
      toast({ title: 'Duplicate check failed', description: err.message, variant: 'destructive' });
    } finally {
      setIsCheckingDups(false);
    }
  };

  // ── Generate single keyword (shared by generate + retry) ──
  const generateOne = async (keyword: string, index: number): Promise<void> => {
    if (!user) throw new Error('Not authenticated');

    const eff = resolveEffective(keyword);
    const tmpl = getTemplate(eff.template);
    if (!tmpl) throw new Error(`Unknown template: ${eff.template}`);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');

    const effectiveLang = outputLanguage !== 'auto' ? outputLanguage
      : eff.detected.languageHint !== 'auto' ? eff.detected.languageHint : 'auto';

    const { data, error } = await supabase.functions.invoke('generate-blog-article', {
      body: {
        topic: keyword,
        category: 'Government Jobs',
        targetWordCount: effectiveWordCount,
        aiModel,
        outputLanguage: effectiveLang,
        contentMode: 'long_tail_seo',
        pageTemplate: eff.template,
        primaryKeyword: keyword,
        targetExam: eff.exam || undefined,
        targetState: eff.state || undefined,
        targetDepartment: eff.department || undefined,
        targetYear: eff.year || undefined,
        officialSourceUrl: eff.sourceUrl || undefined,
      },
    });
    if (error) throw new Error(error.message);
    if (!data?.title || !data?.content) throw new Error('Invalid AI response');

    const wc = data.wordCountValidation?.actualWordCount || calcLiveWordCount(data.content);
    const qualityResult = runQualityGates(data.content, eff.template, {
      officialSourceUrl: eff.sourceUrl || undefined,
      wordCount: wc,
    });

    let dupScore = 0;
    let dupReason: string | null = null;
    const dupCheck = dupResults.find(d => d.keyword === keyword);
    if (dupCheck && dupCheck.matches.length > 0) {
      dupScore = dupCheck.matches[0].similarity;
      dupReason = dupCheck.matches[0].reason;
    }

    const staleAfter = computeStaleAfter(eff.template, eff.year || undefined);
    const slug = (data.slug || data.title)
      .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').substring(0, 120);

    const factConfidence = eff.sourceUrl ? 'source_provided'
      : eff.sourceCandidate ? 'source_candidate' : 'ai_inferred';

    const { data: inserted, error: insertErr } = await supabase.from('blog_posts').insert({
      title: data.title,
      slug,
      content: data.content,
      excerpt: data.excerpt || null,
      meta_title: data.metaTitle || null,
      meta_description: data.metaDescription || null,
      category: normalizeBlogCategory(data.category || 'Government Jobs'),
      tags: data.tags || [],
      author_id: user.id,
      author_name: 'TrueJobs Editorial Team',
      canonical_url: `https://truejobs.co.in/blog/${slug}`,
      is_published: false,
      word_count: wc,
      reading_time: Math.max(1, Math.ceil(wc / 200)),
      content_mode: 'long_tail_seo',
      page_template: eff.template,
      primary_keyword: keyword,
      secondary_keywords: data.secondaryKeywords || [],
      search_intent: eff.detected.intent,
      target_exam: eff.exam,
      target_state: eff.state,
      target_department: eff.department,
      target_category: eff.detected.category,
      target_year: eff.year,
      official_source_url: eff.sourceUrl,
      official_source_label: eff.sourceCandidate || null,
      fact_confidence: factConfidence,
      duplicate_risk_score: dupScore,
      duplicate_risk_reason: dupReason,
      thin_content_risk: !qualityResult.passed,
      thin_content_reason: qualityResult.reason,
      noindex: !qualityResult.passed || dupScore > 70 || data.sourceFreshnessValidation?.blockSafeReady,
      review_status: data.sourceFreshnessValidation?.blockSafeReady ? 'freshness_blocked' : 'pending',
      stale_after: staleAfter,
      long_tail_metadata: {
        templateUsed: eff.template,
        autoDetected: eff.detected,
        overrides: {
          template: overrideTemplate || null,
          exam: overrideExam || null,
          state: overrideState || null,
          department: overrideDept || null,
          year: overrideYear || null,
          sourceUrl: overrideSourceUrl || null,
        },
        qualityScore: qualityResult.score,
        qualityChecks: qualityResult.checks,
        modelUsed: aiModel,
        sourceFreshness: data.sourceFreshnessValidation || null,
      },
    } as any).select('id').single();

    if (insertErr) throw new Error(insertErr.message);

    setResults(prev => prev.map((r, idx) => idx === index ? {
      ...r, status: 'success' as const, articleId: inserted?.id, slug,
      thinRisk: !qualityResult.passed, dupScore, qualityScore: qualityResult.score,
      detected: eff.detected,
    } : r));
  };

  // ── Generate all ──
  const handleGenerate = async () => {
    if (topicLines.length === 0) { toast({ title: 'Enter at least one keyword', variant: 'destructive' }); return; }
    if (topicLines.length > 500) { toast({ title: 'Maximum 500 keywords at a time', variant: 'destructive' }); return; }
    if (!user) { toast({ title: 'Not authenticated', variant: 'destructive' }); return; }

    abortRef.current = false;
    setIsGenerating(true);

    // Pre-detect all for display
    const initial: GenerationResult[] = topicLines.map(kw => ({
      keyword: kw, status: 'queued' as const, detected: autoDetectMeta(kw),
    }));
    setResults(initial);

    for (let i = 0; i < topicLines.length; i++) {
      if (abortRef.current) {
        setResults(prev => prev.map((r, idx) => idx >= i && r.status === 'queued' ? { ...r, status: 'failed', error: 'Stopped' } : r));
        toast({ title: '⏹️ Generation stopped' });
        break;
      }

      setResults(prev => prev.map((r, idx) => idx === i ? { ...r, status: 'generating' } : r));

      try {
        await generateOne(topicLines[i], i);
      } catch (err: any) {
        setResults(prev => prev.map((r, idx) => idx === i ? { ...r, status: 'failed', error: err.message } : r));
      }

      if (i < topicLines.length - 1) await new Promise(r => setTimeout(r, 2500));
    }

    setIsGenerating(false);
    onRefresh();
    if (!abortRef.current) toast({ title: '✓ Long-tail generation complete' });
  };

  // ── Retry Failed ──
  const handleRetryFailed = async () => {
    const failedIndices = results.map((r, i) => r.status === 'failed' ? i : -1).filter(i => i >= 0);
    if (failedIndices.length === 0) return;

    abortRef.current = false;
    setIsGenerating(true);
    setResults(prev => prev.map(r => r.status === 'failed' ? { ...r, status: 'queued', error: undefined } : r));

    for (const i of failedIndices) {
      if (abortRef.current) break;
      setResults(prev => prev.map((r, idx) => idx === i ? { ...r, status: 'generating' } : r));

      try {
        await generateOne(results[i].keyword, i);
      } catch (err: any) {
        setResults(prev => prev.map((r, idx) => idx === i ? { ...r, status: 'failed', error: err.message } : r));
      }
      await new Promise(r => setTimeout(r, 2500));
    }

    setIsGenerating(false);
    onRefresh();
  };

  const successCount = results.filter(r => r.status === 'success').length;
  const failedCount = results.filter(r => r.status === 'failed').length;

  return (
    <div className="px-6 pb-4 border-b">
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger className="flex items-center gap-2 w-full py-2 text-sm font-medium hover:text-primary">
          <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
          <FileText className="h-4 w-4" /> Long Tail SEO Pages
          <Badge variant="outline" className="ml-1 text-[10px]">NEW</Badge>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-3 mt-2">
          {/* Helper text */}
          <p className="text-xs text-muted-foreground">
            Paste keywords below — the system auto-detects template, exam, state, and source. You only review and approve.
          </p>

          {/* Keywords input — PRIMARY */}
          <div className="space-y-1">
            <Label className="text-xs">Keywords (one per line, max 500)</Label>
            <Textarea
              value={keywords}
              onChange={e => { setKeywords(e.target.value); setDupResults([]); }}
              placeholder={"ssc cgl age limit for obc\nup police constable syllabus in hindi\nrailway group d salary after 7th pay commission\nssc chsl selection process step by step"}
              rows={10}
              className="text-xs"
            />
            <p className="text-xs text-muted-foreground">{topicLines.length} / 500 keywords</p>
          </div>

          {/* Controls row — word count, language, model */}
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <Label className="text-[11px]">Words</Label>
              <div className="flex gap-1">
                {WORD_PRESETS.map(w => (
                  <Button key={w} type="button" size="sm" variant={!isCustomWc && wordCount === w ? 'default' : 'outline'}
                    className="h-7 text-xs px-2"
                    onClick={() => { setWordCount(w); setIsCustomWc(false); }}>
                    {w}
                  </Button>
                ))}
                <Button type="button" size="sm" variant={isCustomWc ? 'default' : 'outline'}
                  className="h-7 text-xs px-2" onClick={() => setIsCustomWc(true)}>Custom</Button>
                {isCustomWc && (
                  <Input value={customWordCount} onChange={e => setCustomWordCount(e.target.value)}
                    placeholder="1000" className="h-7 w-16 text-xs" type="number" min={500} max={3000} />
                )}
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-[11px]">Language</Label>
              <Select value={outputLanguage} onValueChange={handleLangChange}>
                <SelectTrigger className="h-7 text-xs w-[90px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto" className="text-xs">Auto</SelectItem>
                  <SelectItem value="english" className="text-xs">English</SelectItem>
                  <SelectItem value="hindi" className="text-xs">Hindi</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-[11px]">AI Model</Label>
              <AiModelSelector value={aiModel} onValueChange={handleModelChange} capability="text" size="sm"
                wordTarget={effectiveWordCount} triggerClassName="w-[180px] h-7 text-xs" />
            </div>
          </div>

          {/* Advanced Overrides — collapsed */}
          <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
            <CollapsibleTrigger className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground">
              <Settings2 className="h-3 w-3" />
              <span>Advanced Overrides</span>
              <ChevronDown className={`h-3 w-3 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
              {(overrideTemplate || overrideExam || overrideState || overrideDept || overrideYear || overrideSourceUrl) && (
                <Badge variant="outline" className="text-[9px] h-4 ml-1">active</Badge>
              )}
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2">
              <p className="text-[10px] text-muted-foreground mb-2">
                Leave empty to use auto-detected values. Overrides apply to all keywords in this batch.
              </p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                <div className="space-y-1">
                  <Label className="text-[11px]">Template Override</Label>
                  <Select value={overrideTemplate} onValueChange={setOverrideTemplate}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Auto-detect" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="" className="text-xs">Auto-detect</SelectItem>
                      {TEMPLATE_OPTIONS.map(t => (
                        <SelectItem key={t.value} value={t.value} className="text-xs">{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px]">Exam Override</Label>
                  <Input value={overrideExam} onChange={e => setOverrideExam(e.target.value)} placeholder="Auto-detect" className="h-8 text-xs" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px]">State Override</Label>
                  <Input value={overrideState} onChange={e => setOverrideState(e.target.value)} placeholder="Auto-detect" className="h-8 text-xs" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px]">Department Override</Label>
                  <Input value={overrideDept} onChange={e => setOverrideDept(e.target.value)} placeholder="Auto-detect" className="h-8 text-xs" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px]">Year Override</Label>
                  <Input value={overrideYear} onChange={e => setOverrideYear(e.target.value)} placeholder="Auto-detect" className="h-8 text-xs" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px]">Official Source URL</Label>
                  <Input value={overrideSourceUrl} onChange={e => setOverrideSourceUrl(e.target.value)} placeholder="Auto-detect" className="h-8 text-xs" />
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Duplicate checker + Generate */}
          <div className="flex items-center gap-2">
            <Button type="button" size="sm" variant="outline" className="h-7 text-xs gap-1"
              disabled={isCheckingDups || topicLines.length === 0}
              onClick={handleCheckDuplicates}>
              {isCheckingDups ? <Loader2 className="h-3 w-3 animate-spin" /> : <Search className="h-3 w-3" />}
              Check Duplicates
            </Button>
            {dupResults.filter(d => d.matches.length > 0).length > 0 && (
              <Badge variant="destructive" className="text-[10px]">
                {dupResults.filter(d => d.matches.length > 0).length} overlap(s)
              </Badge>
            )}
            <div className="flex-1" />
            <Button size="sm" className="text-xs gap-1" disabled={isGenerating || topicLines.length === 0}
              onClick={handleGenerate}>
              {isGenerating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
              Generate Pages ({topicLines.length})
            </Button>
            {isGenerating && (
              <Button size="sm" variant="destructive" className="text-xs gap-1"
                onClick={() => { abortRef.current = true; }}>
                <Square className="h-3 w-3" /> Stop
              </Button>
            )}
            {failedCount > 0 && !isGenerating && (
              <Button size="sm" variant="outline" className="text-xs gap-1" onClick={handleRetryFailed}>
                <RotateCcw className="h-3 w-3" /> Retry Failed ({failedCount})
              </Button>
            )}
          </div>

          {/* Duplicate warnings */}
          {dupResults.filter(d => d.matches.length > 0).length > 0 && (
            <div className="space-y-1 max-h-32 overflow-y-auto border rounded p-2 bg-muted/30">
              {dupResults.filter(d => d.matches.length > 0).map((d, i) => (
                <div key={i} className="text-[11px] flex items-start gap-1">
                  <AlertTriangle className="h-3 w-3 text-amber-500 mt-0.5 shrink-0" />
                  <span>
                    <span className="font-medium">"{d.keyword}"</span> overlaps with{' '}
                    <span className="font-mono">{d.matches[0].existingPage.title.substring(0, 40)}...</span>{' '}
                    ({d.matches[0].similarity}% — {d.matches[0].reason})
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Results with auto-detected badges */}
          {results.length > 0 && (
            <div className="space-y-1 max-h-72 overflow-y-auto">
              <p className="text-[11px] text-muted-foreground">
                {successCount} success, {failedCount} failed, {results.filter(r => r.status === 'queued').length} queued
              </p>
              {results.map((r, i) => (
                <div key={i} className="flex items-center gap-1.5 text-xs py-1.5 border-b last:border-0">
                  {r.status === 'queued' && <div className="h-3 w-3 rounded-full bg-muted shrink-0" />}
                  {r.status === 'generating' && <Loader2 className="h-3 w-3 animate-spin text-primary shrink-0" />}
                  {r.status === 'success' && <Check className="h-3 w-3 text-green-600 shrink-0" />}
                  {r.status === 'failed' && <X className="h-3 w-3 text-destructive shrink-0" />}
                  <span className="truncate max-w-[180px]">{r.keyword}</span>
                  {/* Auto-detected metadata badges */}
                  {r.detected && (
                    <div className="flex items-center gap-0.5 flex-wrap">
                      <ConfidenceBadge label={getTemplateLabel(r.detected.template)} confidence={r.detected.templateConfidence} />
                      {r.detected.exam && <ConfidenceBadge label={r.detected.exam} confidence={r.detected.templateConfidence} />}
                      {r.detected.state && <ConfidenceBadge label={r.detected.state} confidence="medium" />}
                      {r.detected.category && <ConfidenceBadge label={r.detected.category} confidence="medium" />}
                      {r.detected.sourceCandidate && (
                        <Badge variant="outline" className="text-[9px] px-1 h-4 text-muted-foreground">{r.detected.sourceCandidate}</Badge>
                      )}
                    </div>
                  )}
                  <div className="flex-1" />
                  {r.thinRisk && <Badge variant="outline" className="text-[9px] px-1 h-4 border-amber-500/40 text-amber-600">Thin</Badge>}
                  {r.dupScore && r.dupScore > 50 && <Badge variant="outline" className="text-[9px] px-1 h-4 border-destructive/40 text-destructive">Dup {r.dupScore}%</Badge>}
                  {r.qualityScore !== undefined && (
                    <span className={`text-[10px] ${r.qualityScore >= 70 ? 'text-green-600' : r.qualityScore >= 50 ? 'text-amber-600' : 'text-destructive'}`}>
                      Q:{r.qualityScore}
                    </span>
                  )}
                  {r.status === 'failed' && r.error && (
                    <span className="text-[10px] text-destructive truncate max-w-[120px]" title={r.error}>{r.error}</span>
                  )}
                  {r.articleId && (
                    <Button variant="ghost" size="sm" className="h-5 px-1" asChild>
                      <a href={`/blog/${r.slug}?preview=${r.articleId}`} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
