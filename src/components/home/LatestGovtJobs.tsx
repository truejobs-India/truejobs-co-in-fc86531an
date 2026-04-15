import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowRight, Users, MapPin } from 'lucide-react';

interface GovtJobCard {
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

export function LatestGovtJobs() {
  const [jobs, setJobs] = useState<GovtJobCard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from('employment_news_jobs')
        .select('id, org_name, post, slug, vacancies, salary, state, job_category, last_date, last_date_resolved, published_at')
        .eq('status', 'published')
        .order('published_at', { ascending: false, nullsFirst: false })
        .limit(8);
      setJobs((data as unknown as GovtJobCard[]) || []);
      setLoading(false);
    };
    fetch();
  }, []);

  if (loading) {
    return (
      <section className="py-8">
        <div className="container mx-auto px-4">
          <h2 className="text-xl font-bold mb-6 font-['Outfit',sans-serif]">Latest Government Jobs</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-40 rounded-xl" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (jobs.length === 0) return (
    <section className="py-8">
      <div className="container mx-auto px-4">
        <h2 className="text-xl font-bold font-['Outfit',sans-serif] mb-4">Latest Government Jobs</h2>
        <p className="text-muted-foreground text-sm">No government jobs available right now. Check back soon!</p>
      </div>
    </section>
  );

  return (
    <section className="py-8">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold font-['Outfit',sans-serif]">Latest Government Jobs</h2>
          <Link to="/sarkari-jobs" className="text-sm font-medium text-primary hover:underline inline-flex items-center gap-1">
            View All <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {jobs.map(job => (
            <Link key={job.id} to={`/jobs/employment-news/${job.slug || job.id}`} className="block">
              <Card className="h-full cursor-pointer rounded-xl border border-border border-b-4 border-b-primary/20 shadow-md hover:shadow-lg hover:-translate-y-1 active:scale-[0.97] active:shadow-sm transition-all duration-200">
                <CardContent className="p-4">
                  <h3 className="text-sm font-semibold text-foreground line-clamp-2 mb-1">
                    {job.org_name || 'Government Organization'}
                  </h3>
                  {job.post && (
                    <p className="text-xs text-muted-foreground mb-2 line-clamp-1">{job.post}</p>
                  )}
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mb-2">
                    {job.vacancies && job.vacancies > 0 && (
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" /> {job.vacancies.toLocaleString()} posts
                      </span>
                    )}
                    {job.state && (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" /> {job.state}
                      </span>
                    )}
                  </div>
                  {(job.last_date_resolved || job.last_date) && (
                    <Badge variant="outline" className="text-xs mb-2">
                      Last Date: {job.last_date_resolved || job.last_date}
                    </Badge>
                  )}
                  {job.job_category && (
                    <p className="text-[10px] text-muted-foreground mt-1">{job.job_category}</p>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
