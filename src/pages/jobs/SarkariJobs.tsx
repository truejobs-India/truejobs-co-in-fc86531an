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
import { Search, Users, Clock, Flame, Star, ChevronLeft, ChevronRight, ArrowRight } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface GovtExam {
  id: string;
  exam_name: string;
  slug: string;
  conducting_body: string | null;
  department_slug: string | null;
  exam_category: string;
  total_vacancies: number;
  application_end: string | null;
  salary_range: string | null;
  status: string;
  is_hot: boolean;
  is_featured: boolean;
  updated_at: string;
  created_at: string;
}

const PAGE_SIZE = 20;

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Status' },
  { value: 'active', label: 'Active' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'admit_card_released', label: 'Admit Card Released' },
  { value: 'result_declared', label: 'Result Declared' },
];

const DEPT_OPTIONS = [
  { value: 'all', label: 'All Departments' },
  { value: 'ssc', label: 'SSC' },
  { value: 'railway', label: 'Railway' },
  { value: 'banking', label: 'Banking' },
  { value: 'upsc', label: 'UPSC' },
  { value: 'defence', label: 'Defence' },
  { value: 'teaching', label: 'Teaching' },
  { value: 'police', label: 'Police' },
  { value: 'psu', label: 'PSU' },
  { value: 'state', label: 'State Govt' },
];

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest First' },
  { value: 'closing', label: 'Closing Soon' },
  { value: 'vacancies', label: 'Most Vacancies' },
];

export default function SarkariJobs() {
  const [searchParams] = useSearchParams();
  const [exams, setExams] = useState<GovtExam[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || 'all');
  const [deptFilter, setDeptFilter] = useState(searchParams.get('dept') || 'all');
  const [sort, setSort] = useState('newest');

  const fetchExams = useCallback(async () => {
    setLoading(true);
    let q = supabase
      .from('govt_exams')
      .select('id, exam_name, slug, conducting_body, department_slug, exam_category, total_vacancies, application_end, salary_range, status, is_hot, is_featured, updated_at, created_at', { count: 'exact' });

    if (statusFilter !== 'all') q = q.eq('status', statusFilter);
    if (deptFilter !== 'all') q = q.eq('department_slug', deptFilter);
    if (query) q = q.ilike('exam_name', `%${query}%`);

    if (sort === 'closing') q = q.order('application_end', { ascending: true, nullsFirst: false });
    else if (sort === 'vacancies') q = q.order('total_vacancies', { ascending: false });
    else q = q.order('created_at', { ascending: false });

    q = q.range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    const { data, count, error } = await q;
    setExams((data as unknown as GovtExam[]) || []);
    setTotal(count || 0);
    setLoading(false);

    // Track search query
    if (query.trim()) {
      supabase.rpc('upsert_search_query', { p_query: query.trim(), p_source: 'sarkari' }).then(() => {});
    }
  }, [statusFilter, deptFilter, query, sort, page]);

  useEffect(() => { fetchExams(); }, [fetchExams]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

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
      <SEO
        title="Sarkari Jobs 2026 — Latest Government Job Notifications | TrueJobs"
        description="Browse latest government job notifications. SSC, Railway, Banking, UPSC, Defence, State, Teaching & PSU jobs with eligibility, salary & apply links."
      />

      {/* Hero */}
      <section className="bg-gradient-to-br from-[hsl(170,100%,12%)] to-[hsl(174,60%,30%)] text-white py-10">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-3xl md:text-4xl font-bold font-['Outfit',sans-serif] mb-3">
            Sarkari Jobs & Government Exams
          </h1>
          <p className="text-white/80 mb-6 max-w-lg mx-auto">
            Find the latest government job notifications updated daily
          </p>
          <form onSubmit={e => { e.preventDefault(); setPage(0); fetchExams(); }} className="flex gap-2 max-w-lg mx-auto">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/50" />
              <Input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search exams..."
                className="pl-9 bg-white/15 border-white/20 text-white placeholder:text-white/50"
              />
            </div>
            <Button type="submit" className="bg-white text-[hsl(170,100%,12%)] hover:bg-white/90 font-semibold">
              Search
            </Button>
          </form>
        </div>
      </section>

      <StateQuickFilter />

      <div className="container mx-auto px-4 my-6">
        <AdPlaceholder variant="banner" />
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* Filters Bar */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <Select value={statusFilter} onValueChange={v => { setStatusFilter(v); setPage(0); }}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
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

        {/* Job Cards */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-40 rounded-xl" />)}
          </div>
        ) : exams.length === 0 ? (
          <Card><CardContent className="p-12 text-center text-muted-foreground">No government jobs found matching your filters.</CardContent></Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {exams.map(exam => (
              <Link key={exam.id} to={`/sarkari-jobs/${exam.slug}`}>
                <Card className="h-full hover:shadow-md transition-shadow">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h2 className="text-base font-semibold text-foreground line-clamp-2">{exam.exam_name}</h2>
                      <div className="flex gap-1 shrink-0">
                        {exam.is_featured && <Star className="h-4 w-4 text-yellow-500 fill-yellow-400" />}
                        {exam.is_hot && <Flame className="h-4 w-4 text-orange-500" />}
                      </div>
                    </div>
                    {exam.conducting_body && (
                      <p className="text-xs text-muted-foreground mb-2">{exam.conducting_body}</p>
                    )}
                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground mb-3">
                      {exam.total_vacancies > 0 && (
                        <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {exam.total_vacancies.toLocaleString()} vacancies</span>
                      )}
                      {exam.salary_range && <span>{exam.salary_range}</span>}
                      <Badge variant="outline" className="text-[10px]">{exam.exam_category}</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full ${statusColor(exam.status)}`}>
                        {exam.status.replace(/_/g, ' ')}
                      </span>
                      <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                        {exam.application_end && <span>Last Date: {exam.application_end}</span>}
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" /> Updated: {formatDistanceToNow(new Date(exam.updated_at), { addSuffix: true })}
                        </span>
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
