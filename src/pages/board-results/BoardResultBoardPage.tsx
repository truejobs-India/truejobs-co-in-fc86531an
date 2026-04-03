/**
 * Board-level hub page for board results.
 * Lists result variants (Class 10, Class 12, supplementary, etc.) for a specific board.
 */
import { useParams, Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { Layout } from '@/components/layout/Layout';
import { AdPlaceholder } from '@/components/ads/AdPlaceholder';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Calendar, ChevronRight, ExternalLink, MapPin, BookOpen } from 'lucide-react';
import { Helmet } from 'react-helmet-async';
import { BoardResultAlertCTA } from '@/components/board-results/BoardResultAlertCTA';
import { GovtDisclaimer } from '@/pages/seo/components/GovtDisclaimer';
import NotFound from '../NotFound';

interface ResultEntry {
  slug: string;
  title: string;
  result_variant: string | null;
  result_url: string | null;
  updated_at: string | null;
  word_count: number | null;
  faq_schema: any;
  cover_image_url: string | null;
}

export default function BoardResultBoardPage() {
  const { state, board } = useParams<{ state: string; board: string }>();
  const [results, setResults] = useState<ResultEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [boardName, setBoardName] = useState('');
  const [heroImage, setHeroImage] = useState<string | null>(null);
  const [officialUrl, setOfficialUrl] = useState<string | null>(null);

  const stateDisplay = state?.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) || '';
  const boardDisplay = board?.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) || '';

  useEffect(() => {
    if (!state || !board) { setLoading(false); return; }

    // Search for pages matching this board abbreviation within this state
    supabase
      .from('custom_pages')
      .select('slug, title, result_variant, result_url, official_board_url, updated_at, word_count, faq_schema, cover_image_url, board_name')
      .eq('page_type', 'result-landing')
      .eq('is_published', true)
      .ilike('state_ut', `%${stateDisplay}%`)
      .ilike('slug', `%${board}%`)
      .order('result_variant')
      .then(({ data }) => {
        const entries = (data as unknown as (ResultEntry & { board_name?: string; official_board_url?: string })[]) || [];
        setResults(entries);
        if (entries.length > 0) {
          setBoardName((entries[0] as any).board_name || boardDisplay);
          setOfficialUrl((entries[0] as any).official_board_url || null);
          const withImage = entries.find(e => e.cover_image_url);
          if (withImage) setHeroImage(withImage.cover_image_url);
        }
        setLoading(false);
      });
  }, [state, board, stateDisplay, boardDisplay]);

  if (loading) return <Layout>
      <AdPlaceholder variant="banner" /><div className="container mx-auto p-8"><Skeleton className="h-96 w-full" /></div></Layout>;
  if (!state || !board || results.length === 0) return <NotFound />;

  const siteUrl = 'https://truejobs.co.in';
  const pageUrl = `${siteUrl}/results/${state}/${board}`;
  const title = `${boardName || boardDisplay} Results 2026`;
  const metaDesc = `Check ${boardName} results — Class 10, Class 12, supplementary, and revaluation results with official links.`;

  const faqItems = results.flatMap(r => Array.isArray(r.faq_schema) ? r.faq_schema.slice(0, 3) : []).slice(0, 8);
  const faqSchema = faqItems.length > 0 ? {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqItems.map((faq: any) => ({
      '@type': 'Question', name: faq.question,
      acceptedAnswer: { '@type': 'Answer', text: faq.answer },
    })),
  } : null;

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: siteUrl },
      { '@type': 'ListItem', position: 2, name: 'Results', item: `${siteUrl}/results` },
      { '@type': 'ListItem', position: 3, name: stateDisplay, item: `${siteUrl}/results/${state}` },
      { '@type': 'ListItem', position: 4, name: boardName || boardDisplay },
    ],
  };

  return (
    <Layout>
      <Helmet>
        <title>{title} | TrueJobs</title>
        <meta name="description" content={metaDesc} />
        <link rel="canonical" href={pageUrl} />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={metaDesc} />
        <meta property="og:url" content={pageUrl} />
        <script type="application/ld+json">{JSON.stringify(breadcrumbSchema)}</script>
        {faqSchema && <script type="application/ld+json">{JSON.stringify(faqSchema)}</script>}
      </Helmet>

      <article className="container mx-auto max-w-4xl px-4 py-8">
        {/* Breadcrumb */}
        <nav className="text-sm text-muted-foreground mb-6">
          <Link to="/" className="hover:text-primary">Home</Link>
          <span className="mx-2">›</span>
          <Link to={`/results/${state}`} className="hover:text-primary">Results</Link>
          <span className="mx-2">›</span>
          <Link to={`/results/${state}`} className="hover:text-primary">{stateDisplay}</Link>
          <span className="mx-2">›</span>
          <span className="text-foreground">{boardName || boardDisplay}</span>
        </nav>

        {/* Hero image */}
        {heroImage && (
          <div className="relative rounded-2xl overflow-hidden mb-8 aspect-[21/9]">
            <img src={heroImage} alt={`${boardName} results`}
              className="w-full h-full object-cover" loading="eager" />
            <div className="absolute inset-0 bg-gradient-to-t from-foreground/60 via-transparent to-transparent" />
          </div>
        )}

        {/* Title + Board Info */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <BookOpen className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-foreground">{title}</h1>
              <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                <MapPin className="h-3.5 w-3.5" /> {stateDisplay}
              </div>
            </div>
          </div>

          <p className="text-muted-foreground leading-relaxed">
            Access all {boardName} examination results. Select your specific result below to check marks,
            download marksheets, and find official result links.
          </p>
        </div>

        {/* Official Board Website */}
        {officialUrl && (
          <a
            href={officialUrl}
            target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 mb-6 border border-border rounded-xl text-sm font-medium hover:bg-muted transition-colors text-foreground"
          >
            <ExternalLink className="h-4 w-4 text-primary" /> Official Board Website
          </a>
        )}

        {/* Result Status / Listing */}
        <section className="mb-8">
          <h2 className="text-lg font-bold text-foreground mb-4">Result Categories</h2>
          <div className="grid gap-3">
            {results.map(r => (
              <Link
                key={r.slug}
                to={`/${r.slug}`}
                className="group flex items-center justify-between p-4 rounded-xl border border-border/60 bg-card hover:border-primary/30 hover:shadow-md transition-all"
              >
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                    {r.title}
                  </h3>
                  <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                    {r.result_variant && (
                      <Badge variant="outline" className="text-[10px] capitalize">
                        {r.result_variant.replace(/-/g, ' ')}
                      </Badge>
                    )}
                    {r.updated_at && (
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        Updated {new Date(r.updated_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      </span>
                    )}
                    {r.result_url && (
                      <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px]">Official Link Available</Badge>
                    )}
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
              </Link>
            ))}
          </div>
        </section>

        {/* Alert CTA - strong after result status */}
        <BoardResultAlertCTA variant="strong" context={boardName || boardDisplay} className="mb-10" />

        {/* FAQs from combined results */}
        {faqItems.length > 0 && (
          <section className="mb-10">
            <h2 className="text-xl font-bold text-foreground mb-4">Frequently Asked Questions</h2>
            <div className="space-y-3">
              {faqItems.map((faq: any, i: number) => (
                <details key={i} className="border rounded-xl overflow-hidden">
                  <summary className="p-4 cursor-pointer font-medium text-foreground hover:bg-muted/50 transition-colors">
                    {faq.question}
                  </summary>
                  <div className="px-4 pb-4 text-sm text-muted-foreground" dangerouslySetInnerHTML={{ __html: faq.answer }} />
                </details>
              ))}
            </div>
          </section>
        )}

        <AdPlaceholder variant="in-content" />

        {/* Bottom CTA */}
        <BoardResultAlertCTA variant="compact" context={boardName || boardDisplay} className="mb-8" />

        <GovtDisclaimer />
      </article>
    </Layout>
  );
}
