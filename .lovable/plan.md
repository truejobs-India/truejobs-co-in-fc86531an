

# Phase 2: Discovery, Crawling, PDF Handling, and Draft Creation

## Summary

Extend the existing `firecrawl-ingest` edge function and `GovtSourcesManager` UI to support government-specific discovery with job-page scoring, PDF link detection, Firecrawl map-based discovery, and enhanced run controls. All drafts flow into the existing `firecrawl_draft_jobs` table. No new tables needed.

## Current State

- `firecrawl-ingest` already supports `discover-source`, `scrape-pending`, `extract-item`, `extract-batch` actions generically for all `firecrawl_sources` rows
- `GovtSourcesManager.tsx` has a "Discover" button per source that calls `discover-source` via `firecrawl-ingest`
- Discovery currently uses `scrapePage()` on seed URL to get links, then filters/classifies/stages them
- Government sources already set `crawl_mode = 'map'` but the backend `discover-source` ignores crawl_mode and always uses scrape
- No PDF detection, no map-based discovery, no government-specific page scoring, no bulk run controls in GovtSourcesManager

## Changes

### 1. Edge Function: `supabase/functions/firecrawl-ingest/index.ts`

**A. Add `discover-govt` action** (new handler alongside existing `discover-source`)

- If source `crawl_mode === 'map'`, use `mapUrl()` (already in client.ts) instead of `scrapePage()` for initial URL discovery — this returns up to 5000 links cheaply vs scraping a single page
- Apply government-specific page scoring: boost URLs containing recruitment keywords (`recruitment`, `vacancy`, `careers`, `notification`, `advertisement`, `apply-online`, `notices`, `latest-updates`, `walk-in`, `bharti`) with higher priority
- Detect PDF links (`.pdf` extension) and stage them separately with a `pdf_notice` flag in metadata
- Use configurable `max_pages_per_run` from source (default 50 for govt)
- Deduplicate against existing staged items (same as current)
- Rate limiting: 1-second delay between detail scrapes

**B. Add `govt-scrape-extract` action** (combined scrape + extract for govt sources)

- Fetches pending staged items for a government source
- For HTML pages: scrape markdown + links as current flow
- For PDF links: scrape with Firecrawl (Firecrawl handles PDFs natively — returns markdown from PDFs)
- After scraping, immediately extract fields using existing `extractFields()` + `sanitizeDraftFields()`
- Merge PDF context: if a staged item has both HTML markdown and linked PDF URLs, scrape the PDF and prepend its text to the HTML markdown before extraction
- Create/update draft jobs using existing `firecrawl_draft_jobs` upsert on `staged_item_id`
- Set `source_name` from the source's `govt_meta.domain_label` or `source_name`
- Dedup-aware: before inserting, check existing drafts by org + title + notification URL using the existing `checkDuplicate()` function. If match found with better data, update existing draft instead of creating new one

**C. Add `govt-run-all` action** (batch runner)

- Accepts optional `source_ids` array, or runs all enabled government sources
- For each source: runs `discover-govt` then `govt-scrape-extract` sequentially
- Returns per-source results with counts
- Respects 2-second inter-source delay

**D. Government page scoring function** (in `page-classifier.ts`)

Add a `scoreGovtPage()` export that gives weighted scores to government URLs:
- +3: path contains `recruitment`, `vacancy`, `notification`, `advertisement`
- +2: path contains `careers`, `jobs`, `apply`, `notices`, `walk-in`  
- +1: path contains `latest`, `updates`, `circular`, `bharti`, `advt`
- -2: path contains `sitemap`, `login`, `about`, `contact`, `privacy`, `rss`
- PDF links automatically get +2 bonus
- Returns sorted candidates by score, top N selected for scraping

### 2. Shared Module: `supabase/functions/_shared/firecrawl/page-classifier.ts`

Add `scoreGovtPage(url: string, title?: string): number` function using the scoring rules above. Reuse existing signal dictionaries.

### 3. UI: `src/components/admin/firecrawl/GovtSourcesManager.tsx`

**A. Add bulk run controls to toolbar:**
- "Run Discovery All" — calls `govt-run-all` with `phase: 'discover'` for all enabled sources
- "Scrape & Extract All" — calls `govt-run-all` with `phase: 'scrape-extract'` for all enabled sources
- "Full Pipeline All" — calls `govt-run-all` with `phase: 'full'`
- "Stop" button during batch runs
- Progress indicator (current/total sources)

**B. Per-source actions (expand existing):**
- Add "Scrape & Extract" button alongside existing "Discover"
- Add "Full Pipeline" button (discover → scrape → extract in one click)
- Show stats: discovered count, scraped count, extracted count, failed count, PDF count

**C. Persistent batch report:**
- After any batch run, show a summary report (like `FirecrawlSourcesManager` already does)
- Per-source: status, staged count, scraped count, extracted count, errors, duration

**D. Error/retry visibility:**
- Show last error per source in the table
- "Retry Failed" button that re-runs only sources with `last_error IS NOT NULL`

### 4. Database Migration

**No new tables.** One small migration:

Add `govt_discovery_meta` JSONB column to `firecrawl_staged_items` to track:
- `is_pdf: boolean` — whether this is a PDF link
- `govt_score: number` — page relevance score
- `linked_pdf_urls: string[]` — PDF links found on an HTML page
- `pdf_merged: boolean` — whether PDF content was merged into markdown

This avoids touching the existing columns and keeps the metadata flexible.

### 5. Deduplication Enhancement

In the `govt-scrape-extract` handler, before upserting a draft:
1. Check existing `firecrawl_draft_jobs` for same org + similar title (using existing `checkDuplicate`)
2. If high-confidence match exists AND new data has more fields filled → UPDATE existing draft with richer data
3. If high-confidence match exists AND new data is equal/weaker → SKIP (log as duplicate)
4. If no match → INSERT new draft

## File Change Summary

| File | Action | Description |
|------|--------|-------------|
| `supabase/functions/firecrawl-ingest/index.ts` | Edit | Add `discover-govt`, `govt-scrape-extract`, `govt-run-all` handlers (~250 lines) |
| `supabase/functions/_shared/firecrawl/page-classifier.ts` | Edit | Add `scoreGovtPage()` function (~30 lines) |
| `src/components/admin/firecrawl/GovtSourcesManager.tsx` | Edit | Add bulk run controls, per-source actions, batch report, retry (~200 lines) |
| DB migration | Create | Add `govt_discovery_meta` JSONB to `firecrawl_staged_items` |

## Regression Checklist

1. Existing `discover-source` and `scrape-pending` actions still work for non-govt sources
2. Existing Firecrawl Sources section unaffected
3. Draft jobs from government sources appear in the main draft jobs table
4. Page classifier still works for non-govt classification
5. TP cleaner and dedup still function on government-sourced drafts
6. Bulk import from Phase 1 still works
7. No duplicate drafts created on re-runs of same source

