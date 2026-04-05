import { useParams, Navigate, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Layout } from '@/components/layout/Layout';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { FileText, Calendar, ArrowRight } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getDepartmentJobConfig } from './departmentJobsData';
import { buildBreadcrumbSchema, buildFAQSchema } from './schemas/seoPageSchemas';
import { JobAlertCTA } from '@/components/shared/JobAlertCTA';
import { AdPlaceholder } from '@/components/ads/AdPlaceholder';
import { FAQAccordion } from './components/FAQAccordion';
import { SEOContentSection } from './components/SEOContentSection';
import { PopularExamsBlock } from '@/pages/govt/components/PopularExamsBlock';
import { DEPT_CONFIG } from '@/lib/deptMapping';
import { format, differenceInDays } from 'date-fns';

const SITE_URL = 'https://truejobs.co.in';

export default function DepartmentJobsPage() {
  const { slug } = useParams<{ slug: string }>();
  const config = slug ? getDepartmentJobConfig(slug) : undefined;

  if (!config) return <Navigate to="/404" replace />;

  const deptFilter = config.deptKey ? DEPT_CONFIG[config.deptKey] : undefined;

  const { data: jobs, isLoading } = useQuery({
    queryKey: ['dept-employment-jobs', config.slug],
    queryFn: async () => {
      let query = supabase
        .from('employment_news_jobs')
        .select('id, org_name, post, slug, vacancies, last_date_resolved, published_at, job_category')
        .eq('status', 'published');
      if (deptFilter) {
        query = deptFilter.applyFilter(query);
      }
      const { data, error } = await query
        .order('published_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
  });

  const breadcrumbSchema = buildBreadcrumbSchema([
    { name: 'Home', url: '/' },
    { name: 'Sarkari Jobs', url: '/sarkari-jobs' },
    { name: `${config.department} Jobs`, url: `/${config.slug}` },
  ]);
  const faqSchema = buildFAQSchema(config.faqItems);

  const quickLinks = [
    { label: 'Latest Sarkari Jobs', href: '/sarkari-jobs' },
    { label: 'SSC Jobs', href: '/ssc-jobs' },
    { label: 'Railway Jobs', href: '/railway-jobs' },
    { label: 'Banking Jobs', href: '/banking-jobs' },
    { label: 'Defence Jobs', href: '/defence-jobs' },
    { label: 'UPSC Jobs', href: '/upsc-jobs' },
    { label: '10th Pass Govt Jobs', href: '/10th-pass-govt-jobs' },
    { label: '12th Pass Govt Jobs', href: '/12th-pass-govt-jobs' },
    { label: 'Graduate Govt Jobs', href: '/graduate-govt-jobs' },
    { label: 'Closing This Week', href: '/govt-jobs-last-date-this-week' },
    { label: 'Jobs Without Exam', href: '/govt-jobs-without-exam' },
    { label: 'Govt Salary Calculator', href: '/govt-salary-calculator' },
  ].filter(l => l.href !== `/${config.slug}`);

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
        <main className="content-area my-8">
        <nav aria-label="Breadcrumb" className="mb-6 text-sm text-muted-foreground">
          <ol className="flex items-center gap-1.5 flex-wrap">
            <li><Link to="/" className="hover:text-foreground transition-colors">Home</Link></li>
            <li>/</li>
            <li><Link to="/sarkari-jobs" className="hover:text-foreground transition-colors">Sarkari Jobs</Link></li>
            <li>/</li>
            <li className="text-foreground font-medium">{config.department} Jobs</li>
          </ol>
        </nav>

        <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-6">{config.h1}</h1>

        <SEOContentSection htmlContent={config.introContent} />

        <AdPlaceholder variant="banner" />

        <section className="mb-10">
          <h2 className="text-2xl font-semibold text-foreground mb-4">
            Latest {config.department} Recruitment Notifications
          </h2>

          {isLoading ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-24 w-full rounded-lg" />
              ))}
            </div>
          ) : jobs && jobs.length > 0 ? (
            <div className="space-y-3">
              {jobs.map((job) => {
                const daysLeft = job.last_date_resolved
                  ? differenceInDays(new Date(job.last_date_resolved), new Date())
                  : null;

                return (
                  <Link
                    key={job.id}
                    to={`/jobs/employment-news/${job.slug}`}
                    className="block rounded-lg border border-border/60 p-4 hover:border-primary/50 hover:bg-primary/5 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <h3 className="font-medium text-foreground mb-1 line-clamp-2">{job.org_name}</h3>
                        <div className="flex flex-wrap gap-2 text-sm text-muted-foreground mb-2">
                          {job.post && (
                            <span className="inline-flex items-center gap-1">
                              <FileText className="h-3.5 w-3.5" /> {job.post}
                            </span>
                          )}
                          {job.vacancies && job.vacancies > 0 && (
                            <span>{job.vacancies.toLocaleString('en-IN')} Vacancies</span>
                          )}
                        </div>
                        {daysLeft !== null && daysLeft >= 0 && daysLeft <= 7 && (
                          <Badge variant="destructive" className="text-xs">
                            {daysLeft === 0 ? 'Closing Today' : daysLeft === 1 ? 'Closing Tomorrow' : `Closing in ${daysLeft} days`}
                          </Badge>
                        )}
                      </div>
                      {job.last_date_resolved && (
                        <div className="text-right shrink-0">
                          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            Last Date: {format(new Date(job.last_date_resolved), 'dd MMM yyyy')}
                          </span>
                        </div>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <p className="text-muted-foreground py-8 text-center">
              No {config.department} recruitment notifications found at this time. Check back soon!
            </p>
          )}
        </section>

        <AdPlaceholder variant="in-content" />

        <PopularExamsBlock departmentSlug={config.slug} />

        <FAQAccordion items={config.faqItems} />

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

        <JobAlertCTA variant="banner" context={config?.department || 'Department Jobs'} className="mb-6" />

        <div className="rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 p-4 text-sm text-amber-800 dark:text-amber-200">
          <strong>Disclaimer:</strong> TrueJobs aggregates information from official sources. Always verify details on the official recruitment website. We are not affiliated with any government body.
        </div>
      </main>
        <aside className="hidden lg:block">
          <div className="sticky top-20">
            <AdPlaceholder variant="sidebar" />
          </div>
        </aside>
        </div>
      </div>
    </Layout>
  );
}
