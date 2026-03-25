

## Implementation Plan: Migrate `_worker.js` to Standalone Worker Mode

### Summary
Rewrite `public/_worker.js` from Cloudflare Pages Advanced Mode (using `env.ASSETS.fetch`) to a standalone Cloudflare Worker that proxies the Lovable published origin (`https://truejobs-co-in.lovable.app`) for all non-SEO traffic, while preserving the existing Supabase SEO cache merge system. Update documentation to match.

### Files Changed

**1. `public/_worker.js`** — Full rewrite

Key changes:
- **Remove** all `env.ASSETS.fetch()` calls (6 occurrences)
- **Add** `LOVABLE_ORIGIN` constant (`https://truejobs-co-in.lovable.app`)
- **Read** `SUPABASE_URL`, `SUPABASE_ANON_KEY` from `env` bindings (with hardcoded fallbacks for safety during transition)
- **Add** www-to-apex redirect as the very first check
- **Add** explicit service worker no-cache handling for `/sw.js` and `/workbox-*.js`
- **Add** `cf: { cacheTtl: 120 }` on SPA shell origin fetches for edge resilience
- **Add** `Cache-Control: public, max-age=3600, s-maxage=86400` on proxied static files like `robots.txt`, `manifest.webmanifest`, `favicon.ico`
- **Keep** all SEO route patterns, private prefixes, `isSEORoute()`, `extractSlug()`, `mergeHTML()`, sitemap routing — unchanged
- **Keep** the exact same SEO merged HTML cache headers (`max-age=300, s-maxage=3600`)

New request flow in the Worker:
```text
1. www redirect → 301 to apex
2. Non-GET → proxy to LOVABLE_ORIGIN (pass through)
3. Sitemaps → proxy to Supabase dynamic-sitemap (fallback: LOVABLE_ORIGIN/sitemap.xml or minimal XML)
4. /sw.js, /workbox-*.js → proxy to LOVABLE_ORIGIN with no-cache headers
5. Files with extensions → proxy to LOVABLE_ORIGIN (pass through origin headers for hashed assets)
6. Private/auth routes → proxy LOVABLE_ORIGIN/ (SPA shell, short cache)
7. SEO routes → parallel fetch: Supabase fragments + LOVABLE_ORIGIN/ shell → mergeHTML
8. Catch-all → proxy LOVABLE_ORIGIN/ (SPA shell)
```

Helper function added: `fetchSpaShell(env)` — centralized SPA shell fetch with `cf: { cacheTtl: 120 }` and short `Cache-Control`.

Proxy function added: `proxyToOrigin(request, env)` — forwards request to `LOVABLE_ORIGIN + pathname + search` preserving method/headers.

**2. `docs/cloudflare-worker-sfc.md`** — Full rewrite

Updated to document:
- Standalone Worker architecture (not Pages)
- Lovable origin as upstream asset server
- Env bindings required: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `LOVABLE_ORIGIN`
- Worker route setup: `truejobs.co.in/*` and `www.truejobs.co.in/*`
- Cache TTLs for each content type
- Deployment procedure (paste into CF dashboard or use Wrangler CLI)
- Pre-cutover checklist
- Post-cutover verification checklist
- Rollback steps
- Secrets needed in Supabase for cache purge: `CLOUDFLARE_ZONE_ID`, `CLOUDFLARE_API_TOKEN`

### No changes to
- Any Supabase edge functions
- Any React components or routes
- `index.html`, `robots.txt`, `manifest.webmanifest`, `sw.ts`
- `AuthContext.tsx` (custom domain detection already works)
- Any database tables or RLS policies
- `supabase/config.toml`
- `.env`

### Technical Details

**Worker env bindings** (configured in Cloudflare dashboard after deployment):
| Binding | Type | Value |
|---|---|---|
| `SUPABASE_URL` | Secret | `https://riktrtfgpnrqiwatppcq.supabase.co` |
| `SUPABASE_ANON_KEY` | Secret | The anon key |
| `LOVABLE_ORIGIN` | Variable | `https://truejobs-co-in.lovable.app` |

**Supabase secrets to add** (for cache purge to work):
| Secret | Purpose |
|---|---|
| `CLOUDFLARE_ZONE_ID` | Zone ID from CF dashboard for cache purge API |
| `CLOUDFLARE_API_TOKEN` | CF API token with Cache Purge permission |

**Homepage fallback**: If `serve-public-page` returns 404 or error for slug `""`, the Worker serves the raw SPA shell from Lovable origin. The `index.html` already contains valid homepage meta tags, so bots get reasonable SEO signals and users get a fully functional React-rendered homepage.

