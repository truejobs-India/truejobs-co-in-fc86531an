import { useParams } from 'react-router-dom';
import { useState, useEffect, useCallback } from 'react';
import { Layout } from '@/components/layout/Layout';
import { AdPlaceholder } from '@/components/ads/AdPlaceholder';
import { supabase } from '@/integrations/supabase/client';
import { ResourceSEO } from '@/components/resources/ResourceSEO';
import { ResourceCard } from '@/components/resources/ResourceCard';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Link } from 'react-router-dom';
import { BookOpen, FileText, GraduationCap } from 'lucide-react';
import { getHubConfig, getHubsForType, buildHubFilterString, RESOURCE_TYPE_PATHS, PATH_TO_RESOURCE_TYPE, type ResourceType } from '@/lib/resourceHubs';

interface ResourceHubProps {
  resourceType?: ResourceType;
}

export default function ResourceHub({ resourceType: propType }: ResourceHubProps) {
  const { hubSlug } = useParams<{ hubSlug: string }>();
  const pathname = window.location.pathname;

  const derivedType = propType || (() => {
    for (const [path, type] of Object.entries(PATH_TO_RESOURCE_TYPE)) {
      if (pathname.startsWith(`/${path}`)) return type;
    }
    return 'sample_paper' as ResourceType;
  })();

  const typePath = RESOURCE_TYPE_PATHS[derivedType];
  const hubConfig = hubSlug ? getHubConfig(derivedType, hubSlug) : null;
  const hubs = getHubsForType(derivedType);

  const [resources, setResources] = useState<any[]>([]);
  const [topDownloads, setTopDownloads] = useState<any[]>([]);
  const [latestUploads, setLatestUploads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!hubSlug || !hubConfig) return;
    setLoading(true);

    // Build deterministic filter from hub's dbFilters
    const filterString = buildHubFilterString(hubConfig.dbFilters);

    const selectCols = 'slug, title, excerpt, category, resource_type, cover_image_url, language, download_count, file_size_bytes, page_count, is_featured, is_trending';

    const [mainRes, topRes, latestRes] = await Promise.all([
      filterString
        ? supabase
            .from('pdf_resources')
            .select(selectCols)
            .eq('is_published', true)
            .eq('resource_type', derivedType)
            .or(filterString)
            .order('is_featured', { ascending: false })
            .order('download_count', { ascending: false })
            .limit(24)
        : Promise.resolve({ data: [] }),
      supabase
        .from('pdf_resources')
        .select(selectCols)
        .eq('is_published', true)
        .eq('resource_type', derivedType)
        .order('download_count', { ascending: false })
        .limit(6),
      supabase
        .from('pdf_resources')
        .select(selectCols)
        .eq('is_published', true)
        .eq('resource_type', derivedType)
        .order('published_at', { ascending: false })
        .limit(6),
    ]);

    setResources(mainRes.data || []);
    setTopDownloads(topRes.data || []);
    setLatestUploads(latestRes.data || []);
    setLoading(false);
  }, [hubSlug, derivedType, hubConfig]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (!hubConfig) {
    return (
      <Layout>
      <AdPlaceholder variant="banner" />
        <div className="container mx-auto px-4 py-16 text-center">
          <h1 className="text-2xl font-bold text-foreground mb-4">Hub Not Found</h1>
          <p className="text-muted-foreground mb-6">This category page doesn't exist.</p>
          <Link to={`/${typePath}`} className="text-primary hover:underline">
            Browse all resources →
          </Link>
        </div>
      </Layout>
    );
  }

  const typeLabel = typePath === 'books' ? 'Books' : typePath === 'sample-papers' ? 'Sample Papers' : typePath === 'guides' ? 'Guides' : 'Previous Year Papers';

  const breadcrumbs = [
    { name: 'Home', url: '/' },
    { name: typeLabel, url: `/${typePath}` },
    { name: hubConfig.label, url: `/${typePath}/hub/${hubSlug}` },
  ];

  return (
    <Layout>
      <ResourceSEO
        title={hubConfig.label}
        metaTitle={hubConfig.metaTitle}
        metaDescription={hubConfig.metaDescription}
        canonicalUrl={`/${typePath}/hub/${hubSlug}`}
        breadcrumbs={breadcrumbs}
        schemaJson={{
          '@context': 'https://schema.org',
          '@type': 'CollectionPage',
          name: hubConfig.label,
          url: `https://truejobs.co.in/${typePath}/hub/${hubSlug}`,
        }}
      />

      <div className="container mx-auto px-4 py-8">
        {/* Breadcrumb */}
        <nav className="text-sm text-muted-foreground mb-6">
          <Link to="/" className="hover:text-primary">Home</Link>
          <span className="mx-2">›</span>
          <Link to={`/${typePath}`} className="hover:text-primary">{typeLabel}</Link>
          <span className="mx-2">›</span>
          <span className="text-foreground">{hubConfig.label}</span>
        </nav>

        <h1 className="text-3xl font-bold text-foreground mb-4">{hubConfig.label}</h1>
        <p className="text-muted-foreground mb-8 max-w-3xl">{hubConfig.intro}</p>

        {/* Related hubs */}
        <div className="flex flex-wrap gap-2 mb-8">
          {hubs.filter(h => h.slug !== hubSlug).map(h => (
            <Link key={h.slug} to={`/${typePath}/hub/${h.slug}`}>
              <Badge variant="outline" className="cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors">
                {h.config.label}
              </Badge>
            </Link>
          ))}
        </div>

        {/* Main resources */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-72 bg-muted animate-pulse rounded-lg" />
            ))}
          </div>
        ) : resources.length === 0 ? (
          <div className="space-y-8">
            <div className="text-center py-12 text-muted-foreground bg-muted/30 rounded-lg">
              <GraduationCap className="h-12 w-12 mx-auto mb-4 text-muted-foreground/60" />
              <p className="text-lg font-medium">No resources in this category yet</p>
              <p className="text-sm mt-2 max-w-md mx-auto">
                We're adding new {typeLabel.toLowerCase()} regularly. Browse other categories or explore available resources below.
              </p>
              <Link to={`/${typePath}`} className="inline-block mt-4 text-primary hover:underline font-medium">
                ← Browse all {typeLabel}
              </Link>
            </div>

            {/* Cross-resource links */}
            <div>
              <h2 className="text-xl font-semibold text-foreground mb-4">Explore Other Resources</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Link to="/sample-papers">
                  <Card className="hover:shadow-md transition-shadow h-full">
                    <CardContent className="p-5 flex items-start gap-3">
                      <FileText className="h-8 w-8 text-primary shrink-0 mt-1" />
                      <div>
                        <p className="font-semibold text-foreground">Sample Papers</p>
                        <p className="text-sm text-muted-foreground">Practice papers for competitive exams</p>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
                <Link to="/free-guides">
                  <Card className="hover:shadow-md transition-shadow h-full">
                    <CardContent className="p-5 flex items-start gap-3">
                      <BookOpen className="h-8 w-8 text-primary shrink-0 mt-1" />
                      <div>
                        <p className="font-semibold text-foreground">Free Guides</p>
                        <p className="text-sm text-muted-foreground">10 downloadable preparation guides</p>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
                <Link to="/sarkari-jobs">
                  <Card className="hover:shadow-md transition-shadow h-full">
                    <CardContent className="p-5 flex items-start gap-3">
                      <GraduationCap className="h-8 w-8 text-primary shrink-0 mt-1" />
                      <div>
                        <p className="font-semibold text-foreground">Government Jobs</p>
                        <p className="text-sm text-muted-foreground">Latest sarkari job notifications</p>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {resources.map((r) => (
              <ResourceCard
                key={r.slug}
                slug={r.slug}
                title={r.title}
                excerpt={r.excerpt}
                category={r.category}
                resourceType={r.resource_type}
                coverImageUrl={r.cover_image_url}
                language={r.language}
                downloadCount={r.download_count}
                fileSizeBytes={r.file_size_bytes}
                pageCount={r.page_count}
                isFeatured={r.is_featured}
                isTrending={r.is_trending}
              />
            ))}
          </div>
        )}

        {/* Top Downloads — only show if we have hub-specific results */}
        {resources.length > 0 && topDownloads.length > 0 && (
          <section className="mt-16">
            <h2 className="text-2xl font-bold text-foreground mb-6">🔥 Top Downloads</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {topDownloads.map((r) => (
                <ResourceCard key={r.slug} slug={r.slug} title={r.title} excerpt={r.excerpt} category={r.category} resourceType={r.resource_type} coverImageUrl={r.cover_image_url} language={r.language} downloadCount={r.download_count} fileSizeBytes={r.file_size_bytes} pageCount={r.page_count} isFeatured={r.is_featured} isTrending={r.is_trending} />
              ))}
            </div>
          </section>
        )}

        {/* Latest Uploads */}
        {resources.length > 0 && latestUploads.length > 0 && (
          <section className="mt-12">
            <h2 className="text-2xl font-bold text-foreground mb-6">📄 Latest Uploads</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {latestUploads.map((r) => (
                <ResourceCard key={r.slug} slug={r.slug} title={r.title} excerpt={r.excerpt} category={r.category} resourceType={r.resource_type} coverImageUrl={r.cover_image_url} language={r.language} downloadCount={r.download_count} fileSizeBytes={r.file_size_bytes} pageCount={r.page_count} isFeatured={r.is_featured} isTrending={r.is_trending} />
              ))}
            </div>
          </section>
        )}
      </div>
    </Layout>
  );
}
