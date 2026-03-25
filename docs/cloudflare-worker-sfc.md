# Cloudflare Worker — Standalone Static-First Rendering

> Standalone Cloudflare Worker for `truejobs.co.in`. Proxies Lovable-published
> origin for assets/SPA shell. Intercepts SEO routes, fetches cached HTML
> fragments from `serve-public-page`, and merges them with the origin's
> `index.html` — placing cached body content inside `<div id="root">` so React
> replaces it on mount.

## Architecture

```
User → Cloudflare Worker (truejobs.co.in/*)
         ├── SEO routes → Supabase serve-public-page + Lovable origin → merged HTML
         ├── Sitemaps → Supabase dynamic-sitemap
         ├── Assets → Lovable origin (proxy)
         └── SPA routes → Lovable origin index.html (proxy)
```

- **Worker source**: `public/_worker.js` in this repo (version-controlled, GitHub backup)
- **Lovable origin**: `https://truejobs-co-in.lovable.app` (published via Lovable)
- **SEO cache**: `seo_page_cache` table in Supabase, populated by `seo-cache-rebuild` / `build-seo-cache`

## Worker Environment Bindings

Configure these in the Cloudflare dashboard under Workers → Settings → Variables:

| Binding | Type | Value |
|---|---|---|
| `SUPABASE_URL` | Secret | `https://riktrtfgpnrqiwatppcq.supabase.co` |
| `SUPABASE_ANON_KEY` | Secret | The Supabase anon key |
| `LOVABLE_ORIGIN` | Plain text | `https://truejobs-co-in.lovable.app` |

The Worker has hardcoded fallbacks for all three, so it works during transition
even without bindings configured.

## Request Routing

```
1. www.truejobs.co.in/* → 301 redirect to https://truejobs.co.in/*
2. Non-GET requests → proxy to LOVABLE_ORIGIN (pass through)
3. /sitemap*.xml → proxy to Supabase dynamic-sitemap edge function
4. /sw.js, /workbox-*.js → proxy to LOVABLE_ORIGIN with no-cache headers
5. Files with extensions (*.js, *.css, *.png, etc.) → proxy to LOVABLE_ORIGIN
6. SEO routes (56 patterns) → parallel fetch: Supabase fragments + origin shell → mergeHTML
7. Everything else → SPA shell from LOVABLE_ORIGIN/
```

## Cache TTLs

| Content | Browser (`max-age`) | Edge (`s-maxage`) | Notes |
|---|---|---|---|
| SEO merged HTML | 5 min | 1 hr | Purged by `seo-cache-rebuild` via CF API |
| SPA shell (index.html) | 1 min | 2 min | Short TTL for fast publish propagation |
| Hashed assets (`/assets/*`) | Origin headers | Origin headers | Vite hashed filenames = cache-safe |
| Static files (robots.txt, etc.) | 1 hr | 24 hr | Rarely change |
| Sitemaps | 30 min | 1 hr | Dynamic from Supabase |
| Service worker (sw.js) | no-cache | no-cache | SW spec requires fresh checks |

## Worker Routes

Two routes on the `truejobs.co.in` Cloudflare zone:

- `truejobs.co.in/*`
- `www.truejobs.co.in/*`

Both point to the same Worker script.

## Deployment

### Initial setup

1. In Cloudflare dashboard → Workers & Pages → Create Worker
2. Paste the contents of `public/_worker.js`
3. Configure environment bindings (see table above)
4. Add Worker Routes: `truejobs.co.in/*` and `www.truejobs.co.in/*`
5. Ensure a proxied DNS record exists for `truejobs.co.in` on the zone

### Updating the Worker

1. Edit `public/_worker.js` in the repo (Lovable editor)
2. Copy updated code to Cloudflare dashboard → Workers → Quick Edit
3. Or use `wrangler deploy` with a `wrangler.toml` pointing to the file

## Supabase Secrets for Cache Purge

The `seo-cache-rebuild` edge function purges Cloudflare cache after rebuilding
SEO pages. These secrets must be configured in Supabase:

| Secret | Purpose |
|---|---|
| `CLOUDFLARE_ZONE_ID` | Zone ID from CF dashboard → Overview |
| `CLOUDFLARE_API_TOKEN` | CF API token with `Cache Purge` permission |

## Pre-Cutover Checklist

- [ ] `https://truejobs-co-in.lovable.app` loads correctly (click Publish in Lovable)
- [ ] `serve-public-page` returns valid fragments for test slugs
- [ ] Worker script tested on a test subdomain (e.g. `test-worker.truejobs.co.in/*`)
- [ ] All route categories verified: homepage, SEO page, SPA page, asset, sitemap, robots.txt, sw.js, OAuth login
- [ ] `CLOUDFLARE_ZONE_ID` and `CLOUDFLARE_API_TOKEN` added to Supabase secrets
- [ ] `seo-cache-rebuild` cache purge tested successfully
- [ ] Manual proxied DNS record exists for `truejobs.co.in` independent of CF Pages

## Post-Cutover Verification

- [ ] `curl -I https://truejobs.co.in/govt-jobs-uttar-pradesh` → `X-Rendered-By: sfc-worker`
- [ ] `curl -I https://www.truejobs.co.in/` → 301 to `https://truejobs.co.in/`
- [ ] `curl -s https://truejobs.co.in/sitemap.xml` → valid sitemap index XML
- [ ] `curl -I https://truejobs.co.in/sw.js` → `Cache-Control: no-cache, max-age=0`
- [ ] `curl -I https://truejobs.co.in/robots.txt` → 200 with correct content
- [ ] Browser test: login, dashboard, admin panel all functional
- [ ] Google PageSpeed Insights on 2-3 pages — no regressions
- [ ] CF Workers analytics: error rate < 0.1% after 1 hour

## Rollback

If the Worker fails after cutover:

1. **Immediate**: Disable Worker Routes in CF dashboard. Traffic falls to zone default.
2. **Fast rollback**: Re-enable CF Pages CNAME for `truejobs.co.in` (keep Pages project alive for 48 hours after cutover).
3. **Requirement**: Do NOT delete the CF Pages project until 48 hours of stable Worker operation.

## Failure Behavior

| Failure | Result |
|---|---|
| Supabase `serve-public-page` 404 or error | SPA shell served (React renders client-side) |
| `mergeHTML` returns null | SPA shell served |
| Lovable origin down | 502 with `Retry-After: 30` (CF edge cache may serve stale shell for up to 2 min) |
| Sitemap edge function fails | `/sitemap.xml` proxied from origin static file; sub-sitemaps return minimal valid XML |
