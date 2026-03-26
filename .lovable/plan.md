

# Fix: Bulk Action Buttons Disabled After Enrichment

## Problem
All three bulk action functions (`getEligibleDrafts`, `getDraftsNeedingImages`, `getDraftsNeedingFieldFix`) hard-filter for `status === 'draft'`. After the bulk run moved 158 rows to `'enriched'` status, zero rows match, so all buttons are disabled — even though 156 rows still need field fixes and 113 still need images.

## Fix — Single File Change

**File**: `src/components/admin/firecrawl/FirecrawlDraftsManager.tsx`

### 1. `getEligibleDrafts` (line 243)
Change `d.status === 'draft'` to `d.status === 'draft' || d.status === 'enriched'`
- "Bulk Run All" will pick up rows that need re-enrichment regardless of status.

### 2. `getDraftsNeedingImages` (line 397)
Change `d.status === 'draft'` to `d.status === 'draft' || d.status === 'enriched'`
- "Bulk Images" will now find the ~113 enriched rows missing cover images.

### 3. `getDraftsNeedingFieldFix` (line 480)
Change `d.status === 'draft'` to `d.status === 'draft' || d.status === 'enriched'`
- "Bulk Fix Fields" will now find the ~156 enriched rows with missing fields.

## Impact
- Only 3 lines changed in 1 file
- No other pages, ad policy, or business logic affected
- Buttons will immediately show correct counts and become clickable

