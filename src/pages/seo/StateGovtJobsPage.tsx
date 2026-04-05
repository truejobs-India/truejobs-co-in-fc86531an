import { useParams, Navigate, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Layout } from '@/components/layout/Layout';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Calendar, ArrowRight, Users, MapPin } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getStateGovtJobConfig, getStateDBName } from './stateGovtJobsData';
import { buildBreadcrumbSchema, buildFAQSchema } from './schemas/seoPageSchemas';
import { JobAlertCTA } from '@/components/shared/JobAlertCTA';
import { AdPlaceholder } from '@/components/ads/AdPlaceholder';
import { FAQAccordion } from './components/FAQAccordion';
import { SEOContentSection } from './components/SEOContentSection';
import { PopularExamsBlock } from '@/pages/govt/components/PopularExamsBlock';
import { EnrichedSection } from '@/components/govt/EnrichedSection';
import { useEnrichmentOverlay } from '@/hooks/useEnrichmentOverlay';
import { deduplicateFaqs, type FAQItem } from '@/lib/faqDedup';
import { differenceInDays } from 'date-fns';

const SITE_URL = 'https://truejobs.co.in';

interface EmpNewsJob {
  id: string;
  org_name: string | null;
  post: string | null;
  slug: string | null;
  vacancies: number | null;
  salary: string | null;
  state: string | null;
  job_category: string | null;
  last_date: string | null;
  last_date_resolved: string | null;
  published_at: string | null;
}

export default function StateGovtJobsPage() {
  const { slug } = useParams<{ slug: string }>();
  const config = slug ? getStateGovtJobConfig(slug) : undefined;
  const { data: overlay } = useEnrichmentOverlay(slug);

  if (!config) return <Navigate to="/404" replace />;

  // Extract the state URL slug (e.g., "delhi" from "govt-jobs-delhi")
  const stateUrlSlug = config.slug.replace('govt-jobs-', '');
  const dbStateName = getStateDBName(stateUrlSlug);

  // Fetch state-specific jobs from employment_news_jobs
  const { data: stateJobs, isLoading } = useQuery({
    queryKey: ['state-emp-jobs', dbStateName],
    queryFn: async () => {
      const { data } = await supabase
        .from('employment_news_jobs')
        .select('id, org_name, post, slug, vacancies, salary, state, job_category, last_date, last_date_resolved, published_at')
        .eq('status', 'published')
        .eq('state', dbStateName)
        .order('published_at', { ascending: false, nullsFirst: false })
        .limit(50);
      return (data as unknown as EmpNewsJob[]) || [];
    },
  });

  // Fetch all-India fallback jobs (state IS NULL) — only used if state-specific count < 3
  const { data: fallbackJobs } = useQuery({
    queryKey: ['state-fallback-jobs'],
    queryFn: async () => {
      const { data } = await supabase
        .from('employment_news_jobs')
        .select('id, org_name, post, slug, vacancies, salary, state, job_category, last_date, last_date_resolved, published_at')
        .eq('status', 'published')
        .is('state', null)
        .order('published_at', { ascending: false, nullsFirst: false })
        .limit(10);
      return (data as unknown as EmpNewsJob[]) || [];
    },
    enabled: !isLoading && (!stateJobs || stateJobs.length < 3),
  });

  const showFallback = !isLoading && stateJobs && stateJobs.length < 3 && fallbackJobs && fallbackJobs.length > 0;

  const breadcrumbSchema = buildBreadcrumbSchema([
    { name: 'Home', url: '/' },
    { name: 'Sarkari Jobs', url: '/sarkari-jobs' },
    { name: config.h1, url: `/${config.slug}` },
  ]);
  const faqSchema = buildFAQSchema(config.faqItems);

  // Build state-aware quick links including qualification cross-links
  const quickLinks = [
    { label: 'Latest Sarkari Jobs', href: '/sarkari-jobs' },
    { label: '10th Pass Govt Jobs', href: '/10th-pass-govt-jobs' },
    { label: '12th Pass Govt Jobs', href: '/12th-pass-govt-jobs' },
    { label: 'Graduate Govt Jobs', href: '/graduate-govt-jobs' },
    { label: 'SSC Jobs', href: '/ssc-jobs' },
    { label: 'Railway Jobs', href: '/railway-jobs' },
    { label: 'Banking Jobs', href: '/banking-jobs' },
    { label: 'Defence Jobs', href: '/defence-jobs' },
    { label: 'Closing This Week', href: '/govt-jobs-last-date-this-week' },
    { label: 'Jobs Without Exam', href: '/govt-jobs-without-exam' },
    { label: 'All Sarkari Jobs A-Z', href: '/all-sarkari-jobs' },
  ];

  const renderJobCard = (job: EmpNewsJob) => {
    const daysLeft = job.last_date_resolved
      ? differenceInDays(new Date(job.last_date_resolved), new Date())
      : null;

    return (
      <Link
        key={job.id}
        to={job.slug ? `/jobs/employment-news/${job.slug}` : '#'}
        className="block rounded-lg border border-border/60 p-4 hover:border-primary/50 hover:bg-primary/5 transition-colors"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="font-medium text-foreground mb-1 line-clamp-2">
              {job.org_name || 'Government Organization'}
            </h3>
            {job.post && (
              <p className="text-sm text-muted-foreground mb-1 line-clamp-1">{job.post}</p>
            )}
            <div className="flex flex-wrap gap-2 text-sm text-muted-foreground mb-2">
              {job.vacancies && job.vacancies > 0 && (
                <span className="inline-flex items-center gap-1">
                  <Users className="h-3.5 w-3.5" /> {job.vacancies.toLocaleString('en-IN')} Vacancies
                </span>
              )}
              {job.state && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" /> {job.state}
                </span>
              )}
              {job.job_category && (
                <Badge variant="outline" className="text-[10px]">{job.job_category}</Badge>
              )}
            </div>
            {daysLeft !== null && daysLeft >= 0 && daysLeft <= 7 && (
              <Badge variant="destructive" className="text-xs">
                {daysLeft === 0 ? 'Closing Today' : daysLeft === 1 ? 'Closing Tomorrow' : `Closing in ${daysLeft} days`}
              </Badge>
            )}
          </div>
          {(job.last_date_resolved || job.last_date) && (
            <div className="text-right shrink-0">
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <Calendar className="h-3 w-3" />
                Last Date: {job.last_date_resolved || job.last_date}
              </span>
            </div>
          )}
        </div>
      </Link>
    );
  };

  return (
    <Layout>
      <Helmet>
        <title>{config.metaTitle} | TrueJobs</title>
        <meta name="description" content={config.metaDescription} />
        <link rel="canonical" href={`${SITE_URL}/${config.slug}`} />
        <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />
        <meta property="og:title" content={`${config.metaTitle} | TrueJobs`} />
        <meta property="og:description" content={config.metaDescription} />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={`${SITE_URL}/${config.slug}`} />
        <meta property="og:image" content={`${SITE_URL}/og-image.png`} />
        <meta property="og:site_name" content="TrueJobs" />
        <script type="application/ld+json">{JSON.stringify(breadcrumbSchema)}</script>
        <script type="application/ld+json">{JSON.stringify(faqSchema)}</script>
      </Helmet>

      <div className="container mx-auto px-4 py-8 md:py-12">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
        <main>
        <nav aria-label="Breadcrumb" className="mb-6 text-sm text-muted-foreground">
          <ol className="flex items-center gap-1.5 flex-wrap">
            <li><Link to="/" className="hover:text-foreground transition-colors">Home</Link></li>
            <li>/</li>
            <li><Link to="/sarkari-jobs" className="hover:text-foreground transition-colors">Sarkari Jobs</Link></li>
            <li>/</li>
            <li className="text-foreground font-medium">{config.state}</li>
          </ol>
        </nav>

        <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-6">{config.h1}</h1>

        <SEOContentSection htmlContent={config.introContent} />

        <AdPlaceholder variant="banner" />

        <section className="mb-10">
          <h2 className="text-2xl font-semibold text-foreground mb-4">
            Latest Govt Jobs in {config.state}
          </h2>

          {isLoading ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-24 w-full rounded-lg" />
              ))}
            </div>
          ) : stateJobs && stateJobs.length > 0 ? (
            <>
              <p className="text-sm text-muted-foreground mb-4">
                {stateJobs.length} government jobs found in {config.state}
              </p>
              <div className="space-y-3">
                {stateJobs.map(renderJobCard)}
              </div>
            </>
          ) : (
            <p className="text-muted-foreground py-4 text-center">
              No {config.state}-specific government jobs found currently. Check the all-India opportunities below.
            </p>
          )}
        </section>

        {/* All-India Fallback Section */}
        {showFallback && (
          <section className="mb-10">
            <h2 className="text-xl font-semibold text-foreground mb-3">
              All-India Government Jobs
            </h2>
            <p className="text-sm text-muted-foreground mb-4">
              These central government jobs accept applications from candidates across India, including {config.state}.
            </p>
            <div className="space-y-3">
              {fallbackJobs!.map(renderJobCard)}
            </div>
          </section>
        )}

        <AdPlaceholder variant="in-content" />

        <PopularExamsBlock />

        {/* Supplemental enrichment sections */}
        {overlay && (() => {
          const skipKeys = new Set(['overview', 'faq']);
          const entries = Object.entries(overlay.enrichment_data).filter(([k]) => !skipKeys.has(k));
          return entries.map(([key, value]) => (
            <EnrichedSection
              key={key}
              title={key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())}
              content={String(value)}
              type={typeof value === 'string' && value.includes('<') ? 'html' : 'text'}
            />
          ));
        })()}

        {/* FAQ — merge static + enrichment */}
        {(() => {
          const staticFaqs: FAQItem[] = config.faqItems;
          const enrichmentFaqs: FAQItem[] = overlay?.enrichment_data?.faq
            ? (overlay.enrichment_data.faq as FAQItem[])
            : [];
          const mergedFaqs = deduplicateFaqs(staticFaqs, enrichmentFaqs);
          return mergedFaqs.length > 0 ? <FAQAccordion items={mergedFaqs} /> : null;
        })()}

        <section className="mb-10">
          <h2 className="text-xl font-semibold text-foreground mb-4">Explore More Government Jobs</h2>
          <div className="flex flex-wrap gap-2">
            {quickLinks.map((link) => (
              <Link
                key={link.href}
                to={link.href}
                className="inline-flex items-center gap-1 rounded-lg border border-border/60 bg-card px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
              >
                {link.label}
                <ArrowRight className="h-3 w-3" />
              </Link>
            ))}
          </div>
        </section>

        <JobAlertCTA variant="banner" context={config?.state || 'Government Jobs'} className="mb-6" />

        <div className="rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 p-4 text-sm text-amber-800 dark:text-amber-200">
          <strong>Disclaimer:</strong> TrueJobs aggregates information from official sources. Always verify details on the official recruitment website. We are not affiliated with any government body.
        </div>
      </main>
    </Layout>
  );
}
