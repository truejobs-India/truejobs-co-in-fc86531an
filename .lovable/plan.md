

## SEO Cache Hardening Pass — Maintainability & Operator Clarity

### Changes (6 files)

#### 1. `src/components/admin/seo-cache/cacheTypes.ts`
- Add `DB_SOURCED_PAGE_TYPES` set: `['blog', 'govt-exam', 'employment-news']`
- Add helper function `isDbSourced(pageType: string): boolean`
- Add architecture documentation comment block explaining the two rebuild paths
- No client-side `NOINDEX_PAGE_TYPES` (not needed by UI)

#### 2. `src/components/admin/seo-cache/SEOCacheManager.tsx`
- Add helper text below the Rebuild All confirmation dialog description:
  `"Note: This rebuilds DB-sourced pages only (blog, govt-exam, employment-news). Inventory-sourced pages (cities, combos, deadlines, etc.) require the legacy Build Cache flow."`

#### 3. `src/components/admin/seo-cache/CacheStatusTable.tsx`
- Import `DB_SOURCED_PAGE_TYPES` from cacheTypes
- Add a "Source" column between "Type" and "Status" showing a small badge:
  - `DB rebuild` (blue-tinted) for DB-sourced types
  - `Inventory` (gray-tinted) for all others
- Update colSpan from 7 to 8 for loading/empty rows

#### 4. `supabase/functions/seo-cache-rebuild/index.ts`
- Update header comment block (lines 1-19) to add architecture note: "This function handles DB-sourced pages only (blog, govt-exam, employment-news). Inventory-sourced pages are handled by build-seo-cache."
- Strengthen NOINDEX_PAGE_TYPES sync comment to list all 3 locations explicitly

#### 5. `supabase/functions/build-seo-cache/index.ts`
- Update header comment block to add architecture note: "This function handles inventory-sourced pages (all types from collectAllPages). DB-sourced pages (blog, govt-exam, employment-news) are handled by seo-cache-rebuild."
- Strengthen NOINDEX_PAGE_TYPES sync comment to list all 3 locations explicitly

#### 6. `supabase/functions/dynamic-sitemap/index.ts`
- Strengthen NOINDEX_PAGE_TYPES sync comment to list all 3 locations explicitly with canonical source note

### What does NOT change
- No route policies, SEO output, sitemap output, or rebuild logic
- Edge function NOINDEX_PAGE_TYPES kept duplicated (isolated Deno contexts)
- No behavioral changes whatsoever

