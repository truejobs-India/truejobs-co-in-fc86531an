import { useState, useRef, useCallback, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useAdminToast as useToast } from '@/contexts/AdminMessagesContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Zap, ImageIcon, Loader2, Square, CheckCircle2, AlertTriangle, Search,
} from 'lucide-react';
import {
  detectInlineSlots, insertInlineImage, getContextForSlot,
  buildArticleImagesMetadata, isInvalidImageUrl,
} from '@/lib/blogInlineImages';

interface PendingActionsPanelProps {
  blogTextModel: string;
  coverImageModel: string;
  inlineImageModel: string;
  enrichWordLimit: number;
  onComplete: () => void;
}

type ScanPhase = 'idle' | 'scanning' | 'scanned' | 'executing';

interface ScanResult {
  count: number;
  items: any[];
}

export function PendingActionsPanel({
  blogTextModel, coverImageModel, inlineImageModel, enrichWordLimit, onComplete,
}: PendingActionsPanelProps) {
  const { toast } = useToast();

  // ── Enrich state ──
  const [customWordLimit, setCustomWordLimit] = useState(enrichWordLimit);
  const [enrichPhase, setEnrichPhase] = useState<ScanPhase>('idle');
  const [enrichScan, setEnrichScan] = useState<ScanResult | null>(null);
  const [enrichProgress, setEnrichProgress] = useState<{ done: number; total: number; failed: number; current: string } | null>(null);
  const enrichAbortRef = useRef(false);

  useEffect(() => { setCustomWordLimit(enrichWordLimit); }, [enrichWordLimit]);

  // ── Cover image state ──
  const [coverPhase, setCoverPhase] = useState<ScanPhase>('idle');
  const [coverScan, setCoverScan] = useState<ScanResult | null>(null);
  const [coverProgress, setCoverProgress] = useState<{ done: number; total: number; failed: number; current: string } | null>(null);
  const coverAbortRef = useRef(false);

  // ── Inline image state ──
  const [inlinePhase, setInlinePhase] = useState<ScanPhase>('idle');
  const [inlineScan, setInlineScan] = useState<ScanResult | null>(null);
  const [inlineProgress, setInlineProgress] = useState<{ done: number; total: number; failed: number; skipped: number; current: string } | null>(null);
  const inlineAbortRef = useRef(false);

  // ═══════════════════════════════════════════════
  // 1. ENRICH PENDING ARTICLES
  // ═══════════════════════════════════════════════
  const scanEnrich = useCallback(async () => {
    setEnrichPhase('scanning');
    try {
      const { data, error } = await supabase
        .from('blog_posts')
        .select('id, title, slug, content, word_count, category, tags, is_published')
        .order('created_at', { ascending: false });
      if (error) throw error;

      // Articles needing enrichment: word_count < enrichWordLimit or content < 4000 chars
      const pending = (data || []).filter(p => {
        const wc = p.word_count || 0;
        const contentLen = p.content?.length || 0;
        return wc < customWordLimit * 0.85 || contentLen < 4000;
      });

      setEnrichScan({ count: pending.length, items: pending });
      setEnrichPhase('scanned');
      if (pending.length === 0) {
        toast({ title: '✅ All articles meet the word count target!' });
      }
    } catch (err: any) {
      toast({ title: 'Scan failed', description: err.message, variant: 'destructive' });
      setEnrichPhase('idle');
    }
  }, [customWordLimit, toast]);

  const executeEnrich = useCallback(async () => {
    if (!enrichScan || enrichScan.count === 0) return;
    enrichAbortRef.current = false;
    setEnrichPhase('executing');
    const items = enrichScan.items;
    const total = items.length;
    let done = 0;
    let failed = 0;
    setEnrichProgress({ done: 0, total, failed: 0, current: items[0]?.title || '' });

    for (const post of items) {
      if (enrichAbortRef.current) {
        toast({ title: '⏹️ Enrichment stopped', description: `${done} enriched, ${failed} failed, ${total - done - failed} skipped.` });
        break;
      }
      setEnrichProgress({ done, total, failed, current: post.title });
      try {
        const { error } = await supabase.functions.invoke('improve-blog-content', {
          body: {
            action: 'enrich-article',
            slug: post.slug,
            title: post.title,
            content: post.content,
            category: post.category,
            tags: post.tags,
            targetWordCount: customWordLimit,
            aiModel: blogTextModel,
          },
        });
        if (error) throw error;
        done++;
      } catch (err: any) {
        console.warn(`Enrich failed for "${post.title}":`, err.message);
        failed++;
      }
      setEnrichProgress({ done: done + failed, total, failed, current: post.title });
      if (done + failed < total) await new Promise(r => setTimeout(r, 2000));
    }

    if (!enrichAbortRef.current) {
      toast({ title: '✅ Enrichment complete', description: `${done} enriched, ${failed} failed out of ${total}.` });
    }
    setEnrichPhase('idle');
    setEnrichScan(null);
    setEnrichProgress(null);
    onComplete();
  }, [enrichScan, enrichWordLimit, blogTextModel, toast, onComplete]);

  // ═══════════════════════════════════════════════
  // 2. CREATE PENDING COVER IMAGES
  // ═══════════════════════════════════════════════
  const scanCover = useCallback(async () => {
    setCoverPhase('scanning');
    try {
      const { data, error } = await supabase
        .from('blog_posts')
        .select('id, title, slug, category, tags, cover_image_url')
        .order('created_at', { ascending: false });
      if (error) throw error;

      const pending = (data || []).filter(p => isInvalidImageUrl(p.cover_image_url));
      setCoverScan({ count: pending.length, items: pending });
      setCoverPhase('scanned');
      if (pending.length === 0) {
        toast({ title: '✅ All articles already have valid cover images!' });
      }
    } catch (err: any) {
      toast({ title: 'Scan failed', description: err.message, variant: 'destructive' });
      setCoverPhase('idle');
    }
  }, [toast]);

  const executeCover = useCallback(async () => {
    if (!coverScan || coverScan.count === 0) return;
    coverAbortRef.current = false;
    setCoverPhase('executing');
    const items = coverScan.items;
    const total = items.length;
    let done = 0;
    let failed = 0;
    setCoverProgress({ done: 0, total, failed: 0, current: items[0]?.title || '' });

    for (const post of items) {
      if (coverAbortRef.current) {
        toast({ title: '⏹️ Cover generation stopped', description: `${done} generated, ${failed} failed.` });
        break;
      }
      setCoverProgress({ done, total, failed, current: post.title });
      try {
        const { data: imgData, error: imgError } = await supabase.functions.invoke('generate-vertex-image', {
          body: { slug: post.slug, title: post.title, category: post.category || 'General', tags: post.tags || [], model: coverImageModel, purpose: 'cover', imageCount: 1, aspectRatio: '16:9' },
        });
        if (imgError || !imgData?.data?.images?.[0]?.url) {
          failed++;
          continue;
        }
        await supabase.from('blog_posts').update({
          cover_image_url: imgData.data.images[0].url,
          featured_image_alt: imgData.data.images[0].altText || post.title,
        }).eq('id', post.id);
        done++;
      } catch (err: any) {
        console.warn(`Cover failed for "${post.title}":`, err.message);
        failed++;
      }
      setCoverProgress({ done: done + failed, total, failed, current: post.title });
      if (done + failed < total) await new Promise(r => setTimeout(r, 3000));
    }

    if (!coverAbortRef.current) {
      toast({ title: '🖼️ Cover image generation complete', description: `${done} generated, ${failed} failed out of ${total}.` });
    }
    setCoverPhase('idle');
    setCoverScan(null);
    setCoverProgress(null);
    onComplete();
  }, [coverScan, coverImageModel, toast, onComplete]);

  // ═══════════════════════════════════════════════
  // 3. CREATE PENDING INLINE IMAGES
  // ═══════════════════════════════════════════════
  const scanInline = useCallback(async () => {
    setInlinePhase('scanning');
    try {
      const { data, error } = await supabase
        .from('blog_posts')
        .select('id, title, slug, content, category, tags, article_images')
        .order('created_at', { ascending: false });
      if (error) throw error;

      const pending = (data || []).filter(post => {
        const status = detectInlineSlots(post.content || '', post.article_images);
        return (!status.slot1Filled && status.canPlaceSlot1) || (!status.slot2Filled && status.canPlaceSlot2);
      });

      setInlineScan({ count: pending.length, items: pending });
      setInlinePhase('scanned');
      if (pending.length === 0) {
        toast({ title: '✅ All articles already have inline images!' });
      }
    } catch (err: any) {
      toast({ title: 'Scan failed', description: err.message, variant: 'destructive' });
      setInlinePhase('idle');
    }
  }, [toast]);

  const executeInline = useCallback(async () => {
    if (!inlineScan || inlineScan.count === 0) return;
    inlineAbortRef.current = false;
    setInlinePhase('executing');
    const items = inlineScan.items;
    const total = items.length;
    let done = 0;
    let failed = 0;
    let skipped = 0;
    setInlineProgress({ done: 0, total, failed: 0, skipped: 0, current: items[0]?.title || '' });

    for (const post of items) {
      if (inlineAbortRef.current) {
        toast({ title: '⏹️ Inline generation stopped', description: `${done} done, ${failed} failed, ${skipped} skipped.` });
        break;
      }
      setInlineProgress({ done, total, failed, skipped, current: post.title });
      try {
        const status = detectInlineSlots(post.content || '', post.article_images);
        let updatedContent = post.content || '';
        let updatedImages = post.article_images || {};
        let anySuccess = false;

        if (!status.slot1Filled && status.canPlaceSlot1) {
          const ctx = getContextForSlot(updatedContent, 1, post.title, post.category);
          const { data: imgData, error: imgError } = await supabase.functions.invoke('generate-vertex-image', {
            body: { slug: post.slug, title: post.title, category: post.category || 'General', tags: post.tags || [], model: inlineImageModel, purpose: 'inline', slotNumber: 1, contextSnippet: ctx.nearbyText, nearbyHeading: ctx.nearbyHeading },
          });
          if (!imgError && imgData?.data?.images?.[0]?.url) {
            const result = insertInlineImage(updatedContent, 1, imgData.data.images[0].url, imgData.data.images[0].altText || `${post.title} - illustration`);
            if (result) {
              updatedContent = result;
              updatedImages = buildArticleImagesMetadata(updatedImages, 1, imgData.data.images[0].url, imgData.data.images[0].altText || `${post.title} - illustration`);
              anySuccess = true;
            }
          }
          // Delay between slot 1 and slot 2
          if (!status.slot2Filled && status.canPlaceSlot2) await new Promise(r => setTimeout(r, 3000));
        }

        if (!status.slot2Filled && status.canPlaceSlot2) {
          const ctx = getContextForSlot(updatedContent, 2, post.title, post.category);
          const { data: imgData, error: imgError } = await supabase.functions.invoke('generate-vertex-image', {
            body: { slug: post.slug, title: post.title, category: post.category || 'General', tags: post.tags || [], model: inlineImageModel, purpose: 'inline', slotNumber: 2, contextSnippet: ctx.nearbyText, nearbyHeading: ctx.nearbyHeading },
          });
          if (!imgError && imgData?.data?.images?.[0]?.url) {
            const result = insertInlineImage(updatedContent, 2, imgData.data.images[0].url, imgData.data.images[0].altText || `${post.title} - illustration`);
            if (result) {
              updatedContent = result;
              updatedImages = buildArticleImagesMetadata(updatedImages, 2, imgData.data.images[0].url, imgData.data.images[0].altText || `${post.title} - illustration`);
              anySuccess = true;
            }
          }
        }

        if (anySuccess) {
          await supabase.from('blog_posts').update({ content: updatedContent, article_images: updatedImages }).eq('id', post.id);
          done++;
        } else {
          skipped++;
        }
      } catch (err: any) {
        console.warn(`Inline failed for "${post.title}":`, err.message);
        failed++;
      }
      setInlineProgress({ done: done + failed + skipped, total, failed, skipped, current: post.title });
      if (done + failed + skipped < total) await new Promise(r => setTimeout(r, 3000));
    }

    if (!inlineAbortRef.current) {
      toast({ title: '🖼️ Inline image generation complete', description: `${done} done, ${failed} failed, ${skipped} skipped out of ${total}.` });
    }
    setInlinePhase('idle');
    setInlineScan(null);
    setInlineProgress(null);
    onComplete();
  }, [inlineScan, inlineImageModel, toast, onComplete]);

  // ── Render helper for a pending action button ──
  const renderActionButton = (
    label: string,
    icon: React.ReactNode,
    phase: ScanPhase,
    scan: ScanResult | null,
    progress: { done: number; total: number; failed: number; current: string } | null,
    onScan: () => void,
    onExecute: () => void,
    onStop: () => void,
    color: string,
  ) => {
    const isScanning = phase === 'scanning';
    const isScanned = phase === 'scanned';
    const isExecuting = phase === 'executing';

    return (
      <div className="flex items-center gap-2">
        {phase === 'idle' && (
          <Button variant="outline" size="sm" onClick={onScan} className={`border-${color}/30 hover:bg-${color}/10`}>
            <Search className="h-4 w-4 mr-1" />
            {label}
          </Button>
        )}

        {isScanning && (
          <Button variant="outline" size="sm" disabled>
            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            Scanning…
          </Button>
        )}

        {isScanned && scan && scan.count > 0 && (
          <Button size="sm" onClick={onExecute} className={`bg-${color} hover:bg-${color}/90`}>
            {icon}
            <span className="ml-1">{label} ({scan.count})</span>
          </Button>
        )}

        {isScanned && scan && scan.count === 0 && (
          <Badge variant="secondary" className="text-xs py-1.5 px-3">
            <CheckCircle2 className="h-3.5 w-3.5 mr-1 text-green-600" />
            None pending
          </Badge>
        )}

        {isExecuting && progress && (
          <>
            <div className="flex items-center gap-2 min-w-[250px]">
              <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
              <div className="flex-1 space-y-1">
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span className="truncate max-w-[160px]">{progress.current}</span>
                  <span>{progress.done}/{progress.total}{progress.failed > 0 ? ` (${progress.failed} failed)` : ''}</span>
                </div>
                <Progress value={(progress.done / progress.total) * 100} className="h-1.5" />
              </div>
            </div>
            <Button variant="destructive" size="sm" onClick={onStop}>
              <Square className="h-3.5 w-3.5 mr-1" />Stop
            </Button>
          </>
        )}

        {/* Reset button when scanned */}
        {isScanned && scan && scan.count > 0 && (
          <Button variant="ghost" size="sm" onClick={() => {
            if (label.includes('Enrich')) { setEnrichPhase('idle'); setEnrichScan(null); }
            if (label.includes('Cover')) { setCoverPhase('idle'); setCoverScan(null); }
            if (label.includes('Inline')) { setInlinePhase('idle'); setInlineScan(null); }
          }} className="text-xs text-muted-foreground">
            Reset
          </Button>
        )}
      </div>
    );
  };

  return (
    <div className="px-6 py-3 border-b bg-accent/20">
      <div className="flex items-center gap-2 mb-2">
        <AlertTriangle className="h-4 w-4 text-amber-500" />
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Pending Actions</span>
      </div>
      <div className="flex flex-wrap gap-3">
        {renderActionButton(
          'Enrich Pending Articles',
          <Zap className="h-4 w-4" />,
          enrichPhase, enrichScan, enrichProgress,
          scanEnrich, executeEnrich,
          () => { enrichAbortRef.current = true; },
          'primary',
        )}
        {renderActionButton(
          'Create Pending Cover Images',
          <ImageIcon className="h-4 w-4" />,
          coverPhase, coverScan, coverProgress,
          scanCover, executeCover,
          () => { coverAbortRef.current = true; },
          'primary',
        )}
        {renderActionButton(
          'Create Pending Inline Images',
          <ImageIcon className="h-4 w-4" />,
          inlinePhase, inlineScan, inlineProgress as any,
          scanInline, executeInline,
          () => { inlineAbortRef.current = true; },
          'primary',
        )}
      </div>
    </div>
  );
}
