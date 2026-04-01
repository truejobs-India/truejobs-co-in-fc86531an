

# Make Image Cleanup & Bulk Fix Buttons Always Visible

## Change

In `src/components/admin/BlogPostEditor.tsx`, remove the `{selectedPostIds.size > 0 && (...)}` conditional wrapper around the action buttons div (line 2041). The buttons will always render. When no articles are selected, disable the buttons and show "(0)" count.

### Specific edit (lines 2041-2094):

- Remove the conditional `{selectedPostIds.size > 0 && (` on line 2041 and its closing `)}` on line 2094
- Add `disabled={selectedPostIds.size === 0 || imageCleanupLoading !== null}` to both delete buttons
- Add `disabled={selectedPostIds.size === 0 || bulkFixPhase === 'scanning' || bulkFixPhase === 'fixing'}` to Bulk Fix button
- Keep the "Clear selection" button conditionally visible (only when selection > 0) since it's meaningless otherwise
- Keep the selected count label, showing "0 selected" when none are selected

### Files changed
1. `src/components/admin/BlogPostEditor.tsx` — one small edit region (lines 2041-2094)

