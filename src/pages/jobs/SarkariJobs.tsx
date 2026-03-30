import { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { SEO } from '@/components/SEO';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AdPlaceholder } from '@/components/ads/AdPlaceholder';
import { Skeleton } from '@/components/ui/skeleton';
import { StateQuickFilter } from '@/components/home/StateQuickFilter';
import { PopularExamsBlock } from '@/pages/govt/components/PopularExamsBlock';
import { Search, Users, MapPin, Banknote, Calendar, ChevronLeft, ChevronRight, ChevronRight as ChevronR } from 'lucide-react';
import { DEPT_OPTIONS, DEPT_CONFIG } from '@/lib/deptMapping';

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
  qualification: string | null;
}

const PAGE_SIZE = 20;

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest First' },
  { value: 'closing', label: 'Closing Soon' },
  { value: 'vacancies', label: 'Most Vacancies' },
];

interface SarkariJobsProps {
  /** If set, renders as a dept-specific filtered view (used by GovtExamDetail for dept slugs) */
  presetDept?: string;
}

export default function SarkariJobs({ presetDept }: SarkariJobsProps = {}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [jobs, setJobs] = useState<EmpNewsJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [deptFilter, setDeptFilter] = useState(presetDept || searchParams.get('dept') || 'all');
  const [sort, setSort] = useState('newest');

  const activeDeptConfig = deptFilter !== 'all' ? DEPT_CONFIG[deptFilter] : null;

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    let q = supabase
      .from('employment_news_jobs')
      .select('id, org_name, post, slug, vacancies, salary, state, job_category, last_date, last_date_resolved, published_at, qualification', { count: 'exact' })
      .eq('status', 'published');

    // Apply department filter
    if (deptFilter !== 'all' && DEPT_CONFIG[deptFilter]) {
      q = DEPT_CONFIG[deptFilter].applyFilter(q);
    }

    // Apply search
    if (query.trim()) {
      q = q.or(`org_name.ilike.%${query.trim()}%,post.ilike.%${query.trim()}%`);
    }

    // Apply sort
    if (sort === 'closing') {
      q = q.order('last_date_resolved', { ascending: true, nullsFirst: false });
    } else if (sort === 'vacancies') {
      q = q.order('vacancies', { ascending: false, nullsFirst: false });
    } else {
      q = q.order('published_at', { ascending: false, nullsFirst: false });
    }

    q = q.range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    const { data, count } = await q;
    setJobs((data as unknown as EmpNewsJob[]) || []);
    setTotal(count || 0);
    setLoading(false);
  }, [deptFilter, query, sort, page]);

  useEffect(() => { fetchJobs(); }, [fetchJobs]);

  // Sync filters to URL (skip if preset dept)
  useEffect(() => {
    if (presetDept) return;
    const params: Record<string, string> = {};
    if (deptFilter !== 'all') params.dept = deptFilter;
    if (query.trim()) params.q = query.trim();
    setSearchParams(params, { replace: true });
  }, [deptFilter, query, presetDept, setSearchParams]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const pageTitle = activeDeptConfig
    ? `${activeDeptConfig.label} — Latest Notifications | TrueJobs`
    : 'Sarkari Jobs 2026 — Latest Government Job Notifications | TrueJobs';

  const pageDescription = activeDeptConfig
    ? `Browse latest ${activeDeptConfig.shortLabel} government job notifications with eligibility, salary & apply links.`
    : 'Browse latest government job notifications. SSC, Railway, Banking, UPSC, Defence, State, Teaching & PSU jobs with eligibility, salary & apply links.';

  const h1Text = activeDeptConfig
    ? activeDeptConfig.label
    : 'Sarkari Jobs & Government Exams';

  return (
    <Layout>
      <SEO title={pageTitle} description={pageDescription} url={presetDept ? `/sarkari-jobs/${presetDept}` : '/sarkari-jobs'} />

      {/* Hero */}
      <section className="bg-gradient-to-br from-[hsl(170,100%,12%)] to-[hsl(174,60%,30%)] text-white py-10">
        <div className="container mx-auto px-4 text-center">
          {/* Breadcrumb */}
          <nav className="flex items-center justify-center gap-1 text-xs text-white/60 mb-4">
            <Link to="/" className="hover:text-white/90">Home</Link>
            <ChevronR className="h-3 w-3" />
            {activeDeptConfig ? (
              <>
                <Link to="/sarkari-jobs" className="hover:text-white/90">Sarkari Jobs</Link>
                <ChevronR className="h-3 w-3" />
                <span className="text-white/90">{activeDeptConfig.shortLabel}</span>
              </>
            ) : (
              <span className="text-white/90">Sarkari Jobs</span>
            )}
          </nav>

          <h1 className="text-3xl md:text-4xl font-bold font-['Outfit',sans-serif] mb-3">
            {h1Text}
          </h1>
          <p className="text-white/80 mb-6 max-w-lg mx-auto">
            Find the latest government job notifications updated daily
          </p>
          {!presetDept && (
            <form onSubmit={e => { e.preventDefault(); setPage(0); fetchJobs(); }} className="flex gap-2 max-w-lg mx-auto">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/50" />
                <Input
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Search by organization or post..."
                  className="pl-9 bg-white/15 border-white/20 text-white placeholder:text-white/50"
                />
              </div>
              <Button type="submit" className="bg-white text-[hsl(170,100%,12%)] hover:bg-white/90 font-semibold">
                Search
              </Button>
            </form>
          )}
        </div>
      </section>

      {!presetDept && <StateQuickFilter />}

      <div className="container mx-auto px-4 my-6">
        <AdPlaceholder variant="banner" />
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* Filters Bar */}
        {!presetDept && (
          <div className="flex flex-col sm:flex-row gap-3 mb-6">
            <Select value={deptFilter} onValueChange={v => { setDeptFilter(v); setPage(0); }}>
              <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {DEPT_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={sort} onValueChange={setSort}>
              <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {SORT_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <span className="text-sm text-muted-foreground self-center ml-auto">
              {total} government jobs found
            </span>
          </div>
        )}

        {presetDept && (
          <p className="text-sm text-muted-foreground mb-6">
            {total} {activeDeptConfig?.shortLabel || ''} government jobs found
          </p>
        )}

        {/* Job Cards */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-40 rounded-xl" />)}
          </div>
        ) : jobs.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center text-muted-foreground">
              <p className="mb-2">No {activeDeptConfig?.shortLabel || ''} government jobs found{query ? ` matching "${query}"` : ''} currently.</p>
              {(deptFilter !== 'all' || query) && (
                <Link to="/sarkari-jobs" className="text-primary hover:underline text-sm">
                  Browse all government jobs →
                </Link>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {jobs.map(job => (
              <Link key={job.id} to={job.slug ? `/jobs/employment-news/${job.slug}` : '#'}>
                <Card className="h-full hover:shadow-md transition-shadow">
                  <CardContent className="p-5">
                    <h2 className="text-base font-semibold text-foreground line-clamp-2 mb-1">
                      {job.org_name || 'Government Organization'}
                    </h2>
                    {job.post && (
                      <p className="text-sm text-muted-foreground mb-2 line-clamp-1">{job.post}</p>
                    )}
                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground mb-3">
                      {job.vacancies && job.vacancies > 0 && (
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" /> {job.vacancies.toLocaleString()} vacancies
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

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-8">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
              <ChevronLeft className="h-4 w-4" /> Prev
            </Button>
            <span className="text-sm text-muted-foreground">Page {page + 1} of {totalPages}</span>
            <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
              Next <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
      <PopularExamsBlock />
    </Layout>
  );
}
