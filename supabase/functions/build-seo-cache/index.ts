/**
 * Build SEO Cache (Manual/Bulk) Edge Function
 *
 * TEMPORARY WORKAROUND NOTE: The SEO_REBUILD_SECRET used by the companion
 * seo-cache-rebuild function is duplicated in app_settings for pg_cron access.
 * See seo-cache-rebuild/index.ts header comment for the full rationale and
 * planned migration path.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const SITE_URL = 'https://truejobs.co.in';

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

// ── Fragment generators ──────────────────────────────────────────────

function generateHeadHTML(page: PageData): string {
  const canonicalUrl = `${SITE_URL}/${page.slug}`;
  const fullTitle = `${page.title} | TrueJobs`;

  const webPageSchema = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: page.title,
    url: canonicalUrl,
    description: page.metaDescription,
    datePublished: page.datePublished,
    dateModified: page.lastUpdated,
  });

  const breadcrumbSchema = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'Govt Jobs', item: `${SITE_URL}/latest-govt-jobs-2026` },
      { '@type': 'ListItem', position: 3, name: page.title, item: canonicalUrl },
    ],
  });

  const faqSchema = page.faqItems.length > 0
    ? `<script type="application/ld+json">${JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: page.faqItems.map(f => ({
          '@type': 'Question',
          name: f.question,
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

/** Full standalone HTML (backward compat for prerender-proxy) */
function generateFullHTML(headHtml: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="en-IN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${headHtml}
</head>
<body>
${bodyHtml}
</body>
</html>`;
}

// ── Helpers ──────────────────────────────────────────────────────────

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

// ── Main handler ─────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnon = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Verify user is admin
    const authClient = createClient(supabaseUrl, supabaseAnon, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(
      authHeader.replace('Bearer ', '')
    );
    if (claimsError || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userId = claimsData.claims.sub;
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    const { data: roleData } = await adminClient
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .eq('role', 'admin')
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { pages, cleanup, allSlugs } = await req.json() as { pages?: PageData[]; cleanup?: boolean; allSlugs?: string[] };

    // Cleanup mode
    if (cleanup && allSlugs && Array.isArray(allSlugs)) {
      let deleted = 0;
      const { data: cachedRows, error: fetchErr } = await adminClient
        .from('seo_page_cache')
        .select('slug');

      if (fetchErr) {
        return new Response(JSON.stringify({ error: `Fetch failed: ${fetchErr.message}` }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const validSet = new Set(allSlugs);
      const staleSlugs = (cachedRows || [])
        .map((r: any) => r.slug as string)
        .filter(s => !validSet.has(s));

      for (let i = 0; i < staleSlugs.length; i += 100) {
        const chunk = staleSlugs.slice(i, i + 100);
        const { error: delErr } = await adminClient
          .from('seo_page_cache')
          .delete()
          .in('slug', chunk);
        if (!delErr) deleted += chunk.length;
      }

      return new Response(JSON.stringify({
        success: true,
        action: 'cleanup',
        staleDeleted: deleted,
        totalStale: staleSlugs.length,
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!pages || !Array.isArray(pages) || pages.length === 0) {
      return new Response(JSON.stringify({ error: 'No pages provided' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Generate all three fragments for each page and upsert
    const rows = await Promise.all(pages.map(async (page) => {
      const headHtml = generateHeadHTML(page);
      const bodyHtml = generateBodyHTML(page);
      const fullHtml = generateFullHTML(headHtml, bodyHtml);
      // Compute content hash (SHA-256)
      const encoder = new TextEncoder();
      const data = encoder.encode(headHtml + bodyHtml);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const contentHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      return {
        slug: page.slug,
        head_html: headHtml,
        body_html: bodyHtml,
        full_html: fullHtml,
        page_type: page.pageType,
        content_hash: contentHash,
        updated_at: new Date().toISOString(),
      };
    }));

    let inserted = 0;
    const errors: string[] = [];
    for (let i = 0; i < rows.length; i += 50) {
      const chunk = rows.slice(i, i + 50);
      const { error } = await adminClient
        .from('seo_page_cache')
        .upsert(chunk, { onConflict: 'slug' });
      if (error) {
        errors.push(`Chunk ${i}: ${error.message}`);
      } else {
        inserted += chunk.length;
      }
    }

    return new Response(JSON.stringify({
      success: true,
      totalPages: pages.length,
      inserted,
      errors: errors.length > 0 ? errors : undefined,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
