import { useEffect, useState, useMemo } from 'react';
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { SEO } from '@/components/SEO';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { JobAlertCTA } from '@/components/shared/JobAlertCTA';
import { format } from 'date-fns';
import { Calendar, Clock, ArrowLeft, User, Share2, Tag, ChevronRight, BookOpen, Linkedin, Twitter } from 'lucide-react';
import { RelatedJobs } from '@/components/blog/RelatedJobs';
import { RelatedBlogs } from '@/components/blog/RelatedBlogs';
import { BlogCTA } from '@/components/blog/BlogCTA';
import { TableOfContents } from '@/components/blog/TableOfContents';
import { AdPlaceholder } from '@/components/ads/AdPlaceholder';
import {
  generateArticleSchema,
  generateFAQSchema,
  generateBreadcrumbSchema,
  categoryToSlug,
  extractHeadings,
  extractPrimaryKeyword,
  generateImageAlt,
  enhanceContentImageAlts,
} from '@/lib/blogUtils';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { Helmet } from 'react-helmet-async';
import DOMPurify from 'dompurify';
import { BLOG_REDIRECTS } from '@/lib/blogRedirects';

interface BlogPostData {
  id: string;
  title: string;
  slug: string;
  content: string;
  excerpt: string | null;
  cover_image_url: string | null;
  featured_image_alt: string | null;
  is_published: boolean;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  reading_time: number | null;
  category: string | null;
  tags: string[] | null;
  author_name: string | null;
  meta_title: string | null;
  meta_description: string | null;
  faq_schema: unknown;
}

export default function BlogPostPage() {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const previewId = searchParams.get('preview');
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isLoading: authLoading } = useAuth();
  const [post, setPost] = useState<BlogPostData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPreview, setIsPreview] = useState(false);

  useEffect(() => {
    if (!slug) return;
    if (previewId && authLoading) return;

    // Check redirect map (handles both exact match and case-insensitive for Agniveer)
    const redirectTarget = BLOG_REDIRECTS[slug] || BLOG_REDIRECTS[slug.toLowerCase()];
    if (redirectTarget) {
      if (redirectTarget === '/') {
        navigate('/', { replace: true });
      } else {
        navigate(`/blog/${redirectTarget}`, { replace: true });
      }
      return;
    }

    const fetchPost = async () => {
      setIsLoading(true);
      setIsPreview(Boolean(previewId));

      let query = supabase.from('blog_posts').select('*');

      if (previewId) {
        query = query.eq('id', previewId).eq('slug', slug);
      } else {
        query = query.eq('slug', slug).eq('is_published', true);
      }

      const { data, error } = await query.maybeSingle();

      if (error || !data) {
        setPost(null);
        setIsLoading(false);
        return;
      }

      // Parse faq_schema if it's a string or normalize it
      let faqData: Array<{ question: string; answer: string }> | null = null;
      if (data.faq_schema) {
        let raw: unknown = data.faq_schema;
        if (typeof raw === 'string') {
          try { raw = JSON.parse(raw); } catch { raw = null; }
        }
        if (Array.isArray(raw)) {
          faqData = raw as Array<{ question: string; answer: string }>;
        } else if (raw && typeof raw === 'object' && !Array.isArray(raw) && Array.isArray((raw as any).mainEntity)) {
          faqData = (raw as any).mainEntity.map((e: any) => ({
            question: e.name || e.question,
            answer: e.acceptedAnswer?.text || e.answer,
          }));
        }
      }

      setPost({
        ...data,
        faq_schema: faqData,
      } as BlogPostData);
      setIsLoading(false);
    };

    void fetchPost();
  }, [slug, previewId, authLoading, navigate]);

  const headings = useMemo(() => {
    if (!post?.content) return [];
    return extractHeadings(post.content);
  }, [post?.content]);

  const handleShare = async () => {
    const url = `https://truejobs.co.in/blog/${slug}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: post?.title,
          text: post?.excerpt || '',
          url,
        });
      } catch {
        // User cancelled or share failed
      }
    } else {
      await navigator.clipboard.writeText(url);
      toast({
        title: 'Link copied!',
        description: 'The article link has been copied to your clipboard.',
      });
    }
  };

  // Sanitize and render content — detect HTML vs markdown
  const renderContent = (rawContent: string) => {
    let content = rawContent;

    // Conservative: fix literal "\n" escape artifacts only if no <pre>/<code> blocks
    if (!/<(pre|code)\b/i.test(content)) {
      content = content.replace(/\\n/g, '\n');
    }

    // Conservative: strip leading duplicate title only if exact match + boundary
    if (post?.title && content.startsWith(post.title)) {
      const afterTitle = content.slice(post.title.length);
      if (/^[\s\n<]/.test(afterTitle) || afterTitle === '') {
        content = afterTitle.trimStart();
      }
    }

    const isRichHTML = /<(p|table|div|section|figure|svg)\b/i.test(content);

    let html: string;

    if (isRichHTML) {
      // Content is already HTML (from TipTap / Word import / inline charts)
      // Only add heading IDs for TOC navigation
      html = content
        .replace(/<h2([^>]*)>(.*?)<\/h2>/gi, (match, attrs, text) => {
          if (/id=/.test(attrs)) return match;
          const id = text.replace(/<[^>]+>/g, '').toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-');
          return `<h2${attrs} id="${id}" class="text-2xl font-bold mt-10 mb-5 scroll-mt-24">${text}</h2>`;
        })
        .replace(/<h3([^>]*)>(.*?)<\/h3>/gi, (match, attrs, text) => {
          if (/id=/.test(attrs)) return match;
          const id = text.replace(/<[^>]+>/g, '').toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-');
          return `<h3${attrs} id="${id}" class="text-xl font-semibold mt-8 mb-4 scroll-mt-24">${text}</h3>`;
        });
    } else {
      // Legacy markdown content
      html = content
        .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<figure class="my-8 rounded-lg overflow-hidden"><img src="$2" alt="$1" class="w-full h-auto rounded-lg shadow-md" loading="lazy" /><figcaption class="text-sm text-muted-foreground mt-2 text-center italic">$1</figcaption></figure>')
        .replace(/^### (.*$)/gim, (_, text) => {
          const id = text.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-');
          return `<h3 id="${id}" class="text-xl font-semibold mt-8 mb-4 scroll-mt-24">${text}</h3>`;
        })
        .replace(/^## (.*$)/gim, (_, text) => {
          const id = text.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-');
          return `<h2 id="${id}" class="text-2xl font-bold mt-10 mb-5 scroll-mt-24">${text}</h2>`;
        })
        .replace(/^# (.*$)/gim, (_, text) => {
          const id = text.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-');
          return `<h2 id="${id}" class="text-2xl font-bold mt-10 mb-5 scroll-mt-24">${text}</h2>`;
        })
        .replace(/\*\*\*([^*]+)\*\*\*/g, '<strong><em>$1</em></strong>')
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/\*([^*]+)\*/g, '<em>$1</em>')
        .replace(/^\s*[-*]\s+(.*)$/gim, '<li class="ml-6 mb-2 list-disc">$1</li>')
        .replace(/^\s*(\d+)\.\s+(.*)$/gim, '<li class="ml-6 mb-2 list-decimal">$2</li>')
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-primary hover:underline" target="_blank" rel="noopener noreferrer">$1</a>')
        .replace(/^(?!<[hlufds])([^<\n].+)$/gim, '<p class="mb-4 text-foreground/80 leading-relaxed">$1</p>')
        .replace(/\n\n+/g, '\n');

      html = html.replace(/(<li[^>]*>.*?<\/li>\n?)+/g, '<ul class="mb-6 space-y-1">$&</ul>');
    }

    return DOMPurify.sanitize(html, {
      ALLOWED_TAGS: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'ul', 'ol', 'li', 'a', 'strong', 'em', 'br', 'figure', 'figcaption', 'img', 'div', 'span', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'svg', 'path', 'circle', 'rect', 'line', 'text', 'g', 'section', 'caption', 'colgroup', 'col'],
      ALLOWED_ATTR: ['href', 'target', 'rel', 'id', 'class', 'src', 'alt', 'loading', 'style', 'viewBox', 'd', 'fill', 'stroke', 'stroke-width', 'stroke-dasharray', 'aria-label', 'colspan', 'rowspan', 'scope', 'width', 'height', 'cx', 'cy', 'r', 'x', 'y', 'rx', 'ry', 'transform', 'text-anchor', 'dominant-baseline', 'font-size'],
      ALLOW_DATA_ATTR: false
    });
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-8 max-w-4xl min-h-[600px]">
          <Skeleton className="h-8 w-32 mb-4" />
          <Skeleton className="h-[110px] w-full rounded mb-5" /> {/* banner ad space */}
          <Skeleton className="h-12 w-full mb-4" />
          <Skeleton className="h-6 w-48 mb-8" />
          <Skeleton className="h-80 w-full rounded-xl mb-8" />
          <div className="space-y-4">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
          </div>
        </div>
      </Layout>
    );
  }

  if (!post) {
    return (
      <Layout>
        <SEO title="Post Not Found" url={`/blog/${slug}`} />
        <Helmet>
          <meta name="robots" content="noindex, nofollow" />
        </Helmet>
        <div className="container mx-auto px-4 py-12">
          <Card className="max-w-lg mx-auto">
            <CardContent className="text-center py-12">
              <BookOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Post Not Found</h3>
              <p className="text-muted-foreground mb-6">
                The blog post you're looking for doesn't exist or has been removed.
              </p>
              <Button asChild>
                <Link to="/blog">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Blog
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  const primaryKeyword = extractPrimaryKeyword(post.title, post.slug, post.content);
  const autoAlt = post.featured_image_alt || generateImageAlt(post.title, post.category || undefined);
  const articleSchema = generateArticleSchema({ ...post, updated_at: post.updated_at });
  const parsedFaqSchema = Array.isArray(post.faq_schema) ? post.faq_schema as Array<{ question: string; answer: string }> : null;
  const faqSchema = parsedFaqSchema ? generateFAQSchema(parsedFaqSchema) : null;
  const breadcrumbSchema = generateBreadcrumbSchema([
    { name: 'Home', url: 'https://truejobs.co.in' },
    { name: 'Blog', url: 'https://truejobs.co.in/blog' },
    ...(post.category ? [{ name: post.category, url: `https://truejobs.co.in/blog/category/${categoryToSlug(post.category)}` }] : []),
    { name: post.title, url: `https://truejobs.co.in/blog/${post.slug}` },
  ]);

  const publishDate = post.published_at ? new Date(post.published_at) : new Date(post.created_at);

  return (
    <Layout>
      {isPreview && (
        <>
          <Helmet>
            <meta name="robots" content="noindex, nofollow" />
          </Helmet>
          <div className="bg-amber-500 text-white text-center py-2 text-sm font-medium">
            ⚠️ Preview Mode — This article is not published yet
          </div>
        </>
      )}
      <SEO 
        title={post.meta_title || post.title}
        description={post.meta_description || post.excerpt || ''}
        url={`/blog/${post.slug}`}
        image={post.cover_image_url || undefined}
        type="article"
        publishedTime={post.published_at || post.created_at}
        modifiedTime={post.updated_at || post.published_at || post.created_at}
        author={post.author_name || 'TrueJobs Editorial Team'}
        articleSection={post.category || 'Career Advice'}
        articleTags={post.tags || undefined}
        {...(isPreview ? { noindex: true } : {})}
      />

      {/* Additional structured data */}
      <Helmet>
        <script type="application/ld+json">
          {JSON.stringify(articleSchema)}
        </script>
        <script type="application/ld+json">
          {JSON.stringify(breadcrumbSchema)}
        </script>
        {faqSchema && (
          <script type="application/ld+json">
            {JSON.stringify(faqSchema)}
          </script>
        )}
        <link rel="canonical" href={`https://truejobs.co.in/blog/${post.slug}`} />
      </Helmet>

      {/* Breadcrumb with Schema.org microdata */}
      <nav aria-label="Breadcrumb" className="bg-muted/30 border-b">
        <div className="container mx-auto px-4 py-3">
          <ol className="flex items-center gap-2 text-sm text-muted-foreground" itemScope itemType="https://schema.org/BreadcrumbList">
            <li itemProp="itemListElement" itemScope itemType="https://schema.org/ListItem">
              <Link to="/" itemProp="item" className="hover:text-primary"><span itemProp="name">Home</span></Link>
              <meta itemProp="position" content="1" />
            </li>
            <ChevronRight className="h-4 w-4" />
            <li itemProp="itemListElement" itemScope itemType="https://schema.org/ListItem">
              <Link to="/blog" itemProp="item" className="hover:text-primary"><span itemProp="name">Blog</span></Link>
              <meta itemProp="position" content="2" />
            </li>
            {post.category && (
              <>
                <ChevronRight className="h-4 w-4" />
                <li itemProp="itemListElement" itemScope itemType="https://schema.org/ListItem">
                  <Link to={`/blog/category/${categoryToSlug(post.category)}`} itemProp="item" className="hover:text-primary">
                    <span itemProp="name">{post.category}</span>
                  </Link>
                  <meta itemProp="position" content="3" />
                </li>
              </>
            )}
            <ChevronRight className="h-4 w-4" />
            <li itemProp="itemListElement" itemScope itemType="https://schema.org/ListItem">
              <span itemProp="name" className="text-foreground line-clamp-1">{post.title}</span>
              <meta itemProp="position" content={post.category ? "4" : "3"} />
            </li>
          </ol>
        </div>
      </nav>

      {/* Header Banner Ad Space */}
      <div className="container mx-auto px-4 mt-[60px]">
        <AdPlaceholder variant="banner" />
      </div>

      <article className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Back Button */}
          <Button 
            variant="ghost" 
            onClick={() => navigate('/blog')}
            className="mb-6"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Blog
          </Button>

          {/* Article Header */}
          <header className="mb-8">
            {post.category && (
              <Link to={`/blog/category/${categoryToSlug(post.category)}`}>
                <Badge variant="secondary" className="mb-4 hover:bg-primary/20 transition-colors">
                  {post.category}
                </Badge>
              </Link>
            )}
            
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold leading-tight mb-6">
              {post.title}
            </h1>

            <div className="flex flex-wrap items-center gap-4 text-muted-foreground mb-6">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4" />
                <span>{post.author_name || 'TrueJobs Editorial Team'}</span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                <time dateTime={publishDate.toISOString()}>
                  {format(publishDate, 'MMMM d, yyyy')}
                </time>
              </div>
              {post.reading_time && (
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  <span>{post.reading_time} min read</span>
                </div>
              )}
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleShare}
                className="ml-auto"
              >
                <Share2 className="h-4 w-4 mr-2" />
                Share
              </Button>
            </div>

            {post.tags && post.tags.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <Tag className="h-4 w-4 text-muted-foreground" />
                {post.tags.map((tag, i) => (
                  <Badge key={i} variant="outline" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
          </header>

          {/* Featured Image */}
          {post.cover_image_url && (
            <figure className="mb-10 aspect-[1200/630] overflow-hidden">
              <img
                src={post.cover_image_url}
                alt={autoAlt}
                className="w-full h-auto rounded-xl shadow-lg"
                loading="eager"
                width={1200}
                height={630}
              />
            </figure>
          )}
        </div>

        {/* Main Content with Sidebar */}
        <div className="grid lg:grid-cols-[1fr_300px] gap-8 max-w-6xl mx-auto">
          <div className="max-w-4xl content-area">
            {/* Article Content */}
            <div 
              className="prose prose-lg max-w-none dark:prose-invert"
              dangerouslySetInnerHTML={{ __html: enhanceContentImageAlts(renderContent(post.content), primaryKeyword) }}
            />

            {/* In-Content Ad Space — only for substantial articles */}
            {post.content?.length > 1000 && <AdPlaceholder variant="in-content" className="my-8" />}

            {/* Mid-article CTA */}
            <BlogCTA variant="jobs" />

            {/* FAQ Section */}
            {parsedFaqSchema && parsedFaqSchema.length > 0 && (
              <section className="mt-12 mb-8">
                <h2 className="text-2xl font-bold mb-6">Frequently Asked Questions</h2>
                <div className="space-y-4">
                  {parsedFaqSchema.map((faq, index) => (
                    <div key={index} className="border rounded-lg p-4">
                      <h3 className="font-semibold text-lg mb-2">{faq.question}</h3>
                      <p className="text-muted-foreground">{faq.answer}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <Separator className="my-10" />

            {/* Enhanced Author Box */}
            <div className="bg-muted/50 rounded-xl p-6 mb-10 border">
              <div className="flex items-start gap-4">
                <div className="h-16 w-16 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center shrink-0 border-2 border-primary/20">
                  <User className="h-8 w-8 text-primary" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-lg">
                      {post.author_name || 'TrueJobs Editorial Team'}
                    </h3>
                    <Badge variant="secondary" className="text-xs">Verified Author</Badge>
                  </div>
                  <p className="text-primary/80 text-sm font-medium mb-2">
                    Career & Employment Expert at TrueJobs
                  </p>
                  <p className="text-muted-foreground text-sm">
                    The TrueJobs Editorial Team consists of certified career counsellors, HR professionals, and industry experts dedicated to helping job seekers in India succeed. We provide research-backed advice on job search strategies, resume writing, interview preparation, and career development.
                  </p>
                  <div className="flex items-center gap-3 mt-3">
                    <a href="https://www.linkedin.com/company/truejobsindia" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary transition-colors" aria-label="LinkedIn">
                      <Linkedin className="h-4 w-4" />
                    </a>
                    <a href="https://twitter.com/truejobsindia" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary transition-colors" aria-label="Twitter">
                      <Twitter className="h-4 w-4" />
                    </a>
                    <span className="text-xs text-muted-foreground ml-2">
                      Published on {format(publishDate, 'MMM d, yyyy')}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom CTAs */}
            <BlogCTA variant="all" />
            <JobAlertCTA variant="compact" context="Career Updates" className="mt-6" />
          </div>

          {/* Sidebar */}
          <aside className="space-y-6">
            {/* Sidebar Ad Space — only for substantial content */}
            {post.content?.length > 800 && (
              <div className="sticky top-24 mt-8">
                <AdPlaceholder variant="sidebar" />
              </div>
            )}

            {headings.length >= 3 && (
              <TableOfContents headings={headings} />
            )}
            <RelatedBlogs 
              currentPostId={post.id}
              category={post.category}
              tags={post.tags}
            />

            <RelatedJobs 
              category={post.category}
              tags={post.tags}
            />
          </aside>
        </div>
      </article>
    </Layout>
  );
}
