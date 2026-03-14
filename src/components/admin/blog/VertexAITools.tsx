/**
 * VertexAITools — Vertex AI powered tools panel for the blog editor.
 * Integrates into the existing BlogPostEditor alongside BlogAITools.
 * Uses Gemini Flash (SEO), Gemini Pro (articles), and Imagen (images) via Vertex AI.
 */
import { useState, useCallback } from 'react';
import { useAdminToast as useToast } from '@/contexts/AdminMessagesContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Sparkles, FileText, ImageIcon, Loader2, ChevronDown, Check, X,
  Copy, Wand2, LayoutList, Tag, Link2, Globe, PenTool, BookOpen,
} from 'lucide-react';
import {
  callSeoHelper,
  callPremiumArticle,
  generateVertexImage,
} from '@/lib/vertexAiClient';
import type { SeoHelperAction, PremiumArticleAction } from '@/types/vertex-ai';

interface VertexAIToolsProps {
  formData: {
    title: string;
    slug: string;
    content: string;
    excerpt: string;
    meta_title: string;
    meta_description: string;
    category?: string | null;
    tags?: string[] | null;
  };
  onApplyField: (field: string, value: string) => void;
  onApplyContent?: (html: string) => void;
  onImageGenerated?: (url: string, alt: string) => void;
}

interface ToolResult {
  data: any;
  model: string;
  action: string;
  elapsedMs: number;
}

export function VertexAITools({ formData, onApplyField, onApplyContent, onImageGenerated }: VertexAIToolsProps) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);
  const [result, setResult] = useState<ToolResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Premium article settings
  const [premiumAction, setPremiumAction] = useState<PremiumArticleAction>('generate-full-article');
  const [desiredWordCount, setDesiredWordCount] = useState(2000);
  const [customTopic, setCustomTopic] = useState('');

  // Image settings
  const [imageStyle, setImageStyle] = useState('modern flat illustration');
  const [imageRatio, setImageRatio] = useState('16:9');

  const runTool = useCallback(async (label: string, fn: () => Promise<any>) => {
    setLoading(label);
    setError(null);
    setResult(null);
    try {
      const response = await fn();
      if (!response.success) {
        throw new Error(response.error || 'Unknown error');
      }
      setResult({
        data: response.data,
        model: response.model,
        action: response.action,
        elapsedMs: response.elapsedMs,
      });
      toast({ title: `${label} complete`, description: `${response.model} — ${response.elapsedMs}ms` });
    } catch (err: any) {
      setError(err.message);
      toast({ title: `${label} failed`, description: err.message, variant: 'destructive' });
    } finally {
      setLoading(null);
    }
  }, [toast]);

  const commonParams = {
    title: formData.title,
    topic: customTopic || formData.title,
    content: formData.content,
    category: formData.category || undefined,
    tags: formData.tags || undefined,
    slug: formData.slug,
    existingMeta: {
      meta_title: formData.meta_title,
      meta_description: formData.meta_description,
      excerpt: formData.excerpt,
    },
  };

  const copyText = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => {
      toast({ title: `${label} copied` });
    });
  };

  const isLoading = loading !== null;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <Button variant="outline" className="w-full justify-between text-xs h-9">
          <span className="flex items-center gap-2">
            <Globe className="h-3.5 w-3.5 text-primary" />
            Vertex AI Tools (Flash · Pro · Imagen)
          </span>
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </Button>
      </CollapsibleTrigger>

      <CollapsibleContent className="mt-2 space-y-3 border rounded-lg p-3 bg-muted/30">
        {/* Optional custom topic */}
        <div className="space-y-1">
          <Label className="text-[10px] text-muted-foreground">Custom Topic (optional — defaults to title)</Label>
          <Input
            value={customTopic}
            onChange={(e) => setCustomTopic(e.target.value)}
            placeholder={formData.title || 'Enter topic...'}
            className="h-7 text-xs"
          />
        </div>

        {/* ── SEO Helper Tools (Gemini Flash) ── */}
        <div className="space-y-1.5">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
            <Wand2 className="h-3 w-3" /> Gemini Flash — SEO Helpers
          </p>
          <div className="grid grid-cols-2 gap-1.5">
            {([
              { action: 'generate-outline' as SeoHelperAction, label: 'Outline', icon: <LayoutList className="h-3 w-3" /> },
              { action: 'generate-faqs' as SeoHelperAction, label: 'FAQs', icon: <FileText className="h-3 w-3" /> },
              { action: 'generate-meta' as SeoHelperAction, label: 'Meta Tags', icon: <Tag className="h-3 w-3" /> },
              { action: 'suggest-tags' as SeoHelperAction, label: 'Tags', icon: <Tag className="h-3 w-3" /> },
              { action: 'suggest-category' as SeoHelperAction, label: 'Category', icon: <BookOpen className="h-3 w-3" /> },
              { action: 'suggest-internal-links' as SeoHelperAction, label: 'Internal Links', icon: <Link2 className="h-3 w-3" /> },
              { action: 'generate-title-variations' as SeoHelperAction, label: 'Title Ideas', icon: <PenTool className="h-3 w-3" /> },
              { action: 'generate-schema-draft' as SeoHelperAction, label: 'Schema', icon: <Globe className="h-3 w-3" /> },
            ]).map(({ action, label, icon }) => (
              <Button
                key={action}
                variant="outline"
                size="sm"
                className="h-7 text-[10px] justify-start gap-1.5"
                disabled={isLoading}
                onClick={() => runTool(label, () => callSeoHelper({ ...commonParams, action }))}
              >
                {loading === label ? <Loader2 className="h-3 w-3 animate-spin" /> : icon}
                {label}
              </Button>
            ))}
          </div>
        </div>

        {/* ── Premium Article Tools (Gemini Pro) ── */}
        <div className="space-y-1.5">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
            <Sparkles className="h-3 w-3" /> Gemini Pro — Premium Article
          </p>
          <div className="flex gap-2 items-center">
            <Select value={premiumAction} onValueChange={(v) => setPremiumAction(v as PremiumArticleAction)}>
              <SelectTrigger className="h-7 text-[10px] flex-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="generate-full-article">Generate Full Article</SelectItem>
                <SelectItem value="rewrite-article">Rewrite Article</SelectItem>
                <SelectItem value="polish-article">Polish Article</SelectItem>
                <SelectItem value="expand-article">Expand Article</SelectItem>
                <SelectItem value="generate-final-seo-package">Final SEO Package</SelectItem>
              </SelectContent>
            </Select>
            <Input
              type="number"
              value={desiredWordCount}
              onChange={(e) => setDesiredWordCount(Number(e.target.value))}
              className="w-20 h-7 text-[10px]"
              min={500}
              max={5000}
            />
            <Button
              size="sm"
              className="h-7 text-[10px]"
              disabled={isLoading}
              onClick={() => runTool('Premium Article', () => callPremiumArticle({
                ...commonParams,
                action: premiumAction,
                desiredWordCount,
                existingContent: formData.content,
              }))}
            >
              {loading === 'Premium Article' ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Sparkles className="h-3 w-3 mr-1" />}
              Run
            </Button>
          </div>
        </div>

        {/* ── Imagen (Image Generation) ── */}
        <div className="space-y-1.5">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
            <ImageIcon className="h-3 w-3" /> Imagen — Featured Image
          </p>
          <div className="flex gap-2 items-center">
            <Select value={imageStyle} onValueChange={setImageStyle}>
              <SelectTrigger className="h-7 text-[10px] flex-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="modern flat illustration">Flat Illustration</SelectItem>
                <SelectItem value="professional photography style">Photography</SelectItem>
                <SelectItem value="clean infographic style">Infographic</SelectItem>
                <SelectItem value="abstract editorial art">Abstract Art</SelectItem>
                <SelectItem value="minimalist icon style">Minimalist</SelectItem>
              </SelectContent>
            </Select>
            <Select value={imageRatio} onValueChange={setImageRatio}>
              <SelectTrigger className="h-7 text-[10px] w-20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="16:9">16:9</SelectItem>
                <SelectItem value="4:3">4:3</SelectItem>
                <SelectItem value="1:1">1:1</SelectItem>
              </SelectContent>
            </Select>
            <Button
              size="sm"
              className="h-7 text-[10px]"
              disabled={isLoading}
              onClick={() => runTool('Generate Image', () => generateVertexImage({
                title: formData.title,
                topic: customTopic || formData.title,
                excerpt: formData.excerpt,
                category: formData.category || undefined,
                tags: formData.tags || undefined,
                slug: formData.slug,
                visualStyle: imageStyle,
                aspectRatio: imageRatio as any,
              }))}
            >
              {loading === 'Generate Image' ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <ImageIcon className="h-3 w-3 mr-1" />}
              Generate
            </Button>
          </div>
        </div>

        {/* ── Error display ── */}
        {error && (
          <div className="text-xs text-destructive bg-destructive/10 rounded p-2">
            <strong>Error:</strong> {error}
          </div>
        )}

        {/* ── Result display ── */}
        {result && (
          <div className="space-y-2 border-t pt-2">
            <div className="flex items-center justify-between">
              <Badge variant="outline" className="text-[9px]">
                {result.model} · {result.action} · {result.elapsedMs}ms
              </Badge>
              <Button variant="ghost" size="sm" className="h-5 text-[10px] p-0" onClick={() => setResult(null)}>
                <X className="h-3 w-3" />
              </Button>
            </div>

            {/* ── Meta results (apply buttons) ── */}
            {result.data?.meta_title && (
              <ResultField
                label="Meta Title"
                value={result.data.meta_title}
                onApply={() => onApplyField('meta_title', result.data.meta_title)}
                onCopy={() => copyText(result.data.meta_title, 'Meta title')}
              />
            )}
            {result.data?.meta_description && (
              <ResultField
                label="Meta Description"
                value={result.data.meta_description}
                onApply={() => onApplyField('meta_description', result.data.meta_description)}
                onCopy={() => copyText(result.data.meta_description, 'Meta description')}
              />
            )}
            {result.data?.excerpt && (
              <ResultField
                label="Excerpt"
                value={result.data.excerpt}
                onApply={() => onApplyField('excerpt', result.data.excerpt)}
                onCopy={() => copyText(result.data.excerpt, 'Excerpt')}
              />
            )}
            {result.data?.title && result.action !== 'generate-meta' && (
              <ResultField
                label="Title"
                value={result.data.title}
                onApply={() => onApplyField('title', result.data.title)}
                onCopy={() => copyText(result.data.title, 'Title')}
              />
            )}

            {/* ── Title variations ── */}
            {result.data?.variations && Array.isArray(result.data.variations) && (
              <div className="space-y-1">
                <p className="text-[10px] font-medium text-muted-foreground">Title Variations</p>
                {result.data.variations.map((v: any, i: number) => (
                  <div key={i} className="flex items-center gap-1 text-xs bg-background rounded p-1.5">
                    <Badge variant="secondary" className="text-[9px] shrink-0">{v.style}</Badge>
                    <span className="flex-1 truncate">{v.title}</span>
                    <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={() => onApplyField('title', v.title)}>
                      <Check className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {/* ── Outline ── */}
            {result.data?.outline && Array.isArray(result.data.outline) && (
              <div className="space-y-1">
                <p className="text-[10px] font-medium text-muted-foreground">
                  Article Outline ({result.data.estimatedWordCount || '?'} words est.)
                </p>
                <ScrollArea className="max-h-[200px]">
                  {result.data.outline.map((s: any, i: number) => (
                    <div key={i} className="text-xs mb-1">
                      <strong className="text-foreground">{i + 1}. {s.heading}</strong>
                      {s.subheadings?.map((sub: string, j: number) => (
                        <div key={j} className="ml-4 text-muted-foreground">— {sub}</div>
                      ))}
                      {s.notes && <div className="ml-4 text-[10px] text-muted-foreground/60 italic">{s.notes}</div>}
                    </div>
                  ))}
                </ScrollArea>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-6 text-[10px]"
                  onClick={() => copyText(JSON.stringify(result.data.outline, null, 2), 'Outline')}
                >
                  <Copy className="h-3 w-3 mr-1" /> Copy Outline JSON
                </Button>
              </div>
            )}

            {/* ── FAQs ── */}
            {result.data?.faqs && Array.isArray(result.data.faqs) && (
              <div className="space-y-1">
                <p className="text-[10px] font-medium text-muted-foreground">FAQs ({result.data.faqs.length})</p>
                <ScrollArea className="max-h-[200px]">
                  {result.data.faqs.map((faq: any, i: number) => (
                    <div key={i} className="text-xs mb-2 bg-background rounded p-1.5">
                      <strong>Q: {faq.question}</strong>
                      <p className="text-muted-foreground mt-0.5">{faq.answer}</p>
                    </div>
                  ))}
                </ScrollArea>
              </div>
            )}

            {/* ── Tags ── */}
            {result.data?.suggestedTags && Array.isArray(result.data.suggestedTags) && (
              <div className="space-y-1">
                <p className="text-[10px] font-medium text-muted-foreground">Suggested Tags</p>
                <div className="flex flex-wrap gap-1">
                  {result.data.suggestedTags.map((tag: string, i: number) => (
                    <Badge key={i} variant="secondary" className="text-[10px]">{tag}</Badge>
                  ))}
                </div>
                {result.data.reasoning && (
                  <p className="text-[10px] text-muted-foreground italic">{result.data.reasoning}</p>
                )}
              </div>
            )}

            {/* ── Category ── */}
            {result.data?.suggestedCategory && (
              <div className="space-y-1">
                <p className="text-[10px] font-medium text-muted-foreground">Suggested Category</p>
                <div className="flex items-center gap-2">
                  <Badge>{result.data.suggestedCategory}</Badge>
                  {result.data.alternatives?.map((alt: string, i: number) => (
                    <Badge key={i} variant="outline" className="text-[10px]">{alt}</Badge>
                  ))}
                </div>
              </div>
            )}

            {/* ── Internal Links ── */}
            {result.data?.links && Array.isArray(result.data.links) && (
              <div className="space-y-1">
                <p className="text-[10px] font-medium text-muted-foreground">Internal Links</p>
                {result.data.links.map((link: any, i: number) => (
                  <div key={i} className="text-xs bg-background rounded p-1.5">
                    <span className="font-mono text-primary">/{link.slug}</span>
                    <span className="text-muted-foreground ml-2">"{link.anchorText}"</span>
                    <span className="text-[10px] text-muted-foreground/60 ml-1">— {link.reason}</span>
                  </div>
                ))}
              </div>
            )}

            {/* ── Full article content ── */}
            {result.data?.content_html && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-medium text-muted-foreground">
                    Article Content ({result.data.word_count || '?'} words)
                  </p>
                  <div className="flex gap-1">
                    <Button
                      variant="default"
                      size="sm"
                      className="h-6 text-[10px]"
                      onClick={() => {
                        if (onApplyContent) onApplyContent(result.data.content_html);
                        toast({ title: 'Article content applied to editor' });
                      }}
                    >
                      <Check className="h-3 w-3 mr-1" /> Apply to Editor
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-6 text-[10px]"
                      onClick={() => copyText(result.data.content_html, 'Article HTML')}
                    >
                      <Copy className="h-3 w-3 mr-1" /> Copy HTML
                    </Button>
                  </div>
                </div>
                <ScrollArea className="max-h-[300px] border rounded p-2 bg-background">
                  <div className="prose prose-sm max-w-none text-xs" dangerouslySetInnerHTML={{ __html: result.data.content_html }} />
                </ScrollArea>
              </div>
            )}

            {/* ── FAQ items from article ── */}
            {result.data?.faq_items && Array.isArray(result.data.faq_items) && result.data.faq_items.length > 0 && (
              <div className="space-y-1">
                <p className="text-[10px] font-medium text-muted-foreground">Generated FAQs ({result.data.faq_items.length})</p>
                <ScrollArea className="max-h-[150px]">
                  {result.data.faq_items.map((faq: any, i: number) => (
                    <div key={i} className="text-xs mb-1.5 bg-background rounded p-1.5">
                      <strong>Q: {faq.question}</strong>
                      <p className="text-muted-foreground mt-0.5">{faq.answer}</p>
                    </div>
                  ))}
                </ScrollArea>
              </div>
            )}

            {/* ── Image generation results ── */}
            {result.data?.images && Array.isArray(result.data.images) && (
              <div className="space-y-1.5">
                <p className="text-[10px] font-medium text-muted-foreground">
                  Generated Images ({result.data.images.length})
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {result.data.images.map((img: any, i: number) => (
                    <div key={i} className="space-y-1">
                      <img
                        src={img.url}
                        alt={img.altText}
                        className="w-full rounded border object-cover"
                        style={{ aspectRatio: imageRatio.replace(':', '/') }}
                      />
                      <div className="flex gap-1">
                        <Button
                          variant="default"
                          size="sm"
                          className="h-5 text-[9px] flex-1"
                          onClick={() => {
                            if (onImageGenerated) onImageGenerated(img.url, img.altText);
                            toast({ title: 'Image applied as cover' });
                          }}
                        >
                          <Check className="h-3 w-3 mr-0.5" /> Use as Cover
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-5 text-[9px]"
                          onClick={() => copyText(img.url, 'Image URL')}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-muted-foreground italic">
                  Prompt: {result.data.promptUsed?.substring(0, 100)}...
                </p>
              </div>
            )}

            {/* ── Schema draft ── */}
            {result.data?.schemaJson && (
              <div className="space-y-1">
                <p className="text-[10px] font-medium text-muted-foreground">Schema ({result.data.schemaType})</p>
                <ScrollArea className="max-h-[150px] font-mono text-[10px] bg-background rounded p-2 border">
                  <pre>{JSON.stringify(result.data.schemaJson, null, 2)}</pre>
                </ScrollArea>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-6 text-[10px]"
                  onClick={() => copyText(JSON.stringify(result.data.schemaJson, null, 2), 'Schema JSON')}
                >
                  <Copy className="h-3 w-3 mr-1" /> Copy Schema
                </Button>
              </div>
            )}

            {/* ── Rewritten copy ── */}
            {result.data?.rewrittenCopy && (
              <ResultField
                label={`Rewritten Copy (${result.data.charCount} chars)`}
                value={result.data.rewrittenCopy}
                onApply={() => copyText(result.data.rewrittenCopy, 'Rewritten copy')}
                onCopy={() => copyText(result.data.rewrittenCopy, 'Rewritten copy')}
                multiline
              />
            )}

            {/* ── Keyword clusters ── */}
            {result.data?.clusters && Array.isArray(result.data.clusters) && (
              <div className="space-y-1">
                <p className="text-[10px] font-medium text-muted-foreground">Keyword Clusters</p>
                {result.data.clusters.map((cluster: any, i: number) => (
                  <div key={i} className="text-xs bg-background rounded p-1.5 mb-1">
                    <div className="flex items-center gap-1">
                      <strong>{cluster.name}</strong>
                      <Badge variant="outline" className="text-[9px]">{cluster.intent}</Badge>
                    </div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {cluster.keywords.map((kw: string, j: number) => (
                        <Badge key={j} variant="secondary" className="text-[9px]">{kw}</Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ── Notes from article generation ── */}
            {result.data?.notes && (
              <p className="text-[10px] text-muted-foreground italic bg-muted/50 rounded p-1.5">
                📝 {result.data.notes}
              </p>
            )}

            {/* ── Image prompt suggestion ── */}
            {result.data?.image_prompt && (
              <div className="text-[10px] text-muted-foreground bg-muted/50 rounded p-1.5">
                🎨 <strong>Image prompt:</strong> {result.data.image_prompt}
              </div>
            )}
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}

// ── Reusable result field with Apply/Copy ──
function ResultField({ label, value, onApply, onCopy, multiline }: {
  label: string; value: string; onApply: () => void; onCopy: () => void; multiline?: boolean;
}) {
  return (
    <div className="space-y-0.5">
      <p className="text-[10px] font-medium text-muted-foreground">{label}</p>
      <div className="flex items-start gap-1">
        <span className={`text-xs flex-1 bg-background rounded p-1.5 ${multiline ? 'whitespace-pre-wrap' : 'truncate'}`}>
          {value}
        </span>
        <Button variant="ghost" size="sm" className="h-5 w-5 p-0 shrink-0" onClick={onApply} title="Apply">
          <Check className="h-3 w-3" />
        </Button>
        <Button variant="ghost" size="sm" className="h-5 w-5 p-0 shrink-0" onClick={onCopy} title="Copy">
          <Copy className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}
