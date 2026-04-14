

# Fix: Missing /jobs/:slug Pages Returning HTTP 200 → True 404/410

## What Changes

**Single file: `public/_worker.js`** plus minor defense-in-depth additions to two React components.

### Worker Changes (`public/_worker.js`)

**1. Add `checkResourceExists` helper** (after line 115)

A generic function that queries Supabase REST API to check if a slug exists. RLS naturally handles access control:
- `jobs` table: anon can only see `status = 'active'` rows. Inactive/missing → 0 rows → 404.
- If active but `is_deleted=true` or `is_duplicate=true` → 410.
- `blog_posts`: anon sees only `is_published=true`. Otherwise → 0 rows → 404.
- `employment_news_jobs`: anon sees only `status='published'`. Otherwise → 0 rows → 404.

Returns `'exists'`, `'gone'` (410-worthy), `'missing'` (404), or `'error'` (logged, falls through to 200).

```javascript
async function checkResourceExists(cfg, table, slug) {
  try {
    const select = table === 'jobs' ? 'id,is_deleted,is_duplicate' : 'id';
    const url = `${cfg.SUPABASE_URL}/rest/v1/${table}?slug=eq.${encodeURIComponent(slug)}&select=${select}&limit=1`;
    const res = await fetch(url, {
      headers: {
        'apikey': cfg.SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${cfg.SUPABASE_ANON_KEY}`,
        'Accept': 'application/json',
      },
    });
    if (!res.ok) {
      console.error(`[SFC] DB check failed: ${table}/${slug} → HTTP ${res.status}`);
      return 'error';
    }
    const rows = await res.json();
    if (!Array.isArray(rows) || rows.length === 0) return 'missing';
    if (table === 'jobs' && (rows[0].is_deleted || rows[0].is_duplicate)) return 'gone';
    return 'exists';
  } catch (err) {
    console.error(`[SFC] DB check exception: ${table}/${slug}`, err);
    return 'error';
  }
}
```

Key: on `'error'`, we log explicitly and fall through to 200 (safe default — no false 404s).

**2. Add `/jobs/:slug` to `SEO_ROUTE_PATTERNS`** (line 42 area)

```javascript
/^\/jobs\/[a-z0-9][a-z0-9-]*$/,
```

This ensures `/jobs/:slug` goes through step 7 (SEO route handler) instead of falling to the catch-all.

**3. Update step 7 cache-miss branch** (lines 322-332)

On cache miss, for detail-page patterns (`/jobs/:slug`, `/blog/:slug`, `/jobs/employment-news/:slug`), call `checkResourceExists`. If missing → 404. If gone → 410. If error → 200 (safe fallback, logged). Listing pages (e.g., `/blog`, `/jobs`) keep current 200 behavior.

```javascript
if (!cacheRes.ok || cacheRes.status === 404) {
  const shellHtml = await originRes.text();

  // Detail pages: check DB existence before choosing status
  const jobMatch = pathname.match(/^\/jobs\/([a-z0-9][a-z0-9-]*)$/);
  const blogMatch = pathname.match(/^\/blog\/([a-z0-9][a-z0-9-]*)$/);
  const empMatch = pathname.match(/^\/jobs\/employment-news\/([a-z0-9][a-z0-9-]*)$/);

  if (empMatch || jobMatch || blogMatch) {
    const table = empMatch ? 'employment_news_jobs' : jobMatch ? 'jobs' : 'blog_posts';
    const detailSlug = (empMatch || jobMatch || blogMatch)[1];
    const existence = await checkResourceExists(cfg, table, detailSlug);

    if (existence === 'missing' || existence === 'gone') {
      const status = existence === 'gone' ? 410 : 404;
      console.log(`[SFC] ${status} for ${pathname} (${existence})`);
      return new Response(shellHtml, {
        status,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-cache, max-age=0',
          'X-Robots-Tag': 'noindex, nofollow',
        },
      });
    }
    // existence === 'error' → logged inside helper, serve 200
  }

  return new Response(shellHtml, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=60, s-maxage=120',
    },
  });
}
```

### React Component Changes (defense-in-depth)

**`src/pages/jobs/JobDetail.tsx`** — Add `<Helmet><meta name="robots" content="noindex, nofollow" /></Helmet>` to the `!job` branch (line 333).

**`src/pages/jobs/EmploymentNewsJobDetail.tsx`** — Same noindex meta addition to the error/not-found branch (line 65).

### What This Fixes

| URL | Before | After |
|---|---|---|
| `/jobs/valid-active-slug` | 200 | 200 (unchanged) |
| `/jobs/apprentice-pnb-1772219240796` (missing) | 200 ❌ | 404 ✅ |
| `/jobs/deleted-slug` (is_deleted=true) | 200 ❌ | 410 ✅ |
| `/blog/valid-published-post` | 200 | 200 (unchanged) |
| `/blog/nonexistent-slug` | 200 ❌ | 404 ✅ |
| `/jobs/employment-news/missing-slug` | 200 ❌ | 404 ✅ |
| DB check fails (Supabase down) | 200 | 200 (safe, logged) |

### Safety

- DB check is one lightweight REST call (~20-50ms), only on cache miss
- On error, defaults to 200 with explicit console logging
- Both GET and HEAD follow the same path (step 2 already ensures this)
- 404/410 responses use `no-cache` to prevent stale caching
- No changes to existing working SEO merge flow for cached pages

### Files Changed
1. `public/_worker.js` — add helper + pattern + cache-miss existence check
2. `src/pages/jobs/JobDetail.tsx` — noindex meta on not-found state
3. `src/pages/jobs/EmploymentNewsJobDetail.tsx` — noindex meta on not-found state

