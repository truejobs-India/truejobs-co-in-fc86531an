import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Globe, EyeOff, Lock, AlertTriangle, CheckCircle, XCircle,
  Download, RefreshCw, ExternalLink, Search, Shield, FileText,
  Map as MapIcon, Database,
} from 'lucide-react';
import { EvaluatedRoute, PolicyConflict } from './seoRoutePolicyTypes';
import { evaluateAllRoutes } from './seoRoutePolicyEngine';
import { exportPolicyCSV, exportPolicyJSON } from './seoRoutePolicyExport';
import { PageData, PAGE_TYPES } from '../seo-cache/cacheTypes';
import { SITE_URL } from '../seo-cache/cacheTypes';

// ── Load inventory (same source as cache manager) ───────────────────

async function loadInventory(): Promise<PageData[]> {
  const { collectAllPages } = await import('@/components/admin/SEOCacheBuilder');
  return collectAllPages();
}

// ── Category badge ──────────────────────────────────────────────────

function CategoryBadge({ category }: { category: string }) {
  switch (category) {
    case 'public-seo':
      return <Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-300"><Globe className="h-3 w-3 mr-1" />SEO</Badge>;
    case 'public-noindex':
      return <Badge className="bg-sky-500/15 text-sky-700 border-sky-300"><EyeOff className="h-3 w-3 mr-1" />Noindex</Badge>;
    case 'app-only':
      return <Badge className="bg-slate-500/15 text-slate-700 border-slate-300"><Lock className="h-3 w-3 mr-1" />App</Badge>;
    default:
      return <Badge variant="outline">{category}</Badge>;
  }
}

function SourceBadge({ source }: { source: string }) {
  switch (source) {
    case 'page-type-policy':
      return <Badge variant="outline" className="text-emerald-700 border-emerald-300">Policy</Badge>;
    case 'app-only-pattern':
      return <Badge variant="outline" className="text-slate-600 border-slate-300">Pattern</Badge>;
    case 'fallback':
      return <Badge className="bg-amber-500/15 text-amber-700 border-amber-400 animate-pulse"><AlertTriangle className="h-3 w-3 mr-1" />Fallback</Badge>;
    default:
      return <Badge variant="outline">{source}</Badge>;
  }
}

// ── Main Dashboard ──────────────────────────────────────────────────

export function SEORoutePolicyDashboard() {
  const [routes, setRoutes] = useState<EvaluatedRoute[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedRoute, setSelectedRoute] = useState<EvaluatedRoute | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [pageTypeFilter, setPageTypeFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [onlyConflicts, setOnlyConflicts] = useState(false);
  const [onlyFallback, setOnlyFallback] = useState(false);

  const load = async () => {
    setIsLoading(true);
    try {
      const inventory = await loadInventory();
      const evaluated = evaluateAllRoutes(inventory);
      setRoutes(evaluated);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  // Stats
  const stats = useMemo(() => {
    const s = { total: 0, seo: 0, noindex: 0, appOnly: 0, conflicts: 0, fallback: 0, cached: 0, sitemap: 0 };
    for (const r of routes) {
      s.total++;
      if (r.policy.category === 'public-seo') s.seo++;
      else if (r.policy.category === 'public-noindex') s.noindex++;
      else if (r.policy.category === 'app-only') s.appOnly++;
      if (r.conflicts.length > 0) s.conflicts++;
      if (r.policy.policySource === 'fallback') s.fallback++;
      if (r.policy.isCacheServed) s.cached++;
      if (r.policy.includeInSitemap) s.sitemap++;
    }
    return s;
  }, [routes]);

  // Filtered routes
  const filtered = useMemo(() => {
    let result = [...routes];
    if (search) {
      const s = search.toLowerCase();
      result = result.filter(r => r.slug.toLowerCase().includes(s) || r.title.toLowerCase().includes(s));
    }
    if (categoryFilter !== 'all') result = result.filter(r => r.policy.category === categoryFilter);
    if (pageTypeFilter !== 'all') result = result.filter(r => r.pageType === pageTypeFilter);
    if (sourceFilter !== 'all') result = result.filter(r => r.policy.policySource === sourceFilter);
    if (onlyConflicts) result = result.filter(r => r.conflicts.length > 0);
    if (onlyFallback) result = result.filter(r => r.policy.policySource === 'fallback');
    // Sort: fallback first, then by conflicts desc, then slug
    result.sort((a, b) => {
      const af = a.policy.policySource === 'fallback' ? 0 : 1;
      const bf = b.policy.policySource === 'fallback' ? 0 : 1;
      if (af !== bf) return af - bf;
      if (b.conflicts.length !== a.conflicts.length) return b.conflicts.length - a.conflicts.length;
      return a.slug.localeCompare(b.slug);
    });
    return result;
  }, [routes, search, categoryFilter, pageTypeFilter, sourceFilter, onlyConflicts, onlyFallback]);

  // Unique page types present
  const pageTypesPresent = useMemo(() => {
    const s = new Set(routes.map(r => r.pageType));
    return [...s].sort();
  }, [routes]);

  const statCards = [
    { label: 'Total Routes', value: stats.total, icon: Shield, color: 'text-foreground' },
    { label: 'Public SEO', value: stats.seo, icon: Globe, color: 'text-emerald-600' },
    { label: 'Public Noindex', value: stats.noindex, icon: EyeOff, color: 'text-sky-600' },
    { label: 'App Only', value: stats.appOnly, icon: Lock, color: 'text-slate-500' },
    { label: 'With Conflicts', value: stats.conflicts, icon: AlertTriangle, color: 'text-destructive' },
    { label: 'Fallback Routes', value: stats.fallback, icon: AlertTriangle, color: 'text-amber-600', highlight: stats.fallback > 0 },
    { label: 'Cache-Served', value: stats.cached, icon: Database, color: 'text-indigo-600' },
    { label: 'In Sitemap', value: stats.sitemap, icon: MapIcon, color: 'text-green-600' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Shield className="h-5 w-5" /> SEO Route Policy Registry
          </h2>
          <p className="text-sm text-muted-foreground">
            Evidence-based classification of every route — showing why it qualifies and what policy was applied.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => exportPolicyCSV(filtered)}>
            <Download className="h-4 w-4 mr-1" />CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => exportPolicyJSON(filtered)}>
            <FileText className="h-4 w-4 mr-1" />JSON
          </Button>
          <Button variant="outline" size="sm" onClick={load} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} />Refresh
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {statCards.map(sc => (
          <Card
            key={sc.label}
            className={sc.highlight ? 'border-amber-400 bg-amber-50/50 dark:bg-amber-950/20' : ''}
          >
            <CardContent className="p-3 flex items-center gap-3">
              <sc.icon className={`h-5 w-5 ${sc.color}`} />
              <div>
                <p className="text-2xl font-bold">{isLoading ? '…' : sc.value}</p>
                <p className="text-xs text-muted-foreground">{sc.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Fallback warning banner */}
      {stats.fallback > 0 && (
        <Alert className="border-amber-400 bg-amber-50/50 dark:bg-amber-950/20">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800 dark:text-amber-200">
            <strong>{stats.fallback} route(s)</strong> classified via conservative fallback — noindex, no sitemap, no cache until explicitly mapped.
            <Button variant="link" size="sm" className="ml-2 text-amber-700 p-0 h-auto" onClick={() => setOnlyFallback(true)}>
              Show fallback routes →
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search slug or title…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger><SelectValue placeholder="Category" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="public-seo">Public SEO</SelectItem>
                <SelectItem value="public-noindex">Public Noindex</SelectItem>
                <SelectItem value="app-only">App Only</SelectItem>
              </SelectContent>
            </Select>
            <Select value={pageTypeFilter} onValueChange={setPageTypeFilter}>
              <SelectTrigger><SelectValue placeholder="Page Type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {pageTypesPresent.map(t => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={sourceFilter} onValueChange={setSourceFilter}>
              <SelectTrigger><SelectValue placeholder="Policy Source" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sources</SelectItem>
                <SelectItem value="page-type-policy">Page Type Policy</SelectItem>
                <SelectItem value="app-only-pattern">App-Only Pattern</SelectItem>
                <SelectItem value="fallback">Fallback</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-6 mt-3">
            <div className="flex items-center gap-2">
              <Switch id="only-conflicts" checked={onlyConflicts} onCheckedChange={setOnlyConflicts} />
              <Label htmlFor="only-conflicts" className="text-sm">Only with conflicts</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch id="only-fallback" checked={onlyFallback} onCheckedChange={setOnlyFallback} />
              <Label htmlFor="only-fallback" className="text-sm text-amber-700 font-medium">Only fallback</Label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results count */}
      <p className="text-sm text-muted-foreground">
        Showing {filtered.length} of {routes.length} routes
      </p>

      {/* Table */}
      <Card>
        <div className="overflow-auto max-h-[600px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title / Slug</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Source</TableHead>
                <TableHead className="text-center">Index</TableHead>
                <TableHead className="text-center">Sitemap</TableHead>
                <TableHead className="text-center">Cache</TableHead>
                <TableHead className="text-center">Evidence</TableHead>
                <TableHead className="text-center">Conflicts</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.slice(0, 200).map(r => {
                const isFallback = r.policy.policySource === 'fallback';
                return (
                  <TableRow
                    key={r.slug}
                    className={isFallback ? 'border-l-4 border-l-amber-400 bg-amber-50/30 dark:bg-amber-950/10' : ''}
                  >
                    <TableCell className="max-w-[280px]">
                      <div className="flex items-center gap-1">
                        {isFallback && <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />}
                        <div className="truncate">
                          <p className="font-medium text-sm truncate">{r.title}</p>
                          <p className="text-xs text-muted-foreground truncate">/{r.slug}</p>
                          {r.title.startsWith('[Pattern]') && (
                            <Badge variant="outline" className="text-[10px] px-1 py-0 mt-0.5 border-slate-300 text-slate-500">
                              Synthetic pattern entry
                            </Badge>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs font-mono">{r.pageType}</span>
                    </TableCell>
                    <TableCell><CategoryBadge category={r.policy.category} /></TableCell>
                    <TableCell><SourceBadge source={r.policy.policySource} /></TableCell>
                    <TableCell className="text-center">
                      {r.policy.expectedIndexability === 'index'
                        ? <CheckCircle className="h-4 w-4 text-emerald-500 mx-auto" />
                        : <XCircle className="h-4 w-4 text-muted-foreground mx-auto" />}
                    </TableCell>
                    <TableCell className="text-center">
                      {r.policy.includeInSitemap
                        ? <CheckCircle className="h-4 w-4 text-emerald-500 mx-auto" />
                        : <XCircle className="h-4 w-4 text-muted-foreground mx-auto" />}
                    </TableCell>
                    <TableCell className="text-center">
                      {r.policy.isCacheServed
                        ? <CheckCircle className="h-4 w-4 text-emerald-500 mx-auto" />
                        : <XCircle className="h-4 w-4 text-muted-foreground mx-auto" />}
                    </TableCell>
                    <TableCell className="text-center">
                      <span className={`text-xs font-medium ${r.evidenceFailed > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                        {r.evidencePassed}/{r.evidence.length}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      {r.conflicts.length > 0
                        ? <Badge variant="destructive" className="text-xs">{r.conflicts.length}</Badge>
                        : <span className="text-xs text-muted-foreground">0</span>}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => setSelectedRoute(r)}>
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
              {filtered.length === 0 && !isLoading && (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                    No routes match the current filters.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Policy Report Dialog */}
      <Dialog open={!!selectedRoute} onOpenChange={() => setSelectedRoute(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {selectedRoute && <PolicyReportContent route={selectedRoute} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Policy Report Content ───────────────────────────────────────────

function PolicyReportContent({ route }: { route: EvaluatedRoute }) {
  const isFallback = route.policy.policySource === 'fallback';

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          {isFallback && <AlertTriangle className="h-5 w-5 text-amber-500" />}
          Policy Report: {route.title}
        </DialogTitle>
        <p className="text-sm text-muted-foreground font-mono">/{route.slug}</p>
      </DialogHeader>

      {/* Conflict alerts */}
      {route.conflicts.length > 0 && (
        <div className="space-y-2">
          {route.conflicts.map((c, i) => (
            <ConflictAlert key={i} conflict={c} />
          ))}
        </div>
      )}

      {/* Fallback prominent alert */}
      {isFallback && (
        <Alert className="border-amber-400 bg-amber-50 dark:bg-amber-950/30">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800 dark:text-amber-200 font-medium">
            This route was classified via <strong>conservative fallback</strong> — noindex, excluded from sitemap, not cache-served.
            No explicit policy mapping exists for page type "{route.pageType}".
            To make this route indexable, add an entry to PAGE_TYPE_POLICIES in seoRoutePolicyRegistry.ts.
          </AlertDescription>
        </Alert>
      )}

      {/* Section: Evidence */}
      <div>
        <h3 className="font-semibold text-sm mb-2 flex items-center gap-2">
          <Search className="h-4 w-4" /> Evidence — Why this route qualifies
        </h3>
        <div className="space-y-1.5">
          {route.evidence.map(e => (
            <div key={e.key} className="flex items-start gap-2 text-sm">
              {e.passed
                ? <CheckCircle className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                : <XCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />}
              <div>
                <span className="font-medium">{e.label}</span>
                <span className="text-muted-foreground ml-2">— {e.detail}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Section: Policy Decision */}
      <div>
        <h3 className="font-semibold text-sm mb-2 flex items-center gap-2">
          <Shield className="h-4 w-4" /> Policy Decision — What was decided
        </h3>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <span className="text-muted-foreground">Category</span>
            <div className="mt-1"><CategoryBadge category={route.policy.category} /></div>
          </div>
          <div>
            <span className="text-muted-foreground">Policy Source</span>
            <div className="mt-1"><SourceBadge source={route.policy.policySource} /></div>
          </div>
          <div>
            <span className="text-muted-foreground">Indexability</span>
            <p className="font-medium">{route.policy.expectedIndexability}</p>
          </div>
          <div>
            <span className="text-muted-foreground">In Sitemap</span>
            <p className="font-medium">{route.policy.includeInSitemap ? 'Yes' : 'No'}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Cache-Served</span>
            <p className="font-medium">{route.policy.isCacheServed ? 'Yes' : 'No'}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Canonical URL</span>
            <p className="font-mono text-xs break-all">{route.policy.canonicalUrl}</p>
          </div>
        </div>
      </div>

      {/* Reason summary */}
      <div className={`p-3 rounded-md text-sm ${isFallback ? 'bg-amber-50 dark:bg-amber-950/20 border border-amber-300' : 'bg-muted'}`}>
        {route.reasonSummary}
      </div>

      {/* Open live route */}
      {route.policy.category !== 'app-only' && (
        <Button variant="outline" size="sm" asChild>
          <a href={`${SITE_URL}/${route.slug}`} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="h-4 w-4 mr-1" /> Open Live Route
          </a>
        </Button>
      )}
    </>
  );
}

function ConflictAlert({ conflict }: { conflict: PolicyConflict }) {
  const isError = conflict.severity === 'error';
  return (
    <Alert className={isError ? 'border-destructive/50 bg-destructive/5' : 'border-amber-300 bg-amber-50/50 dark:bg-amber-950/10'}>
      <AlertTriangle className={`h-4 w-4 ${isError ? 'text-destructive' : 'text-amber-600'}`} />
      <AlertDescription className="text-sm">
        <Badge variant={isError ? 'destructive' : 'outline'} className="mr-2 text-xs">{conflict.type}</Badge>
        {conflict.message}
      </AlertDescription>
    </Alert>
  );
}
