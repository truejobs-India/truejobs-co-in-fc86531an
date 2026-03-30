import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/xml; charset=utf-8',
  'Cache-Control': 'public, max-age=1800',
  'X-Robots-Tag': 'noindex',
};

const SITE_URL = 'https://truejobs.co.in';

// ── Noindex page types — excluded from sitemap ──────────────────────
// Ephemeral / time-sensitive pages that must never appear in the sitemap.
// ⚠️  SYNC REQUIRED — this list is duplicated in 3 isolated Deno Edge Functions:
//   1. seo-cache-rebuild/index.ts   (DB rebuild path)
//   2. build-seo-cache/index.ts     (inventory rebuild path)
//   3. dynamic-sitemap/index.ts     (this file — sitemap exclusion)
// Also mirrored in PAGE_TYPE_POLICIES (src/config/seoRoutePolicyRegistry.ts).
// Update ALL locations when adding or removing ephemeral types.
const NOINDEX_PAGE_TYPES = new Set([
  'deadline-today',
  'deadline-week',
  'deadline-month',
  'combo-closing-soon',
  'deadline-this-week',
]);

// ── Page types that are already covered by dedicated sub-sitemaps ────
// These must be excluded from the SEO sitemap to prevent duplicate URLs
const DEDICATED_SITEMAP_PAGE_TYPES = new Set([
  'blog',            // covered by sitemap-blog.xml
  'employment-news', // covered by sitemap-jobs.xml (employment-news section)
]);

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
  const [latestJob, latestBlog, latestResource] = await Promise.all([
    supabase.from('jobs').select('updated_at').eq('status', 'active').order('updated_at', { ascending: false }).limit(1).single(),
    supabase.from('blog_posts').select('updated_at').eq('is_published', true).order('updated_at', { ascending: false }).limit(1).single(),
    supabase.from('pdf_resources').select('updated_at').eq('is_published', true).order('updated_at', { ascending: false }).limit(1).maybeSingle(),
  ]);

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap><loc>${SITE_URL}/sitemap-pages.xml</loc><lastmod>${now}</lastmod></sitemap>
  <sitemap><loc>${SITE_URL}/sitemap-jobs.xml</loc><lastmod>${latestJob.data?.updated_at ? new Date(latestJob.data.updated_at).toISOString() : now}</lastmod></sitemap>
  <sitemap><loc>${SITE_URL}/sitemap-blog.xml</loc><lastmod>${latestBlog.data?.updated_at ? new Date(latestBlog.data.updated_at).toISOString() : now}</lastmod></sitemap>
  <sitemap><loc>${SITE_URL}/sitemap-seo.xml</loc><lastmod>${now}</lastmod></sitemap>
  <sitemap><loc>${SITE_URL}/sitemap-resources.xml</loc><lastmod>${latestResource?.data?.updated_at ? new Date(latestResource.data.updated_at).toISOString() : now}</lastmod></sitemap>
</sitemapindex>`;
  console.log('Generated sitemap index');
  return new Response(xml, { headers: corsHeaders });
}

// ─── Jobs (active jobs + published employment news) ──────────────────────────
async function generateJobsSitemap(supabase: any, now: string): Promise<Response> {
  // Active job listings
  const jobs = await fetchAllRows(
    supabase, 'jobs',
    'slug, updated_at, created_at',
    (q: any) => q.eq('status', 'active').not('slug', 'is', null).or(`expires_at.is.null,expires_at.gt.${now}`),
    'created_at'
  );

  // Published employment news jobs
  const newsJobs = await fetchAllRows(
    supabase, 'employment_news_jobs',
    'slug, created_at, published_at',
    (q: any) => q.eq('status', 'published').not('slug', 'is', null),
    'created_at'
  );

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <!-- Jobs Sitemap – ${jobs.length} active jobs + ${newsJobs.length} employment news | Generated: ${now} -->\n`;

  for (const j of jobs) {
    if (!j.slug) continue;
    const lm = new Date(j.updated_at || j.created_at).toISOString();
    xml += `  <url><loc>${SITE_URL}/jobs/${escapeXml(j.slug)}</loc><lastmod>${lm}</lastmod><changefreq>daily</changefreq><priority>0.8</priority></url>\n`;
  }

  for (const n of newsJobs) {
    if (!n.slug) continue;
    const lm = new Date(n.published_at || n.created_at).toISOString();
    xml += `  <url><loc>${SITE_URL}/jobs/employment-news/${escapeXml(n.slug)}</loc><lastmod>${lm}</lastmod><changefreq>weekly</changefreq><priority>0.7</priority></url>\n`;
  }

  xml += `</urlset>`;
  console.log(`Jobs sitemap: ${jobs.length} jobs + ${newsJobs.length} employment news`);
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

// ─── Pages (static + companies + govt exam listings) ────────────────────────
async function generatePagesSitemap(supabase: any, now: string): Promise<Response> {
  const staticPages = [
    { loc: '/', cf: 'daily', pr: '1.0' },
    { loc: '/jobs', cf: 'hourly', pr: '0.9' },
    { loc: '/sarkari-jobs', cf: 'daily', pr: '0.8' },
    { loc: '/private-jobs', cf: 'daily', pr: '0.8' },
    { loc: '/latest-govt-jobs', cf: 'daily', pr: '0.9' },
    { loc: '/jobs/employment-news', cf: 'daily', pr: '0.8' },
    { loc: '/all-sarkari-jobs', cf: 'weekly', pr: '0.7' },
    { loc: '/companies', cf: 'daily', pr: '0.7' },
    { loc: '/blog', cf: 'daily', pr: '0.7' },
    { loc: '/sample-papers', cf: 'daily', pr: '0.7' },
    { loc: '/books', cf: 'daily', pr: '0.7' },
    { loc: '/previous-year-papers', cf: 'daily', pr: '0.7' },
    { loc: '/tools', cf: 'monthly', pr: '0.5' },
    { loc: '/govt-salary-calculator', cf: 'monthly', pr: '0.6' },
    { loc: '/govt-job-age-calculator', cf: 'monthly', pr: '0.6' },
    { loc: '/govt-exam-eligibility-checker', cf: 'monthly', pr: '0.6' },
    { loc: '/govt-exam-fee-calculator', cf: 'monthly', pr: '0.5' },
    { loc: '/typing-test-for-government-exams', cf: 'monthly', pr: '0.5' },
    { loc: '/photo-resizer', cf: 'monthly', pr: '0.5' },
    { loc: '/image-resizer', cf: 'monthly', pr: '0.5' },
    { loc: '/pdf-tools', cf: 'monthly', pr: '0.5' },
    { loc: '/percentage-calculator', cf: 'monthly', pr: '0.5' },
    { loc: '/govt-exam-calendar', cf: 'weekly', pr: '0.7' },
    { loc: '/free-guides', cf: 'monthly', pr: '0.5' },
    { loc: '/aboutus', cf: 'monthly', pr: '0.5' },
    { loc: '/contactus', cf: 'monthly', pr: '0.5' },
    { loc: '/privacypolicy', cf: 'yearly', pr: '0.3' },
    { loc: '/termsofuse', cf: 'yearly', pr: '0.3' },
    { loc: '/disclaimer', cf: 'yearly', pr: '0.3' },
    { loc: '/editorial-policy', cf: 'yearly', pr: '0.3' },
  ];

  // Govt exam detail pages
  const govtExams = await fetchAllRows(
    supabase, 'govt_exams',
    'slug, updated_at',
    (q: any) => q.not('slug', 'is', null),
    'updated_at'
  );

  const companies = await fetchAllRows(
    supabase, 'companies',
    'slug, updated_at',
    (q: any) => q.eq('is_approved', true).not('slug', 'is', null),
    'updated_at'
  );

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <!-- Pages Sitemap – ${staticPages.length} static + ${govtExams.length} govt exams + ${companies.length} companies | Generated: ${now} -->\n`;

  for (const p of staticPages) {
    xml += `  <url><loc>${SITE_URL}${p.loc}</loc><lastmod>${now}</lastmod><changefreq>${p.cf}</changefreq><priority>${p.pr}</priority></url>\n`;
  }
  for (const e of govtExams) {
    if (!e.slug) continue;
    const lm = new Date(e.updated_at).toISOString();
    xml += `  <url><loc>${SITE_URL}/sarkari-jobs/${escapeXml(e.slug)}</loc><lastmod>${lm}</lastmod><changefreq>weekly</changefreq><priority>0.8</priority></url>\n`;
  }
  for (const c of companies) {
    if (!c.slug) continue;
    xml += `  <url><loc>${SITE_URL}/companies/${escapeXml(c.slug)}</loc><lastmod>${new Date(c.updated_at).toISOString()}</lastmod><changefreq>weekly</changefreq><priority>0.6</priority></url>\n`;
  }
  xml += `</urlset>`;
  console.log(`Pages sitemap: ${staticPages.length} static + ${govtExams.length} govt exams + ${companies.length} companies`);
  return new Response(xml, { headers: corsHeaders });
}

// ─── SEO programmatic landing pages (cache-backed, deduplicated) ────────────
async function generateSEOSitemap(supabase: any, now: string): Promise<Response> {
  // Pull all cached slugs from seo_page_cache
  const pages: { loc: string; cf: string; pr: string }[] = [];
  const seenLocs = new Set<string>();
  const PAGE_SIZE = 1000;
  let offset = 0;

  // Pages already in other sitemaps — skip to prevent duplicates
  const STANDALONE_SLUGS = new Set([
    '', 'jobs', 'blog', 'companies', 'tools', 'aboutus', 'contactus',
    'privacypolicy', 'termsofuse', 'disclaimer', 'editorial-policy',
    'sarkari-jobs', 'private-jobs', 'latest-govt-jobs', 'all-sarkari-jobs',
    'jobs/employment-news',
    'sample-papers', 'books', 'previous-year-papers', 'free-guides',
    'govt-salary-calculator', 'govt-job-age-calculator',
    'govt-exam-eligibility-checker', 'govt-exam-fee-calculator',
    'typing-test-for-government-exams', 'photo-resizer', 'image-resizer',
    'pdf-tools', 'percentage-calculator', 'govt-exam-calendar',
  ]);

  while (true) {
    const { data, error } = await supabase
      .from('seo_page_cache')
      .select('slug, page_type')
      .range(offset, offset + PAGE_SIZE - 1)
      .order('slug');
    if (error) { console.error('seo_page_cache query error:', error); break; }
    if (!data || data.length === 0) break;
    for (const row of data) {
      if (!row.slug) continue;
      // Skip noindex page types
      if (NOINDEX_PAGE_TYPES.has(row.page_type)) continue;
      // Skip types covered by dedicated sitemaps (blog, employment-news)
      if (DEDICATED_SITEMAP_PAGE_TYPES.has(row.page_type)) continue;
      // Skip standalone pages already in pages sitemap
      if (STANDALONE_SLUGS.has(row.slug)) continue;

      const loc = `/${row.slug}`;
      if (!seenLocs.has(loc)) {
        seenLocs.add(loc);
        pages.push({ loc, cf: 'weekly', pr: '0.7' });
      }
    }
    if (data.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  // Also include published custom_pages (board results) that may not be in cache
  const customPages = await fetchAllRows(
    supabase, 'custom_pages',
    'slug, updated_at',
    (q: any) => q.eq('is_published', true).not('slug', 'is', null),
    'updated_at'
  );
  for (const cp of customPages) {
    if (!cp.slug) continue;
    const loc = `/${cp.slug}`;
    if (!seenLocs.has(loc)) {
      seenLocs.add(loc);
      pages.push({ loc, cf: 'weekly', pr: '0.7' });
    }
  }

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <!-- SEO Programmatic Pages – ${pages.length} URLs (deduplicated, cache-backed) | Generated: ${now} -->\n`;

  for (const p of pages) {
    xml += `  <url><loc>${SITE_URL}${p.loc}</loc><lastmod>${now}</lastmod><changefreq>${p.cf}</changefreq><priority>${p.pr}</priority></url>\n`;
  }
  xml += `</urlset>`;
  console.log(`SEO sitemap: ${pages.length} URLs (deduplicated)`);
  return new Response(xml, { headers: corsHeaders });
}

// ─── Resources (PDF resources + hubs) ────────────────────────────────────────
async function generateResourcesSitemap(supabase: any, now: string): Promise<Response> {
  const resources = await fetchAllRows(
    supabase, 'pdf_resources',
    'slug, resource_type, updated_at, published_at, is_noindex, word_count, file_url',
    (q: any) => q.eq('is_published', true).eq('status', 'published').eq('is_noindex', false).gte('word_count', 500).not('file_url', 'is', null).not('slug', 'is', null),
    'published_at'
  );

  const typePathMap: Record<string, string> = {
    sample_paper: 'sample-papers',
    book: 'books',
    previous_year_paper: 'previous-year-papers',
  };

  // Hub pages
  const hubPages = [
    '/sample-papers/hub/ssc', '/sample-papers/hub/railway', '/sample-papers/hub/banking',
    '/sample-papers/hub/upsc', '/sample-papers/hub/defence', '/sample-papers/hub/state-psc',
    '/books/hub/reasoning', '/books/hub/quant', '/books/hub/general-awareness',
    '/books/hub/english', '/books/hub/general-science',
    '/previous-year-papers/hub/ssc-cgl', '/previous-year-papers/hub/ssc-chsl',
    '/previous-year-papers/hub/rrb-ntpc', '/previous-year-papers/hub/railway',
    '/previous-year-papers/hub/ssc', '/previous-year-papers/hub/banking',
  ];

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <!-- Resources Sitemap – ${hubPages.length} hubs + ${resources.length} resources | Generated: ${now} -->\n`;

  for (const hub of hubPages) {
    xml += `  <url><loc>${SITE_URL}${hub}</loc><lastmod>${now}</lastmod><changefreq>weekly</changefreq><priority>0.7</priority></url>\n`;
  }
  for (const r of resources) {
    if (!r.slug || !r.resource_type) continue;
    const typePath = typePathMap[r.resource_type] || 'sample-papers';
    const lm = new Date(r.updated_at || r.published_at).toISOString();
    xml += `  <url><loc>${SITE_URL}/${typePath}/${escapeXml(r.slug)}</loc><lastmod>${lm}</lastmod><changefreq>monthly</changefreq><priority>0.6</priority></url>\n`;
  }
  xml += `</urlset>`;
  console.log(`Resources sitemap: ${hubPages.length} hubs + ${resources.length} resources`);
  return new Response(xml, { headers: corsHeaders });
}