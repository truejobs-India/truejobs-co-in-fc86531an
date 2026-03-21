import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Search, Loader2, AlertTriangle, XCircle, CheckCircle2, ChevronDown,
  Sparkles, FileText, Download, Globe, Filter, Zap, Square, RotateCcw,
  SkipForward, Eye, History, ArrowLeft, Clock, RefreshCw, Wrench,
} from 'lucide-react';
import { UnresolvedSeoResolver } from '@/components/admin/UnresolvedSeoResolver';
import { AiModelSelector, getLastUsedModel } from '@/components/admin/AiModelSelector';
import { useAdminToast as useToast } from '@/contexts/AdminMessagesContext';
import {
  runSitewideSeoAudit,
  type SeoAuditReport,
  type SeoAuditIssue,
  type ContentSource,
  type IssueSeverity,
  type IssueCategory,
} from '@/lib/sitewideSeoAudit';
import {
  executeFixAll,
  executeRetry,
  type FixResult,
  type FixProgress,
  type RetryFilter,
} from '@/lib/seoFixEngine';
import {
  saveAuditRun,
  saveFixRun,
  fetchAuditHistory,
  fetchAuditRunById,
  type AuditRunRecord,
} from '@/lib/seoAuditHistory';
import {
  SEO_FIX_MODEL_VALUES,
  getModelLabel,
  normalizeAiModelValue,
} from '@/lib/aiModels';

// ═══════════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════════

const SOURCE_LABELS: Record<ContentSource, string> = {
  blog_posts: 'Blog Articles',
  pdf_resources: 'PDF Resources',
  custom_pages: 'Custom Pages',
};

const SOURCE_ICONS: Record<ContentSource, typeof FileText> = {
  blog_posts: FileText,
  pdf_resources: Download,
  custom_pages: Globe,
};

const SEVERITY_COLORS: Record<IssueSeverity, string> = {
  critical: 'bg-destructive/15 text-destructive border-destructive/30',
  high: 'bg-orange-500/15 text-orange-700 border-orange-500/30',
  medium: 'bg-amber-500/15 text-amber-700 border-amber-500/30',
  low: 'bg-muted text-muted-foreground border-border',
};

const CATEGORY_LABELS: Record<IssueCategory, string> = {
  meta_title: 'Meta Title',
  meta_description: 'Meta Description',
  canonical_url: 'Canonical URL',
  excerpt: 'Excerpt / Summary',
  featured_image_alt: 'Image Alt Text',
  slug: 'Slug',
  h1: 'H1 Heading',
  heading_structure: 'Heading Structure',
  internal_links: 'Internal Links',
  faq_opportunity: 'FAQ Opportunity',
  faq_schema: 'FAQ Schema',
  content_thin: 'Thin Content',
  intro_missing: 'Intro Missing',
  compliance: 'Compliance',
};

const RETRY_CATEGORIES: IssueCategory[] = [
  'h1', 'canonical_url', 'internal_links', 'faq_opportunity',
  'meta_description', 'featured_image_alt', 'meta_title', 'excerpt',
];

type WorkflowPhase = 'idle' | 'scanning' | 'report' | 'fixing' | 'done';

// ═══════════════════════════════════════════════════════════════
// Component
// ═══════════════════════════════════════════════════════════════

export function SitewideSeoAudit() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<string>('audit');
  const [report, setReport] = useState<SeoAuditReport | null>(null);
  const [phase, setPhase] = useState<WorkflowPhase>('idle');
  const [progressMsg, setProgressMsg] = useState('');
  const [aiModel, setAiModel] = useState(() => getLastUsedModel('text', 'gemini-pro', SEO_FIX_MODEL_VALUES));

  // Fix state
  const [fixProgress, setFixProgress] = useState<FixProgress | null>(null);
  const [fixResults, setFixResults] = useState<FixResult[]>([]);
  const stopSignal = useRef({ stopped: false });

  // Persistence refs
  const scanStartedAt = useRef<Date | null>(null);
  const fixStartedAt = useRef<Date | null>(null);
  const fixWarnings = useRef<string[]>([]);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSource, setFilterSource] = useState<string>('all');
  const [filterSeverity, setFilterSeverity] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterFixable, setFilterFixable] = useState<string>('all');

  useEffect(() => {
    const normalized = normalizeAiModelValue(aiModel, 'gemini-pro');
    const safeModel = SEO_FIX_MODEL_VALUES.includes(normalized as typeof SEO_FIX_MODEL_VALUES[number])
      ? normalized
      : 'gemini-pro';

    if (safeModel !== aiModel) {
      setAiModel(safeModel);
      try {
        localStorage.setItem('ai_model_last_text', safeModel);
      } catch {}
    }
  }, [aiModel]);

  const handleScan = async () => {
    setPhase('scanning');
    setReport(null);
    setFixResults([]);
    setFixProgress(null);
    scanStartedAt.current = new Date();
    try {
      const result = await runSitewideSeoAudit(setProgressMsg);
      setReport(result);
      setPhase('report');
      toast({ title: `SEO Audit Complete`, description: `${result.issues.length} issues found across ${Object.values(result.totalScanned).reduce((a, b) => a + b, 0)} pages` });

      await saveAuditRun(result, scanStartedAt.current);
    } catch (err: any) {
      toast({ title: 'Scan failed', description: err.message, variant: 'destructive' });
      setPhase('idle');
    } finally {
      setProgressMsg('');
    }
  };

  const handleFixAll = useCallback(async () => {
    if (!report) return;
    const autoFixableIssues = report.issues.filter(i => i.autoFixable);
    if (autoFixableIssues.length === 0) {
      toast({ title: 'Nothing to fix', description: 'No auto-fixable issues found.' });
      return;
    }

    const safeModel = SEO_FIX_MODEL_VALUES.includes(aiModel as typeof SEO_FIX_MODEL_VALUES[number]) ? aiModel : 'gemini-pro';

    setPhase('fixing');
    stopSignal.current = { stopped: false };
    setFixResults([]);
    fixStartedAt.current = new Date();
    fixWarnings.current = [];

    try {
      const results = await executeFixAll(
        autoFixableIssues,
        safeModel,
        (p) => {
          if (p.lastWarning) {
            fixWarnings.current.push(p.lastWarning);
            toast({ title: 'AI Response Warning', description: p.lastWarning, variant: 'destructive' });
          }
          setFixProgress({ ...p, currentModel: safeModel });
        },
        stopSignal.current,
      );
      setFixResults(results);
      setPhase('done');

      const fixed = results.filter(r => r.status === 'fixed').length;
      const failed = results.filter(r => r.status === 'failed').length;
      const review = results.filter(r => r.status === 'review_required').length;
      toast({
        title: stopSignal.current.stopped ? 'Fix All Stopped' : 'Fix All Complete',
        description: `${fixed} fixed, ${failed} failed, ${review} need review`,
      });

      await saveFixRun(report, results, safeModel, fixStartedAt.current!, fixWarnings.current);
    } catch (err: any) {
      toast({ title: 'Fix All failed', description: err.message, variant: 'destructive' });
      setPhase('report');
    }
  }, [report, aiModel, toast]);

  // ── Retry handlers ──

  const handleRetry = useCallback(async (filter: RetryFilter, label: string) => {
    if (!report) return;
    const safeModel = SEO_FIX_MODEL_VALUES.includes(aiModel as typeof SEO_FIX_MODEL_VALUES[number]) ? aiModel : 'gemini-pro';

    setPhase('fixing');
    stopSignal.current = { stopped: false };
    fixStartedAt.current = new Date();
    fixWarnings.current = [];

    try {
      const retryResults = await executeRetry(
        report.issues,
        fixResults,
        filter,
        safeModel,
        (p) => {
          if (p.lastWarning) {
            fixWarnings.current.push(p.lastWarning);
          }
          setFixProgress({ ...p, currentModel: safeModel });
        },
        stopSignal.current,
      );

      if (retryResults.length === 0) {
        toast({ title: 'Nothing to retry', description: `No eligible items for: ${label}` });
        setPhase('done');
        return;
      }

      // Merge retry results: replace previous results for the same issueIds
      const retryIdMap = new Map(retryResults.map(r => [r.issueId, r]));
      const mergedResults = fixResults.map(r => retryIdMap.get(r.issueId) || r);
      // Add any new results not in previous
      for (const r of retryResults) {
        if (!mergedResults.some(m => m.issueId === r.issueId)) {
          mergedResults.push(r);
        }
      }

      setFixResults(mergedResults);
      setPhase('done');

      const fixed = retryResults.filter(r => r.status === 'fixed').length;
      const failed = retryResults.filter(r => r.status === 'failed').length;
      toast({
        title: `Retry Complete: ${label}`,
        description: `${retryResults.length} retried → ${fixed} fixed, ${failed} failed`,
      });

      await saveFixRun(report, mergedResults, safeModel, fixStartedAt.current!, fixWarnings.current);
    } catch (err: any) {
      toast({ title: 'Retry failed', description: err.message, variant: 'destructive' });
      setPhase('done');
    }
  }, [report, fixResults, aiModel, toast]);

  const handleStop = () => {
    stopSignal.current.stopped = true;
  };

  const handleReset = () => {
    setPhase('idle');
    setReport(null);
    setFixResults([]);
    setFixProgress(null);
  };

  const filteredIssues = useMemo(() => {
    if (!report) return [];
    return report.issues.filter(issue => {
      if (filterSource !== 'all' && issue.source !== filterSource) return false;
      if (filterSeverity !== 'all' && issue.severity !== filterSeverity) return false;
      if (filterCategory !== 'all' && issue.category !== filterCategory) return false;
      if (filterFixable === 'auto' && !issue.autoFixable) return false;
      if (filterFixable === 'review' && issue.autoFixable) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!issue.slug.toLowerCase().includes(q) && !issue.title.toLowerCase().includes(q) && !issue.message.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [report, filterSource, filterSeverity, filterCategory, filterFixable, searchQuery]);

  const groupedByPage = useMemo(() => {
    const map = new Map<string, { source: ContentSource; slug: string; title: string; isPublished: boolean; issues: SeoAuditIssue[] }>();
    for (const issue of filteredIssues) {
      const key = `${issue.source}:${issue.recordId}`;
      if (!map.has(key)) {
        map.set(key, { source: issue.source, slug: issue.slug, title: issue.title, isPublished: issue.isPublished, issues: [] });
      }
      map.get(key)!.issues.push(issue);
    }
    return Array.from(map.values()).sort((a, b) => {
      const sevOrder: Record<IssueSeverity, number> = { critical: 0, high: 1, medium: 2, low: 3 };
      const aMax = Math.min(...a.issues.map(i => sevOrder[i.severity]));
      const bMax = Math.min(...b.issues.map(i => sevOrder[i.severity]));
      return aMax - bMax;
    });
  }, [filteredIssues]);

  const activeCategories = useMemo(() => {
    if (!report) return [];
    return Array.from(new Set(report.issues.map(i => i.category))).sort();
  }, [report]);

  // Stats for retry controls
  const failedCount = fixResults.filter(r => r.status === 'failed').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Search className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-xl">Site-Wide SEO Audit & Fix</CardTitle>
              <p className="text-sm text-muted-foreground mt-0.5">
                Scan all content for SEO issues, then fix automatically with AI
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-4">
              <TabsTrigger value="audit">
                <Search className="h-3.5 w-3.5 mr-1.5" />
                Audit & Fix
              </TabsTrigger>
              <TabsTrigger value="history">
                <History className="h-3.5 w-3.5 mr-1.5" />
                Run History
              </TabsTrigger>
              <TabsTrigger value="resolve">
                <Wrench className="h-3.5 w-3.5 mr-1.5" />
                Resolve Unfixed
              </TabsTrigger>
            </TabsList>

            <TabsContent value="audit" className="mt-0 space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <Button onClick={handleScan} disabled={phase === 'scanning' || phase === 'fixing'} size="lg">
                  {phase === 'scanning' ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
                  {phase === 'scanning' ? 'Scanning…' : 'Run Full SEO Audit'}
                </Button>

                <div className="flex items-center gap-2 ml-auto">
                  <span className="text-xs text-muted-foreground">AI Model:</span>
                  <AiModelSelector
                    value={aiModel}
                    onValueChange={setAiModel}
                    capability="text"
                    size="sm"
                    triggerClassName="w-[200px]"
                    allowedValues={SEO_FIX_MODEL_VALUES}
                  />
                </div>

                {phase === 'fixing' ? (
                  <Button size="lg" variant="destructive" onClick={handleStop}>
                    <Square className="h-4 w-4 mr-2" /> Stop
                  </Button>
                ) : (
                  <Button
                    size="lg"
                    disabled={!report || report.summary.autoFixable === 0 || phase === 'scanning'}
                    className="bg-gradient-to-r from-primary to-primary/80"
                    onClick={handleFixAll}
                  >
                    <Zap className="h-4 w-4 mr-2" />
                    Fix All Using AI
                    {report && report.summary.autoFixable > 0 && (
                      <Badge variant="secondary" className="ml-2 bg-white/20 text-white">{report.summary.autoFixable}</Badge>
                    )}
                  </Button>
                )}

                {phase === 'done' && (
                  <Button size="sm" variant="outline" onClick={handleReset}>
                    <RotateCcw className="h-3 w-3 mr-1" /> Start Fresh
                  </Button>
                )}
              </div>

              {phase === 'scanning' && (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">{progressMsg}</p>
                  <Progress value={undefined} className="h-1.5" />
                </div>
              )}

              {phase === 'fixing' && fixProgress && <FixProgressBar progress={fixProgress} />}

              {phase === 'done' && fixResults.length > 0 && <FixSummaryBar results={fixResults} />}

              {/* ── Retry Controls (shown after fix completes with failures) ── */}
              {phase === 'done' && report && failedCount > 0 && (
                <RetryControls
                  report={report}
                  fixResults={fixResults}
                  onRetry={handleRetry}
                  disabled={false}
                />
              )}

              {phase === 'report' && report && (
                <p className="text-xs text-muted-foreground">
                  {report.summary.autoFixable} auto-fixable issues will be processed using <strong>{getModelLabel(aiModel)}</strong>.
                  {report.summary.reviewRequired > 0 && ` ${report.summary.reviewRequired} issues require manual review and will be skipped.`}
                </p>
              )}
            </TabsContent>

            <TabsContent value="history" className="mt-0">
              <AuditHistoryPanel />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Summary cards — only on audit tab */}
      {activeTab === 'audit' && report && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {(Object.entries(report.totalScanned) as [ContentSource, number][]).map(([src, count]) => {
            const Icon = SOURCE_ICONS[src];
            return (
              <Card key={src} className="cursor-pointer hover:shadow-sm" onClick={() => setFilterSource(filterSource === src ? 'all' : src)}>
                <CardContent className="p-3 text-center">
                  <Icon className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                  <div className="text-lg font-bold">{count}</div>
                  <div className="text-[10px] text-muted-foreground">{SOURCE_LABELS[src]}</div>
                  <div className="text-xs font-medium" style={{ color: 'hsl(var(--primary))' }}>{report.summary.bySource[src]} issues</div>
                </CardContent>
              </Card>
            );
          })}
          {(['critical', 'high', 'medium', 'low'] as IssueSeverity[]).map(sev => (
            <Card key={sev} className="cursor-pointer hover:shadow-sm" onClick={() => setFilterSeverity(filterSeverity === sev ? 'all' : sev)}>
              <CardContent className="p-3 text-center">
                <div className={`text-lg font-bold ${sev === 'critical' ? 'text-destructive' : sev === 'high' ? 'text-orange-600' : sev === 'medium' ? 'text-amber-600' : 'text-muted-foreground'}`}>
                  {report.summary.bySeverity[sev]}
                </div>
                <div className="text-[10px] text-muted-foreground capitalize">{sev}</div>
              </CardContent>
            </Card>
          ))}
          <Card className="cursor-pointer hover:shadow-sm border-primary/30" onClick={() => setFilterFixable(filterFixable === 'auto' ? 'all' : 'auto')}>
            <CardContent className="p-3 text-center">
              <Sparkles className="h-4 w-4 mx-auto mb-1 text-primary" />
              <div className="text-lg font-bold text-primary">{report.summary.autoFixable}</div>
              <div className="text-[10px] text-muted-foreground">Auto-Fixable</div>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:shadow-sm" onClick={() => setFilterFixable(filterFixable === 'review' ? 'all' : 'review')}>
            <CardContent className="p-3 text-center">
              <AlertTriangle className="h-4 w-4 mx-auto mb-1" style={{ color: 'hsl(var(--muted-foreground))' }} />
              <div className="text-lg font-bold">{report.summary.reviewRequired}</div>
              <div className="text-[10px] text-muted-foreground">Review Required</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Fix results detail */}
      {activeTab === 'audit' && phase === 'done' && fixResults.length > 0 && (
        <FixResultsPanel results={fixResults} />
      )}

      {/* Filters + Issues */}
      {activeTab === 'audit' && report && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search by slug, title, or issue…" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-60 h-8 text-xs" />
              <Select value={filterSource} onValueChange={setFilterSource}>
                <SelectTrigger className="w-[140px] h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sources</SelectItem>
                  {(Object.keys(SOURCE_LABELS) as ContentSource[]).map(s => (
                    <SelectItem key={s} value={s}>{SOURCE_LABELS[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterSeverity} onValueChange={setFilterSeverity}>
                <SelectTrigger className="w-[120px] h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Severity</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger className="w-[160px] h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {activeCategories.map(c => <SelectItem key={c} value={c}>{CATEGORY_LABELS[c as IssueCategory] || c}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={filterFixable} onValueChange={setFilterFixable}>
                <SelectTrigger className="w-[140px] h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="auto">Auto-Fixable</SelectItem>
                  <SelectItem value="review">Review Required</SelectItem>
                </SelectContent>
              </Select>
              <span className="ml-auto text-xs text-muted-foreground">
                {filteredIssues.length} issues across {groupedByPage.length} pages
              </span>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {Object.keys(report.summary.byCategory).length > 0 && (
              <div className="px-4 pb-3 flex flex-wrap gap-1.5">
                {Object.entries(report.summary.byCategory).sort(([, a], [, b]) => b - a).map(([cat, count]) => (
                  <Badge key={cat} variant="outline" className={`text-[10px] cursor-pointer ${filterCategory === cat ? 'bg-primary/10 border-primary' : ''}`} onClick={() => setFilterCategory(filterCategory === cat ? 'all' : cat)}>
                    {CATEGORY_LABELS[cat as IssueCategory] || cat}: {count}
                  </Badge>
                ))}
              </div>
            )}
            <ScrollArea className="max-h-[600px]">
              <div className="divide-y">
                {groupedByPage.length === 0 && (
                  <div className="p-8 text-center text-muted-foreground text-sm">
                    {report.issues.length === 0 ? (
                      <div className="flex flex-col items-center gap-2">
                        <CheckCircle2 className="h-8 w-8" style={{ color: 'hsl(var(--primary))' }} />
                        <p>No SEO issues found! All content looks healthy.</p>
                      </div>
                    ) : 'No issues match current filters.'}
                  </div>
                )}
                {groupedByPage.map(page => (
                  <PageIssueRow key={`${page.source}:${page.slug}`} page={page} fixResults={fixResults} />
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Retry Controls Panel
// ═══════════════════════════════════════════════════════════════

function RetryControls({
  report,
  fixResults,
  onRetry,
  disabled,
}: {
  report: SeoAuditReport;
  fixResults: FixResult[];
  onRetry: (filter: RetryFilter, label: string) => void;
  disabled?: boolean;
}) {
  const failedCount = fixResults.filter(r => r.status === 'failed').length;
  const failedSources = new Set(fixResults.filter(r => r.status === 'failed').map(r => r.source));
  const failedCategories = new Set(fixResults.filter(r => r.status === 'failed').map(r => r.category));

  return (
    <Card className="border-amber-500/20 bg-amber-50/30 dark:bg-amber-950/10">
      <CardContent className="p-3 space-y-2">
        <div className="flex items-center gap-2 text-xs font-medium text-amber-800 dark:text-amber-400">
          <RefreshCw className="h-3.5 w-3.5" />
          Targeted Retry — {failedCount} failed items
        </div>

        <div className="flex flex-wrap gap-2">
          {/* Retry Failed Only */}
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-[10px] border-amber-500/40 hover:bg-amber-100/50"
            disabled={disabled || failedCount === 0}
            onClick={() => onRetry({ type: 'failed_only' }, 'Failed Items Only')}
          >
            <RefreshCw className="h-3 w-3 mr-1" />
            Retry All Failed ({failedCount})
          </Button>

          {/* Retry By Source */}
          {(['blog_posts', 'pdf_resources', 'custom_pages'] as ContentSource[]).map(src => {
            const srcFailed = fixResults.filter(r => r.status === 'failed' && r.source === src).length;
            if (srcFailed === 0) return null;
            return (
              <Button
                key={src}
                size="sm"
                variant="outline"
                className="h-7 text-[10px]"
                disabled={disabled}
                onClick={() => onRetry({ type: 'by_source', source: src }, SOURCE_LABELS[src])}
              >
                {SOURCE_LABELS[src]} ({srcFailed})
              </Button>
            );
          })}
        </div>

        {/* Retry By Category */}
        <div className="flex flex-wrap gap-1.5">
          {RETRY_CATEGORIES.map(cat => {
            const catFailed = fixResults.filter(r => r.status === 'failed' && r.category === cat).length;
            if (catFailed === 0) return null;
            return (
              <Badge
                key={cat}
                variant="outline"
                className="text-[9px] cursor-pointer hover:bg-primary/10 transition-colors"
                onClick={() => !disabled && onRetry({ type: 'by_category', category: cat }, CATEGORY_LABELS[cat])}
              >
                {CATEGORY_LABELS[cat]}: {catFailed} failed
              </Badge>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════
// Audit History Panel
// ═══════════════════════════════════════════════════════════════

function AuditHistoryPanel() {
  const [runs, setRuns] = useState<AuditRunRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRun, setSelectedRun] = useState<AuditRunRecord | null>(null);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    setLoading(true);
    const data = await fetchAuditHistory(30);
    setRuns(data);
    setLoading(false);
  };

  if (selectedRun) {
    return <RunDetailView run={selectedRun} onBack={() => setSelectedRun(null)} />;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        Loading history…
      </div>
    );
  }

  if (runs.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground text-sm">
        <History className="h-8 w-8 mx-auto mb-2 opacity-40" />
        <p>No audit or fix runs recorded yet.</p>
        <p className="text-xs mt-1">Run an SEO audit to start building history.</p>
      </div>
    );
  }

  const downloadHistoryTxt = () => {
    const lines: string[] = [];
    lines.push('═══════════════════════════════════════════════════════════════');
    lines.push('  SITE-WIDE SEO AUDIT & FIX — COMPLETE HISTORY REPORT');
    lines.push(`  Generated: ${new Date().toLocaleString()}`);
    lines.push(`  Total Runs: ${runs.length}`);
    lines.push('═══════════════════════════════════════════════════════════════');
    lines.push('');

    const byDate: Record<string, AuditRunRecord[]> = {};
    for (const run of runs) {
      const dateKey = new Date(run.started_at).toLocaleDateString('en-IN', {
        year: 'numeric', month: 'long', day: 'numeric', weekday: 'long',
      });
      if (!byDate[dateKey]) byDate[dateKey] = [];
      byDate[dateKey].push(run);
    }

    for (const [date, dateRuns] of Object.entries(byDate)) {
      lines.push(`━━━ ${date} (${dateRuns.length} run${dateRuns.length > 1 ? 's' : ''}) ━━━`);
      lines.push('');

      for (const run of dateRuns) {
        const startTime = new Date(run.started_at).toLocaleTimeString();
        const endTime = run.completed_at ? new Date(run.completed_at).toLocaleTimeString() : 'N/A';
        const durationSec = run.completed_at
          ? Math.round((new Date(run.completed_at).getTime() - new Date(run.started_at).getTime()) / 1000)
          : null;

        lines.push(`  ┌─ ${run.run_type === 'fix' ? '⚡ FIX ALL RUN' : '🔍 SEO AUDIT SCAN'}`);
        lines.push(`  │  ID: ${run.id}`);
        lines.push(`  │  Started: ${startTime}  |  Ended: ${endTime}${durationSec ? `  |  Duration: ${durationSec}s` : ''}`);
        if (run.ai_model) lines.push(`  │  AI Model: ${run.ai_model}`);

        const scanned = run.total_scanned as Record<string, number>;
        if (scanned && Object.keys(scanned).length > 0) {
          const parts = Object.entries(scanned).map(([k, v]) => `${k}: ${v}`);
          lines.push(`  │  Scanned: ${parts.join(', ')}`);
        }

        lines.push(`  │  Issues Found (scan phase): ${run.total_issues}`);

        if (run.run_type === 'fix') {
          const summary = run.issue_summary as Record<string, any>;
          const attempted = summary?.fixesAttempted ?? (run.total_fixed + run.total_failed + run.total_skipped + run.total_review_required);
          lines.push(`  │  Fixes Attempted: ${attempted}`);
          lines.push(`  │  ✅ Fixes Applied (DB saved): ${run.total_fixed}`);
          lines.push(`  │  ❌ Fixes Failed: ${run.total_failed}`);
          lines.push(`  │  ⏭️  Fixes Skipped (no AI output): ${run.total_skipped}`);
          lines.push(`  │  👁️  Review Required: ${run.total_review_required}`);
          if (summary?.reviewRequired_scan != null) {
            lines.push(`  │  📋 Non-auto-fixable (scan phase): ${summary.reviewRequired_scan}`);
          }
        }

        const summary = run.issue_summary as Record<string, any>;
        if (summary) {
          if (summary.bySeverity && Object.keys(summary.bySeverity).length > 0) {
            lines.push(`  │  By Severity: ${Object.entries(summary.bySeverity).map(([k, v]) => `${k}=${v}`).join(', ')}`);
          }
          if (summary.byCategory && Object.keys(summary.byCategory).length > 0) {
            lines.push(`  │  By Category: ${Object.entries(summary.byCategory).map(([k, v]) => `${k}=${v}`).join(', ')}`);
          }
        }

        // Warnings (deduplicated)
        if (run.warnings && run.warnings.length > 0) {
          const uniqueWarnings = Array.from(new Set(run.warnings));
          lines.push(`  │  ⚠️  Warnings (${uniqueWarnings.length} unique):`);
          for (const w of uniqueWarnings) {
            lines.push(`  │    - ${w}`);
          }
        }

        const fixes = (run.fix_details || []) as any[];
        if (fixes.length > 0) {
          lines.push(`  │`);
          lines.push(`  │  ── Fix Details (${fixes.length} entries) ──`);

          const grouped: Record<string, any[]> = { fixed: [], failed: [], review_required: [], skipped: [] };
          for (const f of fixes) {
            const status = f.status || 'unknown';
            if (!grouped[status]) grouped[status] = [];
            grouped[status].push(f);
          }

          for (const [status, items] of Object.entries(grouped)) {
            if (items.length === 0) continue;
            const icon = status === 'fixed' ? '✅' : status === 'failed' ? '❌' : status === 'review_required' ? '👁️' : '⏭️';
            lines.push(`  │`);
            lines.push(`  │  ${icon} ${status.toUpperCase()} (${items.length}):`);
            for (const item of items) {
              const slug = item.slug || 'unknown';
              const source = item.source || '';
              const category = item.category || '';
              const field = item.field ? ` [${item.field}]` : '';
              const reason = item.reason ? ` — ${item.reason}` : '';
              const after = item.afterValue ? ` → "${item.afterValue}"` : '';
              const verify = item.verificationPassed === false ? ' ⚠️VERIFY_FAIL' : '';
              lines.push(`  │    • ${slug} (${source}/${category})${field}${reason}${after}${verify}`);
            }
          }
        }

        lines.push(`  └──────────────────────────────────────────`);
        lines.push('');
      }
    }

    lines.push('═══════════════════════════════════════════════════════════════');
    lines.push('  END OF REPORT');
    lines.push('═══════════════════════════════════════════════════════════════');

    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SEO_Audit_History_${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-muted-foreground">{runs.length} past runs</p>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={downloadHistoryTxt} className="h-7 text-xs">
            <Download className="h-3 w-3 mr-1" /> Download .txt
          </Button>
          <Button size="sm" variant="ghost" onClick={loadHistory} className="h-7 text-xs">
            <RotateCcw className="h-3 w-3 mr-1" /> Refresh
          </Button>
        </div>
      </div>
      <ScrollArea className="max-h-[500px]">
        <div className="space-y-2">
          {runs.map(run => (
            <Card
              key={run.id}
              className="cursor-pointer hover:shadow-sm transition-shadow"
              onClick={() => setSelectedRun(run)}
            >
              <CardContent className="p-3">
                <div className="flex items-center gap-3">
                  <div className={`p-1.5 rounded ${run.run_type === 'fix' ? 'bg-primary/10' : 'bg-muted'}`}>
                    {run.run_type === 'fix' ? (
                      <Zap className="h-4 w-4 text-primary" />
                    ) : (
                      <Search className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium capitalize">{run.run_type === 'fix' ? 'Fix All Run' : 'SEO Audit'}</span>
                      {run.ai_model && (
                        <Badge variant="outline" className="text-[9px]">{run.ai_model.split('/').pop()}</Badge>
                      )}
                      {run.warnings && run.warnings.length > 0 && (
                        <Badge variant="outline" className="text-[9px] border-amber-500/40 text-amber-700">
                          {new Set(run.warnings).size} warning{new Set(run.warnings).size !== 1 ? 's' : ''}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground mt-0.5">
                      <Clock className="h-2.5 w-2.5" />
                      {new Date(run.started_at).toLocaleString()}
                      {run.completed_at && (
                        <span className="ml-1">
                          ({Math.round((new Date(run.completed_at).getTime() - new Date(run.started_at).getTime()) / 1000)}s)
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs shrink-0">
                    <span className="text-muted-foreground">{run.total_issues} issues</span>
                    {run.run_type === 'fix' && (
                      <>
                        <Badge variant="outline" className="text-[9px] border-primary/40 text-primary">✓ {run.total_fixed}</Badge>
                        {run.total_failed > 0 && (
                          <Badge variant="outline" className="text-[9px] border-destructive/40 text-destructive">✗ {run.total_failed}</Badge>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Run Detail View
// ═══════════════════════════════════════════════════════════════

function RunDetailView({ run, onBack }: { run: AuditRunRecord; onBack: () => void }) {
  const scanned = run.total_scanned as Record<string, number>;
  const summary = run.issue_summary as Record<string, any>;
  const fixes = (run.fix_details || []) as any[];
  const duration = run.completed_at
    ? Math.round((new Date(run.completed_at).getTime() - new Date(run.started_at).getTime()) / 1000)
    : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button size="sm" variant="ghost" onClick={onBack} className="h-7">
          <ArrowLeft className="h-3 w-3 mr-1" /> Back
        </Button>
        <div>
          <h3 className="text-sm font-semibold capitalize">
            {run.run_type === 'fix' ? 'Fix All Run' : 'SEO Audit'}
          </h3>
          <p className="text-[10px] text-muted-foreground">
            {new Date(run.started_at).toLocaleString()}
            {duration !== null && ` • ${duration}s`}
            {run.ai_model && ` • ${run.ai_model.split('/').pop()}`}
          </p>
        </div>
      </div>

      {/* Sources scanned */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-medium text-muted-foreground">Content Sources Scanned</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex flex-wrap gap-3">
            {Object.entries(scanned).map(([src, count]) => (
              <div key={src} className="flex items-center gap-1.5 text-xs">
                {src === 'blog_posts' && <FileText className="h-3 w-3 text-muted-foreground" />}
                {src === 'pdf_resources' && <Download className="h-3 w-3 text-muted-foreground" />}
                {src === 'custom_pages' && <Globe className="h-3 w-3 text-muted-foreground" />}
                <span className="font-medium">{SOURCE_LABELS[src as ContentSource] || src}:</span>
                <span>{count}</span>
              </div>
            ))}
            <span className="text-xs text-muted-foreground ml-auto">
              Issues found: {run.total_issues}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Issue counts by category */}
      {summary?.byCategory && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Issues by Category</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(summary.byCategory as Record<string, number>)
                .sort(([, a], [, b]) => b - a)
                .map(([cat, count]) => (
                  <Badge key={cat} variant="outline" className="text-[10px]">
                    {CATEGORY_LABELS[cat as IssueCategory] || cat}: {count}
                  </Badge>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Fix result counts — with clear terminology */}
      {run.run_type === 'fix' && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Fix Results</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-3">
            <div className="grid grid-cols-5 gap-3 text-center">
              <div>
                <div className="text-sm font-bold text-muted-foreground">
                  {summary?.fixesAttempted ?? (run.total_fixed + run.total_failed + run.total_skipped + run.total_review_required)}
                </div>
                <div className="text-[9px] text-muted-foreground">Attempted</div>
              </div>
              <div>
                <div className="text-sm font-bold text-primary">{run.total_fixed}</div>
                <div className="text-[9px] text-muted-foreground">Applied</div>
              </div>
              <div>
                <div className="text-sm font-bold text-destructive">{run.total_failed}</div>
                <div className="text-[9px] text-muted-foreground">Failed</div>
              </div>
              <div>
                <div className="text-sm font-bold text-muted-foreground">{run.total_skipped}</div>
                <div className="text-[9px] text-muted-foreground">Skipped</div>
              </div>
              <div>
                <div className="text-sm font-bold">{run.total_review_required}</div>
                <div className="text-[9px] text-muted-foreground">Review</div>
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground italic">
              "Applied" = successfully saved to DB. "Attempted" = total fix operations processed (may exceed issue count when AI generates multiple fixes per issue).
            </p>
          </CardContent>
        </Card>
      )}

      {/* Warnings (deduplicated) */}
      {run.warnings && run.warnings.length > 0 && (() => {
        const uniqueWarnings = Array.from(new Set(run.warnings));
        return (
          <Card className="border-amber-500/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-amber-700 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" /> Warnings ({uniqueWarnings.length} unique)
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-1">
              {uniqueWarnings.map((w, i) => (
                <p key={i} className="text-xs text-amber-800">{w}</p>
              ))}
            </CardContent>
          </Card>
        );
      })()}

      {/* Fix details */}
      {fixes.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Fix Details ({fixes.length} items — skipped items omitted)
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <ScrollArea className="max-h-[400px]">
              <div className="space-y-1">
                {fixes.map((f, idx) => (
                  <div key={idx} className="flex items-start gap-2 text-xs border rounded px-2.5 py-1.5">
                    {f.status === 'fixed' && <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />}
                    {f.status === 'failed' && <XCircle className="h-3.5 w-3.5 text-destructive shrink-0 mt-0.5" />}
                    {f.status === 'review_required' && <Eye className="h-3.5 w-3.5 shrink-0 mt-0.5" style={{ color: 'hsl(var(--muted-foreground))' }} />}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium truncate">{f.slug}</span>
                        <Badge variant="outline" className="text-[8px]">{f.category}</Badge>
                        {f.field && <span className="text-muted-foreground">→ {f.field}</span>}
                        {f.verificationPassed === false && (
                          <Badge variant="outline" className="text-[8px] border-destructive/40 text-destructive">⚠ verify fail</Badge>
                        )}
                      </div>
                      <p className="text-muted-foreground">{f.reason}</p>
                      {f.afterValue && <p className="text-[10px] text-primary truncate">New: {f.afterValue}</p>}
                    </div>
                    <Badge variant="outline" className={`text-[8px] shrink-0 ${
                      f.status === 'fixed' ? 'border-primary/40 text-primary' :
                      f.status === 'failed' ? 'border-destructive/40 text-destructive' :
                      'border-amber-500/40 text-amber-700'
                    }`}>
                      {f.status === 'fixed' ? '✓' : f.status === 'failed' ? '✗' : '👁'} {f.status}
                    </Badge>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Fix Progress Bar
// ═══════════════════════════════════════════════════════════════

function FixProgressBar({ progress }: { progress: FixProgress }) {
  const pct = progress.total > 0 ? (progress.processed / progress.total) * 100 : 0;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium">Fixing SEO issues… {progress.processed}/{progress.total} pages</span>
        <span className="text-muted-foreground">Model: {getModelLabel(progress.currentModel)}</span>
      </div>
      <Progress value={pct} className="h-2" />
      <div className="flex flex-wrap gap-3 text-xs">
        <span className="text-primary font-medium">✓ {progress.fixed} applied</span>
        <span className="text-muted-foreground">⏭ {progress.skipped} skipped</span>
        <span className="text-destructive">✗ {progress.failed} failed</span>
        <span style={{ color: 'hsl(var(--muted-foreground))' }}>👁 {progress.reviewRequired} review</span>
      </div>
      {progress.currentSlug && (
        <p className="text-[10px] text-muted-foreground truncate">Processing: {progress.currentSlug}</p>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Fix Summary Bar
// ═══════════════════════════════════════════════════════════════

function FixSummaryBar({ results }: { results: FixResult[] }) {
  const fixed = results.filter(r => r.status === 'fixed').length;
  const failed = results.filter(r => r.status === 'failed').length;
  const review = results.filter(r => r.status === 'review_required').length;
  const skipped = results.filter(r => r.status === 'skipped').length;

  return (
    <div className="flex items-center gap-3 text-xs bg-muted/50 rounded-lg p-3">
      <CheckCircle2 className="h-4 w-4 text-primary" />
      <span className="font-medium">Complete:</span>
      <span className="text-primary font-semibold">{fixed} applied</span>
      <span>•</span>
      <span>{skipped} skipped</span>
      <span>•</span>
      <span className="text-destructive">{failed} failed</span>
      <span>•</span>
      <span>{review} review</span>
      <span className="text-muted-foreground ml-1">({results.length} total)</span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Fix Results Panel
// ═══════════════════════════════════════════════════════════════

function FixResultsPanel({ results }: { results: FixResult[] }) {
  const [expanded, setExpanded] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const filtered = statusFilter === 'all' ? results : results.filter(r => r.status === statusFilter);

  return (
    <Card>
      <Collapsible open={expanded} onOpenChange={setExpanded}>
        <CollapsibleTrigger className="w-full">
          <CardHeader className="pb-2 cursor-pointer hover:bg-muted/30">
            <div className="flex items-center gap-2">
              <ChevronDown className={`h-4 w-4 transition-transform ${expanded ? 'rotate-180' : ''}`} />
              <CardTitle className="text-sm">Fix Results ({results.length})</CardTitle>
              <div className="flex gap-1 ml-auto">
                {['fixed', 'failed', 'review_required', 'skipped'].map(status => {
                  const count = results.filter(r => r.status === status).length;
                  if (count === 0) return null;
                  return (
                    <Badge key={status} variant="outline" className={`text-[9px] ${
                      status === 'fixed' ? 'border-primary/40 text-primary' :
                      status === 'failed' ? 'border-destructive/40 text-destructive' :
                      status === 'review_required' ? 'border-amber-500/40 text-amber-700' : ''
                    }`}>
                      {status === 'fixed' ? '✓' : status === 'failed' ? '✗' : status === 'review_required' ? '👁' : '⏭'} {count}
                    </Badge>
                  );
                })}
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0">
            <div className="flex gap-1 mb-3">
              {['all', 'fixed', 'failed', 'review_required', 'skipped'].map(s => (
                <Button key={s} size="sm" variant={statusFilter === s ? 'default' : 'outline'} className="h-6 text-[10px] px-2" onClick={() => setStatusFilter(s)}>
                  {s === 'all' ? 'All' : s === 'review_required' ? 'Review' : s.charAt(0).toUpperCase() + s.slice(1)}
                </Button>
              ))}
            </div>
            <ScrollArea className="max-h-[400px]">
              <div className="space-y-1">
                {filtered.map((r, idx) => (
                  <div key={idx} className="flex items-start gap-2 text-xs border rounded px-2.5 py-1.5">
                    {r.status === 'fixed' && <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />}
                    {r.status === 'failed' && <XCircle className="h-3.5 w-3.5 text-destructive shrink-0 mt-0.5" />}
                    {r.status === 'review_required' && <Eye className="h-3.5 w-3.5 shrink-0 mt-0.5" style={{ color: 'hsl(var(--muted-foreground))' }} />}
                    {r.status === 'skipped' && <SkipForward className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium truncate">{r.slug}</span>
                        <Badge variant="outline" className="text-[8px]">{r.category}</Badge>
                        {r.field && <span className="text-muted-foreground">→ {r.field}</span>}
                      </div>
                      <p className="text-muted-foreground">{r.reason}</p>
                      {r.afterValue && <p className="text-[10px] text-primary truncate">New: {r.afterValue}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════
// Per-page issue row
// ═══════════════════════════════════════════════════════════════

function PageIssueRow({ page, fixResults }: {
  page: { source: ContentSource; slug: string; title: string; isPublished: boolean; issues: SeoAuditIssue[] };
  fixResults: FixResult[];
}) {
  const [open, setOpen] = useState(false);
  const Icon = SOURCE_ICONS[page.source];
  const worstSeverity = page.issues.reduce<IssueSeverity>((worst, i) => {
    const order: IssueSeverity[] = ['critical', 'high', 'medium', 'low'];
    return order.indexOf(i.severity) < order.indexOf(worst) ? i.severity : worst;
  }, 'low');
  const autoCount = page.issues.filter(i => i.autoFixable).length;

  const pageResults = fixResults.filter(r => r.slug === page.slug && r.source === page.source);
  const fixedCount = pageResults.filter(r => r.status === 'fixed').length;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-muted/50 text-left">
        <ChevronDown className={`h-3.5 w-3.5 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
        <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium truncate">{page.title}</p>
          <p className="text-[10px] text-muted-foreground truncate">/{page.slug}</p>
        </div>
        <Badge variant={page.isPublished ? 'default' : 'secondary'} className="text-[9px] shrink-0">
          {page.isPublished ? 'Published' : 'Draft'}
        </Badge>
        {fixedCount > 0 && (
          <Badge variant="outline" className="text-[9px] border-primary/40 text-primary">
            <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" />{fixedCount} fixed
          </Badge>
        )}
        <Badge variant="outline" className={`text-[9px] ${SEVERITY_COLORS[worstSeverity]}`}>
          {page.issues.length} issue{page.issues.length !== 1 ? 's' : ''}
        </Badge>
        {autoCount > 0 && fixedCount === 0 && (
          <Badge variant="outline" className="text-[9px] border-primary/30 text-primary">
            <Sparkles className="h-2.5 w-2.5 mr-0.5" />{autoCount} fixable
          </Badge>
        )}
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="px-4 pb-3 pl-12 space-y-1.5">
          {page.issues.map(issue => {
            const result = pageResults.find(r => r.issueId === issue.id);
            return (
              <div key={issue.id} className={`flex items-start gap-2 text-xs rounded px-2.5 py-1.5 border ${
                result?.status === 'fixed' ? 'bg-primary/5 border-primary/20' : SEVERITY_COLORS[issue.severity]
              }`}>
                {result?.status === 'fixed' ? (
                  <CheckCircle2 className="h-3 w-3 shrink-0 mt-0.5 text-primary" />
                ) : issue.severity === 'critical' ? (
                  <XCircle className="h-3 w-3 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium">{CATEGORY_LABELS[issue.category]}:</span>
                    <span>{result?.status === 'fixed' ? result.reason : issue.message}</span>
                  </div>
                  {result?.afterValue && (
                    <p className="text-[10px] text-primary mt-0.5 truncate">→ {result.afterValue}</p>
                  )}
                  {!result && issue.currentValue && (
                    <p className="text-[10px] opacity-70 mt-0.5 truncate">Current: {issue.currentValue}</p>
                  )}
                </div>
                <Badge variant="outline" className={`text-[8px] shrink-0 ${
                  result?.status === 'fixed' ? 'border-primary/40 text-primary' :
                  result?.status === 'failed' ? 'border-destructive/40 text-destructive' :
                  issue.autoFixable ? 'border-primary/40 text-primary' : ''
                }`}>
                  {result ? (result.status === 'fixed' ? '✓ Fixed' : result.status === 'failed' ? '✗ Failed' : result.status === 'review_required' ? '👁 Review' : '⏭ Skip') :
                    (issue.autoFixable ? '⚡ Auto-fix' : '👁 Review')}
                </Badge>
              </div>
            );
          })}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
