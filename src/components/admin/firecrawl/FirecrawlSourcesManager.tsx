/**
 * Admin control surface for Firecrawl sources (Source 3 Phase 5).
 * Enable/disable, view stats, re-run discovery, inspect errors.
 */
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from '@/hooks/use-toast';
import {
  RefreshCw, Loader2, Play, AlertTriangle, CheckCircle,
  Globe, Settings, BarChart3, ChevronDown, ChevronUp,
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
  bucketCounts: Record<string, number>;
  statusCounts: Record<string, number>;
  recentRuns: any[];
}

export function FirecrawlSourcesManager() {
  const [sources, setSources] = useState<FirecrawlSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [busySources, setBusySources] = useState<Record<string, string>>({});
  const [expandedSource, setExpandedSource] = useState<string | null>(null);
  const [sourceStats, setSourceStats] = useState<Record<string, SourceStats>>({});
  const [editingSeed, setEditingSeed] = useState<Record<string, string>>({});

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

  const runExtractBatch = async (sourceId: string) => {
    setBusySources(prev => ({ ...prev, [sourceId]: 'extracting' }));
    try {
      const { data, error } = await supabase.functions.invoke('firecrawl-ingest', {
        body: { action: 'extract-batch', source_id: sourceId, max_items: 10 },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      toast({
        title: 'Extraction complete',
        description: `Extracted: ${data.extracted || 0}, Failed: ${data.failed || 0}`,
      });
    } catch (e: any) {
      toast({ title: 'Extraction failed', description: e.message, variant: 'destructive' });
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
      if (!sourceStats[sourceId]) fetchStats(sourceId);
    }
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

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Globe className="h-5 w-5" />
          Firecrawl Sources
        </CardTitle>
        <Button variant="outline" size="sm" onClick={fetchSources} disabled={loading}>
          <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : sources.length === 0 ? (
          <p className="text-center py-6 text-muted-foreground text-sm">No Firecrawl sources configured.</p>
        ) : (
          <div className="space-y-2">
            {sources.map(source => (
              <div key={source.id} className="border rounded-lg">
                {/* Source row */}
                <div className="flex items-center gap-3 p-3">
                  <Switch
                    checked={source.is_enabled}
                    onCheckedChange={(checked) => toggleEnabled(source.id, checked)}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm truncate">{source.source_name}</p>
                      <Badge className={`text-[10px] ${priorityColor(source.priority)}`}>
                        {source.priority}
                      </Badge>
                      {source.last_error && (
                        <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0" />
                      )}
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
                    <Button
                      size="sm" variant="outline"
                      disabled={!!busySources[source.id]}
                      onClick={() => runDiscovery(source.id)}
                      title="Run Discovery"
                    >
                      {busySources[source.id] === 'discovering' ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Play className="h-3 w-3" />
                      )}
                    </Button>
                    <Button
                      size="sm" variant="outline"
                      disabled={!!busySources[source.id]}
                      onClick={() => runExtractBatch(source.id)}
                      title="Extract Batch"
                    >
                      {busySources[source.id] === 'extracting' ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Settings className="h-3 w-3" />
                      )}
                    </Button>
                    <Button
                      size="sm" variant="ghost"
                      onClick={() => toggleExpand(source.id)}
                    >
                      {expandedSource === source.id ? (
                        <ChevronUp className="h-3 w-3" />
                      ) : (
                        <ChevronDown className="h-3 w-3" />
                      )}
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
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => saveSeedUrl(source.id)}>
                          Save
                        </Button>
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
                      <span className="text-xs text-muted-foreground">
                        Max pages/run: {source.max_pages_per_run}
                      </span>
                    </div>

                    {/* Error display */}
                    {source.last_error && (
                      <div className="bg-destructive/10 text-destructive text-xs p-2 rounded">
                        <strong>Last error:</strong> {source.last_error}
                      </div>
                    )}

                    {/* Stats */}
                    {sourceStats[source.id] ? (
                      <div className="space-y-2">
                        <div className="flex items-center gap-1 text-xs font-medium">
                          <BarChart3 className="h-3 w-3" /> Discovery Stats
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                          <div className="bg-background p-2 rounded border text-center">
                            <p className="font-bold">{sourceStats[source.id].totalStaged}</p>
                            <p className="text-muted-foreground">Total Staged</p>
                          </div>
                          {Object.entries(sourceStats[source.id].bucketCounts || {}).map(([bucket, count]) => (
                            <div key={bucket} className="bg-background p-2 rounded border text-center">
                              <p className="font-bold">{count as number}</p>
                              <p className="text-muted-foreground truncate">{bucket}</p>
                            </div>
                          ))}
                        </div>

                        {/* Recent runs */}
                        {sourceStats[source.id].recentRuns.length > 0 && (
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
                                {sourceStats[source.id].recentRuns.map((run: any) => (
                                  <TableRow key={run.id}>
                                    <TableCell className="text-xs py-1">{timeAgo(run.started_at)}</TableCell>
                                    <TableCell className="text-xs py-1">
                                      <Badge variant={run.status === 'success' ? 'default' : 'destructive'} className="text-[9px]">
                                        {run.status}
                                      </Badge>
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
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
