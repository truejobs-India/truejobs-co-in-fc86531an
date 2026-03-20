import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { calcLiveWordCount } from '@/lib/blogWordCount';
import { Check, X, Trash2, Pencil, Save } from 'lucide-react';
import type { Proposal } from './EnrichmentReviewQueue';

interface Props {
  proposal: Proposal;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
  onDiscard: (id: string) => void;
  onSaveEdited: (id: string, content: string) => void;
}

export function EnrichmentProposalDetail({ proposal, open, onOpenChange, onAccept, onReject, onDiscard, onSaveEdited }: Props) {
  const [editing, setEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(proposal.proposed_content || '');
  const editedWc = editing ? calcLiveWordCount(editedContent) : 0;

  const isPending = proposal.status === 'pending_review';
  const delta = proposal.word_count_delta;
  const pct = proposal.target_word_count > 0 ? (delta / proposal.target_word_count) * 100 : 0;

  const deltaColor = pct < -15 ? 'text-red-600' : pct > 15 ? 'text-amber-600' : 'text-green-600';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-base truncate pr-8">{proposal.article_title}</DialogTitle>
        </DialogHeader>

        {/* Metrics bar */}
        <div className="flex flex-wrap items-center gap-4 text-xs border-b pb-3">
          <div>
            <span className="text-muted-foreground">Original:</span>{' '}
            <span className="font-medium tabular-nums">{proposal.original_word_count} words</span>
          </div>
          <div>
            <span className="text-muted-foreground">Proposed:</span>{' '}
            <span className="font-medium tabular-nums">{proposal.proposed_word_count} words</span>
          </div>
          <div>
            <span className="text-muted-foreground">Target:</span>{' '}
            <span className="font-medium tabular-nums">{proposal.target_word_count} words</span>
          </div>
          <div>
            <span className="text-muted-foreground">Delta:</span>{' '}
            <span className={`font-bold tabular-nums ${deltaColor}`}>
              {delta >= 0 ? '+' : ''}{delta} ({pct >= 0 ? '+' : ''}{pct.toFixed(0)}%)
            </span>
          </div>
          {proposal.model_used && (
            <Badge variant="outline" className="text-[9px]">{proposal.model_used}</Badge>
          )}
          {editing && (
            <div>
              <span className="text-muted-foreground">Edited WC:</span>{' '}
              <span className="font-bold tabular-nums">{editedWc}</span>
            </div>
          )}
        </div>

        {/* Content comparison */}
        <div className="flex-1 grid grid-cols-2 gap-4 overflow-hidden min-h-0">
          {/* Original */}
          <div className="flex flex-col overflow-hidden">
            <h4 className="text-xs font-semibold text-muted-foreground mb-2">Original Content</h4>
            <div
              className="flex-1 overflow-y-auto rounded border bg-muted/20 p-3 text-xs prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: proposal.original_content }}
            />
          </div>

          {/* Proposed / Editable */}
          <div className="flex flex-col overflow-hidden">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-semibold text-muted-foreground">
                {editing ? 'Editing Proposed Content' : 'Proposed Content'}
              </h4>
              {isPending && !editing && (
                <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => { setEditing(true); setEditedContent(proposal.proposed_content || ''); }}>
                  <Pencil className="h-3 w-3 mr-1" /> Edit
                </Button>
              )}
              {editing && (
                <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setEditing(false)}>
                  Cancel Edit
                </Button>
              )}
            </div>
            {editing ? (
              <Textarea
                value={editedContent}
                onChange={e => setEditedContent(e.target.value)}
                className="flex-1 text-xs font-mono resize-none"
                style={{ minHeight: '200px' }}
              />
            ) : (
              <div
                className="flex-1 overflow-y-auto rounded border bg-muted/20 p-3 text-xs prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: proposal.proposed_content || '' }}
              />
            )}
          </div>
        </div>

        {/* Action buttons */}
        {isPending && (
          <div className="flex items-center gap-2 pt-3 border-t">
            {editing ? (
              <Button size="sm" onClick={() => onSaveEdited(proposal.id, editedContent)}>
                <Save className="h-4 w-4 mr-1" /> Save Edited & Apply
              </Button>
            ) : (
              <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => onAccept(proposal.id)}>
                <Check className="h-4 w-4 mr-1" /> Accept & Save
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => onReject(proposal.id)}>
              <X className="h-4 w-4 mr-1" /> Reject
            </Button>
            <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => onDiscard(proposal.id)}>
              <Trash2 className="h-4 w-4 mr-1" /> Discard
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
