

# Final Cleanup & Hardening Pass — Bulk Auto-Fix

## 1. DRY Refactor: BlogAITools.tsx

**File:** `src/components/admin/blog/BlogAITools.tsx`

### Functions to replace with imports from `@/lib/blogFixUtils`

All of these are duplicated verbatim or near-verbatim and can be replaced by imports:

| Function/Constant | Lines (approx) | Notes |
|---|---|---|
| `EDITABLE_FIELDS` | 73 | Identical |
| `APPLY_MODE_LEGACY_MAP` | 76-81 | Identical |
| `normalizeApplyMode` | 83-86 | Identical |
| `VALID_FIX_TYPES` | 89-95 | Identical |
| `VALID_APPLY_MODES` | 96-100 | Identical |
| `trackBlogToolEvent` | 103-111 | Identical |
| `logBlogAiAudit` | 113-126 | Identical |
| `hasExistingIntro` | 143-149 | Identical |
| `hasExistingConclusion` | 151-153 | Identical |
| `contentBlockAlreadyExists` | 160-165 | Identical |
| `hasFaqHeading` | 198-200 | Identical |
| `MAX_AUTO_LINKS` | 203 | Identical |
| `extractHrefsFromHtml` | 205-213 | Identical (already in blogFixUtils) |
| `linkAlreadyInContent` | 215-218 | Identical |
| `hasRelatedResourcesBlock` | 220-222 | Identical |
| `sanitizeLinkBlockHtml` | 224-232 | Minor diff: BlogAITools allows `h3` only, blogFixUtils allows `h2-h4`. The blogFixUtils version is a superset — safe to use. |
| `buildCleanLinkBlock` | 234-237 | Identical |
| `isValidCanonicalUrl` | 240-258 | Identical |
| `validateFieldValue` | 261-291 | Minor diff: blogFixUtils has extra keyword-stuffing + truncation checks. blogFixUtils is strictly better. |
| `shouldAutoOverwriteField` | 294-316 | **Different signature**: BlogAITools has 2 params, blogFixUtils has 3 (with optional `context`). blogFixUtils is a superset — 2-arg calls work fine (context is optional). BUT: blogFixUtils also checks `isPlaceholderOrGeneric` for `featured_image_alt` and context-based dedup for `meta_title`/`excerpt`. These are **improvements**, not behavioral regressions. Safe to adopt. |
| `validateFaqSchema` | 319-326 | Identical |
| `normalizeComplianceFixes` | 168-195 | Identical (already exported from blogFixUtils) |

### Functions that stay in BlogAITools.tsx (not moveable)

| Function | Reason |
|---|---|
| `insertBeforeFirstHeading(editor, html)` | Uses TipTap `Editor` instance — different from the raw string version in blogFixUtils. Single-article flow only. |
| `sentenceAlreadyExists` | Only used in BlogAITools single-article flow. Could be moved but isn't duplicated in blogFixUtils, so leave for now. |
| Status derivation functions (`deriveSeoStatus`, etc.) | UI-specific, not shared logic. |

### Implementation

Replace lines 72-326 in BlogAITools.tsx with a single import block from `@/lib/blogFixUtils`, keeping only `insertBeforeFirstHeading` and `sentenceAlreadyExists` as local functions. Update the one call site of `shouldAutoOverwriteField` at line 691 — it currently passes 2 args; after refactor it will still work since the third `context` param is optional. However, we should **enhance** it by passing context where available (the `formData` has `title` and `meta_description`).

## 2. Post-Save Compliance Recheck

**Decision: Intentionally NOT added.**

Reasons:
- `analyzePublishCompliance` requires a full `ArticleMetadata` object built by `blogPostToMetadata`. After the DB write, we'd need to reconstruct this from the modified in-memory post snapshot — the DB write already happened but `fetchPosts()` hasn't returned yet.
- Running it for every article in a 20+ article batch adds ~50ms per article of synchronous computation, plus complexity to merge partial in-memory state with partial DB state.
- The current result classification (`fixed`/`partially_fixed`/`skipped`/`failed`) is already **honest and deterministic** — it's based on exactly which fixes were applied vs skipped, not on a re-run score.
- Adding a recheck that might disagree with the apply/skip counts would create confusing UX ("3 fixes applied but still showing issues").

The current approach is simpler, faster, and more predictable. A recheck can be added later as a "verify" button in the summary if needed.

## 3. Bulk-Mode Manual-Review Wording Check

**Bulk flow (`useBulkAutoFix.ts` + bulk dialog in `BlogPostEditor.tsx`):** Verified clean. Zero occurrences of "review", "review required", "needs manual review", or "manual review" in the bulk auto-fix hook or bulk dialog.

**Single-article flow:** Contains `reviewRequired` state and "Review Required" UI text. This is correct and expected — the single-article "Fix All by AI" flow (lines 1060-1141, dialog lines 2150-2220) is a separate flow that uses TipTap and is designed for interactive review. Not part of this cleanup scope.

**One item in `blogFixUtils.ts` line 43:** `'review_replacement': 'Requires manual review — not supported in bulk mode'`. This is a **skip reason** (the fix is being skipped, not sent for review). The wording is technically safe since it explains WHY it's skipped, but it could be cleaner. Will change to: `'Not auto-applied in bulk mode — requires editor context'`.

## 4. Files Changed

1. **`src/components/admin/blog/BlogAITools.tsx`** — Remove ~250 lines of duplicated helpers, replace with imports from `@/lib/blogFixUtils`. Keep `insertBeforeFirstHeading` (TipTap-specific) and `sentenceAlreadyExists` local.
2. **`src/lib/blogFixUtils.ts`** — Minor wording fix in `BULK_FORBIDDEN_APPLY_MODES` for `review_replacement`.

No other files changed. `useBulkAutoFix.ts` and `BlogPostEditor.tsx` are untouched.

