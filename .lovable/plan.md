

# SEO Cache Management Dashboard — Implementation Plan

## Summary
Replace `<SEOCacheBuilder />` with a comprehensive `<SEOCacheManager />` component in the admin SEO tab. Split into 13 new files under `src/components/admin/seo-cache/`. No database changes needed.

## Files to Create

| File | Purpose |
|------|---------|
| `src/components/admin/seo-cache/cacheTypes.ts` | Shared types: `CachePage`, `CacheStats`, `ValidationResult`, `GlobalAuditResult`, `AuditSeverity` |
| `src/components/admin/seo-cache/useCacheData.ts` | Hook: paginated fetching with server-side filters, count queries for overview cards, stale classification per page type, queue/log fetching |
| `src/components/admin/seo-cache/cacheValidation.ts` | Page-level validation (title, meta, canonical, robots, H1, schemas, link format, content quality) + global audit (duplicate canonicals, orphaned cache, missing pages, sitemap mismatches) with severity levels (error/warning/info) |
| `src/components/admin/seo-cache/cacheExport.ts` | CSV + JSON export for filtered view or full dataset |
| `src/components/admin/seo-cache/SEOCacheManager.tsx` | Top-level orchestrator with 4 tabs: All Pages, Global Audit, Build Log, Failed Builds |
| `src/components/admin/seo-cache/CacheOverviewCards.tsx` | 9 stat cards (total cacheable, cached, missing, stale, failed, queue pending, coverage %, last full build, last incremental) |
| `src/components/admin/seo-cache/CacheFilters.tsx` | Search input + dropdowns (page type, status, indexability) + quick toggles (Missing, Stale, Failed, Recently Changed) |
| `src/components/admin/seo-cache/CacheStatusTable.tsx` | Paginated table (50/page) with checkbox selection, status-priority sort (failed > missing > stale > queued > cached), per-row action menu, bulk action toolbar |
| `src/components/admin/seo-cache/CachePreviewModal.tsx` | Two tabs: "Cached Fragments" (raw head_html + body_html code view) and "Assembled Preview" (iframe srcdoc with disclaimer label). Metadata sidebar extracts title, description, canonical, robots, OG, Twitter, JSON-LD blocks, internal links |
| `src/components/admin/seo-cache/CacheValidationPanel.tsx` | Per-page validation results displayed as check list with pass/fail icons |
| `src/components/admin/seo-cache/CacheGlobalAudit.tsx` | "Run Global Audit" button, results grouped by severity (error/warning/info), covers duplicate canonicals, orphaned cache rows, expected-but-missing pages, sitemap mismatches |
| `src/components/admin/seo-cache/CacheBuildLog.tsx` | Rebuild log table (from `seo_rebuild_log`), expandable error details |
| `src/components/admin/seo-cache/CacheFailedItems.tsx` | Failed queue items table with individual retry, bulk retry, bulk dismiss |

## Files to Modify

| File | Change |
|------|--------|
| `src/pages/admin/AdminDashboard.tsx` | Replace `SEOCacheBuilder` import with `SEOCacheManager` on SEO tab (line 348) |
| `src/components/admin/SEOCacheBuilder.tsx` | Export `collectAllPages` and `PageData` type for reuse; keep component as legacy fallback |

## Key Design Decisions

### Pagination & Scalability
- Overview cards use `SELECT count(*) HEAD` queries — no row data fetched
- Table uses `SELECT * FROM seo_page_cache WHERE [filters] LIMIT 50 OFFSET n` with server-side search via `.ilike('slug', '%term%')`
- `collectAllPages()` inventory (~1,250 items) is loaded once and memoized client-side for cross-referencing

### Default Sort Priority
Table rows sorted by computed status priority: `failed(0) > missing(1) > stale(2) > queued(3) > rebuilding(4) > cached(5)`. Within same status, sort by `updated_at` descending.

### Stale Detection Rules by Page Type

| Category | Source of Truth | Stale When |
|----------|----------------|------------|
| DB-backed: blog | `blog_posts.updated_at` | Cache `updated_at` < source `updated_at` |
| DB-backed: govt-exam | `govt_exams.updated_at` | Cache `updated_at` < source `updated_at` |
| DB-backed: employment-news | `employment_news_jobs.published_at` | Cache `updated_at` < source timestamp |
| Authority/Hub/PYP | `lastUpdated` from TS registry | Cache `updated_at` < parsed registry date |
| Programmatic (city, state, dept, etc.) | `app_settings.last_deploy_at` | Cache `updated_at` < deploy timestamp |
| Fallback (no `last_deploy_at` set) | Skip stale check | Classified as `cached` (not misclassified as stale) |

### Global Audit Severity Levels
- **error**: duplicate canonical URLs, cached pages not in inventory (orphaned)
- **warning**: expected pages missing from cache, sitemap inclusion mismatch
- **info**: pages with noindex that are cached (intentional but notable)

### Internal Link Validation — Honest Labels
- "Internal link format valid" — hrefs start with `/` or site URL
- "Crawlable internal links present" — at least 1 internal link in body
- No claim of broken-link detection

### Purge-All Safety
- `AlertDialog` with explicit warning: "This will purge ALL cached pages from Cloudflare CDN. All pages will be re-fetched from origin on next visit, causing temporary increased load."
- Type-to-confirm: user must type `PURGE ALL` to enable confirm button
- Rebuild All uses standard confirm dialog (lower risk)

### Preview Clarity
- **"Cached Fragments"** tab: shows raw `head_html` and `body_html` in scrollable `<pre>` blocks
- **"Assembled Preview"** tab: iframe with `srcdoc` wrapping fragments in minimal HTML shell, labeled: *"Approximate preview — production merges these with the live app shell"*

### Export Support
- Toolbar shows "Export Filtered" (current filter/search results) and "Export All"
- Formats: CSV and JSON via dropdown

## Data Flow

```text
useCacheData({page, pageSize, filters, search})
  ├── count queries (6x HEAD) → CacheOverviewCards
  ├── paginated seo_page_cache query → merged with inventory → CacheStatusTable
  ├── seo_rebuild_queue counts → overview + table status
  ├── seo_rebuild_log (limit 20) → CacheBuildLog
  └── seo_rebuild_queue.status=failed → CacheFailedItems
```

## Admin Usage Flow
1. Open Admin → SEO tab → overview cards show cache health at a glance
2. "All Pages" tab: search/filter, click row for preview/validate, use action menu for rebuild/purge
3. "Global Audit" tab: run cross-page checks, see issues grouped by severity
4. "Build Log" tab: review rebuild history with expandable error details
5. "Failed Builds" tab: retry or dismiss failed items
6. Bulk select rows → toolbar appears for rebuild/purge/export selected
7. "Rebuild All" → standard confirm dialog; "Purge All CF" → type-to-confirm dialog

