

# Fix "Selected" Scope in Bulk Auto-Fix

## Problem
The "Selected" scope option already exists but has two bugs:
1. **Silent fallback**: If scope is `'selected'` but no posts are selected (user deselected after choosing), `handleBulkFixScan` falls through to `scanAll('selected')` without target posts — which then falls through to smart scope in the hook, scanning unintended articles.
2. **Disappearing option**: The dropdown option is hidden when nothing is selected, but should remain visible (disabled) so the admin knows it exists and sees a clear count.

## Changes

### `src/components/admin/BlogPostEditor.tsx`

1. **Always show "Selected" option in dropdown** (remove the `selectedPostIds.size > 0 &&` conditional wrapper):
   ```
   <SelectItem value="selected" className="text-xs">
     Selected ({selectedPostIds.size})
   </SelectItem>
   ```

2. **Block scan when "Selected" scope has no selection** — add guard in `handleBulkFixScan`:
   ```typescript
   const handleBulkFixScan = () => {
     const scope = bulkScanScope;
     if (scope === 'selected') {
       const selectedPosts = posts.filter(p => selectedPostIds.has(p.id));
       if (selectedPosts.length === 0) {
         toast({ title: 'No articles selected', description: 'Select articles from the table first.', variant: 'destructive' });
         return;
       }
       bulkAutoFix.scanAll('selected', selectedPosts);
     } else {
       bulkAutoFix.scanAll(scope);
     }
   };
   ```

3. **Disable the "Scan & Fix" button** when scope is `'selected'` and nothing is selected, for extra safety:
   ```
   disabled={... || (bulkScanScope === 'selected' && selectedPostIds.size === 0)}
   ```

### `src/hooks/useBulkAutoFix.ts`

No changes needed — the hook already handles `scope === 'selected'` with `targetPosts` correctly at line 247.

## What Is NOT Changed
- Smart, All, Failed/Partial scope behavior unchanged
- Fix application logic unchanged
- Baseline marking unchanged
- No new database changes

