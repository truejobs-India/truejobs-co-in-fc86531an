import { Link } from 'react-router-dom';
import { Briefcase, MapPin, Clock } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useFilteredJobs, type JobFilter } from '../hooks/useFilteredJobs';
import { formatDistanceToNow } from 'date-fns';

interface LiveJobListingsProps {
  filter: JobFilter;
  title?: string;
}

export function LiveJobListings({ filter, title = 'Latest Job Openings' }: LiveJobListingsProps) {
  const { data: jobs, isLoading } = useFilteredJobs(filter);

  return (
    <section className="mb-10">
      <h2 className="text-2xl font-semibold text-foreground mb-4">{title}</h2>
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-lg" />
          ))}
        </div>
      ) : jobs && jobs.length > 0 ? (
        <div className="space-y-3">
          {jobs.map((job) => (
            <Link
              key={job.id}
              to={`/jobs/${job.slug}`}
              className="block rounded-lg border p-4 hover:border-primary/50 hover:bg-primary/5 transition-colors"
            >
              <h3 className="font-medium text-foreground mb-1">{job.title}</h3>
              <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                {job.company_name && (
                  <span className="inline-flex items-center gap-1">
                    <Briefcase className="h-3.5 w-3.5" /> {job.company_name}
                  </span>
                )}
                {(job.city || job.location) && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" /> {job.city || job.location}
                  </span>
                )}
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" /> {formatDistanceToNow(new Date(job.created_at), { addSuffix: true })}
                </span>
              </div>
              {(job.salary_min || job.salary_max) && (
                <p className="text-sm text-primary mt-1">
                  ₹{job.salary_min?.toLocaleString('en-IN') || '—'} – ₹{job.salary_max?.toLocaleString('en-IN') || '—'} / year
                </p>
              )}
            </Link>
          ))}
        </div>
      ) : (
        <p className="text-muted-foreground text-sm">No active jobs found right now. Check back soon!</p>
      )}
      <div className="mt-4">
        <Link to="/jobs" className="text-sm text-primary hover:underline">
          View all jobs →
        </Link>
      </div>
    </section>
  );
}
