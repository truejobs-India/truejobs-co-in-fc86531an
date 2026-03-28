

# Fix: Azure "Reconstruct Notices" Button Disabled After Building Fragments

## Root Cause

The "Reconstruct Notices" button on line 129 of `ReconstructedNoticesTab.tsx` has this disabled condition:

```tsx
disabled={!selectedIssue || selectedIssue.reconstruction_status === 'pending' && notices.length === 0 || !!actionInProgress}
```

Due to JS operator precedence, this evaluates as:
```
!selectedIssue || (reconstruction_status === 'pending' AND notices.length === 0) || actionInProgress
```

After building fragments:
- `reconstruction_status` is still `'pending'` (the build-fragments function never updates it)
- `notices.length` is `0` (no notices exist yet — that's the whole point of clicking Reconstruct)

So condition 2 is always true after building fragments, making the button permanently disabled. The user can never reach the Reconstruct step, which blocks the entire downstream pipeline (Draft Jobs, Publish Log).

## Fix

**File: `src/components/admin/emp-news/azure-based-extraction/ReconstructedNoticesTab.tsx`**

Replace the disabled condition on the Reconstruct Notices button (line 129). The button should be enabled whenever:
- An issue is selected
- OCR is completed or partially completed (meaning fragments can exist)
- No action is in progress

New condition:
```tsx
disabled={!canBuildFragments || !!actionInProgress}
```

This reuses the existing `canBuildFragments` variable (line 47-49) which checks `ocr_status === 'completed' || 'partially_completed'`. Since fragments are a prerequisite for reconstruction, and fragments require OCR completion, this is the correct guard.

## Why Draft Jobs and Publish Log Show No Data

These tabs are working correctly — they show no data because the upstream pipeline is blocked:
- No reconstruction → no reconstructed notices → "Generate AI Drafts" has nothing to process → no draft jobs
- No draft jobs → nothing to publish → no publish logs

Fixing the Reconstruct button unblocks the entire chain.

## Files Changed

| File | Change |
|------|--------|
| `src/components/admin/emp-news/azure-based-extraction/ReconstructedNoticesTab.tsx` | Fix disabled condition on Reconstruct Notices button (line 129) |

## Regression Checklist
1. Build Fragments button still correctly requires OCR completion
2. Reconstruct Notices button enabled after OCR + fragments built
3. Reconstruct Notices button disabled when no issue selected
4. Reconstruct Notices button disabled during active action
5. Downstream tabs (Draft Jobs, Publish Log) populate after reconstruction completes

