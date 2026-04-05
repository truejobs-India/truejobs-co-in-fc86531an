import { useParams, Navigate, Link } from 'react-router-dom';
import { JobAlertCTA } from '@/components/shared/JobAlertCTA';
import { Helmet } from 'react-helmet-async';
import { Layout } from '@/components/layout/Layout';
import { Clock, Briefcase, MapPin } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { buildBreadcrumbSchema } from './schemas/seoPageSchemas';
import { formatDistanceToNow } from 'date-fns';
import { CrossLinks } from './components/CrossLinks';
import { AdPlaceholder } from '@/components/ads/AdPlaceholder';
import { getCityJobConfig } from './cityJobsData';

const SITE_URL = 'https://truejobs.co.in';

interface TodayPageConfig {
  slug: string;
  city?: string;
  keywords?: string[];
  h1: string;
  metaTitle: string;
  metaDescription: string;
}

const TODAY_PAGES: TodayPageConfig[] = [
  { slug: 'jobs-in-delhi-today', city: 'Delhi', h1: 'Jobs in Delhi Today – Latest Openings Updated Now', metaTitle: 'Jobs in Delhi Today – Latest Openings', metaDescription: 'Find jobs in Delhi posted today. Latest openings updated in real-time. Apply immediately on TrueJobs.' },
  { slug: 'jobs-in-mumbai-today', city: 'Mumbai', h1: 'Jobs in Mumbai Today – Latest Openings Updated Now', metaTitle: 'Jobs in Mumbai Today – Latest Openings', metaDescription: 'Find jobs in Mumbai posted today. Latest openings updated in real-time. Apply immediately on TrueJobs.' },
  { slug: 'jobs-in-bangalore-today', city: 'Bangalore', h1: 'Jobs in Bangalore Today – Latest Openings Updated Now', metaTitle: 'Jobs in Bangalore Today – Latest Openings', metaDescription: 'Find jobs in Bangalore posted today. Latest openings updated in real-time. Apply immediately on TrueJobs.' },
  { slug: 'jobs-in-pune-today', city: 'Pune', h1: 'Jobs in Pune Today – Latest Openings Updated Now', metaTitle: 'Jobs in Pune Today – Latest Openings', metaDescription: 'Find jobs in Pune posted today. Latest openings updated in real-time. Apply immediately on TrueJobs.' },
  { slug: 'jobs-in-hyderabad-today', city: 'Hyderabad', h1: 'Jobs in Hyderabad Today – Latest Openings Updated Now', metaTitle: 'Jobs in Hyderabad Today – Latest Openings', metaDescription: 'Find jobs in Hyderabad posted today. Latest openings updated in real-time. Apply immediately on TrueJobs.' },
  { slug: 'jobs-in-chennai-today', city: 'Chennai', h1: 'Jobs in Chennai Today – Latest Openings Updated Now', metaTitle: 'Jobs in Chennai Today – Latest Openings', metaDescription: 'Find jobs in Chennai posted today. Latest openings updated in real-time. Apply immediately on TrueJobs.' },
  { slug: 'jobs-in-kolkata-today', city: 'Kolkata', h1: 'Jobs in Kolkata Today – Latest Openings Updated Now', metaTitle: 'Jobs in Kolkata Today – Latest Openings', metaDescription: 'Find jobs in Kolkata posted today. Latest openings updated in real-time. Apply on TrueJobs.' },
  { slug: 'jobs-in-ahmedabad-today', city: 'Ahmedabad', h1: 'Jobs in Ahmedabad Today – Latest Openings Updated Now', metaTitle: 'Jobs in Ahmedabad Today – Latest Openings', metaDescription: 'Find jobs in Ahmedabad posted today. Latest openings updated in real-time. Apply on TrueJobs.' },
  { slug: 'jobs-in-jaipur-today', city: 'Jaipur', h1: 'Jobs in Jaipur Today – Latest Openings Updated Now', metaTitle: 'Jobs in Jaipur Today – Latest Openings', metaDescription: 'Find jobs in Jaipur posted today. Latest openings updated in real-time. Apply on TrueJobs.' },
  { slug: 'jobs-in-lucknow-today', city: 'Lucknow', h1: 'Jobs in Lucknow Today – Latest Openings Updated Now', metaTitle: 'Jobs in Lucknow Today – Latest Openings', metaDescription: 'Find jobs in Lucknow posted today. Latest openings updated in real-time. Apply on TrueJobs.' },
  { slug: 'jobs-in-chandigarh-today', city: 'Chandigarh', h1: 'Jobs in Chandigarh Today – Latest Openings Updated Now', metaTitle: 'Jobs in Chandigarh Today – Latest Openings', metaDescription: 'Find jobs in Chandigarh posted today. Latest openings updated in real-time. Apply on TrueJobs.' },
  { slug: 'jobs-in-indore-today', city: 'Indore', h1: 'Jobs in Indore Today – Latest Openings Updated Now', metaTitle: 'Jobs in Indore Today – Latest Openings', metaDescription: 'Find jobs in Indore posted today. Latest openings updated in real-time. Apply on TrueJobs.' },
  { slug: 'jobs-in-bhopal-today', city: 'Bhopal', h1: 'Jobs in Bhopal Today – Latest Openings Updated Now', metaTitle: 'Jobs in Bhopal Today – Latest Openings', metaDescription: 'Find jobs in Bhopal posted today. Latest openings updated in real-time. Apply on TrueJobs.' },
  { slug: 'jobs-in-patna-today', city: 'Patna', h1: 'Jobs in Patna Today – Latest Openings Updated Now', metaTitle: 'Jobs in Patna Today – Latest Openings', metaDescription: 'Find jobs in Patna posted today. Latest openings updated in real-time. Apply on TrueJobs.' },
  { slug: 'jobs-in-nagpur-today', city: 'Nagpur', h1: 'Jobs in Nagpur Today – Latest Openings Updated Now', metaTitle: 'Jobs in Nagpur Today – Latest Openings', metaDescription: 'Find jobs in Nagpur posted today. Latest openings updated in real-time. Apply on TrueJobs.' },
  { slug: 'jobs-in-coimbatore-today', city: 'Coimbatore', h1: 'Jobs in Coimbatore Today – Latest Openings Updated Now', metaTitle: 'Jobs in Coimbatore Today – Latest Openings', metaDescription: 'Find jobs in Coimbatore posted today. Latest openings updated in real-time. Apply on TrueJobs.' },
  { slug: 'jobs-in-kochi-today', city: 'Kochi', h1: 'Jobs in Kochi Today – Latest Openings Updated Now', metaTitle: 'Jobs in Kochi Today – Latest Openings', metaDescription: 'Find jobs in Kochi posted today. Latest openings updated in real-time. Apply on TrueJobs.' },
  { slug: 'jobs-in-gurgaon-today', city: 'Gurgaon', h1: 'Jobs in Gurgaon Today – Latest Openings Updated Now', metaTitle: 'Jobs in Gurgaon Today – Latest Openings', metaDescription: 'Find jobs in Gurgaon posted today. Latest openings updated in real-time. Apply on TrueJobs.' },
  { slug: 'jobs-in-noida-today', city: 'Noida', h1: 'Jobs in Noida Today – Latest Openings Updated Now', metaTitle: 'Jobs in Noida Today – Latest Openings', metaDescription: 'Find jobs in Noida posted today. Latest openings updated in real-time. Apply on TrueJobs.' },
  { slug: 'jobs-in-vizag-today', city: 'Visakhapatnam', h1: 'Jobs in Vizag Today – Latest Openings Updated Now', metaTitle: 'Jobs in Vizag Today – Latest Openings', metaDescription: 'Find jobs in Visakhapatnam posted today. Latest openings updated in real-time. Apply on TrueJobs.' },
  { slug: 'private-jobs-in-noida-for-freshers-today', city: 'Noida', keywords: ['fresher', 'entry'], h1: 'Private Jobs in Noida for Freshers Today', metaTitle: 'Private Jobs in Noida for Freshers Today', metaDescription: 'Find private fresher jobs in Noida posted today. Entry-level openings updated in real-time. Apply on TrueJobs.' },
  { slug: 'private-jobs-in-delhi-for-freshers-today', city: 'Delhi', keywords: ['fresher', 'entry'], h1: 'Private Jobs in Delhi for Freshers Today', metaTitle: 'Private Jobs in Delhi for Freshers Today', metaDescription: 'Find private fresher jobs in Delhi posted today. Entry-level openings updated in real-time. Apply on TrueJobs.' },
  { slug: 'private-jobs-in-bangalore-for-freshers-today', city: 'Bangalore', keywords: ['fresher', 'entry'], h1: 'Private Jobs in Bangalore for Freshers Today', metaTitle: 'Private Jobs in Bangalore for Freshers Today', metaDescription: 'Find private fresher jobs in Bangalore posted today. Entry-level openings updated in real-time. Apply on TrueJobs.' },
  { slug: 'private-jobs-in-mumbai-for-freshers-today', city: 'Mumbai', keywords: ['fresher', 'entry'], h1: 'Private Jobs in Mumbai for Freshers Today', metaTitle: 'Private Jobs in Mumbai for Freshers Today', metaDescription: 'Find private fresher jobs in Mumbai posted today. Entry-level openings updated in real-time. Apply on TrueJobs.' },
  { slug: 'work-from-home-jobs-today', keywords: ['work from home', 'remote', 'WFH'], h1: 'Work From Home Jobs Today – Latest Remote Openings', metaTitle: 'Work From Home Jobs Today – Remote Openings', metaDescription: 'Find work from home jobs posted today. Remote and WFH openings updated in real-time. Apply on TrueJobs.' },
  { slug: 'govt-jobs-today', keywords: ['government', 'sarkari', 'govt'], h1: 'Government Jobs Today – Latest Sarkari Naukri', metaTitle: 'Govt Jobs Today – Latest Sarkari Naukri Openings', metaDescription: 'Find government jobs posted today. Latest Sarkari Naukri openings updated in real-time. Apply on TrueJobs.' },
  { slug: 'fresher-jobs-today', keywords: ['fresher', 'entry level', 'trainee'], h1: 'Fresher Jobs Today – Entry Level Openings', metaTitle: 'Fresher Jobs Today – Entry Level Openings', metaDescription: 'Find fresher and entry-level jobs posted today. Latest openings for freshers updated in real-time. Apply on TrueJobs.' },
  { slug: 'it-jobs-today', keywords: ['IT', 'software', 'developer', 'engineer'], h1: 'IT Jobs Today – Latest Software & Tech Openings', metaTitle: 'IT Jobs Today – Latest Tech Openings', metaDescription: 'Find IT and software jobs posted today. Latest tech openings updated in real-time. Apply on TrueJobs.' },
  // Expanded today pages
  { slug: 'jobs-in-surat-today', city: 'Surat', h1: 'Jobs in Surat Today – Latest Openings Updated Now', metaTitle: 'Jobs in Surat Today – Latest Openings', metaDescription: 'Find jobs in Surat posted today. Diamond, textile, and IT openings updated in real-time. Apply on TrueJobs.' },
  { slug: 'jobs-in-vadodara-today', city: 'Vadodara', h1: 'Jobs in Vadodara Today – Latest Openings Updated Now', metaTitle: 'Jobs in Vadodara Today – Latest Openings', metaDescription: 'Find jobs in Vadodara posted today. Manufacturing, IT, and pharma openings. Apply on TrueJobs.' },
  { slug: 'jobs-in-kanpur-today', city: 'Kanpur', h1: 'Jobs in Kanpur Today – Latest Openings Updated Now', metaTitle: 'Jobs in Kanpur Today – Latest Openings', metaDescription: 'Find jobs in Kanpur posted today. Manufacturing, IT, and education openings. Apply on TrueJobs.' },
  { slug: 'jobs-in-agra-today', city: 'Agra', h1: 'Jobs in Agra Today – Latest Openings Updated Now', metaTitle: 'Jobs in Agra Today – Latest Openings', metaDescription: 'Find jobs in Agra posted today. Tourism, manufacturing, and leather industry openings. Apply on TrueJobs.' },
  { slug: 'jobs-in-varanasi-today', city: 'Varanasi', h1: 'Jobs in Varanasi Today – Latest Openings Updated Now', metaTitle: 'Jobs in Varanasi Today – Latest Openings', metaDescription: 'Find jobs in Varanasi posted today. Tourism, silk, and education openings. Apply on TrueJobs.' },
  { slug: 'jobs-in-nashik-today', city: 'Nashik', h1: 'Jobs in Nashik Today – Latest Openings Updated Now', metaTitle: 'Jobs in Nashik Today – Latest Openings', metaDescription: 'Find jobs in Nashik posted today. Manufacturing, agriculture, and IT openings. Apply on TrueJobs.' },
  { slug: 'jobs-in-rajkot-today', city: 'Rajkot', h1: 'Jobs in Rajkot Today – Latest Openings Updated Now', metaTitle: 'Jobs in Rajkot Today – Latest Openings', metaDescription: 'Find jobs in Rajkot posted today. Manufacturing, SME, and engineering openings. Apply on TrueJobs.' },
  { slug: 'jobs-in-thiruvananthapuram-today', city: 'Thiruvananthapuram', h1: 'Jobs in Trivandrum Today – Latest Openings Updated Now', metaTitle: 'Jobs in Trivandrum Today – Latest Openings', metaDescription: 'Find jobs in Thiruvananthapuram posted today. IT, government, and ISRO openings. Apply on TrueJobs.' },
  { slug: 'jobs-in-mangalore-today', city: 'Mangalore', h1: 'Jobs in Mangalore Today – Latest Openings Updated Now', metaTitle: 'Jobs in Mangalore Today – Latest Openings', metaDescription: 'Find jobs in Mangalore posted today. IT, banking, and port industry openings. Apply on TrueJobs.' },
  { slug: 'jobs-in-dehradun-today', city: 'Dehradun', h1: 'Jobs in Dehradun Today – Latest Openings Updated Now', metaTitle: 'Jobs in Dehradun Today – Latest Openings', metaDescription: 'Find jobs in Dehradun posted today. Government, education, and tourism openings. Apply on TrueJobs.' },
  { slug: 'private-jobs-in-hyderabad-for-freshers-today', city: 'Hyderabad', keywords: ['fresher', 'entry'], h1: 'Private Jobs in Hyderabad for Freshers Today', metaTitle: 'Private Jobs in Hyderabad for Freshers Today', metaDescription: 'Find private fresher jobs in Hyderabad posted today. Entry-level IT and BPO openings. Apply on TrueJobs.' },
  { slug: 'private-jobs-in-pune-for-freshers-today', city: 'Pune', keywords: ['fresher', 'entry'], h1: 'Private Jobs in Pune for Freshers Today', metaTitle: 'Private Jobs in Pune for Freshers Today', metaDescription: 'Find private fresher jobs in Pune posted today. Entry-level openings. Apply on TrueJobs.' },
  { slug: 'private-jobs-in-chennai-for-freshers-today', city: 'Chennai', keywords: ['fresher', 'entry'], h1: 'Private Jobs in Chennai for Freshers Today', metaTitle: 'Private Jobs in Chennai for Freshers Today', metaDescription: 'Find private fresher jobs in Chennai posted today. Entry-level IT and manufacturing openings. Apply on TrueJobs.' },
  { slug: 'sales-jobs-today', keywords: ['sales', 'business development', 'BDM'], h1: 'Sales Jobs Today – Latest Openings', metaTitle: 'Sales Jobs Today – Latest Openings', metaDescription: 'Find sales jobs posted today. BDM, sales executive, and account manager openings. Apply on TrueJobs.' },
  { slug: 'bpo-jobs-today', keywords: ['BPO', 'call center', 'customer support'], h1: 'BPO Jobs Today – Latest Call Center Openings', metaTitle: 'BPO Jobs Today – Call Center Openings', metaDescription: 'Find BPO and call center jobs posted today. Customer support and telecalling openings. Apply on TrueJobs.' },
  { slug: 'bank-jobs-today', keywords: ['bank', 'banking', 'finance', 'PO', 'clerk'], h1: 'Bank Jobs Today – Latest Banking Openings', metaTitle: 'Bank Jobs Today – Banking Openings', metaDescription: 'Find bank jobs posted today. PO, clerk, and specialist banking openings. Apply on TrueJobs.' },
  { slug: 'data-entry-jobs-today', keywords: ['data entry', 'typing', 'back office'], h1: 'Data Entry Jobs Today – Latest Typing & Data Openings', metaTitle: 'Data Entry Jobs Today – Latest Openings', metaDescription: 'Find data entry and typing jobs posted today. Back office and data processing openings. Apply on TrueJobs.' },
  { slug: 'marketing-jobs-today', keywords: ['marketing', 'digital marketing', 'SEO', 'social media'], h1: 'Marketing Jobs Today – Latest Digital & Brand Openings', metaTitle: 'Marketing Jobs Today – Latest Openings', metaDescription: 'Find marketing jobs posted today. Digital marketing, SEO, and brand management openings. Apply on TrueJobs.' },
  { slug: 'teaching-jobs-today', keywords: ['teacher', 'teaching', 'professor', 'tutor'], h1: 'Teaching Jobs Today – Latest Education Openings', metaTitle: 'Teaching Jobs Today – Latest Openings', metaDescription: 'Find teaching jobs posted today. Teacher, professor, and tutor openings. Apply on TrueJobs.' },
  { slug: 'engineering-jobs-today', keywords: ['engineer', 'engineering', 'mechanical', 'civil', 'electrical'], h1: 'Engineering Jobs Today – Latest Openings', metaTitle: 'Engineering Jobs Today – Latest Openings', metaDescription: 'Find engineering jobs posted today. Mechanical, civil, and electrical engineering openings. Apply on TrueJobs.' },
];

export function getTodayPageConfig(slug: string): TodayPageConfig | undefined {
  return TODAY_PAGES.find(p => p.slug === slug);
}

export function getAllTodaySlugs(): string[] {
  return TODAY_PAGES.map(p => p.slug);
}

function useTodayJobs(config: TodayPageConfig) {
  return useQuery({
    queryKey: ['today-jobs', config.slug],
    queryFn: async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      let query = supabase
        .from('jobs')
        .select('id, title, slug, company_name, city, location, salary_min, salary_max, created_at, is_remote, is_work_from_home')
        .eq('status', 'active')
        .eq('is_deleted', false)
        .eq('is_duplicate', false)
        .gte('created_at', today.toISOString())
        .order('created_at', { ascending: false })
        .limit(25);

      if (config.city) {
        query = query.ilike('city', config.city);
      }

      if (config.keywords?.length) {
        const orFilter = config.keywords.map(k => `title.ilike.%${k}%`).join(',');
        query = query.or(orFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
  });
}

export default function TodayJobsPage() {
  const { slug } = useParams<{ slug: string }>();
  const config = slug ? getTodayPageConfig(slug) : undefined;

  if (!config) return <Navigate to="/404" replace />;

  const { data: jobs, isLoading } = useTodayJobs(config);
  const todayStr = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

  const breadcrumbSchema = buildBreadcrumbSchema([
    { name: 'Home', url: '/' },
    { name: 'Jobs', url: '/jobs' },
    { name: config.h1, url: `/${config.slug}` },
  ]);

  return (
    <Layout>
      <Helmet>
        <title>{config.metaTitle} | TrueJobs</title>
        <meta name="description" content={config.metaDescription} />
        <link rel="canonical" href={`${SITE_URL}/${config.slug}`} />
        <meta name="robots" content="index, follow" />
        <script type="application/ld+json">{JSON.stringify(breadcrumbSchema)}</script>
      </Helmet>

      <div className="container mx-auto px-4 py-8 md:py-12">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
        <main className="content-area my-8">
        <nav aria-label="Breadcrumb" className="mb-6 text-sm text-muted-foreground">
          <ol className="flex items-center gap-1.5 flex-wrap">
            <li><Link to="/" className="hover:text-foreground transition-colors">Home</Link></li>
            <li>/</li>
            <li><Link to="/jobs" className="hover:text-foreground transition-colors">Jobs</Link></li>
            <li>/</li>
            <li className="text-foreground font-medium">{config.h1}</li>
          </ol>
        </nav>

        <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4 leading-tight">{config.h1}</h1>

        <div className="flex flex-wrap gap-3 mb-8">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-green-500/10 px-3 py-1 text-sm font-medium text-green-600">
            <Clock className="h-3.5 w-3.5" /> Updated Today – {todayStr}
          </span>
          {jobs && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
              {jobs.length} jobs found today
            </span>
          )}
        </div>

        <AdPlaceholder variant="banner" />

        {/* Job Listings */}
        <section className="mb-10">
          <h2 className="text-2xl font-semibold text-foreground mb-4">Jobs Posted Today</h2>
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-lg" />)}
            </div>
          ) : jobs && jobs.length > 0 ? (
            <div className="space-y-3">
              {jobs.map(job => (
                <Link
                  key={job.id}
                  to={`/jobs/${job.slug}`}
                  className="block rounded-lg border p-4 hover:border-primary/50 hover:bg-primary/5 transition-colors"
                >
                  <h3 className="font-medium text-foreground mb-1">{job.title}</h3>
                  <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                    {job.company_name && (
                      <span className="inline-flex items-center gap-1"><Briefcase className="h-3.5 w-3.5" /> {job.company_name}</span>
                    )}
                    {(job.city || job.location) && (
                      <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {job.city || job.location}</span>
                    )}
                    <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {formatDistanceToNow(new Date(job.created_at), { addSuffix: true })}</span>
                  </div>
                  {(job.salary_min || job.salary_max) && (
                    <p className="text-sm text-primary mt-1">₹{job.salary_min?.toLocaleString('en-IN') || '—'} – ₹{job.salary_max?.toLocaleString('en-IN') || '—'} / year</p>
                  )}
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 rounded-lg border bg-muted/50">
              <p className="text-muted-foreground mb-2">No new jobs posted today yet.</p>
              <p className="text-sm text-muted-foreground">Check back later or browse all available jobs.</p>
              <Link to="/jobs" className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-2 mt-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
                Browse All Jobs
              </Link>
            </div>
          )}
        </section>

        <AdPlaceholder variant="in-content" />

        {/* Cross-links */}
        {config.city && (() => {
          const citySlug = `jobs-in-${config.city.toLowerCase().replace(/\s+/g, '-')}`;
          const cityConfig = getCityJobConfig(citySlug);
          return cityConfig ? (
            <CrossLinks
              title="Explore More"
              type="city"
              items={[
                { label: `All Jobs in ${config.city}`, slug: citySlug },
                { label: 'Fresher Jobs', slug: 'fresher-jobs' },
                { label: 'Remote Jobs', slug: 'remote-jobs' },
              ]}
            />
          ) : null;
        })()}

        <CrossLinks
          title="Today's Jobs in Other Cities"
          type="today"
          items={TODAY_PAGES.filter(p => p.slug !== config.slug).slice(0, 6).map(p => ({
            label: p.h1.replace(' – Latest Openings Updated Now', ''),
            slug: p.slug,
          }))}
        />

        {/* CTA */}
        <JobAlertCTA variant="banner" context="Today's Jobs" className="mb-6" />
      </main>
    </Layout>
  );
}
