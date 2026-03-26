/**
 * Government Sources management panel for bulk importing official govt URLs
 * into the existing Firecrawl pipeline. Renders inside the Firecrawl admin area.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Loader2, Plus, Upload, CheckCircle, AlertTriangle, XCircle,
  Globe, ChevronDown, ChevronUp, RefreshCw, Play, Pause, Trash2,
  Zap, StopCircle, RotateCcw, FileText,
} from 'lucide-react';

/* ─── Types ─── */
interface GovtSource {
  id: string;
  source_name: string;
  seed_url: string;
  source_type: string;
  is_enabled: boolean;
  priority: string;
  crawl_mode: string;
  extraction_mode: string;
  max_pages_per_run: number;
  last_fetched_at: string | null;
  last_success_at: string | null;
  last_error: string | null;
  total_items_found: number;
  govt_meta: {
    state?: string;
    ministry?: string;
    category?: string;
    domain_label?: string;
  };
}

interface ParsedUrl {
  raw: string;
  normalized: string;
  domain: string;
  label: string;
  validation: 'confirmed' | 'likely' | 'non-govt';
  isDuplicate: boolean;
  duplicateOf?: string;
}

interface BatchReport {
  phase: string;
  total_sources: number;
  results: {
    source_id: string;
    source_name: string;
    discover?: { success: boolean; stats?: any; error?: string };
    scrape_extract?: { success: boolean; scraped?: number; extracted?: number; failed?: number; error?: string };
    error?: string;
  }[];
  completed_at: string;
}

/* ─── Government domain helpers ─── */
const GOVT_TLDS = ['.gov.in', '.nic.in'];
const LIKELY_GOVT = ['.ac.in', '.res.in', '.org.in'];
const KNOWN_GOVT_DOMAINS = [
  'upsc.gov.in', 'ssc.nic.in', 'ibps.in', 'rbi.org.in',
  'nta.ac.in', 'ugc.ac.in', 'aicte-india.org',
];

function classifyDomain(domain: string): 'confirmed' | 'likely' | 'non-govt' {
  if (GOVT_TLDS.some(t => domain.endsWith(t))) return 'confirmed';
  if (LIKELY_GOVT.some(t => domain.endsWith(t))) return 'likely';
  if (KNOWN_GOVT_DOMAINS.some(d => domain === d || domain.endsWith('.' + d))) return 'likely';
  return 'non-govt';
}

function normalizeUrl(raw: string): string {
  let url = raw.trim();
  if (!url) return '';
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
  try {
    const parsed = new URL(url);
    parsed.hostname = parsed.hostname.toLowerCase();
    if (parsed.pathname === '/') parsed.pathname = '';
    return parsed.toString().replace(/\/$/, '');
  } catch {
    return url;
  }
}

function extractDomain(url: string): string {
  try { return new URL(url).hostname; } catch { return url; }
}

function inferLabel(domain: string): string {
  const parts = domain.split('.');
  if (parts.length >= 3) return parts[0].toUpperCase();
  return domain;
}

/* ─── Indian states for dropdown ─── */
const INDIAN_STATES = [
  'All India', 'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar',
  'Chhattisgarh', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh',
  'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra',
  'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab',
  'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura',
  'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Delhi', 'Jammu & Kashmir', 'Ladakh', 'Chandigarh', 'Puducherry',
];

/* ─── Helper to call edge function ─── */
async function invokeFirecrawl(action: string, body: Record<string, unknown> = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  const resp = await supabase.functions.invoke('firecrawl-ingest', {
    body: { action, ...body },
    headers: { Authorization: `Bearer ${session?.access_token}` },
  });
  if (resp.error) throw new Error(resp.error.message || 'Edge function error');
  return resp.data;
}

/* ─── Component ─── */
export function GovtSourcesManager() {
  const [sources, setSources] = useState<GovtSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(true);
  const [busySources, setBusySources] = useState<Record<string, string>>({});
  const [bulkToggling, setBulkToggling] = useState(false);

  // Bulk run state
  const [batchRunning, setBatchRunning] = useState(false);
  const [batchPhase, setBatchPhase] = useState('');
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 });
  const stopRequestedRef = useRef(false);
  const [batchReport, setBatchReport] = useState<BatchReport | null>(null);

  // Bulk import state
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [importState, setImportState] = useState<string>('');
  const [importMinistry, setImportMinistry] = useState('');
  const [importCategory, setImportCategory] = useState('');
  const [parsedUrls, setParsedUrls] = useState<ParsedUrl[]>([]);
  const [importStep, setImportStep] = useState<'input' | 'preview'>('input');
  const [saving, setSaving] = useState(false);
  const [overrideNonGovt, setOverrideNonGovt] = useState(false);

  // Add single source
  const [addOpen, setAddOpen] = useState(false);
  const [addUrl, setAddUrl] = useState('');
  const [addState, setAddState] = useState('');
  const [addMinistry, setAddMinistry] = useState('');
  const [addSaving, setAddSaving] = useState(false);

  /* ─── Fetch sources ─── */
  const fetchSources = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('firecrawl_sources')
      .select('*')
      .eq('source_type', 'government')
      .order('source_name');

    if (error) {
      toast({ title: 'Error loading govt sources', description: error.message, variant: 'destructive' });
    } else {
      setSources((data as any[])?.map(s => ({
        ...s,
        govt_meta: typeof s.govt_meta === 'object' && s.govt_meta ? s.govt_meta : {},
      })) || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchSources(); }, [fetchSources]);

  /* ─── Toggle enabled ─── */
  const toggleEnabled = async (id: string, enabled: boolean) => {
    const { error } = await supabase
      .from('firecrawl_sources')
      .update({ is_enabled: enabled, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      setSources(prev => prev.map(s => s.id === id ? { ...s, is_enabled: enabled } : s));
    }
  };

  /* ─── Run discovery for a single source ─── */
  const runDiscovery = async (source: GovtSource) => {
    setBusySources(prev => ({ ...prev, [source.id]: 'discovering' }));
    try {
      const result = await invokeFirecrawl('discover-govt', { source_id: source.id });
      toast({
        title: `Discovery: ${source.source_name}`,
        description: `Staged ${result?.stats?.staged ?? 0} URLs (${result?.stats?.pdfLinks ?? 0} PDFs), ${result?.stats?.duplicateUrls ?? 0} dupes skipped`,
      });
      fetchSources();
    } catch (err: any) {
      toast({ title: 'Discovery failed', description: err.message, variant: 'destructive' });
    } finally {
      setBusySources(prev => { const n = { ...prev }; delete n[source.id]; return n; });
    }
  };

  /* ─── Scrape & Extract for a single source ─── */
  const runScrapeExtract = async (source: GovtSource) => {
    setBusySources(prev => ({ ...prev, [source.id]: 'scraping' }));
    try {
      const result = await invokeFirecrawl('govt-scrape-extract', { source_id: source.id });
      toast({
        title: `Scrape & Extract: ${source.source_name}`,
        description: `Scraped ${result?.scraped ?? 0}, Extracted ${result?.extracted ?? 0}, Failed ${result?.failed ?? 0}`,
      });
      fetchSources();
    } catch (err: any) {
      toast({ title: 'Scrape & Extract failed', description: err.message, variant: 'destructive' });
    } finally {
      setBusySources(prev => { const n = { ...prev }; delete n[source.id]; return n; });
    }
  };

  /* ─── Full pipeline for a single source ─── */
  const runFullPipeline = async (source: GovtSource) => {
    setBusySources(prev => ({ ...prev, [source.id]: 'pipeline' }));
    try {
      const discoverResult = await invokeFirecrawl('discover-govt', { source_id: source.id });
      const seResult = await invokeFirecrawl('govt-scrape-extract', { source_id: source.id });
      toast({
        title: `Full Pipeline: ${source.source_name}`,
        description: `Discovered ${discoverResult?.stats?.staged ?? 0}, Extracted ${seResult?.extracted ?? 0}`,
      });
      fetchSources();
    } catch (err: any) {
      toast({ title: 'Pipeline failed', description: err.message, variant: 'destructive' });
    } finally {
      setBusySources(prev => { const n = { ...prev }; delete n[source.id]; return n; });
    }
  };

  /* ─── Bulk run all (client-side iteration with stop support) ─── */
  const runBatchAll = async (phase: 'discover' | 'scrape-extract' | 'full') => {
    setBatchRunning(true);
    setBatchPhase(phase);
    stopRequestedRef.current = false;
    setBatchReport(null);

    const enabledSources = sources.filter(s => s.is_enabled);
    setBatchProgress({ current: 0, total: enabledSources.length });

    const results: BatchReport['results'] = [];

    for (let i = 0; i < enabledSources.length; i++) {
      if (stopRequestedRef.current) {
        toast({ title: `Batch ${phase} stopped`, description: `Stopped after ${i} of ${enabledSources.length} sources` });
        break;
      }

      const source = enabledSources[i];
      setBatchProgress({ current: i + 1, total: enabledSources.length });
      setBusySources(prev => ({ ...prev, [source.id]: phase === 'discover' ? 'discovering' : phase === 'scrape-extract' ? 'scraping' : 'pipeline' }));

      const entry: BatchReport['results'][number] = { source_id: source.id, source_name: source.source_name };

      try {
        if (phase === 'discover' || phase === 'full') {
          const discResult = await invokeFirecrawl('discover-govt', { source_id: source.id });
          entry.discover = { success: true, stats: discResult?.stats };
        }
        if (phase === 'scrape-extract' || phase === 'full') {
          if (stopRequestedRef.current) { results.push(entry); break; }
          const seResult = await invokeFirecrawl('govt-scrape-extract', { source_id: source.id });
          entry.scrape_extract = { success: true, scraped: seResult?.scraped ?? 0, extracted: seResult?.extracted ?? 0, failed: seResult?.failed ?? 0 };
        }
      } catch (err: any) {
        entry.error = err.message;
        if (phase === 'discover' || phase === 'full') entry.discover = { success: false, error: err.message };
        if (phase === 'scrape-extract' || phase === 'full') entry.scrape_extract = entry.scrape_extract || { success: false, error: err.message };
      } finally {
        setBusySources(prev => { const n = { ...prev }; delete n[source.id]; return n; });
      }

      results.push(entry);
    }

    setBatchReport({
      phase: stopRequestedRef.current ? `${phase} (stopped)` : phase,
      total_sources: results.length,
      results,
      completed_at: new Date().toISOString(),
    });
    toast({ title: `Batch ${phase} ${stopRequestedRef.current ? 'stopped' : 'completed'}`, description: `${results.length} sources processed` });
    fetchSources();
    setBatchRunning(false);
    setBatchPhase('');
  };

  /* ─── Stop batch ─── */
  const stopBatch = () => {
    stopRequestedRef.current = true;
    toast({ title: 'Stop requested', description: 'Will stop after current source completes' });
  };

  /* ─── Retry failed sources ─── */
  const retryFailed = async () => {
    const failedSources = sources.filter(s => s.last_error);
    if (!failedSources.length) {
      toast({ title: 'No failed sources to retry' });
      return;
    }
    setBatchRunning(true);
    setBatchPhase('retry');
    stopRequestedRef.current = false;
    setBatchReport(null);
    setBatchProgress({ current: 0, total: failedSources.length });

    const results: BatchReport['results'] = [];
    for (let i = 0; i < failedSources.length; i++) {
      if (stopRequestedRef.current) break;
      const source = failedSources[i];
      setBatchProgress({ current: i + 1, total: failedSources.length });
      setBusySources(prev => ({ ...prev, [source.id]: 'pipeline' }));

      const entry: BatchReport['results'][number] = { source_id: source.id, source_name: source.source_name };
      try {
        const discResult = await invokeFirecrawl('discover-govt', { source_id: source.id });
        entry.discover = { success: true, stats: discResult?.stats };
        if (!stopRequestedRef.current) {
          const seResult = await invokeFirecrawl('govt-scrape-extract', { source_id: source.id });
          entry.scrape_extract = { success: true, scraped: seResult?.scraped ?? 0, extracted: seResult?.extracted ?? 0, failed: seResult?.failed ?? 0 };
        }
      } catch (err: any) {
        entry.error = err.message;
      } finally {
        setBusySources(prev => { const n = { ...prev }; delete n[source.id]; return n; });
      }
      results.push(entry);
    }

    setBatchReport({ phase: 'retry', total_sources: results.length, results, completed_at: new Date().toISOString() });
    toast({ title: 'Retry completed' });
    fetchSources();
    setBatchRunning(false);
    setBatchPhase('');
  };

  /* ─── Parse URLs for bulk import ─── */
  const parseImportUrls = async () => {
    const lines = importText.split('\n').map(l => l.trim()).filter(Boolean);
    if (!lines.length) {
      toast({ title: 'No URLs entered', variant: 'destructive' });
      return;
    }
    const { data: existing } = await supabase.from('firecrawl_sources').select('seed_url, source_name');
    const existingMap = new Map((existing || []).map(e => [e.seed_url, e.source_name]));

    const parsed: ParsedUrl[] = lines.map(raw => {
      const normalized = normalizeUrl(raw);
      const domain = extractDomain(normalized);
      const label = inferLabel(domain);
      const validation = classifyDomain(domain);
      const isDuplicate = existingMap.has(normalized);
      return { raw, normalized, domain, label, validation, isDuplicate, duplicateOf: isDuplicate ? existingMap.get(normalized) : undefined };
    });

    const seen = new Set<string>();
    for (const p of parsed) {
      if (seen.has(p.normalized)) { p.isDuplicate = true; p.duplicateOf = 'duplicate in batch'; }
      seen.add(p.normalized);
    }
    setParsedUrls(parsed);
    setImportStep('preview');
  };

  /* ─── Save valid URLs ─── */
  const saveImportedUrls = async () => {
    const toSave = parsedUrls.filter(p => !p.isDuplicate && (overrideNonGovt || p.validation !== 'non-govt'));
    if (!toSave.length) { toast({ title: 'No valid URLs to save', variant: 'destructive' }); return; }

    setSaving(true);
    const rows = toSave.map(p => ({
      source_name: p.label,
      seed_url: p.normalized,
      source_type: 'government' as const,
      crawl_mode: 'map',
      extraction_mode: 'markdown',
      max_pages_per_run: 50,
      is_enabled: false,
      default_bucket: 'staging',
      priority: 'Medium',
      allowed_domains: [p.domain],
      govt_meta: {
        state: importState || undefined,
        ministry: importMinistry || undefined,
        category: importCategory || undefined,
        domain_label: p.label,
      },
    }));

    const { error } = await supabase.from('firecrawl_sources').insert(rows as any);
    setSaving(false);
    if (error) {
      toast({ title: 'Import failed', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: `Imported ${rows.length} government sources` });
      setImportOpen(false); setImportText(''); setParsedUrls([]); setImportStep('input');
      setImportState(''); setImportMinistry(''); setImportCategory(''); setOverrideNonGovt(false);
      fetchSources();
    }
  };

  /* ─── Add single source ─── */
  const addSingleSource = async () => {
    const normalized = normalizeUrl(addUrl);
    if (!normalized) return;
    const domain = extractDomain(normalized);
    setAddSaving(true);
    const { error } = await supabase.from('firecrawl_sources').insert({
      source_name: inferLabel(domain),
      seed_url: normalized,
      source_type: 'government',
      crawl_mode: 'map',
      extraction_mode: 'markdown',
      max_pages_per_run: 50,
      is_enabled: false,
      default_bucket: 'staging',
      priority: 'Medium',
      allowed_domains: [domain],
      govt_meta: { state: addState || undefined, ministry: addMinistry || undefined, domain_label: inferLabel(domain) },
    } as any);
    setAddSaving(false);
    if (error) {
      toast({ title: 'Failed to add source', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Government source added' });
      setAddOpen(false); setAddUrl(''); setAddState(''); setAddMinistry('');
      fetchSources();
    }
  };

  /* ─── Delete source ─── */
  const deleteSource = async (id: string) => {
    const { error } = await supabase.from('firecrawl_sources').delete().eq('id', id);
    if (error) {
      toast({ title: 'Delete failed', description: error.message, variant: 'destructive' });
    } else {
      setSources(prev => prev.filter(s => s.id !== id));
      toast({ title: 'Source deleted' });
    }
  };

  /* ─── Bulk toggle all sources ─── */
  const bulkToggleAll = async (enable: boolean) => {
    if (sources.length === 0) return;
    setBulkToggling(true);
    const ids = sources.map(s => s.id);
    const { error } = await supabase
      .from('firecrawl_sources')
      .update({ is_enabled: enable, updated_at: new Date().toISOString() })
      .eq('source_type', 'government')
      .in('id', ids);
    if (error) {
      toast({ title: 'Bulk toggle failed', description: error.message, variant: 'destructive' });
    } else {
      setSources(prev => prev.map(s => ({ ...s, is_enabled: enable })));
      toast({ title: enable ? 'All sources enabled' : 'All sources disabled' });
    }
    setBulkToggling(false);
  };

  /* ─── Counts ─── */
  const enabledCount = sources.filter(s => s.is_enabled).length;
  const totalItems = sources.reduce((sum, s) => sum + s.total_items_found, 0);
  const failedCount = sources.filter(s => s.last_error).length;

  const validationBadge = (v: 'confirmed' | 'likely' | 'non-govt') => {
    if (v === 'confirmed') return <Badge variant="default" className="text-[10px] bg-green-600">✅ Govt</Badge>;
    if (v === 'likely') return <Badge variant="secondary" className="text-[10px]">⚠️ Likely</Badge>;
    return <Badge variant="destructive" className="text-[10px]">❌ Non-Govt</Badge>;
  };

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CollapsibleTrigger className="flex items-center gap-2 cursor-pointer hover:opacity-80">
              <Globe className="h-5 w-5 text-green-600" />
              <CardTitle className="text-base">
                Firecrawl Government Sources ({sources.length})
              </CardTitle>
              {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </CollapsibleTrigger>
            <div className="flex items-center gap-1.5 flex-wrap">
              <Badge variant="outline" className="text-xs">
                {enabledCount} active · {totalItems} items{failedCount > 0 ? ` · ${failedCount} errors` : ''}
              </Badge>
              {sources.length > 0 && (
                <Button
                  size="sm"
                  variant={enabledCount === sources.length ? "destructive" : "default"}
                  className="h-7 text-xs"
                  disabled={bulkToggling || sources.length === 0}
                  onClick={() => bulkToggleAll(enabledCount < sources.length)}
                >
                  {bulkToggling ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : enabledCount === sources.length ? <Pause className="h-3 w-3 mr-1" /> : <Play className="h-3 w-3 mr-1" />}
                  {enabledCount === sources.length ? 'Disable All' : 'Enable All'}
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={() => setAddOpen(true)} className="h-7 text-xs">
                <Plus className="h-3 w-3 mr-1" /> Add
              </Button>
              <Button size="sm" variant="outline" onClick={() => { setImportOpen(true); setImportStep('input'); }} className="h-7 text-xs">
                <Upload className="h-3 w-3 mr-1" /> Import
              </Button>
              {/* Bulk run buttons */}
              <Button
                size="sm" variant="outline" className="h-7 text-xs"
                disabled={batchRunning || enabledCount === 0}
                onClick={() => runBatchAll('discover')}
              >
                <Play className="h-3 w-3 mr-1" /> Discover All
              </Button>
              <Button
                size="sm" variant="outline" className="h-7 text-xs"
                disabled={batchRunning || enabledCount === 0}
                onClick={() => runBatchAll('scrape-extract')}
              >
                <FileText className="h-3 w-3 mr-1" /> Scrape All
              </Button>
              <Button
                size="sm" variant="default" className="h-7 text-xs"
                disabled={batchRunning || enabledCount === 0}
                onClick={() => runBatchAll('full')}
              >
                <Zap className="h-3 w-3 mr-1" /> Full Pipeline
              </Button>
              {failedCount > 0 && (
                <Button
                  size="sm" variant="outline" className="h-7 text-xs text-orange-600"
                  disabled={batchRunning}
                  onClick={retryFailed}
                >
                  <RotateCcw className="h-3 w-3 mr-1" /> Retry Failed ({failedCount})
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={fetchSources} disabled={loading} className="h-7">
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>

          {/* Batch progress */}
          {batchRunning && (
            <div className="flex items-center gap-2 mt-2 p-2 bg-muted rounded text-xs">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span>Running {batchPhase} on {enabledCount} sources...</span>
            </div>
          )}
        </CardHeader>

        <CollapsibleContent>
          <CardContent className="pt-2 space-y-3">
            {/* Batch Report */}
            {batchReport && (
              <Card className="border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-800">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm text-green-800 dark:text-green-200">
                      Batch Report — {batchReport.phase} ({batchReport.total_sources} sources)
                    </CardTitle>
                    <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={() => setBatchReport(null)}>
                      Dismiss
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="overflow-auto max-h-[300px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">Source</TableHead>
                          <TableHead className="text-xs">Discovery</TableHead>
                          <TableHead className="text-xs">Scrape/Extract</TableHead>
                          <TableHead className="text-xs">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {batchReport.results.map((r, i) => (
                          <TableRow key={i}>
                            <TableCell className="text-xs font-medium">{r.source_name}</TableCell>
                            <TableCell className="text-xs">
                              {r.discover ? (
                                r.discover.success
                                  ? <span className="text-green-600">Staged {r.discover.stats?.staged ?? 0} ({r.discover.stats?.pdfLinks ?? 0} PDFs)</span>
                                  : <span className="text-red-600">{r.discover.error || 'Failed'}</span>
                              ) : '—'}
                            </TableCell>
                            <TableCell className="text-xs">
                              {r.scrape_extract ? (
                                r.scrape_extract.success
                                  ? <span className="text-green-600">S:{r.scrape_extract.scraped} E:{r.scrape_extract.extracted} F:{r.scrape_extract.failed}</span>
                                  : <span className="text-red-600">{r.scrape_extract.error || 'Failed'}</span>
                              ) : '—'}
                            </TableCell>
                            <TableCell>
                              {r.error ? (
                                <Badge variant="destructive" className="text-[9px]">Error</Badge>
                              ) : (
                                <Badge variant="default" className="text-[9px] bg-green-600">OK</Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-2">
                    Completed at {new Date(batchReport.completed_at).toLocaleString()}
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Sources table */}
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : sources.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                No government sources yet. Click "Import" to add official URLs.
              </p>
            ) : (
              <div className="overflow-auto max-h-[500px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">On</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Domain</TableHead>
                      <TableHead>State</TableHead>
                      <TableHead className="text-right">Items</TableHead>
                      <TableHead>Last Run</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right min-w-[260px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sources.map(source => (
                      <TableRow key={source.id}>
                        <TableCell>
                          <Switch
                            checked={source.is_enabled}
                            onCheckedChange={v => toggleEnabled(source.id, v)}
                          />
                        </TableCell>
                        <TableCell className="font-medium text-xs max-w-[120px] truncate" title={source.source_name}>
                          {source.source_name}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[160px] truncate" title={source.seed_url}>
                          {extractDomain(source.seed_url)}
                        </TableCell>
                        <TableCell className="text-xs">{source.govt_meta?.state || '—'}</TableCell>
                        <TableCell className="text-right text-xs">{source.total_items_found}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {source.last_fetched_at ? new Date(source.last_fetched_at).toLocaleDateString() : 'Never'}
                        </TableCell>
                        <TableCell>
                          {source.last_error ? (
                            <Badge variant="destructive" className="text-[10px]" title={source.last_error}>Err</Badge>
                          ) : source.last_success_at ? (
                            <Badge variant="default" className="text-[10px] bg-green-600">OK</Badge>
                          ) : (
                            <Badge variant="secondary" className="text-[10px]">New</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-0.5 whitespace-nowrap">
                            <Button
                              size="sm" variant="ghost" className="h-6 text-[9px] px-1.5"
                              disabled={!!busySources[source.id]}
                              onClick={() => runDiscovery(source)}
                              title="Discover URLs"
                            >
                              {busySources[source.id] === 'discovering' ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
                              <span className="ml-0.5">Disc</span>
                            </Button>
                            <Button
                              size="sm" variant="ghost" className="h-6 text-[9px] px-1.5"
                              disabled={!!busySources[source.id]}
                              onClick={() => runScrapeExtract(source)}
                              title="Scrape & Extract"
                            >
                              {busySources[source.id] === 'scraping' ? <Loader2 className="h-3 w-3 animate-spin" /> : <FileText className="h-3 w-3" />}
                              <span className="ml-0.5">S&E</span>
                            </Button>
                            <Button
                              size="sm" variant="ghost" className="h-6 text-[9px] px-1.5"
                              disabled={!!busySources[source.id]}
                              onClick={() => runFullPipeline(source)}
                              title="Full Pipeline"
                            >
                              {busySources[source.id] === 'pipeline' ? <Loader2 className="h-3 w-3 animate-spin" /> : <Zap className="h-3 w-3" />}
                              <span className="ml-0.5">Full</span>
                            </Button>
                            <Button
                              size="sm" variant="ghost" className="h-6 text-[9px] px-1 text-destructive"
                              onClick={() => deleteSource(source.id)}
                              title="Delete"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>

      {/* ─── Add Single Source Dialog ─── */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Add Government Source</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">URL *</label>
              <Input placeholder="https://upsc.gov.in" value={addUrl} onChange={e => setAddUrl(e.target.value)} />
              {addUrl && <div className="mt-1">{validationBadge(classifyDomain(extractDomain(normalizeUrl(addUrl))))}</div>}
            </div>
            <div>
              <label className="text-sm font-medium">State</label>
              <Select value={addState} onValueChange={setAddState}>
                <SelectTrigger><SelectValue placeholder="Select state..." /></SelectTrigger>
                <SelectContent>{INDIAN_STATES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Ministry / Department</label>
              <Input placeholder="e.g. Ministry of Defence" value={addMinistry} onChange={e => setAddMinistry(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={addSingleSource} disabled={!addUrl.trim() || addSaving}>
              {addSaving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
              Add Source
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Bulk Import Dialog ─── */}
      <Dialog open={importOpen} onOpenChange={v => { if (!v) { setImportOpen(false); setImportStep('input'); setParsedUrls([]); } }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-auto">
          <DialogHeader><DialogTitle>Bulk Import Government Sources</DialogTitle></DialogHeader>

          {importStep === 'input' ? (
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium">Paste URLs (one per line)</label>
                <Textarea rows={10} placeholder={"https://upsc.gov.in\nhttps://ssc.nic.in\nhttps://ibps.in"} value={importText} onChange={e => setImportText(e.target.value)} />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-xs font-medium">State (all)</label>
                  <Select value={importState} onValueChange={setImportState}>
                    <SelectTrigger className="h-8"><SelectValue placeholder="Optional..." /></SelectTrigger>
                    <SelectContent>{INDIAN_STATES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-medium">Ministry (all)</label>
                  <Input className="h-8" placeholder="Optional" value={importMinistry} onChange={e => setImportMinistry(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs font-medium">Category (all)</label>
                  <Input className="h-8" placeholder="Optional" value={importCategory} onChange={e => setImportCategory(e.target.value)} />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={parseImportUrls} disabled={!importText.trim()}>
                  Preview & Validate
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <Badge variant="default" className="bg-green-600">{parsedUrls.filter(p => !p.isDuplicate && p.validation !== 'non-govt').length} valid</Badge>
                <Badge variant="secondary">{parsedUrls.filter(p => p.isDuplicate).length} duplicate</Badge>
                <Badge variant="destructive">{parsedUrls.filter(p => p.validation === 'non-govt' && !p.isDuplicate).length} non-govt</Badge>
              </div>

              <div className="flex items-center gap-2">
                <Switch checked={overrideNonGovt} onCheckedChange={setOverrideNonGovt} />
                <span className="text-xs">Include non-govt domains</span>
              </div>

              <div className="overflow-auto max-h-[350px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Status</TableHead>
                      <TableHead className="text-xs">Label</TableHead>
                      <TableHead className="text-xs">URL</TableHead>
                      <TableHead className="text-xs">Type</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedUrls.map((p, i) => (
                      <TableRow key={i} className={p.isDuplicate ? 'opacity-50' : ''}>
                        <TableCell>
                          {p.isDuplicate ? <XCircle className="h-4 w-4 text-muted-foreground" /> :
                           p.validation === 'non-govt' && !overrideNonGovt ? <AlertTriangle className="h-4 w-4 text-orange-500" /> :
                           <CheckCircle className="h-4 w-4 text-green-600" />}
                        </TableCell>
                        <TableCell className="text-xs font-medium">{p.label}</TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[250px] truncate">{p.normalized}</TableCell>
                        <TableCell>{validationBadge(p.validation)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setImportStep('input')}>Back</Button>
                <Button onClick={saveImportedUrls} disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Upload className="h-4 w-4 mr-1" />}
                  Save {parsedUrls.filter(p => !p.isDuplicate && (overrideNonGovt || p.validation !== 'non-govt')).length} Sources
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Collapsible>
  );
}
