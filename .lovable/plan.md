

# Implement "Mark Existing Posts as Baseline Scanned"

## Summary
Add a `baseline` status to the bulk fix system and a one-click admin action to stamp all unscanned legacy posts, so the smart scan stops treating them as "Never Bulk-Fixed".

## Changes

### 1. `src/hooks/useBulkAutoFix.ts`

**Type update (line 67):**
- Add `'baseline'` to `BulkFixStatus`: `'fixed' | 'partially_fixed' | 'skipped' | 'failed' | 'no_action_taken' | 'baseline'`

**New state + function (before the return ~line 440):**
- `isBaselining` boolean state
- `baselineResult: { count: number } | null` state
- `baselineMarkPosts(targetIds?: string[])` async function:
  - If `targetIds` provided → update those posts
  - Otherwise → update all posts where `last_bulk_scanned_at IS NULL`
  - Sets: `last_bulk_scanned_at = now()`, `last_bulk_fix_status = 'baseline'`, `remaining_auto_fixable_count = 0`
  - Does NOT set `last_bulk_fixed_at`
  - Uses `.update().is('last_bulk_scanned_at', null)` (or `.in('id', targetIds)`) then `.select('id')` to count affected rows

**Expose in return:** `isBaselining`, `baselineResult`, `baselineMarkPosts`

**Eligibility:** No code change needed — `baseline` posts fall through to `skippedUnchanged` in `isEligibleForSmartScope` since they have `last_bulk_scanned_at` set and status is not `failed`/`partially_fixed`. They only re-enter if `updated_at > last_bulk_scanned_at`.

### 2. `src/components/admin/BlogPostEditor.tsx`

**Add baseline button + AlertDialog** after the scope selector (after line ~2047, before the Publish All Drafts AlertDialog):

- Small outline button: "Mark as Baseline"
- Only enabled when `bulkAutoFix.phase === 'idle'` and not currently baselining
- AlertDialog with dynamic confirmation text:
  - If `selectedPostIds.size > 0`: "This will mark **N selected posts** as baseline scanned."
  - Otherwise: "This will mark **all currently unscanned posts** as baseline scanned."
  - Shared: "These posts will be skipped in future smart scans unless their content is manually edited. No article content will be modified."
- On confirm: calls `bulkAutoFix.baselineMarkPosts(selectedPostIds.size > 0 ? [...selectedPostIds] : undefined)`
- Shows toast on completion with count

### 3. No database migration needed
`last_bulk_fix_status` is already a `text` column — `'baseline'` is a valid value.

### 4. Status rendering safety check
All UI status rendering in the dialog uses explicit `r.status === 'xxx'` checks (lines 2511-2516). A `baseline` status will never appear in fix results (it's only written by the baseline action, not by the fix pipeline), so no rendering gaps exist. The summary grid and badge rendering are safe — baseline posts are never processed through the fix pipeline.

## What is NOT changed
- Fix application logic, scan logic, edge functions
- No content modifications during baseline
- `computeSummary` works generically with strings
- Smart scope eligibility unchanged (baseline naturally maps to `skippedUnchanged`)

