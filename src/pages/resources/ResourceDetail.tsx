import { useParams, useNavigate, Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { Layout } from '@/components/layout/Layout';
import { supabase } from '@/integrations/supabase/client';
import { ResourceSEO } from '@/components/resources/ResourceSEO';
import { RelatedResources } from '@/components/resources/RelatedResources';
import { AdPlaceholder } from '@/components/ads/AdPlaceholder';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Download, FileText, Calendar, Globe, BookOpen, Users, ArrowRight } from 'lucide-react';
import { RESOURCE_TYPE_PATHS, PATH_TO_RESOURCE_TYPE, RESOURCE_HUBS, getDefaultCover, type ResourceType } from '@/lib/resourceHubs';
import { toast } from '@/hooks/use-toast';

export default function ResourceDetail() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const pathname = window.location.pathname;
  const [resource, setResource] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const derivedType: ResourceType = (() => {
    for (const [path, type] of Object.entries(PATH_TO_RESOURCE_TYPE)) {
      if (pathname.startsWith(`/${path}`)) return type;
    }
    return 'sample_paper';
  })();

  const typePath = RESOURCE_TYPE_PATHS[derivedType];
  const typeLabel = typePath === 'books' ? 'Books' : typePath === 'sample-papers' ? 'Sample Papers' : typePath === 'guides' ? 'Guides' : 'Previous Year Papers';
  const typeLabelSingular = typePath === 'books' ? 'book' : typePath === 'sample-papers' ? 'sample paper' : typePath === 'guides' ? 'guide' : 'previous year paper';

  useEffect(() => {
    async function fetchResource() {
      if (!slug) return;
      setLoading(true);
      const { data, error } = await supabase
        .from('pdf_resources')
        .select('*')
        .eq('slug', slug)
        .eq('is_published', true)
        .maybeSingle();

      if (!data || error) {
        toast({ title: 'Resource not found', description: 'The requested resource is not available.', variant: 'destructive' });
        navigate(`/${typePath}`, { replace: true });
        return;
      }
      setResource(data);
      setLoading(false);

      supabase.rpc('log_resource_event', {
        p_resource_id: data.id,
        p_event_type: 'page_view',
        p_user_agent: navigator.userAgent?.substring(0, 500) || null,
        p_referrer: document.referrer?.substring(0, 500) || null,
      });
    }
    fetchResource();
  }, [slug, typePath, navigate]);

  if (loading || !resource) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-16">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-muted rounded w-3/4" />
            <div className="h-4 bg-muted rounded w-1/2" />
            <div className="h-64 bg-muted rounded" />
          </div>
        </div>
      </Layout>
    );
  }

  // Indexability decision matrix (strict rules):
  // Indexable when ALL true: is_published, !is_noindex, has file_url, has title, has excerpt or meta_description
  const shouldNoindex =
    !resource.is_published ||
    resource.is_noindex ||
    !resource.file_url ||
    !resource.title ||
    (!resource.excerpt && !resource.meta_description);

  const faqItems = Array.isArray(resource.faq_schema) ? resource.faq_schema : [];
  const coverSrc = resource.cover_image_url || getDefaultCover(resource.category);

  const formatSize = (bytes: number | null) => {
    if (!bytes) return null;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const breadcrumbs = [
    { name: 'Home', url: '/' },
    { name: typeLabel, url: `/${typePath}` },
    { name: resource.title, url: `/${typePath}/${slug}` },
  ];

  const handleCtaClick = () => {
    supabase.rpc('log_resource_event', {
      p_resource_id: resource.id,
      p_event_type: 'cta_click',
      p_user_agent: navigator.userAgent?.substring(0, 500) || null,
      p_referrer: null,
    });
    navigate(`/${typePath}/${slug}/download`);
  };

  // Find matching hub for "Browse more" link
  const matchingHubSlug = (() => {
    const hubs = RESOURCE_HUBS[derivedType] || {};
    for (const [hubSlug, hubConfig] of Object.entries(hubs)) {
      for (const filter of hubConfig.dbFilters) {
        const fieldValue = resource[filter.field];
        if (fieldValue && filter.values.some(v => v.toLowerCase() === fieldValue.toLowerCase())) {
          return hubSlug;
        }
      }
    }
    return null;
  })();

  const matchingHubConfig = matchingHubSlug ? RESOURCE_HUBS[derivedType][matchingHubSlug] : null;

  // "Who Should Use This" — safe derived text using real fields only
  const examContext = resource.exam_name || resource.category || 'government';
  const whoShouldUseText = `This ${typeLabelSingular} is useful for candidates preparing for ${examContext} exams. Download the PDF for offline practice.`;

  // Resource Details metadata rows
  const detailRows: { label: string; value: string | number | null }[] = [
    { label: 'Exam', value: resource.exam_name },
    { label: 'Category', value: resource.category },
    { label: 'Subject', value: resource.subject },
    { label: 'Language', value: resource.language ? resource.language.charAt(0).toUpperCase() + resource.language.slice(1) : null },
    { label: 'Pages', value: resource.page_count },
    { label: 'File Size', value: formatSize(resource.file_size_bytes) },
    { label: 'Year', value: resource.exam_year || resource.edition_year },
  ].filter(r => r.value != null);

  return (
    <Layout>
      <ResourceSEO
        title={resource.title}
        metaTitle={resource.meta_title}
        metaDescription={resource.meta_description}
        canonicalUrl={`/${typePath}/${slug}`}
        coverImage={coverSrc}
        noindex={shouldNoindex}
        breadcrumbs={breadcrumbs}
        faqItems={faqItems}
        schemaJson={{
          '@context': 'https://schema.org',
          '@type': 'WebPage',
          name: resource.title,
          url: `https://truejobs.co.in/${typePath}/${slug}`,
          datePublished: resource.published_at,
          dateModified: resource.updated_at,
        }}
      />

      <div className="container mx-auto px-4 py-8">
        {/* Breadcrumb */}
        <nav className="text-sm text-muted-foreground mb-6">
          <Link to="/" className="hover:text-primary">Home</Link>
          <span className="mx-2">›</span>
          <Link to={`/${typePath}`} className="hover:text-primary">{typeLabel}</Link>
          <span className="mx-2">›</span>
          <span className="text-foreground line-clamp-1">{resource.title}</span>
        </nav>

        <AdPlaceholder variant="banner" />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-8">
            <div>
              {/* Badges */}
              <div className="flex flex-wrap gap-2 mb-3">
                {resource.category && <Badge variant="secondary">{resource.category}</Badge>}
                {resource.exam_name && <Badge variant="outline">{resource.exam_name}</Badge>}
                {resource.subject && <Badge variant="outline">{resource.subject}</Badge>}
              </div>

              {/* Title */}
              <h1 className="text-3xl font-bold text-foreground mb-4">{resource.title}</h1>

              {/* File metadata bar */}
              <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground mb-6">
                <span className="flex items-center gap-1">
                  <FileText className="h-4 w-4" />
                  PDF
                </span>
                {formatSize(resource.file_size_bytes) && <span>{formatSize(resource.file_size_bytes)}</span>}
                {resource.page_count && <span>{resource.page_count} pages</span>}
                {resource.language && (
                  <span className="flex items-center gap-1">
                    <Globe className="h-4 w-4" />
                    <span className="capitalize">{resource.language}</span>
                  </span>
                )}
                {resource.updated_at && (
                  <span className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    Updated {new Date(resource.updated_at).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}
                  </span>
                )}
              </div>

              {/* Download count */}
              <p className="text-sm text-muted-foreground mb-6">
                <Download className="h-4 w-4 inline mr-1" />
                {(resource.download_count || 0).toLocaleString()} downloads
              </p>
            </div>

            {/* CTA */}
            <Button size="lg" className="w-full sm:w-auto gap-2 text-lg px-8 py-6" onClick={handleCtaClick}>
              <Download className="h-5 w-5" />
              Download PDF Free
            </Button>

            {/* Resource Details card — always rendered */}
            {detailRows.length > 0 && (
              <Card>
                <CardContent className="p-6">
                  <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                    <BookOpen className="h-5 w-5 text-primary" />
                    Resource Details
                  </h2>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    {detailRows.map((row) => (
                      <div key={row.label}>
                        <p className="text-xs text-muted-foreground uppercase tracking-wide">{row.label}</p>
                        <p className="text-sm font-medium text-foreground mt-0.5">{row.value}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Who Should Use This — always rendered */}
            <Card className="bg-muted/30 border-primary/20">
              <CardContent className="p-6">
                <h2 className="text-lg font-semibold text-foreground mb-2 flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" />
                  Who Should Use This
                </h2>
                <p className="text-sm text-muted-foreground">{whoShouldUseText}</p>
                {resource.excerpt && (
                  <p className="text-sm text-muted-foreground mt-3">{resource.excerpt}</p>
                )}
              </CardContent>
            </Card>

            {/* Prose content — only if non-empty */}
            {resource.content && resource.content.trim().length > 0 && (
              <div
                className="prose prose-lg dark:prose-invert max-w-none"
                dangerouslySetInnerHTML={{ __html: resource.content }}
              />
            )}

            <AdPlaceholder variant="in-content" />

            {/* FAQ */}
            {faqItems.length > 0 && (
              <section>
                <h2 className="text-2xl font-bold text-foreground mb-4">Frequently Asked Questions</h2>
                <Accordion type="single" collapsible className="w-full">
                  {faqItems.map((faq: any, i: number) => (
                    <AccordionItem key={i} value={`faq-${i}`}>
                      <AccordionTrigger className="text-left">{faq.question}</AccordionTrigger>
                      <AccordionContent>{faq.answer}</AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </section>
            )}

            {/* Browse Hub link */}
            {matchingHubSlug && matchingHubConfig && (
              <Link
                to={`/${typePath}/hub/${matchingHubSlug}`}
                className="inline-flex items-center gap-2 text-primary hover:underline font-medium"
              >
                Browse more {matchingHubConfig.label}
                <ArrowRight className="h-4 w-4" />
              </Link>
            )}

            {/* Second CTA */}
            <Button size="lg" className="w-full sm:w-auto gap-2 text-lg px-8 py-6" onClick={handleCtaClick}>
              <Download className="h-5 w-5" />
              Download PDF Free
            </Button>
          </div>

          {/* Sidebar */}
          <aside className="space-y-6">
            <AdPlaceholder variant="sidebar" className="hidden lg:block" />
            <div className="rounded-lg overflow-hidden border border-border">
              <img
                src={coverSrc}
                alt={resource.featured_image_alt || resource.title}
                className="w-full aspect-[3/4] object-cover"
                onError={(e) => { (e.target as HTMLImageElement).src = getDefaultCover(null); }}
              />
            </div>

            {resource.tags?.length > 0 && (
              <div className="space-y-2">
                <h3 className="font-semibold text-foreground text-sm">Tags</h3>
                <div className="flex flex-wrap gap-1.5">
                  {resource.tags.map((tag: string) => (
                    <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>
                  ))}
                </div>
              </div>
            )}
          </aside>
        </div>

        {/* Related */}
        <RelatedResources
          currentId={resource.id}
          category={resource.category}
          resourceType={derivedType}
        />
      </div>
    </Layout>
  );
}
