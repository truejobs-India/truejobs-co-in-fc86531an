import { supabase } from '@/integrations/supabase/client';

/**
 * Handles SEO-safe redirects for deleted or duplicate jobs
 * Returns the redirect URL or null if no redirect needed
 */
export async function getJobRedirect(jobId: string): Promise<string | null> {
  try {
    const { data: job } = await supabase
      .from('jobs')
      .select('is_deleted, is_duplicate, canonical_job_id, normalized_title, company_id, slug')
      .eq('id', jobId)
      .maybeSingle();

    if (!job) return null;

    // Step 1: If deleted with canonical, redirect to canonical
    if (job.is_deleted === true && job.canonical_job_id) {
      const { data: canonical } = await supabase
        .from('jobs')
        .select('slug')
        .eq('id', job.canonical_job_id)
        .maybeSingle();

      if (canonical?.slug) return `/jobs/${canonical.slug}`;
    }

    // Step 2: If duplicate, redirect to canonical
    if (job.is_duplicate === true && job.canonical_job_id) {
      const { data: canonical } = await supabase
        .from('jobs')
        .select('slug')
        .eq('id', job.canonical_job_id)
        .maybeSingle();

      if (canonical?.slug) return `/jobs/${canonical.slug}`;
    }

    // Step 3: Find similar active job (same normalized title)
    if (job.normalized_title) {
      const { data: similar } = await supabase
        .from('jobs')
        .select('slug')
        .eq('is_deleted', false)
        .eq('status', 'active')
        .eq('normalized_title', job.normalized_title)
        .neq('id', jobId)
        .limit(1)
        .maybeSingle();

      if (similar?.slug) return `/jobs/${similar.slug}`;
    }

    // Step 4: Fallback to jobs listing
    return '/jobs';
  } catch (error) {
    console.error('Redirect utility error:', error);
    return '/jobs';
  }
}
