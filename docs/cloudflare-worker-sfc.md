# Cloudflare Worker — Static-First Rendering (Edge-Side Merge)

> Deploy this Worker on your Cloudflare zone. It intercepts public SEO routes,
> fetches cached HTML fragments from the `serve-public-page` edge function, and
> merges them with the origin's `index.html` Vite assets — placing cached body
> content inside `<div id="root">` so React replaces it on mount.

## Worker Code

```js
// ── Configuration ────────────────────────────────────────────────────

const SUPABASE_URL = 'https://riktrtfgpnrqiwatppcq.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJpa3RydGZncG5ycWl3YXRwcGNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg5MzA2NjEsImV4cCI6MjA4NDUwNjY2MX0.CAVN3HBsibvQuj_0FPNMKJ7d3cKo3kKR77aoXFH6uFQ';

// SEO route patterns — match pathname (without query/hash)
const SEO_ROUTE_PATTERNS = [
  /^\/$/,                                  // homepage
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
  /^\/jobs-in-[a-z-]+$/,                   // city pages
  /^\/govt-jobs-[a-z-]+$/,                 // state / deadline pages
  /^\/ssc-[a-z0-9-]+$/,                    // SSC exam pages
  /^\/rrb-[a-z0-9-]+$/,                    // RRB exam pages
  /^\/ibps-[a-z0-9-]+$/,                   // IBPS exam pages
  /^\/sbi-[a-z0-9-]+$/,                    // SBI exam pages
  /^\/upsc-[a-z0-9-]+$/,                   // UPSC pages
  /^\/nda-[a-z0-9-]+$/,                    // NDA pages
  /^\/agniveer-[a-z0-9-]+$/,               // Agniveer pages
  /^\/[a-z-]+-jobs$/,                      // category / dept / industry
  /^\/[a-z-]+-govt-jobs$/,                 // qualification
  /^\/all-sarkari-jobs$/,
  /^\/latest-govt-jobs-[0-9]+$/,           // yearly listing
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
  /^\/government-[a-z-]+$/,                // combo pages
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
  if (/\.\w{2,5}$/.test(pathname)) return false; // static files
  return SEO_ROUTE_PATTERNS.some(re => re.test(pathname));
}

function extractSlug(pathname) {
  return pathname.replace(/^\//, '').replace(/\/$/, '');
}

// ── Merge logic ──────────────────────────────────────────────────────

function mergeHTML(originHTML, headHtml, bodyHtml) {
  // Extract Vite assets from origin's <head>: <link> and <script> tags
  const headMatch = originHTML.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
  if (!headMatch) return null;

  const originHead = headMatch[1];

  // Extract only asset tags (link[rel=stylesheet/modulepreload], script[type=module])
  const assetTags = [];
  const linkRe = /<link[^>]+(?:rel="(?:stylesheet|modulepreload|icon|manifest|apple-touch-icon)")[^>]*\/?>/gi;
  const scriptRe = /<script[^>]+type="module"[^>]*>[^<]*<\/script>/gi;
  const metaCharset = /<meta[^>]+charset[^>]*\/?>/gi;
  const metaViewport = /<meta[^>]+viewport[^>]*\/?>/gi;

  let match;
  while ((match = metaCharset.exec(originHead)) !== null) assetTags.push(match[0]);
  while ((match = metaViewport.exec(originHead)) !== null) assetTags.push(match[0]);
  while ((match = linkRe.exec(originHead)) !== null) assetTags.push(match[0]);

  // Extract body-level scripts
  const bodyScripts = [];
  const bodyMatch = originHTML.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (bodyMatch) {
    const bodyContent = bodyMatch[1];
    const bodyScriptRe = /<script[^>]+type="module"[^>]*>[^<]*<\/script>/gi;
    while ((match = bodyScriptRe.exec(bodyContent)) !== null) bodyScripts.push(match[0]);
  }
  while ((match = scriptRe.exec(originHead)) !== null) assetTags.push(match[0]);

  // Also grab Google Fonts / other external links from origin
  const extLinkRe = /<link[^>]+href="https:\/\/fonts[^"]*"[^>]*\/?>/gi;
  while ((match = extLinkRe.exec(originHead)) !== null) assetTags.push(match[0]);

  return `<!DOCTYPE html>
<html lang="en-IN">
<head>
${assetTags.join('\n')}
${headHtml}
</head>
<body>
<div id="root">${bodyHtml}</div>
${bodyScripts.join('\n')}
</body>
</html>`;
}

// ── Worker handler ───────────────────────────────────────────────────

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const pathname = url.pathname;

    // Only intercept GET requests for SEO routes
    if (request.method !== 'GET' || !isSEORoute(pathname)) {
      return fetch(request);
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
        fetch(url.origin + '/', {
          headers: { 'User-Agent': 'TrueJobs-Worker/1.0' },
        }),
      ]);

      // Cache miss or error → fall through to SPA
      if (!cacheRes.ok || cacheRes.status === 404) {
        return originRes;
      }

      const { head_html, body_html } = await cacheRes.json();
      const originHTML = await originRes.text();

      if (!head_html || !body_html) {
        // Incomplete fragments → serve origin SPA
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
      // On any error, pass through to origin
      return fetch(request);
    }
  },
};
```

## Deployment Notes

1. Create a Cloudflare Worker in your zone dashboard
2. Paste the above code
3. Set route pattern: `truejobs.co.in/*`
4. The Worker will only intercept GET requests matching SEO route patterns
5. All other requests pass through to the origin untouched
6. After deploying updated `build-seo-cache`, run a full cache rebuild from the admin panel to populate `head_html` and `body_html` columns

## Cache TTLs

- Worker serves merged HTML with `max-age=300` (5 min browser), `s-maxage=3600` (1 hr CDN)
- Origin `index.html` should have a short TTL (60s) so new Vite deploys are picked up
- The `serve-public-page` edge function returns `Cache-Control: public, max-age=3600`

## Testing

1. Rebuild SEO cache from admin panel after deploying the updated edge functions
2. Test with: `curl -s https://truejobs.co.in/govt-jobs-uttar-pradesh | head -50`
3. Verify the response contains both SEO content and Vite asset tags
4. Check `X-Rendered-By: sfc-worker` header to confirm Worker served the page
5. Test cache miss: visit a non-cached slug and verify SPA loads normally
