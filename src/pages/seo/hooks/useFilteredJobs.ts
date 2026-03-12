import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface JobFilter {
  city?: string;
  keywords?: string[];
  jobType?: string;
  limit?: number;
}

export function useFilteredJobs(filter: JobFilter) {
  return useQuery({
    queryKey: ['seo-filtered-jobs', filter],
    queryFn: async () => {
      let query = supabase
        .from('jobs')
        .select('id, title, slug, company_name, city, location, salary_min, salary_max, salary_currency, job_type, experience_level, created_at, is_remote, is_work_from_home')
        .eq('status', 'active')
        .eq('is_deleted', false)
        .eq('is_duplicate', false)
        .order('created_at', { ascending: false })
        .limit(filter.limit || 10);

      if (filter.city) {
        query = query.ilike('city', filter.city);
      }

      if (filter.jobType) {
        query = query.eq('job_type', filter.jobType as "contract" | "full_time" | "internship" | "part_time" | "remote");
      }

      if (filter.keywords && filter.keywords.length > 0) {
        // Use OR filter on title for keyword matching
        const orFilter = filter.keywords
          .map(k => `title.ilike.%${k}%`)
          .join(',');
        query = query.or(orFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}
