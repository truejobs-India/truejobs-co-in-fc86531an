import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { supabase } from '@/integrations/supabase/client';
import { ResourceSEO } from '@/components/resources/ResourceSEO';
import { ResourceCard } from '@/components/resources/ResourceCard';
import { AdPlaceholder } from '@/components/ads/AdPlaceholder';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, ChevronLeft, ChevronRight, FileText, BookOpen, GraduationCap, Briefcase, Newspaper } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getHubsForType, RESOURCE_TYPE_PATHS, type ResourceType } from '@/lib/resourceHubs';

const PAGE_SIZE = 12;

interface ResourceListingProps {
  resourceType: ResourceType;
  pageTitle: string;
  metaTitle: string;
  metaDescription: string;
}

/** Type-specific intro text — no generic fallback */
const TYPE_INTROS: Record<ResourceType, string> = {
  sample_paper: 'Download free sample papers in PDF for government and board exams. Practice with latest pattern papers for SSC, Railway, Banking, UPSC, CBSE and more.',
  book: 'We\'re building a library of free PDF books for competitive exam preparation. Browse available study materials below, or explore our other resources.',
  previous_year_paper: 'Access previous year question papers for government exams. We\'re adding papers for SSC, Railway, Banking, UPSC and more.',
  guide: 'Download preparation guides, study strategies, and exam-specific tips. We\'re expanding this section — in the meantime, check out our ready-to-use guides below.',
};

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

  const hasInventory = !loading && resources.length > 0;
  const isEmpty = !loading && resources.length === 0 && !debouncedSearch && !categoryFilter;

  return (
    <Layout>
      <ResourceSEO
        title={pageTitle}
        metaTitle={metaTitle}
        metaDescription={metaDescription}
        canonicalUrl={`/${typePath}`}
        noindex={isEmpty}
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
        <AdPlaceholder variant="banner" />
        <p className="text-muted-foreground mb-6">{TYPE_INTROS[resourceType]}</p>

        {/* Hub navigation — always visible for internal linking value */}
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

        {/* Featured link to /free-guides — only on guides listing */}
        {resourceType === 'guide' && (
          <Link to="/free-guides">
            <Card className="mb-8 border-primary/30 bg-primary/5 hover:shadow-md transition-shadow">
              <CardContent className="p-6 flex items-center gap-4">
                <BookOpen className="h-10 w-10 text-primary shrink-0" />
                <div>
                  <p className="font-semibold text-foreground text-lg">10 Free Preparation Guides Available Now</p>
                  <p className="text-sm text-muted-foreground">Download ready-to-use PDF guides for exam strategy, syllabus breakdowns, and preparation tips.</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        )}

        {/* Search & filters — show when there's inventory or active search */}
        {(hasInventory || debouncedSearch || categoryFilter) && (
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
        )}

        {/* Grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-72 bg-muted animate-pulse rounded-lg" />
            ))}
          </div>
        ) : resources.length === 0 && (debouncedSearch || categoryFilter) ? (
          // Filtered search with no results
          <div className="text-center py-16 text-muted-foreground">
            <p className="text-lg">No resources found matching your search.</p>
            <p className="text-sm mt-2">Try different keywords or browse categories above.</p>
          </div>
        ) : resources.length > 0 ? (
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
        ) : null}

        <AdPlaceholder variant="in-content" />

        {/* Zero-inventory cross-resource section — only when truly empty (no search filter) */}
        {isEmpty && (
          <div className="space-y-10">
            {/* Exam category cards for PYP */}
            {resourceType === 'previous_year_paper' && hubs.length > 0 && (
              <div>
                <h2 className="text-xl font-semibold text-foreground mb-4">Exam Categories</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {hubs.map(h => (
                    <Link key={h.slug} to={`/${typePath}/hub/${h.slug}`}>
                      <Card className="hover:shadow-md transition-shadow h-full">
                        <CardContent className="p-5">
                          <p className="font-semibold text-foreground mb-1">{h.config.label}</p>
                          <p className="text-sm text-muted-foreground line-clamp-2">{h.config.intro.substring(0, 120)}…</p>
                          <Badge variant="outline" className="mt-3 text-xs">Coming Soon</Badge>
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Cross-resource section */}
            <div>
              <h2 className="text-xl font-semibold text-foreground mb-4">Available Study Materials</h2>
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
                <Link to="/jobs/employment-news">
                  <Card className="hover:shadow-md transition-shadow h-full">
                    <CardContent className="p-5 flex items-start gap-3">
                      <Newspaper className="h-8 w-8 text-primary shrink-0 mt-1" />
                      <div>
                        <p className="font-semibold text-foreground">Employment News</p>
                        <p className="text-sm text-muted-foreground">Latest government job notifications</p>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              </div>
            </div>

            {/* Preparation hub links */}
            <div>
              <h2 className="text-xl font-semibold text-foreground mb-4">Explore Job Opportunities</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                <Link to="/private-jobs">
                  <Card className="hover:shadow-md transition-shadow h-full">
                    <CardContent className="p-5 flex items-start gap-3">
                      <Briefcase className="h-8 w-8 text-primary shrink-0 mt-1" />
                      <div>
                        <p className="font-semibold text-foreground">Private Jobs</p>
                        <p className="text-sm text-muted-foreground">Browse private sector openings</p>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
