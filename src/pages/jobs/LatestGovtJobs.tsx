import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { SEO } from '@/components/SEO';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Users, Clock, Flame, Star, ChevronLeft, ChevronRight } from 'lucide-react';
import { AdPlaceholder } from '@/components/ads/AdPlaceholder';
import { PopularExamsBlock } from '@/pages/govt/components/PopularExamsBlock';
import { formatDistanceToNow } from 'date-fns';

interface GovtExam {
  id: string;
  exam_name: string;
  slug: string;
  conducting_body: string | null;
  total_vacancies: number;
  application_end: string | null;
  salary_range: string | null;
  status: string;
  is_hot: boolean;
  is_featured: boolean;
  updated_at: string;
}

const PAGE_SIZE = 20;

export default function LatestGovtJobs() {
  const [exams, setExams] = useState<GovtExam[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);

  const fetchExams = useCallback(async () => {
    setLoading(true);
    const { data, count } = await supabase
      .from('govt_exams')
      .select('id, exam_name, slug, conducting_body, total_vacancies, application_end, salary_range, status, is_hot, is_featured, updated_at', { count: 'exact' })
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
    setExams((data as unknown as GovtExam[]) || []);
    setTotal(count || 0);
    setLoading(false);
  }, [page]);

  useEffect(() => { fetchExams(); }, [fetchExams]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <Layout>
      <SEO
        title="Latest Government Jobs 2026 — New Sarkari Naukri Vacancies | TrueJobs"
        description="Find the latest government jobs and sarkari naukri vacancies for 2026. Updated daily with eligibility, salary, exam dates & apply online links."
      />

      <section className="bg-gradient-to-br from-[hsl(170,100%,12%)] to-[hsl(174,60%,30%)] text-white py-10">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-3xl md:text-4xl font-bold font-['Outfit',sans-serif] mb-2">
            Latest Government Jobs 2026
          </h1>
          <p className="text-white/80 max-w-lg mx-auto">
            Newest Sarkari Naukri notifications — updated daily
          </p>
        </div>
      </section>

      <div className="container mx-auto px-4 py-8">
        <p className="text-sm text-muted-foreground mb-6">{total} active government jobs</p>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-40 rounded-xl" />)}
          </div>
        ) : exams.length === 0 ? (
          <Card><CardContent className="p-12 text-center text-muted-foreground">No active government jobs at the moment.</CardContent></Card>
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
                    {exam.conducting_body && <p className="text-xs text-muted-foreground mb-2">{exam.conducting_body}</p>}
                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground mb-3">
                      {exam.total_vacancies > 0 && (
                        <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {exam.total_vacancies.toLocaleString()} posts</span>
                      )}
                      {exam.salary_range && <span>{exam.salary_range}</span>}
                    </div>
                    <div className="flex items-center justify-between">
                      {exam.application_end && <Badge variant="outline" className="text-[10px]">Last Date: {exam.application_end}</Badge>}
                      <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" /> Updated: {formatDistanceToNow(new Date(exam.updated_at), { addSuffix: true })}
                      </span>
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
