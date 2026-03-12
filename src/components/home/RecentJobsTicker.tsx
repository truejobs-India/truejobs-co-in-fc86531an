import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { Briefcase, MapPin, Clock, ChevronRight } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface RecentJob {
  id: string;
  slug: string;
  title: string;
  company_name: string | null;
  city: string | null;
  location: string | null;
  job_type: string;
  created_at: string;
}

export function RecentJobsTicker() {
  const { t } = useLanguage();
  const [jobs, setJobs] = useState<RecentJob[]>([]);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    fetchRecentJobs();
    
    const channel = supabase
      .channel('recent-jobs')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'jobs',
          filter: 'status=eq.active',
        },
        (payload) => {
          const newJob = payload.new as RecentJob;
          setJobs(prev => [newJob, ...prev.slice(0, 19)]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchRecentJobs = async () => {
    const { data } = await supabase
      .from('jobs')
      .select('id, slug, title, company_name, city, location, job_type, created_at')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(20);

    if (data) {
      setJobs(data);
    }
  };

  if (jobs.length === 0) return null;

  const duplicatedJobs = [...jobs, ...jobs];

  const formatJobType = (type: string) => {
    return type?.replace('_', ' ').toLowerCase();
  };

  return (
    <section className="py-3 sm:py-4 bg-gradient-surface border-b border-border overflow-hidden">
      <div className="container mx-auto px-4">
        <div className="flex items-center gap-3 sm:gap-4">
          {/* Label with live indicator */}
          <div className="shrink-0 flex items-center gap-2 pr-3 sm:pr-4 border-r border-border">
            <span className="relative flex h-2 w-2 sm:h-2.5 sm:w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-full w-full bg-emerald-500"></span>
            </span>
            <span className="text-xs sm:text-sm font-semibold text-foreground whitespace-nowrap">
              {t('recentJobs.title')}
            </span>
          </div>

          {/* Scrolling Jobs */}
          <div 
            className="flex-1 overflow-hidden"
            onMouseEnter={() => setIsPaused(true)}
            onMouseLeave={() => setIsPaused(false)}
          >
            <motion.div
              className="flex gap-3 sm:gap-4"
              animate={{
                x: isPaused ? undefined : [0, -50 * jobs.length],
              }}
              transition={{
                x: {
                  duration: jobs.length * 3,
                  repeat: Infinity,
                  ease: "linear",
                },
              }}
            >
              {duplicatedJobs.map((job, index) => (
                <Link
                  key={`${job.id}-${index}`}
                  to={`/jobs/${job.slug}`}
                  className="shrink-0 flex items-center gap-2 group glass rounded-lg px-3 py-1.5 hover:shadow-soft transition-all"
                >
                  {/* Job Icon */}
                  <div className="h-6 w-6 rounded-md bg-primary/10 flex items-center justify-center">
                    <Briefcase className="h-3.5 w-3.5 text-primary" />
                  </div>
                  
                  {/* Job Title */}
                  <span className="font-medium text-xs sm:text-sm text-foreground whitespace-nowrap max-w-[140px] sm:max-w-[180px] truncate group-hover:text-primary transition-colors">
                    {job.title}
                  </span>
                  
                  {/* Company */}
                  {job.company_name && (
                    <span className="text-xs sm:text-sm text-muted-foreground whitespace-nowrap hidden sm:inline">
                      at <span className="text-foreground/80">{job.company_name}</span>
                    </span>
                  )}

                  {/* Location */}
                  {(job.city || job.location) && (
                    <span className="hidden md:flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="h-3 w-3" />
                      {job.city || job.location}
                    </span>
                  )}

                  {/* Job Type Badge */}
                  <span className="hidden sm:inline text-[10px] sm:text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full whitespace-nowrap">
                    {formatJobType(job.job_type)}
                  </span>

                  {/* Time */}
                  <span className="hidden lg:flex items-center gap-1 text-[10px] text-muted-foreground whitespace-nowrap">
                    <Clock className="h-3 w-3" />
                    {formatDistanceToNow(new Date(job.created_at), { addSuffix: true })}
                  </span>

                  <ChevronRight className="h-3 w-3 text-muted-foreground group-hover:text-primary transition-colors" />
                </Link>
              ))}
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}
