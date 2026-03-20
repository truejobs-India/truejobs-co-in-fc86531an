import { useState, useRef, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { supabase } from '@/integrations/supabase/client';
import { useAdminToast as useToast } from '@/contexts/AdminMessagesContext';
import {
  Search, Zap, Loader2, Square, ChevronDown, CheckCircle2, AlertTriangle,
} from 'lucide-react';

interface Props {
  blogTextModel: string;
  onComplete: () => void;
}

type Phase = 'idle' | 'scanning' | 'scanned' | 'enriching';

interface FoundArticle {
  id: string;
  title: string;
  slug: string;
  content: string;
  word_count: number;
  category: string | null;
  tags: string[] | null;
}

export function BulkEnrichByWordCount({ blogTextModel, onComplete }: Props) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

  const [searchBelow, setSearchBelow] = useState(800);
  const [enrichTo, setEnrichTo] = useState(1200);

  const [phase, setPhase] = useState<Phase>('idle');
  const [found, setFound] = useState<FoundArticle[]>([]);
  const [progress, setProgress] = useState<{ done: number; total: number; failed: number; current: string } | null>(null);
  const abortRef = useRef(false);

  // ── Step 1: Scan ──
  const handleScan = useCallback(async () => {
    if (searchBelow < 50) {
      toast({ title: 'Enter a valid word count threshold (≥ 50)', variant: 'destructive' });
      return;
    }
    setPhase('scanning');
    setFound([]);
    try {
      const { data, error } = await supabase
        .from('blog_posts')
        .select('id, title, slug, content, word_count, category, tags')
        .eq('is_published', true)
        .order('word_count', { ascending: true });
      if (error) throw error;

      const matches = (data || []).filter(p => (p.word_count || 0) < searchBelow);
      setFound(matches as FoundArticle[]);
      setPhase('scanned');

      if (matches.length === 0) {
        toast({ title: `No articles found below ${searchBelow} words` });
      } else {
        toast({ title: `Found ${matches.length} article(s) below ${searchBelow} words` });
      }
    } catch (err: any) {
      toast({ title: 'Scan failed', description: err.message, variant: 'destructive' });
      setPhase('idle');
    }
  }, [searchBelow, toast]);

  // ── Step 2: Enrich ──
  const handleEnrich = useCallback(async () => {
    if (found.length === 0) return;
    if (enrichTo < 200) {
      toast({ title: 'Target word count must be ≥ 200', variant: 'destructive' });
      return;
    }
    if (enrichTo <= searchBelow) {
      toast({ title: 'Target word count should be higher than the search threshold', variant: 'destructive' });
      return;
    }

    abortRef.current = false;
    setPhase('enriching');
    const total = found.length;
    let done = 0;
    let failed = 0;
    setProgress({ done: 0, total, failed: 0, current: found[0]?.title || '' });

    for (const post of found) {
      if (abortRef.current) {
        toast({ title: '⏹️ Enrichment stopped', description: `${done} enriched, ${failed} failed, ${total - done - failed} skipped.` });
        break;
      }
      setProgress({ done, total, failed, current: post.title });

      try {
        const { data: enrichData, error } = await supabase.functions.invoke('improve-blog-content', {
          body: {
            action: 'enrich-article',
            slug: post.slug,
            title: post.title,
            content: post.content,
            category: post.category,
            tags: post.tags,
            targetWordCount: enrichTo,
            aiModel: blogTextModel,
          },
        });
        if (error) throw error;

        const enrichedHtml = enrichData?.result;
        if (enrichedHtml && typeof enrichedHtml === 'string' && enrichedHtml.length > 0) {
          const actualWc = enrichData?.wordCountValidation?.actualWordCount
            || enrichedHtml.replace(/<[^>]+>/g, ' ').split(/\s+/).filter((w: string) => w.length > 0).length;
          const readingTime = Math.max(1, Math.ceil(actualWc / 200));

          const linkMatches = [...enrichedHtml.matchAll(/<a\s+[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi)];
          const internalLinks = linkMatches
            .filter((m: RegExpMatchArray) => m[1].startsWith('/'))
            .map((m: RegExpMatchArray) => ({ url: m[1], text: m[2].replace(/<[^>]+>/g, '') }));

          const { error: updateErr } = await supabase
            .from('blog_posts')
            .update({
              content: enrichedHtml,
              word_count: actualWc,
              reading_time: readingTime,
              internal_links: internalLinks.length > 0 ? internalLinks : undefined,
              updated_at: new Date().toISOString(),
            })
            .eq('id', post.id);

          if (updateErr) throw updateErr;
          done++;
        } else {
          console.warn(`Enrich returned empty for "${post.title}"`);
          failed++;
        }
      } catch (err: any) {
        console.warn(`Enrich failed for "${post.title}":`, err.message);
        failed++;
      }

      setProgress({ done: done + failed, total, failed, current: post.title });
      if (done + failed < total) await new Promise(r => setTimeout(r, 2000));
    }

    if (!abortRef.current) {
      toast({ title: '✅ Bulk enrichment complete', description: `${done} enriched, ${failed} failed out of ${total}.` });
    }
    setPhase('idle');
    setFound([]);
    setProgress(null);
    onComplete();
  }, [found, enrichTo, searchBelow, blogTextModel, toast, onComplete]);

  const handleReset = () => {
    setPhase('idle');
    setFound([]);
    setProgress(null);
    abortRef.current = false;
  };

  return (
    <div className="px-6 pb-4 border-b">
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger className="flex items-center gap-2 w-full py-2 text-sm font-medium hover:text-primary">
          <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
          <Zap className="h-4 w-4 text-amber-500" />
          Search &amp; Enrich Articles by Word Count
        </CollapsibleTrigger>

        <CollapsibleContent className="mt-3 space-y-4">
          {/* ── Input Row ── */}
          <div className="flex flex-wrap items-end gap-4">
            {/* Input 1: Search threshold */}
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Find articles below (words)</Label>
              <Input
                type="number"
                min={50}
                max={10000}
                value={searchBelow}
                onChange={e => setSearchBelow(Number(e.target.value))}
                className="w-[140px] h-8 text-sm"
                disabled={phase === 'enriching'}
              />
            </div>

            {/* Input 2: Enrich target */}
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Enrich to (target words)</Label>
              <Input
                type="number"
                min={200}
                max={10000}
                value={enrichTo}
                onChange={e => setEnrichTo(Number(e.target.value))}
                className="w-[140px] h-8 text-sm"
                disabled={phase === 'enriching'}
              />
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2">
              {(phase === 'idle' || phase === 'scanned') && (
                <Button variant="outline" size="sm" onClick={handleScan} disabled={phase === 'enriching'}>
                  {phase === 'idle' ? <Search className="h-4 w-4 mr-1" /> : <Search className="h-4 w-4 mr-1" />}
                  {phase === 'scanned' ? 'Re-Scan' : 'Scan'}
                </Button>
              )}

              {phase === 'scanning' && (
                <Button variant="outline" size="sm" disabled>
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" /> Scanning…
                </Button>
              )}

              {phase === 'scanned' && found.length > 0 && (
                <Button size="sm" onClick={handleEnrich} className="bg-amber-600 hover:bg-amber-700 text-white">
                  <Zap className="h-4 w-4 mr-1" />
                  Enrich {found.length} Article{found.length !== 1 ? 's' : ''}
                </Button>
              )}

              {phase === 'enriching' && (
                <Button variant="destructive" size="sm" onClick={() => { abortRef.current = true; }}>
                  <Square className="h-4 w-4 mr-1" /> Stop
                </Button>
              )}

              {phase === 'scanned' && (
                <Button variant="ghost" size="sm" onClick={handleReset} className="text-xs">
                  Clear
                </Button>
              )}
            </div>
          </div>

          {/* ── Scan results ── */}
          {phase === 'scanned' && found.length === 0 && (
            <div className="flex items-center gap-2 text-sm text-green-600">
              <CheckCircle2 className="h-4 w-4" />
              No published articles found below {searchBelow} words.
            </div>
          )}

          {phase === 'scanned' && found.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <span className="text-sm font-medium">
                  {found.length} article{found.length !== 1 ? 's' : ''} below {searchBelow} words
                </span>
              </div>
              <div className="max-h-[200px] overflow-y-auto rounded border bg-muted/30 p-2 space-y-1">
                {found.map((a, i) => (
                  <div key={a.id} className="flex items-center justify-between text-xs py-1 px-2 rounded hover:bg-muted/50">
                    <span className="truncate flex-1 mr-4">
                      <span className="text-muted-foreground mr-2">{i + 1}.</span>
                      {a.title}
                    </span>
                    <Badge variant="secondary" className="shrink-0 text-[10px]">
                      {a.word_count || 0} words
                    </Badge>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Using model: <strong>{blogTextModel}</strong> • Target: <strong>{enrichTo} words</strong>
              </p>
            </div>
          )}

          {/* ── Progress bar during enrichment ── */}
          {phase === 'enriching' && progress && (
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Enriching: {progress.current}</span>
                <span>{progress.done}/{progress.total} ({progress.failed} failed)</span>
              </div>
              <Progress value={(progress.done / progress.total) * 100} className="h-2" />
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
