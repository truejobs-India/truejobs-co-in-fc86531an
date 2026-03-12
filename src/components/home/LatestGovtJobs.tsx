import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowRight, Clock, Users, Flame } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface GovtExamCard {
  id: string;
  exam_name: string;
  slug: string;
  conducting_body: string | null;
  total_vacancies: number;
  application_end: string | null;
  status: string;
  is_hot: boolean;
  is_featured: boolean;
  salary_range: string | null;
  updated_at: string;
}

export function LatestGovtJobs() {
  const [exams, setExams] = useState<GovtExamCard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from('govt_exams')
        .select('id, exam_name, slug, conducting_body, total_vacancies, application_end, status, is_hot, is_featured, salary_range, updated_at')
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(8);
      setExams((data as unknown as GovtExamCard[]) || []);
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

  if (exams.length === 0) return null;

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
          {exams.map(exam => (
            <Link key={exam.id} to={`/sarkari-jobs/${exam.slug}`}>
              <Card className="h-full hover:shadow-md transition-shadow border-border">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="text-sm font-semibold text-foreground line-clamp-2">{exam.exam_name}</h3>
                    {exam.is_hot && <Flame className="h-4 w-4 text-orange-500 shrink-0" />}
                  </div>
                  {exam.conducting_body && (
                    <p className="text-xs text-muted-foreground mb-2">{exam.conducting_body}</p>
                  )}
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mb-2">
                    {exam.total_vacancies > 0 && (
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" /> {exam.total_vacancies.toLocaleString()} posts
                      </span>
                    )}
                    {exam.salary_range && (
                      <span>{exam.salary_range}</span>
                    )}
                  </div>
                  {exam.application_end && (
                    <Badge variant="outline" className="text-xs mb-2">
                      Last Date: {exam.application_end}
                    </Badge>
                  )}
                  <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-2">
                    <Clock className="h-3 w-3" /> Updated: {formatDistanceToNow(new Date(exam.updated_at), { addSuffix: true })}
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
