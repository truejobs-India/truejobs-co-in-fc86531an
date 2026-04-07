/**
 * Long Tail SEO Pages — bulk generation panel for intent-driven SEO landing pages.
 * Renders as a collapsible section inside BlogPostEditor.
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
import { normalizeKeyword, findDuplicates, findBatchDuplicates, type TopicInput, type ExistingPage, type DuplicateMatch } from '@/lib/longTailKeywordNorm';
import { runQualityGates, computeStaleAfter } from '@/lib/longTailQualityGates';
import { calcLiveWordCount, calcReadingTime } from '@/lib/blogWordCount';
import { normalizeBlogCategory } from '@/lib/blogCategoryUtils';
import { ChevronDown, Sparkles, Loader2, Check, X, AlertTriangle, Search, RotateCcw, Square, ExternalLink, FileText } from 'lucide-react';

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
}

interface LongTailSeoPanelProps {
  onRefresh: () => void;
}

const WORD_PRESETS = [800, 1200, 1500];

export function LongTailSeoPanel({ onRefresh }: LongTailSeoPanelProps) {
  const { user } = useAuth();
  const { toast } = useToast();

  const [open, setOpen] = useState(false);
  const [template, setTemplate] = useState('age-limit');
  const [keywords, setKeywords] = useState('');
  const [examInput, setExamInput] = useState('');
  const [stateInput, setStateInput] = useState('');
  const [deptInput, setDeptInput] = useState('');
  const [yearInput, setYearInput] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
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

      const topics: TopicInput[] = topicLines.map(kw => ({
        keyword: kw, template, exam: examInput, state: stateInput, department: deptInput, year: yearInput,
      }));

      // Cross-batch dedup
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

  // ── Generate ──
  const handleGenerate = async () => {
    if (topicLines.length === 0) { toast({ title: 'Enter at least one keyword', variant: 'destructive' }); return; }
    if (topicLines.length > 50) { toast({ title: 'Maximum 50 keywords at a time', variant: 'destructive' }); return; }
    if (!user) { toast({ title: 'Not authenticated', variant: 'destructive' }); return; }

    const tmpl = getTemplate(template);
    if (!tmpl) { toast({ title: 'Select a valid template', variant: 'destructive' }); return; }

    abortRef.current = false;
    setIsGenerating(true);
    setResults(topicLines.map(kw => ({ keyword: kw, status: 'queued' })));

    for (let i = 0; i < topicLines.length; i++) {
      if (abortRef.current) {
        setResults(prev => prev.map((r, idx) => idx >= i && r.status === 'queued' ? { ...r, status: 'failed', error: 'Stopped' } : r));
        toast({ title: '⏹️ Generation stopped' });
        break;
      }

      setResults(prev => prev.map((r, idx) => idx === i ? { ...r, status: 'generating' } : r));

      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error('Not authenticated');

        const { data, error } = await supabase.functions.invoke('generate-blog-article', {
          body: {
            topic: topicLines[i],
            category: 'Government Jobs',
            targetWordCount: effectiveWordCount,
            aiModel,
            outputLanguage,
            contentMode: 'long_tail_seo',
            pageTemplate: template,
            primaryKeyword: topicLines[i],
            targetExam: examInput || undefined,
            targetState: stateInput || undefined,
            targetDepartment: deptInput || undefined,
            targetYear: yearInput || undefined,
            officialSourceUrl: sourceUrl || undefined,
          },
        });
        if (error) throw new Error(error.message);
        if (!data?.title || !data?.content) throw new Error('Invalid AI response');

        const wc = data.wordCountValidation?.actualWordCount || calcLiveWordCount(data.content);

        // Quality gates
        const qualityResult = runQualityGates(data.content, template, {
          officialSourceUrl: sourceUrl || undefined,
          wordCount: wc,
        });

        // Duplicate score (quick slug check)
        let dupScore = 0;
        let dupReason: string | null = null;
        const dupCheck = dupResults.find(d => d.keyword === topicLines[i]);
        if (dupCheck && dupCheck.matches.length > 0) {
          dupScore = dupCheck.matches[0].similarity;
          dupReason = dupCheck.matches[0].reason;
        }

        const staleAfter = computeStaleAfter(template, yearInput || undefined);
        const slug = (data.slug || data.title)
          .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').substring(0, 120);

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
          // Long-tail specific fields
          content_mode: 'long_tail_seo',
          page_template: template,
          primary_keyword: topicLines[i],
          secondary_keywords: data.secondaryKeywords || [],
          search_intent: tmpl.label,
          target_exam: examInput || null,
          target_state: stateInput || null,
          target_department: deptInput || null,
          target_year: yearInput || null,
          official_source_url: sourceUrl || null,
          official_source_label: sourceUrl ? 'Official Source' : null,
          fact_confidence: sourceUrl ? 'source_provided' : 'ai_inferred',
          duplicate_risk_score: dupScore,
          duplicate_risk_reason: dupReason,
          thin_content_risk: !qualityResult.passed,
          thin_content_reason: qualityResult.reason,
          noindex: !qualityResult.passed || dupScore > 70,
          review_status: 'pending',
          stale_after: staleAfter,
          long_tail_metadata: {
            templateUsed: template,
            qualityScore: qualityResult.score,
            qualityChecks: qualityResult.checks,
            modelUsed: aiModel,
          },
        } as any).select('id').single();

        if (insertErr) throw new Error(insertErr.message);

        setResults(prev => prev.map((r, idx) => idx === i ? {
          ...r, status: 'success', articleId: inserted?.id, slug,
          thinRisk: !qualityResult.passed, dupScore, qualityScore: qualityResult.score,
        } : r));
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
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error('Not authenticated');

        const tmpl = getTemplate(template)!;
        const { data, error } = await supabase.functions.invoke('generate-blog-article', {
          body: {
            topic: results[i].keyword,
            category: 'Government Jobs',
            targetWordCount: effectiveWordCount,
            aiModel,
            outputLanguage,
            contentMode: 'long_tail_seo',
            pageTemplate: template,
            primaryKeyword: results[i].keyword,
            targetExam: examInput || undefined,
            targetState: stateInput || undefined,
            targetDepartment: deptInput || undefined,
            targetYear: yearInput || undefined,
            officialSourceUrl: sourceUrl || undefined,
          },
        });
        if (error) throw new Error(error.message);
        if (!data?.title || !data?.content) throw new Error('Invalid AI response');

        const wc = data.wordCountValidation?.actualWordCount || calcLiveWordCount(data.content);
        const qualityResult = runQualityGates(data.content, template, { officialSourceUrl: sourceUrl || undefined, wordCount: wc });
        const staleAfter = computeStaleAfter(template, yearInput || undefined);
        const slug = (data.slug || data.title).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').substring(0, 120);

        const { data: inserted, error: insertErr } = await supabase.from('blog_posts').insert({
          title: data.title, slug, content: data.content,
          excerpt: data.excerpt || null, meta_title: data.metaTitle || null,
          meta_description: data.metaDescription || null,
          category: normalizeBlogCategory(data.category || 'Government Jobs'),
          tags: data.tags || [], author_id: user!.id, author_name: 'TrueJobs Editorial Team',
          canonical_url: `https://truejobs.co.in/blog/${slug}`,
          is_published: false, word_count: wc, reading_time: Math.max(1, Math.ceil(wc / 200)),
          content_mode: 'long_tail_seo', page_template: template,
          primary_keyword: results[i].keyword, search_intent: tmpl.label,
          target_exam: examInput || null, target_state: stateInput || null,
          target_department: deptInput || null, target_year: yearInput || null,
          official_source_url: sourceUrl || null,
          fact_confidence: sourceUrl ? 'source_provided' : 'ai_inferred',
          thin_content_risk: !qualityResult.passed, thin_content_reason: qualityResult.reason,
          noindex: !qualityResult.passed, review_status: 'pending',
          stale_after: staleAfter,
          long_tail_metadata: { templateUsed: template, qualityScore: qualityResult.score, modelUsed: aiModel },
        } as any).select('id').single();

        if (insertErr) throw new Error(insertErr.message);
        setResults(prev => prev.map((r, idx) => idx === i ? {
          ...r, status: 'success', articleId: inserted?.id, slug,
          thinRisk: !qualityResult.passed, qualityScore: qualityResult.score,
        } : r));
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
            Generate intent-driven SEO landing pages (age limit, salary, eligibility, syllabus, etc.) with template-aware structure, duplicate detection, and quality gates.
          </p>

          {/* Template + metadata row */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            <div className="space-y-1">
              <Label className="text-[11px]">Template</Label>
              <Select value={template} onValueChange={setTemplate}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TEMPLATE_OPTIONS.map(t => (
                    <SelectItem key={t.value} value={t.value} className="text-xs">
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-[11px]">Exam (optional)</Label>
              <Input value={examInput} onChange={e => setExamInput(e.target.value)} placeholder="SSC CGL" className="h-8 text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px]">State (optional)</Label>
              <Input value={stateInput} onChange={e => setStateInput(e.target.value)} placeholder="Uttar Pradesh" className="h-8 text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px]">Department (optional)</Label>
              <Input value={deptInput} onChange={e => setDeptInput(e.target.value)} placeholder="Ministry of Defence" className="h-8 text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px]">Year (optional)</Label>
              <Input value={yearInput} onChange={e => setYearInput(e.target.value)} placeholder="2026" className="h-8 text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px]">Official Source URL</Label>
              <Input value={sourceUrl} onChange={e => setSourceUrl(e.target.value)} placeholder="https://ssc.gov.in/..." className="h-8 text-xs" />
            </div>
          </div>

          {/* Keywords input */}
          <div className="space-y-1">
            <Label className="text-xs">Keywords (one per line, max 50)</Label>
            <Textarea
              value={keywords}
              onChange={e => { setKeywords(e.target.value); setDupResults([]); }}
              placeholder={"ssc cgl age limit for obc\nupsc age limit for female candidates\nrailway group d salary after 7th pay commission"}
              rows={6}
              className="text-xs"
            />
            <p className="text-xs text-muted-foreground">
              {topicLines.length} / 50 keywords • Template: {getTemplateLabel(template)}
            </p>
          </div>

          {/* Duplicate checker */}
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

          {/* Controls row */}
          <div className="flex flex-wrap items-end gap-2">
            {/* Word count */}
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
                  className="h-7 text-xs px-2"
                  onClick={() => setIsCustomWc(true)}>
                  Custom
                </Button>
                {isCustomWc && (
                  <Input value={customWordCount} onChange={e => setCustomWordCount(e.target.value)}
                    placeholder="1000" className="h-7 w-16 text-xs" type="number" min={500} max={3000} />
                )}
              </div>
            </div>

            {/* Language */}
            <div className="space-y-1">
              <Label className="text-[11px]">Language</Label>
              <Select value={outputLanguage} onValueChange={handleLangChange}>
                <SelectTrigger className="h-7 text-xs w-[90px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto" className="text-xs">Auto</SelectItem>
                  <SelectItem value="english" className="text-xs">English</SelectItem>
                  <SelectItem value="hindi" className="text-xs">Hindi</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Model */}
            <div className="space-y-1">
              <Label className="text-[11px]">AI Model</Label>
              <AiModelSelector value={aiModel} onValueChange={handleModelChange} capability="text" size="sm"
                wordTarget={effectiveWordCount} triggerClassName="w-[180px] h-7 text-xs" />
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
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

          {/* Results */}
          {results.length > 0 && (
            <div className="space-y-1 max-h-60 overflow-y-auto">
              <p className="text-[11px] text-muted-foreground">
                {successCount} success, {failedCount} failed, {results.filter(r => r.status === 'queued').length} queued
              </p>
              {results.map((r, i) => (
                <div key={i} className="flex items-center gap-2 text-xs py-1 border-b last:border-0">
                  {r.status === 'queued' && <div className="h-3 w-3 rounded-full bg-muted" />}
                  {r.status === 'generating' && <Loader2 className="h-3 w-3 animate-spin text-primary" />}
                  {r.status === 'success' && <Check className="h-3 w-3 text-green-600" />}
                  {r.status === 'failed' && <X className="h-3 w-3 text-destructive" />}
                  <span className="flex-1 truncate">{r.keyword}</span>
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
