import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Search, Loader2, AlertTriangle, XCircle, CheckCircle2, ChevronDown,
  Sparkles, FileText, Download, Globe, Filter, Zap,
} from 'lucide-react';
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

// ═══════════════════════════════════════════════════════════════
// Component
// ═══════════════════════════════════════════════════════════════

export function SitewideSeoAudit() {
  const { toast } = useToast();
  const [report, setReport] = useState<SeoAuditReport | null>(null);
  const [scanning, setScanning] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');
  const [aiModel, setAiModel] = useState(() => getLastUsedModel('text', 'google/gemini-2.5-pro'));

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSource, setFilterSource] = useState<string>('all');
  const [filterSeverity, setFilterSeverity] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterFixable, setFilterFixable] = useState<string>('all');

  const handleScan = async () => {
    setScanning(true);
    setReport(null);
    try {
      const result = await runSitewideSeoAudit(setProgressMsg);
      setReport(result);
      toast({ title: `SEO Audit Complete`, description: `${result.issues.length} issues found across ${Object.values(result.totalScanned).reduce((a, b) => a + b, 0)} pages` });
    } catch (err: any) {
      toast({ title: 'Scan failed', description: err.message, variant: 'destructive' });
    } finally {
      setScanning(false);
      setProgressMsg('');
    }
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

  // Group issues by page for display
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
    const set = new Set(report.issues.map(i => i.category));
    return Array.from(set).sort();
  }, [report]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
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
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={handleScan} disabled={scanning} size="lg">
              {scanning ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
              {scanning ? 'Scanning…' : 'Run Full SEO Audit'}
            </Button>

            <div className="flex items-center gap-2 ml-auto">
              <span className="text-xs text-muted-foreground">AI Model:</span>
              <AiModelSelector value={aiModel} onValueChange={setAiModel} capability="text" size="sm" triggerClassName="w-[200px]" />
            </div>

            <Button
              size="lg"
              disabled={!report || report.summary.autoFixable === 0}
              className="bg-gradient-to-r from-primary to-primary/80"
              onClick={() => toast({ title: 'Coming in Phase 2', description: 'The AI fix engine will be connected in the next phase.' })}
            >
              <Zap className="h-4 w-4 mr-2" />
              Fix All Using AI
              {report && report.summary.autoFixable > 0 && (
                <Badge variant="secondary" className="ml-2 bg-white/20 text-white">{report.summary.autoFixable}</Badge>
              )}
            </Button>
          </div>

          {scanning && (
            <div className="mt-3 space-y-1">
              <p className="text-xs text-muted-foreground">{progressMsg}</p>
              <Progress value={undefined} className="h-1.5" />
            </div>
          )}

          {report && !scanning && (
            <p className="mt-2 text-xs text-muted-foreground">
              Note: "Fix All Using AI" will auto-fix {report.summary.autoFixable} issues using the selected model. 
              {report.summary.reviewRequired > 0 && ` ${report.summary.reviewRequired} issues require manual review.`}
              {' '}This capability is being built in Phase 2.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Summary cards */}
      {report && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {/* Source counts */}
          {(Object.entries(report.totalScanned) as [ContentSource, number][]).map(([src, count]) => {
            const Icon = SOURCE_ICONS[src];
            return (
              <Card key={src} className="cursor-pointer hover:shadow-sm" onClick={() => setFilterSource(filterSource === src ? 'all' : src)}>
                <CardContent className="p-3 text-center">
                  <Icon className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                  <div className="text-lg font-bold">{count}</div>
                  <div className="text-[10px] text-muted-foreground">{SOURCE_LABELS[src]}</div>
                  <div className="text-xs text-amber-600 font-medium">{report.summary.bySource[src]} issues</div>
                </CardContent>
              </Card>
            );
          })}
          {/* Severity counts */}
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
          {/* Fixable vs review */}
          <Card className="cursor-pointer hover:shadow-sm border-primary/30" onClick={() => setFilterFixable(filterFixable === 'auto' ? 'all' : 'auto')}>
            <CardContent className="p-3 text-center">
              <Sparkles className="h-4 w-4 mx-auto mb-1 text-primary" />
              <div className="text-lg font-bold text-primary">{report.summary.autoFixable}</div>
              <div className="text-[10px] text-muted-foreground">Auto-Fixable</div>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:shadow-sm" onClick={() => setFilterFixable(filterFixable === 'review' ? 'all' : 'review')}>
            <CardContent className="p-3 text-center">
              <AlertTriangle className="h-4 w-4 mx-auto mb-1 text-amber-500" />
              <div className="text-lg font-bold">{report.summary.reviewRequired}</div>
              <div className="text-[10px] text-muted-foreground">Review Required</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters + Results */}
      {report && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by slug, title, or issue…"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-60 h-8 text-xs"
              />
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
                  {activeCategories.map(c => (
                    <SelectItem key={c} value={c}>{CATEGORY_LABELS[c as IssueCategory] || c}</SelectItem>
                  ))}
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
            {/* Issue category breakdown */}
            {Object.keys(report.summary.byCategory).length > 0 && (
              <div className="px-4 pb-3 flex flex-wrap gap-1.5">
                {Object.entries(report.summary.byCategory)
                  .sort(([, a], [, b]) => b - a)
                  .map(([cat, count]) => (
                    <Badge
                      key={cat}
                      variant="outline"
                      className={`text-[10px] cursor-pointer ${filterCategory === cat ? 'bg-primary/10 border-primary' : ''}`}
                      onClick={() => setFilterCategory(filterCategory === cat ? 'all' : cat)}
                    >
                      {CATEGORY_LABELS[cat as IssueCategory] || cat}: {count}
                    </Badge>
                  ))
                }
              </div>
            )}

            <ScrollArea className="max-h-[600px]">
              <div className="divide-y">
                {groupedByPage.length === 0 && (
                  <div className="p-8 text-center text-muted-foreground text-sm">
                    {report.issues.length === 0 ? (
                      <div className="flex flex-col items-center gap-2">
                        <CheckCircle2 className="h-8 w-8 text-green-500" />
                        <p>No SEO issues found! All content looks healthy.</p>
                      </div>
                    ) : 'No issues match current filters.'}
                  </div>
                )}
                {groupedByPage.map(page => (
                  <PageIssueRow key={`${page.source}:${page.slug}`} page={page} />
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
// Per-page row
// ═══════════════════════════════════════════════════════════════

function PageIssueRow({ page }: {
  page: { source: ContentSource; slug: string; title: string; isPublished: boolean; issues: SeoAuditIssue[] };
}) {
  const [open, setOpen] = useState(false);
  const Icon = SOURCE_ICONS[page.source];
  const worstSeverity = page.issues.reduce<IssueSeverity>((worst, i) => {
    const order: IssueSeverity[] = ['critical', 'high', 'medium', 'low'];
    return order.indexOf(i.severity) < order.indexOf(worst) ? i.severity : worst;
  }, 'low');
  const autoCount = page.issues.filter(i => i.autoFixable).length;

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
        <Badge variant="outline" className={`text-[9px] ${SEVERITY_COLORS[worstSeverity]}`}>
          {page.issues.length} issue{page.issues.length !== 1 ? 's' : ''}
        </Badge>
        {autoCount > 0 && (
          <Badge variant="outline" className="text-[9px] border-primary/30 text-primary">
            <Sparkles className="h-2.5 w-2.5 mr-0.5" />{autoCount} fixable
          </Badge>
        )}
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="px-4 pb-3 pl-12 space-y-1.5">
          {page.issues.map(issue => (
            <div key={issue.id} className={`flex items-start gap-2 text-xs rounded px-2.5 py-1.5 border ${SEVERITY_COLORS[issue.severity]}`}>
              {issue.severity === 'critical' ? <XCircle className="h-3 w-3 shrink-0 mt-0.5" /> : <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5" />}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="font-medium">{CATEGORY_LABELS[issue.category]}:</span>
                  <span>{issue.message}</span>
                </div>
                {issue.currentValue && (
                  <p className="text-[10px] opacity-70 mt-0.5 truncate">Current: {issue.currentValue}</p>
                )}
              </div>
              <Badge variant="outline" className={`text-[8px] shrink-0 ${issue.autoFixable ? 'border-primary/40 text-primary' : ''}`}>
                {issue.autoFixable ? '⚡ Auto-fix' : '👁 Review'}
              </Badge>
            </div>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
