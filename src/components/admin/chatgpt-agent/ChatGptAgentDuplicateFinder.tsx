/**
 * ChatGPT Agent Duplicate Finder — per-section duplicate detection dialog.
 */
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Trash2, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface DuplicateMatch {
  draftId: string;
  draftTitle: string;
  matchedTitle: string;
  matchSource: string;
  matchReason: string;
}

interface ChatGptAgentDuplicateFinderProps {
  open: boolean;
  onClose: () => void;
  drafts: any[];
  sectionLabel: string;
  onDeleted: () => void;
}

export function ChatGptAgentDuplicateFinder({ open, onClose, drafts, sectionLabel, onDeleted }: ChatGptAgentDuplicateFinderProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [matches, setMatches] = useState<DuplicateMatch[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [hasRun, setHasRun] = useState(false);

  const runCheck = async () => {
    setLoading(true);
    setMatches([]);
    setSelected(new Set());
    const found: DuplicateMatch[] = [];

    try {
      // Collect links and titles from drafts
      const draftLinks = drafts.filter(d => d.official_notification_link).map(d => d.official_notification_link);
      const draftTitles = drafts.filter(d => d.normalized_title).map(d => (d.normalized_title as string).toLowerCase().trim());

      // Check 1: Exact link match against employment_news_jobs
      if (draftLinks.length > 0) {
        for (let i = 0; i < draftLinks.length; i += 50) {
          const batch = draftLinks.slice(i, i + 50);
          const { data } = await supabase
            .from('employment_news_jobs')
            .select('id, enriched_title, apply_link')
            .in('apply_link', batch)
            .limit(100);
          if (data) {
            for (const match of data) {
              const draft = drafts.find(d => d.official_notification_link === match.apply_link);
              if (draft) {
                found.push({
                  draftId: draft.id,
                  draftTitle: draft.normalized_title || draft.raw_title,
                  matchedTitle: match.enriched_title || 'Unknown',
                  matchSource: 'Published Jobs',
                  matchReason: 'Exact official link match',
                });
              }
            }
          }
        }
      }

      // Check 2: Exact title match against employment_news_jobs
      if (draftTitles.length > 0) {
        for (let i = 0; i < draftTitles.length; i += 50) {
          const batch = draftTitles.slice(i, i + 50);
          const { data } = await supabase
            .from('employment_news_jobs')
            .select('id, enriched_title')
            .in('enriched_title', batch)
            .limit(100);
          if (data) {
            for (const match of data) {
              const draft = drafts.find(d =>
                (d.normalized_title || d.raw_title || '').toLowerCase().trim() === (match.enriched_title || '').toLowerCase().trim()
              );
              if (draft && !found.some(f => f.draftId === draft.id && f.matchReason.includes('title'))) {
                found.push({
                  draftId: draft.id,
                  draftTitle: draft.normalized_title || draft.raw_title,
                  matchedTitle: match.enriched_title || 'Unknown',
                  matchSource: 'Published Jobs',
                  matchReason: 'Exact title match',
                });
              }
            }
          }
        }
      }

      // Check 3: Org + post_name combo against employment_news_jobs
      const orgPostDrafts = drafts.filter(d => d.organisation_name && d.post_name);
      for (const draft of orgPostDrafts) {
        const { data } = await supabase
          .from('employment_news_jobs')
          .select('id, enriched_title, org_name, post')
          .ilike('org_name', draft.organisation_name)
          .ilike('post', draft.post_name)
          .limit(5);
        if (data && data.length > 0 && !found.some(f => f.draftId === draft.id)) {
          found.push({
            draftId: draft.id,
            draftTitle: draft.normalized_title || draft.raw_title,
            matchedTitle: data[0].enriched_title || 'Unknown',
            matchSource: 'Published Jobs',
            matchReason: 'Same organization + post name',
          });
        }
      }

      // Check 4: Within-drafts duplicate (other chatgpt_agent drafts not in current batch)
      for (const draft of drafts) {
        if (!draft.official_notification_link) continue;
        const { data } = await (supabase
          .from('intake_drafts')
          .select('id, normalized_title') as any)
          .eq('source_channel', 'chatgpt_agent')
          .eq('official_notification_link', draft.official_notification_link)
          .neq('id', draft.id)
          .limit(1);
        if (data && data.length > 0 && !found.some(f => f.draftId === draft.id)) {
          found.push({
            draftId: draft.id,
            draftTitle: draft.normalized_title || draft.raw_title,
            matchedTitle: data[0].normalized_title || 'Other draft',
            matchSource: 'Other Drafts',
            matchReason: 'Duplicate link in drafts',
          });
        }
      }

      setMatches(found);
      setHasRun(true);
      if (found.length === 0) {
        toast({ title: 'No duplicates found', description: `${drafts.length} drafts checked in ${sectionLabel}` });
      }
    } catch (err) {
      console.error('Duplicate check error:', err);
      toast({ title: 'Error checking duplicates', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSelected = async () => {
    if (selected.size === 0) return;
    setDeleting(true);
    try {
      const ids = Array.from(selected);
      for (let i = 0; i < ids.length; i += 50) {
        const batch = ids.slice(i, i + 50);
        await supabase.from('intake_drafts').delete().in('id', batch);
      }
      toast({ title: `Deleted ${ids.length} duplicate drafts` });
      setMatches(prev => prev.filter(m => !selected.has(m.draftId)));
      setSelected(new Set());
      onDeleted();
    } catch {
      toast({ title: 'Delete failed', variant: 'destructive' });
    } finally {
      setDeleting(false);
    }
  };

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Duplicate Finder — {sectionLabel}
          </DialogTitle>
        </DialogHeader>

        {!hasRun ? (
          <div className="text-center py-8">
            <p className="text-sm text-muted-foreground mb-4">
              Check {drafts.length} drafts for duplicates against published content and other drafts.
            </p>
            <Button onClick={runCheck} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Run Duplicate Check
            </Button>
          </div>
        ) : matches.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-muted-foreground">✅ No duplicates found.</p>
          </div>
        ) : (
          <ScrollArea className="flex-1 min-h-0">
            <div className="space-y-2 pr-4">
              {matches.map((m, i) => (
                <div key={`${m.draftId}-${i}`} className="flex items-start gap-3 p-3 rounded-lg border bg-card">
                  <Checkbox
                    checked={selected.has(m.draftId)}
                    onCheckedChange={() => toggleSelect(m.draftId)}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{m.draftTitle}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Matches: <span className="font-medium">{m.matchedTitle}</span>
                    </p>
                    <div className="flex gap-2 mt-1.5">
                      <Badge variant="outline" className="text-[10px]">{m.matchSource}</Badge>
                      <Badge variant="secondary" className="text-[10px]">{m.matchReason}</Badge>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}

        <DialogFooter>
          {selected.size > 0 && (
            <Button variant="destructive" onClick={handleDeleteSelected} disabled={deleting} size="sm">
              {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
              Delete {selected.size} Duplicates
            </Button>
          )}
          <Button variant="outline" onClick={onClose} size="sm">Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
