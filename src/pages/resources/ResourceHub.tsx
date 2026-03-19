import { useParams } from 'react-router-dom';
import { useState, useEffect, useCallback } from 'react';
import { Layout } from '@/components/layout/Layout';
import { supabase } from '@/integrations/supabase/client';
import { ResourceSEO } from '@/components/resources/ResourceSEO';
import { ResourceCard } from '@/components/resources/ResourceCard';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';
import { getHubConfig, getHubsForType, RESOURCE_TYPE_PATHS, PATH_TO_RESOURCE_TYPE, type ResourceType } from '@/lib/resourceHubs';

interface ResourceHubProps {
  resourceType?: ResourceType;
}

export default function ResourceHub({ resourceType: propType }: ResourceHubProps) {
  const { hubSlug } = useParams<{ hubSlug: string }>();
  const pathname = window.location.pathname;

  // Derive resource type from URL path
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
    if (!hubSlug) return;
    setLoading(true);

    const [mainRes, topRes, latestRes] = await Promise.all([
      supabase
        .from('pdf_resources')
        .select('slug, title, excerpt, category, resource_type, cover_image_url, language, download_count, file_size_bytes, page_count, is_featured, is_trending')
        .eq('is_published', true)
        .eq('resource_type', derivedType)
        .or(`category.ilike.%${hubSlug}%,exam_name.ilike.%${hubSlug}%,subject.ilike.%${hubSlug}%`)
        .order('is_featured', { ascending: false })
        .order('download_count', { ascending: false })
        .limit(24),
      supabase
        .from('pdf_resources')
        .select('slug, title, excerpt, category, resource_type, cover_image_url, language, download_count, file_size_bytes, page_count, is_featured, is_trending')
        .eq('is_published', true)
        .eq('resource_type', derivedType)
        .order('download_count', { ascending: false })
        .limit(6),
      supabase
        .from('pdf_resources')
        .select('slug, title, excerpt, category, resource_type, cover_image_url, language, download_count, file_size_bytes, page_count, is_featured, is_trending')
        .eq('is_published', true)
        .eq('resource_type', derivedType)
        .order('published_at', { ascending: false })
        .limit(6),
    ]);

    setResources(mainRes.data || []);
    setTopDownloads(topRes.data || []);
    setLatestUploads(latestRes.data || []);
    setLoading(false);
  }, [hubSlug, derivedType]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (!hubConfig) {
    return (
      <Layout>
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

  const breadcrumbs = [
    { name: 'Home', url: '/' },
    { name: typePath === 'books' ? 'Books' : typePath === 'sample-papers' ? 'Sample Papers' : typePath === 'guides' ? 'Guides' : 'Previous Year Papers', url: `/${typePath}` },
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
          <Link to={`/${typePath}`} className="hover:text-primary">
            {typePath === 'books' ? 'Books' : typePath === 'sample-papers' ? 'Sample Papers' : typePath === 'guides' ? 'Guides' : 'Previous Year Papers'}
          </Link>
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
          <div className="text-center py-16 text-muted-foreground">
            <p className="text-lg">No resources found in this category yet.</p>
            <p className="text-sm mt-2">We're adding new materials regularly. Check back soon!</p>
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

        {/* Top Downloads */}
        {topDownloads.length > 0 && (
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
        {latestUploads.length > 0 && (
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
