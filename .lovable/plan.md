

# Implementation Plan: Fix PDF Resources Manager Flickering

## Changes Overview

Two files changed. No logic changes, only structural stabilization.

---

## File 1: `src/contexts/AdminMessagesContext.tsx`

**Split into two contexts** to decouple write-only consumers from state changes:

1. Create `AdminMessagesActionsContext` holding only the 4 stable callbacks (`addMessage`, `dismissMessage`, `clearAll`, `toggleExpand`)
2. Keep `AdminMessagesContext` holding only `messages`
3. `AdminMessagesProvider` provides both contexts, each with a `useMemo`-wrapped value
4. `useAdminMessagesContext()` reads from both contexts and returns the combined shape (backward-compatible)
5. `useAdminToast()` subscribes to **actions context only** — no longer re-renders when `messages` changes

This eliminates unnecessary re-renders for all 50+ write-only toast consumers.

---

## File 2: `src/components/admin/PdfResourcesManager.tsx`

### A. Extract `SeoIndicator` to module scope (lines 1027-1049)

Move the component definition to after `needsCoverImage` (around line 165), outside the `PdfResourcesManager` function body. This gives it a stable identity — React will update existing instances in-place instead of unmount/remount.

Add a comment explaining why it must stay at module scope.

### B. Remove per-row `TooltipProvider` wrappers

Three locations wrap tooltips in redundant `<TooltipProvider>`:
- Line 1032 (inside `SeoIndicator`)
- Lines 1317-1330 (AI Fix metadata button)
- Lines 1334-1347 (AI Generate image button)

Remove all three. The app-level `<TooltipProvider>` in `App.tsx` (line 118) already covers the entire tree. Replace with bare `<Tooltip>` usage.

### C. Use shared `calcLiveWordCount` in edit dialog (line 1551)

Replace the inline regex `content.replace(/<[^>]*>/g, '').split(/\s+/).filter(Boolean).length` with `calcLiveWordCount(content)` from `@/lib/blogWordCount`. Import already exists or will be added.

---

## What This Does NOT Change

- No table key changes (already stable UUIDs)
- No data fetching logic changes (already correctly scoped)
- No effect dependency changes (already correct)
- No unrelated component rewrites

## Expected Outcome

- `SeoIndicator` has stable identity → no DOM destruction/recreation on parent re-render
- Toast messages from sibling admin components no longer trigger `PdfResourcesManager` re-render
- 3 fewer `TooltipProvider` subtrees per table row per render cycle
- Visible flicker eliminated

