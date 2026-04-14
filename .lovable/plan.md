

# Why Rescan Shows the Same Issues After Fix

## What's Actually Happening (Not a Bug)

The previous bulk fix run processed all 2,595 articles and **saved results correctly**:
- **477 fixed** — fully compliant, no remaining issues
- **1,302 partially fixed** — some fixes applied & saved, but issues remain
- **786 no action taken** — AI couldn't fix or articles were non-actionable
- **25 failed** — errors during processing

When you rescan, the system correctly detects the **still-existing issues** in those 1,302 + 786 + 25 articles. The database confirms real remaining problems:
- 406 articles still missing conclusions
- 299 still missing FAQ sections  
- 255 still missing excerpts
- 164 still missing meta descriptions
- 18 still missing H1 tags

The scan's red "2113 Failed" label is **confusing** — it means "2113 articles have fixable issues," not that a previous fix failed. This is the core UX problem.

## Plan

### 1. Fix the misleading "Failed" label in the scan UI
- Rename the red "Failed" column in the scan breakdown to **"Fixable"** or **"Has Issues"** — because it represents articles the scanner found with remaining problems, not articles that previously failed
- Use an orange/amber color instead of red to distinguish from actual errors

### 2. Show previous fix context during rescan
- When rescanning articles that were previously processed, show their `last_bulk_fix_status` as a small badge (e.g., "Previously: partially_fixed") so the user understands these were already attempted
- Add a summary line like: "Of 2113 articles with issues: 1302 were partially fixed before, 786 had no action taken, 25 previously failed"

### 3. Add a "Run Again on Remaining Issues" option
- After a rescan, if most articles were previously processed, show a note explaining that re-running may produce similar results for articles where the AI couldn't generate the needed content (conclusions, FAQs, etc.)
- This manages expectations before the user clicks "Auto-Fix" again

### Technical Details

**File: `src/hooks/useBulkAutoFix.ts`**
- In `scanAll`, when building `ScanItem` objects for fixable articles, also attach `last_bulk_fix_status` from the fetched post data
- Update `ScanReport` type to include a `previouslyProcessed` count

**File: `src/components/admin/blog/BulkAutoFixDialog.tsx`** (or wherever the scan UI renders)
- Change the "Failed" state breakdown label to "Fixable" with amber styling
- Add a contextual summary showing how many of the fixable articles were previously attempted
- Show the previous fix status badge on individual article rows

