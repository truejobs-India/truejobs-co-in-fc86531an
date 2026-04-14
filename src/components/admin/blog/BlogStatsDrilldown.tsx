import { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Loader2, Edit, Sparkles, CheckCircle2, XCircle, Square } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { blogPostToMetadata } from '@/lib/blogArticleAnalyzer';
import { analyzePublishCompliance, getComplianceReadinessStatus } from '@/lib/blogComplianceAnalyzer';
import { useAdminToast as useToast } from '@/contexts/AdminMessagesContext';
import { useSeoMetadataWorkflow, type SeoFixResult } from '@/hooks/useSeoMetadataWorkflow';
import { supabase } from '@/integrations/supabase/client';
import { AiModelSelector, getLastUsedModel } from '@/components/admin/AiModelSelector';

export type DrilldownFilter =
  | 'published' | 'drafts' | 'this-week' | 'missing-seo'
  | 'no-cover' | 'blocked' | 'needs-review' | 'no-author' | 'policy-risk';

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  content: string;
  excerpt: string | null;
  cover_image_url: string | null;
  featured_image_alt: string | null;
  is_published: boolean;
  published_at: string | null;
  meta_title: string | null;
  meta_description: string | null;
  created_at: string;
  updated_at: string;
  word_count: number | null;
  author_name: string | null;
  faq_count: number | null;
  has_faq_schema: boolean | null;
  internal_links: any;
  canonical_url: string | null;
  category: string | null;
  tags: string[] | null;
}

interface DrilldownArticle {
  post: BlogPost;
  reasons: string[];
  complianceStatus?: string;
}

const FILTER_LABELS: Record<DrilldownFilter, string> = {
  'published': 'Published Articles',
  'drafts': 'Draft Articles',
  'this-week': 'Published This Week',
  'missing-seo': 'Missing SEO Metadata',
  'no-cover': 'No Cover Image',
  'blocked': 'Blocked from Publishing',
  'needs-review': 'Needs Review',
  'no-author': 'Missing Author',
  'policy-risk': 'Policy Risk',
};

// Which issue cards support AI auto-fix
const AI_FIX_FILTERS: Record<string, { label: string; description: string; supported: boolean }> = {
  'missing-seo': {
    label: 'Auto Fix SEO by AI',
    description: 'Generate missing/weak meta titles, descriptions, slugs using Gemini 2.5 Pro',
    supported: true,
  },
  'no-cover': {
    label: 'Generate Cover Images',
    description: 'Use existing image generation workflow to create cover images',
    supported: false, // Route to existing image generator, not text AI
  },
  'needs-review': {
    label: 'Auto Fix by AI',
    description: 'Fix compliance issues where AI text revision is appropriate',
    supported: true,
  },
  'no-author': {
    label: 'Set Default Author',
    description: 'Assign the default author name to articles missing author attribution',
    supported: true, // Rule-based, not AI
  },
  'policy-risk': {
    label: 'Auto Fix by AI',
    description: 'Fix policy/compliance issues where safe structured fixes are available',
    supported: true,
  },
};

function getArticleReasons(post: BlogPost, filter: DrilldownFilter): string[] {
  const reasons: string[] = [];
  switch (filter) {
    case 'published':
      reasons.push('Published');
      break;
    case 'drafts':
      reasons.push('Draft — not published');
      break;
    case 'this-week':
      reasons.push('Published in the last 7 days');
      break;
    case 'missing-seo': {
      if (!post.meta_title) reasons.push('Missing meta title');
      if (!post.meta_description) reasons.push('Missing meta description');
      if (!post.excerpt) reasons.push('Missing excerpt');
      if (reasons.length === 0) reasons.push('SEO fields incomplete');
      break;
    }
    case 'no-cover':
      reasons.push('No cover image set');
      break;
    case 'no-author':
      reasons.push('Missing author metadata');
      break;
    case 'blocked':
    case 'needs-review':
    case 'policy-risk': {
      const meta = blogPostToMetadata(post);
      const compliance = analyzePublishCompliance(meta);
      const failChecks = compliance.checks.filter(c =>
        filter === 'policy-risk'
          ? c.category === 'adsense-safety' && c.status === 'fail'
          : c.status === (filter === 'blocked' ? 'fail' : 'warn')
      );
      failChecks.slice(0, 3).forEach(c => reasons.push(c.label + ': ' + c.detail));
      if (reasons.length === 0) reasons.push(filter === 'blocked' ? 'Critical compliance failures' : 'Compliance warnings present');
      break;
    }
  }
  return reasons;
}

const COMPLIANCE_FILTERS: DrilldownFilter[] = ['blocked', 'needs-review', 'policy-risk'];

function filterPostsSync(posts: BlogPost[], filter: DrilldownFilter): DrilldownArticle[] {
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  return posts
    .filter(post => {
      switch (filter) {
        case 'published': return post.is_published;
        case 'drafts': return !post.is_published;
        case 'this-week': return post.published_at && new Date(post.published_at) > weekAgo;
        case 'missing-seo': return !post.meta_title || !post.meta_description;
        case 'no-cover': return !post.cover_image_url;
        case 'no-author': return !post.author_name;
        default: return false;
      }
    })
    .map(post => ({
      post,
      reasons: getArticleReasons(post, filter),
    }));
}

function filterPostsWithContent(posts: BlogPost[], contentMap: Map<string, string>, filter: DrilldownFilter): DrilldownArticle[] {
  return posts
    .filter(post => {
      const enriched = { ...post, content: contentMap.get(post.id) || post.content };
      const meta = blogPostToMetadata(enriched);
      const compliance = analyzePublishCompliance(meta);
      const status = getComplianceReadinessStatus(compliance, meta);
      if (filter === 'blocked') return status === 'Blocked';
      if (filter === 'needs-review') return status === 'Needs Review';
      return compliance.checks.some(c => c.category === 'adsense-safety' && c.status === 'fail');
    })
    .map(post => {
      const enriched = { ...post, content: contentMap.get(post.id) || post.content };
      return { post, reasons: getArticleReasons(enriched, filter) };
    });
}

/** Batch-fetch content for all blog posts, paginated in 1000-row chunks */
async function fetchAllPostContent(): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  let from = 0;
  const PAGE_SIZE = 1000;
  while (true) {
    const { data } = await supabase
      .from('blog_posts')
      .select('id, content')
      .range(from, from + PAGE_SIZE - 1);
    if (!data || data.length === 0) break;
    for (const row of data) {
      map.set(row.id, row.content);
    }
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return map;
}

interface BlogStatsDrilldownProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filter: DrilldownFilter | null;
  posts: BlogPost[];
  onEditPost: (post: BlogPost) => void;
  onRefresh?: () => void;
}

export function BlogStatsDrilldown({ open, onOpenChange, filter, posts, onEditPost, onRefresh }: BlogStatsDrilldownProps) {
  const { toast } = useToast();
  const [complianceArticles, setComplianceArticles] = useState<DrilldownArticle[]>([]);
  const [complianceLoading, setComplianceLoading] = useState(false);

  const isComplianceFilter = filter ? COMPLIANCE_FILTERS.includes(filter) : false;

  // Sync filtering for non-compliance filters
  const syncArticles = useMemo(() => {
    if (!filter || isComplianceFilter) return [];
    return filterPostsSync(posts, filter);
  }, [posts, filter, isComplianceFilter]);

  // Async content fetch + filtering for compliance filters
  useEffect(() => {
    if (!open || !filter || !isComplianceFilter) {
      setComplianceArticles([]);
      return;
    }
    let cancelled = false;
    setComplianceLoading(true);
    fetchAllPostContent().then(contentMap => {
      if (cancelled) return;
      const results = filterPostsWithContent(posts, contentMap, filter);
      setComplianceArticles(results);
      setComplianceLoading(false);
    }).catch(() => {
      if (!cancelled) {
        setComplianceLoading(false);
        toast({ title: 'Failed to load article content for compliance check', variant: 'destructive' });
      }
    });
    return () => { cancelled = true; };
  }, [open, filter, posts, isComplianceFilter]);

  const articles = isComplianceFilter ? complianceArticles : syncArticles;

  const { fixSingleArticle } = useSeoMetadataWorkflow();

  // AI fix state
  const [bulkFixing, setBulkFixing] = useState(false);
  const [fixingIds, setFixingIds] = useState<Set<string>>(new Set());
  const [fixResults, setFixResults] = useState<Map<string, SeoFixResult>>(new Map());
  const [aiModel, setAiModel] = useState(() => getLastUsedModel('text', ''));

  // Fetch full content from DB (editor state has content:'')
  const fetchPostContent = useCallback(async (postId: string): Promise<string> => {
    const { data } = await supabase.from('blog_posts').select('content').eq('id', postId).single();
    return data?.content || '';
  }, []);

  // Per-article AI fix (for missing-seo)
  const handleFixSingleSeo = useCallback(async (post: BlogPost) => {
    if (!aiModel) {
      toast({ title: 'Select an AI model first', variant: 'destructive' });
      return;
    }
    setFixingIds(prev => new Set([...prev, post.id]));
    try {
      const content = await fetchPostContent(post.id);
      const postWithContent = { ...post, content };
      const result = await fixSingleArticle(postWithContent, aiModel);
      if (result) {
        setFixResults(prev => new Map(prev).set(post.id, result));
        toast({
          title: result.status === 'fixed' ? '✅ SEO metadata fixed' : result.status === 'skipped' ? 'Skipped' : '❌ Fix failed',
          description: result.reason,
          variant: result.status === 'failed' ? 'destructive' : 'default',
        });
      }
    } catch (err: any) {
      toast({ title: 'Fix failed', description: err.message, variant: 'destructive' });
    } finally {
      setFixingIds(prev => { const n = new Set(prev); n.delete(post.id); return n; });
    }
  }, [fixSingleArticle, toast, aiModel, fetchPostContent]);

  // Bulk AI fix for all articles in current filter
  const handleBulkFix = useCallback(async () => {
    if (!filter) return;
    if ((filter === 'missing-seo' || filter === 'needs-review' || filter === 'policy-risk') && !aiModel) {
      toast({ title: 'Select an AI model first', variant: 'destructive' });
      return;
    }
    setBulkFixing(true);
    let fixedCount = 0, failedCount = 0;

    if (filter === 'missing-seo') {
      for (const { post } of articles) {
        if (fixResults.get(post.id)?.status === 'fixed') continue;
        setFixingIds(prev => new Set([...prev, post.id]));
        try {
          const content = await fetchPostContent(post.id);
          const result = await fixSingleArticle({ ...post, content }, aiModel);
          if (result) {
            setFixResults(prev => new Map(prev).set(post.id, result));
            if (result.status === 'fixed') fixedCount++;
            else failedCount++;
          }
        } catch {
          failedCount++;
        } finally {
          setFixingIds(prev => { const n = new Set(prev); n.delete(post.id); return n; });
        }
        await new Promise(r => setTimeout(r, 2000));
      }
      toast({
        title: `✅ Bulk SEO fix complete`,
        description: `${fixedCount} fixed, ${failedCount} failed out of ${articles.length}`,
        variant: failedCount > 0 && fixedCount === 0 ? 'destructive' : 'default',
      });
    } else if (filter === 'no-author') {
      const DEFAULT_AUTHOR = 'TrueJobs Editorial';
      const ids = articles.map(a => a.post.id);
      for (const id of ids) {
        await supabase.from('blog_posts').update({ author_name: DEFAULT_AUTHOR }).eq('id', id);
      }
      toast({ title: `✅ Set author "${DEFAULT_AUTHOR}" for ${ids.length} articles` });
    } else if (filter === 'policy-risk' || filter === 'needs-review') {
      for (const { post, reasons } of articles) {
        if (fixResults.get(post.id)?.status === 'fixed') continue;
        setFixingIds(prev => new Set([...prev, post.id]));
        try {
          const content = await fetchPostContent(post.id);
          const { data, error } = await supabase.functions.invoke('improve-blog-content', {
            body: {
              title: post.title,
              content,
              action: 'enrich-article',
              aiModel,
              wordCount: content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().split(/\s+/).length,
              targetWordCount: 0, // let the function compute dynamic target
              category: post.category || 'General',
              tags: post.tags || [],
              failingCriteria: reasons, // pass compliance issues as failing criteria
            },
          });
          if (error) throw error;
          if (data?.error) throw new Error(data.error);
          if (data?.result && data.result.length > 100) {
            await supabase.from('blog_posts')
              .update({ content: data.result, updated_at: new Date().toISOString() })
              .eq('id', post.id);
            setFixResults(prev => new Map(prev).set(post.id, {
              id: post.id, slug: post.slug, status: 'fixed',
              reason: `Fixed ${reasons.length} compliance issue(s)`,
              changes: {}, ai_summary: '',
            }));
            fixedCount++;
          } else {
            setFixResults(prev => new Map(prev).set(post.id, {
              id: post.id, slug: post.slug, status: 'skipped', reason: 'No usable changes from AI',
              changes: {}, ai_summary: '',
            }));
          }
        } catch (err: any) {
          failedCount++;
          setFixResults(prev => new Map(prev).set(post.id, {
            id: post.id, slug: post.slug, status: 'failed', reason: err.message || 'Unknown error',
            changes: {}, ai_summary: '',
          }));
        } finally {
          setFixingIds(prev => { const n = new Set(prev); n.delete(post.id); return n; });
        }
        await new Promise(r => setTimeout(r, 2000));
      }
      toast({
        title: `✅ Compliance fix complete`,
        description: `${fixedCount} fixed, ${failedCount} failed out of ${articles.length}`,
        variant: failedCount > 0 && fixedCount === 0 ? 'destructive' : 'default',
      });
    }

    setBulkFixing(false);
    onRefresh?.();
  }, [filter, articles, fixSingleArticle, fixResults, toast, onRefresh, aiModel, fetchPostContent]);

  if (!filter) return null;

  const aiFixConfig = AI_FIX_FILTERS[filter];
  const showAiActions = !!aiFixConfig && articles.length > 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{FILTER_LABELS[filter]}</SheetTitle>
          <SheetDescription>
            {complianceLoading
              ? 'Loading article content for compliance analysis…'
              : `${articles.length} article${articles.length !== 1 ? 's' : ''} found`}
          </SheetDescription>
        </SheetHeader>

        {/* Compliance loading spinner */}
        {complianceLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-sm text-muted-foreground">Fetching content for compliance checks…</span>
          </div>
        )}

        {/* AI Fix Action Bar */}
        {!complianceLoading && showAiActions && (
          <div className="mt-3 p-3 border rounded-lg bg-muted/50 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-sm font-medium flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4 text-primary" />
                  {aiFixConfig.label}
                </p>
                <p className="text-xs text-muted-foreground">{aiFixConfig.description}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {aiFixConfig.supported && (filter === 'missing-seo' || filter === 'needs-review' || filter === 'policy-risk') && (
                  <AiModelSelector
                    value={aiModel}
                    onValueChange={setAiModel}
                    capability="text"
                    size="sm"
                  />
                )}
                {aiFixConfig.supported && (
                  <Button
                    size="sm"
                    onClick={handleBulkFix}
                    disabled={bulkFixing || (aiFixConfig.supported && (filter === 'missing-seo' || filter === 'needs-review' || filter === 'policy-risk') && !aiModel)}
                    className="shrink-0"
                  >
                    {bulkFixing ? (
                      <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Fixing…</>
                    ) : (
                      <><Sparkles className="h-3 w-3 mr-1" /> Fix All ({articles.length})</>
                    )}
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}

        {!complianceLoading && <div className="mt-4">
          {articles.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No articles match this filter.</p>
          ) : (
            <div className="space-y-2">
              {articles.map(({ post, reasons }) => {
                const isFixing = fixingIds.has(post.id);
                const result = fixResults.get(post.id);

                return (
                  <div
                    key={post.id}
                    className="border rounded-lg p-3 space-y-2 hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{post.title}</p>
                        <p className="text-xs text-muted-foreground truncate">/blog/{post.slug}</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Badge variant={post.is_published ? 'default' : 'secondary'} className="text-[10px]">
                          {post.is_published ? 'Published' : 'Draft'}
                        </Badge>
                        {/* Per-article AI fix button for missing-seo */}
                        {filter === 'missing-seo' && !result && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs gap-1"
                            disabled={isFixing || !aiModel}
                            onClick={() => handleFixSingleSeo(post)}
                          >
                            {isFixing ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <><Sparkles className="h-3 w-3" /> AI Fix</>
                            )}
                          </Button>
                        )}
                        {/* Result badge */}
                        {result && (
                          <Badge
                            variant={result.status === 'fixed' ? 'default' : result.status === 'skipped' ? 'secondary' : 'destructive'}
                            className="text-[9px]"
                          >
                            {result.status === 'fixed' && <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" />}
                            {result.status === 'failed' && <XCircle className="h-2.5 w-2.5 mr-0.5" />}
                            {result.status}
                          </Badge>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs gap-1"
                          onClick={() => {
                            onEditPost(post);
                            onOpenChange(false);
                          }}
                        >
                          <Edit className="h-3 w-3" />
                          Edit
                        </Button>
                      </div>
                    </div>

                    {/* Issue reasons */}
                    <div className="flex flex-wrap gap-1">
                      {reasons.map((reason, i) => (
                        <span
                          key={i}
                          className="inline-flex items-center text-[10px] px-1.5 py-0.5 rounded bg-destructive/10 text-destructive"
                        >
                          {reason}
                        </span>
                      ))}
                    </div>

                    {/* Fix result details */}
                    {result && result.changes && Object.keys(result.changes).length > 0 && (
                      <div className="text-[10px] space-y-0.5 mt-1 border-t pt-1">
                        {Object.entries(result.changes).map(([field, change]) => (
                          <div key={field}>
                            <span className="font-medium">{field}:</span>{' '}
                            <span className="text-green-700 dark:text-green-400">{String(change.after).substring(0, 80)}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    <p className="text-[10px] text-muted-foreground">
                      Updated {formatDistanceToNow(new Date(post.updated_at), { addSuffix: true })}
                      {post.author_name && ` · ${post.author_name}`}
                      {post.word_count ? ` · ${post.word_count} words` : ''}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>}
      </SheetContent>
    </Sheet>
  );
}
