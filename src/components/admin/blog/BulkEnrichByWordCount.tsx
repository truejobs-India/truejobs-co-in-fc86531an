import { useState, useRef, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAdminToast as useToast } from '@/contexts/AdminMessagesContext';
import { calcLiveWordCount, calcReadingTime, wordCountFields } from '@/lib/blogWordCount';
import {
  analyzeQuality, analyzeSEO, getReadinessStatus, blogPostToMetadata,
  type ReadinessStatus,
} from '@/lib/blogArticleAnalyzer';
import {
  Search, Zap, Loader2, Square, ChevronDown, CheckCircle2, AlertTriangle,
  RefreshCw,
} from 'lucide-react';

interface Props {
  blogTextModel: string;
  onComplete: () => void;
}

type Phase = 'idle' | 'scanning' | 'scanned' | 'enriching' | 'syncing';
type Scope = 'all' | 'published' | 'unpublished';

interface FoundArticle {
  id: string;
  title: string;
  slug: string;
  content: string;
  word_count: number;        // live-calculated
  db_word_count: number;     // stale DB value
  is_published: boolean;
  readiness: ReadinessStatus;
  category: string | null;
  tags: string[] | null;
}

const READINESS_COLORS: Record<ReadinessStatus, string> = {
  'Published': 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  'Ready to Publish': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  'Ready as Draft': 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-400',
  'Needs Review': 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  'Not Ready': 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
};

const SCOPE_LABELS: Record<Scope, string> = {
  all: 'All Posts',
  published: 'Published Only',
  unpublished: 'Unpublished Only',
};

export function BulkEnrichByWordCount({ blogTextModel, onComplete }: Props) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

  const [searchBelow, setSearchBelow] = useState(800);
  const [enrichTo, setEnrichTo] = useState(1200);
  const [scope, setScope] = useState<Scope>('all');

  const [phase, setPhase] = useState<Phase>('idle');
  const [found, setFound] = useState<FoundArticle[]>([]);
  const [scanSummary, setScanSummary] = useState<{ total: number; scope: Scope } | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number; failed: number; current: string } | null>(null);
  const abortRef = useRef(false);

  // ── Sync state ──
  const [syncProgress, setSyncProgress] = useState<{ done: number; total: number; failed: number } | null>(null);

  // ── Compute readiness for a post (uses the exact same path as the table) ──
  const computeReadiness = (post: { title: string; slug: string; content: string; is_published: boolean; meta_title?: string | null; meta_description?: string | null; excerpt?: string | null; cover_image_url?: string | null; featured_image_alt?: string | null; category?: string | null; tags?: string[] | null; word_count?: number | null; faq_count?: number | null; has_faq_schema?: boolean | null; internal_links?: any; canonical_url?: string | null; author_name?: string | null; }, liveWc: number): ReadinessStatus => {
    const meta = blogPostToMetadata({ ...post, word_count: liveWc });
    const q = analyzeQuality(meta);
    const s = analyzeSEO(meta);
    return getReadinessStatus(q, s, meta);
  };

  // ── Step 1: Scan ──
  const handleScan = useCallback(async () => {
    if (searchBelow < 50) {
      toast({ title: 'Enter a valid word count threshold (≥ 50)', variant: 'destructive' });
      return;
    }
    setPhase('scanning');
    setFound([]);
    setScanSummary(null);
    try {
      // Fetch all posts in batches of 500
      let allPosts: any[] = [];
      let from = 0;
      const batchSize = 500;
      while (true) {
        let query = supabase
          .from('blog_posts')
          .select('id, title, slug, content, word_count, category, tags, is_published, meta_title, meta_description, excerpt, cover_image_url, featured_image_alt, faq_count, has_faq_schema, internal_links, canonical_url, author_name');

        // Apply scope filter at DB level
        if (scope === 'published') query = query.eq('is_published', true);
        else if (scope === 'unpublished') query = query.eq('is_published', false);

        const { data, error } = await query.range(from, from + batchSize - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        allPosts = allPosts.concat(data);
        if (data.length < batchSize) break;
        from += batchSize;
      }

      // Calculate live word count, compute readiness, and filter
      const matches: FoundArticle[] = allPosts
        .map((p) => {
          const liveWc = calcLiveWordCount(p.content);
          const readiness = computeReadiness(p, liveWc);
          return {
            id: p.id,
            title: p.title,
            slug: p.slug,
            content: p.content,
            word_count: liveWc,
            db_word_count: p.word_count || 0,
            is_published: p.is_published,
            readiness,
            category: p.category,
            tags: p.tags,
          };
        })
        .filter((p) => p.word_count < searchBelow)
        .sort((a, b) => a.word_count - b.word_count);

      setFound(matches);
      setScanSummary({ total: allPosts.length, scope });
      setPhase('scanned');

      if (matches.length === 0) {
        toast({ title: `No articles found below ${searchBelow} words (scanned ${allPosts.length} ${SCOPE_LABELS[scope].toLowerCase()})` });
      } else {
        toast({ title: `Found ${matches.length} article(s) below ${searchBelow} words out of ${allPosts.length} scanned` });
      }
    } catch (err: any) {
      toast({ title: 'Scan failed', description: err.message, variant: 'destructive' });
      setPhase('idle');
    }
  }, [searchBelow, scope, toast]);

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
    let consecutiveFailures = 0;
    const MAX_CONSECUTIVE_FAILURES = 3;
    setProgress({ done: 0, total, failed: 0, current: found[0]?.title || '' });

    for (const post of found) {
      if (abortRef.current) {
        toast({ title: '⏹️ Enrichment stopped', description: `${done} enriched, ${failed} failed, ${total - done - failed} skipped.` });
        break;
      }
      if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
        toast({
          title: '⛔ Auto-stopped: too many consecutive failures',
          description: `${consecutiveFailures} articles failed in a row. ${done} enriched, ${failed} failed, ${total - done - failed} skipped.`,
          variant: 'destructive',
        });
        break;
      }
      setProgress({ done, total, failed, current: post.title });

      try {
        const resp = await supabase.functions.invoke('improve-blog-content', {
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

        if (resp.error) {
          const errorMsg = typeof resp.error === 'object' && resp.error?.message
            ? resp.error.message : String(resp.error);
          console.warn(`Enrich edge function error for "${post.title}": ${errorMsg}`);
          failed++;
          consecutiveFailures++;
          continue;
        }

        const enrichData = resp.data;
        if (!enrichData || enrichData.error) {
          console.warn(`Enrich returned error for "${post.title}": ${enrichData?.error || 'no data'}`);
          failed++;
          consecutiveFailures++;
          continue;
        }

        const enrichedHtml = enrichData?.result;
        const wcValidation = enrichData?.wordCountValidation;
        const actualWc = wcValidation?.actualWordCount
          || calcLiveWordCount(enrichedHtml);
        const originalWc = post.word_count; // live-calculated baseline

        if (!enrichedHtml || typeof enrichedHtml !== 'string' || enrichedHtml.length < 100) {
          console.warn(`Enrich returned empty/short for "${post.title}"`);
          failed++;
          consecutiveFailures++;
        } else if (wcValidation?.status === 'fail') {
          console.warn(`Enrich word count FAILED for "${post.title}": ${actualWc}/${enrichTo}. Skipping.`);
          failed++;
          consecutiveFailures++;
        } else if (actualWc <= originalWc) {
          console.warn(`Enrich did not increase word count for "${post.title}": ${originalWc} → ${actualWc}. Skipping.`);
          failed++;
          consecutiveFailures++;
        } else {
          consecutiveFailures = 0;

          const linkMatches = [...enrichedHtml.matchAll(/<a\s+[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi)];
          const internalLinks = linkMatches
            .filter((m: RegExpMatchArray) => m[1].startsWith('/'))
            .map((m: RegExpMatchArray) => ({ url: m[1], text: m[2].replace(/<[^>]+>/g, '') }));

          // Save enriched content — word_count computed from the exact payload being saved
          const savedContent = enrichedHtml;
          const postSaveWc = calcLiveWordCount(savedContent);
          const { error: updateErr } = await supabase
            .from('blog_posts')
            .update({
              content: savedContent,
              word_count: postSaveWc,
              reading_time: calcReadingTime(postSaveWc),
              internal_links: internalLinks.length > 0 ? internalLinks : undefined,
              updated_at: new Date().toISOString(),
            })
            .eq('id', post.id);

          if (updateErr) throw updateErr;

          // Post-save verification: report target status
          const pct = Math.round((postSaveWc / enrichTo) * 100);
          if (postSaveWc >= enrichTo * 0.85) {
            console.log(`✅ "${post.title}" — ${postSaveWc} words (${pct}% of target ${enrichTo})`);
          } else {
            console.warn(`⚠️ "${post.title}" — ${postSaveWc} words (${pct}% of target ${enrichTo}) — below 85% target`);
          }
          done++;
        }
      } catch (err: any) {
        console.warn(`Enrich failed for "${post.title}":`, err.message);
        failed++;
        consecutiveFailures++;
      }

      setProgress({ done: done + failed, total, failed, current: post.title });
      if (done + failed < total) await new Promise(r => setTimeout(r, 2000));
    }

    if (!abortRef.current && consecutiveFailures < MAX_CONSECUTIVE_FAILURES) {
      const variant = failed > 0 && done === 0 ? 'destructive' : undefined;
      toast({
        title: done > 0 ? '✅ Bulk enrichment complete' : '⚠️ Bulk enrichment finished with issues',
        description: `${done} enriched, ${failed} failed out of ${total}.`,
        variant,
      });
    }
    setPhase('idle');
    setFound([]);
    setProgress(null);
    setScanSummary(null);
    onComplete();
  }, [found, enrichTo, searchBelow, blogTextModel, toast, onComplete]);

  // ── One-time Word Count Sync (chunked, with progress) ──
  const handleSyncWordCounts = useCallback(async () => {
    setPhase('syncing');
    setSyncProgress({ done: 0, total: 0, failed: 0 });
    try {
      // Fetch all posts with content in batches
      let allPosts: { id: string; content: string; word_count: number | null }[] = [];
      let from = 0;
      const batchSize = 500;
      while (true) {
        const { data, error } = await supabase
          .from('blog_posts')
          .select('id, content, word_count')
          .range(from, from + batchSize - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        allPosts = allPosts.concat(data);
        if (data.length < batchSize) break;
        from += batchSize;
      }

      // Find stale rows
      const staleRows = allPosts
        .map(p => ({ id: p.id, liveWc: calcLiveWordCount(p.content), dbWc: p.word_count || 0 }))
        .filter(p => p.liveWc !== p.dbWc);

      if (staleRows.length === 0) {
        toast({ title: '✅ All word counts are already in sync', description: `Checked ${allPosts.length} articles.` });
        setPhase('idle');
        setSyncProgress(null);
        return;
      }

      const total = staleRows.length;
      let done = 0;
      let failed = 0;
      setSyncProgress({ done: 0, total, failed: 0 });

      // Process in chunks of 20
      const CHUNK_SIZE = 20;
      for (let i = 0; i < staleRows.length; i += CHUNK_SIZE) {
        const chunk = staleRows.slice(i, i + CHUNK_SIZE);
        const results = await Promise.allSettled(
          chunk.map(row =>
            supabase
              .from('blog_posts')
              .update({ word_count: row.liveWc, reading_time: calcReadingTime(row.liveWc) })
              .eq('id', row.id)
          )
        );
        for (const r of results) {
          if (r.status === 'fulfilled' && !r.value.error) done++;
          else failed++;
        }
        setSyncProgress({ done: done + failed, total, failed });
      }

      toast({
        title: '✅ Word count sync complete',
        description: `${done} fixed, ${failed} failed out of ${total} stale (${allPosts.length} total checked).`,
      });
    } catch (err: any) {
      toast({ title: 'Sync failed', description: err.message, variant: 'destructive' });
    }
    setPhase('idle');
    setSyncProgress(null);
    onComplete();
  }, [toast, onComplete]);

  const handleReset = () => {
    setPhase('idle');
    setFound([]);
    setProgress(null);
    setScanSummary(null);
    abortRef.current = false;
  };

  return (
    <div className="px-6 pb-4 border-b">
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger className="flex items-center gap-2 w-full py-2 text-sm font-medium hover:text-primary">
          <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
          <Zap className="h-4 w-4 text-primary" />
          Search &amp; Enrich Articles by Word Count
        </CollapsibleTrigger>

        <CollapsibleContent className="mt-3 space-y-4">
          {/* ── Input Row ── */}
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Scope</Label>
              <Select value={scope} onValueChange={(v) => setScope(v as Scope)} disabled={phase === 'enriching'}>
                <SelectTrigger className="w-[160px] h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Posts</SelectItem>
                  <SelectItem value="published">Published Only</SelectItem>
                  <SelectItem value="unpublished">Unpublished Only</SelectItem>
                </SelectContent>
              </Select>
            </div>

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

            <div className="flex items-center gap-2">
              {(phase === 'idle' || phase === 'scanned') && (
                <Button variant="outline" size="sm" onClick={handleScan}>
                  <Search className="h-4 w-4 mr-1" />
                  {phase === 'scanned' ? 'Re-Scan' : 'Scan'}
                </Button>
              )}

              {phase === 'scanning' && (
                <Button variant="outline" size="sm" disabled>
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" /> Scanning…
                </Button>
              )}

              {phase === 'scanned' && found.length > 0 && (
                <Button size="sm" onClick={handleEnrich} variant="default">
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

          {/* ── Sync Word Counts Button ── */}
          {(phase === 'idle' || phase === 'scanned') && (
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleSyncWordCounts} className="text-xs">
                <RefreshCw className="h-3.5 w-3.5 mr-1" />
                Sync All Word Counts
              </Button>
              <span className="text-[11px] text-muted-foreground">
                Recalculates and fixes stale word_count values in the database for all articles.
              </span>
            </div>
          )}

          {/* ── Sync Progress ── */}
          {phase === 'syncing' && syncProgress && (
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Syncing word counts…</span>
                <span>{syncProgress.done}/{syncProgress.total} ({syncProgress.failed} failed)</span>
              </div>
              <Progress value={syncProgress.total > 0 ? (syncProgress.done / syncProgress.total) * 100 : 0} className="h-2" />
            </div>
          )}

          {/* ── Scan summary ── */}
          {phase === 'scanned' && scanSummary && (
            <div className="text-[11px] text-muted-foreground">
              Scanned <strong>{scanSummary.total}</strong> posts ({SCOPE_LABELS[scanSummary.scope]}) — Found <strong>{found.length}</strong> below {searchBelow} words
            </div>
          )}

          {/* ── Scan results ── */}
          {phase === 'scanned' && found.length === 0 && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle2 className="h-4 w-4" />
              No articles found below {searchBelow} words.
            </div>
          )}

          {phase === 'scanned' && found.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                <span className="text-sm font-medium">
                  {found.length} article{found.length !== 1 ? 's' : ''} below {searchBelow} words
                </span>
              </div>
              <div className="max-h-[200px] overflow-y-auto rounded border bg-muted/30 p-2 space-y-1">
                {found.map((a, i) => (
                  <div key={a.id} className="flex items-center justify-between text-xs py-1 px-2 rounded hover:bg-muted/50">
                    <span className="truncate flex-1 mr-2">
                      <span className="text-muted-foreground mr-2">{i + 1}.</span>
                      {a.title}
                    </span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Badge variant="outline" className={`text-[9px] px-1.5 py-0 ${READINESS_COLORS[a.readiness]}`}>
                        {a.readiness}
                      </Badge>
                      <Badge variant="secondary" className="text-[10px]">
                        {a.word_count} words
                      </Badge>
                    </div>
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
