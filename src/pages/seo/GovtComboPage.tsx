import { useParams, Navigate, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Layout } from '@/components/layout/Layout';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { FileText, Calendar, ArrowRight, Clock } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getComboPageConfig } from './govtComboData';
import { buildBreadcrumbSchema, buildFAQSchema } from './schemas/seoPageSchemas';
import { JobAlertCTA } from '@/components/shared/JobAlertCTA';
import { AdPlaceholder } from '@/components/ads/AdPlaceholder';
import { FAQAccordion } from './components/FAQAccordion';
import { SEOContentSection } from './components/SEOContentSection';
import { PopularExamsBlock } from '@/pages/govt/components/PopularExamsBlock';
import { format, differenceInDays } from 'date-fns';

const SITE_URL = 'https://truejobs.co.in';

export default function GovtComboPage() {
  const { slug } = useParams<{ slug: string }>();
  const config = slug ? getComboPageConfig(slug) : undefined;

  if (!config) return <Navigate to="/404" replace />;

  const { data: exams, isLoading } = useQuery({
    queryKey: ['combo-exams', config.slug],
    queryFn: async () => {
      let query = supabase
        .from('employment_news_jobs')
        .select('id, org_name, post, slug, qualification, last_date_resolved, vacancies, job_category, state, status')
        .eq('status', 'published');

      // Department filter — use DEPT_CONFIG if available, else keyword match
      if (config.dbFilters.departmentKey) {
        const deptKey = config.dbFilters.departmentKey;
        query = query.or(`job_category.ilike.%${deptKey}%,org_name.ilike.%${deptKey}%`);
      }

      // State filter
      if (config.dbFilters.stateSlug) {
        const stateName = config.dbFilters.stateSlug.replace(/-/g, ' ');
        query = query.ilike('state', `%${stateName}%`);
      }

      // Qualification filter
      if (config.dbFilters.qualTag) {
        query = query.ilike('qualification', `%${config.dbFilters.qualTag}%`);
      }

      // Closing-soon: last_date_resolved within next 7 days
      if (config.dbFilters.closingSoon) {
        const today = new Date().toISOString().split('T')[0];
        const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];
        query = query.gte('last_date_resolved', today).lte('last_date_resolved', nextWeek);
      }

      const { data, error } = await query
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data || [];
    },
  });

  // Breadcrumb
  const breadcrumbItems = [
    { name: 'Home', url: '/' },
    { name: 'Sarkari Jobs', url: '/sarkari-jobs' },
  ];
  if (config.comboType === 'dept-state' && config.dbFilters.departmentKey) {
    breadcrumbItems.push({ name: `${config.dbFilters.departmentKey.toUpperCase()} Jobs`, url: `/${config.dbFilters.departmentKey}-jobs` });
  }
  if (config.comboType === 'closing-soon' && config.dbFilters.stateSlug) {
    const stateName = config.dbFilters.stateSlug.replace(/\b\w/g, c => c.toUpperCase());
    breadcrumbItems.push({ name: `Govt Jobs ${stateName}`, url: `/govt-jobs-${config.dbFilters.stateSlug.replace(/ /g, '-')}` });
  }
  breadcrumbItems.push({ name: config.h1.replace(/ 2026$/, ''), url: `/${config.slug}` });

  const breadcrumbSchema = buildBreadcrumbSchema(breadcrumbItems);
  const faqSchema = buildFAQSchema(config.faqItems);

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
        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="mb-6 text-sm text-muted-foreground">
          <ol className="flex items-center gap-1.5 flex-wrap">
            {breadcrumbItems.map((item, i) => (
              <li key={item.url} className="flex items-center gap-1.5">
                {i > 0 && <span>/</span>}
                {i < breadcrumbItems.length - 1 ? (
                  <Link to={item.url} className="hover:text-foreground transition-colors">{item.name}</Link>
                ) : (
                  <span className="text-foreground font-medium">{item.name}</span>
                )}
              </li>
            ))}
          </ol>
        </nav>

        <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-6">{config.h1}</h1>

        {config.comboType === 'closing-soon' && (
          <div className="flex items-center gap-2 mb-4">
            <Badge variant="destructive" className="gap-1">
              <Clock className="h-3 w-3" /> Deadline Alert
            </Badge>
            <span className="text-sm text-muted-foreground">
              Showing jobs closing within 7 days
            </span>
          </div>
        )}

        <SEOContentSection htmlContent={config.introContent} />

        <AdPlaceholder variant="banner" />

        {/* Listings */}
        <section className="mb-10">
          <h2 className="text-2xl font-semibold text-foreground mb-4">
            {config.comboType === 'closing-soon'
              ? 'Jobs Closing This Week'
              : 'Latest Recruitment Notifications'}
          </h2>

          {isLoading ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-24 w-full rounded-lg" />
              ))}
            </div>
          ) : exams && exams.length > 0 ? (
            <div className="space-y-3">
              {exams.map((exam) => {
                const title = exam.post
                  ? `${exam.org_name || 'Govt'} — ${exam.post}`
                  : exam.org_name || 'Government Job';
                const daysLeft = exam.last_date_resolved
                  ? differenceInDays(new Date(exam.last_date_resolved), new Date())
                  : null;

                return (
                  <Link
                    key={exam.id}
                    to={`/jobs/employment-news/${exam.slug}`}
                    className="block rounded-lg border border-border/60 p-4 hover:border-primary/50 hover:bg-primary/5 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <h3 className="font-medium text-foreground mb-1 line-clamp-2">{title}</h3>
                        <div className="flex flex-wrap gap-2 text-sm text-muted-foreground mb-2">
                          {exam.org_name && (
                            <span className="inline-flex items-center gap-1">
                              <FileText className="h-3.5 w-3.5" /> {exam.org_name}
                            </span>
                          )}
                          {exam.vacancies && exam.vacancies > 0 && (
                            <span>{exam.vacancies.toLocaleString('en-IN')} Vacancies</span>
                          )}
                        </div>
                        {daysLeft !== null && daysLeft >= 0 && daysLeft <= 7 && (
                          <Badge variant="destructive" className="text-xs">
                            {daysLeft === 0 ? 'Closing Today' : daysLeft === 1 ? 'Closing Tomorrow' : `Closing in ${daysLeft} days`}
                          </Badge>
                        )}
                      </div>
                      {exam.last_date_resolved && (
                        <div className="text-right shrink-0">
                          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            Last Date: {format(new Date(exam.last_date_resolved), 'dd MMM yyyy')}
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
              {config.comboType === 'closing-soon'
                ? 'No government jobs in this state are closing this week. Check back daily for updates!'
                : 'No matching recruitment notifications found at this time. Check back soon!'}
            </p>
          )}
        </section>

        <AdPlaceholder variant="in-content" />

        <PopularExamsBlock />

        <FAQAccordion items={config.faqItems} />

        {/* Cross-links */}
        <section className="mb-10">
          <h2 className="text-xl font-semibold text-foreground mb-4">Explore More Government Jobs</h2>
          <div className="flex flex-wrap gap-2">
            {config.crossLinks.map((link) => (
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

        <JobAlertCTA variant="banner" context={config.h1} className="mb-6" />

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
