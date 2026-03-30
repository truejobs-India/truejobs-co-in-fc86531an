// ── Standalone Cloudflare Worker for TrueJobs ────────────────────────
// Proxies Lovable origin for assets/SPA shell.
// Intercepts SEO routes to merge cached HTML fragments from Supabase.
// Source of truth: this repo. Deploy to CF dashboard or via Wrangler.

// ── Configuration (env bindings override these fallbacks) ────────────

const FALLBACK_SUPABASE_URL = 'https://riktrtfgpnrqiwatppcq.supabase.co';
const FALLBACK_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJpa3RydGZncG5ycWl3YXRwcGNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg5MzA2NjEsImV4cCI6MjA4NDUwNjY2MX0.CAVN3HBsibvQuj_0FPNMKJ7d3cKo3kKR77aoXFH6uFQ';
const FALLBACK_LOVABLE_ORIGIN = 'https://truejobs-co-in.lovable.app';

function getConfig(env) {
  return {
    SUPABASE_URL: (env && env.SUPABASE_URL) || FALLBACK_SUPABASE_URL,
    SUPABASE_ANON_KEY: (env && env.SUPABASE_ANON_KEY) || FALLBACK_SUPABASE_ANON_KEY,
    LOVABLE_ORIGIN: (env && env.LOVABLE_ORIGIN) || FALLBACK_LOVABLE_ORIGIN,
  };
}

// ── Sitemap routing ─────────────────────────────────────────────────

const SITEMAP_ROUTES = {
  '/sitemap.xml': 'index',
  '/sitemap-pages.xml': 'pages',
  '/sitemap-jobs.xml': 'jobs',
  '/sitemap-blog.xml': 'blog',
  '/sitemap-seo.xml': 'seo',
  '/sitemap-resources.xml': 'resources',
};

// ── SEO route patterns ──────────────────────────────────────────────

const SEO_ROUTE_PATTERNS = [
  /^\/$/,
  /^\/jobs$/,
  /^\/blog$/,
  /^\/blog\/[a-z0-9][a-z0-9-]*$/,
  /^\/blog\/category\/[a-z0-9][a-z0-9-]*$/,
  /^\/companies$/,
  /^\/companies\/[a-z0-9][a-z0-9-]*$/,
  /^\/jobs\/employment-news$/,
  /^\/jobs\/employment-news\/[a-z0-9][a-z0-9-]*$/,
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
  /^\/latest-govt-jobs$/,
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
  /^\/sarkari-jobs$/,
  /^\/sarkari-jobs\/[a-z0-9][a-z0-9-]*$/,
  /^\/sarkari-result$/,
];

// Private routes — never intercept for SEO
const PRIVATE_PREFIXES = [
  '/login', '/signup', '/phone-signup', '/forgot-password',
  '/dashboard', '/profile', '/employer', '/admin',
  '/enrol-now', '/thankyou', '/offline',
  '/tools/resume-builder', '/tools/resume-checker',
  '/auth/callback',
];

// Known multi-segment route prefixes — any multi-segment path not matching
// these AND not matching PRIVATE_PREFIXES is a guaranteed 404 in React Router.
// Single-segment paths (e.g. /ssc-cgl) are ALWAYS allowed through because
// the /:slug catch-all in React resolves them dynamically via DB + config.
const KNOWN_MULTI_SEGMENT_PREFIXES = [
  '/jobs/',
  '/sarkari-jobs/',
  '/results/',
  '/sample-papers/',
  '/books/',
  '/previous-year-papers/',
  '/guides/',
  '/companies/',
  '/blog/',
  '/tools/',
];

function isLikelyValid(pathname) {
  // Single-segment paths → always valid (/:slug catch-all exists in React)
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length <= 1) return true;
  // Multi-segment → must match a known prefix or be a private route
  return KNOWN_MULTI_SEGMENT_PREFIXES.some(p => pathname.startsWith(p))
    || PRIVATE_PREFIXES.some(p => pathname.startsWith(p));
}

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

  // Remove SEO-replaceable tags from original head
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

// ── Helper: fetch SPA shell from Lovable origin ─────────────────────

async function fetchSpaShell(cfg) {
  const res = await fetch(cfg.LOVABLE_ORIGIN + '/', {
    headers: { 'User-Agent': 'TrueJobs-Worker/2.0' },
    cf: { cacheTtl: 120 },
  });
  return res;
}

// ── Helper: proxy request to Lovable origin ─────────────────────────

async function proxyToOrigin(request, cfg) {
  const url = new URL(request.url);
  const targetUrl = cfg.LOVABLE_ORIGIN + url.pathname + url.search;
  return fetch(targetUrl, {
    method: request.method,
    headers: request.headers,
    body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined,
    redirect: 'follow',
  });
}

// ── Service worker file patterns ────────────────────────────────────

function isServiceWorkerFile(pathname) {
  return pathname === '/sw.js' || pathname.startsWith('/workbox-');
}

// ── Uncommon static files with long cache ───────────────────────────

const LONG_CACHE_STATICS = [
  '/robots.txt', '/ads.txt', '/favicon.ico', '/favicon.png',
  '/pwa-icon.png', '/og-image.png', '/manifest.webmanifest',
];

// ── Worker handler (Standalone Mode) ────────────────────────────────

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const pathname = url.pathname;
    const cfg = getConfig(env);

    // ── 1. WWW redirect → apex ──────────────────────────────────
    if (url.hostname === 'www.truejobs.co.in') {
      return Response.redirect(
        `https://truejobs.co.in${pathname}${url.search}`,
        301
      );
    }

    // ── 2. Non-GET/HEAD → proxy to origin (pass through) ──────
    // HEAD must follow the same routing as GET so sitemaps/static
    // files return correct status codes (e.g. Google Search Console).
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return proxyToOrigin(request, cfg);
    }

    // ── 3. Sitemap routing → Supabase dynamic-sitemap ───────────
    const sitemapType = SITEMAP_ROUTES[pathname];
    if (sitemapType) {
      try {
        const sitemapRes = await fetch(
          `${cfg.SUPABASE_URL}/functions/v1/dynamic-sitemap?type=${sitemapType}`,
          {
            headers: {
              'apikey': cfg.SUPABASE_ANON_KEY,
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
      // Fallback: /sitemap.xml → proxy static file from origin
      if (pathname === '/sitemap.xml') {
        return fetch(cfg.LOVABLE_ORIGIN + '/sitemap.xml', {
          headers: { 'User-Agent': 'TrueJobs-Worker/2.0' },
        });
      }
      // Sub-sitemaps: return minimal valid XML
      return new Response(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://truejobs.co.in/</loc></url>
</urlset>`, {
        status: 200,
        headers: { 'Content-Type': 'application/xml; charset=utf-8' },
      });
    }

    // ── 4. Service worker files → proxy with no-cache ───────────
    if (isServiceWorkerFile(pathname)) {
      const swRes = await fetch(cfg.LOVABLE_ORIGIN + pathname, {
        headers: { 'User-Agent': 'TrueJobs-Worker/2.0' },
      });
      const swHeaders = new Headers(swRes.headers);
      swHeaders.set('Cache-Control', 'no-cache, max-age=0');
      return new Response(swRes.body, {
        status: swRes.status,
        headers: swHeaders,
      });
    }

    // ── 5. Static files with extensions → proxy to origin ───────
    if (/\.\w{2,5}$/.test(pathname)) {
      const assetRes = await fetch(cfg.LOVABLE_ORIGIN + pathname + url.search, {
        headers: { 'User-Agent': 'TrueJobs-Worker/2.0' },
      });
      // Long-cache static files get explicit headers
      if (LONG_CACHE_STATICS.includes(pathname)) {
        const headers = new Headers(assetRes.headers);
        headers.set('Cache-Control', 'public, max-age=3600, s-maxage=86400');
        return new Response(assetRes.body, {
          status: assetRes.status,
          headers,
        });
      }
      // Hashed assets (/assets/*) — pass through origin headers (immutable)
      return assetRes;
    }

    // ── 6. Private/auth routes → SPA shell ──────────────────────
    // (Also caught by step 8 catch-all, but explicit for clarity)

    // ── 7. SEO routes → merge cached HTML with SPA shell ────────
    if (isSEORoute(pathname)) {
      const slug = extractSlug(pathname);

      try {
        const [cacheRes, originRes] = await Promise.all([
          fetch(`${cfg.SUPABASE_URL}/functions/v1/serve-public-page`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': cfg.SUPABASE_ANON_KEY,
            },
            body: JSON.stringify({ slug }),
          }),
          fetchSpaShell(cfg),
        ]);

        // Cache miss or error → return SPA shell
        if (!cacheRes.ok || cacheRes.status === 404) {
          const shellHtml = await originRes.text();
          return new Response(shellHtml, {
            status: 200,
            headers: {
              'Content-Type': 'text/html; charset=utf-8',
              'Cache-Control': 'public, max-age=60, s-maxage=120',
            },
          });
        }

        const { head_html, body_html } = await cacheRes.json();
        const originHTML = await originRes.text();

        if (!head_html || !body_html) {
          return new Response(originHTML, {
            status: 200,
            headers: {
              'Content-Type': 'text/html; charset=utf-8',
              'Cache-Control': 'public, max-age=60, s-maxage=120',
            },
          });
        }

        const merged = mergeHTML(originHTML, head_html, body_html);
        if (!merged) {
          return new Response(originHTML, {
            status: 200,
            headers: {
              'Content-Type': 'text/html; charset=utf-8',
              'Cache-Control': 'public, max-age=60, s-maxage=120',
            },
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
        console.error('SFC Worker SEO error:', err);
        // On any error, serve SPA shell
        try {
          const fallbackRes = await fetchSpaShell(cfg);
          const fallbackHtml = await fallbackRes.text();
          return new Response(fallbackHtml, {
            status: 200,
            headers: {
              'Content-Type': 'text/html; charset=utf-8',
              'Cache-Control': 'public, max-age=60, s-maxage=120',
            },
          });
        } catch (shellErr) {
          return new Response('Service temporarily unavailable', {
            status: 502,
            headers: { 'Retry-After': '30' },
          });
        }
      }
    }

    // ── 8. Private routes → SPA shell with noindex header ──────
    if (PRIVATE_PREFIXES.some(p => pathname.startsWith(p))) {
      try {
        const shellRes = await fetchSpaShell(cfg);
        const shellHtml = await shellRes.text();
        return new Response(shellHtml, {
          status: 200,
          headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-cache, max-age=0',
            'X-Robots-Tag': 'noindex, nofollow',
          },
        });
      } catch (err) {
        return new Response('Service temporarily unavailable', {
          status: 502,
          headers: { 'Retry-After': '30', 'X-Robots-Tag': 'noindex, nofollow' },
        });
      }
    }

    // ── 9. Catch-all → SPA shell ──────────────────────────────────
    // Return 404 status for multi-segment paths with unknown prefixes.
    // Single-segment paths always get 200 (/:slug resolver handles them).
    try {
      const shellRes = await fetchSpaShell(cfg);
      const shellHtml = await shellRes.text();
      const status = isLikelyValid(pathname) ? 200 : 404;
      const headers = {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': status === 404
          ? 'no-cache, max-age=0'
          : 'public, max-age=60, s-maxage=120',
      };
      if (status === 404) headers['X-Robots-Tag'] = 'noindex, nofollow';
      return new Response(shellHtml, { status, headers });
    } catch (err) {
      console.error('SPA shell fetch error:', err);
      return new Response('Service temporarily unavailable', {
        status: 502,
        headers: { 'Retry-After': '30' },
      });
    }
  },
};
