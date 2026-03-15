import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/xml; charset=utf-8',
  'Cache-Control': 'public, max-age=1800',
  'X-Robots-Tag': 'noindex',
};

const SITE_URL = 'https://truejobs.co.in';

function escapeXml(str: string): string {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

/** Fetch all rows with pagination (bypasses 1000-row cap) */
async function fetchAllRows(supabase: any, table: string, select: string, filters: (q: any) => any, orderCol: string): Promise<any[]> {
  const PAGE_SIZE = 1000;
  let all: any[] = [];
  let offset = 0;
  while (true) {
    let query = supabase.from(table).select(select).range(offset, offset + PAGE_SIZE - 1).order(orderCol, { ascending: false });
    query = filters(query);
    const { data, error } = await query;
    if (error) { console.error(`Pagination error on ${table}:`, error); break; }
    if (!data || data.length === 0) break;
    all = all.concat(data);
    if (data.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }
  return all;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const sitemapType = url.searchParams.get('type') || 'index';

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const now = new Date().toISOString();

    switch (sitemapType) {
      case 'jobs': return await generateJobsSitemap(supabase, now);
      case 'blog': return await generateBlogSitemap(supabase, now);
      case 'seo': return await generateSEOSitemap(supabase, now);
      case 'pages': return await generatePagesSitemap(supabase, now);
      case 'resources': return await generateResourcesSitemap(supabase, now);
      case 'index': return await generateSitemapIndex(supabase, now);
      default: return await generateSitemapIndex(supabase, now);
    }
  } catch (error) {
    console.error('Sitemap generation error:', error);
    return new Response(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${SITE_URL}/</loc><changefreq>daily</changefreq><priority>1.0</priority></url>
  <url><loc>${SITE_URL}/jobs</loc><changefreq>hourly</changefreq><priority>0.9</priority></url>
</urlset>`, { headers: corsHeaders, status: 200 });
  }
});

// ─── Index ───────────────────────────────────────────────────────────────────
async function generateSitemapIndex(supabase: any, now: string): Promise<Response> {
  const [latestJob, latestBlog] = await Promise.all([
    supabase.from('jobs').select('updated_at').eq('status', 'active').order('updated_at', { ascending: false }).limit(1).single(),
    supabase.from('blog_posts').select('updated_at').eq('is_published', true).order('updated_at', { ascending: false }).limit(1).single(),
  ]);

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap><loc>${SITE_URL}/sitemap-pages.xml</loc><lastmod>${now}</lastmod></sitemap>
  <sitemap><loc>${SITE_URL}/sitemap-jobs.xml</loc><lastmod>${latestJob.data?.updated_at ? new Date(latestJob.data.updated_at).toISOString() : now}</lastmod></sitemap>
  <sitemap><loc>${SITE_URL}/sitemap-blog.xml</loc><lastmod>${latestBlog.data?.updated_at ? new Date(latestBlog.data.updated_at).toISOString() : now}</lastmod></sitemap>
  <sitemap><loc>${SITE_URL}/sitemap-seo.xml</loc><lastmod>${now}</lastmod></sitemap>
  <sitemap><loc>${SITE_URL}/sitemap-resources.xml</loc><lastmod>${now}</lastmod></sitemap>
</sitemapindex>`;
  console.log('Generated sitemap index');
  return new Response(xml, { headers: corsHeaders });
}

// ─── Jobs (paginated, excludes expired) ──────────────────────────────────────
async function generateJobsSitemap(supabase: any, now: string): Promise<Response> {
  const jobs = await fetchAllRows(
    supabase, 'jobs',
    'slug, updated_at, created_at',
    (q: any) => q.eq('status', 'active').not('slug', 'is', null).or(`expires_at.is.null,expires_at.gt.${now}`),
    'created_at'
  );

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <!-- Jobs Sitemap – ${jobs.length} active, non-expired jobs | Generated: ${now} -->\n`;

  for (const j of jobs) {
    if (!j.slug) continue;
    const lm = new Date(j.updated_at || j.created_at).toISOString();
    xml += `  <url><loc>${SITE_URL}/jobs/${escapeXml(j.slug)}</loc><lastmod>${lm}</lastmod><changefreq>daily</changefreq><priority>0.8</priority></url>\n`;
  }
  xml += `</urlset>`;
  console.log(`Jobs sitemap: ${jobs.length} URLs`);
  return new Response(xml, { headers: corsHeaders });
}

// ─── Blog ────────────────────────────────────────────────────────────────────
async function generateBlogSitemap(supabase: any, now: string): Promise<Response> {
  const posts = await fetchAllRows(
    supabase, 'blog_posts',
    'slug, updated_at, published_at',
    (q: any) => q.eq('is_published', true).not('slug', 'is', null),
    'published_at'
  );

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <!-- Blog Sitemap – ${posts.length} posts | Generated: ${now} -->
  <url><loc>${SITE_URL}/blog</loc><lastmod>${now}</lastmod><changefreq>daily</changefreq><priority>0.7</priority></url>\n`;

  for (const p of posts) {
    if (!p.slug) continue;
    const lm = new Date(p.updated_at || p.published_at).toISOString();
    xml += `  <url><loc>${SITE_URL}/blog/${escapeXml(p.slug)}</loc><lastmod>${lm}</lastmod><changefreq>monthly</changefreq><priority>0.6</priority></url>\n`;
  }
  xml += `</urlset>`;
  console.log(`Blog sitemap: ${posts.length} URLs`);
  return new Response(xml, { headers: corsHeaders });
}

// ─── Pages (static + companies) ─────────────────────────────────────────────
async function generatePagesSitemap(supabase: any, now: string): Promise<Response> {
  const staticPages = [
    { loc: '/', cf: 'daily', pr: '1.0' },
    { loc: '/jobs', cf: 'hourly', pr: '0.9' },
    { loc: '/sarkari-jobs', cf: 'daily', pr: '0.8' },
    { loc: '/private-jobs', cf: 'daily', pr: '0.8' },
    { loc: '/companies', cf: 'daily', pr: '0.7' },
    { loc: '/blog', cf: 'daily', pr: '0.7' },
    { loc: '/tools', cf: 'monthly', pr: '0.5' },
    { loc: '/govt-salary-calculator', cf: 'monthly', pr: '0.6' },
    { loc: '/govt-job-age-calculator', cf: 'monthly', pr: '0.6' },
    { loc: '/govt-exam-eligibility-checker', cf: 'monthly', pr: '0.6' },
    { loc: '/govt-exam-fee-calculator', cf: 'monthly', pr: '0.5' },
    { loc: '/typing-test-for-government-exams', cf: 'monthly', pr: '0.5' },
    { loc: '/aboutus', cf: 'monthly', pr: '0.5' },
    { loc: '/contactus', cf: 'monthly', pr: '0.5' },
    { loc: '/privacypolicy', cf: 'yearly', pr: '0.3' },
    { loc: '/termsofuse', cf: 'yearly', pr: '0.3' },
    { loc: '/latest-govt-jobs-2026', cf: 'daily', pr: '0.9' },
    { loc: '/govt-exam-calendar-2026', cf: 'weekly', pr: '0.9' },
    { loc: '/govt-jobs-notification-today', cf: 'hourly', pr: '0.9' },
    { loc: '/govt-jobs-last-date-today', cf: 'hourly', pr: '0.9' },
    { loc: '/govt-exam-results-2026', cf: 'daily', pr: '0.8' },
  ];

  const companies = await fetchAllRows(
    supabase, 'companies',
    'slug, updated_at',
    (q: any) => q.eq('is_approved', true).not('slug', 'is', null),
    'updated_at'
  );

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <!-- Pages Sitemap – ${staticPages.length} static + ${companies.length} companies | Generated: ${now} -->\n`;

  for (const p of staticPages) {
    xml += `  <url><loc>${SITE_URL}${p.loc}</loc><lastmod>${now}</lastmod><changefreq>${p.cf}</changefreq><priority>${p.pr}</priority></url>\n`;
  }
  for (const c of companies) {
    if (!c.slug) continue;
    xml += `  <url><loc>${SITE_URL}/companies/${escapeXml(c.slug)}</loc><lastmod>${new Date(c.updated_at).toISOString()}</lastmod><changefreq>weekly</changefreq><priority>0.6</priority></url>\n`;
  }
  xml += `</urlset>`;
  console.log(`Pages sitemap: ${staticPages.length} static + ${companies.length} companies`);
  return new Response(xml, { headers: corsHeaders });
}

// ─── SEO programmatic landing pages (DB-driven + hardcoded fallback) ─────────
async function generateSEOSitemap(supabase: any, now: string): Promise<Response> {
  // Primary: pull all cached slugs from seo_page_cache (populated by SEOCacheBuilder)
  const cachedSlugs = new Set<string>();
  const PAGE_SIZE = 1000;
  let offset = 0;
  while (true) {
    const { data, error } = await supabase
      .from('seo_page_cache')
      .select('slug')
      .range(offset, offset + PAGE_SIZE - 1)
      .order('slug');
    if (error) { console.error('seo_page_cache query error:', error); break; }
    if (!data || data.length === 0) break;
    for (const row of data) {
      if (row.slug) cachedSlugs.add(row.slug);
    }
    if (data.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  const pages: { loc: string; cf: string; pr: string }[] = [];
  const add = (slugs: string[], cf: string, pr: string) => {
    for (const s of slugs) pages.push({ loc: `/${s}`, cf, pr });
  };

  // Add all cached slugs with sensible defaults
  for (const slug of cachedSlugs) {
    // Skip standalone pages (they're in pages sitemap)
    if (['', 'jobs', 'blog', 'companies', 'tools', 'aboutus', 'contactus', 'privacypolicy', 'termsofuse', 'disclaimer', 'editorial-policy'].includes(slug)) continue;
    pages.push({ loc: `/${slug}`, cf: 'weekly', pr: '0.7' });
  }

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <!-- SEO Programmatic Pages – ${pages.length} URLs (all cache-backed) | Generated: ${now} -->\n`;

  for (const p of pages) {
    xml += `  <url><loc>${SITE_URL}${p.loc}</loc><lastmod>${now}</lastmod><changefreq>${p.cf}</changefreq><priority>${p.pr}</priority></url>\n`;
  }
  xml += `</urlset>`;
  console.log(`SEO sitemap: ${pages.length} URLs (all cache-backed)`);
  return new Response(xml, { headers: corsHeaders });
}
