import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { AdPlaceholder } from '@/components/ads/AdPlaceholder';
import { SEO } from '@/components/SEO';
import { supabase } from '@/integrations/supabase/client';
import { MapPin, Calendar, Briefcase, Search, ChevronLeft, ChevronRight, Users, IndianRupee } from 'lucide-react';

const PER_PAGE = 20;

export default function EmploymentNewsJobs() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [stateFilter, setStateFilter] = useState('all');

  const { data, isLoading } = useQuery({
    queryKey: ['emp-news-published', page, search, categoryFilter, stateFilter],
    queryFn: async () => {
      let query = supabase
        .from('employment_news_jobs')
        .select('*', { count: 'exact' })
        .eq('status', 'published')
        .order('published_at', { ascending: false });

      if (search.trim()) {
        query = query.or(`org_name.ilike.%${search}%,post.ilike.%${search}%`);
      }
      if (categoryFilter !== 'all') query = query.eq('job_category', categoryFilter);
      if (stateFilter !== 'all') query = query.eq('state', stateFilter);

      const from = (page - 1) * PER_PAGE;
      query = query.range(from, from + PER_PAGE - 1);

      const { data: jobs, count, error } = await query;
      if (error) throw error;
      return { jobs: jobs || [], count: count || 0 };
    },
    staleTime: 5 * 60 * 1000,
  });

  const isDeadlineSoon = (dateStr: string | null) => {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return false;
    const diff = d.getTime() - Date.now();
    return diff > 0 && diff <= 7 * 24 * 60 * 60 * 1000;
  };

  const totalPages = Math.ceil((data?.count || 0) / PER_PAGE);

  return (
    <Layout>
      <SEO
        title="Government Jobs from Employment News 2026 | TrueJobs"
        description="Browse latest government job notifications from Employment News India. Central Govt, PSU, Defence, University jobs updated weekly."
        canonical="https://truejobs.co.in/jobs/employment-news"
      />
      <div className="container mx-auto py-8 px-4">
        <h1 className="text-3xl font-bold mb-2">Government Jobs from Employment News</h1>
        <p className="text-muted-foreground mb-6">
          Latest government job notifications from Employment News / Rozgar Samachar
        </p>

        <AdPlaceholder variant="banner" />

        {/* Filters */}
        <div className="flex flex-wrap gap-2 mb-6">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by organisation or post…"
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              className="pl-9"
            />
          </div>
          <Select value={categoryFilter} onValueChange={v => { setCategoryFilter(v); setPage(1); }}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="Category" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {['Central Government', 'State Government', 'Defence', 'Railway', 'Banking', 'SSC', 'PSU', 'University/Research', 'Teaching', 'Police', 'Medical/Health', 'Engineering', 'Other'].map(c => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={stateFilter} onValueChange={v => { setStateFilter(v); setPage(1); }}>
            <SelectTrigger className="w-[130px]"><SelectValue placeholder="State" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All States</SelectItem>
              {['Delhi', 'Maharashtra', 'Karnataka', 'Tamil Nadu', 'Uttar Pradesh', 'West Bengal', 'Telangana', 'Gujarat', 'Rajasthan', 'Madhya Pradesh', 'Bihar', 'Odisha', 'Punjab', 'Haryana', 'Andhra Pradesh'].map(s => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Job Cards */}
        {isLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-32 w-full rounded-lg" />
            ))}
          </div>
        ) : data?.jobs.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Briefcase className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg">No published jobs found</p>
          </div>
        ) : (
          <div className="space-y-4">
            {data?.jobs.map((job: any) => (
              <Link key={job.id} to={`/jobs/employment-news/${job.slug || job.id}`}>
                <Card className="hover:shadow-md transition-shadow">
                  <CardContent className="p-5">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-primary">{job.org_name}</p>
                        <h2 className="text-lg font-bold mt-0.5 truncate">{job.post}</h2>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {job.vacancies && (
                            <Badge variant="secondary" className="text-xs">
                              <Users className="h-3 w-3 mr-1" /> {job.vacancies} Vacancies
                            </Badge>
                          )}
                          {job.job_type && (
                            <Badge variant="outline" className="text-xs capitalize">{job.job_type}</Badge>
                          )}
                          {job.job_category && (
                            <Badge variant="outline" className="text-xs">{job.job_category}</Badge>
                          )}
                          {job.location && (
                            <Badge variant="outline" className="text-xs">
                              <MapPin className="h-3 w-3 mr-1" /> {job.location}
                            </Badge>
                          )}
                        </div>
                        {job.salary && (
                          <p className="text-sm text-muted-foreground mt-2 flex items-center gap-1">
                            <IndianRupee className="h-3 w-3" /> {job.salary}
                          </p>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        {job.last_date_resolved && isDeadlineSoon(job.last_date_resolved) ? (
                          <Badge variant="destructive" className="text-xs">
                            <Calendar className="h-3 w-3 mr-1" /> Closes Soon: {job.last_date || job.last_date_resolved}
                          </Badge>
                        ) : job.last_date ? (
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Calendar className="h-3 w-3" /> Last Date: {job.last_date}
                          </p>
                        ) : null}
                        <Button variant="outline" size="sm" className="mt-2">View Details</Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-8">
            <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
              <ChevronLeft className="h-4 w-4" /> Previous
            </Button>
            <span className="text-sm text-muted-foreground">
              Page {page} of {totalPages}
            </span>
            <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
              Next <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </Layout>
  );
}
