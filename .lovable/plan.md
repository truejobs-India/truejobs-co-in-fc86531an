

# Fix: Auto-scope to "selected" at execution time without mutating dropdown

## Root Cause (confirmed)
`handleBulkFixScan` uses `bulkScanScope` (default `'smart'`). When articles are checked but the dropdown is still on `'smart'`, selected articles are ignored and filtered out by smart-eligibility rules → "0 scanned".

## Fix — Single change in `handleBulkFixScan` (line 1209)

**File: `src/components/admin/BlogPostEditor.tsx`**

Replace line 1209:
```typescript
const scope = scopeOverride || bulkScanScope;
```

With:
```typescript
const scope = scopeOverride || (selectedPostIds.size > 0 ? 'selected' : bulkScanScope);
```

This auto-routes to `'selected'` at execution time when rows are checked, without touching the dropdown state. The dropdown remains on whatever the user set — no `useEffect`, no silent mutation.

### Button text hint for visual feedback

Replace the button label on line 2079 from:
```
Scan & Fix
```
To:
```
{selectedPostIds.size > 0 && bulkScanScope !== 'selected' ? `Scan Selected (${selectedPostIds.size})` : 'Scan & Fix'}
```

This gives the user a passive visual cue that selected articles will be used, without changing the dropdown value.

## What this does NOT do
- No `useEffect` to force-set dropdown
- No silent dropdown mutation
- No override when `scopeOverride` is explicitly passed

## Files modified
- `src/components/admin/BlogPostEditor.tsx` — 2 small inline changes

