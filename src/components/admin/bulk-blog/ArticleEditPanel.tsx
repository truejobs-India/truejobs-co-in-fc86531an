import { useState, useRef } from 'react';
import { ParsedArticle, generateSlug } from '@/lib/blogParser';
import { analyzeQuality, analyzeSEO, type ArticleMetadata } from '@/lib/blogArticleAnalyzer';
import { analyzePublishCompliance, getComplianceReadinessStatus } from '@/lib/blogComplianceAnalyzer';
import { BlogArticleReport } from '../blog/BlogArticleReport';
import { BlogSEOChecklist } from '../blog/BlogSEOChecklist';
import { BlogComplianceChecklist } from '../blog/BlogComplianceChecklist';
import { BlogPolicyWarnings } from '../blog/BlogPolicyWarnings';
import { ComplianceReadinessBadge } from '../blog/ComplianceReadinessBadge';
import { InternalLinkSuggester } from '../blog/InternalLinkSuggester';
import { FeaturedImageGenerator } from '../blog/FeaturedImageGenerator';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Image, Upload, X, CalendarIcon, RefreshCw, CheckCircle, Loader2, ExternalLink, Plus, ChevronDown } from 'lucide-react';
import { format } from 'date-fns';

interface ArticleEditPanelProps {
  article: ParsedArticle;
  onUpdate: (updated: ParsedArticle) => void;
}

const CATEGORIES = [
  'Results & Admit Cards', 'Exam Preparation', 'Sarkari Naukri Basics',
  'Career Guides & Tips', 'Job Information', 'Uncategorized',
];

function parsedToMeta(a: ParsedArticle): ArticleMetadata {
  return {
    title: a.title, slug: a.slug, content: a.content,
    metaTitle: a.metaTitle, metaDescription: a.metaDescription,
    excerpt: a.excerpt, coverImageUrl: a.coverImageUrl || undefined,
    coverImageAlt: a.coverImageAlt || undefined, wordCount: a.wordCount,
    category: a.category, tags: a.tags, faqCount: a.faqCount,
    hasFaqSchema: a.hasFaqSchema, internalLinks: a.internalLinks,
    canonicalUrl: a.canonicalUrl, headings: a.headings,
    hasIntro: a.hasIntro, hasConclusion: a.hasConclusion,
    authorName: a.authorName,
  };
}

export function ArticleEditPanel({ article, onUpdate }: ArticleEditPanelProps) {
  const { toast } = useToast();
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const [isUploadingArticleImg, setIsUploadingArticleImg] = useState(false);
  const [slugChecking, setSlugChecking] = useState(false);
  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null);
  const [tagInput, setTagInput] = useState('');
  const [qualityOpen, setQualityOpen] = useState(false);
  const [seoOpen, setSeoOpen] = useState(false);
  const [linksOpen, setLinksOpen] = useState(false);
  const [complianceOpen, setComplianceOpen] = useState(false);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const articleImgInputRef = useRef<HTMLInputElement>(null);

  const update = (fields: Partial<ParsedArticle>) => {
    onUpdate({ ...article, ...fields });
  };

  // Compute scores
  const meta = parsedToMeta(article);
  const qualityReport = analyzeQuality(meta);
  const seoReport = analyzeSEO(meta);
  const compliance = analyzePublishCompliance(meta);
  const complianceStatus = getComplianceReadinessStatus(compliance, meta);

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingCover(true);
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const path = `articles/${article.slug}/cover.${ext}`;
      const { error } = await supabase.storage.from('blog-assets').upload(path, file, { upsert: true, contentType: file.type });
      if (error) throw error;
      const { data } = supabase.storage.from('blog-assets').getPublicUrl(path);
      update({ coverImageUrl: data.publicUrl, extraction: { ...article.extraction, coverImage: 'green' } });
      toast({ title: 'Cover image uploaded' });
    } catch (err: any) {
      toast({ title: 'Upload failed', description: err.message, variant: 'destructive' });
    } finally {
      setIsUploadingCover(false);
      e.target.value = '';
    }
  };

  const handleArticleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    setIsUploadingArticleImg(true);
    const newImages = [...article.articleImages];
    for (const file of Array.from(files)) {
      const idx = newImages.length + 1;
      const ext = file.name.split('.').pop() || 'jpg';
      const path = `articles/${article.slug}/image-${idx}.${ext}`;
      try {
        const { error } = await supabase.storage.from('blog-assets').upload(path, file, { upsert: true, contentType: file.type });
        if (error) throw error;
        const { data } = supabase.storage.from('blog-assets').getPublicUrl(path);
        newImages.push({ url: data.publicUrl, alt: article.title, insertAfterSection: 'Introduction' });
      } catch (err: any) {
        toast({ title: `Failed: ${file.name}`, description: err.message, variant: 'destructive' });
      }
    }
    update({ articleImages: newImages });
    setIsUploadingArticleImg(false);
    e.target.value = '';
  };

  const checkSlugAvailability = async () => {
    setSlugChecking(true);
    const { data } = await supabase.from('blog_posts').select('id').eq('slug', article.slug).maybeSingle();
    setSlugAvailable(!data);
    setSlugChecking(false);
  };

  const addTag = () => {
    const tag = tagInput.trim();
    if (tag && !article.tags.includes(tag)) update({ tags: [...article.tags, tag] });
    setTagInput('');
  };

  return (
    <div className="space-y-5 p-4 overflow-y-auto max-h-[calc(100vh-200px)]">
      <h3 className="font-semibold text-lg">Edit Article</h3>

      {/* Quality & SEO Summary */}
      <div className="flex gap-2 text-xs">
        <Badge variant={qualityReport.totalScore >= 70 ? 'default' : qualityReport.totalScore >= 50 ? 'secondary' : 'destructive'}>
          Quality: {qualityReport.totalScore}
        </Badge>
        <Badge variant={seoReport.totalScore >= 70 ? 'default' : seoReport.totalScore >= 50 ? 'secondary' : 'destructive'}>
          SEO: {seoReport.totalScore}
        </Badge>
        <ComplianceReadinessBadge status={complianceStatus} />
      </div>

      {/* Collapsible Quality Report */}
      <Collapsible open={qualityOpen} onOpenChange={setQualityOpen}>
        <CollapsibleTrigger className="flex items-center gap-2 w-full py-1 text-sm font-medium hover:text-primary">
          <ChevronDown className={`h-4 w-4 transition-transform ${qualityOpen ? 'rotate-180' : ''}`} />
          Article Quality ({qualityReport.grade})
        </CollapsibleTrigger>
        <CollapsibleContent className="border rounded-lg p-3 mt-1">
          <BlogArticleReport report={qualityReport} />
        </CollapsibleContent>
      </Collapsible>

      {/* Collapsible SEO Checklist */}
      <Collapsible open={seoOpen} onOpenChange={setSeoOpen}>
        <CollapsibleTrigger className="flex items-center gap-2 w-full py-1 text-sm font-medium hover:text-primary">
          <ChevronDown className={`h-4 w-4 transition-transform ${seoOpen ? 'rotate-180' : ''}`} />
          SEO Checklist ({seoReport.totalScore}/100)
        </CollapsibleTrigger>
        <CollapsibleContent className="border rounded-lg p-3 mt-1">
          <BlogSEOChecklist report={seoReport} />
        </CollapsibleContent>
      </Collapsible>

      {/* Collapsible Compliance Report */}
      <Collapsible open={complianceOpen} onOpenChange={setComplianceOpen}>
        <CollapsibleTrigger className="flex items-center gap-2 w-full py-1 text-sm font-medium hover:text-primary">
          <ChevronDown className={`h-4 w-4 transition-transform ${complianceOpen ? 'rotate-180' : ''}`} />
          Compliance & Publish Readiness ({compliance.overallScore}/100)
        </CollapsibleTrigger>
        <CollapsibleContent className="border rounded-lg p-3 mt-1">
          <BlogComplianceChecklist compliance={compliance} />
        </CollapsibleContent>
      </Collapsible>

      <Separator />

      {/* SEO Settings */}
      <section className="space-y-3">
        <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">SEO Settings</h4>
        <div>
          <Label>Page Title (H1)</Label>
          <Input value={article.title} onChange={e => update({ title: e.target.value })} />
        </div>
        <div>
          <div className="flex justify-between">
            <Label>Meta Title</Label>
            <span className={`text-xs ${article.metaTitle.length > 60 ? 'text-destructive' : 'text-muted-foreground'}`}>{article.metaTitle.length}/60</span>
          </div>
          <Input value={article.metaTitle} onChange={e => update({ metaTitle: e.target.value })} maxLength={60} />
        </div>
        <div>
          <div className="flex justify-between">
            <Label>Meta Description</Label>
            <span className={`text-xs ${article.metaDescription.length > 155 ? 'text-destructive' : 'text-muted-foreground'}`}>{article.metaDescription.length}/155</span>
          </div>
          <Textarea value={article.metaDescription} onChange={e => update({ metaDescription: e.target.value })} maxLength={155} rows={2} />
        </div>
        <div>
          <Label>URL Slug</Label>
          <div className="flex gap-2">
            <div className="flex-1">
              <div className="text-xs text-muted-foreground mb-1">truejobs.co.in/blog/</div>
              <Input value={article.slug} onChange={e => { update({ slug: e.target.value, canonicalUrl: `https://truejobs.co.in/blog/${e.target.value}` }); setSlugAvailable(null); }} />
            </div>
            <div className="flex flex-col gap-1 pt-5">
              <Button variant="outline" size="sm" onClick={() => { const s = generateSlug(article.title); update({ slug: s, canonicalUrl: `https://truejobs.co.in/blog/${s}` }); setSlugAvailable(null); }}>
                <RefreshCw className="h-3 w-3" />
              </Button>
              <Button variant="outline" size="sm" onClick={checkSlugAvailability} disabled={slugChecking}>
                {slugChecking ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle className="h-3 w-3" />}
              </Button>
            </div>
          </div>
          {slugAvailable !== null && (
            <p className={`text-xs mt-1 ${slugAvailable ? 'text-green-600' : 'text-destructive'}`}>
              {slugAvailable ? '✅ Slug available' : '❌ Slug already taken'}
            </p>
          )}
        </div>
        <div>
          <Label>Canonical URL</Label>
          <Input value={article.canonicalUrl} onChange={e => update({ canonicalUrl: e.target.value })} className="text-xs" />
        </div>
      </section>

      <Separator />

      {/* Article Settings */}
      <section className="space-y-3">
        <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Article Settings</h4>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Category</Label>
            <Select value={article.category} onValueChange={v => update({ category: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Language</Label>
            <Select value={article.language} onValueChange={v => update({ language: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="hi">Hindi</SelectItem>
                <SelectItem value="en">English</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div>
          <Label>Tags</Label>
          <div className="flex flex-wrap gap-1 mb-2">
            {article.tags.map(t => (
              <Badge key={t} variant="secondary" className="gap-1">
                {t}
                <X className="h-3 w-3 cursor-pointer" onClick={() => update({ tags: article.tags.filter(tag => tag !== t) })} />
              </Badge>
            ))}
          </div>
          <div className="flex gap-2">
            <Input value={tagInput} onChange={e => setTagInput(e.target.value)} placeholder="Add tag" onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addTag())} className="flex-1" />
            <Button variant="outline" size="sm" onClick={addTag}><Plus className="h-3 w-3" /></Button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Author</Label>
            <Input value={article.authorName} onChange={e => update({ authorName: e.target.value })} />
          </div>
          <div>
            <Label>Reading Time</Label>
            <Input value={`~${article.readingTime} min`} disabled className="text-muted-foreground" />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">{article.wordCount.toLocaleString()} words</p>
      </section>

      <Separator />

      {/* Internal Links (Suggestions) */}
      <Collapsible open={linksOpen} onOpenChange={setLinksOpen}>
        <CollapsibleTrigger className="flex items-center gap-2 w-full py-1 text-sm font-medium hover:text-primary">
          <ChevronDown className={`h-4 w-4 transition-transform ${linksOpen ? 'rotate-180' : ''}`} />
          Internal Link Suggestions
        </CollapsibleTrigger>
        <CollapsibleContent className="border rounded-lg p-3 mt-1">
          <InternalLinkSuggester
            content={article.content}
            currentInternalLinks={article.internalLinks.length}
            category={article.category}
            tags={article.tags}
          />
        </CollapsibleContent>
      </Collapsible>

      <Separator />

      {/* Schema & SEO */}
      <section className="space-y-3">
        <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Schema & SEO</h4>
        <div className="flex items-center justify-between">
          <span className="text-sm">FAQ Section detected ({article.faqCount} Q&As)</span>
          <Badge variant={article.faqCount > 0 ? 'default' : 'outline'}>{article.faqCount > 0 ? 'Yes' : 'No'}</Badge>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm">Auto-generate FAQ Schema</span>
          <Switch checked={article.hasFaqSchema} onCheckedChange={v => update({ hasFaqSchema: v })} />
        </div>
      </section>

      <Separator />

      {/* Images */}
      <section className="space-y-3">
        <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Images</h4>
        <div>
          <Label>Cover Image *</Label>
          {article.coverImageUrl ? (
            <div className="relative mt-1">
              <img src={article.coverImageUrl} alt={article.coverImageAlt} className="w-full h-32 object-cover rounded-md" />
              <Button variant="destructive" size="icon" className="absolute top-1 right-1 h-6 w-6" onClick={() => update({ coverImageUrl: '', extraction: { ...article.extraction, coverImage: 'red' } })}>
                <X className="h-3 w-3" />
              </Button>
            </div>
          ) : (
            <Button variant="outline" className="w-full mt-1" onClick={() => coverInputRef.current?.click()} disabled={isUploadingCover}>
              {isUploadingCover ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
              Upload Cover (1200×630)
            </Button>
          )}
          <input ref={coverInputRef} type="file" accept=".jpg,.jpeg,.png,.webp" className="hidden" onChange={handleCoverUpload} />

          {/* AI Image Generator */}
          <div className="mt-2">
            <FeaturedImageGenerator
              slug={article.slug}
              title={article.title}
              category={article.category}
              tags={article.tags}
              currentImageUrl={article.coverImageUrl || undefined}
              onImageGenerated={(url, alt) => update({
                coverImageUrl: url,
                coverImageAlt: alt,
                extraction: { ...article.extraction, coverImage: 'green' },
              })}
            />
          </div>

          <Input value={article.coverImageAlt} onChange={e => update({ coverImageAlt: e.target.value })} placeholder="Cover alt text" className="mt-2" />
        </div>
        <div>
          <Label>Article Images ({article.articleImages.length})</Label>
          {article.articleImages.map((img, i) => (
            <div key={i} className="flex items-center gap-2 mt-2">
              <img src={img.url} alt={img.alt} className="h-12 w-16 object-cover rounded" />
              <Input value={img.alt} onChange={e => {
                const imgs = [...article.articleImages];
                imgs[i] = { ...imgs[i], alt: e.target.value };
                update({ articleImages: imgs });
              }} placeholder="Alt text" className="flex-1 text-xs" />
              <Select value={img.insertAfterSection} onValueChange={v => {
                const imgs = [...article.articleImages];
                imgs[i] = { ...imgs[i], insertAfterSection: v };
                update({ articleImages: imgs });
              }}>
                <SelectTrigger className="w-28 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['Introduction', 'Section 1', 'Section 2', 'Section 3', 'Section 4', 'Conclusion'].map(s => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => update({ articleImages: article.articleImages.filter((_, idx) => idx !== i) })}>
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
          <p className="text-xs text-muted-foreground mt-1">Upload 3–4 in-between images for better engagement</p>
          <Button variant="outline" size="sm" className="mt-2" onClick={() => articleImgInputRef.current?.click()} disabled={isUploadingArticleImg || article.articleImages.length >= 4}>
            {isUploadingArticleImg ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Image className="h-3 w-3 mr-1" />}
            Add Image ({article.articleImages.length}/4)
          </Button>
          <input ref={articleImgInputRef} type="file" accept=".jpg,.jpeg,.png,.webp" multiple className="hidden" onChange={handleArticleImageUpload} />
        </div>
      </section>

      <Separator />

      {/* Publish Settings */}
      <section className="space-y-3">
        <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Publish Settings</h4>
        <div className="flex gap-2">
          {(['draft', 'scheduled', 'published'] as const).map(s => (
            <Button key={s} variant={article.status === s ? 'default' : 'outline'} size="sm" onClick={() => update({ status: s })} className="capitalize">
              {s === 'draft' ? '● Draft' : s === 'scheduled' ? '🕐 Scheduled' : '🚀 Publish Now'}
            </Button>
          ))}
        </div>
        {article.status === 'scheduled' && (
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full justify-start text-left font-normal">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {article.scheduledAt ? format(new Date(article.scheduledAt), 'PPP') : 'Pick a date'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={article.scheduledAt ? new Date(article.scheduledAt) : undefined}
                onSelect={d => update({ scheduledAt: d?.toISOString() || null })}
              />
            </PopoverContent>
          </Popover>
        )}
      </section>
    </div>
  );
}
