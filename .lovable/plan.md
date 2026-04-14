

# Add Progress Indicator + Stop Button to SEO Cache "Rebuild All"

## Problem
The "Rebuild All" and "Force Rebuild" buttons only show a tiny monospace text like `Batch 3/120 (10/600 pages)...` in the header. There's no progress bar, no running counts of rebuilt/skipped/failed, and no way to stop the process.

## Solution

**File: `src/components/admin/seo-cache/SEOCacheManager.tsx`**

1. **Add state**: `rebuildStats` to track `{ rebuilt, skipped, failed, total, current }` and a `stopRebuildRef` (`useRef<boolean>`) for graceful stopping.

2. **Update `handleRebuildAll`**: At each batch iteration, update `rebuildStats` with running totals. Check `stopRebuildRef.current` at top of loop — if true, break and show "Stopped" toast.

3. **Add a progress panel** below the header buttons (visible only when `isRebuilding`):
   - Progress bar showing `current / total` pages
   - Current batch info
   - Running counts: `✅ N rebuilt · ⏭ N skipped · ❌ N failed`
   - A red **"Stop"** button to gracefully halt

4. **Update button labels** to show progress count (e.g., `Rebuilding 15/600...`).

### UI During Rebuild
```text
┌──────────────────────────────────────────────────┐
│ ⟳ Rebuilding 15/600…                    [Stop]  │
│ ██████░░░░░░░░░░░░░░░░░░░░░░  (2.5%)            │
│ Batch 3/120 • 5 slugs per batch                  │
│ ✅ 10 rebuilt · ⏭ 3 skipped · ❌ 2 failed        │
└──────────────────────────────────────────────────┘
```

### File changed
- `src/components/admin/seo-cache/SEOCacheManager.tsx`

