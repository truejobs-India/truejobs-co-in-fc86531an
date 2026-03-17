/**
 * ImageGenerationPanel — Reusable top-level panel for generating cover and inline images.
 * Works for Board Results, Custom Pages, and any content with title/slug/content.
 */
import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAdminToast as useToast } from '@/contexts/AdminMessagesContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AiModelSelector } from '@/components/admin/AiModelSelector';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Camera, ImageIcon, Loader2, ChevronDown, Check, AlertCircle, StopCircle } from 'lucide-react';
import {
  detectInlineSlots, insertInlineImage, getContextForSlot,
  buildArticleImagesMetadata,
} from '@/lib/blogInlineImages';

export interface ImageTarget {
  id: string;
  title: string;
  slug: string;
  content: string;
  category?: string | null;
  tags?: string[] | null;
  cover_image_url?: string | null;
  featured_image_alt?: string | null;
}

interface ImageGenerationPanelProps {
  /** Selected rows/pages to generate images for */
  targets: ImageTarget[];
  /** Called after cover image is generated for a target */
  onCoverGenerated: (targetId: string, url: string, alt: string) => Promise<void>;
  /** Called after inline images are inserted into content */
  onInlineGenerated: (targetId: string, newContent: string, articleImages: any) => Promise<void>;
  /** Label for UI context */
  sectionLabel?: string;
}

export function ImageGenerationPanel({
  targets,
  onCoverGenerated,
  onInlineGenerated,
  sectionLabel = 'Selected Pages',
}: ImageGenerationPanelProps) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(true);

  // Model selectors
  const [coverModel, setCoverModel] = useState<string>(() => {
    try { return localStorage.getItem('img_panel_cover_model') || 'gemini-flash-image'; } catch { return 'gemini-flash-image'; }
  });
  const [inlineModel, setInlineModel] = useState<string>(() => {
    try { return localStorage.getItem('img_panel_inline_model') || 'vertex-imagen'; } catch { return 'vertex-imagen'; }
  });

  const handleCoverModelChange = useCallback((v: string) => {
    setCoverModel(v);
    try { localStorage.setItem('img_panel_cover_model', v); } catch {}
  }, []);
  const handleInlineModelChange = useCallback((v: string) => {
    setInlineModel(v);
    try { localStorage.setItem('img_panel_inline_model', v); } catch {}
  }, []);

  // Bulk progress
  const [coverProgress, setCoverProgress] = useState({ running: false, done: 0, total: 0, failed: 0 });
  const [inlineProgress, setInlineProgress] = useState({ running: false, done: 0, total: 0, failed: 0 });
  const stopCoverRef = useRef(false);
  const stopInlineRef = useRef(false);

  // ── Bulk Cover Generation ──
  const handleBulkCover = async () => {
    const eligible = targets.filter(t => t.title && t.slug);
    if (eligible.length === 0) {
      toast({ title: 'No eligible targets', description: 'Select pages with title and slug', variant: 'destructive' });
      return;
    }
    stopCoverRef.current = false;
    setCoverProgress({ running: true, done: 0, total: eligible.length, failed: 0 });

    let done = 0, failed = 0;
    for (const target of eligible) {
      if (stopCoverRef.current) {
        toast({ title: 'Cover generation stopped', description: `Completed ${done}/${eligible.length}` });
        break;
      }
      try {
        const { data, error } = await supabase.functions.invoke('generate-vertex-image', {
          body: {
            slug: target.slug,
            title: target.title,
            category: target.category || 'General',
            tags: target.tags || [],
            model: coverModel,
            purpose: 'cover',
            imageCount: 1,
            aspectRatio: '16:9',
          },
        });
        if (error) throw error;
        if (data?.success === false) throw new Error(data.error || 'Failed');
        const img = data?.data?.images?.[0];
        if (!img?.url) throw new Error('No image returned');
        await onCoverGenerated(target.id, img.url, img.altText || target.title);
        done++;
      } catch (err: any) {
        failed++;
        console.error(`Cover failed for ${target.slug}:`, err.message);
      }
      setCoverProgress(p => ({ ...p, done: done, failed }));
    }

    setCoverProgress(p => ({ ...p, running: false }));
    toast({
      title: 'Cover generation complete',
      description: `${done} succeeded, ${failed} failed out of ${eligible.length}`,
      variant: failed > 0 ? 'destructive' : 'default',
    });
  };

  // ── Bulk Inline Generation ──
  const handleBulkInline = async () => {
    const eligible = targets.filter(t => t.content && t.content.length > 200 && t.slug);
    if (eligible.length === 0) {
      toast({ title: 'No eligible targets', description: 'Select pages with sufficient content', variant: 'destructive' });
      return;
    }
    stopInlineRef.current = false;
    setInlineProgress({ running: true, done: 0, total: eligible.length, failed: 0 });

    let done = 0, failed = 0;
    for (const target of eligible) {
      if (stopInlineRef.current) {
        toast({ title: 'Inline generation stopped', description: `Completed ${done}/${eligible.length}` });
        break;
      }
      try {
        const slotStatus = detectInlineSlots(target.content);
        if (slotStatus.slot1Filled && slotStatus.slot2Filled) {
          done++;
          setInlineProgress(p => ({ ...p, done }));
          continue;
        }

        let updatedContent = target.content;
        let articleImages: any = {};
        let generated = 0;

        // Slot 1
        if (!slotStatus.slot1Filled && slotStatus.canPlaceSlot1) {
          const ctx = getContextForSlot(updatedContent, 1, target.title, target.category);
          const { data, error } = await supabase.functions.invoke('generate-vertex-image', {
            body: {
              slug: target.slug, title: target.title,
              category: target.category || 'General', tags: target.tags || [],
              model: inlineModel, purpose: 'inline', slotNumber: 1,
              contextSnippet: ctx.nearbyText, nearbyHeading: ctx.nearbyHeading,
            },
          });
          if (!error && data?.data?.images?.[0]?.url) {
            const img = data.data.images[0];
            const newHtml = insertInlineImage(updatedContent, 1, img.url, img.altText || target.title);
            if (newHtml) {
              updatedContent = newHtml;
              articleImages = buildArticleImagesMetadata(articleImages, 1, img.url, img.altText || target.title);
              generated++;
            }
          }
        }

        // Slot 2
        if (!slotStatus.slot2Filled && slotStatus.canPlaceSlot2) {
          const ctx = getContextForSlot(updatedContent, 2, target.title, target.category);
          const { data, error } = await supabase.functions.invoke('generate-vertex-image', {
            body: {
              slug: target.slug, title: target.title,
              category: target.category || 'General', tags: target.tags || [],
              model: inlineModel, purpose: 'inline', slotNumber: 2,
              contextSnippet: ctx.nearbyText, nearbyHeading: ctx.nearbyHeading,
            },
          });
          if (!error && data?.data?.images?.[0]?.url) {
            const img = data.data.images[0];
            const newHtml = insertInlineImage(updatedContent, 2, img.url, img.altText || target.title);
            if (newHtml) {
              updatedContent = newHtml;
              articleImages = buildArticleImagesMetadata(articleImages, 2, img.url, img.altText || target.title);
              generated++;
            }
          }
        }

        if (generated > 0) {
          await onInlineGenerated(target.id, updatedContent, articleImages);
        }
        done++;
      } catch (err: any) {
        failed++;
        console.error(`Inline failed for ${target.slug}:`, err.message);
      }
      setInlineProgress(p => ({ ...p, done, failed }));
    }

    setInlineProgress(p => ({ ...p, running: false }));
    toast({
      title: 'Inline image generation complete',
      description: `${done} succeeded, ${failed} failed out of ${eligible.length}`,
      variant: failed > 0 ? 'destructive' : 'default',
    });
  };

  const anyRunning = coverProgress.running || inlineProgress.running;
  const coverEligible = targets.filter(t => t.title && t.slug).length;
  const inlineEligible = targets.filter(t => t.content && t.content.length > 200 && t.slug).length;
  const noCoverCount = targets.filter(t => !t.cover_image_url).length;

  return (
    <Card className="border-primary/20">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardHeader className="py-3 px-4 cursor-pointer" onClick={() => setIsOpen(!isOpen)}>
          <CollapsibleTrigger asChild>
            <CardTitle className="text-sm flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Camera className="h-4 w-4 text-primary" />
                Image Generation — {sectionLabel}
              </span>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[10px]">{targets.length} targets</Badge>
                {noCoverCount > 0 && (
                  <Badge variant="secondary" className="text-[10px] text-amber-600">{noCoverCount} missing cover</Badge>
                )}
                <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
              </div>
            </CardTitle>
          </CollapsibleTrigger>
        </CardHeader>

        <CollapsibleContent>
          <CardContent className="pt-0 space-y-4">
            {targets.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                <AlertCircle className="h-4 w-4 inline mr-1" />
                Select rows/pages first to generate images for them
              </p>
            )}

            {targets.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Cover Image Section */}
                <div className="space-y-2 p-3 rounded-lg border bg-muted/20">
                  <p className="text-xs font-semibold flex items-center gap-1.5">
                    <Camera className="h-3.5 w-3.5 text-primary" />
                    Cover Images (Google Discover · 1200×630 · 16:9)
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    ≥1200px wide · High quality · 16:9 landscape · max-image-preview:large
                  </p>
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <AiModelSelector value={coverModel} onValueChange={handleCoverModelChange} capability="image" size="sm" triggerClassName="w-full h-8 text-xs" />
                    </div>
                    <Button
                      size="sm"
                      className="h-8 text-xs gap-1.5"
                      disabled={anyRunning || coverEligible === 0}
                      onClick={handleBulkCover}
                    >
                      {coverProgress.running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
                      Generate Covers ({coverEligible})
                    </Button>
                  </div>
                  {coverProgress.running && (
                    <div className="flex items-center gap-2 text-xs">
                      <Loader2 className="h-3 w-3 animate-spin text-primary" />
                      <span>{coverProgress.done}/{coverProgress.total}</span>
                      {coverProgress.failed > 0 && <span className="text-destructive">{coverProgress.failed} failed</span>}
                    </div>
                  )}
                  {!coverProgress.running && coverProgress.total > 0 && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Check className="h-3 w-3 text-emerald-600" />
                      Done: {coverProgress.done} covers, {coverProgress.failed} failed
                    </div>
                  )}
                </div>

                {/* Inline Image Section */}
                <div className="space-y-2 p-3 rounded-lg border bg-muted/20">
                  <p className="text-xs font-semibold flex items-center gap-1.5">
                    <ImageIcon className="h-3.5 w-3.5 text-primary" />
                    Inline Images (After Para 1 & 4)
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    Contextual · Compressed · Responsive · Descriptive alt text · 2 per page
                  </p>
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <AiModelSelector value={inlineModel} onValueChange={handleInlineModelChange} capability="image" size="sm" triggerClassName="w-full h-8 text-xs" />
                    </div>
                    <Button
                      size="sm"
                      className="h-8 text-xs gap-1.5"
                      disabled={anyRunning || inlineEligible === 0}
                      onClick={handleBulkInline}
                    >
                      {inlineProgress.running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImageIcon className="h-3.5 w-3.5" />}
                      Generate Inline ({inlineEligible})
                    </Button>
                  </div>
                  {inlineProgress.running && (
                    <div className="flex items-center gap-2 text-xs">
                      <Loader2 className="h-3 w-3 animate-spin text-primary" />
                      <span>{inlineProgress.done}/{inlineProgress.total}</span>
                      {inlineProgress.failed > 0 && <span className="text-destructive">{inlineProgress.failed} failed</span>}
                    </div>
                  )}
                  {!inlineProgress.running && inlineProgress.total > 0 && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Check className="h-3 w-3 text-emerald-600" />
                      Done: {inlineProgress.done} pages, {inlineProgress.failed} failed
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
