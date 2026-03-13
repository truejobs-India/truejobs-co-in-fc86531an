import { useMemo } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Edit, ExternalLink } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { blogPostToMetadata } from '@/lib/blogArticleAnalyzer';
import { analyzePublishCompliance, getComplianceReadinessStatus } from '@/lib/blogComplianceAnalyzer';
import { ComplianceReadinessBadge } from './ComplianceReadinessBadge';

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

function filterPosts(posts: BlogPost[], filter: DrilldownFilter): DrilldownArticle[] {
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
        case 'blocked':
        case 'needs-review':
        case 'policy-risk': {
          const meta = blogPostToMetadata(post);
          const compliance = analyzePublishCompliance(meta);
          const status = getComplianceReadinessStatus(compliance, meta);
          if (filter === 'blocked') return status === 'Blocked';
          if (filter === 'needs-review') return status === 'Needs Review';
          // policy-risk
          return compliance.checks.some(c => c.category === 'adsense-safety' && c.status === 'fail');
        }
        default: return false;
      }
    })
    .map(post => ({
      post,
      reasons: getArticleReasons(post, filter),
    }));
}

interface BlogStatsDrilldownProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filter: DrilldownFilter | null;
  posts: BlogPost[];
  onEditPost: (post: BlogPost) => void;
}

export function BlogStatsDrilldown({ open, onOpenChange, filter, posts, onEditPost }: BlogStatsDrilldownProps) {
  const articles = useMemo(() => {
    if (!filter) return [];
    return filterPosts(posts, filter);
  }, [posts, filter]);

  if (!filter) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{FILTER_LABELS[filter]}</SheetTitle>
          <SheetDescription>
            {articles.length} article{articles.length !== 1 ? 's' : ''} found
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4">
          {articles.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No articles match this filter.</p>
          ) : (
            <div className="space-y-2">
              {articles.map(({ post, reasons }) => (
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

                  <p className="text-[10px] text-muted-foreground">
                    Updated {formatDistanceToNow(new Date(post.updated_at), { addSuffix: true })}
                    {post.author_name && ` · ${post.author_name}`}
                    {post.word_count ? ` · ${post.word_count} words` : ''}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}