import { useParams, Navigate, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Layout } from '@/components/layout/Layout';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { Calendar, Clock, Users, ArrowRight, AlertTriangle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { buildBreadcrumbSchema, buildFAQSchema } from './schemas/seoPageSchemas';
import { JobAlertCTA } from '@/components/shared/JobAlertCTA';
import { AdPlaceholder } from '@/components/ads/AdPlaceholder';
import { FAQAccordion } from './components/FAQAccordion';
import { PopularExamsBlock } from '@/pages/govt/components/PopularExamsBlock';
import { format, differenceInDays, addDays, startOfMonth, endOfMonth } from 'date-fns';
import type { FAQItem } from './types';

const SITE_URL = 'https://truejobs.co.in';

export type DeadlineType = 'today' | 'this-week' | 'month';

export interface DeadlinePageConfig {
  slug: string;
  deadlineType: DeadlineType;
  month?: number; // 1-12 for month pages
  year?: number;
  h1: string;
  metaTitle: string;
  metaDescription: string;
  faqItems: FAQItem[];
}

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function buildMonthPages(): DeadlinePageConfig[] {
  const year = 2026;
  return MONTHS.map((name, i) => ({
    slug: `govt-jobs-last-date-${name.toLowerCase()}-${year}`,
    deadlineType: 'month' as DeadlineType,
    month: i + 1,
    year,
    h1: `Govt Jobs Closing in ${name} ${year}`,
    metaTitle: `Govt Jobs Last Date ${name} ${year}`,
    metaDescription: `List of government jobs with last date of application in ${name} ${year}. Apply before the deadline. SSC, Railway, Banking, UPSC & state govt exams closing in ${name}.`,
    faqItems: [
      { question: `Which govt jobs are closing in ${name} ${year}?`, answer: `Multiple central and state government exams have their application deadline in ${name} ${year}. Check the list above for SSC, Railway, Banking, Defence, and UPSC vacancies.` },
      { question: `How do I apply before the last date?`, answer: `Click the "Apply" link next to each exam to visit the official application portal. Ensure you have scanned documents ready before starting the form.` },
      { question: `Can I apply after the last date?`, answer: `Generally, no. Some exams offer a late fee window of 2-3 days, but it's best to apply well before the deadline.` },
    ],
  }));
}

const DEADLINE_PAGES: DeadlinePageConfig[] = [
  {
    slug: 'govt-jobs-last-date-today',
    deadlineType: 'today',
    h1: 'Govt Jobs — Last Date to Apply Today',
    metaTitle: 'Govt Jobs Last Date Today — Apply Now',
    metaDescription: 'Government jobs whose application deadline is today. Hurry, apply now before the window closes. SSC, Railway, Banking & more.',
    faqItems: [
      { question: 'Which govt jobs have last date today?', answer: 'This page lists all government exam notifications whose application deadline falls on today\'s date. The list updates automatically.' },
      { question: 'What happens if I miss today\'s deadline?', answer: 'Most government exams do not accept late applications. A few may offer a late fee window. Always check the official notification for details.' },
    ],
  },
  {
    slug: 'govt-jobs-last-date-this-week',
    deadlineType: 'this-week',
    h1: 'Govt Jobs Closing This Week — Apply Before Deadline',
    metaTitle: 'Govt Jobs Last Date This Week',
    metaDescription: 'Government jobs with application deadline this week. Don\'t miss out — apply now. SSC, Railway, Banking, UPSC & state govt exams.',
    faqItems: [
      { question: 'Which govt jobs are closing this week?', answer: 'All government exams with application deadlines in the next 7 days are listed here. The list refreshes automatically.' },
      { question: 'How do I set a reminder for deadlines?', answer: 'Join our Telegram channel for instant deadline reminders, or enable browser notifications from your TrueJobs dashboard.' },
    ],
  },
  ...buildMonthPages(),
];

const slugMap = new Map(DEADLINE_PAGES.map(p => [p.slug, p]));

export function getDeadlinePageConfig(slug: string): DeadlinePageConfig | undefined {
  return slugMap.get(slug);
}

export function isDeadlineSlug(slug: string): boolean {
  return slugMap.has(slug);
}

export function getAllDeadlineSlugs(): string[] {
  return DEADLINE_PAGES.map(p => p.slug);
}

export default function DeadlineJobsPage() {
  const { slug } = useParams<{ slug: string }>();
  const config = slug ? getDeadlinePageConfig(slug) : undefined;

  if (!config) return <Navigate to="/404" replace />;

  const { data: exams, isLoading } = useQuery({
    queryKey: ['deadline-exams', config.slug],
    queryFn: async () => {
      let query = supabase
        .from('employment_news_jobs')
        .select('id, org_name, post, slug, last_date_resolved, vacancies, salary, status')
        .eq('status', 'published')
        .not('last_date_resolved', 'is', null);

      const today = new Date().toISOString().split('T')[0];

      if (config.deadlineType === 'today') {
        query = query.eq('last_date_resolved', today);
      } else if (config.deadlineType === 'this-week') {
        const weekEnd = addDays(new Date(), 7).toISOString().split('T')[0];
        query = query.gte('last_date_resolved', today).lte('last_date_resolved', weekEnd);
      } else if (config.deadlineType === 'month' && config.month && config.year) {
        const monthStart = startOfMonth(new Date(config.year, config.month - 1)).toISOString().split('T')[0];
        const monthEnd = endOfMonth(new Date(config.year, config.month - 1)).toISOString().split('T')[0];
        query = query.gte('last_date_resolved', monthStart).lte('last_date_resolved', monthEnd);
      }

      query = query.order('last_date_resolved', { ascending: true }).limit(50);

      const { data } = await query;
      return (data as any[]) || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  const canonicalUrl = `${SITE_URL}/${config.slug}`;
  const breadcrumbSchema = buildBreadcrumbSchema([
    { name: 'Home', url: '/' },
    { name: 'Sarkari Jobs', url: '/sarkari-jobs' },
    { name: config.h1, url: `/${config.slug}` },
  ]);
  const faqSchema = config.faqItems.length > 0 ? buildFAQSchema(config.faqItems) : null;

  return (
    <Layout>
      <Helmet>
        <title>{config.metaTitle} | TrueJobs</title>
        <meta name="description" content={config.metaDescription} />
        <link rel="canonical" href={canonicalUrl} />
        <meta property="og:title" content={config.metaTitle} />
        <meta property="og:description" content={config.metaDescription} />
        <meta property="og:url" content={canonicalUrl} />
        <script type="application/ld+json">{JSON.stringify(breadcrumbSchema)}</script>
        {faqSchema && <script type="application/ld+json">{JSON.stringify(faqSchema)}</script>}
      </Helmet>

      <div className="container mx-auto px-4 py-6">
        <nav className="flex items-center gap-1 text-sm text-muted-foreground mb-4">
          <Link to="/" className="hover:text-foreground">Home</Link>
          <span>›</span>
          <Link to="/sarkari-jobs" className="hover:text-foreground">Sarkari Jobs</Link>
          <span>›</span>
          <span className="text-foreground">{config.h1}</span>
        </nav>

        <div className="flex items-center gap-3 mb-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold font-['Outfit',sans-serif]">{config.h1}</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {config.deadlineType === 'today' && 'These exams close today — apply immediately!'}
              {config.deadlineType === 'this-week' && 'Deadlines approaching within the next 7 days.'}
              {config.deadlineType === 'month' && `Application deadlines in ${MONTHS[(config.month || 1) - 1]} ${config.year}.`}
            </p>
          </div>
        </div>

        <AdPlaceholder variant="banner" />

        {isLoading ? (
          <div className="space-y-3">
            {[1,2,3,4].map(i => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
          </div>
        ) : exams && exams.length > 0 ? (
          <div className="space-y-3 mb-8">
            {exams.map((exam: any) => {
              const title = exam.post
                ? `${exam.org_name || 'Govt'} — ${exam.post}`
                : exam.org_name || 'Government Job';
              const daysLeft = differenceInDays(new Date(exam.last_date_resolved), new Date());
              return (
                <Link key={exam.id} to={`/jobs/employment-news/${exam.slug}`}>
                  <Card className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <h2 className="font-semibold text-foreground text-sm sm:text-base truncate">{title}</h2>
                        <div className="flex flex-wrap gap-2 mt-1 text-xs text-muted-foreground">
                          {exam.org_name && <span>{exam.org_name}</span>}
                          {exam.vacancies > 0 && (
                            <span className="flex items-center gap-1"><Users className="h-3 w-3" />{exam.vacancies.toLocaleString()} vacancies</span>
                          )}
                          {exam.salary && <span>{exam.salary}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <Badge variant={daysLeft <= 1 ? 'destructive' : daysLeft <= 3 ? 'default' : 'secondary'} className="text-xs">
                          <Clock className="h-3 w-3 mr-1" />
                          {daysLeft === 0 ? 'Last day!' : daysLeft < 0 ? 'Closed' : `${daysLeft}d left`}
                        </Badge>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(exam.last_date_resolved), 'dd MMM yyyy')}
                        </span>
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        ) : (
          <Card className="mb-8">
            <CardContent className="p-8 text-center text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="font-medium">No exams with deadline in this period.</p>
              <p className="text-sm mt-1">Check back later or browse all <Link to="/sarkari-jobs" className="text-primary hover:underline">Sarkari Jobs</Link>.</p>
            </CardContent>
          </Card>
        )}

        <AdPlaceholder variant="in-content" />

        {/* Quick links to other deadline pages */}
        <Card className="mb-8">
          <CardContent className="p-5">
            <h2 className="font-semibold text-foreground mb-3">Browse by Deadline</h2>
            <div className="flex flex-wrap gap-2">
              <Link to="/govt-jobs-last-date-today" className="text-xs px-3 py-1.5 rounded-full bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors">Last Date Today</Link>
              <Link to="/govt-jobs-last-date-this-week" className="text-xs px-3 py-1.5 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors">This Week</Link>
              {MONTHS.map((m, i) => (
                <Link key={m} to={`/govt-jobs-last-date-${m.toLowerCase()}-2026`} className="text-xs px-3 py-1.5 rounded-full bg-secondary text-secondary-foreground hover:bg-accent transition-colors">{m}</Link>
              ))}
            </div>
          </CardContent>
        </Card>

        {config.faqItems.length > 0 && (
          <FAQAccordion items={config.faqItems} />
        )}

        <PopularExamsBlock />
        <JobAlertCTA variant="compact" context="Upcoming Deadlines" className="mt-6" />
      </div>
    </Layout>
  );
}
