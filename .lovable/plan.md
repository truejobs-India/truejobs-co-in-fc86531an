

# Bulk Fix All by AI — Full Auto-Fix Pipeline Implementation

## Summary

Replace the current manual-review-dependent bulk fix with a fully autonomous 2-step pipeline: Scan → Auto-Fix. No "review required" state. Every fix ends as fixed, skipped (with reason), or failed.

## Architecture

4 files changed:
1. **`src/lib/blogFixUtils.ts`** (NEW) — shared deterministic helpers extracted from BlogAITools.tsx
2. **`src/hooks/useBulkAutoFix.ts`** (NEW) — pipeline hook with scan + execute logic
3. **`src/components/admin/BlogPostEditor.tsx`** (MODIFIED) — replace old bulk fix state/handlers/dialog with new hook + improved UI
4. **`src/components/admin/blog/BlogAITools.tsx`** (MODIFIED) — import shared helpers from blogFixUtils.ts instead of defining inline

## File 1: `src/lib/blogFixUtils.ts`

Extracts these functions from BlogAITools.tsx for shared use:
- `trackBlogToolEvent`, `logBlogAiAudit` — telemetry/audit (fire-and-forget)
- `normalizeApplyMode` — legacy mode mapping
- `shouldAutoOverwriteField` — overwrite decision with concrete rules
- `validateFieldValue` — length/format validation per field
- `isValidCanonicalUrl` — strict TrueJobs canonical check
- `hasExistingIntro`, `hasExistingConclusion`, `hasFaqHeading`, `hasRelatedResourcesBlock` — duplication guards
- `contentBlockAlreadyExists`, `linkAlreadyInContent` — content dedup
- `sanitizeLinkBlockHtml`, `buildCleanLinkBlock` — safe link block construction
- `validateFaqSchema` — FAQ array validation
- Constants: `EDITABLE_FIELDS`, `VALID_FIX_TYPES`, `VALID_APPLY_MODES`, `MAX_AUTO_LINKS`

Additionally adds bulk-specific helpers:
- `insertBeforeFirstHeadingRaw(content: string, html: string): string` — string-based (no TipTap)
- `isPlaceholderOrGeneric(field, value)` — checks for placeholder-like values (e.g., "image", "photo", meta_title === title)

### Concrete overwrite rules (v1 — conservative)

| Field | Overwrite if empty | Overwrite if bad | Bad criteria | Keep if |
|---|---|---|---|---|
| meta_title | Yes | Yes | < 15 chars OR > 60 chars OR identical to `title` | 15-60 chars and distinct from title |
| meta_description | Yes | Yes | < 50 chars OR > 155 chars | 50-155 chars |
| excerpt | Yes | Yes | < 20 chars OR > 320 chars | 20-320 chars |
| featured_image_alt | Yes | Yes | < 5 chars OR generic word | ≥ 5 chars and not generic |
| canonical_url | Yes | Yes | Fails isValidCanonicalUrl() | Already valid |
| slug | Only if empty | Only if malformed | Uppercase, double hyphens, non-alphanum-hyphen | Published OR valid format |
| author_name | Only if empty | Never | — | Any existing value |

## File 2: `src/hooks/useBulkAutoFix.ts`

### Types

```typescript
type BulkAutoFixPhase = 'idle' | 'scanning' | 'scanned' | 'fixing' | 'done';

type ScanClassification = 'clean' | 'fixable' | 'skipped';

type ScanItem = {
  postId: string; slug: string; title: string;
  classification: ScanClassification;
  failCount: number; warnCount: number;
  issuesByType: Record<string, number>;
  skipReason?: string;
};

type FixApplied = { field: string; fixType: string; beforeValue: string; afterValue: string };
type FixSkipped = { field: string; fixType: string; reason: string };

type ArticleResult = {
  postId: string; slug: string; title: string;
  status: 'fixed' | 'partially_fixed' | 'skipped' | 'failed' | 'stopped';
  issuesFound: number;
  fixesApplied: FixApplied[];
  fixesSkipped: FixSkipped[];
  error?: string;
};
```

### Scan logic

- Accepts either selected posts or all posts
- For each post: run `analyzePublishCompliance(blogPostToMetadata(post))`
- Classify: `clean` (0 fail+warn), `fixable` (has fail/warn), `skipped` (no title or no content)
- Count issues by type for summary badges
- Auto-select only `fixable` articles

### Fix logic (per article, sequential, 3s throttle)

1. Call `analyze-blog-compliance-fixes` edge function (same as current)
2. Process each returned fix:

**Allowed apply modes:**
- `apply_field` — metadata via `shouldAutoOverwriteField` + `validateFieldValue`
- `append_content` — FAQ, conclusion, internal links (with guards)
- `insert_before_first_heading` — intro/H1 (with guards)

**Forbidden apply modes (skipped with reason):**
- `replace_section` — "Section replacement not safe in bulk mode"
- `review_replacement` — "Requires manual review"
- `advisory` — "Advisory only"
- `prepend_content` — "Prepend not supported in bulk mode"

**Content fixes (DB-direct, no TipTap):**
- FAQ: guard with `hasFaqHeading`, sanitize, append to content + write `faq_schema`/`has_faq_schema`/`faq_count`
- Conclusion: guard with `hasExistingConclusion`, sanitize, append
- Internal links: guard with `hasRelatedResourcesBlock`, validate each link via `isValidInternalPagePath`, build clean block via `buildCleanLinkBlock`, append
- Intro/H1: guard with `hasExistingIntro`, use `insertBeforeFirstHeadingRaw`

All content blocks: reject if empty/near-empty (< 20 chars stripped), reject duplicates, sanitize via `sanitizeLinkBlockHtml`

3. Single DB `.update()` per article (metadata + modified content + word_count + reading_time)
4. Audit: `logBlogAiAudit` per applied fix, `trackBlogToolEvent` per article
5. `ai_fixed_at` stamped ONLY when ≥1 fix applied

**Slug protection:** If `post.is_published === true`, skip slug rewrite with reason "Published slug — no redirect support"

**Result classification:**
- `fixed` — fixesApplied > 0 AND fixesSkipped === 0
- `partially_fixed` — fixesApplied > 0 AND fixesSkipped > 0
- `skipped` — fixesApplied === 0
- `failed` — error during processing

**Stop:** Finish current article, mark remaining as `{ status: 'stopped' }`

## File 3: `src/components/admin/BlogPostEditor.tsx`

### Remove
- Old types: `BulkFixPhase`, `BulkFixScanItem`, `BulkFixResultItem` (lines 207-209)
- Old state: `bulkFixPhase`, `bulkFixScanResults`, `bulkFixResults`, `bulkFixProgress`, `bulkFixAbortRef`, `showBulkFixDialog` (lines 210-215)
- Old handlers: `handleBulkFixScan` (lines 1148-1178), `handleBulkFixExecute` (lines 1180-1265)
- Old dialog (lines 2389-2491)

### Add
- Import `useBulkAutoFix` hook
- Wire button to `scan(selectedPosts)` or `scan(allPosts)` when none selected
- New dialog with phases:
  - **Scanning**: spinner
  - **Scanned**: Summary cards (Total/Clean/Fixable/Skipped) + issue type badges + "Auto-Fix N Articles" button
  - **Fixing**: Progress bar + live results + Stop button
  - **Done**: Full summary (fixed/partial/skipped/failed counts) + field-level breakdown + per-article expandable rows with applied fixes and skip reasons

### Button behavior change
- Label remains "Bulk Fix All by AI" or "Scan & Auto-Fix"
- If selected > 0: scan those; else: scan all posts
- No "review required" badge anywhere

## File 4: `src/components/admin/blog/BlogAITools.tsx`

- Replace inline definitions of shared functions with imports from `@/lib/blogFixUtils`
- No behavioral change to single-article flow
- Functions moved: `normalizeApplyMode`, `shouldAutoOverwriteField`, `validateFieldValue`, `isValidCanonicalUrl`, `hasExistingIntro`, `hasExistingConclusion`, `hasFaqHeading`, `hasRelatedResourcesBlock`, `contentBlockAlreadyExists`, `linkAlreadyInContent`, `sanitizeLinkBlockHtml`, `buildCleanLinkBlock`, `validateFaqSchema`, `trackBlogToolEvent`, `logBlogAiAudit`, constants

## Edge Function Verification

The edge function `analyze-blog-compliance-fixes` already returns structured fixes with: `fixType`, `applyMode`, `field`, `suggestedValue`, `confidence`, `explanation`, `issueKey`, `issueLabel`, `faqSchemaEligible`, `faqSchema`. The server-side `normalizeFix()` enforces whitelists. This is sufficient for bulk auto-apply. No edge function changes needed.

The plan will verify real-world output shapes during implementation by logging the first processed article's raw response for inspection.

## Audit Strategy (No Migration)

- Per-field: `blog_ai_audit_log` table (tool_name = 'bulk_auto_fix')
- Per-article: `blog_ai_telemetry` table (event_name = 'bulk_auto_fix_complete')
- `blog_posts.ai_fixed_at` stamped only when ≥1 fix applied

## What Does NOT Change

- Edge function `analyze-blog-compliance-fixes`
- Single-article "Fix All by AI" flow in BlogAITools (still uses TipTap)
- Database schema
- No new tables or columns

