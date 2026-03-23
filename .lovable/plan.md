

# Plan: Add Scrape Pending, Extract Pending, and Progress Counts to Firecrawl Sources

## Problem Summary
Discovery works and stages URLs, but most staged rows have `extracted_markdown = null` (URL-only). There's no UI to batch-scrape those pages or batch-extract them into drafts. The existing `extract-batch` action works but only processes items that already have markdown. A new `scrape-pending` action is needed.

## Architecture

```text
Discovery (exists) → Scrape Pending (NEW) → Extract Pending (exists as extract-batch)
   stages URLs         fills markdown         creates draft jobs
```

## Changes

### 1. Edge Function: `firecrawl-ingest/index.ts`

**Add new action: `scrape-pending`**
- Accepts `source_id` and optional `max_items` (default 20, max 50)
- Queries `firecrawl_staged_items` where:
  - `firecrawl_source_id = source_id`
  - `bucket = 'single_recruitment'`
  - `extracted_markdown IS NULL`
  - `status = 'staged'`
  - `extraction_status = 'pending'`
- For each row, calls `scrapePage(row.page_url)` via existing Firecrawl client
- On success: updates the row with `extracted_markdown`, `page_title`, `content_hash`, `extracted_links`, `metadata`
- On failure: increments error count, logs but continues
- Returns: `{ scraped, skipped, failed, total }`
- Creates a `firecrawl_fetch_runs` audit record

**Enhance `source-stats` action** to return richer counts:
- `totalStaged` (all staged items)
- `pendingUrlOnly` (staged, no markdown)
- `scraped` (has markdown, extraction_status = pending)
- `extracted` (extraction_status = extracted)
- `extractionFailed` (extraction_status = failed)
- `rejectedBucket` (bucket = rejected)
- `duplicateStaged` (status = duplicate)
- Draft counts from `firecrawl_draft_jobs`: total, by confidence (high/medium/low), by status (draft/reviewed/approved)
- `lastScrapeAt`, `lastExtractAt` timestamps

### 2. Frontend: `FirecrawlSourcesManager.tsx`

**Per-source buttons (alongside existing Discovery and Extract buttons):**
- **Scrape Pending** button (Download icon) — calls `scrape-pending` action
  - Disabled when no URL-only rows exist or action is running
  - Shows spinner during operation
  - Shows toast with results: X scraped, Y failed
- **Extract Pending** button (already exists as Extract Batch — keep it, improve labeling)

**Per-source progress counts in expanded section:**
Replace the current basic stats grid with a comprehensive breakdown:
- Total Staged | URL-Only | Scraped | Extracted | Failed | Rejected | Duplicate
- Draft stats: Total Drafts | High | Medium | Low confidence | Reviewed | Approved
- Last scrape time | Last extract time

**Post-action feedback:**
- Toast with counts after each operation
- Stats auto-refresh after scrape/extract completes

### 3. Processing Rules (enforced in code)
- Source-scoped: every action takes `source_id`, never global
- No re-scrape: only rows with `extracted_markdown IS NULL`
- No re-extract: only rows with `extraction_status = 'pending'` and `extracted_markdown IS NOT NULL`
- No auto-publish: nothing touches `jobs` table or changes status beyond `draft`
- Batched: `max_items` parameter with sensible defaults
- Isolated: no interaction with RSS or Employment News tables

### 4. Files Modified
| File | Change |
|------|--------|
| `supabase/functions/firecrawl-ingest/index.ts` | Add `scrape-pending` action handler; enhance `source-stats` response |
| `src/components/admin/firecrawl/FirecrawlSourcesManager.tsx` | Add Scrape Pending button, enhanced stats display, post-action feedback |

### 5. Field/Status Reference
| Field | Meaning |
|-------|---------|
| `extracted_markdown IS NULL` | URL-only, needs scraping |
| `extracted_markdown IS NOT NULL` | Page content present |
| `extraction_status = 'pending'` | Not yet extracted to draft |
| `extraction_status = 'extracted'` | Draft job created |
| `extraction_status = 'failed'` | Extraction attempted but failed |
| `bucket = 'single_recruitment'` | Eligible for scrape + extract |

### 6. Safeguards
- No auto-publish — nothing touches live `jobs` table
- No Source 1/Source 2 interference — all queries scoped to `firecrawl_source_id`
- Dedup logic preserved — extract uses existing `handleExtractItemInternal`
- Review flow preserved — drafts created as `status = 'draft'`
- Cost control — `max_items` caps Firecrawl API calls per run

