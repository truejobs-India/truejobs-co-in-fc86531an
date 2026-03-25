

# Sitemap System Audit Report

## Executive Summary

The sitemap pipeline is **correctly configured and functional**. The service worker fix applied in the previous session (adding `'\\.(xml|txt|webmanifest)$'` to `NAV_DENYLIST` at line 107 of `src/sw.ts`) resolves the root cause. No additional code changes are needed.

---

## 1. Primary Sitemap Endpoints — All Correct

| Endpoint | Source | Returns | Status |
|---|---|---|---|
| `/sitemap.xml` | CF Worker → Supabase `dynamic-sitemap?type=index` | XML sitemap index (5 child sitemaps) | Correct |
| `/sitemap-pages.xml` | CF Worker → Supabase `dynamic-sitemap?type=pages` | XML urlset (static + govt exams + companies) | Correct |
| `/sitemap-jobs.xml` | CF Worker → Supabase `dynamic-sitemap?type=jobs` | XML urlset (active jobs + employment news) | Correct |
| `/sitemap-blog.xml` | CF Worker → Supabase `dynamic-sitemap?type=blog` | XML urlset (published blog posts) | Correct |
| `/sitemap-seo.xml` | CF Worker → Supabase `dynamic-sitemap?type=seo` | XML urlset (programmatic SEO pages, deduplicated) | Correct |
| `/sitemap-resources.xml` | CF Worker → Supabase `dynamic-sitemap?type=resources` | XML urlset (PDF resources + hub pages) | Correct |

The `/sitemap.xml` is a **sitemap index** containing references to 5 child sitemaps. The `dynamic-sitemap` edge function generates all of them dynamically from the database using the service role key.

## 2. Machine-Readable Technical Endpoints — All Correct

| Endpoint | Source | Content-Type | Status |
|---|---|---|---|
| `/robots.txt` | CF Worker → origin static file (`public/robots.txt`) | text/plain | Correct |
| `/ads.txt` | CF Worker → origin static file (`public/ads.txt`) | text/plain | Correct |
| `/manifest.webmanifest` | CF Worker → origin static file (`public/manifest.webmanifest`) | application/manifest+json | Correct |

None of these render layout, navigation, or ad units.

## 3. Service Worker (`src/sw.ts`) — Fixed and Correct

The `NAV_DENYLIST` regex at line 91-109 now includes:
```
'\\.(xml|txt|webmanifest)$'
```

This ensures the `NavigationRoute` (which serves the precached `/index.html` app shell) **never** matches requests for `.xml`, `.txt`, or `.webmanifest` files. These requests pass through to the network, where the CF Worker handles them correctly.

**Stale SW cache risk**: Users who visited the site before the fix may have an old service worker cached. The `skipWaiting()` + `clientsClaim()` + `registerType: 'autoUpdate'` configuration ensures the new SW activates immediately on next visit. No manual intervention needed.

## 4. Cloudflare Worker (`public/_worker.js`) — Correct

The routing tree handles sitemaps at **step 3** (before the SPA catch-all at step 8):

```
Step 3: SITEMAP_ROUTES map matches /sitemap.xml, /sitemap-pages.xml, etc.
        → Fetches from Supabase dynamic-sitemap edge function
        → Returns XML with Content-Type: application/xml
        → Fallback: /sitemap.xml proxied from origin static file; sub-sitemaps return minimal valid XML
Step 5: Files with extensions (*.xml, *.txt, etc.) → proxied from origin
```

This is deterministic and correct. The CF Worker never sends sitemap requests to `index.html`.

## 5. Full Pipeline (Source of Truth)

```
User/Crawler → truejobs.co.in/sitemap.xml
  → Cloudflare Worker (step 3: SITEMAP_ROUTES match)
    → Supabase Edge Function: dynamic-sitemap?type=index
      → Queries DB (jobs, blog_posts, pdf_resources) for lastmod dates
      → Returns XML sitemap index
    → CF Worker returns XML with Content-Type: application/xml
```

If Supabase fails, CF Worker falls back to the static `public/sitemap.xml` file for the index, and returns minimal valid XML for child sitemaps.

## 6. Content Correctness

- All sitemaps use the canonical domain `https://truejobs.co.in`
- No HTML fragments in XML output
- No ad markup in XML output
- No layout shell in XML output
- Noindex page types (`deadline-today`, `deadline-week`, etc.) are excluded from `sitemap-seo.xml`
- Blog and employment-news pages are excluded from `sitemap-seo.xml` (covered by dedicated sitemaps)
- Standalone pages are deduplicated across sitemaps
- No admin/private URLs included
- URL paths match React Router routes (e.g., `/jobs/employment-news/{slug}`, `/blog/{slug}`, `/companies/{slug}`)

## 7. Headers and Response Behavior

| Endpoint | Content-Type | Cache-Control | Status |
|---|---|---|---|
| Sitemaps | `application/xml; charset=utf-8` | `public, max-age=1800, s-maxage=3600` | 200 |
| robots.txt | `text/plain` (origin) | `public, max-age=3600, s-maxage=86400` | 200 |
| ads.txt | `text/plain` (origin) | `public, max-age=3600, s-maxage=86400` | 200 |

No redirect chains. `X-Robots-Tag: noindex` is set on sitemaps (correct — sitemaps themselves should not be indexed).

## 8. robots.txt References

`public/robots.txt` line 87:
```
Sitemap: https://truejobs.co.in/sitemap.xml
```
This correctly references the canonical sitemap index URL.

## 9. No Changes Needed

The fix applied in the previous session (`src/sw.ts` line 107) is the complete and correct solution. No additional files need modification.

---

## Verification Checklist

| Check | Result |
|---|---|
| `/sitemap.xml` returns XML not HTML | YES |
| All child sitemaps return XML not HTML | YES |
| `/robots.txt` returns plain text not HTML | YES |
| `/ads.txt` returns plain text not HTML | YES |
| `/manifest.webmanifest` returns manifest JSON not HTML | YES |
| No sitemap endpoint renders app layout | YES |
| No sitemap endpoint renders ads | YES |
| No sitemap endpoint is intercepted by SPA routing | YES |
| No sitemap endpoint is incorrectly handled by service worker | YES (fixed) |
| No normal public pages were changed | YES |
| robots.txt references correct sitemap URL | YES |
| Cloudflare Worker routes sitemaps correctly | YES |
| Dynamic sitemap edge function generates valid XML | YES |
| Sitemap uses canonical domain (truejobs.co.in) | YES |
| No admin/private URLs in sitemaps | YES |
| Employment news URLs match React Router routes | YES |

**Files changed: 0** (the fix was already applied in the previous session)

