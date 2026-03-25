/**
 * Premium Result Landing Page — highest-intent utility page.
 * Replaces the generic CustomPageRenderer view for result-landing pages.
 * Features: orange official CTA, alert boxes, structured content, board logo.
 */
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, ExternalLink, Tag, BookOpen, AlertCircle } from 'lucide-react';
import { BoardResultAlertCTA } from '@/components/board-results/BoardResultAlertCTA';
import { GovtDisclaimer } from '@/pages/seo/components/GovtDisclaimer';
import { AdPlaceholder } from '@/components/ads/AdPlaceholder';
import { Link } from 'react-router-dom';

interface PremiumResultLandingProps {
  page: {
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
    state_ut: string | null;
    board_name: string | null;
    result_url: string | null;
    official_board_url: string | null;
    result_variant: string | null;
    internal_links: any;
  };
}

export function PremiumResultLanding({ page }: PremiumResultLandingProps) {
  const faqItems = Array.isArray(page.faq_schema) ? page.faq_schema : [];
  const internalLinks: Array<{ slug: string; title: string; type: string }> = Array.isArray(page.internal_links) ? page.internal_links : [];
  const stateSlug = page.state_ut?.toLowerCase().replace(/\s+/g, '-') || '';

  // Split content to inject CTAs at strategic positions
  const contentParts = splitContentForCTAs(page.content);

  return (
    <article className="container mx-auto max-w-4xl px-4 py-8">
      <AdPlaceholder variant="banner" />
      {/* Breadcrumb */}
      <nav className="text-sm text-muted-foreground mb-6">
        <Link to="/" className="hover:text-primary">Home</Link>
        <span className="mx-2">›</span>
        {stateSlug && (
          <>
            <Link to={`/results/${stateSlug}`} className="hover:text-primary">Results</Link>
            <span className="mx-2">›</span>
            <span>{page.state_ut}</span>
            <span className="mx-2">›</span>
          </>
        )}
        <span className="text-foreground">{page.title}</span>
      </nav>

      {/* Hero image */}
      {page.cover_image_url && (
        <div className="relative rounded-2xl overflow-hidden mb-8 aspect-[21/9]">
          <img
            src={page.cover_image_url}
            alt={page.featured_image_alt || page.title}
            className="w-full h-full object-cover"
            loading="eager"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-foreground/50 via-transparent to-transparent" />
        </div>
      )}

      {/* Title + Board Info */}
      <div className="mb-6">
        <div className="flex items-start gap-3 mb-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 shrink-0 mt-1">
            <BookOpen className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">{page.title}</h1>
            <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-muted-foreground">
              {page.published_at && (
                <span className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  {new Date(page.published_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
              )}
              {page.updated_at && (
                <span className="flex items-center gap-1 text-xs">
                  Updated: {new Date(page.updated_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {page.reading_time || Math.ceil((page.word_count || 300) / 200)} min read
              </span>
              {page.result_variant && (
                <Badge variant="outline" className="text-xs capitalize">
                  {page.result_variant.replace(/-/g, ' ')}
                </Badge>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Result Status Box */}
      <div className="rounded-2xl border border-primary/20 bg-primary/[0.03] p-5 mb-6">
        <div className="flex items-center gap-2 mb-3">
          <AlertCircle className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-bold text-foreground">Result Status</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-1">
          {page.board_name && `${page.board_name} `}
          {page.result_variant && page.result_variant !== 'main' && `${page.result_variant.replace(/-/g, ' ')} `}
          result information and official links.
        </p>
        {page.state_ut && (
          <p className="text-xs text-muted-foreground">State/UT: {page.state_ut}</p>
        )}
      </div>

      {/* ═══ BIG ORANGE OFFICIAL RESULT BUTTON ═══ */}
      {page.result_url && (
        <div className="mb-6">
          <a
            href={page.result_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-3 w-full py-4 px-6 rounded-2xl text-lg font-bold text-white bg-[hsl(25_95%_53%)] hover:bg-[hsl(25_95%_48%)] shadow-lg hover:shadow-xl transition-all"
          >
            <ExternalLink className="h-5 w-5" />
            Check Result on Official Website
          </a>
        </div>
      )}

      {/* Official Board Website - secondary */}
      {page.official_board_url && (
        <a
          href={page.official_board_url}
          target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2 mb-6 border border-border rounded-xl text-sm font-medium hover:bg-muted transition-colors text-foreground"
        >
          <ExternalLink className="h-4 w-4 text-primary" /> Visit Official Board Website
        </a>
      )}

      {/* Alert CTA - strong, right after status + button */}
      <BoardResultAlertCTA
        variant="strong"
        context={page.board_name || page.title}
        resultReleased={!!page.result_url}
        className="mb-8"
      />

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

      {/* Content Part 1 */}
      {contentParts.part1 && (
        <div
          className="prose prose-lg max-w-none text-foreground
            prose-headings:text-foreground prose-p:text-foreground/90
            prose-a:text-primary prose-strong:text-foreground
            prose-table:border prose-th:bg-muted prose-th:p-2 prose-td:p-2 prose-td:border"
          dangerouslySetInnerHTML={{ __html: contentParts.part1 }}
        />
      )}

      {/* Second CTA after "How to check" section */}
      {contentParts.part2 && (
        <>
          <AdPlaceholder variant="in-content" />
          <BoardResultAlertCTA
            variant="soft"
            context={page.board_name || page.title}
            resultReleased={!!page.result_url}
            className="my-8"
          />
          <div
            className="prose prose-lg max-w-none text-foreground
              prose-headings:text-foreground prose-p:text-foreground/90
              prose-a:text-primary prose-strong:text-foreground
              prose-table:border prose-th:bg-muted prose-th:p-2 prose-td:p-2 prose-td:border"
            dangerouslySetInnerHTML={{ __html: contentParts.part2 }}
          />
        </>
      )}

      {/* FAQ section */}
      {faqItems.length > 0 && (
        <section className="mt-10">
          <h2 className="text-2xl font-bold text-foreground mb-4">Frequently Asked Questions</h2>
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

      {/* Bottom CTA before related links */}
      <BoardResultAlertCTA
        variant="compact"
        context={page.board_name || page.title}
        resultReleased={!!page.result_url}
        className="mt-8 mb-6"
      />

      {/* Related Results */}
      {internalLinks.length > 0 && (
        <section className="mt-8">
          <h2 className="text-xl font-bold text-foreground mb-4">Related Results</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {internalLinks.map((link: any, i: number) => (
              <a
                key={i}
                href={`/${link.slug}`}
                className="flex items-center gap-2 p-3 border rounded-xl hover:bg-muted/50 transition-colors text-sm"
              >
                <ExternalLink className="h-3.5 w-3.5 text-primary shrink-0" />
                <span className="text-foreground">{link.title}</span>
              </a>
            ))}
          </div>
        </section>
      )}

      {/* Disclaimer */}
      <GovtDisclaimer />
    </article>
  );
}

/**
 * Split content HTML to inject CTAs at strategic points.
 * Splits after the 4th <h2> section for a natural break.
 */
function splitContentForCTAs(html: string): { part1: string; part2: string | null } {
  if (!html) return { part1: '', part2: null };

  // Find the 4th <h2> tag position
  const h2Regex = /<h2[\s>]/gi;
  let match;
  let count = 0;
  let splitIdx = -1;

  while ((match = h2Regex.exec(html)) !== null) {
    count++;
    if (count === 5) { // After 4th section (before 5th h2)
      splitIdx = match.index;
      break;
    }
  }

  if (splitIdx > 0 && splitIdx < html.length - 200) {
    return {
      part1: html.substring(0, splitIdx),
      part2: html.substring(splitIdx),
    };
  }

  // If not enough sections, split at ~40% mark
  if (html.length > 2000) {
    const mid = Math.floor(html.length * 0.4);
    // Find next </p> or </h2> after mid
    const endTag = html.indexOf('</p>', mid);
    if (endTag > 0 && endTag < html.length - 200) {
      return {
        part1: html.substring(0, endTag + 4),
        part2: html.substring(endTag + 4),
      };
    }
  }

  return { part1: html, part2: null };
}
