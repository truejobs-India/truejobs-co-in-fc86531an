import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowRight, BookOpen, Clock } from 'lucide-react';

interface ArticleRow {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  cover_image_url: string | null;
  featured_image_alt: string | null;
  category: string | null;
  reading_time: number | null;
}

const FIELDS = 'id,title,slug,excerpt,cover_image_url,featured_image_alt,category,reading_time';

/** Supabase Storage transform for lightweight thumbnails */
function getThumbnailUrl(url: string): string {
  if (!url) return '';
  if (url.includes('/storage/v1/object/public/')) {
    const base = url.split('?')[0];
    return `${base}?width=256&height=160&resize=cover&quality=75`;
  }
  return url;
}

export function LatestArticles() {
  const [articles, setArticles] = useState<ArticleRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      // Primary: admin-selected
      const { data: selected } = await supabase
        .from('blog_posts')
        .select(FIELDS)
        .eq('is_published', true)
        .eq('show_on_homepage', true)
        .order('published_at', { ascending: false })
        .limit(5);

      if (selected && selected.length > 0) {
        setArticles(selected);
        setLoading(false);
        return;
      }

      // Fallback: latest 5 published
      const { data: latest } = await supabase
        .from('blog_posts')
        .select(FIELDS)
        .eq('is_published', true)
        .order('published_at', { ascending: false })
        .limit(5);

      setArticles(latest || []);
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return (
      <section className="py-8">
        <div className="rounded-2xl border border-border bg-card shadow overflow-hidden">
          <div className="h-1 flex">
            <div className="flex-1 bg-orange-500" />
            <div className="flex-1 bg-white" />
            <div className="flex-1 bg-green-600" />
          </div>
          <div className="p-5 space-y-3">
            <Skeleton className="h-6 w-64" />
            <Skeleton className="h-4 w-96" />
            {[1, 2, 3].map(i => (
              <div key={i} className="flex gap-4 items-center">
                <Skeleton className="w-24 h-16 sm:w-32 sm:h-20 rounded-lg flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
                <Skeleton className="h-8 w-28 hidden sm:block" />
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (articles.length === 0) return null;

  return (
    <section className="py-8">
      <div className="rounded-2xl border border-border bg-card shadow overflow-hidden">
        {/* Tri-color accent */}
        <div className="h-1 flex">
          <div className="flex-1 bg-orange-500" />
          <div className="flex-1 bg-white" />
          <div className="flex-1 bg-green-600" />
        </div>

        <div className="p-5">
          {/* Header */}
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-orange-600" />
              <h2 className="text-lg font-bold text-foreground">Check Our Latest Articles</h2>
            </div>
            <Link
              to="/blog"
              className="hidden sm:inline-flex items-center gap-1 text-xs font-semibold text-orange-600 bg-orange-50 px-3 py-1.5 rounded-full hover:bg-orange-100 transition-colors"
            >
              View All <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <p className="text-xs text-muted-foreground mb-4">
            Helpful articles with useful information every candidate should know.
          </p>

          {/* Article rows */}
          <div className="space-y-3">
            {articles.map((article) => (
              <Link
                key={article.id}
                to={`/blog/${article.slug}`}
                className="flex items-center gap-4 p-3 rounded-xl border border-border hover:border-orange-200 hover:bg-accent/50 transition-colors group"
              >
                {/* Thumbnail */}
                <div className="w-24 h-16 sm:w-32 sm:h-20 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                  {article.cover_image_url ? (
                    <img
                      src={getThumbnailUrl(article.cover_image_url)}
                      alt={article.featured_image_alt || article.title}
                      width={128}
                      height={80}
                      loading="lazy"
                      decoding="async"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <BookOpen className="h-6 w-6 text-muted-foreground/40" />
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {article.category && (
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-orange-700 bg-orange-50 px-2 py-0.5 rounded">
                        {article.category}
                      </span>
                    )}
                    {article.reading_time && (
                      <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {article.reading_time} min read
                      </span>
                    )}
                  </div>
                  <h3 className="text-sm font-semibold text-foreground line-clamp-2 group-hover:text-orange-700 transition-colors">
                    {article.title}
                  </h3>
                  {article.excerpt && (
                    <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                      {article.excerpt}
                    </p>
                  )}
                </div>

                {/* CTA */}
                <div className="hidden sm:flex flex-shrink-0">
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-white bg-orange-600 px-4 py-2 rounded-lg group-hover:bg-orange-700 transition-colors">
                    Read Article <ArrowRight className="h-3 w-3" />
                  </span>
                </div>
              </Link>
            ))}
          </div>

          {/* Mobile "View All" */}
          <div className="mt-4 sm:hidden">
            <Link
              to="/blog"
              className="flex items-center justify-center gap-1 text-xs font-semibold text-orange-600 bg-orange-50 px-3 py-2 rounded-full hover:bg-orange-100 transition-colors"
            >
              View All Articles <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
