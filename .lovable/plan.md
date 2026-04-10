

# Fix Firecrawl Pipeline Visibility: Show Full Funnel Status

## Problem
After scraping government sources, there is zero visibility into what happened. You can't see:
- How many items were staged (discovered)
- How many are still pending extraction (74 right now)
- How many were extracted vs skipped vs failed
- That 25 draft jobs actually exist (they do, but may not be obvious)

The GovtSourcesManager only shows `total_items_found` and the DraftJobsSection loads drafts silently with no pipeline summary.

## Current Data State
| Stage | Count |
|-------|-------|
| Staged items (total) | 108 |
| Pending extraction | 74 |
| Extracted → drafts created | 25 |
| Skipped (no job data) | 9 |

## Plan

### 1. Add pipeline status summary to GovtSourcesManager
Show per-source counts inline in the sources table: **Staged / Pending / Extracted / Drafts**

**File:** `src/components/admin/firecrawl/GovtSourcesManager.tsx`
- After loading sources, run a summary query grouping `firecrawl_staged_items` by `firecrawl_source_id` and `extraction_status`
- Add columns to the sources table: "Staged", "Pending", "Extracted"
- Highlight pending count in orange badge when > 0 (signals "you need to run S&E again")

### 2. Add a pipeline funnel summary card above the DraftJobsSection
Show a compact summary card at the top of DraftJobsSection with counts: total staged → pending → extracted → skipped → drafts created

**File:** `src/components/admin/firecrawl/DraftJobsSection.tsx`
- Add a `fetchPipelineSummary()` call alongside `fetchDrafts()` that queries `firecrawl_staged_items` grouped by `extraction_status` where the source's `source_type = 'government'`
- Render a small horizontal funnel/stats bar showing the counts
- Show a warning badge when pending > 0: "74 items awaiting extraction — run Scrape & Extract on sources"

### 3. Add a "Process Remaining" button in GovtSourcesManager
When a source has pending staged items, show a prominent button/badge to re-run Scrape & Extract specifically for that source.

**File:** `src/components/admin/firecrawl/GovtSourcesManager.tsx`
- In the per-source action buttons, if `pendingCount > 0`, show badge on the S&E button with pending count

### 4. Reduce inter-scrape delay for faster processing
**File:** `supabase/functions/firecrawl-ingest/index.ts`
- Reduce the sleep between scrapes from 2000ms to 1000ms to process more items before timeout

## Technical Details

### New query for pipeline stats (runs in both components):
```sql
SELECT 
  extraction_status, 
  COUNT(*) 
FROM firecrawl_staged_items si
JOIN firecrawl_sources s ON si.firecrawl_source_id = s.id
WHERE s.source_type = 'government'
GROUP BY extraction_status
```

### Per-source stats query:
```sql
SELECT 
  firecrawl_source_id,
  extraction_status,
  COUNT(*)
FROM firecrawl_staged_items
GROUP BY firecrawl_source_id, extraction_status
```

### UI Changes Summary
- **GovtSourcesManager table**: New "Pending" column with orange badge when > 0
- **DraftJobsSection header**: Pipeline funnel bar showing staged→pending→extracted→drafts
- **S&E button**: Shows pending count badge when items remain

