/**
 * SEO Cache Rebuild Edge Function
 *
 * TEMPORARY WORKAROUND: Authentication for the pg_cron scheduled job currently
 * uses SEO_REBUILD_SECRET stored as BOTH a Supabase edge-function secret AND
 * in the `app_settings` table (key = 'seo_rebuild_secret', is_internal = true).
 * This duplication exists because pg_cron's net.http_post cannot access Vault
 * secrets directly and must inline the token in its SQL command.
 *
 * TODO: Replace this pattern with one of:
 *   1. Supabase pg_cron → direct DB function call (bypassing HTTP entirely)
 *   2. A signed internal webhook token with short TTL
 *   3. Supabase Cron Jobs native feature (when available in Lovable Cloud)
 *
 * The `app_settings.seo_rebuild_secret` row is protected by:
 *   - `is_internal = true` flag, excluded from authenticated SELECT policy
 *   - Only admin RLS (ALL) and service_role can read it
 *   - Value is NEVER returned in any API response or admin UI
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const SITE_URL = 'https://truejobs.co.in';

// ── Auth ─────────────────────────────────────────────────────────────

async function authenticateRequest(req: Request): Promise<{ authorized: boolean; source: string }> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return { authorized: false, source: 'none' };
  }
  const token = authHeader.replace('Bearer ', '');

  // Path 1: Internal secret (cron / deploy hook)
  const rebuildSecret = Deno.env.get('SEO_REBUILD_SECRET');
  if (rebuildSecret && token === rebuildSecret) {
    return { authorized: true, source: 'internal-secret' };
  }

  // Path 2: Admin JWT
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseAnon = Deno.env.get('SUPABASE_ANON_KEY')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  try {
    const authClient = createClient(supabaseUrl, supabaseAnon, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claimsData, error } = await authClient.auth.getClaims(token);
    if (error || !claimsData?.claims?.sub) {
      return { authorized: false, source: 'invalid-jwt' };
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    const { data: roleData } = await adminClient
      .from('user_roles')
      .select('role')
      .eq('user_id', claimsData.claims.sub)
      .eq('role', 'admin')
      .maybeSingle();

    if (!roleData) {
      return { authorized: false, source: 'not-admin' };
    }
    return { authorized: true, source: 'admin-jwt' };
  } catch {
    return { authorized: false, source: 'auth-error' };
  }
}

// ── HTML Generation (mirrored from build-seo-cache) ──────────────────

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function escAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function formatDate(iso: string): string {
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${months[m - 1]} ${y}`;
}

interface PageData {
  slug: string;
  pageType: string;
  title: string;
  h1: string;
  metaDescription: string;
  introContent: string;
  faqItems: { question: string; answer: string }[];
  datePublished: string;
  lastUpdated: string;
  crossLinks: { label: string; slug: string }[];
}

// ── Noindex page types ───────────────────────────────────────────────
// Ephemeral / time-sensitive pages that must never be indexed.
// Must stay in sync with NOINDEX_PAGE_TYPES in build-seo-cache/index.ts,
// dynamic-sitemap/index.ts, and PAGE_TYPE_POLICIES (seoRoutePolicyRegistry.ts).
const NOINDEX_PAGE_TYPES = new Set([
  'deadline-today',
  'deadline-week',
  'deadline-month',
  'combo-closing-soon',
  'deadline-this-week',
]);

function generateHeadHTML(page: PageData): string {
  const canonicalUrl = `${SITE_URL}/${page.slug}`;
  const fullTitle = `${page.title} | TrueJobs`;

  const webPageSchema = JSON.stringify({
    '@context': 'https://schema.org', '@type': 'WebPage',
    name: page.title, url: canonicalUrl, description: page.metaDescription,
    datePublished: page.datePublished, dateModified: page.lastUpdated,
  });

  const breadcrumbSchema = JSON.stringify({
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'Govt Jobs', item: `${SITE_URL}/latest-govt-jobs-2026` },
      { '@type': 'ListItem', position: 3, name: page.title, item: canonicalUrl },
    ],
  });

  const faqSchema = page.faqItems.length > 0
    ? `<script type="application/ld+json">${JSON.stringify({
        '@context': 'https://schema.org', '@type': 'FAQPage',
        mainEntity: page.faqItems.map(f => ({
          '@type': 'Question', name: f.question,
          acceptedAnswer: { '@type': 'Answer', text: f.answer },
        })),
      })}</script>`
    : '';

  return `<title>${escHtml(fullTitle)}</title>
<meta name="description" content="${escAttr(page.metaDescription)}">
<link rel="canonical" href="${canonicalUrl}">
<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1">
<meta property="og:title" content="${escAttr(fullTitle)}">
<meta property="og:description" content="${escAttr(page.metaDescription)}">
<meta property="og:type" content="website">
<meta property="og:url" content="${canonicalUrl}">
<meta property="og:image" content="${SITE_URL}/og-image.png">
<meta property="og:site_name" content="TrueJobs">
<meta property="og:locale" content="en_IN">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:site" content="@TrueJobsIndia">
<meta name="twitter:title" content="${escAttr(fullTitle)}">
<meta name="twitter:description" content="${escAttr(page.metaDescription)}">
<meta name="twitter:image" content="${SITE_URL}/og-image.png">
<script type="application/ld+json">${webPageSchema}</script>
<script type="application/ld+json">${breadcrumbSchema}</script>
${faqSchema}
<style>
body{font-family:system-ui,-apple-system,sans-serif;margin:0;color:#1a1a1a;line-height:1.7}
.sfc-wrap{min-height:100vh;display:flex;flex-direction:column}
.sfc-nav{border-bottom:1px solid #e5e7eb;background:#fff;padding:12px 16px;display:flex;align-items:center;gap:16px}
.sfc-nav a{color:#2563eb;text-decoration:none;font-size:14px;font-weight:500}
.sfc-nav a:hover{text-decoration:underline}
.sfc-nav .sfc-logo{font-weight:700;font-size:18px;color:#ea580c}
.sfc-main{flex:1;max-width:56rem;margin:0 auto;padding:32px 16px;width:100%}
.sfc-bc{font-size:13px;color:#6b7280;margin-bottom:24px}
.sfc-bc a{color:#2563eb;text-decoration:none}
.sfc-h1{font-size:1.875rem;font-weight:700;margin:0 0 16px;line-height:1.2}
.sfc-badge{font-size:13px;color:#6b7280;margin-bottom:24px;display:block}
.sfc-article{color:#4b5563;line-height:1.8}
.sfc-article h2{color:#1a1a1a;font-size:1.25rem;margin:24px 0 8px;font-weight:600}
.sfc-article h3{color:#1a1a1a;font-size:1.1rem;margin:16px 0 8px;font-weight:600}
.sfc-article a{color:#2563eb}
.sfc-article table{width:100%;border-collapse:collapse;margin:16px 0}
.sfc-article th,.sfc-article td{border:1px solid #e5e7eb;padding:8px;text-align:left}
.sfc-article th{background:#f9fafb;font-weight:600}
.sfc-faq details{margin:4px 0;border:1px solid #e5e7eb;border-radius:8px}
.sfc-faq summary{padding:12px 16px;cursor:pointer;font-weight:500;color:#1a1a1a}
.sfc-faq details p{padding:0 16px 12px;margin:0;color:#4b5563}
.sfc-links{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:8px;margin:24px 0}
.sfc-links a{display:inline-flex;align-items:center;gap:6px;padding:8px 12px;border:1px solid #e5e7eb;border-radius:8px;font-size:14px;color:#4b5563;text-decoration:none}
.sfc-links a:hover{border-color:#3b82f6;color:#1a1a1a}
.sfc-disc{margin:32px 0 16px;padding:12px 16px;background:#fffbeb;border:1px solid #fde68a;border-radius:8px;font-size:13px;color:#92400e}
.sfc-footer{border-top:1px solid #e5e7eb;padding:24px 16px;font-size:13px;color:#6b7280;text-align:center}
.sfc-footer a{color:#2563eb;text-decoration:none;margin:0 8px}
</style>`;
}

function generateBodyHTML(page: PageData): string {
  const lastUpdatedFormatted = formatDate(page.lastUpdated);

  const faqHtml = page.faqItems.length > 0
    ? `<section class="sfc-faq"><h2>Frequently Asked Questions</h2>${page.faqItems.map(f =>
        `<details><summary>${escHtml(f.question)}</summary><p>${escHtml(f.answer)}</p></details>`
      ).join('\n')}</section>`
    : '';

  const linksHtml = page.crossLinks.length > 0
    ? `<nav aria-label="Related pages"><h2>Related Pages</h2><div class="sfc-links">${page.crossLinks.map(l =>
        `<a href="/${l.slug}">${escHtml(l.label)}</a>`
      ).join('\n')}</div></nav>`
    : '';

  return `<div class="sfc-wrap">
<nav class="sfc-nav">
<a href="/" class="sfc-logo">TrueJobs</a>
<a href="/jobs">Jobs</a>
<a href="/latest-govt-jobs-2026">Govt Jobs</a>
<a href="/companies">Companies</a>
<a href="/blog">Blog</a>
</nav>
<main class="sfc-main">
<nav aria-label="Breadcrumb" class="sfc-bc"><a href="/">Home</a> › <a href="/latest-govt-jobs-2026">Govt Jobs</a> › <span>${escHtml(page.title)}</span></nav>
<h1 class="sfc-h1">${escHtml(page.h1)}</h1>
<span class="sfc-badge">Last Updated: ${lastUpdatedFormatted}</span>
<article class="sfc-article">${page.introContent}</article>
${faqHtml}
${linksHtml}
<div class="sfc-disc"><strong>Disclaimer:</strong> TrueJobs aggregates information from official sources. Always verify details on the official recruitment website. We are not affiliated with any government body.</div>
</main>
<footer class="sfc-footer">
<a href="/privacypolicy">Privacy Policy</a>
<a href="/editorial-policy">Editorial Policy</a>
<a href="/disclaimer">Disclaimer</a>
<a href="/contactus">Contact Us</a>
<a href="/aboutus">About</a>
<p>© 2026 TrueJobs.co.in — India's Smart Job Search Portal</p>
</footer>
</div>`;
}

// ── Content Hash ─────────────────────────────────────────────────────

async function computeHash(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// ── Cloudflare Cache Purge ───────────────────────────────────────────

async function purgeCloudflareCacheForUrls(urls: string[]): Promise<number> {
  const zoneId = Deno.env.get('CLOUDFLARE_ZONE_ID');
  const apiToken = Deno.env.get('CLOUDFLARE_API_TOKEN');
  if (!zoneId || !apiToken || urls.length === 0) return 0;

  let purged = 0;
  // CF API allows max 30 URLs per request
  for (let i = 0; i < urls.length; i += 30) {
    const chunk = urls.slice(i, i + 30);
    try {
      const res = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/purge_cache`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ files: chunk }),
      });
      if (res.ok) purged += chunk.length;
    } catch { /* skip silently */ }
  }
  return purged;
}

// ── Main Handler ─────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    // Authenticate
    const auth = await authenticateRequest(req);
    if (!auth.authorized) {
      return new Response(JSON.stringify({ error: 'Unauthorized', detail: auth.source }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const db = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json().catch(() => ({}));
    const mode: string = body.mode || 'queue';
    const triggerSource = body.trigger || auth.source;

    if (mode === 'queue') {
      return await handleQueueMode(db, triggerSource, startTime);
    } else if (mode === 'slugs') {
      const slugs: string[] = body.slugs || [];
      if (slugs.length === 0) {
        return jsonResponse({ error: 'No slugs provided' }, 400);
      }
      return await handleSlugsMode(db, slugs, triggerSource, startTime);
    } else if (mode === 'full') {
      return await handleFullMode(db, triggerSource, startTime);
    } else if (mode === 'purge-all-cf') {
      return await handlePurgeAllCF(db, triggerSource, startTime);
    }

    return jsonResponse({ error: `Unknown mode: ${mode}` }, 400);
  } catch (error) {
    return jsonResponse({ error: error.message }, 500);
  }
});

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// ── Queue Mode ───────────────────────────────────────────────────────

async function handleQueueMode(db: any, triggerSource: string, startTime: number) {
  // Claim up to 50 pending items
  const { data: pending, error: fetchErr } = await db
    .from('seo_rebuild_queue')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(50);

  if (fetchErr || !pending || pending.length === 0) {
    return jsonResponse({ success: true, message: 'No pending items', count: 0 });
  }

  // Mark as processing
  const ids = pending.map((r: any) => r.id);
  await db.from('seo_rebuild_queue').update({ status: 'processing' }).in('id', ids);

  let rebuilt = 0, skipped = 0, failed = 0, cfPurged = 0;
  const urlsToPurge: string[] = [];

  for (const item of pending) {
    try {
      // Advisory lock skipped — pg_advisory_xact_lock is session-level and
      // not effective via REST/PostgREST. Concurrency is managed by the
      // claim-then-process pattern (status = 'processing') instead.

      const isStale = item.page_type.endsWith('-stale');

      if (isStale) {
        // Delete from cache
        await db.from('seo_page_cache').delete().eq('slug', item.slug);
        urlsToPurge.push(`${SITE_URL}/${item.slug}`);
        rebuilt++;
      } else {
        // Try to fetch page data from DB and rebuild
        const result = await rebuildSingleSlug(db, item.slug, item.page_type);
        if (result === 'rebuilt') {
          rebuilt++;
          urlsToPurge.push(`${SITE_URL}/${item.slug}`);
        } else if (result === 'skipped') {
          skipped++;
        } else {
          failed++;
        }
      }

      await db.from('seo_rebuild_queue').update({
        status: 'done', processed_at: new Date().toISOString(),
      }).eq('id', item.id);
    } catch (err: any) {
      const newRetry = (item.retry_count || 0) + 1;
      const newStatus = newRetry >= (item.max_retries || 3) ? 'failed' : 'pending';
      await db.from('seo_rebuild_queue').update({
        status: newStatus,
        retry_count: newRetry,
        last_retry_at: new Date().toISOString(),
        error_message: err.message?.substring(0, 500),
      }).eq('id', item.id);
      failed++;
    }
  }

  cfPurged = await purgeCloudflareCacheForUrls(urlsToPurge);

  // Log
  await db.from('seo_rebuild_log').insert({
    rebuild_type: 'batch',
    slugs_requested: pending.length,
    slugs_rebuilt: rebuilt,
    slugs_skipped: skipped,
    slugs_failed: failed,
    cf_purged: cfPurged,
    duration_ms: Date.now() - startTime,
    trigger_source: triggerSource,
  });

  return jsonResponse({ success: true, processed: pending.length, rebuilt, skipped, failed, cfPurged });
}

// ── Slugs Mode ───────────────────────────────────────────────────────

async function handleSlugsMode(db: any, slugs: string[], triggerSource: string, startTime: number) {
  let rebuilt = 0, skipped = 0, failed = 0;
  const urlsToPurge: string[] = [];

  for (const slug of slugs) {
    try {
      const result = await rebuildSingleSlug(db, slug, 'manual');
      if (result === 'rebuilt') {
        rebuilt++;
        urlsToPurge.push(`${SITE_URL}/${slug}`);
      } else if (result === 'skipped') {
        skipped++;
      } else {
        failed++;
      }
    } catch {
      failed++;
    }
  }

  const cfPurged = await purgeCloudflareCacheForUrls(urlsToPurge);

  await db.from('seo_rebuild_log').insert({
    rebuild_type: 'single',
    slugs_requested: slugs.length,
    slugs_rebuilt: rebuilt,
    slugs_skipped: skipped,
    slugs_failed: failed,
    cf_purged: cfPurged,
    duration_ms: Date.now() - startTime,
    trigger_source: triggerSource,
  });

  return jsonResponse({ success: true, rebuilt, skipped, failed, cfPurged });
}

// ── Full Mode ────────────────────────────────────────────────────────

async function handleFullMode(db: any, triggerSource: string, startTime: number) {
  // Full rebuild: fetch ALL cached pages and regenerate them
  // For DB-sourced pages, re-fetch from source tables
  // For static pages, we can only rebuild what's already in the cache
  
  const { data: allCached, error } = await db
    .from('seo_page_cache')
    .select('slug, page_type, head_html, body_html, content_hash');

  if (error) {
    return jsonResponse({ error: `Failed to fetch cache: ${error.message}` }, 500);
  }

  let rebuilt = 0, skipped = 0, failed = 0;
  const urlsToPurge: string[] = [];

  for (const row of (allCached || [])) {
    try {
      const result = await rebuildSingleSlug(db, row.slug, row.page_type || 'unknown');
      if (result === 'rebuilt') {
        rebuilt++;
        urlsToPurge.push(`${SITE_URL}/${row.slug}`);
      } else if (result === 'skipped') {
        skipped++;
      } else {
        failed++;
      }
    } catch {
      failed++;
    }
  }

  const cfPurged = await purgeCloudflareCacheForUrls(urlsToPurge);

  await db.from('seo_rebuild_log').insert({
    rebuild_type: 'full',
    slugs_requested: (allCached || []).length,
    slugs_rebuilt: rebuilt,
    slugs_skipped: skipped,
    slugs_failed: failed,
    cf_purged: cfPurged,
    duration_ms: Date.now() - startTime,
    trigger_source: triggerSource,
  });

  return jsonResponse({ success: true, total: (allCached || []).length, rebuilt, skipped, failed, cfPurged });
}

// ── Purge All CF Mode ────────────────────────────────────────────────

async function handlePurgeAllCF(db: any, triggerSource: string, startTime: number) {
  const zoneId = Deno.env.get('CLOUDFLARE_ZONE_ID');
  const apiToken = Deno.env.get('CLOUDFLARE_API_TOKEN');

  if (!zoneId || !apiToken) {
    return jsonResponse({
      error: 'Cloudflare credentials not configured (CLOUDFLARE_ZONE_ID / CLOUDFLARE_API_TOKEN)',
    }, 400);
  }

  // Fetch all cached slugs to build purge URL list
  const { data: allCached, error } = await db
    .from('seo_page_cache')
    .select('slug');

  if (error) {
    return jsonResponse({ error: `Failed to fetch cache: ${error.message}` }, 500);
  }

  const urls = (allCached || []).map((r: any) => `${SITE_URL}/${r.slug}`);
  const cfPurged = await purgeCloudflareCacheForUrls(urls);

  await db.from('seo_rebuild_log').insert({
    rebuild_type: 'purge-all-cf',
    slugs_requested: urls.length,
    slugs_rebuilt: 0,
    slugs_skipped: 0,
    slugs_failed: 0,
    cf_purged: cfPurged,
    duration_ms: Date.now() - startTime,
    trigger_source: triggerSource,
  });

  return jsonResponse({ success: true, totalUrls: urls.length, cfPurged });
}

// ── Single Slug Rebuild ──────────────────────────────────────────────

async function rebuildSingleSlug(db: any, slug: string, pageType: string): Promise<'rebuilt' | 'skipped' | 'failed'> {
  // Try to build page data from DB sources
  let pageData: PageData | null = null;

  if (pageType === 'blog' || pageType.startsWith('blog')) {
    pageData = await fetchBlogPageData(db, slug);
  } else if (pageType === 'govt-exam' || pageType.startsWith('govt-exam')) {
    pageData = await fetchGovtExamPageData(db, slug);
  } else if (pageType === 'employment-news' || pageType.startsWith('employment-news')) {
    pageData = await fetchEmploymentNewsPageData(db, slug);
  }

  // If not a DB-sourced page, try to use existing cached data to regenerate
  if (!pageData) {
    const { data: existing } = await db
      .from('seo_page_cache')
      .select('head_html, body_html, content_hash')
      .eq('slug', slug)
      .maybeSingle();

    if (existing) {
      // Already cached and not a DB-sourced type — skip (can't regenerate without source data)
      return 'skipped';
    }
    return 'failed';
  }

  const headHtml = generateHeadHTML(pageData);
  const bodyHtml = generateBodyHTML(pageData);
  const fullHtml = `<!DOCTYPE html><html lang="en-IN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">${headHtml}</head><body>${bodyHtml}</body></html>`;
  const hash = await computeHash(headHtml + bodyHtml);

  // Check if hash changed
  const { data: existing } = await db
    .from('seo_page_cache')
    .select('content_hash')
    .eq('slug', slug)
    .maybeSingle();

  if (existing?.content_hash === hash) {
    return 'skipped';
  }

  // Upsert
  const { error } = await db.from('seo_page_cache').upsert({
    slug,
    head_html: headHtml,
    body_html: bodyHtml,
    full_html: fullHtml,
    page_type: pageData.pageType,
    content_hash: hash,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'slug' });

  return error ? 'failed' : 'rebuilt';
}

// ── DB Page Data Fetchers ────────────────────────────────────────────

async function fetchBlogPageData(db: any, slug: string): Promise<PageData | null> {
  const { data } = await db
    .from('blog_posts')
    .select('title, slug, meta_title, meta_description, excerpt, content, published_at, updated_at, faq_schema, is_published')
    .eq('slug', slug)
    .eq('is_published', true)
    .maybeSingle();

  if (!data) return null;

  const faqItems = Array.isArray(data.faq_schema) ? data.faq_schema.map((f: any) => ({
    question: f.question || f.name || '',
    answer: f.answer || f.acceptedAnswer?.text || '',
  })) : [];

  return {
    slug: data.slug,
    pageType: 'blog',
    title: data.meta_title || data.title,
    h1: data.title,
    metaDescription: data.meta_description || data.excerpt || '',
    introContent: (data.content || '').substring(0, 1000),
    faqItems,
    datePublished: data.published_at ? data.published_at.split('T')[0] : '2026-01-15',
    lastUpdated: data.updated_at ? data.updated_at.split('T')[0] : '2026-01-15',
    crossLinks: [
      { label: 'Browse Jobs', slug: 'jobs' },
      { label: 'Career Blog', slug: 'blog' },
    ],
  };
}

async function fetchGovtExamPageData(db: any, slug: string): Promise<PageData | null> {
  const { data } = await db
    .from('govt_exams')
    .select('exam_name, slug, meta_title, meta_description, seo_content, faqs, created_at, updated_at, conducting_body, department_slug')
    .eq('slug', slug)
    .maybeSingle();

  if (!data) return null;

  const faqItems = Array.isArray(data.faqs) ? data.faqs.map((f: any) => ({
    question: f.question || f.q || '',
    answer: f.answer || f.a || '',
  })).filter((f: any) => f.question && f.answer) : [];

  return {
    slug: data.slug,
    pageType: 'govt-exam',
    title: data.meta_title || `${data.exam_name} Recruitment`,
    h1: data.meta_title || `${data.exam_name} Recruitment`,
    metaDescription: data.meta_description || `Latest ${data.exam_name} notification, dates, eligibility, and application details.`,
    introContent: data.seo_content || `<p>Get the latest information about ${data.exam_name} recruitment.</p>`,
    faqItems,
    datePublished: data.created_at ? data.created_at.split('T')[0] : '2026-01-15',
    lastUpdated: data.updated_at ? data.updated_at.split('T')[0] : '2026-01-15',
    crossLinks: [
      { label: 'All Sarkari Jobs', slug: 'all-sarkari-jobs' },
      ...(data.department_slug ? [{ label: `${data.department_slug.replace(/-/g, ' ')} Jobs`, slug: data.department_slug }] : []),
    ],
  };
}

async function fetchEmploymentNewsPageData(db: any, slug: string): Promise<PageData | null> {
  const { data } = await db
    .from('employment_news_jobs')
    .select('org_name, post, slug, meta_title, meta_description, enriched_description, description, published_at, faq_html, state')
    .eq('slug', slug)
    .eq('status', 'published')
    .maybeSingle();

  if (!data) return null;

  return {
    slug: data.slug,
    pageType: 'employment-news',
    title: data.meta_title || `${data.org_name || ''} ${data.post || ''} Recruitment`,
    h1: data.meta_title || `${data.org_name || ''} ${data.post || ''} Recruitment`,
    metaDescription: data.meta_description || `${data.org_name || ''} recruitment for ${data.post || ''} posts.`,
    introContent: data.enriched_description || data.description || '',
    faqItems: [],
    datePublished: data.published_at ? data.published_at.split('T')[0] : '2026-01-15',
    lastUpdated: data.published_at ? data.published_at.split('T')[0] : '2026-01-15',
    crossLinks: [
      { label: 'Latest Govt Jobs', slug: 'latest-govt-jobs-2026' },
      ...(data.state ? [{ label: `${data.state} Govt Jobs`, slug: `${data.state.toLowerCase().replace(/ /g, '-')}-govt-jobs` }] : []),
    ],
  };
}
