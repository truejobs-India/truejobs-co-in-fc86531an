

## Fix: Patch `seo-cache-rebuild/index.ts` — Noindex Enforcement in Primary Cache Builder

### Problem
Line 136 of `supabase/functions/seo-cache-rebuild/index.ts` hardcodes `index, follow` for ALL pages. This is the primary builder used by Admin UI and cron queue.

### Changes — 1 File, 2 Edits

**File: `supabase/functions/seo-cache-rebuild/index.ts`**

**Edit 1** — Insert after line 102 (after `PageData` interface, before `generateHeadHTML`):

```typescript
// ── Noindex page types ───────────────────────────────────────────────
// Ephemeral / time-sensitive pages that must never be indexed.
// Must stay in sync with NOINDEX_PAGE_TYPES in build-seo-cache/index.ts,
// dynamic-sitemap/index.ts, and PAGE_TYPE_POLICIES (seoRoutePolicyRegistry.ts).
const NOINDEX_PAGE_TYPES = new Set([
  'deadline-today',
  'deadline-week',
  'deadline-month',
  'combo-closing-soon',
  'deadline-this-week',
]);
```

**Edit 2** — Replace line 136:

From:
```
<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1">
```

To:
```
<meta name="robots" content="${NOINDEX_PAGE_TYPES.has(page.pageType) ? 'noindex, follow' : 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1'}">
```

### No other files changed

### Post-deploy verification
1. Deploy the edge function
2. Query `seo_page_cache` for sample noindex slugs (e.g. `combo-closing-soon`, `deadline-this-week` patterns) to check current `head_html`
3. Trigger rebuilds for those slugs via the edge function
4. Re-query to confirm `head_html` now contains `noindex, follow`
5. Spot-check an indexable slug to confirm it still has `index, follow`

