import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { BriefcaseBusiness, Users, MapPin, ArrowRight } from 'lucide-react';

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

function getStatusBadge(job: GovtJobCard): { label: string; className: string } | null {
  const deadline = job.last_date_resolved || job.last_date;
  if (deadline) {
    try {
      if (new Date(deadline) >= new Date()) {
        return { label: 'Apply Now', className: 'bg-orange-100 text-orange-700 border-orange-200' };
      }
    } catch {}
  }
  if (job.vacancies && job.vacancies > 500) {
    return { label: 'Trending', className: 'bg-amber-100 text-amber-700 border-amber-200' };
  }
  return null;
}

export function LatestGovtJobs() {
  const [jobs, setJobs] = useState<GovtJobCard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchJobs = async () => {
      const { data } = await supabase
        .from('employment_news_jobs')
        .select('id, org_name, post, slug, vacancies, salary, state, job_category, last_date, last_date_resolved, published_at')
        .eq('status', 'published')
        .order('published_at', { ascending: false, nullsFirst: false })
        .limit(8);
      setJobs((data as unknown as GovtJobCard[]) || []);
      setLoading(false);
    };
    fetchJobs();
  }, []);

  if (loading) {
    return (
      <section className="py-8">
        <div className="container mx-auto px-4">
          <div className="rounded-2xl border border-slate-200 bg-white shadow overflow-hidden">
            <div className="h-[6px] bg-gradient-to-r from-orange-500 via-white to-emerald-600" />
            <div className="p-5">
              <Skeleton className="h-6 w-56 mb-5" />
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                {[...Array(4)].map((_, i) => (
                  <Skeleton key={i} className="h-[72px] rounded-xl" />
                ))}
              </div>
            </div>
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
        <div className="rounded-2xl border border-slate-200 bg-white shadow overflow-hidden">
          {/* Indian flag accent strip */}
          <div className="h-[6px] bg-gradient-to-r from-orange-500 via-white to-emerald-600" />

          <div className="p-5">
            {/* Header */}
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xl font-bold font-['Outfit',sans-serif] text-slate-900">Latest Government Jobs</h2>
              <Link
                to="/sarkari-jobs"
                className="text-xs font-semibold text-orange-600 hover:text-orange-700 bg-orange-50 border border-orange-200 rounded-full px-3 py-1 inline-flex items-center gap-1 transition-colors"
              >
                View All <ArrowRight className="h-3 w-3" />
              </Link>
            </div>

            {/* Job rows grid */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
              {jobs.map(job => {
                const badge = getStatusBadge(job);
                return (
                  <Link
                    key={job.id}
                    to={`/jobs/employment-news/${job.slug || job.id}`}
                    className="block group"
                  >
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 p-3 rounded-xl border border-orange-100 bg-gradient-to-r from-orange-50/60 via-white to-white hover:shadow-md hover:-translate-y-0.5 active:scale-[0.99] transition-all duration-200">
                      {/* Icon */}
                      <div className="shrink-0 p-2 bg-white rounded-full text-orange-500 shadow-sm border border-orange-100">
                        <BriefcaseBusiness size={18} />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-slate-900 text-sm leading-tight line-clamp-1">
                          {job.org_name || 'Government Organization'}
                        </h3>
                        {job.post && (
                          <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">{job.post}</p>
                        )}
                        <div className="flex flex-wrap items-center gap-3 mt-1 text-[11px] text-slate-400">
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
                      </div>

                      {/* Badge + CTA */}
                      <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto mt-2 sm:mt-0">
                        {badge && (
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${badge.className}`}>
                            {badge.label}
                          </span>
                        )}
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-white bg-orange-500 hover:bg-orange-600 rounded-lg px-3 py-1.5 transition-colors ml-auto sm:ml-0 group-active:scale-95">
                          View Job <ArrowRight className="h-3 w-3" />
                        </span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
