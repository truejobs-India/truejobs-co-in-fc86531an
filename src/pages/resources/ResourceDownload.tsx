import { useParams, useNavigate, Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { Layout } from '@/components/layout/Layout';
import { AdPlaceholder } from '@/components/ads/AdPlaceholder';
import { supabase } from '@/integrations/supabase/client';
import { ResourceSEO } from '@/components/resources/ResourceSEO';
import { ResourceSubscribeCTA } from '@/components/resources/ResourceSubscribeCTA';
import { RelatedResources } from '@/components/resources/RelatedResources';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Download, Shield, Bell, BookOpen, Award, Users, CheckCircle } from 'lucide-react';
import { RESOURCE_TYPE_PATHS, PATH_TO_RESOURCE_TYPE, getDefaultCover, type ResourceType } from '@/lib/resourceHubs';
import { toast } from '@/hooks/use-toast';

export default function ResourceDownload() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const pathname = window.location.pathname;
  const [resource, setResource] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  const derivedType: ResourceType = (() => {
    for (const [path, type] of Object.entries(PATH_TO_RESOURCE_TYPE)) {
      if (pathname.startsWith(`/${path}`)) return type;
    }
    return 'sample_paper';
  })();

  const typePath = RESOURCE_TYPE_PATHS[derivedType];
  const typeLabel = typePath === 'books' ? 'Books' : typePath === 'sample-papers' ? 'Sample Papers' : typePath === 'guides' ? 'Guides' : 'Previous Year Papers';

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
        toast({ title: 'Resource not available', description: 'This resource cannot be downloaded.', variant: 'destructive' });
        navigate(`/${typePath}`, { replace: true });
        return;
      }
      setResource(data);
      setLoading(false);
    }
    fetchResource();
  }, [slug, typePath, navigate]);

  const logEvent = (eventType: string) => {
    if (!resource) return;
    supabase.rpc('log_resource_event', {
      p_resource_id: resource.id,
      p_event_type: eventType,
      p_user_agent: navigator.userAgent?.substring(0, 500) || null,
      p_referrer: document.referrer?.substring(0, 500) || null,
    });
  };

  const handleFinalDownload = () => {
    if (!resource?.file_url) {
      toast({ title: 'File temporarily unavailable', description: 'Please try again later or contact us.', variant: 'destructive' });
      return;
    }
    setDownloading(true);
    logEvent('final_download');

    const filename = resource.download_filename || `${resource.slug}.pdf`;
    const link = document.createElement('a');
    link.href = resource.file_url;
    link.download = filename;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setTimeout(() => setDownloading(false), 2000);
  };

  if (loading || !resource) {
    return (
      <Layout>
      <AdPlaceholder variant="banner" />
        <div className="container mx-auto px-4 py-16">
          <div className="animate-pulse space-y-4 max-w-2xl mx-auto">
            <div className="h-8 bg-muted rounded w-3/4" />
            <div className="h-64 bg-muted rounded" />
          </div>
        </div>
      </Layout>
    );
  }

  const coverSrc = resource.cover_image_url || getDefaultCover(resource.category);

  const benefits = [
    { icon: Bell, text: 'Daily govt job alerts on WhatsApp & Telegram' },
    { icon: BookOpen, text: 'Free study materials, sample papers & PYPs' },
    { icon: Award, text: 'Admit card, result & cutoff notifications' },
    { icon: Shield, text: 'Deadline reminders so you never miss an application' },
    { icon: Users, text: 'Join 50,000+ aspirants preparing with TrueJobs' },
    { icon: CheckCircle, text: 'Exam calendar, eligibility checker & salary calculator' },
  ];

  return (
    <Layout>
      <ResourceSEO
        title={`Download ${resource.title}`}
        canonicalUrl={`/${typePath}/${slug}/download`}
        noindex={true}
      />

      <div className="container mx-auto px-4 py-8 max-w-3xl">
        {/* Breadcrumb */}
        <nav className="text-sm text-muted-foreground mb-6">
          <Link to="/" className="hover:text-primary">Home</Link>
          <span className="mx-2">›</span>
          <Link to={`/${typePath}`} className="hover:text-primary">{typeLabel}</Link>
          <span className="mx-2">›</span>
          <Link to={`/${typePath}/${slug}`} className="hover:text-primary line-clamp-1">{resource.title}</Link>
          <span className="mx-2">›</span>
          <span className="text-foreground">Download</span>
        </nav>

        {/* Resource summary */}
        <Card className="mb-8">
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row gap-6">
              <img
                src={coverSrc}
                alt={resource.featured_image_alt || resource.title}
                className="w-32 h-40 object-cover rounded-lg flex-shrink-0"
                onError={(e) => { (e.target as HTMLImageElement).src = getDefaultCover(null); }}
              />
              <div className="space-y-2">
                <h1 className="text-2xl font-bold text-foreground">{resource.title}</h1>
                {resource.excerpt && <p className="text-muted-foreground">{resource.excerpt}</p>}
                <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                  <span>PDF</span>
                  {resource.page_count && <span>• {resource.page_count} pages</span>}
                  {resource.language && <span>• <span className="capitalize">{resource.language}</span></span>}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Why Subscribe section */}
        <section className="mb-8">
          <h2 className="text-xl font-bold text-foreground mb-4">
            Why Subscribe to TrueJobs?
          </h2>
          <p className="text-muted-foreground mb-6">
            TrueJobs is India's trusted government job preparation platform used by thousands of aspirants.
            Get free access to the latest govt job notifications, exam updates, study materials, and expert
            preparation tips delivered directly to your phone. Never miss an important deadline or opportunity again.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
            {benefits.map((b, i) => (
              <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                <b.icon className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                <span className="text-sm text-foreground">{b.text}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Subscribe CTAs */}
        <Card className="mb-8">
          <CardContent className="p-6">
            <ResourceSubscribeCTA resourceId={resource.id} onEvent={logEvent} />
          </CardContent>
        </Card>

        {/* Trust section */}
        <div className="text-center mb-8">
          <p className="text-sm text-muted-foreground mb-2">
            Trusted by 50,000+ government exam aspirants across India
          </p>
          <p className="text-xs text-muted-foreground">
            All materials are verified and regularly updated. Free to download, no hidden charges.
          </p>
        </div>

        {/* Final Download Button */}
        <div className="text-center">
          {resource.file_url ? (
            <Button
              size="lg"
              className="gap-2 text-lg px-10 py-7"
              onClick={handleFinalDownload}
              disabled={downloading}
            >
              <Download className="h-6 w-6" />
              {downloading ? 'Starting Download...' : 'Download PDF Now — Free'}
            </Button>
          ) : (
            <div className="p-6 bg-muted rounded-lg">
              <p className="text-foreground font-medium">File temporarily unavailable</p>
              <p className="text-sm text-muted-foreground mt-2">
                Please try again later or <Link to="/contactus" className="text-primary hover:underline">contact us</Link>.
              </p>
            </div>
          )}
        </div>

        {/* Related */}
        <RelatedResources
          currentId={resource.id}
          category={resource.category}
          resourceType={derivedType}
          title="More Resources You May Like"
          limit={3}
        />
      </div>
    </Layout>
  );
}
