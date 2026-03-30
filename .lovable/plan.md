

# SEO Cache Alignment Fix — Implementation Plan

## Root Cause

Three bugs cause SEO cache misses:

1. **Blog slug mismatch**: Worker extracts `blog/{slug}` from URL, but `seo-cache-rebuild` stores bare `{slug}` in `seo_page_cache`. Permanent cache miss for all 210 blog posts.

2. **Employment news wrong Worker pattern + slug mismatch**: Actual React route is `/jobs/employment-news/:slug`. Worker has pattern for `/employment-news/:slug` (wrong path). Even if it matched, cache stores bare `{slug}` not `jobs/employment-news/{slug}`.

3. **Missing hub pages**: `sarkari-jobs`, `latest-govt-jobs`, `private-jobs`, `jobs/employment-news` are not in `standalonePages` array in SEOCacheBuilder, so they never get cache rows.

4. **Private routes**: No `X-Robots-Tag` header protection.

## Chosen Fix: Canonical Cache Key = Full URL Path

Store `seo_page_cache.slug` as the full public path without leading slash (matching what Worker's `extractSlug()` already produces). This means only cache **writers** change — the Worker lookup and `serve-public-page` already work correctly.

## Files Changed

### 1. `supabase/functions/seo-cache-rebuild/index.ts`

**Three fetcher functions** — prefix the returned slug:
- `fetchBlogPageData`: return `slug: 'blog/' + data.slug` instead of `slug: data.slug`
- `fetchEmploymentNewsPageData`: return `slug: 'jobs/employment-news/' + data.slug` instead of `slug: data.slug`  
- `fetchGovtExamPageData`: return `slug: 'sarkari-jobs/' + data.slug` instead of `slug: data.slug`

**`handleFullMode`** — prefix slugs in the targets array so `rebuildSingleSlug` receives the canonical key:
- Blog targets: `slug: 'blog/' + row.slug`
- Emp-news targets: `slug: 'jobs/employment-news/' + row.slug`
- Govt-exam targets: `slug: 'sarkari-jobs/' + row.slug`

**`handleQueueMode`** — the `seo_rebuild_queue` stores bare slugs (from DB triggers). Add prefix mapping based on `page_type` before calling `rebuildSingleSlug`. The fetcher functions also need to strip the prefix before querying the DB table.

**Fetcher functions need dual-mode slug handling**: They receive the canonical slug (e.g. `blog/my-post`) but must query the DB table using the bare slug (`my-post`). Strip the known prefix before the DB query.

### 2. `public/_worker.js`

- **Fix employment-news pattern**: Replace `/^\/employment-news\/[a-z0-9][a-z0-9-]*$/` with `/^\/jobs\/employment-news\/[a-z0-9][a-z0-9-]*$/`
- **Add employment-news hub pattern**: `/^\/jobs\/employment-news$/`
- **Add sarkari-jobs detail pattern**: `/^\/sarkari-jobs\/[a-z0-9][a-z0-9-]*$/` (for govt exam detail pages)
- **Add latest-govt-jobs pattern**: `/^\/latest-govt-jobs$/` (currently only matches `/^\/latest-govt-jobs-[0-9]+$/`)
- **Add private route noindex block**: Before catch-all (step 8), check `PRIVATE_PREFIXES` and add `X-Robots-Tag: noindex, nofollow` to response headers

### 3. `src/components/admin/SEOCacheBuilder.tsx`

Add 4 missing hub pages to `standalonePages` array:
- `{ slug: 'sarkari-jobs', ... }` — Sarkari Jobs hub
- `{ slug: 'latest-govt-jobs', ... }` — Latest Govt Jobs hub  
- `{ slug: 'private-jobs', ... }` — Private Jobs hub
- `{ slug: 'jobs/employment-news', ... }` — Employment News hub

### 4. `supabase/functions/dynamic-sitemap/index.ts`

Add `'jobs/employment-news'` to `STANDALONE_SLUGS` set (so the SEO sitemap doesn't duplicate it since it's already in pages sitemap).

### 5. No changes needed

- `serve-public-page`: Already does `normalizedSlug = String(slug).replace(/^\//, '').replace(/\/$/, '')` — correct behavior
- `build-seo-cache`: Receives pre-built `PageData[]` from client with correct slugs — no change needed
- Sitemaps: Blog and emp-news sitemaps already generate correct URLs (`/blog/{slug}`, `/jobs/employment-news/{slug}`)

## Queue Trigger Alignment

The `queue_seo_rebuild` DB trigger stores **bare** slugs from `blog_posts.slug` and `employment_news_jobs.slug`. Rather than modifying the trigger (risky, affects all inserts/updates), the `handleQueueMode` function in `seo-cache-rebuild` will **prefix** the bare slug based on `page_type` before passing to `rebuildSingleSlug`.

## Post-Deploy Steps

1. Deploy `seo-cache-rebuild` edge function
2. From Admin: trigger "Full DB Rebuild" (force) to re-populate blog + emp-news with prefixed slugs
3. From Admin: trigger "Inventory Build" to populate 4 new hub pages
4. Copy updated `_worker.js` to Cloudflare dashboard
5. From Admin: "Purge All CF" to clear stale edge cache
6. Cleanup old bare-slug rows: `DELETE FROM seo_page_cache WHERE page_type = 'blog' AND slug NOT LIKE 'blog/%'` and similar for employment-news/govt-exam

## Resource Pages

Not touched. No Worker pattern, no cache generation, no changes. Explicit TODO left.

## Technical Details

### Cache key examples after fix

| Family | DB column value | Cache slug (seo_page_cache) | Worker extractSlug output |
|---|---|---|---|
| Blog | `my-blog-post` | `blog/my-blog-post` | `blog/my-blog-post` ✅ |
| Emp News | `some-notice` | `jobs/employment-news/some-notice` | `jobs/employment-news/some-notice` ✅ |
| Govt Exam | `ssc-cgl` | `sarkari-jobs/ssc-cgl` | `sarkari-jobs/ssc-cgl` ✅ |
| City (unchanged) | n/a | `jobs-in-delhi` | `jobs-in-delhi` ✅ |

### Why not change Worker's extractSlug instead?

Changing extractSlug to strip prefixes would break 1,880 working programmatic pages whose cache keys are already correct root-level slugs. Aligning cache writers is the minimal, non-breaking change.

