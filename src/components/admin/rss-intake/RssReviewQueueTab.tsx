import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAdminToast } from '@/contexts/AdminMessagesContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { ClipboardCheck, ExternalLink, Search, RefreshCw, Check, X, Copy, EyeOff, Pause, FileDown } from 'lucide-react';
import type { ReviewQueueEntry } from './rssTypes';
import { REVIEW_STATUSES, PRIMARY_DOMAINS, DOMAIN_LABELS } from './rssTypes';

const domainBadgeColors: Record<string, string> = {
  jobs: 'bg-emerald-100 text-emerald-800',
  education_services: 'bg-blue-100 text-blue-800',
  exam_updates: 'bg-purple-100 text-purple-800',
  public_services: 'bg-cyan-100 text-cyan-800',
  policy_updates: 'bg-pink-100 text-pink-800',
  general_alerts: 'bg-gray-100 text-gray-600',
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

  const openDetail = (entry: ReviewQueueEntry) => {
    setDetailEntry(entry);
    setQaNotes(entry.qa_notes || '');
    setShowDetail(true);
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

        {loading ? (
          <p className="text-center py-8 text-muted-foreground">Loading...</p>
        ) : filtered.length === 0 ? (
          <p className="text-center py-8 text-muted-foreground">No items in review queue.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
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
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Review Item</DialogTitle></DialogHeader>
          {detailEntry && (
            <div className="space-y-4">
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
    </Card>
  );
}
