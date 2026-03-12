import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowRight, MapPin, Building2 } from 'lucide-react';

interface PrivateJob {
  id: string;
  title: string;
  slug: string;
  company_name: string | null;
  location: string | null;
  employment_type: string | null;
  experience_level: string;
}

export function LatestPrivateJobs() {
  const [jobs, setJobs] = useState<PrivateJob[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from('jobs')
        .select('id, title, slug, company_name, location, employment_type, experience_level')
        .eq('status', 'active')
        .eq('job_sector', 'private')
        .eq('is_deleted', false)
        .order('created_at', { ascending: false })
        .limit(4);
      setJobs(data || []);
      setLoading(false);
    };
    fetch();
  }, []);

  if (loading) {
    return (
      <section className="py-8 bg-secondary/30">
        <div className="container mx-auto px-4">
          <h2 className="text-xl font-bold mb-6 font-['Outfit',sans-serif]">Latest Private Jobs</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
          </div>
        </div>
      </section>
    );
  }

  if (jobs.length === 0) return null;

  return (
    <section className="py-8 bg-secondary/30">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold font-['Outfit',sans-serif]">Latest Private Jobs</h2>
          <Link to="/jobs" className="text-sm font-medium text-primary hover:underline inline-flex items-center gap-1">
            View All <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {jobs.map(job => (
            <Link key={job.id} to={`/jobs/${job.slug}`}>
              <Card className="h-full hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <h3 className="text-sm font-semibold text-foreground line-clamp-2 mb-1">{job.title}</h3>
                  {job.company_name && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
                      <Building2 className="h-3 w-3" /> {job.company_name}
                    </p>
                  )}
                  {job.location && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mb-2">
                      <MapPin className="h-3 w-3" /> {job.location}
                    </p>
                  )}
                  <Badge variant="outline" className="text-[10px]">{job.experience_level}</Badge>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
