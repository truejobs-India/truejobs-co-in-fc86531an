import { useState, useEffect } from 'react';
import { ParsedArticle } from '@/lib/blogParser';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { CheckCircle, XCircle, Loader2, AlertTriangle, Copy, Sparkles } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface BulkPublishModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  articles: ParsedArticle[];
  onPublished: (publishedIds: string[]) => void;
}

interface ValidationIssue {
  articleId: string;
  title: string;
  issues: string[];
}

type PublishStatus = 'queued' | 'fixing-meta' | 'publishing' | 'done' | 'failed';

export function BulkPublishModal({ open, onOpenChange, articles, onPublished }: BulkPublishModalProps) {
  const { toast } = useToast();
  const [stage, setStage] = useState<'validation' | 'publishing' | 'complete'>('validation');
  const [statuses, setStatuses] = useState<Record<string, PublishStatus>>({});
  const [publishedUrls, setPublishedUrls] = useState<string[]>([]);
  const [fixedArticles, setFixedArticles] = useState<Record<string, string>>({});

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setStage('validation');
      setStatuses({});
      setPublishedUrls([]);
      setFixedArticles({});
    }
  }, [open]);

  // Identify articles needing meta fix
  const articlesNeedingMetaFix = articles.filter(
    a => !a.metaDescription || a.metaDescription.length > 155
  );

  const validationIssues: ValidationIssue[] = articles.map(a => {
    const issues: string[] = [];
    if (!a.title) issues.push('Missing title');
    if (!a.slug) issues.push('Missing slug');
    if (!a.coverImageUrl) issues.push('Missing cover image');
    if (!a.category || a.category === 'Uncategorized') issues.push('Category not set');
    // Meta description issues are auto-fixable, so not blocking
    return { articleId: a.id, title: a.title, issues };
  });

  const readyArticles = articles.filter(a => {
    const vi = validationIssues.find(v => v.articleId === a.id);
    return !vi || vi.issues.length === 0;
  });
  const issueArticles = validationIssues.filter(v => v.issues.length > 0);

  const handlePublish = async () => {
    setStage('publishing');
    const initial: Record<string, PublishStatus> = {};
    readyArticles.forEach(a => { initial[a.id] = 'queued'; });
    setStatuses(initial);
    const urls: string[] = [];
    const publishedIds: string[] = [];

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast({ title: 'Not authenticated', variant: 'destructive' });
      return;
    }

    // Step 1: Auto-fix meta descriptions using AI for articles that need it
    const needsFix = readyArticles.filter(
      a => !a.metaDescription || a.metaDescription.length > 155
    );

    const aiFixedMetas: Record<string, string> = {};

    if (needsFix.length > 0) {
      needsFix.forEach(a => setStatuses(prev => ({ ...prev, [a.id]: 'fixing-meta' })));

      try {
        const { data, error } = await supabase.functions.invoke('generate-meta-description', {
          body: {
            articles: needsFix.map(a => ({
              id: a.id,
              title: a.title,
              content: a.content.substring(0, 2000),
              existingMeta: a.metaDescription || '',
            })),
          },
        });

        if (!error && data?.results) {
          Object.assign(aiFixedMetas, data.results);
          setFixedArticles(data.results);
        } else {
          console.error('AI meta generation failed:', error);
          // Fallback: smart truncate
          needsFix.forEach(a => {
            if (a.metaDescription && a.metaDescription.length > 155) {
              let fallback = a.metaDescription.substring(0, 152);
              const lastSpace = fallback.lastIndexOf(' ');
              if (lastSpace > 120) fallback = fallback.substring(0, lastSpace);
              aiFixedMetas[a.id] = fallback + '...';
            }
          });
        }
      } catch (err) {
        console.error('Meta fix error:', err);
        // Fallback truncation
        needsFix.forEach(a => {
          if (a.metaDescription && a.metaDescription.length > 155) {
            let fallback = a.metaDescription.substring(0, 152);
            const lastSpace = fallback.lastIndexOf(' ');
            if (lastSpace > 120) fallback = fallback.substring(0, lastSpace);
            aiFixedMetas[a.id] = fallback + '...';
          }
        });
      }
    }

    // Step 2: Publish each article
    for (const article of readyArticles) {
      setStatuses(prev => ({ ...prev, [article.id]: 'publishing' }));
      try {
        let finalSlug = article.slug;
        const { data: existing } = await supabase
          .from('blog_posts')
          .select('slug')
          .like('slug', `${article.slug}%`);
        if (existing && existing.length > 0) {
          const existingSlugs = existing.map(e => e.slug);
          if (existingSlugs.includes(finalSlug)) {
            let counter = 2;
            while (existingSlugs.includes(`${finalSlug}-${counter}`)) counter++;
            finalSlug = `${finalSlug}-${counter}`;
          }
        }

        // Use AI-fixed meta or original (truncated as safety net)
        const finalMeta = aiFixedMetas[article.id]
          || article.metaDescription?.substring(0, 155)
          || '';

        const faqSchemaJson = article.hasFaqSchema && article.faqSchema ? {
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: article.faqSchema.map(f => ({
            '@type': 'Question', name: f.question,
            acceptedAnswer: { '@type': 'Answer', text: f.answer },
          })),
        } : null;

        const { error } = await supabase.from('blog_posts').insert({
          title: article.title,
          slug: finalSlug,
          content: article.content,
          meta_title: article.metaTitle,
          meta_description: finalMeta,
          canonical_url: `https://truejobs.co.in/blog/${finalSlug}`,
          cover_image_url: article.coverImageUrl,
          featured_image_alt: article.coverImageAlt,
          category: article.category,
          tags: article.tags,
          author_name: article.authorName,
          author_id: user.id,
          reading_time: article.readingTime,
          word_count: article.wordCount,
          faq_count: article.faqCount,
          has_faq_schema: article.hasFaqSchema,
          faq_schema: faqSchemaJson,
          article_images: article.articleImages as any,
          internal_links: article.internalLinks as any,
          language: article.language,
          status: 'published',
          is_published: true,
          published_at: new Date().toISOString(),
          excerpt: finalMeta,
        });
        if (error) throw error;
        setStatuses(prev => ({ ...prev, [article.id]: 'done' }));
        urls.push(`https://truejobs.co.in/blog/${finalSlug}`);
        publishedIds.push(article.id);
      } catch (err: any) {
        console.error('Publish failed:', article.slug, err);
        setStatuses(prev => ({ ...prev, [article.id]: 'failed' }));
      }
    }

    setPublishedUrls(urls);
    setStage('complete');
    onPublished(publishedIds);
  };

  const copyUrls = () => {
    navigator.clipboard.writeText(publishedUrls.join('\n'));
    toast({ title: 'URLs copied to clipboard' });
  };

  const publishedCount = Object.values(statuses).filter(s => s === 'done').length;
  const failedCount = Object.values(statuses).filter(s => s === 'failed').length;
  const totalCount = readyArticles.length;
  const progressValue = totalCount > 0 ? ((publishedCount + failedCount) / totalCount) * 100 : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {stage === 'validation' && 'Pre-Publish Validation'}
            {stage === 'publishing' && 'Publishing Articles...'}
            {stage === 'complete' && 'Publishing Complete'}
          </DialogTitle>
        </DialogHeader>

        {stage === 'validation' && (
          <div className="space-y-4">
            <div className="flex gap-2 flex-wrap">
              <Badge variant="default">{readyArticles.length} Ready</Badge>
              {issueArticles.length > 0 && <Badge variant="destructive">{issueArticles.length} Issues</Badge>}
              {articlesNeedingMetaFix.length > 0 && (
                <Badge variant="secondary" className="gap-1">
                  <Sparkles className="h-3 w-3" />
                  {articlesNeedingMetaFix.length} meta will be AI-generated
                </Badge>
              )}
            </div>

            {articlesNeedingMetaFix.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Articles with missing or long meta descriptions will be auto-fixed using AI before publishing.
              </p>
            )}

            {issueArticles.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-destructive">Articles with issues (will be skipped):</p>
                {issueArticles.map(v => (
                  <div key={v.articleId} className="border border-destructive/20 rounded p-2">
                    <p className="text-sm font-medium truncate">{v.title}</p>
                    {v.issues.map((issue, i) => (
                      <p key={i} className="text-xs text-destructive flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" /> {issue}
                      </p>
                    ))}
                  </div>
                ))}
              </div>
            )}
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button onClick={handlePublish} disabled={readyArticles.length === 0}>
                Publish {readyArticles.length} Articles
              </Button>
            </DialogFooter>
          </div>
        )}

        {stage === 'publishing' && (
          <div className="space-y-3">
            <Progress value={progressValue} className="h-2" />
            <p className="text-sm text-muted-foreground">{publishedCount + failedCount} / {totalCount}</p>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {readyArticles.map(a => (
                <div key={a.id} className="flex items-center gap-2 text-sm">
                  {statuses[a.id] === 'done' && <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />}
                  {statuses[a.id] === 'failed' && <XCircle className="h-4 w-4 text-destructive shrink-0" />}
                  {statuses[a.id] === 'publishing' && <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />}
                  {statuses[a.id] === 'fixing-meta' && (
                    <Sparkles className="h-4 w-4 animate-pulse text-amber-500 shrink-0" />
                  )}
                  {statuses[a.id] === 'queued' && <span className="h-4 w-4 rounded-full bg-muted shrink-0" />}
                  <span className="truncate">
                    {statuses[a.id] === 'fixing-meta' ? `Generating meta: ${a.title}` : a.title}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {stage === 'complete' && (
          <div className="space-y-4">
            <div className="text-center">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-2" />
              <p className="text-lg font-semibold">{publishedCount} articles published</p>
              {failedCount > 0 && <p className="text-sm text-destructive">{failedCount} failed</p>}
              {Object.keys(fixedArticles).length > 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  <Sparkles className="h-3 w-3 inline mr-1" />
                  {Object.keys(fixedArticles).length} meta descriptions were AI-generated
                </p>
              )}
            </div>
            {publishedUrls.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-2">Published URLs:</p>
                <div className="bg-muted rounded p-2 max-h-40 overflow-y-auto text-xs font-mono space-y-1">
                  {publishedUrls.map((url, i) => (
                    <div key={i} className="truncate">{url}</div>
                  ))}
                </div>
                <Button variant="outline" size="sm" className="mt-2 gap-1" onClick={copyUrls}>
                  <Copy className="h-3 w-3" /> Copy All URLs
                </Button>
              </div>
            )}
            <DialogFooter>
              <Button onClick={() => { onOpenChange(false); setStage('validation'); }}>Done</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
