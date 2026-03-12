import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Layout } from '@/components/layout/Layout';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { Search, Users, ArrowRight, Landmark } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { AdPlaceholder } from '@/components/ads/AdPlaceholder';
import { supabase } from '@/integrations/supabase/client';
import { PopularExamsBlock } from '@/pages/govt/components/PopularExamsBlock';
import { buildBreadcrumbSchema } from './schemas/seoPageSchemas';

const SITE_URL = 'https://truejobs.co.in';

export default function AllSarkariJobsHub() {
  const [search, setSearch] = useState('');

  const { data: exams, isLoading } = useQuery({
    queryKey: ['all-sarkari-index'],
    queryFn: async () => {
      const { data } = await supabase
        .from('govt_exams')
        .select('id, exam_name, slug, conducting_body, department_slug, total_vacancies, status, application_end, updated_at')
        .order('exam_name', { ascending: true })
        .limit(500);
      return (data as any[]) || [];
    },
    staleTime: 10 * 60 * 1000,
  });

  const filtered = useMemo(() => {
    if (!exams) return [];
    if (!search.trim()) return exams;
    const q = search.toLowerCase();
    return exams.filter((e: any) =>
      e.exam_name.toLowerCase().includes(q) ||
      (e.conducting_body || '').toLowerCase().includes(q)
    );
  }, [exams, search]);

  // Group by first letter
  const grouped = useMemo(() => {
    const map: Record<string, any[]> = {};
    for (const exam of filtered) {
      const letter = exam.exam_name[0]?.toUpperCase() || '#';
      if (!map[letter]) map[letter] = [];
      map[letter].push(exam);
    }
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  const breadcrumbSchema = buildBreadcrumbSchema([
    { name: 'Home', url: '/' },
    { name: 'All Sarkari Jobs', url: '/all-sarkari-jobs' },
  ]);

  const statusColor = (s: string) => {
    switch (s) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'upcoming': return 'bg-blue-100 text-blue-800';
      case 'result_declared': return 'bg-purple-100 text-purple-800';
      case 'admit_card_released': return 'bg-orange-100 text-orange-800';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <Layout>
      <Helmet>
        <title>All Sarkari Jobs A-Z Index — Complete Government Job Directory | TrueJobs</title>
        <meta name="description" content="Complete A-Z index of all government job notifications in India. Browse SSC, Railway, Banking, UPSC, Defence & State govt exams. Find and apply instantly." />
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
            Complete index of government job notifications. Search, browse, and apply.
          </p>
          <div className="max-w-lg mx-auto relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search exams..."
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
          <Link to="/govt-jobs-last-date-today" className="text-xs px-3 py-1.5 rounded-full bg-destructive/10 text-destructive hover:bg-destructive/20">Last Date Today</Link>
          <Link to="/govt-jobs-last-date-this-week" className="text-xs px-3 py-1.5 rounded-full bg-primary/10 text-primary hover:bg-primary/20">Closing This Week</Link>
          <Link to="/ssc-jobs" className="text-xs px-3 py-1.5 rounded-full bg-secondary hover:bg-accent">SSC</Link>
          <Link to="/railway-jobs" className="text-xs px-3 py-1.5 rounded-full bg-secondary hover:bg-accent">Railway</Link>
          <Link to="/banking-jobs" className="text-xs px-3 py-1.5 rounded-full bg-secondary hover:bg-accent">Banking</Link>
          <Link to="/upsc-jobs" className="text-xs px-3 py-1.5 rounded-full bg-secondary hover:bg-accent">UPSC</Link>
          <Link to="/defence-jobs" className="text-xs px-3 py-1.5 rounded-full bg-secondary hover:bg-accent">Defence</Link>
        </div>

        <div className="my-6">
          <AdPlaceholder variant="banner" />
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
          </div>
        ) : grouped.length === 0 ? (
          <p className="text-center text-muted-foreground py-12">No exams found matching "{search}".</p>
        ) : (
          <div className="space-y-8">
            {grouped.map(([letter, exams]) => (
              <div key={letter} id={`letter-${letter}`}>
                <h2 className="text-xl font-bold text-foreground border-b border-border pb-2 mb-3">{letter}</h2>
                <div className="grid gap-2">
                  {exams.map((exam: any) => (
                    <Link key={exam.id} to={`/sarkari-jobs/${exam.slug}`} className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-secondary/50 transition-colors group">
                      <div className="min-w-0 flex-1">
                        <h3 className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">{exam.exam_name}</h3>
                        <div className="flex flex-wrap gap-2 mt-0.5 text-xs text-muted-foreground">
                          {exam.conducting_body && <span>{exam.conducting_body}</span>}
                          {exam.total_vacancies > 0 && <span className="flex items-center gap-1"><Users className="h-3 w-3" />{exam.total_vacancies.toLocaleString()}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge className={`text-[10px] ${statusColor(exam.status)}`}>{exam.status.replace(/_/g, ' ')}</Badge>
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
          <p>Showing {filtered.length} government exam notifications. Data sourced from official portals.</p>
        </div>
      </div>

      <PopularExamsBlock />
    </Layout>
  );
}
