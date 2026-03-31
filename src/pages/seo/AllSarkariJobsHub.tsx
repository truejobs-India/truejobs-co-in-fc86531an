import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Layout } from '@/components/layout/Layout';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, Users, ArrowRight, Landmark, MapPin } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { AdPlaceholder } from '@/components/ads/AdPlaceholder';
import { JobAlertCTA } from '@/components/shared/JobAlertCTA';
import { supabase } from '@/integrations/supabase/client';
import { PopularExamsBlock } from '@/pages/govt/components/PopularExamsBlock';
import { buildBreadcrumbSchema } from './schemas/seoPageSchemas';

const SITE_URL = 'https://truejobs.co.in';

interface EmpNewsJob {
  id: string;
  org_name: string | null;
  post: string | null;
  slug: string | null;
  vacancies: number | null;
  state: string | null;
  job_category: string | null;
  published_at: string | null;
}

export default function AllSarkariJobsHub() {
  const [search, setSearch] = useState('');

  const { data: jobs, isLoading } = useQuery({
    queryKey: ['all-sarkari-index'],
    queryFn: async () => {
      // Fetch all published jobs (paginated to handle >1000)
      const PAGE = 1000;
      let all: any[] = [];
      let from = 0;
      while (true) {
        const { data } = await supabase
          .from('employment_news_jobs')
          .select('id, org_name, post, slug, vacancies, state, job_category, published_at')
          .eq('status', 'published')
          .order('org_name', { ascending: true })
          .range(from, from + PAGE - 1);
        if (!data || data.length === 0) break;
        all = all.concat(data);
        if (data.length < PAGE) break;
        from += PAGE;
      }
      return all as EmpNewsJob[];
    },
    staleTime: 10 * 60 * 1000,
  });

  const filtered = useMemo(() => {
    if (!jobs) return [];
    if (!search.trim()) return jobs;
    const q = search.toLowerCase();
    return jobs.filter((j) =>
      (j.org_name || '').toLowerCase().includes(q) ||
      (j.post || '').toLowerCase().includes(q)
    );
  }, [jobs, search]);

  // Group by org_name first letter
  const grouped = useMemo(() => {
    const map: Record<string, EmpNewsJob[]> = {};
    for (const job of filtered) {
      const letter = (job.org_name || '#')[0]?.toUpperCase() || '#';
      if (!map[letter]) map[letter] = [];
      map[letter].push(job);
    }
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  const breadcrumbSchema = buildBreadcrumbSchema([
    { name: 'Home', url: '/' },
    { name: 'All Sarkari Jobs', url: '/all-sarkari-jobs' },
  ]);

  return (
    <Layout>
      <Helmet>
        <title>All Sarkari Jobs A-Z Index — Complete Government Job Directory | TrueJobs</title>
        <meta name="description" content="Complete A-Z index of all government job notifications in India. Browse SSC, Railway, Banking, UPSC, Defence & State govt jobs. Find and apply instantly." />
        <link rel="canonical" href={`${SITE_URL}/all-sarkari-jobs`} />
        <script type="application/ld+json">{JSON.stringify(breadcrumbSchema)}</script>
      </Helmet>

      <section className="bg-gradient-to-br from-[hsl(170,100%,12%)] to-[hsl(174,60%,30%)] text-white py-10">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-3xl md:text-4xl font-bold font-['Outfit',sans-serif] mb-3">
            <Landmark className="inline h-8 w-8 mr-2 -mt-1" />
            All Sarkari Jobs — A to Z Directory
          </h1>
          <p className="text-sm opacity-80 max-w-2xl mx-auto mb-6">
            Complete index of government job notifications by organization. Search, browse, and apply.
          </p>
          <div className="max-w-lg mx-auto relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search organizations or posts..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 bg-white text-foreground"
            />
          </div>
        </div>
      </section>

      <div className="container mx-auto px-4 py-6">
        {/* Quick letter nav */}
        <div className="flex flex-wrap gap-1 mb-6">
          {grouped.map(([letter]) => (
            <a key={letter} href={`#letter-${letter}`} className="px-2 py-1 text-xs font-semibold rounded bg-secondary text-secondary-foreground hover:bg-primary hover:text-primary-foreground transition-colors">
              {letter}
            </a>
          ))}
        </div>

        {/* Quick links */}
        <div className="flex flex-wrap gap-2 mb-6">
          <Link to="/sarkari-jobs?dept=ssc" className="text-xs px-3 py-1.5 rounded-full bg-secondary hover:bg-accent">SSC</Link>
          <Link to="/sarkari-jobs?dept=railway" className="text-xs px-3 py-1.5 rounded-full bg-secondary hover:bg-accent">Railway</Link>
          <Link to="/sarkari-jobs?dept=banking" className="text-xs px-3 py-1.5 rounded-full bg-secondary hover:bg-accent">Banking</Link>
          <Link to="/sarkari-jobs?dept=upsc" className="text-xs px-3 py-1.5 rounded-full bg-secondary hover:bg-accent">UPSC</Link>
          <Link to="/sarkari-jobs?dept=defence" className="text-xs px-3 py-1.5 rounded-full bg-secondary hover:bg-accent">Defence</Link>
          <Link to="/sarkari-jobs?dept=psu" className="text-xs px-3 py-1.5 rounded-full bg-secondary hover:bg-accent">PSU</Link>
        </div>

        <div className="my-6">
          <AdPlaceholder variant="banner" />
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
          </div>
        ) : grouped.length === 0 ? (
          <p className="text-center text-muted-foreground py-12">No jobs found matching "{search}".</p>
        ) : (
          <div className="space-y-8">
            {grouped.map(([letter, letterJobs]) => (
              <div key={letter} id={`letter-${letter}`}>
                <h2 className="text-xl font-bold text-foreground border-b border-border pb-2 mb-3">{letter}</h2>
                <div className="grid gap-2">
                  {letterJobs.map((job) => (
                    <Link key={job.id} to={job.slug ? `/jobs/employment-news/${job.slug}` : '#'} className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-secondary/50 transition-colors group">
                      <div className="min-w-0 flex-1">
                        <h3 className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">
                          {job.org_name || 'Government Organization'}
                        </h3>
                        <div className="flex flex-wrap gap-2 mt-0.5 text-xs text-muted-foreground">
                          {job.post && <span className="truncate max-w-[200px]">{job.post}</span>}
                          {job.vacancies && job.vacancies > 0 && (
                            <span className="flex items-center gap-1"><Users className="h-3 w-3" />{job.vacancies.toLocaleString()}</span>
                          )}
                          {job.state && (
                            <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{job.state}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {job.job_category && (
                          <Badge variant="outline" className="text-[10px]">{job.job_category}</Badge>
                        )}
                        <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-10 text-center text-sm text-muted-foreground">
          <p>Showing {filtered.length} government job notifications. Data sourced from Employment News / official portals.</p>
        </div>

        <JobAlertCTA variant="banner" context="Sarkari Jobs" className="mt-8" />
      </div>

      <PopularExamsBlock />
    </Layout>
  );
}
