import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { MapPin, Building2, Briefcase, ArrowRight } from 'lucide-react';

interface Job {
  id: string;
  title: string;
  slug: string;
  company_name: string | null;
  location: string | null;
  job_type: string;
  experience_level: string;
}

interface RelatedJobsProps {
  category: string | null;
  tags: string[] | null;
  limit?: number;
}

export function RelatedJobs({ category, tags, limit = 4 }: RelatedJobsProps) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchRelatedJobs();
  }, [category, tags]);

  const fetchRelatedJobs = async () => {
    setIsLoading(true);
    
    // Build query based on category/tags keywords
    let query = supabase
      .from('jobs')
      .select('id, title, slug, company_name, location, job_type, experience_level')
      .eq('status', 'active')
      .limit(limit);

    // If we have tags, try to match job titles
    if (tags && tags.length > 0) {
      // Use a simple search approach - look for jobs with matching keywords in title
      const searchTerms = tags.slice(0, 3).join(' | ');
      query = query.or(`title.ilike.%${tags[0]}%,title.ilike.%${tags[1] || tags[0]}%`);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (!error && data) {
      setJobs(data);
    } else {
      // Fallback: fetch any recent active jobs
      const { data: fallbackData } = await supabase
        .from('jobs')
        .select('id, title, slug, company_name, location, job_type, experience_level')
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(limit);
      
      if (fallbackData) {
        setJobs(fallbackData);
      }
    }
    
    setIsLoading(false);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Related Jobs</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="p-4 border rounded-lg">
              <Skeleton className="h-5 w-3/4 mb-2" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (jobs.length === 0) {
    return null;
  }

  return (
    <Card className="border-2 border-primary/10">
      <CardHeader className="bg-primary/5">
        <div className="flex items-center gap-2">
          <Briefcase className="h-5 w-5 text-primary" />
          <CardTitle className="text-xl">Related Jobs on TrueJobs</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="p-4">
        <div className="space-y-3">
          {jobs.map((job) => (
            <Link 
              key={job.id} 
              to={`/jobs/${job.slug}`}
              className="block p-4 border rounded-lg hover:border-primary/50 hover:bg-muted/50 transition-colors"
            >
              <h4 className="font-semibold text-foreground hover:text-primary transition-colors line-clamp-1">
                {job.title}
              </h4>
              <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-muted-foreground">
                {job.company_name && (
                  <span className="flex items-center gap-1">
                    <Building2 className="h-3.5 w-3.5" />
                    {job.company_name}
                  </span>
                )}
                {job.location && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" />
                    {job.location}
                  </span>
                )}
              </div>
              <div className="flex gap-2 mt-2">
                <Badge variant="secondary" className="text-xs">
                  {job.job_type.replace('_', ' ')}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {job.experience_level}
                </Badge>
              </div>
            </Link>
          ))}
        </div>
        
        <Button asChild className="w-full mt-4" variant="default">
          <Link to="/jobs">
            Browse All Jobs
            <ArrowRight className="h-4 w-4 ml-2" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
