

## P0 Fix: Noindex Enforcement — 2 Edge Function Changes

### File 1: `supabase/functions/build-seo-cache/index.ts`

**Change A** — Insert after line 30 (after `PageData` interface closing brace), before the fragment generators comment:

```typescript
// ── Noindex page types ───────────────────────────────────────────────
// Ephemeral / time-sensitive pages that must never be indexed.
// Must stay in sync with NOINDEX_PAGE_TYPES in dynamic-sitemap/index.ts
// and noindex entries in PAGE_TYPE_POLICIES (seoRoutePolicyRegistry.ts).
const NOINDEX_PAGE_TYPES = new Set([
  'deadline-today',
  'deadline-week',
  'deadline-month',
  'combo-closing-soon',
  'deadline-this-week',
]);
```

**Change B** — Replace line 72 (the hardcoded robots meta):

From:
```
<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1">
```

To:
```
<meta name="robots" content="${NOINDEX_PAGE_TYPES.has(page.pageType) ? 'noindex, follow' : 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1'}">
```

Uses `noindex, follow` — allows link equity to flow while preventing indexing. No other changes to this file.

---

### File 2: `supabase/functions/dynamic-sitemap/index.ts`

**Change A** — Insert after line 11 (after `SITE_URL` constant):

```typescript
// ── Noindex page types — excluded from sitemap ──────────────────────
// Must stay in sync with NOINDEX_PAGE_TYPES in build-seo-cache/index.ts
// and noindex entries in PAGE_TYPE_POLICIES (seoRoutePolicyRegistry.ts).
const NOINDEX_PAGE_TYPES = new Set([
  'deadline-today',
  'deadline-week',
  'deadline-month',
  'combo-closing-soon',
  'deadline-this-week',
]);
```

**Change B** — In `generateSEOSitemap()`, replace lines 191-199 (the query and loop):

From:
```typescript
    const { data, error } = await supabase
      .from('seo_page_cache')
      .select('slug')
      .range(offset, offset + PAGE_SIZE - 1)
      .order('slug');
    if (error) { console.error('seo_page_cache query error:', error); break; }
    if (!data || data.length === 0) break;
    for (const row of data) {
      if (row.slug) cachedSlugs.add(row.slug);
    }
```

To:
```typescript
    const { data, error } = await supabase
      .from('seo_page_cache')
      .select('slug, page_type')
      .range(offset, offset + PAGE_SIZE - 1)
      .order('slug');
    if (error) { console.error('seo_page_cache query error:', error); break; }
    if (!data || data.length === 0) break;
    for (const row of data) {
      // Skip noindex page types — these must never appear in sitemaps
      if (row.slug && !NOINDEX_PAGE_TYPES.has(row.page_type)) {
        cachedSlugs.add(row.slug);
      }
    }
```

No other changes to this file. The rest of `generateSEOSitemap()` stays identical.

---

### What does NOT change

- `seoRoutePolicyRegistry.ts` — approved policy mappings untouched
- `seoRoutePolicyEngine.ts` — diagnostics untouched
- `cacheTypes.ts` — page type inventory untouched
- Indexable families (`combo-dept-state`, `authority-*`, `custom-exam-support`) — unaffected

### Expected before/after

| Metric | Before | After |
|---|---|---|
| `combo-closing-soon` robots meta in cache | `index, follow, ...` | `noindex, follow` |
| `deadline-this-week` robots meta in cache | `index, follow, ...` | `noindex, follow` |
| `deadline-today/week/month` robots meta | `index, follow, ...` | `noindex, follow` |
| Noindex pages in sitemap-seo.xml | Included (~16 URLs) | Excluded |
| Indexable families in sitemap-seo.xml | Present | Unchanged |

### Post-deployment verification steps

1. Deploy both edge functions
2. Trigger a cache rebuild for a sample `combo-closing-soon` slug — verify robots meta contains `noindex, follow`
3. Fetch `sitemap-seo.xml` — confirm noindex slugs are absent
4. Spot-check `combo-dept-state` and `authority-*` slugs remain in sitemap with `index, follow` robots meta

### Duplication note

`NOINDEX_PAGE_TYPES` is duplicated across both edge functions. Edge functions cannot share imports. Each copy has a sync-point comment referencing the other file.

