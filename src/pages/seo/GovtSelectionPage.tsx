import { useParams, Navigate, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Layout } from '@/components/layout/Layout';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { FileText, Calendar, ArrowRight } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { parseSelectionSlug, buildSelectionPageConfig } from './selectionPageData';
import { buildBreadcrumbSchema, buildFAQSchema } from './schemas/seoPageSchemas';
import { AdPlaceholder } from '@/components/ads/AdPlaceholder';
import { FAQAccordion } from './components/FAQAccordion';
import { SEOContentSection } from './components/SEOContentSection';
import { format, differenceInDays } from 'date-fns';

const SITE_URL = 'https://truejobs.co.in';

const SELECTION_TYPES_NO_EXAM = ['interview', 'merit', 'direct_recruitment'];

export default function GovtSelectionPage() {
  const { slug } = useParams<{ slug: string }>();
  const parsed = slug ? parseSelectionSlug(slug) : null;

  if (!parsed) return <Navigate to="/404" replace />;

  const config = buildSelectionPageConfig(parsed);

  const { data: exams, isLoading } = useQuery({
    queryKey: ['selection-exams', parsed.slug],
    queryFn: async () => {
      let query = supabase
        .from('govt_exams')
        .select('id, exam_name, slug, conducting_body, qualification_required, application_end, selection_stages, selection_type, status, total_vacancies, updated_at')
        .in('selection_type', SELECTION_TYPES_NO_EXAM)
        .order('updated_at', { ascending: false })
        .limit(50);

      if (parsed.department) {
        query = query.ilike('exam_category', `%${parsed.department}%`);
      }
      if (parsed.qualification) {
        query = query.contains('qualification_tags', [parsed.qualification]);
      }
      if (parsed.state) {
        query = query.contains('states', [parsed.state.replace(/-/g, ' ')]);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  const breadcrumbSchema = buildBreadcrumbSchema([
    { name: 'Home', url: '/' },
    { name: 'Sarkari Jobs', url: '/sarkari-jobs' },
    { name: config.h1, url: `/${config.slug}` },
  ]);

  const faqSchema = buildFAQSchema(config.faqItems);

  const quickLinks = [
    { label: 'Latest Govt Jobs', href: '/sarkari-jobs' },
    { label: 'SSC Jobs', href: '/ssc-jobs' },
    { label: 'Railway Jobs', href: '/railway-jobs' },
    { label: '10th Pass Govt Jobs', href: '/10th-pass-govt-jobs' },
    { label: '12th Pass Govt Jobs', href: '/12th-pass-govt-jobs' },
    { label: 'Graduate Govt Jobs', href: '/graduate-govt-jobs' },
    { label: 'Closing Soon', href: '/closing-soon-govt-jobs' },
    { label: 'Exam Calendar', href: '/govt-exam-calendar' },
  ];

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

      <main className="container mx-auto px-4 py-8 md:py-12 max-w-4xl">
        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="mb-6 text-sm text-muted-foreground">
          <ol className="flex items-center gap-1.5 flex-wrap">
            <li><Link to="/" className="hover:text-foreground transition-colors">Home</Link></li>
            <li>/</li>
            <li><Link to="/sarkari-jobs" className="hover:text-foreground transition-colors">Sarkari Jobs</Link></li>
            <li>/</li>
            <li className="text-foreground font-medium">{config.h1}</li>
          </ol>
        </nav>

        {/* H1 */}
        <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-6">{config.h1}</h1>

        {/* SEO Intro Content */}
        <SEOContentSection htmlContent={config.introContent} />

        <AdPlaceholder variant="banner" />

        {/* Job Listings */}
        <section className="mb-10">
          <h2 className="text-2xl font-semibold text-foreground mb-4">
            Latest Jobs Without Written Exam
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
                const daysLeft = exam.application_end
                  ? differenceInDays(new Date(exam.application_end), new Date())
                  : null;

                return (
                  <Link
                    key={exam.id}
                    to={`/sarkari-jobs/${exam.slug}`}
                    className="block rounded-lg border border-border/60 p-4 hover:border-primary/50 hover:bg-primary/5 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <h3 className="font-medium text-foreground mb-1 line-clamp-2">{exam.exam_name}</h3>
                        <div className="flex flex-wrap gap-2 text-sm text-muted-foreground mb-2">
                          {exam.conducting_body && (
                            <span className="inline-flex items-center gap-1">
                              <FileText className="h-3.5 w-3.5" /> {exam.conducting_body}
                            </span>
                          )}
                          {exam.total_vacancies && exam.total_vacancies > 0 && (
                            <span>{exam.total_vacancies} Vacancies</span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {exam.selection_type && (
                            <Badge variant="secondary" className="text-xs capitalize">
                              {exam.selection_type.replace(/_/g, ' ')}
                            </Badge>
                          )}
                          {daysLeft !== null && daysLeft >= 0 && daysLeft <= 3 && (
                            <Badge variant="destructive" className="text-xs">
                              {daysLeft === 0 ? 'Closing Today' : daysLeft === 1 ? 'Closing Tomorrow' : `Closing in ${daysLeft} days`}
                            </Badge>
                          )}
                        </div>
                      </div>
                      {exam.application_end && (
                        <div className="text-right shrink-0">
                          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            Last Date: {format(new Date(exam.application_end), 'dd MMM yyyy')}
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
              No matching job notifications found at this time. Please check back later.
            </p>
          )}
        </section>

        {/* FAQ Section */}
        <FAQAccordion items={config.faqItems} />

        {/* Quick Links */}
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

        {/* Disclaimer */}
        <div className="rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 p-4 text-sm text-amber-800 dark:text-amber-200">
          <strong>Disclaimer:</strong> TrueJobs aggregates information from official sources. Always verify details on the official recruitment website. We are not affiliated with any government body.
        </div>
      </main>
    </Layout>
  );
}
