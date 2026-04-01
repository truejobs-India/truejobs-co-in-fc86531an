
Root cause confirmed
- Do I know what the issue is? Yes.
- The count “398 fixable” is not a stale DB read now; it is a classification bug.
- In `src/hooks/useBulkAutoFix.ts`, `scanAll()` marks a post as `fixable` if it has **any** `fail` or `warn` from `analyzePublishCompliance(...)`.
- Many warnings/fails are not actually auto-fixable by this bulk tool (for example missing cover image, policy/risk checks, advisory-only checks), so those posts keep getting counted again on every re-scan even after metadata/content fixes were applied.

What I will change

1) Restrict “fixable” to truly bulk-auto-fixable issues
- File: `src/hooks/useBulkAutoFix.ts`
- Add a central `AUTO_FIXABLE_CHECK_KEYS` set (only checks this pipeline can actually apply safely: metadata fields, intro/h1, FAQ, internal links, heading structure related checks, etc.).
- Add helper to split compliance checks into:
  - actionable (bulk-auto-fixable)
  - non-actionable (manual/other tools required)

2) Rework scan classification logic
- File: `src/hooks/useBulkAutoFix.ts`
- In `scanAll()`:
  - Keep `clean` only when no fail/warn exists.
  - Mark `fixable` only when actionable checks exist.
  - Mark `skipped` when issues exist but none are actionable (with clear skip reason like “non-auto-fixable issues only”).
- Build `issueBreakdown` from actionable checks only, so totals reflect what this tool can actually process.

3) Align execute step with scan step
- File: `src/hooks/useBulkAutoFix.ts`
- In `processOneArticle(...)`, filter outgoing issues to only actionable keys before calling `analyze-blog-compliance-fixes`.
- If no actionable checks remain (post changed since scan), return `skipped` immediately instead of invoking AI.

4) Clarify UI wording to avoid future confusion
- File: `src/components/admin/BlogPostEditor.tsx`
- Update dialog labels/text from generic “fixable” to “auto-fixable by this tool” so counts are interpreted correctly.

Why this fixes your exact symptom
- Today, the count restarts near the same number because it includes unresolved non-auto-fixable warnings.
- After this change, the count represents only actionable items this workflow can actually fix, so re-runs won’t keep showing the same inflated number due to unrelated/manual issues.

Verification plan (live)
1. Run “Scan & Auto-Fix by AI (All)” and record:
   - scanned / auto-fixable / skipped.
2. Stop after a few items, run scan again:
   - auto-fixable should reflect only remaining actionable posts (not inflated by non-actionable warnings).
3. Confirm posts with only missing cover/policy warnings are now in `skipped`, not `fixable`.
4. Complete one full run, re-scan:
   - remaining count should be materially lower and stable with actionable-only logic.
