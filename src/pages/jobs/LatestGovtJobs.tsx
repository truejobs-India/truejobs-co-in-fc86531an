import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { SEO } from '@/components/SEO';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Users, MapPin, Banknote, Calendar, ArrowRight } from 'lucide-react';
import { AdPlaceholder } from '@/components/ads/AdPlaceholder';
import { PopularExamsBlock } from '@/pages/govt/components/PopularExamsBlock';
import { differenceInDays } from 'date-fns';

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

export default function LatestGovtJobs() {
  const [jobs, setJobs] = useState<EmpNewsJob[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchJobs = async () => {
      const { data } = await supabase
        .from('employment_news_jobs')
        .select('id, org_name, post, slug, vacancies, salary, state, job_category, last_date, last_date_resolved, published_at')
        .eq('status', 'published')
        .order('published_at', { ascending: false, nullsFirst: false })
        .limit(40);
      setJobs((data as unknown as EmpNewsJob[]) || []);
      setLoading(false);
    };
    fetchJobs();
  }, []);

  const isThisWeek = (dateStr: string | null) => {
    if (!dateStr) return false;
    return differenceInDays(new Date(), new Date(dateStr)) <= 7;
  };

  return (
    <Layout>
      <SEO
        title="Latest Government Jobs 2026 — New Sarkari Naukri Vacancies"
        description="Find the latest government jobs and sarkari naukri vacancies for 2026. Updated daily with eligibility, salary, exam dates & apply online links."
      />

      <section className="bg-gradient-to-br from-[hsl(170,100%,12%)] to-[hsl(174,60%,30%)] text-white py-10">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-3xl md:text-4xl font-bold font-['Outfit',sans-serif] mb-2">
            Latest Government Jobs 2026
          </h1>
          <p className="text-white/80 max-w-lg mx-auto">
            Newest sarkari naukri notifications — updated daily
          </p>
        </div>
      </section>

      <div className="container mx-auto px-4 py-8">
        <p className="text-sm text-muted-foreground mb-6">
          Showing {jobs.length} most recently published government jobs
        </p>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-40 rounded-xl" />)}
          </div>
        ) : jobs.length === 0 ? (
          <Card><CardContent className="p-12 text-center text-muted-foreground">No government jobs available at the moment.</CardContent></Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {jobs.map(job => (
              <Link key={job.id} to={job.slug ? `/jobs/employment-news/${job.slug}` : '#'}>
                <Card className="h-full hover:shadow-md transition-shadow">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h2 className="text-base font-semibold text-foreground line-clamp-2">
                        {job.org_name || 'Government Organization'}
                      </h2>
                      {isThisWeek(job.published_at) && (
                        <Badge className="bg-green-100 text-green-800 text-[10px] shrink-0">New</Badge>
                      )}
                    </div>
                    {job.post && (
                      <p className="text-sm text-muted-foreground mb-2 line-clamp-1">{job.post}</p>
                    )}
                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground mb-3">
                      {job.vacancies && job.vacancies > 0 && (
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" /> {job.vacancies.toLocaleString()} posts
                        </span>
                      )}
                      {job.salary && (
                        <span className="flex items-center gap-1">
                          <Banknote className="h-3 w-3" /> {job.salary}
                        </span>
                      )}
                      {job.state && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" /> {job.state}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      {job.job_category && (
                        <Badge variant="outline" className="text-[10px]">{job.job_category}</Badge>
                      )}
                      {(job.last_date_resolved || job.last_date) && (
                        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          Last Date: {job.last_date_resolved || job.last_date}
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}

        <div className="my-6">
          <AdPlaceholder variant="banner" />
        </div>

        <div className="text-center mt-8">
          <Link to="/sarkari-jobs" className="text-primary hover:underline font-medium inline-flex items-center gap-1">
            Browse All Sarkari Jobs <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
      <PopularExamsBlock />
    </Layout>
  );
}
