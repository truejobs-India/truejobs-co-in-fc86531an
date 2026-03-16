import { useParams } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { Layout } from '@/components/layout/Layout';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, Tag, ExternalLink } from 'lucide-react';
import { Helmet } from 'react-helmet-async';
import NotFound from '../NotFound';
import { PremiumResultLanding } from '@/pages/board-results/PremiumResultLanding';

interface CustomPageData {
  title: string;
  slug: string;
  content: string;
  excerpt: string | null;
  meta_title: string | null;
  meta_description: string | null;
  category: string | null;
  tags: string[] | null;
  faq_schema: any;
  word_count: number;
  reading_time: number;
  page_type: string;
  published_at: string | null;
  cover_image_url: string | null;
  featured_image_alt: string | null;
  canonical_url: string | null;
  updated_at: string | null;
  // Board result fields
  state_ut: string | null;
  board_name: string | null;
  result_url: string | null;
  official_board_url: string | null;
  result_variant: string | null;
  internal_links: any;
}

export async function isCustomPageSlug(slug: string): Promise<boolean> {
  const { count } = await supabase
    .from('custom_pages')
    .select('id', { count: 'exact', head: true })
    .eq('slug', slug)
    .eq('is_published', true);
  return (count || 0) > 0;
}

export default function CustomPageRenderer() {
  const { slug } = useParams<{ slug: string }>();
  const [page, setPage] = useState<CustomPageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!slug) { setNotFound(true); setLoading(false); return; }

    supabase
      .from('custom_pages')
      .select('title, slug, content, excerpt, meta_title, meta_description, category, tags, faq_schema, word_count, reading_time, page_type, published_at, cover_image_url, featured_image_alt, canonical_url, updated_at, state_ut, board_name, result_url, official_board_url, result_variant, internal_links')
      .eq('slug', slug)
      .eq('is_published', true)
      .single()
      .then(({ data, error }) => {
        if (error || !data) { setNotFound(true); }
        else { setPage(data as unknown as CustomPageData); }
        setLoading(false);
      });
  }, [slug]);

  if (loading) return <Layout><div className="container mx-auto p-8"><Skeleton className="h-96 w-full" /></div></Layout>;
  if (notFound || !page) return <NotFound />;

  const siteUrl = 'https://truejobs.co.in';
  const pageUrl = `${siteUrl}/${page.slug}`;
  const faqItems = Array.isArray(page.faq_schema) ? page.faq_schema : [];

  // Build FAQ schema
  const faqSchema = faqItems.length > 0 ? {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqItems.map((faq: any) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: { '@type': 'Answer', text: faq.answer },
    })),
  } : null;

  const webPageSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: page.meta_title || page.title,
    description: page.meta_description || page.excerpt || '',
    url: pageUrl,
    publisher: { '@type': 'Organization', name: 'TrueJobs', url: siteUrl },
    ...(page.published_at ? { datePublished: page.published_at } : {}),
    ...(page.updated_at ? { dateModified: page.updated_at } : {}),
  };

  const isResultLanding = page.page_type === 'result-landing';
  const internalLinks: Array<{ slug: string; title: string; type: string }> = Array.isArray(page.internal_links) ? page.internal_links : [];

  // Use PremiumResultLanding for result pages
  if (isResultLanding) {
    return (
      <Layout>
        <Helmet>
          <title>{page.meta_title || page.title} | TrueJobs</title>
          <meta name="description" content={page.meta_description || page.excerpt || ''} />
          <link rel="canonical" href={page.canonical_url || pageUrl} />
          <meta property="og:title" content={page.meta_title || page.title} />
          <meta property="og:description" content={page.meta_description || page.excerpt || ''} />
          <meta property="og:url" content={pageUrl} />
          <meta property="og:type" content="article" />
          {page.cover_image_url && <meta property="og:image" content={page.cover_image_url} />}
          <script type="application/ld+json">{JSON.stringify(webPageSchema)}</script>
          {faqSchema && <script type="application/ld+json">{JSON.stringify(faqSchema)}</script>}
        </Helmet>
        <PremiumResultLanding page={page} />
      </Layout>
    );
  }

  // BreadcrumbList schema for result pages
  const breadcrumbSchema = isResultLanding ? {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: siteUrl },
      { '@type': 'ListItem', position: 2, name: 'Results', item: `${siteUrl}/results` },
      ...(page.state_ut ? [{ '@type': 'ListItem', position: 3, name: page.state_ut, item: `${siteUrl}/${page.state_ut.toLowerCase().replace(/\s+/g, '-')}-results` }] : []),
      { '@type': 'ListItem', position: page.state_ut ? 4 : 3, name: page.title },
    ],
  } : null;

  return (
    <Layout>
      <Helmet>
        <title>{page.meta_title || page.title} | TrueJobs</title>
        <meta name="description" content={page.meta_description || page.excerpt || ''} />
        <link rel="canonical" href={page.canonical_url || pageUrl} />
        <meta property="og:title" content={page.meta_title || page.title} />
        <meta property="og:description" content={page.meta_description || page.excerpt || ''} />
        <meta property="og:url" content={pageUrl} />
        <meta property="og:type" content="article" />
        {page.cover_image_url && <meta property="og:image" content={page.cover_image_url} />}
        <script type="application/ld+json">{JSON.stringify(webPageSchema)}</script>
        {faqSchema && <script type="application/ld+json">{JSON.stringify(faqSchema)}</script>}
        {breadcrumbSchema && <script type="application/ld+json">{JSON.stringify(breadcrumbSchema)}</script>}
      </Helmet>

      <article className="container mx-auto max-w-4xl px-4 py-8">
        {/* Breadcrumb */}
        <nav className="text-sm text-muted-foreground mb-4">
          <a href="/" className="hover:text-primary">Home</a>
          <span className="mx-2">›</span>
          {isResultLanding && (
            <>
              <span>Results</span>
              <span className="mx-2">›</span>
            </>
          )}
          {page.state_ut && isResultLanding && (
            <>
              <span>{page.state_ut}</span>
              <span className="mx-2">›</span>
            </>
          )}
          {!isResultLanding && page.category && (
            <>
              <span>{page.category}</span>
              <span className="mx-2">›</span>
            </>
          )}
          <span className="text-foreground">{page.title}</span>
        </nav>

        {/* Cover image */}
        {page.cover_image_url && (
          <img
            src={page.cover_image_url}
            alt={page.featured_image_alt || page.title}
            className="w-full h-64 object-cover rounded-lg mb-6"
            loading="lazy"
          />
        )}

        {/* Title */}
        <h1 className="text-3xl font-bold text-foreground mb-4">{page.title}</h1>

        {/* Result landing CTA buttons */}
        {isResultLanding && (page.result_url || page.official_board_url) && (
          <div className="flex flex-wrap gap-3 mb-6">
            {page.result_url && (
              <a
                href={page.result_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
              >
                <ExternalLink className="h-4 w-4" /> Check Result Now
              </a>
            )}
            {page.official_board_url && (
              <a
                href={page.official_board_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-5 py-2.5 border border-border rounded-lg font-medium hover:bg-muted transition-colors text-foreground"
              >
                <ExternalLink className="h-4 w-4" /> Official Board Website
              </a>
            )}
          </div>
        )}

        {/* Meta row */}
        <div className="flex flex-wrap gap-3 items-center text-sm text-muted-foreground mb-6">
          {page.published_at && (
            <span className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              {new Date(page.published_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
          )}
          {isResultLanding && page.updated_at && (
            <span className="flex items-center gap-1 text-xs">
              Updated: {new Date(page.updated_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
          )}
          <span className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            {page.reading_time || Math.ceil((page.word_count || 300) / 200)} min read
          </span>
          {page.result_variant && <Badge variant="outline" className="text-xs capitalize">{page.result_variant.replace(/-/g, ' ')}</Badge>}
          {!isResultLanding && <Badge variant="outline" className="text-xs">{page.page_type}</Badge>}
        </div>

        {/* Tags */}
        {page.tags && page.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-6">
            {page.tags.map(tag => (
              <Badge key={tag} variant="secondary" className="text-xs">
                <Tag className="h-3 w-3 mr-1" />{tag}
              </Badge>
            ))}
          </div>
        )}

        {/* Content */}
        <div
          className="prose prose-lg max-w-none text-foreground
            prose-headings:text-foreground prose-p:text-foreground/90
            prose-a:text-primary prose-strong:text-foreground
            prose-table:border prose-th:bg-muted prose-th:p-2 prose-td:p-2 prose-td:border"
          dangerouslySetInnerHTML={{ __html: page.content }}
        />

        {/* FAQ section */}
        {faqItems.length > 0 && (
          <section className="mt-10">
            <h2 className="text-2xl font-bold text-foreground mb-4">Frequently Asked Questions</h2>
            <div className="space-y-3">
              {faqItems.map((faq: any, i: number) => (
                <details key={i} className="border rounded-lg">
                  <summary className="p-4 cursor-pointer font-medium text-foreground hover:bg-muted/50">
                    {faq.question}
                  </summary>
                  <div className="px-4 pb-4 text-muted-foreground" dangerouslySetInnerHTML={{ __html: faq.answer }} />
                </details>
              ))}
            </div>
          </section>
        )}

        {/* Related Results (for result-landing pages) */}
        {isResultLanding && internalLinks.length > 0 && (
          <section className="mt-10">
            <h2 className="text-2xl font-bold text-foreground mb-4">Related Results</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {internalLinks.map((link: any, i: number) => (
                <a
                  key={i}
                  href={`/${link.slug}`}
                  className="flex items-center gap-2 p-3 border rounded-lg hover:bg-muted/50 transition-colors text-sm"
                >
                  <ExternalLink className="h-3.5 w-3.5 text-primary shrink-0" />
                  <span className="text-foreground">{link.title}</span>
                </a>
              ))}
            </div>
          </section>
        )}

        {/* Disclaimer for result-landing pages */}
        {isResultLanding && (
          <div className="mt-8 p-4 bg-muted/50 rounded-lg text-xs text-muted-foreground">
            <strong>Disclaimer:</strong> The information on this page is for informational purposes only.
            For official and latest information, please visit the official board website.
            TrueJobs is not responsible for any discrepancy in the information provided.
          </div>
        )}
      </article>
    </Layout>
  );
}
