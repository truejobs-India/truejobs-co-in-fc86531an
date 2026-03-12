import { useState, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  CheckCircle2, AlertTriangle, XCircle, Play, Download, Eye, Wrench, Clock,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  CachePage, PageData, PageValidationReport, ValidationCategory, ValidationSeverity,
} from './cacheTypes';
import { validateAllPages, validatePage } from './seoValidationEngine';
import { ValidationPageReport } from './ValidationPageReport';
import { exportValidationCSV, exportValidationJSON } from './validationExport';

interface Props {
  allMergedPages: CachePage[];
  inventory: PageData[];
  loadPageHtml: (slug: string) => Promise<{ head_html: string | null; body_html: string | null }>;
  handleRebuildSlugs: (slugs: string[]) => Promise<void>;
}

const CATEGORY_LABELS: Record<ValidationCategory, string> = {
  'seo-basics': 'SEO Basics',
  'schema': 'Schema',
  'content-quality': 'Content Quality',
  'consistency': 'Consistency',
};

const SEV_ORDER: ValidationSeverity[] = ['fail', 'warning', 'pass'];

function SeverityBadge({ severity }: { severity: ValidationSeverity }) {
  if (severity === 'fail') return <Badge variant="destructive" className="text-xs">Fail</Badge>;
  if (severity === 'warning') return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100 text-xs">Warn</Badge>;
  return <Badge variant="outline" className="text-xs text-green-700">Pass</Badge>;
}

function relativeTime(date: Date): string {
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function SEOValidationDashboard({ allMergedPages, inventory, loadPageHtml, handleRebuildSlugs }: Props) {
  const { toast } = useToast();
  const [reports, setReports] = useState<PageValidationReport[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [lastRunAt, setLastRunAt] = useState<Date | null>(null);
  const [dismissedSlugs, setDismissedSlugs] = useState<Set<string>>(new Set());
  const [showAllPages, setShowAllPages] = useState(false);
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [selectedReport, setSelectedReport] = useState<PageValidationReport | null>(null);

  const runValidation = useCallback(async () => {
    setIsRunning(true);
    setDismissedSlugs(new Set());
    setProgress({ done: 0, total: allMergedPages.length });
    try {
      const results = await validateAllPages(
        allMergedPages,
        loadPageHtml,
        (done, total) => setProgress({ done, total })
      );
      setReports(results);
      setLastRunAt(new Date());
      toast({ title: 'Validation Complete', description: `${results.length} pages validated` });
    } catch (err: any) {
      toast({ title: 'Validation Error', description: err.message, variant: 'destructive' });
    } finally {
      setIsRunning(false);
    }
  }, [allMergedPages, loadPageHtml, toast]);

  // Stats
  const stats = useMemo(() => {
    const s = { total: reports.length, pass: 0, warn: 0, fail: 0, byCategory: {} as Record<string, { fail: number; warn: number }> };
    for (const cat of Object.keys(CATEGORY_LABELS)) {
      s.byCategory[cat] = { fail: 0, warn: 0 };
    }
    for (const r of reports) {
      if (r.worstSeverity === 'fail') s.fail++;
      else if (r.worstSeverity === 'warning') s.warn++;
      else s.pass++;
      for (const c of r.checks) {
        if (c.severity === 'fail') s.byCategory[c.category] = { ...s.byCategory[c.category], fail: (s.byCategory[c.category]?.fail || 0) + 1 };
        if (c.severity === 'warning') s.byCategory[c.category] = { ...s.byCategory[c.category], warn: (s.byCategory[c.category]?.warn || 0) + 1 };
      }
    }
    return s;
  }, [reports]);

  // Top issues
  const topIssues = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of reports) {
      for (const c of r.checks) {
        if (c.severity !== 'pass') counts.set(c.label, (counts.get(c.label) || 0) + 1);
      }
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [reports]);

  // Filtered reports
  const filteredReports = useMemo(() => {
    let list = reports;
    if (!showAllPages) list = list.filter(r => r.worstSeverity !== 'pass');
    list = list.filter(r => !dismissedSlugs.has(r.slug));
    if (severityFilter !== 'all') list = list.filter(r => r.worstSeverity === severityFilter);
    if (categoryFilter !== 'all') list = list.filter(r => r.checks.some(c => c.category === categoryFilter && c.severity !== 'pass'));
    list.sort((a, b) => SEV_ORDER.indexOf(a.worstSeverity) - SEV_ORDER.indexOf(b.worstSeverity));
    return list;
  }, [reports, showAllPages, dismissedSlugs, severityFilter, categoryFilter]);

  const handleRevalidateSingle = useCallback(async (slug: string) => {
    const page = allMergedPages.find(p => p.slug === slug);
    if (!page) return;
    let enriched = page;
    if (!page.headHtml && !page.bodyHtml && page.status !== 'missing') {
      const { head_html, body_html } = await loadPageHtml(slug);
      enriched = { ...page, headHtml: head_html, bodyHtml: body_html };
    }
    const report = validatePage(enriched);
    setReports(prev => prev.map(r => r.slug === slug ? report : r));
    setSelectedReport(report);
    toast({ title: 'Revalidated', description: `${slug}: ${report.failCount} fail, ${report.warnCount} warn` });
  }, [allMergedPages, loadPageHtml, toast]);

  if (reports.length === 0 && !isRunning) {
    return (
      <div className="text-center py-12 space-y-3">
        <p className="text-muted-foreground">No validation results yet. Run a full validation to check all cached pages.</p>
        <Button onClick={runValidation} disabled={allMergedPages.length === 0} className="gap-2">
          <Play className="h-4 w-4" /> Run Full Validation
        </Button>
        {allMergedPages.length === 0 && (
          <p className="text-xs text-muted-foreground">Waiting for page inventory to load…</p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Button size="sm" onClick={runValidation} disabled={isRunning} className="gap-1">
            <Play className="h-3 w-3" /> {isRunning ? 'Running…' : 'Run Full Validation'}
          </Button>
          {lastRunAt && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" /> Last validated: {relativeTime(lastRunAt)}
            </span>
          )}
        </div>
        {reports.length > 0 && (
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className="gap-1 h-8" onClick={() => exportValidationCSV(filteredReports)}>
              <Download className="h-3 w-3" /> CSV
            </Button>
            <Button size="sm" variant="outline" className="gap-1 h-8" onClick={() => exportValidationJSON(filteredReports)}>
              <Download className="h-3 w-3" /> JSON
            </Button>
          </div>
        )}
      </div>

      {/* Progress bar */}
      {isRunning && (
        <div className="space-y-1">
          <Progress value={(progress.done / Math.max(progress.total, 1)) * 100} className="h-2" />
          <p className="text-xs text-muted-foreground text-center">{progress.done} / {progress.total}</p>
        </div>
      )}

      {reports.length > 0 && (
        <>
          {/* Overview cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Card><CardContent className="p-3 text-center">
              <p className="text-2xl font-bold">{stats.total}</p>
              <p className="text-xs text-muted-foreground">Validated</p>
            </CardContent></Card>
            <Card><CardContent className="p-3 text-center">
              <p className="text-2xl font-bold text-green-600">{stats.pass}</p>
              <p className="text-xs text-muted-foreground">Pass</p>
            </CardContent></Card>
            <Card><CardContent className="p-3 text-center">
              <p className="text-2xl font-bold text-yellow-600">{stats.warn}</p>
              <p className="text-xs text-muted-foreground">Warnings</p>
            </CardContent></Card>
            <Card><CardContent className="p-3 text-center">
              <p className="text-2xl font-bold text-red-600">{stats.fail}</p>
              <p className="text-xs text-muted-foreground">Failures</p>
            </CardContent></Card>
          </div>

          {/* Category breakdown */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {(Object.keys(CATEGORY_LABELS) as ValidationCategory[]).map(cat => (
              <Card key={cat}><CardContent className="p-3">
                <p className="text-xs font-medium text-muted-foreground mb-1">{CATEGORY_LABELS[cat]}</p>
                <div className="flex gap-3 text-sm">
                  <span className="text-red-600">{stats.byCategory[cat]?.fail || 0} fail</span>
                  <span className="text-yellow-600">{stats.byCategory[cat]?.warn || 0} warn</span>
                </div>
              </CardContent></Card>
            ))}
          </div>

          {/* Top issues */}
          {topIssues.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {topIssues.map(([label, count]) => (
                <Badge key={label} variant="outline" className="text-xs">
                  {label}: {count}
                </Badge>
              ))}
            </div>
          )}

          {/* Filters */}
          <div className="flex items-center gap-3 flex-wrap">
            <Select value={severityFilter} onValueChange={setSeverityFilter}>
              <SelectTrigger className="w-32 h-8 text-xs"><SelectValue placeholder="Severity" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All severities</SelectItem>
                <SelectItem value="fail">Fail</SelectItem>
                <SelectItem value="warning">Warning</SelectItem>
                <SelectItem value="pass">Pass</SelectItem>
              </SelectContent>
            </Select>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-36 h-8 text-xs"><SelectValue placeholder="Category" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {(Object.keys(CATEGORY_LABELS) as ValidationCategory[]).map(cat => (
                  <SelectItem key={cat} value={cat}>{CATEGORY_LABELS[cat]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2 ml-auto">
              <span className="text-xs text-muted-foreground">Show all pages</span>
              <Switch checked={showAllPages} onCheckedChange={setShowAllPages} />
            </div>
          </div>

          {/* Results table */}
          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Slug</TableHead>
                  <TableHead className="text-xs w-28">Type</TableHead>
                  <TableHead className="text-xs w-20">Issues</TableHead>
                  <TableHead className="text-xs w-20">Severity</TableHead>
                  <TableHead className="text-xs w-36">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredReports.slice(0, 100).map(r => (
                  <TableRow key={r.slug}>
                    <TableCell className="text-xs font-mono truncate max-w-xs">/{r.slug}</TableCell>
                    <TableCell><Badge variant="outline" className="text-xs">{r.pageType}</Badge></TableCell>
                    <TableCell className="text-xs">
                      {r.failCount > 0 && <span className="text-red-600 mr-1">{r.failCount}F</span>}
                      {r.warnCount > 0 && <span className="text-yellow-600">{r.warnCount}W</span>}
                      {r.failCount === 0 && r.warnCount === 0 && <span className="text-green-600">✓</span>}
                    </TableCell>
                    <TableCell><SeverityBadge severity={r.worstSeverity} /></TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="sm" variant="outline" className="h-6 px-2 text-xs gap-1"
                          onClick={() => setSelectedReport(r)}>
                          <Eye className="h-3 w-3" /> Report
                        </Button>
                        <Button size="sm" variant="secondary" className="h-6 px-2 text-xs gap-1"
                          onClick={() => handleRebuildSlugs([r.slug])}>
                          <Wrench className="h-3 w-3" /> Rebuild
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredReports.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground text-sm py-8">
                      {showAllPages ? 'No pages match the current filters.' : 'No issues found! Toggle "Show all pages" to see passing pages.'}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            {filteredReports.length > 100 && (
              <p className="text-xs text-muted-foreground text-center py-2">
                Showing 100 of {filteredReports.length} results. Use filters to narrow down.
              </p>
            )}
          </div>
        </>
      )}

      <ValidationPageReport
        report={selectedReport}
        open={!!selectedReport}
        onClose={() => setSelectedReport(null)}
        onRebuild={(slug) => { handleRebuildSlugs([slug]); setSelectedReport(null); }}
        onRevalidate={handleRevalidateSingle}
        onDismiss={(slug) => setDismissedSlugs(prev => new Set([...prev, slug]))}
      />
    </div>
  );
}
