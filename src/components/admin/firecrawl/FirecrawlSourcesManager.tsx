/**
 * Admin control surface for Firecrawl sources (Source 3 Phase 5).
 * Enable/disable, view stats, re-run discovery, scrape pending, extract batch.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { toast } from '@/hooks/use-toast';
import {
  RefreshCw, Loader2, Play, AlertTriangle, CheckCircle,
  Globe, Settings, BarChart3, ChevronDown, ChevronUp,
  PlayCircle, Square, XCircle, Download, FileText,
} from 'lucide-react';

interface FirecrawlSource {
  id: string;
  source_name: string;
  seed_url: string;
  source_type: string;
  is_enabled: boolean;
  priority: string;
  crawl_mode: string;
  extraction_mode: string;
  default_bucket: string;
  last_fetched_at: string | null;
  last_success_at: string | null;
  last_error: string | null;
  total_items_found: number;
  allowed_domains: string[];
  max_pages_per_run: number;
}

interface SourceStats {
  totalStaged: number;
  pendingUrlOnly: number;
  scraped: number;
  extracted: number;
  extractionFailed: number;
  rejectedBucket: number;
  duplicateStaged: number;
  bucketCounts: Record<string, number>;
  statusCounts: Record<string, number>;
  draftCounts: {
    total: number;
    high: number;
    medium: number;
    low: number;
    draft: number;
    reviewed: number;
    approved: number;
    duplicate: number;
  };
  lastScrapeAt: string | null;
  lastExtractAt: string | null;
  recentRuns: any[];
}

interface SourceRunResult {
  sourceId: string;
  sourceName: string;
  status: 'success' | 'error' | 'skipped';
  staged: number;
  rejected: number;
  scraped?: number;
  extracted?: number;
  durationMs: number;
  error?: string;
}

interface BatchReport {
  results: SourceRunResult[];
  totalDurationMs: number;
  startedAt: string;
  completedAt: string;
  type?: 'discovery' | 'scrape-extract';
}

export function FirecrawlSourcesManager() {
  const [sources, setSources] = useState<FirecrawlSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [busySources, setBusySources] = useState<Record<string, string>>({});
  const [expandedSource, setExpandedSource] = useState<string | null>(null);
  const [sourceStats, setSourceStats] = useState<Record<string, SourceStats>>({});
  const [editingSeed, setEditingSeed] = useState<Record<string, string>>({});

  // Run-all state
  const [runAllActive, setRunAllActive] = useState(false);
  const [runAllCurrentSource, setRunAllCurrentSource] = useState<string | null>(null);
  const [runAllProgress, setRunAllProgress] = useState({ current: 0, total: 0 });
  const [batchReport, setBatchReport] = useState<BatchReport | null>(null);
  const stopRequestedRef = useRef(false);

  const fetchSources = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('firecrawl_sources')
      .select('*')
      .order('priority')
      .order('source_name');

    if (error) {
      toast({ title: 'Error loading sources', description: error.message, variant: 'destructive' });
    } else {
      setSources((data as any[]) || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchSources(); }, [fetchSources]);

  const toggleEnabled = async (sourceId: string, enabled: boolean) => {
    const { error } = await supabase
      .from('firecrawl_sources')
      .update({ is_enabled: enabled, updated_at: new Date().toISOString() })
      .eq('id', sourceId);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      setSources(prev => prev.map(s => s.id === sourceId ? { ...s, is_enabled: enabled } : s));
      toast({ title: enabled ? 'Source enabled' : 'Source disabled' });
    }
  };

  const updatePriority = async (sourceId: string, priority: string) => {
    const { error } = await supabase
      .from('firecrawl_sources')
      .update({ priority, updated_at: new Date().toISOString() })
      .eq('id', sourceId);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      setSources(prev => prev.map(s => s.id === sourceId ? { ...s, priority } : s));
    }
  };

  const saveSeedUrl = async (sourceId: string) => {
    const newUrl = editingSeed[sourceId];
    if (!newUrl) return;

    const { error } = await supabase
      .from('firecrawl_sources')
      .update({ seed_url: newUrl, updated_at: new Date().toISOString() })
      .eq('id', sourceId);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      setSources(prev => prev.map(s => s.id === sourceId ? { ...s, seed_url: newUrl } : s));
      setEditingSeed(prev => { const n = { ...prev }; delete n[sourceId]; return n; });
      toast({ title: 'Seed URL updated' });
    }
  };

  const runDiscovery = async (sourceId: string) => {
    setBusySources(prev => ({ ...prev, [sourceId]: 'discovering' }));
    try {
      const { data, error } = await supabase.functions.invoke('firecrawl-ingest', {
        body: { action: 'discover-source', source_id: sourceId },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      toast({
        title: 'Discovery complete',
        description: `Staged: ${data.stats?.staged || 0}, Rejected: ${data.stats?.rejected || 0}`,
      });
      await fetchSources();
      if (expandedSource === sourceId) await fetchStats(sourceId);
    } catch (e: any) {
      toast({ title: 'Discovery failed', description: e.message, variant: 'destructive' });
    } finally {
      setBusySources(prev => { const n = { ...prev }; delete n[sourceId]; return n; });
    }
  };

  const runScrapePending = async (sourceId: string) => {
    setBusySources(prev => ({ ...prev, [sourceId]: 'scraping' }));
    try {
      const { data, error } = await supabase.functions.invoke('firecrawl-ingest', {
        body: { action: 'scrape-pending', source_id: sourceId, max_items: 20 },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      toast({
        title: 'Scrape Pending complete',
        description: `Scraped: ${data.scraped || 0}, Failed: ${data.failed || 0}, Total eligible: ${data.total || 0}`,
      });
      if (expandedSource === sourceId) await fetchStats(sourceId);
    } catch (e: any) {
      toast({ title: 'Scrape Pending failed', description: e.message, variant: 'destructive' });
    } finally {
      setBusySources(prev => { const n = { ...prev }; delete n[sourceId]; return n; });
    }
  };

  const runExtractBatch = async (sourceId: string) => {
    setBusySources(prev => ({ ...prev, [sourceId]: 'extracting' }));
    try {
      const { data, error } = await supabase.functions.invoke('firecrawl-ingest', {
        body: { action: 'extract-batch', source_id: sourceId, max_items: 10 },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      toast({
        title: 'Extract Pending complete',
        description: `Extracted: ${data.extracted || 0}, Failed: ${data.failed || 0}, Total: ${data.total || 0}`,
      });
      if (expandedSource === sourceId) await fetchStats(sourceId);
    } catch (e: any) {
      toast({ title: 'Extract failed', description: e.message, variant: 'destructive' });
    } finally {
      setBusySources(prev => { const n = { ...prev }; delete n[sourceId]; return n; });
    }
  };

  const fetchStats = async (sourceId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('firecrawl-ingest', {
        body: { action: 'source-stats', source_id: sourceId },
      });
      if (error || data?.error) return;
      setSourceStats(prev => ({ ...prev, [sourceId]: data as SourceStats }));
    } catch {}
  };

  const toggleExpand = (sourceId: string) => {
    if (expandedSource === sourceId) {
      setExpandedSource(null);
    } else {
      setExpandedSource(sourceId);
      fetchStats(sourceId);
    }
  };

  // ── Run All Sources Sequentially ──
  const runAllSources = async () => {
    const enabledSources = sources.filter(s => s.is_enabled);
    if (enabledSources.length === 0) {
      toast({ title: 'No enabled sources', description: 'Enable at least one source first.', variant: 'destructive' });
      return;
    }

    stopRequestedRef.current = false;
    setRunAllActive(true);
    setBatchReport(null);
    setRunAllProgress({ current: 0, total: enabledSources.length });

    const results: SourceRunResult[] = [];
    const batchStart = Date.now();
    const startedAt = new Date().toISOString();

    for (let i = 0; i < enabledSources.length; i++) {
      if (stopRequestedRef.current) {
        for (let j = i; j < enabledSources.length; j++) {
          results.push({
            sourceId: enabledSources[j].id, sourceName: enabledSources[j].source_name,
            status: 'skipped', staged: 0, rejected: 0, durationMs: 0, error: 'Stopped by admin',
          });
        }
        break;
      }

      const source = enabledSources[i];
      setRunAllCurrentSource(source.id);
      setRunAllProgress({ current: i + 1, total: enabledSources.length });
      setBusySources(prev => ({ ...prev, [source.id]: 'discovering' }));

      const sourceStart = Date.now();
      try {
        const { data, error } = await supabase.functions.invoke('firecrawl-ingest', {
          body: { action: 'discover-source', source_id: source.id },
        });
        if (error) throw new Error(error.message);
        if (data?.error) throw new Error(data.error);

        results.push({
          sourceId: source.id, sourceName: source.source_name, status: 'success',
          staged: data.stats?.staged || 0, rejected: data.stats?.rejected || 0,
          durationMs: Date.now() - sourceStart,
        });
      } catch (e: any) {
        results.push({
          sourceId: source.id, sourceName: source.source_name, status: 'error',
          staged: 0, rejected: 0, durationMs: Date.now() - sourceStart, error: e.message,
        });
      } finally {
        setBusySources(prev => { const n = { ...prev }; delete n[source.id]; return n; });
      }
    }

    const completedAt = new Date().toISOString();
    setBatchReport({ results, totalDurationMs: Date.now() - batchStart, startedAt, completedAt });
    setRunAllActive(false);
    setRunAllCurrentSource(null);
    setRunAllProgress({ current: 0, total: 0 });
    await fetchSources();

    const successCount = results.filter(r => r.status === 'success').length;
    const errorCount = results.filter(r => r.status === 'error').length;
    toast({
      title: 'Batch run complete',
      description: `${successCount} succeeded, ${errorCount} failed, ${results.filter(r => r.status === 'skipped').length} skipped`,
    });
  };

  const stopRunAll = () => {
    stopRequestedRef.current = true;
    toast({ title: 'Stopping...', description: 'Will stop after current source finishes.' });
  };

  // ── Scrape & Extract All Sources Sequentially ──
  const runScrapeExtractAll = async () => {
    const enabledSources = sources.filter(s => s.is_enabled);
    if (enabledSources.length === 0) {
      toast({ title: 'No enabled sources', description: 'Enable at least one source first.', variant: 'destructive' });
      return;
    }

    stopRequestedRef.current = false;
    setRunAllActive(true);
    setBatchReport(null);
    setRunAllProgress({ current: 0, total: enabledSources.length });

    const results: SourceRunResult[] = [];
    const batchStart = Date.now();
    const startedAt = new Date().toISOString();

    for (let i = 0; i < enabledSources.length; i++) {
      if (stopRequestedRef.current) {
        for (let j = i; j < enabledSources.length; j++) {
          results.push({
            sourceId: enabledSources[j].id, sourceName: enabledSources[j].source_name,
            status: 'skipped', staged: 0, rejected: 0, scraped: 0, extracted: 0,
            durationMs: 0, error: 'Stopped by admin',
          });
        }
        break;
      }

      const source = enabledSources[i];
      setRunAllCurrentSource(source.id);
      setRunAllProgress({ current: i + 1, total: enabledSources.length });

      const sourceStart = Date.now();
      let scrapedCount = 0;
      let extractedCount = 0;

      try {
        // Step 1: Scrape Pending
        setBusySources(prev => ({ ...prev, [source.id]: 'scraping' }));
        const { data: scrapeData, error: scrapeError } = await supabase.functions.invoke('firecrawl-ingest', {
          body: { action: 'scrape-pending', source_id: source.id, max_items: 20 },
        });
        if (scrapeError) throw new Error(`Scrape: ${scrapeError.message}`);
        if (scrapeData?.error) throw new Error(`Scrape: ${scrapeData.error}`);
        scrapedCount = scrapeData?.scraped || 0;

        if (stopRequestedRef.current) throw new Error('Stopped by admin');

        // Step 2: Extract Pending
        setBusySources(prev => ({ ...prev, [source.id]: 'extracting' }));
        const { data: extractData, error: extractError } = await supabase.functions.invoke('firecrawl-ingest', {
          body: { action: 'extract-batch', source_id: source.id, max_items: 10 },
        });
        if (extractError) throw new Error(`Extract: ${extractError.message}`);
        if (extractData?.error) throw new Error(`Extract: ${extractData.error}`);
        extractedCount = extractData?.extracted || 0;

        results.push({
          sourceId: source.id, sourceName: source.source_name, status: 'success',
          staged: 0, rejected: 0, scraped: scrapedCount, extracted: extractedCount,
          durationMs: Date.now() - sourceStart,
        });
      } catch (e: any) {
        const wasStopped = e.message?.includes('Stopped by admin');
        results.push({
          sourceId: source.id, sourceName: source.source_name,
          status: wasStopped ? 'skipped' : 'error',
          staged: 0, rejected: 0, scraped: scrapedCount, extracted: extractedCount,
          durationMs: Date.now() - sourceStart, error: e.message,
        });
        if (wasStopped) {
          // Add remaining as skipped
          for (let j = i + 1; j < enabledSources.length; j++) {
            results.push({
              sourceId: enabledSources[j].id, sourceName: enabledSources[j].source_name,
              status: 'skipped', staged: 0, rejected: 0, scraped: 0, extracted: 0,
              durationMs: 0, error: 'Stopped by admin',
            });
          }
          break;
        }
      } finally {
        setBusySources(prev => { const n = { ...prev }; delete n[source.id]; return n; });
      }
    }

    const completedAt = new Date().toISOString();
    setBatchReport({ results, totalDurationMs: Date.now() - batchStart, startedAt, completedAt, type: 'scrape-extract' });
    setRunAllActive(false);
    setRunAllCurrentSource(null);
    setRunAllProgress({ current: 0, total: 0 });
    await fetchSources();

    const successCount = results.filter(r => r.status === 'success').length;
    const errorCount = results.filter(r => r.status === 'error').length;
    toast({
      title: 'Scrape & Extract All complete',
      description: `${successCount} succeeded, ${errorCount} failed, ${results.filter(r => r.status === 'skipped').length} skipped`,
    });
  };

  const priorityColor = (p: string) => {
    switch (p) {
      case 'High': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'Medium': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'Low': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      default: return '';
    }
  };

  const timeAgo = (iso: string | null) => {
    if (!iso) return 'Never';
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    const secs = Math.round(ms / 1000);
    if (secs < 60) return `${secs}s`;
    return `${Math.floor(secs / 60)}m ${secs % 60}s`;
  };

  const isBusy = (sourceId: string) => !!busySources[sourceId] || runAllActive;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Globe className="h-5 w-5" />
          Firecrawl Sources
        </CardTitle>
        <div className="flex items-center gap-2">
          {!runAllActive ? (
            <>
              <Button
                variant="default" size="sm"
                onClick={runAllSources}
                disabled={loading || sources.filter(s => s.is_enabled).length === 0}
              >
                <PlayCircle className="h-3.5 w-3.5 mr-1.5" />
                Run All Discovery
              </Button>
              <Button
                variant="secondary" size="sm"
                onClick={runScrapeExtractAll}
                disabled={loading || sources.filter(s => s.is_enabled).length === 0}
              >
                <Download className="h-3.5 w-3.5 mr-1.5" />
                Scrape &amp; Extract All
              </Button>
            </>
          ) : (
            <Button variant="destructive" size="sm" onClick={stopRunAll}>
              <Square className="h-3.5 w-3.5 mr-1.5" />
              Stop
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={fetchSources} disabled={loading || runAllActive}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Run-all progress bar */}
        {runAllActive && runAllProgress.total > 0 && (
          <div className="mb-4 space-y-1.5">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Loader2 className="h-3 w-3 animate-spin" />
                Running source {runAllProgress.current} of {runAllProgress.total}
                {runAllCurrentSource && (
                  <span className="font-medium text-foreground">
                    — {sources.find(s => s.id === runAllCurrentSource)?.source_name}
                  </span>
                )}
              </span>
              <span>{Math.round((runAllProgress.current / runAllProgress.total) * 100)}%</span>
            </div>
            <Progress value={(runAllProgress.current / runAllProgress.total) * 100} className="h-2" />
          </div>
        )}

        {/* Batch report */}
        {batchReport && (
          <div className="mb-4 border rounded-lg bg-muted/30 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold flex items-center gap-1.5">
                <BarChart3 className="h-4 w-4" /> Batch Run Report
              </h4>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Total: {formatDuration(batchReport.totalDurationMs)}</span>
                <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => setBatchReport(null)}>Dismiss</Button>
              </div>
            </div>
            <div className="flex gap-2 text-xs">
              <Badge variant="default" className="bg-green-600 text-white">
                {batchReport.results.filter(r => r.status === 'success').length} Succeeded
              </Badge>
              {batchReport.results.some(r => r.status === 'error') && (
                <Badge variant="destructive">{batchReport.results.filter(r => r.status === 'error').length} Failed</Badge>
              )}
              {batchReport.results.some(r => r.status === 'skipped') && (
                <Badge variant="secondary">{batchReport.results.filter(r => r.status === 'skipped').length} Skipped</Badge>
              )}
              <Badge variant="outline">{batchReport.results.reduce((s, r) => s + r.staged, 0)} Total Staged</Badge>
              <Badge variant="outline">{batchReport.results.reduce((s, r) => s + r.rejected, 0)} Total Rejected</Badge>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs h-7">Source</TableHead>
                  <TableHead className="text-xs h-7">Status</TableHead>
                  <TableHead className="text-xs h-7 text-right">Staged</TableHead>
                  <TableHead className="text-xs h-7 text-right">Rejected</TableHead>
                  <TableHead className="text-xs h-7 text-right">Duration</TableHead>
                  <TableHead className="text-xs h-7">Error</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {batchReport.results.map((r) => (
                  <TableRow key={r.sourceId}>
                    <TableCell className="text-xs py-1 font-medium">{r.sourceName}</TableCell>
                    <TableCell className="text-xs py-1">
                      {r.status === 'success' && <CheckCircle className="h-3.5 w-3.5 text-green-600 inline" />}
                      {r.status === 'error' && <XCircle className="h-3.5 w-3.5 text-destructive inline" />}
                      {r.status === 'skipped' && <span className="text-muted-foreground">Skipped</span>}
                    </TableCell>
                    <TableCell className="text-xs py-1 text-right">{r.staged}</TableCell>
                    <TableCell className="text-xs py-1 text-right">{r.rejected}</TableCell>
                    <TableCell className="text-xs py-1 text-right">{formatDuration(r.durationMs)}</TableCell>
                    <TableCell className="text-xs py-1 text-destructive truncate max-w-[200px]">{r.error || '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : sources.length === 0 ? (
          <p className="text-center py-6 text-muted-foreground text-sm">No Firecrawl sources configured.</p>
        ) : (
          <div className="space-y-2">
            {sources.map(source => {
              const stats = sourceStats[source.id];
              const hasPendingScrape = stats ? stats.pendingUrlOnly > 0 : false;
              const hasPendingExtract = stats ? stats.scraped > 0 : false;

              return (
                <div key={source.id} className={`border rounded-lg ${runAllCurrentSource === source.id ? 'ring-2 ring-primary' : ''}`}>
                  {/* Source row */}
                  <div className="flex items-center gap-3 p-3">
                    <Switch
                      checked={source.is_enabled}
                      onCheckedChange={(checked) => toggleEnabled(source.id, checked)}
                      disabled={runAllActive}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm truncate">{source.source_name}</p>
                        <Badge className={`text-[10px] ${priorityColor(source.priority)}`}>{source.priority}</Badge>
                        {source.last_error && <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0" />}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{source.seed_url}</p>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-muted-foreground shrink-0">
                      <div className="text-center">
                        <p className="font-medium text-foreground">{source.total_items_found}</p>
                        <p>Items</p>
                      </div>
                      <div className="text-center">
                        <p className="font-medium text-foreground">{timeAgo(source.last_fetched_at)}</p>
                        <p>Last run</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {/* Discover */}
                      <Button size="sm" variant="outline" disabled={isBusy(source.id)} onClick={() => runDiscovery(source.id)} title="Discover URLs">
                        {busySources[source.id] === 'discovering' ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
                      </Button>
                      {/* Scrape Pending */}
                      <Button size="sm" variant="outline" disabled={isBusy(source.id)} onClick={() => runScrapePending(source.id)} title="Scrape Pending (fetch page content)">
                        {busySources[source.id] === 'scraping' ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
                      </Button>
                      {/* Extract Pending */}
                      <Button size="sm" variant="outline" disabled={isBusy(source.id)} onClick={() => runExtractBatch(source.id)} title="Extract Pending (create drafts)">
                        {busySources[source.id] === 'extracting' ? <Loader2 className="h-3 w-3 animate-spin" /> : <FileText className="h-3 w-3" />}
                      </Button>
                      {/* Expand */}
                      <Button size="sm" variant="ghost" onClick={() => toggleExpand(source.id)}>
                        {expandedSource === source.id ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                      </Button>
                    </div>
                  </div>

                  {/* Expanded details */}
                  {expandedSource === source.id && (
                    <div className="border-t p-3 space-y-3 bg-muted/30">
                      {/* Edit seed URL */}
                      <div className="flex items-center gap-2">
                        <Label className="text-xs shrink-0">Seed URL</Label>
                        <Input
                          value={editingSeed[source.id] ?? source.seed_url}
                          onChange={(e) => setEditingSeed(prev => ({ ...prev, [source.id]: e.target.value }))}
                          className="h-7 text-xs"
                        />
                        {editingSeed[source.id] && editingSeed[source.id] !== source.seed_url && (
                          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => saveSeedUrl(source.id)}>Save</Button>
                        )}
                      </div>

                      {/* Priority select */}
                      <div className="flex items-center gap-2">
                        <Label className="text-xs shrink-0">Priority</Label>
                        <select
                          value={source.priority}
                          onChange={(e) => updatePriority(source.id, e.target.value)}
                          className="h-7 text-xs rounded border px-2 bg-background"
                        >
                          <option value="High">High</option>
                          <option value="Medium">Medium</option>
                          <option value="Low">Low</option>
                        </select>
                        <span className="text-xs text-muted-foreground">Max pages/run: {source.max_pages_per_run}</span>
                      </div>

                      {/* Error display */}
                      {source.last_error && (
                        <div className="bg-destructive/10 text-destructive text-xs p-2 rounded">
                          <strong>Last error:</strong> {source.last_error}
                        </div>
                      )}

                      {/* Stats */}
                      {stats ? (
                        <div className="space-y-3">
                          {/* Pipeline progress */}
                          <div>
                            <div className="flex items-center gap-1 text-xs font-medium mb-1.5">
                              <BarChart3 className="h-3 w-3" /> Pipeline Progress
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-1.5 text-xs">
                              <StatBox label="Total Staged" value={stats.totalStaged} />
                              <StatBox label="URL-Only" value={stats.pendingUrlOnly} highlight={stats.pendingUrlOnly > 0 ? 'warn' : undefined} />
                              <StatBox label="Scraped" value={stats.scraped} highlight={stats.scraped > 0 ? 'info' : undefined} />
                              <StatBox label="Extracted" value={stats.extracted} highlight="good" />
                              <StatBox label="Failed" value={stats.extractionFailed} highlight={stats.extractionFailed > 0 ? 'bad' : undefined} />
                              <StatBox label="Rejected" value={stats.rejectedBucket} />
                              <StatBox label="Duplicate" value={stats.duplicateStaged} />
                            </div>
                          </div>

                          {/* Draft stats */}
                          {stats.draftCounts.total > 0 && (
                            <div>
                              <div className="flex items-center gap-1 text-xs font-medium mb-1.5">
                                <FileText className="h-3 w-3" /> Draft Jobs
                              </div>
                              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-1.5 text-xs">
                                <StatBox label="Total" value={stats.draftCounts.total} />
                                <StatBox label="High Conf." value={stats.draftCounts.high} highlight="good" />
                                <StatBox label="Medium" value={stats.draftCounts.medium} highlight="info" />
                                <StatBox label="Low" value={stats.draftCounts.low} highlight="warn" />
                                <StatBox label="Draft" value={stats.draftCounts.draft} />
                                <StatBox label="Reviewed" value={stats.draftCounts.reviewed} highlight="info" />
                                <StatBox label="Approved" value={stats.draftCounts.approved} highlight="good" />
                                <StatBox label="Duplicate" value={stats.draftCounts.duplicate} highlight={stats.draftCounts.duplicate > 0 ? 'bad' : undefined} />
                              </div>
                            </div>
                          )}

                          {/* Bucket counts */}
                          {Object.keys(stats.bucketCounts).length > 0 && (
                            <div>
                              <p className="text-xs font-medium mb-1">Buckets</p>
                              <div className="flex flex-wrap gap-1.5">
                                {Object.entries(stats.bucketCounts).map(([bucket, count]) => (
                                  <Badge key={bucket} variant="outline" className="text-[10px]">
                                    {bucket}: {count as number}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Timestamps */}
                          <div className="flex gap-4 text-[10px] text-muted-foreground">
                            <span>Last scrape: {timeAgo(stats.lastScrapeAt)}</span>
                            <span>Last extract: {timeAgo(stats.lastExtractAt)}</span>
                          </div>

                          {/* Recent runs */}
                          {stats.recentRuns.length > 0 && (
                            <div>
                              <p className="text-xs font-medium mb-1">Recent Runs</p>
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead className="text-xs h-7">When</TableHead>
                                    <TableHead className="text-xs h-7">Status</TableHead>
                                    <TableHead className="text-xs h-7">Pages</TableHead>
                                    <TableHead className="text-xs h-7">Accepted</TableHead>
                                    <TableHead className="text-xs h-7">Rejected</TableHead>
                                    <TableHead className="text-xs h-7">New</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {stats.recentRuns.map((run: any) => (
                                    <TableRow key={run.id}>
                                      <TableCell className="text-xs py-1">{timeAgo(run.started_at)}</TableCell>
                                      <TableCell className="text-xs py-1">
                                        <Badge variant={run.status === 'success' ? 'default' : 'destructive'} className="text-[9px]">{run.status}</Badge>
                                      </TableCell>
                                      <TableCell className="text-xs py-1">{run.pages_fetched}</TableCell>
                                      <TableCell className="text-xs py-1">{run.pages_accepted}</TableCell>
                                      <TableCell className="text-xs py-1">{run.pages_rejected}</TableCell>
                                      <TableCell className="text-xs py-1">{run.items_new}</TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Loader2 className="h-3 w-3 animate-spin" /> Loading stats...
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Small stat box component ──
function StatBox({ label, value, highlight }: { label: string; value: number; highlight?: 'good' | 'warn' | 'bad' | 'info' }) {
  const bg = highlight === 'good' ? 'bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800'
    : highlight === 'warn' ? 'bg-yellow-50 border-yellow-200 dark:bg-yellow-950 dark:border-yellow-800'
    : highlight === 'bad' ? 'bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800'
    : highlight === 'info' ? 'bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-800'
    : 'bg-background';

  return (
    <div className={`p-1.5 rounded border text-center ${bg}`}>
      <p className="font-bold text-sm">{value}</p>
      <p className="text-muted-foreground text-[10px] leading-tight">{label}</p>
    </div>
  );
}
