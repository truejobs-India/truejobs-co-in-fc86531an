

# Fix: Show All Selected Articles in Scan Results + Mark Clean Articles as AI Fixed

## Problem
When you select 20 articles and scan, clean articles (those passing all compliance checks) are silently dropped from the results table at line 298-301 of `useBulkAutoFix.ts`. The summary grid shows "Clean: 19" but the table only lists the 1 fixable article. Additionally, clean articles never get the "AI Fixed" badge because they never go through the fix phase.

## Changes

### 1. Include clean articles in scan items (`src/hooks/useBulkAutoFix.ts`)

At lines 298-302, instead of incrementing `cleanCount` and `continue`-ing, push a `ScanItem` with `classification: 'clean'` into `items[]`. Add a new `allItems` field to the `ScanReport` type containing every scanned article (clean + fixable + skipped).

### 2. Show all articles in the scan results table (`src/components/admin/BlogPostEditor.tsx`)

At lines 2494-2511, change the table to render `scanReport.allItems` instead of `scanReport.fixableItems`. Add a "Status" column with color-coded badges:
- **Green "Clean"** — passes all checks
- **Blue "Fixable"** — has auto-fixable issues (shows fail/warn counts)
- **Gray "Skipped"** — too short or manual-only issues

### 3. Stamp clean articles as "AI Fixed" during execution (`src/hooks/useBulkAutoFix.ts`)

In `executeAutoFix` (around lines 354-426), after processing all fixable items, loop through `scanReport.allItems` where `classification === 'clean'` and:
- Call `stampBulkFixStatus(postId, 'fixed', 0)` to mark them as processed
- Update `ai_fixed_at` timestamp in the database so they get the green "AI Fixed" badge
- Add them to the results array with `status: 'fixed'` and reason "Already compliant — no fixes needed"

### 4. Update ScanReport type

Add `allItems: ScanItem[]` to the `ScanReport` interface (line 115-124). Keep `fixableItems` for execution logic.

## Files to Modify
1. `src/hooks/useBulkAutoFix.ts` — Add clean articles to items, new `allItems` field, stamp clean articles during execution
2. `src/components/admin/BlogPostEditor.tsx` — Show full article table with status badges

