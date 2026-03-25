import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { supabase } from '@/integrations/supabase/client';
import { ResourceSEO } from '@/components/resources/ResourceSEO';
import { ResourceCard } from '@/components/resources/ResourceCard';
import { AdPlaceholder } from '@/components/ads/AdPlaceholder';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getHubsForType, RESOURCE_TYPE_PATHS, type ResourceType } from '@/lib/resourceHubs';

const PAGE_SIZE = 12;

interface ResourceListingProps {
  resourceType: ResourceType;
  pageTitle: string;
  metaTitle: string;
  metaDescription: string;
}

export function ResourceListing({ resourceType, pageTitle, metaTitle, metaDescription }: ResourceListingProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [resources, setResources] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(searchParams.get('q') || '');
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  const [categoryFilter, setCategoryFilter] = useState(searchParams.get('category') || '');
  const [categories, setCategories] = useState<string[]>([]);
  const [initialLoad, setInitialLoad] = useState(true);
  const page = parseInt(searchParams.get('page') || '1', 10);
  const typePath = RESOURCE_TYPE_PATHS[resourceType];
  const hubs = getHubsForType(resourceType);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    debounceRef.current = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(debounceRef.current);
  }, [search]);

  const fetchResources = useCallback(async () => {
    if (initialLoad) setLoading(true);
    let query = supabase
      .from('pdf_resources')
      .select('slug, title, excerpt, category, resource_type, cover_image_url, language, download_count, file_size_bytes, page_count, is_featured, is_trending', { count: 'exact' })
      .eq('is_published', true)
      .eq('resource_type', resourceType)
      .order('is_featured', { ascending: false })
      .order('download_count', { ascending: false })
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

    if (categoryFilter) query = query.eq('category', categoryFilter);
    if (debouncedSearch) query = query.ilike('title', `%${debouncedSearch}%`);

    const { data, count } = await query;
    setResources(data || []);
    setTotal(count || 0);
    setLoading(false);
    setInitialLoad(false);
  }, [resourceType, page, categoryFilter, debouncedSearch, initialLoad]);

  useEffect(() => {
    fetchResources();
  }, [fetchResources]);

  useEffect(() => {
    supabase
      .from('pdf_resources')
      .select('category')
      .eq('is_published', true)
      .eq('resource_type', resourceType)
      .not('category', 'is', null)
      .then(({ data }) => {
        const unique = [...new Set((data || []).map(d => d.category).filter(Boolean))] as string[];
        setCategories(unique.sort());
      });
  }, [resourceType]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const setPage = (p: number) => {
    const params = new URLSearchParams(searchParams);
    params.set('page', String(p));
    setSearchParams(params);
  };

  const breadcrumbs = [
    { name: 'Home', url: '/' },
    { name: pageTitle, url: `/${typePath}` },
  ];

  return (
    <Layout>
      <ResourceSEO
        title={pageTitle}
        metaTitle={metaTitle}
        metaDescription={metaDescription}
        canonicalUrl={`/${typePath}`}
        breadcrumbs={breadcrumbs}
        schemaJson={{
          '@context': 'https://schema.org',
          '@type': 'CollectionPage',
          name: pageTitle,
          url: `https://truejobs.co.in/${typePath}`,
        }}
      />

      <div className="container mx-auto px-4 py-8">
        {/* Breadcrumb */}
        <nav className="text-sm text-muted-foreground mb-6">
          <Link to="/" className="hover:text-primary">Home</Link>
          <span className="mx-2">›</span>
          <span className="text-foreground">{pageTitle}</span>
        </nav>

        <h1 className="text-3xl font-bold text-foreground mb-2">{pageTitle}</h1>
        <p className="text-muted-foreground mb-6">
          Download free PDF resources for government exam preparation. All materials are verified and up-to-date.
        </p>

        {/* Hub navigation */}
        {hubs.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-6">
            {hubs.map(h => (
              <Link key={h.slug} to={`/${typePath}/hub/${h.slug}`}>
                <Badge variant="outline" className="cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors">
                  {h.config.label}
                </Badge>
              </Link>
            ))}
          </div>
        )}

        {/* Search & filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-8">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search resources..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant={categoryFilter === '' ? 'default' : 'outline'}
              size="sm"
              onClick={() => { setCategoryFilter(''); setSearchParams({}); }}
            >
              All
            </Button>
            {categories.map(c => (
              <Button
                key={c}
                variant={categoryFilter === c ? 'default' : 'outline'}
                size="sm"
                onClick={() => setCategoryFilter(c)}
              >
                {c}
              </Button>
            ))}
          </div>
        </div>

        {/* Grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-72 bg-muted animate-pulse rounded-lg" />
            ))}
          </div>
        ) : resources.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <p className="text-lg">No resources found.</p>
            <p className="text-sm mt-2">Check back soon — we're adding new materials regularly.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
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

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex justify-center items-center gap-4 mt-8">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground">
                  Page {page} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage(page + 1)}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}
