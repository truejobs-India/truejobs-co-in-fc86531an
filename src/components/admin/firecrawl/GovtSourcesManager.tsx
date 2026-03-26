/**
 * Government Sources management panel for bulk importing official govt URLs
 * into the existing Firecrawl pipeline. Renders inside the Firecrawl admin area.
 */
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
    // Remove trailing slash from pathname
    if (parsed.pathname === '/') parsed.pathname = '';
    return parsed.toString().replace(/\/$/, '');
  } catch {
    return url;
  }
}

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

function inferLabel(domain: string): string {
  // upsc.gov.in → UPSC, ssc.nic.in → SSC
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

/* ─── Component ─── */
export function GovtSourcesManager() {
  const [sources, setSources] = useState<GovtSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(true);
  const [busySources, setBusySources] = useState<Record<string, string>>({});

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
      const { data: { session } } = await supabase.auth.getSession();
      const resp = await supabase.functions.invoke('firecrawl-ingest', {
        body: { action: 'discover', sourceId: source.id },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (resp.error) throw resp.error;
      const result = resp.data;
      toast({
        title: `Discovery: ${source.source_name}`,
        description: `Found ${result?.staged ?? 0} URLs, rejected ${result?.rejected ?? 0}`,
      });
      fetchSources();
    } catch (err: any) {
      toast({ title: 'Discovery failed', description: err.message, variant: 'destructive' });
    } finally {
      setBusySources(prev => { const n = { ...prev }; delete n[source.id]; return n; });
    }
  };

  /* ─── Parse URLs for bulk import ─── */
  const parseImportUrls = async () => {
    const lines = importText.split('\n').map(l => l.trim()).filter(Boolean);
    if (!lines.length) {
      toast({ title: 'No URLs entered', variant: 'destructive' });
      return;
    }

    // Get existing seed_urls for dedup
    const { data: existing } = await supabase
      .from('firecrawl_sources')
      .select('seed_url, source_name');
    const existingMap = new Map((existing || []).map(e => [e.seed_url, e.source_name]));

    const parsed: ParsedUrl[] = lines.map(raw => {
      const normalized = normalizeUrl(raw);
      const domain = extractDomain(normalized);
      const label = inferLabel(domain);
      const validation = classifyDomain(domain);
      const isDuplicate = existingMap.has(normalized);
      return {
        raw,
        normalized,
        domain,
        label,
        validation,
        isDuplicate,
        duplicateOf: isDuplicate ? existingMap.get(normalized) : undefined,
      };
    });

    // Dedup within the batch itself
    const seen = new Set<string>();
    for (const p of parsed) {
      if (seen.has(p.normalized)) {
        p.isDuplicate = true;
        p.duplicateOf = 'duplicate in batch';
      }
      seen.add(p.normalized);
    }

    setParsedUrls(parsed);
    setImportStep('preview');
  };

  /* ─── Save valid URLs ─── */
  const saveImportedUrls = async () => {
    const toSave = parsedUrls.filter(p => !p.isDuplicate && (overrideNonGovt || p.validation !== 'non-govt'));
    if (!toSave.length) {
      toast({ title: 'No valid URLs to save', variant: 'destructive' });
      return;
    }

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
      setImportOpen(false);
      setImportText('');
      setParsedUrls([]);
      setImportStep('input');
      setImportState('');
      setImportMinistry('');
      setImportCategory('');
      setOverrideNonGovt(false);
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
      govt_meta: {
        state: addState || undefined,
        ministry: addMinistry || undefined,
        domain_label: inferLabel(domain),
      },
    } as any);
    setAddSaving(false);

    if (error) {
      toast({ title: 'Failed to add source', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Government source added' });
      setAddOpen(false);
      setAddUrl('');
      setAddState('');
      setAddMinistry('');
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

  /* ─── Counts ─── */
  const enabledCount = sources.filter(s => s.is_enabled).length;
  const totalItems = sources.reduce((sum, s) => sum + s.total_items_found, 0);

  const validationBadge = (v: 'confirmed' | 'likely' | 'non-govt') => {
    if (v === 'confirmed') return <Badge variant="default" className="text-[10px] bg-green-600">✅ Govt</Badge>;
    if (v === 'likely') return <Badge variant="secondary" className="text-[10px]">⚠️ Likely</Badge>;
    return <Badge variant="destructive" className="text-[10px]">❌ Non-Govt</Badge>;
  };

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CollapsibleTrigger className="flex items-center gap-2 cursor-pointer hover:opacity-80">
              <Globe className="h-5 w-5 text-green-600" />
              <CardTitle className="text-base">
                Government Sources ({sources.length})
              </CardTitle>
              {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </CollapsibleTrigger>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                {enabledCount} active · {totalItems} items
              </Badge>
              <Button size="sm" variant="outline" onClick={() => setAddOpen(true)}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Add
              </Button>
              <Button size="sm" variant="outline" onClick={() => { setImportOpen(true); setImportStep('input'); }}>
                <Upload className="h-3.5 w-3.5 mr-1" /> Bulk Import
              </Button>
              <Button size="sm" variant="ghost" onClick={fetchSources} disabled={loading}>
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
        </CardHeader>

        <CollapsibleContent>
          <CardContent className="pt-2">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : sources.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                No government sources yet. Click "Bulk Import" to add official URLs.
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
                      <TableHead>Ministry</TableHead>
                      <TableHead className="text-right">Items</TableHead>
                      <TableHead>Last Run</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
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
                        <TableCell className="font-medium text-xs max-w-[150px] truncate">
                          {source.source_name}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                          {extractDomain(source.seed_url)}
                        </TableCell>
                        <TableCell className="text-xs">{source.govt_meta?.state || '—'}</TableCell>
                        <TableCell className="text-xs max-w-[120px] truncate">{source.govt_meta?.ministry || '—'}</TableCell>
                        <TableCell className="text-right text-xs">{source.total_items_found}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {source.last_fetched_at
                            ? new Date(source.last_fetched_at).toLocaleDateString()
                            : 'Never'}
                        </TableCell>
                        <TableCell>
                          {source.last_error ? (
                            <Badge variant="destructive" className="text-[10px]">Error</Badge>
                          ) : source.last_success_at ? (
                            <Badge variant="default" className="text-[10px] bg-green-600">OK</Badge>
                          ) : (
                            <Badge variant="secondary" className="text-[10px]">New</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-[10px] px-2"
                              disabled={!!busySources[source.id]}
                              onClick={() => runDiscovery(source)}
                            >
                              {busySources[source.id] === 'discovering' ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Play className="h-3 w-3" />
                              )}
                              <span className="ml-1">Discover</span>
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-[10px] px-1.5 text-destructive"
                              onClick={() => deleteSource(source.id)}
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
          <DialogHeader>
            <DialogTitle>Add Government Source</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">URL *</label>
              <Input
                placeholder="https://upsc.gov.in"
                value={addUrl}
                onChange={e => setAddUrl(e.target.value)}
              />
              {addUrl && (
                <div className="mt-1">
                  {validationBadge(classifyDomain(extractDomain(normalizeUrl(addUrl))))}
                </div>
              )}
            </div>
            <div>
              <label className="text-sm font-medium">State</label>
              <Select value={addState} onValueChange={setAddState}>
                <SelectTrigger><SelectValue placeholder="Select state..." /></SelectTrigger>
                <SelectContent>
                  {INDIAN_STATES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Ministry / Department</label>
              <Input
                placeholder="e.g. Ministry of Defence"
                value={addMinistry}
                onChange={e => setAddMinistry(e.target.value)}
              />
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
          <DialogHeader>
            <DialogTitle>Bulk Import Government Sources</DialogTitle>
          </DialogHeader>

          {importStep === 'input' ? (
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium">Paste URLs (one per line)</label>
                <Textarea
                  rows={10}
                  placeholder={"https://upsc.gov.in\nhttps://ssc.nic.in\nhttps://ibps.in"}
                  value={importText}
                  onChange={e => setImportText(e.target.value)}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {importText.split('\n').filter(l => l.trim()).length} URLs entered
                </p>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-xs font-medium">State (all)</label>
                  <Select value={importState} onValueChange={setImportState}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Optional..." /></SelectTrigger>
                    <SelectContent>
                      {INDIAN_STATES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-medium">Ministry (all)</label>
                  <Input
                    className="h-8 text-xs"
                    placeholder="Optional..."
                    value={importMinistry}
                    onChange={e => setImportMinistry(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium">Category (all)</label>
                  <Input
                    className="h-8 text-xs"
                    placeholder="e.g. recruitment"
                    value={importCategory}
                    onChange={e => setImportCategory(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setImportOpen(false)}>Cancel</Button>
                <Button onClick={parseImportUrls} disabled={!importText.trim()}>
                  Validate & Preview
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Summary */}
              <div className="flex gap-3 text-xs">
                <span>Total: {parsedUrls.length}</span>
                <span className="text-green-600">
                  ✅ Valid: {parsedUrls.filter(p => !p.isDuplicate && (overrideNonGovt || p.validation !== 'non-govt')).length}
                </span>
                <span className="text-yellow-600">
                  ⚠️ Duplicate: {parsedUrls.filter(p => p.isDuplicate).length}
                </span>
                <span className="text-red-600">
                  ❌ Non-Govt: {parsedUrls.filter(p => p.validation === 'non-govt' && !p.isDuplicate).length}
                </span>
              </div>

              {parsedUrls.some(p => p.validation === 'non-govt' && !p.isDuplicate) && (
                <div className="flex items-center gap-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded text-xs">
                  <input
                    type="checkbox"
                    checked={overrideNonGovt}
                    onChange={e => setOverrideNonGovt(e.target.checked)}
                  />
                  <span>Include non-government domains anyway (manual override)</span>
                </div>
              )}

              <div className="overflow-auto max-h-[400px] border rounded">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Status</TableHead>
                      <TableHead className="text-xs">Label</TableHead>
                      <TableHead className="text-xs">URL</TableHead>
                      <TableHead className="text-xs">Type</TableHead>
                      <TableHead className="text-xs">Note</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedUrls.map((p, i) => (
                      <TableRow key={i} className={p.isDuplicate ? 'opacity-50' : ''}>
                        <TableCell>
                          {p.isDuplicate ? (
                            <XCircle className="h-3.5 w-3.5 text-yellow-500" />
                          ) : p.validation === 'non-govt' && !overrideNonGovt ? (
                            <XCircle className="h-3.5 w-3.5 text-destructive" />
                          ) : (
                            <CheckCircle className="h-3.5 w-3.5 text-green-600" />
                          )}
                        </TableCell>
                        <TableCell className="text-xs font-medium">{p.label}</TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[250px] truncate">{p.normalized}</TableCell>
                        <TableCell>{validationBadge(p.validation)}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {p.isDuplicate ? `Dup: ${p.duplicateOf}` : ''}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setImportStep('input')}>← Back</Button>
                <Button
                  onClick={saveImportedUrls}
                  disabled={saving || parsedUrls.filter(p => !p.isDuplicate && (overrideNonGovt || p.validation !== 'non-govt')).length === 0}
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Upload className="h-4 w-4 mr-1" />}
                  Import {parsedUrls.filter(p => !p.isDuplicate && (overrideNonGovt || p.validation !== 'non-govt')).length} Sources
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Collapsible>
  );
}
