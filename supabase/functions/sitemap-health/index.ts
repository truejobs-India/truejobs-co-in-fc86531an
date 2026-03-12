import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
};

const SITE_URL = 'https://truejobs.co.in';

interface HealthCheckResult {
  status: 'healthy' | 'warning' | 'error';
  timestamp: string;
  summary: {
    totalUrls: number;
    jobsCount: number;
    companiesCount: number;
    blogPostsCount: number;
    staticPagesCount: number;
  };
  issues: HealthIssue[];
  recommendations: string[];
}

interface HealthIssue {
  type: 'error' | 'warning' | 'info';
  category: string;
  message: string;
  affectedUrls?: string[];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const result = await performHealthCheck(supabase);
    
    return new Response(JSON.stringify(result, null, 2), { 
      headers: corsHeaders,
      status: 200 
    });
  } catch (error: unknown) {
    console.error('Health check error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ 
      status: 'error',
      message: 'Failed to perform health check',
      error: errorMessage 
    }), { 
      headers: corsHeaders,
      status: 500 
    });
  }
});

async function performHealthCheck(supabase: any): Promise<HealthCheckResult> {
  const issues: HealthIssue[] = [];
  const recommendations: string[] = [];
  const now = new Date().toISOString();

  // Count jobs
  const { count: jobsCount, data: jobsData, error: jobsError } = await supabase
    .from('jobs')
    .select('id, slug, title, updated_at', { count: 'exact' })
    .eq('status', 'active')
    .limit(100);

  if (jobsError) {
    issues.push({
      type: 'error',
      category: 'database',
      message: `Failed to query jobs: ${jobsError.message}`
    });
  }

  // Check for jobs without slugs
  const { data: jobsWithoutSlugs } = await supabase
    .from('jobs')
    .select('id, title')
    .eq('status', 'active')
    .is('slug', null)
    .limit(10);

  if (jobsWithoutSlugs && jobsWithoutSlugs.length > 0) {
    issues.push({
      type: 'warning',
      category: 'data_quality',
      message: `${jobsWithoutSlugs.length} active jobs are missing slugs and won't appear in sitemap`,
      affectedUrls: jobsWithoutSlugs.map((j: any) => `Job ID: ${j.id} - ${j.title}`)
    });
    recommendations.push('Generate slugs for all active jobs to ensure they appear in the sitemap');
  }

  // Check for duplicate job slugs
  const { data: duplicateJobSlugs } = await supabase
    .rpc('check_duplicate_slugs', { table_name: 'jobs' })
    .limit(10);

  // Count companies
  const { count: companiesCount, error: companiesError } = await supabase
    .from('companies')
    .select('id', { count: 'exact' })
    .eq('is_approved', true);

  if (companiesError) {
    issues.push({
      type: 'error',
      category: 'database',
      message: `Failed to query companies: ${companiesError.message}`
    });
  }

  // Check for companies without slugs
  const { data: companiesWithoutSlugs } = await supabase
    .from('companies')
    .select('id, name')
    .eq('is_approved', true)
    .is('slug', null)
    .limit(10);

  if (companiesWithoutSlugs && companiesWithoutSlugs.length > 0) {
    issues.push({
      type: 'warning',
      category: 'data_quality',
      message: `${companiesWithoutSlugs.length} approved companies are missing slugs`,
      affectedUrls: companiesWithoutSlugs.map((c: any) => `Company ID: ${c.id} - ${c.name}`)
    });
    recommendations.push('Generate slugs for all approved companies');
  }

  // Count blog posts
  const { count: blogPostsCount, error: blogError } = await supabase
    .from('blog_posts')
    .select('id', { count: 'exact' })
    .eq('is_published', true);

  if (blogError) {
    issues.push({
      type: 'error',
      category: 'database',
      message: `Failed to query blog posts: ${blogError.message}`
    });
  }

  // Check for stale content (jobs not updated in 30+ days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  const { count: staleJobsCount } = await supabase
    .from('jobs')
    .select('id', { count: 'exact' })
    .eq('status', 'active')
    .lt('updated_at', thirtyDaysAgo.toISOString());

  if (staleJobsCount && staleJobsCount > 100) {
    issues.push({
      type: 'info',
      category: 'freshness',
      message: `${staleJobsCount} jobs haven't been updated in 30+ days`
    });
    recommendations.push('Consider reviewing and updating stale job listings');
  }

  // Check for expired jobs still marked as active
  const { count: expiredButActiveCount } = await supabase
    .from('jobs')
    .select('id', { count: 'exact' })
    .eq('status', 'active')
    .lt('expires_at', now);

  if (expiredButActiveCount && expiredButActiveCount > 0) {
    issues.push({
      type: 'warning',
      category: 'data_quality',
      message: `${expiredButActiveCount} expired jobs are still marked as active`
    });
    recommendations.push('Run a cleanup job to deactivate expired listings');
  }

  // Calculate totals
  const staticPagesCount = 6; // Homepage, Jobs listing, About, Contact, Privacy, Terms
  const totalUrls = (jobsCount || 0) + (companiesCount || 0) + (blogPostsCount || 0) + staticPagesCount;

  // Check sitemap size limits
  if (totalUrls > 45000) {
    issues.push({
      type: 'warning',
      category: 'sitemap_limits',
      message: `Total URLs (${totalUrls}) approaching 50,000 limit per sitemap file`
    });
    recommendations.push('Consider implementing sitemap pagination for job listings');
  }

  // Determine overall status
  let status: 'healthy' | 'warning' | 'error' = 'healthy';
  if (issues.some(i => i.type === 'error')) {
    status = 'error';
  } else if (issues.some(i => i.type === 'warning')) {
    status = 'warning';
  }

  // Add general recommendations
  if (jobsCount === 0) {
    recommendations.push('No active jobs found - ensure job scraping is working');
  }

  if (blogPostsCount === 0) {
    recommendations.push('No published blog posts - consider adding SEO-friendly content');
  }

  return {
    status,
    timestamp: now,
    summary: {
      totalUrls,
      jobsCount: jobsCount || 0,
      companiesCount: companiesCount || 0,
      blogPostsCount: blogPostsCount || 0,
      staticPagesCount
    },
    issues,
    recommendations
  };
}
