// ── Configuration ────────────────────────────────────────────────────

const SUPABASE_URL = 'https://riktrtfgpnrqiwatppcq.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJpa3RydGZncG5ycWl3YXRwcGNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg5MzA2NjEsImV4cCI6MjA4NDUwNjY2MX0.CAVN3HBsibvQuj_0FPNMKJ7d3cKo3kKR77aoXFH6uFQ';

// ── Sitemap routing ─────────────────────────────────────────────────
// Maps static sitemap file paths to the dynamic-sitemap edge function
const SITEMAP_ROUTES = {
  '/sitemap.xml': 'index',
  '/sitemap-pages.xml': 'pages',
  '/sitemap-jobs.xml': 'jobs',
  '/sitemap-blog.xml': 'blog',
  '/sitemap-seo.xml': 'seo',
  '/sitemap-resources.xml': 'resources',
};

// SEO route patterns — match pathname (without query/hash)
const SEO_ROUTE_PATTERNS = [
  /^\/$/,
  /^\/jobs$/,
  /^\/blog$/,
  /^\/companies$/,
  /^\/tools$/,
  /^\/aboutus$/,
  /^\/contactus$/,
  /^\/privacypolicy$/,
  /^\/termsofuse$/,
  /^\/disclaimer$/,
  /^\/editorial-policy$/,
  /^\/jobs-in-[a-z-]+$/,
  /^\/govt-jobs-[a-z-]+$/,
  /^\/ssc-[a-z0-9-]+$/,
  /^\/rrb-[a-z0-9-]+$/,
  /^\/ibps-[a-z0-9-]+$/,
  /^\/sbi-[a-z0-9-]+$/,
  /^\/upsc-[a-z0-9-]+$/,
  /^\/nda-[a-z0-9-]+$/,
  /^\/agniveer-[a-z0-9-]+$/,
  /^\/[a-z-]+-jobs$/,
  /^\/[a-z-]+-govt-jobs$/,
  /^\/all-sarkari-jobs$/,
  /^\/latest-govt-jobs-[0-9]+$/,
  /^\/govt-job-age-calculator$/,
  /^\/govt-salary-calculator$/,
  /^\/govt-fee-calculator$/,
  /^\/govt-eligibility-checker$/,
  /^\/exam-calendar$/,
  /^\/image-resizer$/,
  /^\/photo-resizer$/,
  /^\/pdf-tools$/,
  /^\/percentage-calculator$/,
  /^\/typing-test$/,
  /^\/government-[a-z-]+$/,
  /^\/private-jobs$/,
  /^\/today-govt-jobs$/,
];

// Private routes — never intercept
const PRIVATE_PREFIXES = [
  '/login', '/signup', '/phone-signup', '/forgot-password',
  '/dashboard', '/profile', '/employer', '/admin',
  '/enrol-now', '/thankyou', '/offline',
  '/tools/resume-builder', '/tools/resume-checker',
];

function isSEORoute(pathname) {
  if (PRIVATE_PREFIXES.some(p => pathname.startsWith(p))) return false;
  if (pathname.startsWith('/assets/') || pathname.startsWith('/api/')) return false;
  if (/\.\w{2,5}$/.test(pathname)) return false;
  return SEO_ROUTE_PATTERNS.some(re => re.test(pathname));
}

function extractSlug(pathname) {
  return pathname.replace(/^\//, '').replace(/\/$/, '');
}

// ── Merge logic ──────────────────────────────────────────────────────

function mergeHTML(originHTML, headHtml, bodyHtml) {
  const headMatch = originHTML.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
  if (!headMatch) return null;

  let originHead = headMatch[1];

  // Remove SEO-replaceable tags from original head (will be replaced by headHtml)
  originHead = originHead
    .replace(/<title[^>]*>[\s\S]*?<\/title>/gi, '')
    .replace(/<meta[^>]+name=["']description["'][^>]*\/?>/gi, '')
    .replace(/<meta[^>]+name=["']robots["'][^>]*\/?>/gi, '')
    .replace(/<meta[^>]+property=["']og:[^"']*["'][^>]*\/?>/gi, '')
    .replace(/<meta[^>]+name=["']twitter:[^"']*["'][^>]*\/?>/gi, '')
    .replace(/<link[^>]+rel=["']canonical["'][^>]*\/?>/gi, '')
    .replace(/<meta[^>]+name=["']fragment["'][^>]*\/?>/gi, '');

  // Extract body scripts from original
  const bodyMatch = originHTML.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  const bodyScripts = [];
  if (bodyMatch) {
    const bodyContent = bodyMatch[1];
    const bodyScriptRe = /<script[^>]*>[\s\S]*?<\/script>/gi;
    let match;
    while ((match = bodyScriptRe.exec(bodyContent)) !== null) bodyScripts.push(match[0]);
  }

  return `<!DOCTYPE html>
<html lang="en-IN">
<head>
${originHead}
${headHtml}
</head>
<body>
<div id="root">${bodyHtml}</div>
${bodyScripts.join('\n')}
</body>
</html>`;
}

// ── Worker handler (Cloudflare Pages Advanced Mode) ──────────────────

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const pathname = url.pathname;

    // ── Sitemap routing: proxy to dynamic-sitemap edge function ──
    const sitemapType = SITEMAP_ROUTES[pathname];
    if (sitemapType && request.method === 'GET') {
      try {
        const sitemapRes = await fetch(
          `${SUPABASE_URL}/functions/v1/dynamic-sitemap?type=${sitemapType}`,
          {
            headers: {
              'apikey': SUPABASE_ANON_KEY,
              'Content-Type': 'application/json',
            },
          }
        );
        if (sitemapRes.ok) {
          const xml = await sitemapRes.text();
          return new Response(xml, {
            status: 200,
            headers: {
              'Content-Type': 'application/xml; charset=utf-8',
              'Cache-Control': 'public, max-age=1800, s-maxage=3600',
              'X-Robots-Tag': 'noindex',
            },
          });
        }
      } catch (err) {
        console.error('Sitemap proxy error:', err);
      }
      // Fallback: serve static sitemap.xml if edge function fails
      if (pathname === '/sitemap.xml') {
        return env.ASSETS.fetch(request);
      }
      // For sub-sitemaps with no static fallback, return minimal valid XML
      return new Response(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://truejobs.co.in/</loc></url>
</urlset>`, {
        status: 200,
        headers: { 'Content-Type': 'application/xml; charset=utf-8' },
      });
    }

    // Static assets — serve directly via Pages asset binding
    if (/\.\w{2,5}$/.test(pathname)) {
      return env.ASSETS.fetch(request);
    }

    // Non-GET or non-SEO route — serve SPA shell
    if (request.method !== 'GET' || !isSEORoute(pathname)) {
      // SPA fallback: serve index.html for all non-asset navigation
      const assetRes = await env.ASSETS.fetch(request);
      if (assetRes.ok) return assetRes;
      // Fallback to index.html for SPA routes
      return env.ASSETS.fetch(new Request(new URL('/', url), request));
    }

    const slug = extractSlug(pathname);

    try {
      // Parallel fetch: cached fragments + origin index.html
      const [cacheRes, originRes] = await Promise.all([
        fetch(`${SUPABASE_URL}/functions/v1/serve-public-page`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({ slug }),
        }),
        env.ASSETS.fetch(new Request(new URL('/', url), request)),
      ]);

      // Cache miss or error → fall through to SPA
      if (!cacheRes.ok || cacheRes.status === 404) {
        return originRes;
      }

      const { head_html, body_html } = await cacheRes.json();
      const originHTML = await originRes.text();

      if (!head_html || !body_html) {
        return new Response(originHTML, {
          status: 200,
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        });
      }

      const merged = mergeHTML(originHTML, head_html, body_html);
      if (!merged) {
        return new Response(originHTML, {
          status: 200,
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        });
      }

      return new Response(merged, {
        status: 200,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'public, max-age=300, s-maxage=3600',
          'X-Rendered-By': 'sfc-worker',
        },
      });
    } catch (err) {
      console.error('SFC Worker error:', err);
      // On any error, serve SPA shell
      return env.ASSETS.fetch(new Request(new URL('/', url), request));
    }
  },
};