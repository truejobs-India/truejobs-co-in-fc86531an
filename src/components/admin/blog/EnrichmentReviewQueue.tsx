import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAdminToast as useToast } from '@/contexts/AdminMessagesContext';
import { calcLiveWordCount, calcReadingTime } from '@/lib/blogWordCount';
import { Check, X, Trash2, Eye, Loader2, CheckCheck, XCircle } from 'lucide-react';
import { EnrichmentProposalDetail } from './EnrichmentProposalDetail';

interface Props {
  batchId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
}

export interface Proposal {
  id: string;
  batch_id: string;
  article_id: string;
  article_title: string;
  article_slug: string;
  original_content: string;
  original_word_count: number;
  proposed_content: string | null;
  proposed_word_count: number;
  target_word_count: number;
  word_count_delta: number;
  status: string;
  model_used: string | null;
  error_message: string | null;
  reviewed_at: string | null;
  created_at: string;
}

type StatusFilter = 'all' | 'pending_review' | 'accepted' | 'rejected' | 'discarded' | 'generation_failed';

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  pending_review: { label: 'Pending Review', className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400' },
  accepted: { label: 'Accepted', className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' },
  rejected: { label: 'Rejected', className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' },
  discarded: { label: 'Discarded', className: 'bg-muted text-muted-foreground' },
  generation_failed: { label: 'Failed', className: 'bg-destructive/10 text-destructive' },
};

function getDeltaBadge(delta: number, target: number) {
  const pct = target > 0 ? (delta / target) * 100 : 0;
  if (pct < -15) return { className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400', prefix: '' };
  if (pct > 15) return { className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400', prefix: '+' };
  return { className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400', prefix: delta >= 0 ? '+' : '' };
}

export function EnrichmentReviewQueue({ batchId, open, onOpenChange, onComplete }: Props) {
  const { toast } = useToast();
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [detailProposal, setDetailProposal] = useState<Proposal | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchProposals = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('blog_enrichment_proposals')
      .select('*')
      .eq('batch_id', batchId)
      .order('created_at', { ascending: true });
    if (error) {
      toast({ title: 'Failed to load proposals', description: error.message, variant: 'destructive' });
    } else {
      setProposals((data as any[]) || []);
    }
    setLoading(false);
  }, [batchId, toast]);

  useEffect(() => {
    if (open) fetchProposals();
  }, [open, fetchProposals]);

  const updateStatus = async (id: string, status: string) => {
    setActionLoading(id);
    try {
      if (status === 'accepted') {
        const proposal = proposals.find(p => p.id === id);
        if (!proposal || !proposal.proposed_content) throw new Error('No content to save');

        const wc = calcLiveWordCount(proposal.proposed_content);
        const linkMatches = [...proposal.proposed_content.matchAll(/<a\s+[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi)];
        const internalLinks = linkMatches
          .filter(m => m[1].startsWith('/'))
          .map(m => ({ url: m[1], text: m[2].replace(/<[^>]+>/g, '') }));

        const { error: updateErr } = await supabase
          .from('blog_posts')
          .update({
            content: proposal.proposed_content,
            word_count: wc,
            reading_time: calcReadingTime(wc),
            internal_links: internalLinks.length > 0 ? internalLinks : undefined,
            updated_at: new Date().toISOString(),
          })
          .eq('id', proposal.article_id);
        if (updateErr) throw updateErr;
      }

      const { error } = await supabase
        .from('blog_enrichment_proposals')
        .update({ status, reviewed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;

      setProposals(prev => prev.map(p => p.id === id ? { ...p, status, reviewed_at: new Date().toISOString() } : p));
      toast({ title: status === 'accepted' ? '✅ Article updated' : `Proposal ${status}` });
    } catch (err: any) {
      toast({ title: 'Action failed', description: err.message, variant: 'destructive' });
    }
    setActionLoading(null);
  };

  const handleBulkAction = async (action: 'accepted' | 'rejected' | 'discarded') => {
    const pending = filteredProposals.filter(p => p.status === 'pending_review');
    if (pending.length === 0) return;
    const label = action === 'accepted' ? 'accept' : action === 'rejected' ? 'reject' : 'discard';
    if (!confirm(`${label.charAt(0).toUpperCase() + label.slice(1)} all ${pending.length} pending proposal(s)?`)) return;

    for (const p of pending) {
      await updateStatus(p.id, action);
    }
    toast({ title: `Bulk ${label} complete`, description: `${pending.length} proposals updated.` });
  };

  const handleSaveEdited = async (proposalId: string, editedContent: string) => {
    setActionLoading(proposalId);
    try {
      const proposal = proposals.find(p => p.id === proposalId);
      if (!proposal) throw new Error('Proposal not found');

      const wc = calcLiveWordCount(editedContent);
      const linkMatches = [...editedContent.matchAll(/<a\s+[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi)];
      const internalLinks = linkMatches
        .filter(m => m[1].startsWith('/'))
        .map(m => ({ url: m[1], text: m[2].replace(/<[^>]+>/g, '') }));

      const { error: updateErr } = await supabase
        .from('blog_posts')
        .update({
          content: editedContent,
          word_count: wc,
          reading_time: calcReadingTime(wc),
          internal_links: internalLinks.length > 0 ? internalLinks : undefined,
          updated_at: new Date().toISOString(),
        })
        .eq('id', proposal.article_id);
      if (updateErr) throw updateErr;

      const { error } = await supabase
        .from('blog_enrichment_proposals')
        .update({
          status: 'accepted',
          proposed_content: editedContent,
          proposed_word_count: wc,
          reviewed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', proposalId);
      if (error) throw error;

      setProposals(prev => prev.map(p => p.id === proposalId
        ? { ...p, status: 'accepted', proposed_content: editedContent, proposed_word_count: wc, reviewed_at: new Date().toISOString() }
        : p
      ));
      setDetailProposal(null);
      toast({ title: '✅ Edited content saved to article' });
    } catch (err: any) {
      toast({ title: 'Save failed', description: err.message, variant: 'destructive' });
    }
    setActionLoading(null);
  };

  const filteredProposals = filter === 'all' ? proposals : proposals.filter(p => p.status === filter);
  const pendingCount = proposals.filter(p => p.status === 'pending_review').length;
  const acceptedCount = proposals.filter(p => p.status === 'accepted').length;
  const failedCount = proposals.filter(p => p.status === 'generation_failed').length;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              Enrichment Review Queue
              <Badge variant="outline" className="text-xs">{proposals.length} proposals</Badge>
            </DialogTitle>
          </DialogHeader>

          {/* Summary bar */}
          <div className="flex items-center gap-3 text-xs text-muted-foreground border-b pb-3">
            <span className="font-medium">Pending: {pendingCount}</span>
            <span>Accepted: {acceptedCount}</span>
            <span>Failed: {failedCount}</span>
            <div className="ml-auto flex items-center gap-2">
              <Select value={filter} onValueChange={v => setFilter(v as StatusFilter)}>
                <SelectTrigger className="h-7 w-[150px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="pending_review">Pending Review</SelectItem>
                  <SelectItem value="accepted">Accepted</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                  <SelectItem value="discarded">Discarded</SelectItem>
                  <SelectItem value="generation_failed">Failed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Bulk actions */}
          {pendingCount > 0 && (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="text-xs" onClick={() => handleBulkAction('accepted')}>
                <CheckCheck className="h-3.5 w-3.5 mr-1" /> Accept All Pending
              </Button>
              <Button variant="outline" size="sm" className="text-xs" onClick={() => handleBulkAction('rejected')}>
                <XCircle className="h-3.5 w-3.5 mr-1" /> Reject All Pending
              </Button>
            </div>
          )}

          {/* Table */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : filteredProposals.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No proposals match this filter.</p>
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2 pr-2 font-medium">Title</th>
                    <th className="py-2 px-2 font-medium text-right w-[70px]">Original</th>
                    <th className="py-2 px-2 font-medium text-right w-[70px]">Proposed</th>
                    <th className="py-2 px-2 font-medium text-right w-[60px]">Target</th>
                    <th className="py-2 px-2 font-medium text-right w-[70px]">Delta</th>
                    <th className="py-2 px-2 font-medium w-[100px]">Status</th>
                    <th className="py-2 pl-2 font-medium w-[140px]">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProposals.map(p => {
                    const delta = getDeltaBadge(p.word_count_delta, p.target_word_count);
                    const statusBadge = STATUS_BADGE[p.status] || STATUS_BADGE.pending_review;
                    const isPending = p.status === 'pending_review';
                    const isFailed = p.status === 'generation_failed';
                    const isActioning = actionLoading === p.id;

                    return (
                      <tr key={p.id} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="py-2 pr-2">
                          <span className="truncate block max-w-[200px]" title={p.article_title}>
                            {p.article_title}
                          </span>
                        </td>
                        <td className="py-2 px-2 text-right tabular-nums">{p.original_word_count}</td>
                        <td className="py-2 px-2 text-right tabular-nums font-medium">
                          {isFailed ? '—' : p.proposed_word_count}
                        </td>
                        <td className="py-2 px-2 text-right tabular-nums">{p.target_word_count}</td>
                        <td className="py-2 px-2 text-right">
                          {isFailed ? (
                            <Badge variant="outline" className="text-[9px] bg-destructive/10 text-destructive">Error</Badge>
                          ) : (
                            <Badge variant="outline" className={`text-[9px] tabular-nums ${delta.className}`}>
                              {delta.prefix}{p.word_count_delta}
                            </Badge>
                          )}
                        </td>
                        <td className="py-2 px-2">
                          <Badge variant="outline" className={`text-[9px] ${statusBadge.className}`}>
                            {statusBadge.label}
                          </Badge>
                        </td>
                        <td className="py-2 pl-2">
                          <div className="flex gap-1">
                            {!isFailed && (
                              <Button variant="ghost" size="sm" className="h-6 w-6 p-0" title="View Detail"
                                onClick={() => setDetailProposal(p)}>
                                <Eye className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            {isPending && !isFailed && (
                              <>
                                <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-green-600" title="Accept & Save"
                                  onClick={() => updateStatus(p.id, 'accepted')} disabled={isActioning}>
                                  {isActioning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                                </Button>
                                <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-red-600" title="Reject"
                                  onClick={() => updateStatus(p.id, 'rejected')} disabled={isActioning}>
                                  <X className="h-3.5 w-3.5" />
                                </Button>
                                <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-muted-foreground" title="Discard"
                                  onClick={() => updateStatus(p.id, 'discarded')} disabled={isActioning}>
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </>
                            )}
                            {isFailed && p.error_message && (
                              <span className="text-[10px] text-destructive truncate max-w-[120px]" title={p.error_message}>
                                {p.error_message}
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Footer */}
          <div className="flex justify-between items-center pt-3 border-t">
            <p className="text-[11px] text-muted-foreground">
              {acceptedCount > 0 && `${acceptedCount} article(s) updated. `}
              Original content preserved in proposals for audit.
            </p>
            <Button variant="outline" size="sm" onClick={() => { onOpenChange(false); if (acceptedCount > 0) onComplete(); }}>
              Done
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Detail dialog */}
      {detailProposal && (
        <EnrichmentProposalDetail
          proposal={detailProposal}
          open={!!detailProposal}
          onOpenChange={(open) => { if (!open) setDetailProposal(null); }}
          onAccept={(id) => { updateStatus(id, 'accepted'); setDetailProposal(null); }}
          onReject={(id) => { updateStatus(id, 'rejected'); setDetailProposal(null); }}
          onDiscard={(id) => { updateStatus(id, 'discarded'); setDetailProposal(null); }}
          onSaveEdited={handleSaveEdited}
        />
      )}
    </>
  );
}
