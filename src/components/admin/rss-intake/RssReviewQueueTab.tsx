import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAdminToast } from '@/contexts/AdminMessagesContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { ClipboardCheck, ExternalLink, Search, RefreshCw, Check, X, Copy, EyeOff, Pause, FileDown, CheckCircle2, XCircle, Clock, Loader2, Trash2 } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import type { ReviewQueueEntry, RssAiProcessing, AnalysisOutput, EnrichmentOutput, SeoCheckOutput } from './rssTypes';
import { REVIEW_STATUSES, PRIMARY_DOMAINS, DOMAIN_LABELS } from './rssTypes';

const domainBadgeColors: Record<string, string> = {
  jobs: 'bg-emerald-100 text-emerald-800',
  education_services: 'bg-blue-100 text-blue-800',
  exam_updates: 'bg-purple-100 text-purple-800',
  public_services: 'bg-cyan-100 text-cyan-800',
  policy_updates: 'bg-pink-100 text-pink-800',
  general_alerts: 'bg-gray-100 text-gray-600',
};

const AI_STATUS_ICON: Record<string, React.ReactNode> = {
  pending: <Clock className="h-3 w-3 text-muted-foreground" />,
  running: <Loader2 className="h-3 w-3 animate-spin text-primary" />,
  completed: <CheckCircle2 className="h-3 w-3 text-green-600" />,
  failed: <XCircle className="h-3 w-3 text-destructive" />,
  skipped: <Clock className="h-3 w-3 text-muted-foreground" />,
};

export function RssReviewQueueTab() {
  const { toast } = useAdminToast();
  const [entries, setEntries] = useState<ReviewQueueEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('pending');
  const [filterChannel, setFilterChannel] = useState('all');
  const [filterDomain, setFilterDomain] = useState('all');
  const [search, setSearch] = useState('');
  const [showDetail, setShowDetail] = useState(false);
  const [detailEntry, setDetailEntry] = useState<ReviewQueueEntry | null>(null);
  const [qaNotes, setQaNotes] = useState('');
  const [actioning, setActioning] = useState(false);
  const [aiData, setAiData] = useState<RssAiProcessing | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<ReviewQueueEntry | null>(null);
  const [deletingEntry, setDeletingEntry] = useState(false);

  const [selectedQueueIds, setSelectedQueueIds] = useState<Set<string>>(new Set());

  const toggleQueueSelect = (id: string) => {
    setSelectedQueueIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    let query = supabase.from('monitoring_review_queue' as any).select('*').order('created_at', { ascending: false }).limit(200);
    if (filterStatus !== 'all') query = query.eq('review_status', filterStatus);
    if (filterChannel !== 'all') query = query.eq('channel', filterChannel);
    if (filterDomain !== 'all') query = query.eq('primary_domain', filterDomain);

    const { data, error } = await query;
    if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' });
    else setEntries((data as any as ReviewQueueEntry[]) || []);
    setLoading(false);
  }, [filterStatus, filterChannel, filterDomain]);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  const filtered = entries.filter((e) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return e.title.toLowerCase().includes(q);
  });

  const fetchAiData = useCallback(async (sourceItemId: string | null) => {
    setAiData(null);
    if (!sourceItemId) return;
    setAiLoading(true);
    const { data } = await supabase.from('rss_ai_processing' as any)
      .select('*')
      .eq('rss_item_id', sourceItemId)
      .maybeSingle();
    setAiData(data as any as RssAiProcessing | null);
    setAiLoading(false);
  }, []);

  const handleAction = async (entry: ReviewQueueEntry, newStatus: string) => {
    setActioning(true);
    try {
      const { data, error } = await supabase.rpc('sync_rss_review_status' as any, {
        p_review_queue_id: entry.id,
        p_new_status: newStatus,
        p_qa_notes: qaNotes || null,
      });
      if (error) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
      } else {
        const result = data as any;
        if (result?.success) {
          toast({ title: 'Updated', description: `Status set to ${newStatus}` });
          setShowDetail(false);
          setQaNotes('');
          fetchEntries();
        } else {
          toast({ title: 'Error', description: result?.error || 'Unknown error', variant: 'destructive' });
        }
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
    setActioning(false);
  };

  const quickAction = async (entry: ReviewQueueEntry, newStatus: string) => {
    const { data, error } = await supabase.rpc('sync_rss_review_status' as any, {
      p_review_queue_id: entry.id,
      p_new_status: newStatus,
      p_qa_notes: null,
    });
    if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' });
    else toast({ title: 'Updated', description: `Status → ${newStatus}` });
    fetchEntries();
  };

  const handleDeleteEntry = async () => {
    if (!deleteTarget) return;
    setDeletingEntry(true);
    if ((deleteTarget as any).id === '__bulk__') {
      const ids = Array.from(selectedQueueIds);
      const { error } = await supabase.from('monitoring_review_queue' as any).delete().in('id', ids);
      if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' });
      else toast({ title: 'Deleted', description: `${ids.length} entry(ies) deleted` });
      setSelectedQueueIds(new Set());
    } else {
      const { error } = await supabase.from('monitoring_review_queue' as any).delete().eq('id', deleteTarget.id);
      if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' });
      else toast({ title: 'Deleted', description: 'Review queue entry deleted' });
    }
    setDeletingEntry(false);
    setDeleteTarget(null);
    fetchEntries();
  };
  const openDetail = (entry: ReviewQueueEntry) => {
    setDetailEntry(entry);
    setQaNotes(entry.qa_notes || '');
    setShowDetail(true);
    fetchAiData(entry.source_item_id);
  };

  const statusBadge = (s: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-800',
      approved: 'bg-emerald-100 text-emerald-800',
      rejected: 'bg-red-100 text-red-800',
      duplicate: 'bg-orange-100 text-orange-800',
      ignored: 'bg-gray-100 text-gray-500',
      on_hold: 'bg-blue-100 text-blue-800',
    };
    return <Badge className={colors[s] || ''}>{s.replace('_', ' ')}</Badge>;
  };

  const seoStatusColor = (s: string) => s === 'good' ? 'text-green-600' : s === 'warning' ? 'text-yellow-600' : 'text-red-600';

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2"><ClipboardCheck className="h-5 w-5" /> Review Queue</CardTitle>
          <Button size="sm" variant="ghost" onClick={fetchEntries}><RefreshCw className="h-4 w-4" /></Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-3 mb-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              {REVIEW_STATUSES.map((s) => <SelectItem key={s} value={s}>{s.replace('_', ' ')}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterChannel} onValueChange={setFilterChannel}>
            <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Channels</SelectItem>
              <SelectItem value="rss">RSS</SelectItem>
              <SelectItem value="distill">Distill</SelectItem>
              <SelectItem value="crawler">Crawler</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterDomain} onValueChange={setFilterDomain}>
            <SelectTrigger className="w-[170px]"><SelectValue placeholder="Domain" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Domains</SelectItem>
              {PRIMARY_DOMAINS.map((d) => <SelectItem key={d} value={d}>{DOMAIN_LABELS[d]}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* Bulk Action Toolbar */}
        {selectedQueueIds.size > 0 && (
          <div className="flex items-center gap-2 mb-3 p-2 rounded-md bg-muted/50 border">
            <Badge variant="secondary">{selectedQueueIds.size} selected</Badge>
            <Button size="sm" variant="outline" className="text-destructive border-destructive/50 hover:bg-destructive/10" onClick={() => {
              setDeleteTarget({ id: '__bulk__', title: `${selectedQueueIds.size} entries` } as any);
            }}>
              <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete Selected
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelectedQueueIds(new Set())}>Clear</Button>
          </div>
        )}

        {loading ? (
          <p className="text-center py-8 text-muted-foreground">Loading...</p>
        ) : filtered.length === 0 ? (
          <p className="text-center py-8 text-muted-foreground">No items in review queue.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8">
                    <Checkbox
                      checked={filtered.length > 0 && filtered.every(e => selectedQueueIds.has(e.id))}
                      onCheckedChange={() => {
                        if (filtered.every(e => selectedQueueIds.has(e.id))) {
                          setSelectedQueueIds(new Set());
                        } else {
                          setSelectedQueueIds(new Set(filtered.map(e => e.id)));
                        }
                      }}
                    />
                  </TableHead>
                  <TableHead>Channel</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Domain</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((entry) => (
                  <TableRow key={entry.id} className="cursor-pointer" onClick={() => openDetail(entry)}>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox checked={selectedQueueIds.has(entry.id)} onCheckedChange={() => toggleQueueSelect(entry.id)} />
                    </TableCell>
                    <TableCell><Badge variant="outline">{entry.channel}</Badge></TableCell>
                    <TableCell className="max-w-[220px]"><p className="text-sm font-medium truncate">{entry.title}</p></TableCell>
                    <TableCell>
                      {entry.primary_domain ? (
                        <Badge className={domainBadgeColors[entry.primary_domain] || 'bg-gray-100 text-gray-500'}>
                          {DOMAIN_LABELS[entry.primary_domain] || entry.primary_domain}
                        </Badge>
                      ) : '—'}
                    </TableCell>
                    <TableCell className="text-xs">{entry.item_type?.replace(/_/g, ' ') || '—'}</TableCell>
                    <TableCell className="text-xs">{entry.published_at ? new Date(entry.published_at).toLocaleDateString() : '—'}</TableCell>
                    <TableCell>{statusBadge(entry.review_status)}</TableCell>
                    <TableCell className="text-xs">{new Date(entry.created_at).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                        {entry.review_status === 'pending' && (
                          <>
                            <Button size="sm" variant="ghost" onClick={() => quickAction(entry, 'approved')} title="Approve"><Check className="h-3.5 w-3.5 text-emerald-600" /></Button>
                            <Button size="sm" variant="ghost" onClick={() => quickAction(entry, 'rejected')} title="Reject"><X className="h-3.5 w-3.5 text-red-600" /></Button>
                            <Button size="sm" variant="ghost" onClick={() => quickAction(entry, 'ignored')} title="Ignore"><EyeOff className="h-3.5 w-3.5" /></Button>
                          </>
                        )}
                        {entry.source_url && (
                          <a href={entry.source_url} target="_blank" rel="noopener noreferrer">
                            <Button size="sm" variant="ghost"><ExternalLink className="h-3.5 w-3.5" /></Button>
                          </a>
                        )}
                        {entry.pdf_url && (
                          <a href={entry.pdf_url} target="_blank" rel="noopener noreferrer">
                            <Button size="sm" variant="ghost"><FileDown className="h-3.5 w-3.5" /></Button>
                          </a>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => setDeleteTarget(entry)} title="Delete" className="text-destructive hover:text-destructive">
                          <Trash2 className="h-3.5 w-3.5" />
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

      {/* Detail Dialog */}
      <Dialog open={showDetail} onOpenChange={setShowDetail}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Review Item</DialogTitle></DialogHeader>
          {detailEntry && (
            <div className="space-y-4">
              {/* Source data */}
              <div className="space-y-2 text-sm">
                <p><strong>Title:</strong> {detailEntry.title}</p>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">{detailEntry.channel}</Badge>
                  {detailEntry.primary_domain && (
                    <Badge className={domainBadgeColors[detailEntry.primary_domain] || ''}>
                      {DOMAIN_LABELS[detailEntry.primary_domain] || detailEntry.primary_domain}
                    </Badge>
                  )}
                  {detailEntry.item_type && <Badge variant="outline">{detailEntry.item_type.replace(/_/g, ' ')}</Badge>}
                  {statusBadge(detailEntry.review_status)}
                </div>
                {detailEntry.display_group && <p><strong>Display Group:</strong> {detailEntry.display_group}</p>}
                {detailEntry.source_url && (
                  <p><strong>Link:</strong> <a href={detailEntry.source_url} target="_blank" className="text-primary hover:underline">{detailEntry.source_url}</a></p>
                )}
                {detailEntry.pdf_url && (
                  <p><strong>PDF:</strong> <a href={detailEntry.pdf_url} target="_blank" className="text-primary hover:underline">{detailEntry.pdf_url}</a></p>
                )}
                {detailEntry.published_at && <p><strong>Published:</strong> {new Date(detailEntry.published_at).toLocaleString()}</p>}
              </div>

              {/* ═══ AI Processing Panel ═══ */}
              {detailEntry.channel === 'rss' && detailEntry.source_item_id && (
                <div className="border rounded-lg p-3 space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">AI Processing</p>
                  {aiLoading ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading AI data...</div>
                  ) : !aiData ? (
                    <p className="text-xs text-muted-foreground">No AI processing data yet.</p>
                  ) : (
                    <>
                      {/* Status row */}
                      <div className="grid grid-cols-4 gap-2 text-xs">
                        <div className="flex items-center gap-1">{AI_STATUS_ICON[aiData.analysis_status] || AI_STATUS_ICON.pending}<span>Analysis: {aiData.analysis_status}</span></div>
                        <div className="flex items-center gap-1">{AI_STATUS_ICON[aiData.enrichment_status] || AI_STATUS_ICON.pending}<span>Enrichment: {aiData.enrichment_status}</span></div>
                        <div className="flex items-center gap-1">{AI_STATUS_ICON[aiData.image_status] || AI_STATUS_ICON.pending}<span>Image: {aiData.image_status}</span></div>
                        <div className="flex items-center gap-1">{AI_STATUS_ICON[aiData.seo_check_status] || AI_STATUS_ICON.pending}<span>SEO: {aiData.seo_check_status}{aiData.seo_score != null ? ` (${aiData.seo_score}/100)` : ''}</span></div>
                      </div>

                      {/* Analysis output */}
                      {aiData.analysis_output && (
                        <div className="space-y-1 p-2 bg-muted/30 rounded text-xs">
                          <p className="font-medium">📊 Analysis</p>
                          {(() => {
                            const a = aiData.analysis_output as AnalysisOutput;
                            return (
                              <>
                                <p>{a.publish_recommended ? '✅ Recommend publish' : '⚠️ Needs review'} — Confidence: <strong>{a.confidence_level}</strong></p>
                                {a.suggested_title && <p><strong>Suggested Title:</strong> {a.suggested_title}</p>}
                                {a.suggested_slug && <p><strong>Slug:</strong> {a.suggested_slug}</p>}
                                {a.key_entities?.length > 0 && <p><strong>Entities:</strong> {a.key_entities.join(', ')}</p>}
                                {a.important_dates?.length > 0 && (
                                  <p><strong>Dates:</strong> {a.important_dates.map(d => `${d.label}: ${d.date}`).join(' | ')}</p>
                                )}
                                {a.missing_information?.length > 0 && (
                                  <p className="text-yellow-700"><strong>Missing:</strong> {a.missing_information.join('; ')}</p>
                                )}
                                {a.ambiguity_flags?.length > 0 && (
                                  <p className="text-orange-700"><strong>Ambiguity:</strong> {a.ambiguity_flags.join('; ')}</p>
                                )}
                                {a.analysis_notes && <p><strong>Notes:</strong> {a.analysis_notes}</p>}
                                <p><strong>Next:</strong> {a.suggested_next_action}</p>
                              </>
                            );
                          })()}
                        </div>
                      )}

                      {/* Enrichment output */}
                      {aiData.enrichment_output && (
                        <div className="space-y-1 p-2 bg-muted/30 rounded text-xs">
                          <p className="font-medium">✨ Enrichment ({aiData.enrichment_word_limit || '—'} words target)</p>
                          {(() => {
                            const e = aiData.enrichment_output as EnrichmentOutput;
                            return (
                              <>
                                <p><strong>Title:</strong> {e.cleaned_title}</p>
                                <p><strong>SEO Title:</strong> {e.seo_title}</p>
                                <p><strong>Meta:</strong> {e.meta_description}</p>
                                <p><strong>Excerpt:</strong> {e.excerpt}</p>
                                {e.short_intro && <p><strong>Intro:</strong> {e.short_intro}</p>}
                                {e.summary_points?.length > 0 && (
                                  <ul className="list-disc pl-4">{e.summary_points.map((p, i) => <li key={i}>{p}</li>)}</ul>
                                )}
                                {e.tags?.length > 0 && <p><strong>Tags:</strong> {e.tags.join(', ')}</p>}
                                {e.faq_block?.length > 0 && <p><strong>FAQs:</strong> {e.faq_block.length} questions</p>}
                                {e.schema_suggestion && <p><strong>Schema:</strong> {e.schema_suggestion}</p>}
                              </>
                            );
                          })()}
                        </div>
                      )}

                      {/* Cover image */}
                      {aiData.cover_image_url && (
                        <div className="space-y-1 p-2 bg-muted/30 rounded text-xs">
                          <p className="font-medium">🖼️ Cover Image</p>
                          <img src={aiData.cover_image_url} alt="Cover" className="h-32 rounded object-cover" />
                          {aiData.image_model && <p className="text-muted-foreground">Model: {aiData.image_model}</p>}
                        </div>
                      )}

                      {/* SEO output */}
                      {aiData.seo_output && (
                        <div className="space-y-1 p-2 bg-muted/30 rounded text-xs">
                          <p className="font-medium">🔍 SEO Check — {(aiData.seo_output as SeoCheckOutput).seo_passed ? '✅ Passed' : '❌ Issues'} ({aiData.seo_score}/100)</p>
                          {(() => {
                            const s = aiData.seo_output as SeoCheckOutput;
                            return (
                              <>
                                <div className="grid grid-cols-2 gap-1">
                                  <span className={seoStatusColor(s.seo_title_status)}>Title: {s.seo_title_status}</span>
                                  <span className={seoStatusColor(s.meta_description_status)}>Meta: {s.meta_description_status}</span>
                                  <span className={seoStatusColor(s.slug_status)}>Slug: {s.slug_status}</span>
                                  <span className={seoStatusColor(s.heading_status)}>Headings: {s.heading_status}</span>
                                  <span>Image: {s.image_status}</span>
                                  <span>Schema: {s.schema_status}</span>
                                </div>
                                {s.seo_issues?.length > 0 && (
                                  <div className="mt-1">
                                    <strong>Issues:</strong>
                                    <ul className="list-disc pl-4 text-red-600">{s.seo_issues.map((i, idx) => <li key={idx}>{i}</li>)}</ul>
                                  </div>
                                )}
                                {s.seo_fixes?.length > 0 && (
                                  <div className="mt-1">
                                    <strong>Fixes:</strong>
                                    <ul className="list-disc pl-4 text-green-600">{s.seo_fixes.map((f, idx) => <li key={idx}>{f}</li>)}</ul>
                                  </div>
                                )}
                                <p>{s.adsense_safe ? '✅ AdSense-safe' : '⚠️ AdSense risk'} | Thin: {s.thin_content_risk ? '⚠️ Yes' : '✅ No'} | Duplication: {s.duplication_risk}</p>
                              </>
                            );
                          })()}
                        </div>
                      )}

                      {/* Error display */}
                      {aiData.analysis_error && <p className="text-xs text-destructive">Analysis error: {aiData.analysis_error}</p>}
                      {aiData.enrichment_error && <p className="text-xs text-destructive">Enrichment error: {aiData.enrichment_error}</p>}
                      {aiData.image_error && <p className="text-xs text-destructive">Image error: {aiData.image_error}</p>}
                      {aiData.seo_error && <p className="text-xs text-destructive">SEO error: {aiData.seo_error}</p>}
                    </>
                  )}
                </div>
              )}

              {detailEntry.parsed_payload && Object.keys(detailEntry.parsed_payload).length > 0 && (
                <div>
                  <p className="font-medium text-sm mb-1">Parsed Data:</p>
                  <pre className="text-xs bg-muted p-3 rounded overflow-auto max-h-40">{JSON.stringify(detailEntry.parsed_payload, null, 2)}</pre>
                </div>
              )}

              {detailEntry.raw_payload && Object.keys(detailEntry.raw_payload).length > 0 && (
                <div>
                  <p className="font-medium text-sm mb-1">Raw Payload:</p>
                  <pre className="text-xs bg-muted p-3 rounded overflow-auto max-h-40">{JSON.stringify(detailEntry.raw_payload, null, 2)}</pre>
                </div>
              )}

              <div>
                <p className="font-medium text-sm mb-1">QA Notes:</p>
                <Textarea value={qaNotes} onChange={(e) => setQaNotes(e.target.value)} rows={3} placeholder="Add notes..." />
              </div>
            </div>
          )}
          <DialogFooter className="flex flex-wrap gap-2">
            <Button variant="default" onClick={() => detailEntry && handleAction(detailEntry, 'approved')} disabled={actioning} className="bg-emerald-600 hover:bg-emerald-700">
              <Check className="h-4 w-4 mr-1" /> Approve
            </Button>
            <Button variant="destructive" onClick={() => detailEntry && handleAction(detailEntry, 'rejected')} disabled={actioning}>
              <X className="h-4 w-4 mr-1" /> Reject
            </Button>
            <Button variant="outline" onClick={() => detailEntry && handleAction(detailEntry, 'duplicate')} disabled={actioning}>
              <Copy className="h-4 w-4 mr-1" /> Duplicate
            </Button>
            <Button variant="outline" onClick={() => detailEntry && handleAction(detailEntry, 'ignored')} disabled={actioning}>
              <EyeOff className="h-4 w-4 mr-1" /> Ignore
            </Button>
            <Button variant="outline" onClick={() => detailEntry && handleAction(detailEntry, 'on_hold')} disabled={actioning}>
              <Pause className="h-4 w-4 mr-1" /> Hold
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Review Entry</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "<strong>{deleteTarget?.title?.substring(0, 80)}</strong>"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingEntry}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteEntry} disabled={deletingEntry} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deletingEntry ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
