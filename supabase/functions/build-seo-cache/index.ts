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

function generateHTML(page: PageData): string {
  const canonicalUrl = `${SITE_URL}/${page.slug}`;
  const fullTitle = `${page.title} | TrueJobs`;

  // Build FAQ HTML
  const faqHtml = page.faqItems.length > 0
    ? `<section><h2>Frequently Asked Questions</h2>${page.faqItems.map(f =>
        `<details><summary>${escHtml(f.question)}</summary><p>${escHtml(f.answer)}</p></details>`
      ).join('\n')}</section>`
    : '';

  // Build cross-links HTML
  const linksHtml = page.crossLinks.length > 0
    ? `<nav aria-label="Related pages"><h2>Related Pages</h2><ul>${page.crossLinks.map(l =>
        `<li><a href="${SITE_URL}/${l.slug}">${escHtml(l.label)}</a></li>`
      ).join('\n')}</ul></nav>`
    : '';

  // Build JSON-LD schemas
  const webPageSchema = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: page.title,
    url: canonicalUrl,
    description: page.metaDescription,
    datePublished: page.datePublished,
    dateModified: page.lastUpdated,
  });

  const faqSchema = page.faqItems.length > 0
    ? JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: page.faqItems.map(f => ({
          '@type': 'Question',
          name: f.question,
          acceptedAnswer: { '@type': 'Answer', text: f.answer },
        })),
      })
    : '';

  const breadcrumbSchema = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'Govt Jobs', item: `${SITE_URL}/latest-govt-jobs-2026` },
      { '@type': 'ListItem', position: 3, name: page.title, item: canonicalUrl },
    ],
  });

  const lastUpdatedFormatted = formatDate(page.lastUpdated);

  return `<!DOCTYPE html>
<html lang="en-IN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escHtml(fullTitle)}</title>
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
  ${faqSchema ? `<script type="application/ld+json">${faqSchema}</script>` : ''}
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; max-width: 900px; margin: 0 auto; padding: 16px; color: #1a1a1a; line-height: 1.7; }
    h1 { font-size: 2rem; margin-bottom: 0.5rem; }
    h2 { font-size: 1.5rem; margin-top: 2rem; }
    h3 { font-size: 1.2rem; margin-top: 1.5rem; }
    table { width: 100%; border-collapse: collapse; margin: 1rem 0; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    th { background: #f5f5f5; font-weight: 600; }
    details { margin: 0.5rem 0; border: 1px solid #e5e5e5; border-radius: 4px; }
    summary { padding: 12px; cursor: pointer; font-weight: 500; }
    details p { padding: 0 12px 12px; margin: 0; color: #555; }
    a { color: #2563eb; text-decoration: none; }
    a:hover { text-decoration: underline; }
    nav ul { display: flex; flex-wrap: wrap; gap: 8px; list-style: none; padding: 0; }
    nav li a { display: inline-block; padding: 6px 12px; background: #f0f4ff; border-radius: 4px; font-size: 0.9rem; }
    .badge { display: inline-block; font-size: 0.85rem; color: #666; margin-bottom: 1rem; }
    .disclaimer { margin-top: 2rem; padding: 12px; background: #fef3c7; border-radius: 4px; font-size: 0.85rem; color: #92400e; }
    footer { margin-top: 3rem; padding-top: 1rem; border-top: 1px solid #e5e5e5; font-size: 0.85rem; color: #666; }
    footer a { margin-right: 1rem; }
  </style>
</head>
<body>
  <header>
    <nav aria-label="Breadcrumb"><a href="${SITE_URL}">Home</a> › <a href="${SITE_URL}/latest-govt-jobs-2026">Govt Jobs</a> › <span>${escHtml(page.title)}</span></nav>
  </header>
  <main>
    <h1>${escHtml(page.h1)}</h1>
    <p class="badge">Last Updated: ${lastUpdatedFormatted}</p>
    <article>${page.introContent}</article>
    ${faqHtml}
    ${linksHtml}
    <div class="disclaimer">
      <strong>Disclaimer:</strong> TrueJobs aggregates information from official sources. Always verify details on the official recruitment website. We are not affiliated with any government body.
    </div>
  </main>
  <footer>
    <a href="${SITE_URL}/privacy-policy">Privacy Policy</a>
    <a href="${SITE_URL}/editorial-policy">Editorial Policy</a>
    <a href="${SITE_URL}/disclaimer">Disclaimer</a>
    <a href="${SITE_URL}/contact">Contact Us</a>
    <a href="${SITE_URL}/about">About</a>
    <p>© 2026 TrueJobs.co.in — India's Smart Job Search Portal</p>
  </footer>
</body>
</html>`;
}

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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth check - admin only
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

    // Check admin role
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

    // Cleanup mode: delete stale entries not in current config
    if (cleanup && allSlugs && Array.isArray(allSlugs)) {
      // Delete in batches of 200 using "not in" filter
      let deleted = 0;
      // Supabase JS doesn't support NOT IN with large arrays well,
      // so we fetch all slugs from cache and diff locally
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

      // Delete stale slugs in chunks
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

    // Generate HTML for each page and upsert
    const rows = pages.map(page => ({
      slug: page.slug,
      full_html: generateHTML(page),
      page_type: page.pageType,
      updated_at: new Date().toISOString(),
    }));

    // Batch upsert in chunks of 50
    let inserted = 0;
    let errors: string[] = [];
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
