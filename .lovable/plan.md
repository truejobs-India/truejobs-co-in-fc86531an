

# Plan: Fix Enrich Workflow — Production Audit & Fixes

## Root Causes Confirmed

1. **Silent false success** (lines 1258-1266): `executeEnrichForArticle` silently returns when `enrichData?.result` is falsy — caller records `status: 'success'` because no exception was thrown.
2. **No post-enrichment verification**: After saving content, no re-check against enrich-readiness criteria. Weak/empty enrichments are reported as successful.
3. **Generic UI wording**: No workflow-type differentiation in scanning, executing, completion, or report states.
4. **`heuristic_scores` always zeros** (lines 1398-1403): `buildDigest()` hardcodes `quality_score: 0, seo_score: 0` — Stage 2 AI gets wrong data.
5. **Missing metrics recomputation**: `faq_count`, `has_faq_schema`, `excerpt` not updated after enrichment.
6. **`ExecutionResult.status` too narrow**: Only `'success' | 'failed' | 'skipped'` — cannot distinguish enrich outcomes.

## Changes

### File 1: `src/hooks/useBulkBlogWorkflow.ts`

**A. Expand `ExecutionResult` type (lines 84-90)**

Replace `status: 'success' | 'failed' | 'skipped'` with:
```typescript
export type EnrichOutcome = 'fully_enriched' | 'partially_improved' | 'still_pending';
export type ExecutionStatus = EnrichOutcome | 'failed' | 'skipped';

export interface ExecutionResult {
  slug: string;
  title: string;
  status: ExecutionStatus;
  reason: string;
  timestamp: string;
  failing_criteria?: string[]; // which enrich criteria still fail
}
```

**B. Expand `WorkflowProgress` (lines 92-101)**

Add granular counters:
```typescript
export interface WorkflowProgress {
  total: number;
  done: number;
  fully_enriched: number;
  partially_improved: number;
  still_pending: number;
  success: number; // kept for fix/publish compat
  failed: number;
  skipped: number;
  current_article_id: string | null;
  current_title: string;
  max_per_run: number;
  capped_remaining: number;
}
```

**C. Add `workflowType` state (line 304)**

Add `const [workflowType, setWorkflowType] = useState<WorkflowType | null>(null);` and set it in `startScan`. Return it from the hook.

**D. Define enrich-readiness checker**

Add reusable function (near line 145):
```typescript
interface EnrichReadiness {
  passes: boolean;
  failing: string[];
}

function checkEnrichReadiness(post: any): EnrichReadiness {
  const meta = blogPostToMetadata(post);
  const failing: string[] = [];
  if (meta.wordCount < 1200) failing.push(`Word count ${meta.wordCount} < 1200`);
  if (!meta.hasIntro) failing.push('Missing intro');
  if (!meta.hasConclusion) failing.push('Missing conclusion');
  const h2Count = (meta.headings || []).filter(h => h.level === 2).length;
  if (h2Count < 3) failing.push(`Only ${h2Count} H2 headings (need ≥ 3)`);
  if ((meta.faqCount || 0) === 0) failing.push('No FAQs');
  if ((meta.internalLinks?.length || 0) === 0) failing.push('No internal links');
  return { passes: failing.length === 0, failing };
}
```

**E. Fix `executeEnrichForArticle` (lines 1236-1267)**

Replace entire function:
- If `enrichData?.result` is falsy or content < 100 chars → throw error
- After saving new content, recompute ALL metrics: `word_count`, `reading_time`, `faq_count`, `has_faq_schema`, `excerpt`
- Re-run `checkEnrichReadiness()` against the saved content
- Return structured result: `{ outcome: EnrichOutcome, failing_criteria: string[] }`
  - If passes all criteria → `'fully_enriched'`
  - If word count meaningfully increased AND at least some criteria now pass → `'partially_improved'`
  - Otherwise → `'still_pending'`

**F. Fix execution loop for enrich (lines 950-974)**

For enrich workflow, use the structured result from `executeEnrichForArticle`:
- Map outcome to `ExecutionResult.status` using the new explicit statuses
- Include `failing_criteria` in the result
- Track `fully_enriched`, `partially_improved`, `still_pending` in progress counters
- For fix workflow, map success to `status: 'fully_enriched'` (reuse same field, or keep using `success` counter)
- Actually: for fix/publish, continue using `success` counter; for enrich, use the three new counters

**G. Fix `buildDigest` heuristic_scores (lines 1398-1403)**

Compute real scores:
```typescript
const meta = blogPostToMetadata(post as any);
const quality = analyzeQuality(meta);
const seo = analyzeSEO(meta);
const compliance = analyzePublishCompliance(meta);
heuristic_scores: {
  quality_score: quality.totalScore,
  seo_score: seo.totalScore,
  compliance_fail_count: compliance.failCount,
  compliance_warn_count: compliance.warnCount,
}
```

**H. Fix `reset` to also clear `workflowType`**

**I. Update all progress initializations** to include the new counters (`fully_enriched: 0, partially_improved: 0, still_pending: 0`).

### File 2: `src/components/admin/blog/BulkWorkflowPanel.tsx`

**A. Import `workflowType` from hook** — destructure it from `useBulkBlogWorkflow()`.

**B. Workflow-specific UI wording**

- Scanning title: `{workflowType === 'enrich' ? 'Enrichment Scan' : workflowType === 'publish' ? 'Publish Scan' : 'Fix Scan'}`
- Confirm button: `"Confirm & Enrich (N articles)"` / `"Confirm & Fix"` / `"Publish N Ready Articles"`
- Executing label: `"Enriching: ..."` / `"Fixing: ..."` / `"Publishing: ..."`
- Completion toast in `handleConfirm`: workflow-specific message
- Completion summary line: show enrich-specific counters when `workflowType === 'enrich'`

**C. Update `ExecutionResultsView`**

Replace the 3-group view with 5 groups for enrich workflow:
```
- Fully Enriched (green) — pass all enrich criteria
- Partially Improved (yellow) — improved but still failing some criteria
- Still Pending (orange) — still below threshold, with failing_criteria shown
- Failed (red)
- Skipped (gray)
```

For non-enrich workflows, keep existing grouping (map `fully_enriched` → success display).

Each `still_pending` and `partially_improved` result shows the specific `failing_criteria` list so the admin knows exactly what still fails.

**D. Update progress display during execution**

For enrich workflow, show: `{progress.fully_enriched} enriched · {progress.partially_improved} partial · {progress.still_pending} still pending · {progress.failed} failed`

### File 3: `supabase/functions/improve-blog-content/index.ts`

**A. Accept and use `aiModel` from request body (line 80)**

Add `aiModel` to destructured fields. Map known model names to Gemini endpoints:
```typescript
const modelMap: Record<string, string> = {
  'gemini-2.5-flash': 'gemini-2.5-flash',
  'gemini-2.5-pro': 'gemini-2.5-pro',
};
const effectiveModel = modelMap[aiModel] || GEMINI_MODEL;
const effectiveUrl = `https://generativelanguage.googleapis.com/v1beta/models/${effectiveModel}:generateContent`;
```

Use `effectiveUrl` instead of `GEMINI_URL` in the fetch call.

## Files Changed

| File | Changes |
|------|---------|
| `src/hooks/useBulkBlogWorkflow.ts` | Expand ExecutionResult/Progress types, add checkEnrichReadiness, fix executeEnrichForArticle with post-enrichment verification, fix execution loop, fix buildDigest, add workflowType state |
| `src/components/admin/blog/BulkWorkflowPanel.tsx` | Workflow-specific labels throughout, granular enrich result groups with failing_criteria display |
| `supabase/functions/improve-blog-content/index.ts` | Use aiModel parameter |

