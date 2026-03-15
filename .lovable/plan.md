

# Implementation Plan: "Publish All Fixed and Enriched" Bulk Workflow

## Summary

Extend the existing bulk workflow system with a `'publish'` workflow type using two-stage verification, 6 classification buckets, and re-verification before each publish.

## 1. Database Migration

Drop and re-add the `workflow_type` CHECK constraint to include `'publish'`:

```sql
ALTER TABLE public.blog_bulk_workflow_sessions
  DROP CONSTRAINT blog_bulk_workflow_sessions_workflow_type_check;
ALTER TABLE public.blog_bulk_workflow_sessions
  ADD CONSTRAINT blog_bulk_workflow_sessions_workflow_type_check
  CHECK (workflow_type IN ('fix', 'enrich', 'publish'));
```

## 2. Hook: `src/hooks/useBulkBlogWorkflow.ts`

### Type changes
- `WorkflowType` becomes `'fix' | 'enrich' | 'publish'`
- New `PublishVerdict` extending `ArticleVerdict` with `publish_checks: { verified_fixed, verified_enriched, publish_requirements_passed, publish_confidence }`
- New publish-specific report categories: `ready_to_publish`, `not_ready_missing_fixes`, `not_ready_missing_enrichment`, `not_ready_publish_requirements`, `manual_review`, `already_published`, `deferred_by_cap`

### `startScan` — publish branch

**Stage 1 (deterministic, all unpublished posts):**

For each post:
1. Already published → `already_published`
2. **Hard blockers** (title, slug, content missing; wordCount < 100) → `not_ready_publish_requirements`
   - `canonical_url` and `author_name` are NOT hard blockers since `author_name` defaults to 'TrueJobs Editorial Team' and canonical can be auto-derived. These become soft warnings.
3. **Verified fixed**: Run `analyzePublishCompliance(blogPostToMetadata(post))`:
   - Any CRITICAL_BLOCK_KEYS fail (except `missing-canonical` and `missing-author` which are soft) → `not_ready_missing_fixes`
   - `compliance.failCount >= 2` (excluding canonical/author fails) → `not_ready_missing_fixes`
   - Quality < 55 OR SEO < 55 → `not_ready_missing_fixes`
4. **Verified enriched (structural)**:
   - wordCount < 400 → `not_ready_missing_enrichment`
   - No intro AND no conclusion → `not_ready_missing_enrichment`
   - Zero H2 headings → `not_ready_missing_enrichment`
5. **Soft warnings** (tracked, not blocking): missing cover_image, missing excerpt, missing meta_title, missing meta_description, missing canonical, missing featured_image_alt
6. **Borderline gate** — passes hard checks but has:
   - Quality 55-74 or SEO 55-74
   - warnCount >= 3
   - wordCount < 800
   - 1 non-critical compliance fail
   - `ai_fixed_at` is null with borderline scores
   → Route to **Stage 2**
7. Clear passes (quality >= 75, SEO >= 75, wordCount >= 800, 0 relevant compliance fails, <= 2 warns) → `ready_to_publish` (confidence 0.95)

**Stage 2 (AI verification for borderline candidates):**

Send to `classify-blog-articles` edge function with `workflow_type: 'publish'`. AI evaluates whether content is meaningfully complete and useful for publication.

**Critical rule**: Stage 2 AI can only UPGRADE borderline candidates to `ready_to_publish` or route to `manual_review`. It can NEVER override Stage 1 hard failures. Posts that failed Stage 1 deterministic checks are never sent to Stage 2.

AI returns `publish_ready` (confidence >= 0.7) → `ready_to_publish`, or `not_ready` → appropriate bucket, or confidence < 0.7 → `manual_review`.

Apply `max_per_run` cap; excess → `deferred_by_cap`.

### `confirmPublish` execution

For each article in `ready_to_publish` (up to cap):
1. Check `stop_requested`
2. **Re-verify**: Re-fetch post from DB, re-run full publish eligibility check (compliance analysis, structural checks, hard blockers) — not just "is it still unpublished". If fails → skip with "Failed re-verification: [reason]"
3. `UPDATE blog_posts SET is_published = true, status = 'published', published_at = now()`
4. Append result to `execution_results` (append-safe pattern)
5. Update heartbeat + progress
6. 1s delay between articles

### Re-verification function

Extract a reusable `checkPublishEligibility(post)` function that returns `{ eligible: boolean, reasons: string[] }`. Used in both scan Stage 1 and pre-publish re-verification. Runs:
- Hard blocker check (title, slug, content, thin)
- Compliance analysis (fail check excluding canonical/author)
- Quality/SEO score check (>= 55)
- Structural enrichment check (wordCount >= 400, has structure)

## 3. Edge Function: `classify-blog-articles/index.ts`

- Accept `'publish'` in `workflow_type` (line 89: add to union)
- Add `buildPublishClassificationPrompt()` that instructs AI to evaluate:
  - Is content meaningfully complete for a live published article?
  - Does it provide genuine value, not just AI padding/fluff?
  - Is it safe and appropriate for publication?
  - Return `publish_ready` or `not_ready` with reasons
- In post-processing: map `publish_ready` verdict to `needs_action` with `action_type: 'skip'` (publish doesn't need content changes, just status change)

## 4. UI: `BulkWorkflowPanel.tsx`

### Idle state
Add third button alongside Fix/Enrich:
```
<Upload /> Publish All Fixed & Enriched
```

### Publish report view
When `scanReport.workflow_type === 'publish'`, render `PublishReportView`:
- Summary banner: 6 stat cards (Ready to Publish / Already Published / Missing Fixes / Missing Enrichment / Publish Req Missing / Manual Review / Deferred)
- Category rows with expandable per-article details
- Each excluded article shows specific reasons
- Confirm button: "Publish N Ready Articles" (disabled if 0)
- Note: "Each article will be re-verified before publishing"

### Executing/completed
Reuse existing progress bar, stop button, and ExecutionResultsView.

## 5. Key Design Decisions

**Stage 2 never overrides hard failures**: Posts failing deterministic checks in Stage 1 are classified immediately and never sent to Stage 2. AI can only evaluate borderline candidates that passed all hard gates.

**Canonical and author are soft warnings**: `author_name` defaults to 'TrueJobs Editorial Team' (always present). `canonical_url` can be auto-derived from slug. Neither blocks publishing — consistent with the existing `togglePublish` function which has no such check.

**Re-verification is substantive**: Before each publish, the system re-runs `checkPublishEligibility()` which includes compliance analysis, not just an unpublished status check.

**Under-publish bias**: Borderline posts go to Stage 2 or manual_review. Confidence < 0.7 → manual_review. Any uncertainty → don't bulk publish.

## Files Changed

| Action | File |
|--------|------|
| MIGRATE | Add `'publish'` to `workflow_type` CHECK constraint |
| MODIFY | `src/hooks/useBulkBlogWorkflow.ts` — publish scan, confirmPublish, checkPublishEligibility |
| MODIFY | `src/components/admin/blog/BulkWorkflowPanel.tsx` — publish button + PublishReportView |
| MODIFY | `supabase/functions/classify-blog-articles/index.ts` — publish workflow_type + prompt |

