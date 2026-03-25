/**
 * State-level Board Results discovery page.
 * Lists all boards/results for a given state.
 */
import { useParams, Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { Layout } from '@/components/layout/Layout';
import { AdPlaceholder } from '@/components/ads/AdPlaceholder';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Calendar, ChevronRight, ExternalLink, MapPin } from 'lucide-react';
import { Helmet } from 'react-helmet-async';
import { BoardResultAlertCTA } from '@/components/board-results/BoardResultAlertCTA';
import { GovtDisclaimer } from '@/pages/seo/components/GovtDisclaimer';
import NotFound from '../NotFound';

interface BoardEntry {
  slug: string;
  title: string;
  board_name: string | null;
  result_variant: string | null;
  result_url: string | null;
  updated_at: string | null;
  word_count: number | null;
  cover_image_url: string | null;
}

export default function BoardResultStatePage() {
  const { state } = useParams<{ state: string }>();
  const [boards, setBoards] = useState<BoardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [heroImage, setHeroImage] = useState<string | null>(null);

  const stateDisplay = state
    ? state.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
    : '';

  useEffect(() => {
    if (!state) { setLoading(false); return; }

    supabase
      .from('custom_pages')
      .select('slug, title, board_name, result_variant, result_url, updated_at, word_count, cover_image_url')
      .eq('page_type', 'result-landing')
      .eq('is_published', true)
      .ilike('state_ut', `%${stateDisplay}%`)
      .order('board_name')
      .then(({ data }) => {
        setBoards((data as unknown as BoardEntry[]) || []);
        // Use first board's cover as hero fallback
        const firstWithImage = (data || []).find((d: any) => d.cover_image_url);
        if (firstWithImage) setHeroImage((firstWithImage as any).cover_image_url);
        setLoading(false);
      });
  }, [state, stateDisplay]);

  if (loading) return <Layout>
      <AdPlaceholder variant="banner" /><div className="container mx-auto p-8"><Skeleton className="h-96 w-full" /></div></Layout>;
  if (!state || boards.length === 0) return <NotFound />;

  const siteUrl = 'https://truejobs.co.in';
  const pageUrl = `${siteUrl}/results/${state}`;
  const title = `Board Results in ${stateDisplay} 2026`;
  const metaDesc = `Check all board exam results for ${stateDisplay} — Class 10, Class 12, supplementary results. Official links and instant alerts.`;

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: siteUrl },
      { '@type': 'ListItem', position: 2, name: 'Results', item: `${siteUrl}/results` },
      { '@type': 'ListItem', position: 3, name: stateDisplay },
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
      </Helmet>

      <article className="container mx-auto max-w-4xl px-4 py-8">
        {/* Breadcrumb */}
        <nav className="text-sm text-muted-foreground mb-6">
          <Link to="/" className="hover:text-primary">Home</Link>
          <span className="mx-2">›</span>
          <span>Results</span>
          <span className="mx-2">›</span>
          <span className="text-foreground">{stateDisplay}</span>
        </nav>

        {/* Hero */}
        {heroImage && (
          <div className="relative rounded-2xl overflow-hidden mb-8 aspect-[21/9]">
            <img src={heroImage} alt={`Board results in ${stateDisplay}`}
              className="w-full h-full object-cover" loading="eager" />
            <div className="absolute inset-0 bg-gradient-to-t from-foreground/60 via-transparent to-transparent" />
            <div className="absolute bottom-0 left-0 p-6">
              <div className="flex items-center gap-2 text-white/80 text-sm mb-2">
                <MapPin className="h-4 w-4" /> {stateDisplay}
              </div>
            </div>
          </div>
        )}

        {/* Title */}
        <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4">{title}</h1>
        <p className="text-muted-foreground leading-relaxed mb-8">
          Find all board examination results for {stateDisplay}. Access official result links,
          check class 10th and 12th results, supplementary exam results, and revaluation updates — all in one place.
        </p>

        {/* Alert CTA - soft below intro */}
        <BoardResultAlertCTA variant="soft" context={stateDisplay} className="mb-10" />

        {/* Board listing */}
        <section className="mb-10">
          <h2 className="text-xl font-bold text-foreground mb-5">Available Results</h2>
          <div className="grid gap-3">
            {boards.map(board => (
              <Link
                key={board.slug}
                to={`/${board.slug}`}
                className="group flex items-center justify-between p-4 rounded-xl border border-border/60 bg-card hover:border-primary/30 hover:shadow-md transition-all"
              >
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                    {board.title}
                  </h3>
                  <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                    {board.result_variant && (
                      <Badge variant="outline" className="text-[10px] capitalize">
                        {board.result_variant.replace(/-/g, ' ')}
                      </Badge>
                    )}
                    {board.updated_at && (
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {new Date(board.updated_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      </span>
                    )}
                    {board.result_url && (
                      <span className="flex items-center gap-1 text-primary">
                        <ExternalLink className="h-3 w-3" /> Official Link
                      </span>
                    )}
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
              </Link>
            ))}
          </div>
        </section>

        {/* Bottom CTA */}
        <BoardResultAlertCTA variant="compact" context={stateDisplay} className="mb-8" />

        <GovtDisclaimer />
      </article>
    </Layout>
  );
}
