

# Fix: Machine-Readable Endpoints Returning HTML Instead of XML/Text

## Root Cause

The **service worker** (`src/sw.ts`) is the culprit. When a user or crawler navigates to `/sitemap.xml`, the browser sends a navigation request (`request.mode === 'navigate'`). The service worker's `NavigationRoute` matches it — the denylist has no exclusion for `.xml` or `.txt` files — and serves the cached `/index.html` app shell. React Router then renders `NotFound`, producing an HTML 404 page.

The Cloudflare Worker (`public/_worker.js`) handles these endpoints correctly in production, but the service worker intercepts the request **before** the network response from the CF Worker can arrive, because the NavigationRoute uses a precached `/index.html` fallback.

## Fix (single file change)

### `src/sw.ts` — Add machine-readable file extensions to the navigation denylist

Add regex patterns to `NAV_DENYLIST` so the service worker **never** serves the app shell for `.xml`, `.txt`, or `.webmanifest` navigation requests. These requests will pass through to the network (CF Worker in production, or origin static files), returning the correct content type.

Patterns to add:
```
'\\.(xml|txt|webmanifest)$'
```

This covers:
- `/sitemap.xml`, `/sitemap-pages.xml`, `/sitemap-jobs.xml`, etc.
- `/robots.txt`
- `/ads.txt`
- `/manifest.webmanifest`
- Any future `.xml` or `.txt` endpoint

### No other files change

- `public/_worker.js` — already handles sitemaps (step 3), robots/ads.txt (step 5) correctly
- `src/App.tsx` — no route changes needed; the SW fix prevents React from ever seeing these URLs
- Ad policy — completely untouched
- Layout/templates — completely untouched
- `noAds` logic — completely untouched

## Exact edit

In `src/sw.ts`, line 91-108, add one line to the `NAV_DENYLIST` regex array:

```typescript
const NAV_DENYLIST = new RegExp(
  [
    '^\\/admin',
    '^\\/dashboard',
    '^\\/employer',
    '^\\/login',
    '^\\/signup',
    '^\\/phone-signup',
    '^\\/forgot-password',
    '^\\/profile',
    '^\\/enrol-now',
    '^\\/tools\\/',
    '^\\/auth\\/',
    '^\\/api\\/',
    '^\\/rest\\/',
    '^\\/functions\\/',
    '\\.(xml|txt|webmanifest)$',   // ← NEW: machine-readable endpoints
  ].join('|'),
);
```

## Verification checklist

| Endpoint | Expected result | Mechanism |
|---|---|---|
| `/sitemap.xml` | XML sitemap index | SW skips → CF Worker step 3 → Supabase `dynamic-sitemap` |
| `/sitemap-jobs.xml` | XML sitemap | SW skips → CF Worker step 3 |
| `/robots.txt` | Plain text | SW skips → CF Worker step 5 → origin static file |
| `/ads.txt` | Plain text | SW skips → CF Worker step 5 → origin static file |
| `/manifest.webmanifest` | JSON manifest | SW skips → CF Worker step 5 → origin static file |
| Homepage `/` | Normal HTML with ads | Unchanged |
| `/admin` | Ad-free admin page | Unchanged |
| All other pages | Normal with ads | Unchanged |

## Files changed

| File | Change |
|---|---|
| `src/sw.ts` | Add 1 regex pattern to `NAV_DENYLIST` |

**Total: 1 file, 1 line added.**

