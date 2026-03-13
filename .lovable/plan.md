

# Implementation Plan: Cloudflare Pages `_worker.js` + PWA Fix

Three changes to enable SEO edge-merge on Cloudflare Pages Advanced Mode.

## 1. Create `public/_worker.js`

The Cloudflare Pages Advanced Mode worker that:
- Serves static assets via `env.ASSETS.fetch()`
- Detects SEO routes using the existing pattern list
- Fetches `head_html` + `body_html` from `serve-public-page` edge function
- Merges fragments into the SPA shell
- Falls back to SPA shell on cache miss or error
- Adds `X-Rendered-By: sfc-worker` header on SEO responses
- Handles SPA fallback for non-SEO routes (replaces `_redirects`)

## 2. Update `vite.config.ts`

Add `navigateFallbackDenylist` to the Workbox config so the service worker does **not** serve cached `index.html` for SEO routes. This ensures repeat visits to SEO pages still hit `_worker.js` at the edge.

## 3. Delete `public/_redirects`

No longer needed — `_worker.js` handles all routing including SPA fallback.

## Post-deploy verification

After running `npm run build && npx wrangler pages deploy dist --project-name=truejobs`:
- `curl -sI https://truejobs.co.in/ | grep X-Rendered-By` → `sfc-worker`
- `curl -sI https://truejobs.co.in/dashboard | grep X-Rendered-By` → no output
- Static assets load normally in browser

