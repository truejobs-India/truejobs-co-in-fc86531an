import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAdminToast } from '@/contexts/AdminMessagesContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import {
  FileText, ExternalLink, Search, RefreshCw, ClipboardList, EyeOff,
  ChevronDown, ChevronUp, FileDown, Sparkles, Brain, Image, ShieldCheck, MoreHorizontal,
  CheckCircle2, XCircle, Loader2, Clock, Trash2,
} from 'lucide-react';
import type { RssItem, RssSource } from './rssTypes';
import { ITEM_TYPES, RELEVANCE_LEVELS, ITEM_STATUSES, PRIMARY_DOMAINS, DOMAIN_LABELS } from './rssTypes';
import { RssAiActionModal } from './RssAiActionModal';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

const domainBadgeColors: Record<string, string> = {
  jobs: 'bg-emerald-100 text-emerald-800',
  education_services: 'bg-blue-100 text-blue-800',
  exam_updates: 'bg-purple-100 text-purple-800',
  public_services: 'bg-cyan-100 text-cyan-800',
  policy_updates: 'bg-pink-100 text-pink-800',
  general_alerts: 'bg-gray-100 text-gray-600',
};

const typeBadgeColors: Record<string, string> = {
  recruitment: 'bg-emerald-100 text-emerald-800',
  vacancy: 'bg-green-100 text-green-800',
  exam: 'bg-blue-100 text-blue-800',
  admit_card: 'bg-purple-100 text-purple-800',
  result: 'bg-orange-100 text-orange-800',
  answer_key: 'bg-yellow-100 text-yellow-800',
  syllabus: 'bg-cyan-100 text-cyan-800',
  scholarship: 'bg-indigo-100 text-indigo-800',
  certificate: 'bg-teal-100 text-teal-800',
  marksheet: 'bg-lime-100 text-lime-800',
  school_service: 'bg-sky-100 text-sky-800',
  university_service: 'bg-violet-100 text-violet-800',
  document_service: 'bg-amber-100 text-amber-800',
  policy: 'bg-pink-100 text-pink-800',
  circular: 'bg-rose-100 text-rose-800',
  notification: 'bg-fuchsia-100 text-fuchsia-800',
  signal: 'bg-gray-100 text-gray-600',
  unknown: 'bg-gray-100 text-gray-500',
};

type AiAction = 'analyse' | 'enrich' | 'generate-image' | 'seo-check';

const AI_STATUS_ICON: Record<string, React.ReactNode> = {
  pending: <Clock className="h-3 w-3 text-muted-foreground" />,
  running: <Loader2 className="h-3 w-3 animate-spin text-primary" />,
  completed: <CheckCircle2 className="h-3 w-3 text-green-600" />,
  failed: <XCircle className="h-3 w-3 text-destructive" />,
  skipped: <Clock className="h-3 w-3 text-muted-foreground" />,
};

interface AiProcessing {
  rss_item_id: string;
  analysis_status: string;
  enrichment_status: string;
  image_status: string;
  seo_check_status: string;
  cover_image_url: string | null;
  seo_score: number | null;
  analysis_output: any;
  enrichment_output: any;
  seo_output: any;
}

export function RssFetchedItemsTab() {
  const { toast } = useAdminToast();
  const [items, setItems] = useState<RssItem[]>([]);
  const [sources, setSources] = useState<RssSource[]>([]);
  const [aiProcessing, setAiProcessing] = useState<Record<string, AiProcessing>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterSource, setFilterSource] = useState('all');
  const [filterDomain, setFilterDomain] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [filterRelevance, setFilterRelevance] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // AI Action Modal
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [aiAction, setAiAction] = useState<AiAction>('analyse');
  const [aiModalItemIds, setAiModalItemIds] = useState<string[]>([]);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    let query = supabase.from('rss_items' as any).select('*').order('first_seen_at', { ascending: false }).limit(200);
    if (filterSource !== 'all') query = query.eq('rss_source_id', filterSource);
    if (filterDomain !== 'all') query = query.eq('primary_domain', filterDomain);
    if (filterType !== 'all') query = query.eq('item_type', filterType);
    if (filterRelevance !== 'all') query = query.eq('relevance_level', filterRelevance);
    if (filterStatus !== 'all') query = query.eq('current_status', filterStatus);

    const { data, error } = await query;
    if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' });
    else setItems((data as any as RssItem[]) || []);
    setLoading(false);
  }, [filterSource, filterDomain, filterType, filterRelevance, filterStatus]);

  const fetchAiStatus = useCallback(async () => {
    if (items.length === 0) return;
    const ids = items.map(i => i.id);
    const { data } = await supabase.from('rss_ai_processing' as any).select('rss_item_id, analysis_status, enrichment_status, image_status, seo_check_status, cover_image_url, seo_score, analysis_output, enrichment_output, seo_output').in('rss_item_id', ids);
    if (data) {
      const map: Record<string, AiProcessing> = {};
      for (const row of data as any as AiProcessing[]) {
        map[row.rss_item_id] = row;
      }
      setAiProcessing(map);
    }
  }, [items]);

  useEffect(() => {
    fetchItems();
    supabase.from('rss_sources' as any).select('id, source_name').order('source_name').then(({ data }) => {
      setSources((data as any as RssSource[]) || []);
    });
  }, [fetchItems]);

  useEffect(() => {
    fetchAiStatus();
  }, [fetchAiStatus]);

  const filtered = items.filter((item) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return item.item_title.toLowerCase().includes(q) || (item.item_summary || '').toLowerCase().includes(q);
  });

  const sourceNameMap = Object.fromEntries(sources.map((s) => [s.id, s.source_name]));

  // Selection handlers
  const allFilteredSelected = filtered.length > 0 && filtered.every(i => selectedIds.has(i.id));
  const someSelected = selectedIds.size > 0;

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (allFilteredSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map(i => i.id)));
    }
  };

  // AI action openers
  const openAiAction = (action: AiAction, ids: string[]) => {
    setAiAction(action);
    setAiModalItemIds(ids);
    setAiModalOpen(true);
  };

  const handleAiComplete = () => {
    fetchAiStatus();
    toast({ title: 'AI Processing Complete', description: `${aiAction} finished for selected items.` });
  };

  const handleQueue = async (item: RssItem) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      await supabase.functions.invoke('rss-ingest', {
        body: { action: 'requeue-item', rss_item_id: item.id },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      toast({ title: 'Queued', description: `"${item.item_title.substring(0, 50)}" sent to review queue` });
      fetchItems();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  };

  const handleIgnore = async (item: RssItem) => {
    await supabase.from('rss_items' as any).update({ current_status: 'ignored' }).eq('id', item.id);
    toast({ title: 'Ignored', description: 'Item marked as ignored' });
    fetchItems();
  };

  const displayDate = (item: RssItem) => {
    const d = item.published_at || item.first_seen_at;
    return d ? new Date(d).toLocaleDateString() : '—';
  };

  const getAiStatusIcon = (itemId: string, stage: 'analysis_status' | 'enrichment_status' | 'image_status' | 'seo_check_status') => {
    const proc = aiProcessing[itemId];
    if (!proc) return AI_STATUS_ICON['pending'];
    return AI_STATUS_ICON[proc[stage]] || AI_STATUS_ICON['pending'];
  };

  const selectedArray = Array.from(selectedIds);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5" /> Fetched Items</CardTitle>
          <Button size="sm" variant="ghost" onClick={() => { fetchItems(); setSelectedIds(new Set()); }}><RefreshCw className="h-4 w-4" /></Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search items..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={filterSource} onValueChange={setFilterSource}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="Source" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sources</SelectItem>
              {sources.map((s) => <SelectItem key={s.id} value={s.id}>{s.source_name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterDomain} onValueChange={setFilterDomain}>
            <SelectTrigger className="w-[170px]"><SelectValue placeholder="Domain" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Domains</SelectItem>
              {PRIMARY_DOMAINS.map((d) => <SelectItem key={d} value={d}>{DOMAIN_LABELS[d]}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-[150px]"><SelectValue placeholder="Type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {ITEM_TYPES.map((t) => <SelectItem key={t} value={t}>{t.replace(/_/g, ' ')}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterRelevance} onValueChange={setFilterRelevance}>
            <SelectTrigger className="w-[130px]"><SelectValue placeholder="Relevance" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              {RELEVANCE_LEVELS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[130px]"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              {ITEM_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* Bulk Action Toolbar */}
        {someSelected && (
          <div className="flex items-center gap-2 mb-3 p-2 rounded-md bg-muted/50 border">
            <Badge variant="secondary">{selectedIds.size} selected</Badge>
            <Button size="sm" variant="outline" onClick={() => openAiAction('analyse', selectedArray)}>
              <Brain className="h-3.5 w-3.5 mr-1" /> Analyse
            </Button>
            <Button size="sm" variant="outline" onClick={() => openAiAction('enrich', selectedArray)}>
              <Sparkles className="h-3.5 w-3.5 mr-1" /> Enrich
            </Button>
            <Button size="sm" variant="outline" onClick={() => openAiAction('generate-image', selectedArray)}>
              <Image className="h-3.5 w-3.5 mr-1" /> Image
            </Button>
            <Button size="sm" variant="outline" onClick={() => openAiAction('seo-check', selectedArray)}>
              <ShieldCheck className="h-3.5 w-3.5 mr-1" /> SEO
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>Clear</Button>
          </div>
        )}

        {loading ? (
          <p className="text-center py-8 text-muted-foreground">Loading items...</p>
        ) : filtered.length === 0 ? (
          <p className="text-center py-8 text-muted-foreground">No items found.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8">
                    <Checkbox checked={allFilteredSelected} onCheckedChange={toggleSelectAll} />
                  </TableHead>
                  <TableHead className="w-8"></TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Domain</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-center" title="AI Pipeline Status">AI</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((item) => (
                  <>
                    <TableRow key={item.id} className="cursor-pointer">
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox checked={selectedIds.has(item.id)} onCheckedChange={() => toggleSelect(item.id)} />
                      </TableCell>
                      <TableCell onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}>
                        {expandedId === item.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[100px] truncate" onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}>{sourceNameMap[item.rss_source_id] || '—'}</TableCell>
                      <TableCell className="max-w-[220px]" onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}><p className="text-sm font-medium truncate">{item.item_title}</p></TableCell>
                      <TableCell><Badge className={domainBadgeColors[item.primary_domain] || 'bg-gray-100 text-gray-500'}>{DOMAIN_LABELS[item.primary_domain] || item.primary_domain}</Badge></TableCell>
                      <TableCell><Badge className={typeBadgeColors[item.item_type] || 'bg-gray-100 text-gray-500'}>{item.item_type.replace(/_/g, ' ')}</Badge></TableCell>
                      <TableCell className="text-xs">{displayDate(item)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1" title="A · E · I · S">
                          {getAiStatusIcon(item.id, 'analysis_status')}
                          {getAiStatusIcon(item.id, 'enrichment_status')}
                          {getAiStatusIcon(item.id, 'image_status')}
                          {getAiStatusIcon(item.id, 'seo_check_status')}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="sm" variant="ghost"><Sparkles className="h-3.5 w-3.5" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openAiAction('analyse', [item.id])}>
                                <Brain className="h-4 w-4 mr-2" /> Analyse
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => openAiAction('enrich', [item.id])}>
                                <Sparkles className="h-4 w-4 mr-2" /> Enrich
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => openAiAction('generate-image', [item.id])}>
                                <Image className="h-4 w-4 mr-2" /> Generate Image
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => openAiAction('seo-check', [item.id])}>
                                <ShieldCheck className="h-4 w-4 mr-2" /> SEO Check
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                          <Button size="sm" variant="ghost" onClick={() => handleQueue(item)} title="Queue for Review" disabled={item.current_status === 'queued'}>
                            <ClipboardList className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => handleIgnore(item)} title="Ignore" disabled={item.current_status === 'ignored'}>
                            <EyeOff className="h-3.5 w-3.5" />
                          </Button>
                          {item.item_link && (
                            <a href={item.item_link} target="_blank" rel="noopener noreferrer">
                              <Button size="sm" variant="ghost"><ExternalLink className="h-3.5 w-3.5" /></Button>
                            </a>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                    {expandedId === item.id && (
                      <TableRow key={`${item.id}-detail`}>
                        <TableCell colSpan={9}>
                          <div className="p-3 bg-muted/30 rounded space-y-3 text-sm">
                            {/* Source data */}
                            <p><strong>Full Title:</strong> {item.item_title}</p>
                            <div className="flex flex-wrap gap-2">
                              <span><strong>Domain:</strong></span>
                              <Badge className={domainBadgeColors[item.primary_domain] || ''}>{DOMAIN_LABELS[item.primary_domain] || item.primary_domain}</Badge>
                              <span><strong>Group:</strong></span>
                              <span className="text-muted-foreground">{item.display_group}</span>
                              <span><strong>Type:</strong></span>
                              <Badge className={typeBadgeColors[item.item_type] || ''}>{item.item_type.replace(/_/g, ' ')}</Badge>
                              <span><strong>Relevance:</strong></span>
                              <Badge variant={item.relevance_level === 'High' ? 'destructive' : item.relevance_level === 'Medium' ? 'default' : 'secondary'}>{item.relevance_level}</Badge>
                            </div>
                            {item.item_summary && <p><strong>Summary:</strong> {item.item_summary.substring(0, 500)}</p>}
                            {item.item_link && <p><strong>Link:</strong> <a href={item.item_link} target="_blank" className="text-primary hover:underline">{item.item_link}</a></p>}
                            {item.categories.length > 0 && <p><strong>Categories:</strong> {item.categories.join(', ')}</p>}
                            {item.detection_reason && <p><strong>Detection:</strong> {item.detection_reason}</p>}
                            {item.linked_pdf_urls.length > 0 && (
                              <p><strong>PDFs:</strong> {item.linked_pdf_urls.map((u, i) => <a key={i} href={u} target="_blank" className="text-primary hover:underline mr-2">{u.split('/').pop()}</a>)}</p>
                            )}

                            {/* AI Processing Summary */}
                            {aiProcessing[item.id] && (
                              <div className="mt-2 p-2 bg-background rounded border space-y-2">
                                <p className="font-medium text-xs uppercase tracking-wider text-muted-foreground">AI Processing</p>
                                <div className="grid grid-cols-4 gap-2 text-xs">
                                  <div className="flex items-center gap-1">
                                    {getAiStatusIcon(item.id, 'analysis_status')}
                                    <span>Analysis: {aiProcessing[item.id].analysis_status}</span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    {getAiStatusIcon(item.id, 'enrichment_status')}
                                    <span>Enrichment: {aiProcessing[item.id].enrichment_status}</span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    {getAiStatusIcon(item.id, 'image_status')}
                                    <span>Image: {aiProcessing[item.id].image_status}</span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    {getAiStatusIcon(item.id, 'seo_check_status')}
                                    <span>SEO: {aiProcessing[item.id].seo_check_status} {aiProcessing[item.id].seo_score != null ? `(${aiProcessing[item.id].seo_score}/100)` : ''}</span>
                                  </div>
                                </div>

                                {/* Analysis summary */}
                                {aiProcessing[item.id].analysis_output && (
                                  <div className="text-xs p-1.5 bg-muted/40 rounded">
                                    <strong>Analysis:</strong>{' '}
                                    {aiProcessing[item.id].analysis_output.publish_recommended ? '✅ Recommend publish' : '⚠️ Review needed'}
                                    {aiProcessing[item.id].analysis_output.analysis_notes && ` — ${aiProcessing[item.id].analysis_output.analysis_notes.substring(0, 200)}`}
                                  </div>
                                )}

                                {/* Enrichment summary */}
                                {aiProcessing[item.id].enrichment_output && (
                                  <div className="text-xs p-1.5 bg-muted/40 rounded">
                                    <strong>Enriched Title:</strong> {aiProcessing[item.id].enrichment_output.cleaned_title || '—'}
                                    {aiProcessing[item.id].enrichment_output.seo_title && <> | <strong>SEO:</strong> {aiProcessing[item.id].enrichment_output.seo_title}</>}
                                  </div>
                                )}

                                {/* Cover Image */}
                                {aiProcessing[item.id].cover_image_url && (
                                  <div>
                                    <img src={aiProcessing[item.id].cover_image_url!} alt="Cover" className="h-20 rounded object-cover" />
                                  </div>
                                )}

                                {/* SEO summary */}
                                {aiProcessing[item.id].seo_output && (
                                  <div className="text-xs p-1.5 bg-muted/40 rounded">
                                    <strong>SEO:</strong>{' '}
                                    {aiProcessing[item.id].seo_output.seo_passed ? '✅ Passed' : '❌ Issues found'}
                                    {aiProcessing[item.id].seo_output.seo_issues?.length > 0 && ` — ${aiProcessing[item.id].seo_output.seo_issues.slice(0, 3).join('; ')}`}
                                  </div>
                                )}
                              </div>
                            )}

                            <p className="text-xs text-muted-foreground">First seen: {new Date(item.first_seen_at).toLocaleString()} | Last seen: {new Date(item.last_seen_at).toLocaleString()}</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      {/* AI Action Modal */}
      <RssAiActionModal
        open={aiModalOpen}
        onOpenChange={setAiModalOpen}
        action={aiAction}
        itemIds={aiModalItemIds}
        onComplete={handleAiComplete}
      />
    </Card>
  );
}
