

# Smart Scope Eligibility Fix

## Problem
`isEligibleForSmartScope` (lines 165-196) checks "changed" before "failed", misclassifying failed posts. No timestamp buffer causes trigger-induced false "changed" signals.

## Corrections Applied

1. **unchanged vs excluded kept separate** — `already_fixed_unchanged` = evaluated, safe to skip; `excluded` = bad data/unknown status. Never merged.
2. **"skipped" BulkFixStatus** — confirmed never actually stamped as `last_bulk_fix_status` anywhere in the codebase. Falls into catch-all Rule 6 → `excluded`. This is correct.
3. **Preview == Execution** — `scanReport.fixableItems` (used by `executeAutoFix` at line 396) is built from the same scan loop. No structural divergence; the fix just ensures excluded/unchanged posts stay out of `postsToScan`.

---

## File 1: `src/hooks/useBulkAutoFix.ts`

### A. Replace `isEligibleForSmartScope` (lines 165-196)

Returns `{ eligible: boolean; reason: 'never_fixed' | 'fix_failed' | 'changed_since_fix' | 'already_fixed_unchanged' | 'excluded' }`:

```text
Rule 1: last_bulk_scanned_at IS NULL           → eligible, "never_fixed"
Rule 2: status = "failed"                      → eligible, "fix_failed"
Rule 3: status = "partially_fixed" & remaining>0 → eligible, "fix_failed"
Rule 4: status = "no_action_taken" & remaining>0 → eligible, "fix_failed"
Rule 5: status = "fixed" OR "baseline":
  ref = last_bulk_fixed_at ?? last_bulk_scanned_at
  ref is null        → eligible, "never_fixed"
  updated_at invalid → NOT eligible, "excluded"
  ref invalid        → NOT eligible, "excluded"
  updated_at > ref + 120s → eligible, "changed_since_fix"
  else               → NOT eligible, "already_fixed_unchanged"
Rule 6: any other status → NOT eligible, "excluded"
```

No in-progress statuses exist in `BulkFixStatus`, so no in_progress rule.

### B. Add debug flag

`const SMART_SCOPE_DEBUG = false;` — when true, `console.debug` per post with all fields and decision.

### C. Update `ScanStateBreakdown` interface (lines 70-78)

Keep `partial` and `noActionTaken` at 0 for compat. Replace `skippedUnchanged` with two separate keys:
- `unchanged: number` — count of `already_fixed_unchanged`
- `excluded: number` — count of `excluded`

### D. Update breakdown counting (lines 282-295)

Map reasons: `neverBulkFixed` ← never_fixed, `failed` ← fix_failed, `changed` ← changed_since_fix, `unchanged` ← already_fixed_unchanged, `excluded` ← excluded.

### E. Populate `eligibilityReason` on ScanItem (line 364 area)

Set from eligibility reason for included posts.

---

## File 2: `src/components/admin/BlogPostEditor.tsx`

### A. Update breakdown grid (lines 2471-2479)

5 main columns: Never Fixed, Changed, Failed, Unchanged, Clean. Show excluded as a small muted footnote when > 0 (e.g., "2 excluded due to incomplete data").

### B. Add eligibility badge after article title (line 2508)

- `never_fixed` → blue Badge "Never fixed"
- `fix_failed` → destructive Badge "Failed"
- `changed_since_fix` → amber Badge "Changed after fix"

### C. Update unchanged/excluded messages (lines 2537-2540)

Use `unchanged` counter. If `excluded > 0`, show separate small note.

---

## What stays the same
- No DB changes
- Execution logic, stamping, compliance unchanged
- `isEligibleForFailedPartialScope` unchanged
- `fixableItems` drives both preview and execution

