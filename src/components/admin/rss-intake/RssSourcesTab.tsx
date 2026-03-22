import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAdminToast } from '@/contexts/AdminMessagesContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Play, TestTube, Upload, Zap, ExternalLink, RefreshCw, Search, Pencil, Rss, ListPlus } from 'lucide-react';
import type { RssSource } from './rssTypes';
import { RSS_PRIORITIES, RSS_STATUSES } from './rssTypes';

const emptySource = {
  source_name: '',
  official_site: '',
  feed_url: '',
  source_type: 'rss',
  focus: '',
  priority: 'Medium',
  status: 'Testing',
  language: '',
  category: '',
  state_or_scope: '',
  check_interval_hours: 6,
  fetch_enabled: true,
  notes: '',
};

export function RssSourcesTab() {
  const { toast } = useAdminToast();
  const [sources, setSources] = useState<RssSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterPriority, setFilterPriority] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterEnabled, setFilterEnabled] = useState('all');

  const [showAddEdit, setShowAddEdit] = useState(false);
  const [editingSource, setEditingSource] = useState<Partial<RssSource> | null>(null);
  const [formData, setFormData] = useState(emptySource);
  const [saving, setSaving] = useState(false);

  const [showTestResult, setShowTestResult] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);
  const [testing, setTesting] = useState<string | null>(null);
  const [running, setRunning] = useState<string | null>(null);
  const [runningDue, setRunningDue] = useState(false);

  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState('');
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [showBulkUrls, setShowBulkUrls] = useState(false);
  const [bulkUrlText, setBulkUrlText] = useState('');
  const [bulkAdding, setBulkAdding] = useState(false);
  const [bulkPriority, setBulkPriority] = useState('Medium');
  const [bulkStatus, setBulkStatus] = useState('Testing');

  const fetchSources = useCallback(async () => {
    setLoading(true);
    let query = supabase.from('rss_sources' as any).select('*').order('created_at', { ascending: false });
    if (filterPriority !== 'all') query = query.eq('priority', filterPriority);
    if (filterStatus !== 'all') query = query.eq('status', filterStatus);
    if (filterEnabled !== 'all') query = query.eq('fetch_enabled', filterEnabled === 'true');

    const { data, error } = await query;
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      setSources((data as any as RssSource[]) || []);
    }
    setLoading(false);
  }, [filterPriority, filterStatus, filterEnabled]);

  useEffect(() => { fetchSources(); }, [fetchSources]);

  const filteredSources = sources.filter((s) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return s.source_name.toLowerCase().includes(q) || s.feed_url.toLowerCase().includes(q) || (s.official_site || '').toLowerCase().includes(q);
  });

  const openAdd = () => {
    setEditingSource(null);
    setFormData({ ...emptySource });
    setShowAddEdit(true);
  };

  const openEdit = (src: RssSource) => {
    setEditingSource(src);
    setFormData({
      source_name: src.source_name,
      official_site: src.official_site || '',
      feed_url: src.feed_url,
      source_type: src.source_type,
      focus: src.focus || '',
      priority: src.priority,
      status: src.status,
      language: src.language || '',
      category: src.category || '',
      state_or_scope: src.state_or_scope || '',
      check_interval_hours: src.check_interval_hours,
      fetch_enabled: src.fetch_enabled,
      notes: src.notes || '',
    });
    setShowAddEdit(true);
  };

  const handleSave = async () => {
    if (!formData.source_name || !formData.feed_url) {
      toast({ title: 'Validation', description: 'Name and Feed URL are required', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const payload = {
      source_name: formData.source_name,
      official_site: formData.official_site || null,
      feed_url: formData.feed_url,
      source_type: formData.source_type,
      focus: formData.focus || null,
      priority: formData.priority,
      status: formData.status,
      language: formData.language || null,
      category: formData.category || null,
      state_or_scope: formData.state_or_scope || null,
      check_interval_hours: formData.check_interval_hours,
      fetch_enabled: formData.fetch_enabled,
      notes: formData.notes || null,
    };

    if (editingSource?.id) {
      const { error } = await supabase.from('rss_sources' as any).update(payload).eq('id', editingSource.id);
      if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' });
      else toast({ title: 'Updated', description: `${formData.source_name} updated` });
    } else {
      const { error } = await supabase.from('rss_sources' as any).insert(payload);
      if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' });
      else toast({ title: 'Added', description: `${formData.source_name} added` });
    }
    setSaving(false);
    setShowAddEdit(false);
    fetchSources();
  };

  const toggleEnabled = async (src: RssSource) => {
    await supabase.from('rss_sources' as any).update({ fetch_enabled: !src.fetch_enabled }).eq('id', src.id);
    fetchSources();
  };

  const handleTest = async (src: RssSource) => {
    setTesting(src.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await supabase.functions.invoke('rss-ingest', {
        body: { action: 'test-source', rss_source_id: src.id },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      setTestResult(res.data);
      setShowTestResult(true);
    } catch (e: any) {
      toast({ title: 'Test Failed', description: e.message, variant: 'destructive' });
    }
    setTesting(null);
  };

  const handleRun = async (src: RssSource) => {
    setRunning(src.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await supabase.functions.invoke('rss-ingest', {
        body: { action: 'run-source', rss_source_id: src.id },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      const d = res.data;
      toast({ title: 'Run Complete', description: `Seen: ${d?.itemsSeen || 0}, New: ${d?.itemsNew || 0}, Updated: ${d?.itemsUpdated || 0}` });
    } catch (e: any) {
      toast({ title: 'Run Failed', description: e.message, variant: 'destructive' });
    }
    setRunning(null);
    fetchSources();
  };

  const handleRunDue = async () => {
    setRunningDue(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await supabase.functions.invoke('rss-ingest', {
        body: { action: 'run-due-sources' },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      const d = res.data;
      toast({ title: 'Batch Complete', description: `Processed: ${d?.processed || 0}, Success: ${d?.successCount || 0}, Errors: ${d?.errorCount || 0}` });
    } catch (e: any) {
      toast({ title: 'Batch Failed', description: e.message, variant: 'destructive' });
    }
    setRunningDue(false);
    fetchSources();
  };

  const handleCsvFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setImportText(ev.target?.result as string || '');
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (!importText.trim()) return;
    setImporting(true);
    try {
      const lines = importText.trim().split('\n');
      const header = lines[0].split(/[,\t|]/).map((h) => h.trim().toLowerCase());
      const sources = lines.slice(1).filter((l) => l.trim()).map((line) => {
        const values = line.split(/[,\t|]/).map((v) => v.trim());
        const obj: Record<string, string> = {};
        header.forEach((h, i) => { obj[h] = values[i] || ''; });
        return obj;
      });

      const { data: { session } } = await supabase.auth.getSession();
      const res = await supabase.functions.invoke('rss-ingest', {
        body: { action: 'import-sources', sources },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      const d = res.data;
      toast({ title: 'Import Done', description: `Imported: ${d?.imported || 0}, Skipped: ${d?.skipped || 0}, Invalid: ${d?.invalid || 0}` });
      setShowImport(false);
      setImportText('');
      fetchSources();
    } catch (e: any) {
      toast({ title: 'Import Failed', description: e.message, variant: 'destructive' });
    }
    setImporting(false);
  };

  const priorityBadge = (p: string) => {
    const v = p === 'High' ? 'destructive' : p === 'Medium' ? 'default' : 'secondary';
    return <Badge variant={v}>{p}</Badge>;
  };

  const statusBadge = (s: string) => {
    const colors: Record<string, string> = {
      'Live now': 'bg-emerald-100 text-emerald-800',
      'Testing': 'bg-blue-100 text-blue-800',
      'Broken': 'bg-red-100 text-red-800',
      'Paused': 'bg-yellow-100 text-yellow-800',
      'Needs verification': 'bg-orange-100 text-orange-800',
      'Not useful for jobs': 'bg-gray-100 text-gray-600',
    };
    return <Badge className={colors[s] || ''}>{s}</Badge>;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <CardTitle className="flex items-center gap-2"><Rss className="h-5 w-5" /> RSS Sources</CardTitle>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={openAdd}><Plus className="h-4 w-4 mr-1" /> Add Source</Button>
            <Button size="sm" variant="outline" onClick={() => setShowBulkUrls(true)}><ListPlus className="h-4 w-4 mr-1" /> Bulk Add URLs</Button>
            <Button size="sm" variant="outline" onClick={() => setShowImport(true)}><Upload className="h-4 w-4 mr-1" /> Import CSV</Button>
            <Button size="sm" variant="outline" onClick={handleRunDue} disabled={runningDue}>
              <Zap className="h-4 w-4 mr-1" /> {runningDue ? 'Running...' : 'Run Due Sources'}
            </Button>
            <Button size="sm" variant="ghost" onClick={fetchSources}><RefreshCw className="h-4 w-4" /></Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search sources..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={filterPriority} onValueChange={setFilterPriority}>
            <SelectTrigger className="w-[130px]"><SelectValue placeholder="Priority" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Priority</SelectItem>
              {RSS_PRIORITIES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              {RSS_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterEnabled} onValueChange={setFilterEnabled}>
            <SelectTrigger className="w-[130px]"><SelectValue placeholder="Enabled" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="true">Enabled</SelectItem>
              <SelectItem value="false">Disabled</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <p className="text-center py-8 text-muted-foreground">Loading sources...</p>
        ) : filteredSources.length === 0 ? (
          <p className="text-center py-8 text-muted-foreground">No sources found. Add your first RSS source.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Interval</TableHead>
                  <TableHead>Enabled</TableHead>
                  <TableHead>Last Success</TableHead>
                  <TableHead>Last Error</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSources.map((src) => (
                  <TableRow key={src.id}>
                    <TableCell>
                      <div className="space-y-1">
                        <p className="font-medium text-sm">{src.source_name}</p>
                        <div className="flex gap-2">
                          {src.official_site && (
                            <a href={src.official_site} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1">
                              Site <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                          <a href={src.feed_url} target="_blank" rel="noopener noreferrer" className="text-xs text-muted-foreground hover:underline flex items-center gap-1 max-w-[200px] truncate">
                            Feed <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{priorityBadge(src.priority)}</TableCell>
                    <TableCell>{statusBadge(src.status)}</TableCell>
                    <TableCell className="text-sm">{src.check_interval_hours}h</TableCell>
                    <TableCell>
                      <Switch checked={src.fetch_enabled} onCheckedChange={() => toggleEnabled(src)} />
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {src.last_success_at ? new Date(src.last_success_at).toLocaleString() : '—'}
                    </TableCell>
                    <TableCell>
                      {src.last_error ? (
                        <span className="text-xs text-destructive max-w-[150px] truncate block" title={src.last_error}>{src.last_error}</span>
                      ) : <span className="text-xs text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" onClick={() => openEdit(src)} title="Edit"><Pencil className="h-3.5 w-3.5" /></Button>
                        <Button size="sm" variant="ghost" onClick={() => handleTest(src)} disabled={testing === src.id} title="Test Feed">
                          <TestTube className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => handleRun(src)} disabled={running === src.id} title="Run Now">
                          <Play className="h-3.5 w-3.5" />
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

      {/* Add/Edit Dialog */}
      <Dialog open={showAddEdit} onOpenChange={setShowAddEdit}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingSource ? 'Edit Source' : 'Add RSS Source'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div><Label>Source Name *</Label><Input value={formData.source_name} onChange={(e) => setFormData({ ...formData, source_name: e.target.value })} /></div>
            <div><Label>Feed URL *</Label><Input value={formData.feed_url} onChange={(e) => setFormData({ ...formData, feed_url: e.target.value })} placeholder="https://..." /></div>
            <div><Label>Official Site</Label><Input value={formData.official_site} onChange={(e) => setFormData({ ...formData, official_site: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Priority</Label>
                <Select value={formData.priority} onValueChange={(v) => setFormData({ ...formData, priority: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{RSS_PRIORITIES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{RSS_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div><Label>Language</Label><Input value={formData.language} onChange={(e) => setFormData({ ...formData, language: e.target.value })} placeholder="en/hi" /></div>
              <div><Label>Category</Label><Input value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })} /></div>
              <div><Label>Interval (hrs)</Label><Input type="number" value={formData.check_interval_hours} onChange={(e) => setFormData({ ...formData, check_interval_hours: parseInt(e.target.value) || 6 })} /></div>
            </div>
            <div><Label>Focus</Label><Input value={formData.focus} onChange={(e) => setFormData({ ...formData, focus: e.target.value })} placeholder="e.g. SSC, Railway, Banking" /></div>
            <div><Label>State/Scope</Label><Input value={formData.state_or_scope} onChange={(e) => setFormData({ ...formData, state_or_scope: e.target.value })} placeholder="e.g. Bihar, Central" /></div>
            <div><Label>Notes</Label><Textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} rows={2} /></div>
            <div className="flex items-center gap-2">
              <Switch checked={formData.fetch_enabled} onCheckedChange={(v) => setFormData({ ...formData, fetch_enabled: v })} />
              <Label>Fetch Enabled</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddEdit(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Test Result Dialog */}
      <Dialog open={showTestResult} onOpenChange={setShowTestResult}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Feed Test Result</DialogTitle></DialogHeader>
          {testResult && (
            <div className="space-y-4">
              {testResult.error ? (
                <p className="text-destructive">{testResult.error}</p>
              ) : (
                <>
                  <div className="text-sm space-y-1">
                    <p><strong>Feed:</strong> {testResult.feedMeta?.title}</p>
                    <p><strong>Type:</strong> {testResult.feedMeta?.feedType} | <strong>Items:</strong> {testResult.totalItems}</p>
                    <p><strong>HTTP:</strong> {testResult.httpStatus} | <strong>Content-Type:</strong> {testResult.contentType}</p>
                  </div>
                  {testResult.parseErrors?.length > 0 && (
                    <div className="text-xs text-destructive">{testResult.parseErrors.join(', ')}</div>
                  )}
                  <div className="space-y-2">
                    {testResult.previewItems?.map((item: any, i: number) => (
                      <div key={i} className="border rounded p-3 text-sm space-y-1">
                        <p className="font-medium">{item.title}</p>
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="outline">{item.itemType}</Badge>
                          <Badge variant={item.relevanceLevel === 'High' ? 'destructive' : item.relevanceLevel === 'Medium' ? 'default' : 'secondary'}>{item.relevanceLevel}</Badge>
                          {item.firstPdfUrl && <Badge variant="outline">PDF</Badge>}
                        </div>
                        <p className="text-xs text-muted-foreground">{item.detectionReason}</p>
                        {item.summaryPreview && <p className="text-xs text-muted-foreground line-clamp-2">{item.summaryPreview}</p>}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Import Dialog */}
      <Dialog open={showImport} onOpenChange={setShowImport}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Import RSS Sources from CSV</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">CSV columns: source_name, official_site, feed_url, source_type, focus, priority, status, notes</p>
            <div>
              <input ref={fileInputRef} type="file" accept=".csv,.tsv,.txt" onChange={handleCsvFile} className="text-sm" />
            </div>
            <Textarea value={importText} onChange={(e) => setImportText(e.target.value)} rows={8} placeholder="Or paste CSV content here..." />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowImport(false)}>Cancel</Button>
            <Button onClick={handleImport} disabled={importing || !importText.trim()}>{importing ? 'Importing...' : 'Import'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Add URLs Dialog */}
      <Dialog open={showBulkUrls} onOpenChange={setShowBulkUrls}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Bulk Add RSS Source URLs</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Paste up to 100 feed URLs, one per line. Source names will be auto-generated from the domain.
            </p>
            <Textarea
              value={bulkUrlText}
              onChange={(e) => setBulkUrlText(e.target.value)}
              rows={12}
              placeholder={"https://example.gov.in/rss/jobs.xml\nhttps://another-site.org/feed\nhttps://..."}
            />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Default Priority</Label>
                <Select value={bulkPriority} onValueChange={setBulkPriority}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {RSS_PRIORITIES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Default Status</Label>
                <Select value={bulkStatus} onValueChange={setBulkStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {RSS_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {bulkUrlText.trim() && (
              <p className="text-xs text-muted-foreground">
                {(() => {
                  const count = bulkUrlText.trim().split('\n').filter(l => l.trim()).length;
                  return count > 100
                    ? <span className="text-destructive font-medium">⚠ {count} URLs detected — max 100 allowed</span>
                    : `${count} URL${count !== 1 ? 's' : ''} detected`;
                })()}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBulkUrls(false)}>Cancel</Button>
            <Button
              onClick={async () => {
                const lines = bulkUrlText.trim().split('\n').map(l => l.trim()).filter(Boolean);
                if (lines.length === 0) {
                  toast({ title: 'No URLs', description: 'Paste at least one URL', variant: 'destructive' });
                  return;
                }
                if (lines.length > 100) {
                  toast({ title: 'Too many URLs', description: 'Maximum 100 URLs allowed per batch', variant: 'destructive' });
                  return;
                }
                // Validate URLs
                const invalid: string[] = [];
                const valid: string[] = [];
                for (const line of lines) {
                  try {
                    const u = new URL(line);
                    if (!['http:', 'https:'].includes(u.protocol)) throw new Error();
                    valid.push(line);
                  } catch {
                    invalid.push(line);
                  }
                }
                if (invalid.length > 0) {
                  toast({ title: 'Invalid URLs found', description: `${invalid.length} invalid URL(s): ${invalid.slice(0, 3).join(', ')}${invalid.length > 3 ? '...' : ''}`, variant: 'destructive' });
                  return;
                }
                setBulkAdding(true);
                try {
                  const payloads = valid.map(url => {
                    const hostname = new URL(url).hostname.replace(/^www\./, '');
                    const nameParts = hostname.split('.').slice(0, -1);
                    const sourceName = nameParts.join(' ').replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) || hostname;
                    return {
                      source_name: sourceName,
                      feed_url: url,
                      official_site: `https://${hostname}`,
                      source_type: 'rss',
                      priority: bulkPriority,
                      status: bulkStatus,
                      fetch_enabled: true,
                      check_interval_hours: 6,
                    };
                  });
                  const { error, data } = await supabase.from('rss_sources' as any).upsert(payloads, { onConflict: 'feed_url', ignoreDuplicates: true }).select('id');
                  const addedCount = (data as any[])?.length ?? 0;
                  const skippedCount = valid.length - addedCount;
                  if (error) {
                    toast({ title: 'Error', description: error.message, variant: 'destructive' });
                  } else {
                    const desc = skippedCount > 0
                      ? `${addedCount} source(s) added, ${skippedCount} duplicate(s) skipped`
                      : `${addedCount} source(s) added successfully`;
                    toast({ title: 'Bulk Add Complete', description: desc });
                    setShowBulkUrls(false);
                    setBulkUrlText('');
                    fetchSources();
                  }
                } catch (e: any) {
                  toast({ title: 'Error', description: e.message, variant: 'destructive' });
                }
                setBulkAdding(false);
              }}
              disabled={bulkAdding || !bulkUrlText.trim()}
            >
              {bulkAdding ? 'Adding...' : 'Add All'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
