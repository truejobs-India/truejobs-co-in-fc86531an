

# Single-Container Static-First Rendering — Implementation Plan

## Architecture

The Cloudflare Worker intercepts public SEO route requests, fetches cached HTML fragments and the origin's `index.html` in parallel, and merges them into a single document where the cached body content sits **inside `<div id="root">`**. React's `createRoot().render()` replaces `#root`'s innerHTML on mount — standard React behavior, no special code needed.

```text
Request → Cloudflare Worker
  ├─ SEO route? → parallel fetch:
  │    ├─ serve-public-page edge fn (slug) → { head_html, body_html }
  │    └─ origin index.html (for Vite asset tags)
  │    Cache hit → merge into single HTML document → serve
  │    Cache miss (404) → pass through to origin SPA
  └─ Non-SEO route → pass through to origin SPA
```

## Cached HTML Structure (inside #root)

The `body_html` fragment must approximate the React page layout:

```html
<div class="min-h-screen flex flex-col">
  <!-- Simplified navbar placeholder with logo + key links -->
  <nav class="border-b bg-white px-4 py-3">
    <a href="/">TrueJobs</a> |
    <a href="/jobs">Jobs</a> |
    <a href="/sarkari-jobs">Govt Jobs</a> |
    <a href="/companies">Companies</a>
  </nav>
  <main class="flex-1">
    <div class="container mx-auto px-4 py-8 max-w-4xl">
      <!-- Breadcrumb -->
      <nav aria-label="Breadcrumb" class="mb-6 text-sm">...</nav>
      <!-- H1 -->
      <h1 class="text-3xl font-bold mb-4">...</h1>
      <!-- Intro content -->
      <article>...</article>
      <!-- FAQ section -->
      <section>...</section>
      <!-- Cross-links -->
      <nav>...</nav>
      <!-- Disclaimer -->
      <div>...</div>
    </div>
  </main>
  <!-- Simplified footer -->
  <footer class="border-t px-4 py-6 text-sm">
    <a href="/privacypolicy">Privacy</a> |
    <a href="/aboutus">About</a> |
    <a href="/contactus">Contact</a>
    <p>© 2026 TrueJobs.co.in</p>
  </footer>
</div>
```

This matches the React `Layout` component's outer structure (`min-h-screen flex flex-col` → Navbar → `main.flex-1` → Footer), so the visual jump when React takes over is minimal.

## Changes

### 1. Database migration
Add `head_html TEXT` and `body_html TEXT` columns to `seo_page_cache`.

```sql
ALTER TABLE seo_page_cache ADD COLUMN head_html text;
ALTER TABLE seo_page_cache ADD COLUMN body_html text;
```

### 2. Edit `supabase/functions/build-seo-cache/index.ts`
Refactor `generateHTML()` into three outputs: `head_html`, `body_html`, and `full_html` (backward compat). 

- `head_html`: meta tags, canonical, OG, Twitter, JSON-LD schemas, inline critical CSS
- `body_html`: Layout-matching structure with simplified navbar, breadcrumb, H1, intro content, FAQ (using `<details>`/`<summary>`), cross-links, disclaimer, simplified footer — all wrapped in the same CSS class hierarchy as the React Layout (`min-h-screen flex flex-col` > nav > `main.flex-1` > content > footer)
- `full_html`: remains as the complete standalone document (for backward compat with existing prerender-proxy)

The edge function upserts all three columns.

### 3. New `supabase/functions/serve-public-page/index.ts`
- Public endpoint (no auth), `verify_jwt = false`
- Accepts `{ slug: string }` in request body
- Queries `seo_page_cache` for `head_html, body_html` by slug
- Returns `200` with `{ head_html, body_html }` on hit
- Returns `404` with `{ miss: true }` on miss
- CORS headers included

### 4. Edit `supabase/config.toml`
Add:
```toml
[functions.serve-public-page]
verify_jwt = false
```

### 5. Edit `src/components/admin/SEOCacheBuilder.tsx`
Update description text from "served to search engine crawlers" to "served as the primary HTML response for all visitors on public SEO pages".

### 6. Edit `supabase/functions/prerender-proxy/index.ts`
Add deprecation comment at the top: this is now an emergency fallback, no longer the primary rendering path. No functional changes.

### 7. Cloudflare Worker code (provided as reference, deployed externally)
Provide the complete Worker script that:
- Pattern-matches SEO routes (list of regex patterns)
- Parallel-fetches `serve-public-page` + origin `index.html`
- On cache hit: extracts `<head>` content and Vite asset tags from origin's `index.html`, merges with cached `head_html` + `body_html` inside `<div id="root">`, serves the combined document
- On cache miss / error: passes through to origin (normal SPA)
- Non-SEO routes: passes through directly

## Route Classification

**Cache-served (static HTML first, React replaces):**
- `/` and standalone pages (`/jobs`, `/blog`, `/companies`, `/tools`, `/aboutus`, `/contactus`, `/privacypolicy`, `/termsofuse`, `/disclaimer`, `/editorial-policy`)
- `/jobs-in-*` (city pages)
- `/govt-jobs-*` (state, deadline, without-exam pages)
- `/ssc-*`, `/rrb-*`, `/ibps-*`, `/sbi-*`, `/upsc-*`, `/nda-*`, `/agniveer-*` (exam authority + hubs + PYPs)
- `/*-jobs` (category, department, industry)
- `/*-govt-jobs` (qualification)
- `/all-sarkari-jobs`
- Custom long-tail and combo pages

**Public dynamic (future — add to cache pipeline):**
- `/sarkari-jobs/:slug`, `/blog/:slug`, `/jobs/:id`, `/companies/:slug`
- These need a separate dynamic cache builder (not in this implementation, noted as follow-up)

**Private SPA (never cached):**
- `/login`, `/signup`, `/phone-signup`, `/forgot-password`
- `/dashboard`, `/profile`, `/employer/*`, `/admin`
- `/tools/resume-builder`, `/tools/resume-checker`
- `/enrol-now`, `/thankyou`, `/offline`

## What stays the same
- `src/main.tsx` — no changes needed
- `index.html` — no changes needed
- All React page components — no changes needed
- Existing `full_html` column and prerender-proxy backward compat preserved

## Risks
1. **Content flash**: Brief unstyled-to-styled transition before Vite CSS loads. Mitigated by inline critical CSS in `head_html`.
2. **Vite asset hash freshness**: Worker must not cache origin's `index.html` aggressively (short TTL).
3. **Migration**: After deploying updated `build-seo-cache`, run a full cache rebuild from the admin panel to populate `head_html` and `body_html` columns.

