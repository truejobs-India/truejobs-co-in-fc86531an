

# Add Progress Indicator and Stop Button to "Fix All"

## Changes

**File: `src/components/admin/blog/BlogStatsDrilldown.tsx`**

### 1. Add new state
- `fixProgress`: `{ current: number, total: number, currentTitle: string } | null` — tracks which article is being processed
- `stopRequestedRef`: a `useRef<boolean>` — signals graceful stop (ref so the running loop sees it immediately without re-render)

### 2. Update `handleBulkFix` loops
In both the `missing-seo` and `policy-risk`/`needs-review` loops:
- Set `fixProgress` at the start of each iteration with `{ current: i+1, total: articles.length, currentTitle: post.title }`
- Check `stopRequestedRef.current` at the top of each iteration — if true, break out, show a "Stopped" toast, and reset state
- Clear `fixProgress` and `stopRequestedRef` when done

### 3. Add Stop button
Next to the "Fixing…" button, render a red "Stop" button (only visible when `bulkFixing` is true) that sets `stopRequestedRef.current = true`.

### 4. Add progress UI below the action bar
When `bulkFixing && fixProgress`, show:
- Progress bar (`fixProgress.current / fixProgress.total`)
- Current article title being fixed
- Running counts derived from `fixResults` (fixed/failed/skipped)
- Button text changes from "Fixing…" to "Fixing 3/56…"

### UI During Fix
```text
┌──────────────────────────────────────────────────┐
│ ⟳ Fixing 3/56…              [Stop] [Button]     │
│ ████████░░░░░░░░░░░░░░░░░░  (5%)                │
│ Currently: "AP Board Passing Marks..."           │
│ ✅ 2 fixed · ❌ 0 failed · ⏭ 1 skipped          │
└──────────────────────────────────────────────────┘
```

### File changed
- `src/components/admin/blog/BlogStatsDrilldown.tsx`

