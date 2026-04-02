

# Bulk Auto-Fix with Change-Aware Eligibility — Final Revised

## Correction Applied

Split status semantics to avoid conflating technical failures with zero-fix outcomes:

- **fixed** = fixes applied, `remaining_auto_fixable_count = 0`
- **partially_fixed** = fixes applied, `remaining_auto_fixable_count > 0`
- **skipped** = scanned successfully, zero auto-fixable issues found
- **failed** = technical/process failure only (edge function error, timeout, DB write error)
- **no_action_taken** = scanned successfully, auto-fixable issues identified, but zero fixes were safely applied

## Database Migration

```sql
ALTER TABLE public.blog_posts
  ADD COLUMN IF NOT EXISTS last_bulk_scanned_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS last_bulk_fixed_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS last_bulk_fix_status text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS remaining_auto_fixable_count integer DEFAULT NULL;
```

`last_bulk_fix_status` values: `'fixed'`, `'partially_fixed'`, `'failed'`, `'skipped'`, `'no_action_taken'`, or `NULL`.

## Files Changed

| File | Change |
|------|--------|
| Migration | Add 4 columns to `blog_posts` |
| `src/hooks/useBulkAutoFix.ts` | Accept scope param, change-aware filtering, post-fix re-evaluation, correct stamping with 5-status model |
| `src/components/admin/BlogPostEditor.tsx` | Scope selector dropdown, Force Full Rescan button, state-breakdown counts |

## Hook Changes (`useBulkAutoFix.ts`)

### Types

```typescript
export type BulkScanScope = 'smart' | 'all' | 'failed_partial' | 'selected';
export type BulkFixStatus = 'fixed' | 'partially_fixed' | 'skipped' | 'failed' | 'no_action_taken';

export interface ScanStateBreakdown {
  neverBulkFixed: number;
  changed: number;
  failed: number;
  partial: number;
  noActionTaken: number;
  skippedUnchanged: number;
  alreadyClean: number;
}
```

### Smart Scope Eligibility (default)

A post is eligible when ANY of:
- `last_bulk_scanned_at IS NULL` → **Never Bulk-Fixed**
- `updated_at > last_bulk_scanned_at` → **Changed**
- `last_bulk_fix_status = 'failed'` → **Failed** (technical failure, always retry)
- `last_bulk_fix_status = 'no_action_taken'` → **No Action Taken** (issues exist but weren't applied — retry after content change only, so gated by `updated_at > last_bulk_scanned_at`)
- `last_bulk_fix_status = 'partially_fixed' AND remaining_auto_fixable_count > 0` → **Partial**

All others → **Skipped Unchanged**.

Note: `no_action_taken` posts are only re-eligible if `updated_at > last_bulk_scanned_at` (content changed since last attempt). Without content change, retrying the same unfixable issues is wasteful.

### Post-Fix Stamping Logic

```text
After processing each article:
  Re-run compliance analysis on updated content
  Count remaining auto-fixable issues

  IF technical error occurred:
    status = 'failed'
    last_bulk_scanned_at = now()
    // last_bulk_fixed_at NOT updated
    remaining_auto_fixable_count = NULL

  ELSE IF fixesApplied > 0 AND remainingAutoFixable === 0:
    status = 'fixed'
    last_bulk_fixed_at = now()
    last_bulk_scanned_at = now()
    remaining_auto_fixable_count = 0

  ELSE IF fixesApplied > 0 AND remainingAutoFixable > 0:
    status = 'partially_fixed'
    last_bulk_scanned_at = now()
    // last_bulk_fixed_at NOT updated
    remaining_auto_fixable_count = remainingAutoFixable

  ELSE IF fixesApplied === 0 AND autoFixableFound > 0:
    status = 'no_action_taken'
    last_bulk_scanned_at = now()
    // last_bulk_fixed_at NOT updated
    remaining_auto_fixable_count = autoFixableFound

  ELSE IF fixesApplied === 0 AND autoFixableFound === 0:
    status = 'skipped'
    last_bulk_scanned_at = now()
    remaining_auto_fixable_count = 0
```

### Failed/Partial Scope

Only posts where:
- `last_bulk_fix_status = 'failed'`
- OR `last_bulk_fix_status = 'partially_fixed' AND remaining_auto_fixable_count > 0`
- OR `last_bulk_fix_status = 'no_action_taken' AND remaining_auto_fixable_count > 0`

### Change-Awareness for Manual Edits

Automatic — `updated_at` is bumped by the existing DB trigger. Since smart scope checks `updated_at > last_bulk_scanned_at`, the article becomes eligible again.

## UI Changes (`BlogPostEditor.tsx`)

### Scope Selector

```text
Scope: [Never Fixed / Changed / Failed / Partial ▼]
Options:
  - Never Fixed / Changed / Failed / Partial (default)
  - All Articles
  - Failed / Partial Only
  - Selected Only (N)
```

### Force Full Rescan

Small outline button: "Force Full Rescan" → calls `scanAll('all')`.

### State Breakdown in Scan Summary

```text
| Never Bulk-Fixed | Changed | Failed | Partial | No Action | Unchanged | Clean |
|       12         |    8    |    3   |    2    |     5     |    411    |   31  |
```

"Auto-Fixable: 30" shown as the action button label.

## What Is NOT Changed

- Fix application logic (apply_field, append_content, etc.)
- `AUTO_FIXABLE_CHECK_KEYS` set
- `analyze-blog-compliance-fixes` edge function
- Single-article compliance flow

