

# Bulk AI Fix: Badge Logic, Outcome Classification, and Failure Reduction

## Root-Cause Analysis

### All Outcome Types in the Current Flow

I traced every exit path in the pipeline. Here is the complete outcome matrix:

```text
┌──────────────────────────────────────────────────────────────────────────────────┐
│ #  │ Outcome                        │ AI Used? │ Evaluated? │ Gets Badge? │ Bug │
├──────────────────────────────────────────────────────────────────────────────────┤
│ A  │ Clean at scan time             │ No       │ Yes (local)│ YES ✅      │     │
│ B  │ Clean at execution re-check    │ No       │ Yes (local)│ NO ❌       │ BUG │
│    │ (was fixable at scan, clean    │          │            │             │     │
│    │  when executed)                │          │            │             │     │
│ C  │ Fixable, fixes applied,        │ Yes      │ Yes        │ YES ✅      │     │
│    │ remaining=0 → "fixed"         │          │            │             │     │
│ D  │ Fixable, fixes applied,        │ Yes      │ Yes        │ YES ✅      │     │
│    │ remaining>0 → "partially_fixed"│         │            │             │     │
│ E  │ Fixable, AI called, ALL fixes  │ Yes      │ Yes        │ NO ❌       │ BUG │
│    │ skipped by guardrails →        │          │            │             │     │
│    │ "no_action_taken"             │          │            │             │     │
│ F  │ Content reverted (too short)   │ Yes      │ Yes        │ NO ❌       │ BUG │
│    │ + metadata skipped → same as E │          │            │             │     │
│ G  │ AI parseError / empty fixes    │ Yes      │ FAILED     │ NO          │ BUG*│
│    │ → "no_action_taken" silently  │          │            │             │     │
│ H  │ AI timeout → "failed"         │ Yes      │ FAILED     │ NO          │ OK  │
│ I  │ AI throws error → "failed"    │ Yes      │ FAILED     │ NO          │ OK  │
│ J  │ Post not found → "failed"     │ No       │ No         │ NO          │ OK  │
│ K  │ Scan-skip: missing title/      │ No       │ No         │ NO          │ OK  │
│    │ content too short             │          │            │             │     │
│ L  │ Scan-skip: manual-only issues  │ No       │ Yes (local)│ NO          │ ?   │
│ M  │ DB update fails → throws      │ Yes      │ Yes        │ NO          │ OK  │
│ N  │ User stopped → "stopped"      │ —        │ —          │ NO          │ OK  │
└──────────────────────────────────────────────────────────────────────────────────┘

* BUG in G: AI returned unusable response but status is "no_action_taken" 
  instead of "failed", so it won't be retried.
```

### Bugs Found

**Bug 1 — Outcome B: Execution-time re-check finds 0 issues → `skipped` without badge**
Lines 561-567 of `processOneArticle`: if the article became clean between scan and execution, it's stamped as `'skipped'` with no `ai_fixed_at`. Should be stamped as `'fixed'` with `ai_fixed_at` since the pipeline confirmed it's compliant.

**Bug 2 — Outcomes E/F: AI called, all fixes skipped → no badge**
Lines 803-813: `ai_fixed_at` only set when `fixesApplied.length > 0`. When AI is called and returns fixes but all are skipped by guardrails (confidence too low, validation failures, already-exists checks), the article is status `'no_action_taken'` with no badge. The AI DID process it. It should get the badge.

**Bug 3 — Outcome G: AI parseError silently becomes `no_action_taken`**
When the edge function returns `parseError: true` with 0 fixes, `processOneArticle` proceeds normally with an empty fixes array → `fixesApplied.length === 0` → `status = 'no_action_taken'`. This is a misclassification — the AI failed to produce usable output. Should be `'failed'` so it retries.

**Bug 4 — No retry for truncated responses**
Edge function returns `truncated: true` but the client ignores this flag entirely. If truncation recovery salvaged partial fixes, the remaining unsalvaged fixes are silently lost. If recovery failed entirely, it falls into Bug 3.

### Failure Causes (from code, not guesswork)

| Cause | Source | Preventable? | Fix |
|---|---|---|---|
| AI timeout | Edge fn line 334 | Partially | Already handled; legitimate |
| AI API error (rate limit, auth) | Edge fn line 341 | No | Legitimate hard failure |
| JSON parse failure | Edge fn lines 379-383 | Yes | Add secondary repair attempt |
| Truncation (maxOutputTokens hit) | Edge fn lines 355-368 | Partially | Recovery exists; mark remaining as failed not no_action |
| Empty AI response | Client line 607 `fixes=[]` | Yes | Detect and mark failed |
| All fixes low-confidence | Client line 635-638 | Yes | Badge anyway (AI processed) |
| All fixes fail validation | Client lines 660-664 | Yes | Badge anyway (AI processed) |
| Content revert (< 100 chars) | Client lines 776-788 | Rare | Badge anyway if metadata fixes exist |
| DB update error | Client line 812 | No | Legitimate |
| Post not found | Client line 406-414 | No | Legitimate |
| Unsupported model string | Edge fn line 326 | Yes | User error; legitimate failure |

### Design Decisions

1. **"AI Fixed" = "Successfully processed by the AI pipeline"** — consistent with single-article flow (line 1188 of BlogPostEditor.tsx).

2. **Outcome B (clean at execution)**: Gets badge. Pipeline confirmed compliance.

3. **Outcomes E/F (AI called, no applicable fixes)**: Gets badge. AI processed and evaluated. The article is fine or has only non-auto-fixable issues.

4. **Outcome G (parseError with 0 fixes)**: Does NOT get badge. Marked `'failed'` for retry.

5. **Outcome L (scan-skip manual-only)**: Does NOT get badge. Never entered the AI processing pipeline. These articles have real issues that just aren't auto-fixable.

6. **Outcome K (scan-skip missing content)**: Does NOT get badge. Not a real article.

## Implementation Plan

### File: `src/hooks/useBulkAutoFix.ts`

**Change 1 — Bug 1 fix: Execution-time re-check stamps "fixed" instead of "skipped" (lines 561-567)**

Replace the early return when `failedChecks.length === 0` to stamp as `'fixed'` with `ai_fixed_at`:

```typescript
if (failedChecks.length === 0) {
  // Article is now clean — stamp as fixed (pipeline confirmed compliance)
  await supabase.from('blog_posts').update({ ai_fixed_at: new Date().toISOString() }).eq('id', post.id);
  await stampBulkFixStatus(post.id, 'fixed', 0);
  return {
    postId: post.id, slug: post.slug, title: post.title,
    status: 'fixed', issuesFound: 0, fixesApplied: [], fixesSkipped: [],
  };
}
```

**Change 2 — Bug 3 fix: Detect parseError/empty AI response (after line 606, before the fixes loop)**

After `const fixes: any[] = ...` on line 607, add detection for AI failure signals:

```typescript
const fixes: any[] = Array.isArray(data?.fixes) ? data.fixes : [];

// Detect AI response failure: parseError means AI returned unusable output
if (data?.parseError && fixes.length === 0) {
  console.warn(`[BULK_AUTO_FIX] AI parseError for "${post.slug}" — marking failed for retry`);
  await stampBulkFixStatus(post.id, 'failed', failedChecks.length);
  return {
    postId: post.id, slug: post.slug, title: post.title,
    status: 'failed', issuesFound: failedChecks.length, fixesApplied: [], fixesSkipped: [],
    error: 'AI returned unparseable response — will retry next run',
  };
}
```

**Change 3 — Bug 2 fix: Always stamp `ai_fixed_at` when AI was called (lines 803-813)**

Replace the conditional `ai_fixed_at` block. Since by this point the AI was successfully called and the article was processed, always stamp:

```typescript
// Always stamp ai_fixed_at — article completed AI processing successfully
updatePayload.ai_fixed_at = new Date().toISOString();

const { error: updateError } = await supabase
  .from('blog_posts')
  .update(updatePayload)
  .eq('id', post.id);
if (updateError) throw new Error(`DB update failed: ${updateError.message}`);
```

**Change 4 — Log truncation warnings for visibility (after line 607)**

After the parseError check, add a warning log for truncated responses where partial recovery succeeded:

```typescript
if (data?.truncated && fixes.length > 0) {
  console.warn(`[BULK_AUTO_FIX] Truncated AI response for "${post.slug}" — ${fixes.length} fixes salvaged via recovery`);
}
```

### File: `supabase/functions/analyze-blog-compliance-fixes/index.ts`

**Change 5 — Improved JSON repair for common AI formatting issues (line 347 area)**

After stripping markdown fences, add additional cleanup for common AI response quirks:

```typescript
// Strip markdown fences
raw = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

// Strip leading non-JSON text (some models prepend explanatory text)
const arrayStart = raw.indexOf('[');
if (arrayStart > 0 && arrayStart < 100) {
  raw = raw.substring(arrayStart);
}

// Strip trailing non-JSON text after the closing bracket
const arrayEnd = raw.lastIndexOf(']');
if (arrayEnd > 0 && arrayEnd < raw.length - 1) {
  raw = raw.substring(0, arrayEnd + 1);
}
```

### Summary of Changes

| File | Change | Purpose |
|---|---|---|
| `useBulkAutoFix.ts` line 561-567 | Stamp 'fixed' + `ai_fixed_at` for execution-time clean articles | Bug 1 |
| `useBulkAutoFix.ts` after line 607 | Detect `parseError` + empty fixes → mark 'failed' | Bug 3 |
| `useBulkAutoFix.ts` after line 607 | Log truncation warnings | Observability |
| `useBulkAutoFix.ts` lines 803-813 | Always stamp `ai_fixed_at` after successful AI call | Bug 2 |
| `analyze-blog-compliance-fixes` line 347 | Better JSON cleanup before parsing | Reduce parse failures |

### What Gets the Badge After This Fix

| Outcome | Badge? | Reason |
|---|---|---|
| Clean at scan time | Yes | Pipeline confirmed compliance |
| Clean at execution re-check | Yes (NEW) | Pipeline confirmed compliance |
| Fixes applied | Yes | AI processed and fixed |
| AI called, all fixes skipped | Yes (NEW) | AI processed and evaluated |
| AI parseError, 0 fixes | No | Marked 'failed', retried next run |
| AI timeout | No | Marked 'failed', retried next run |
| AI hard error | No | Marked 'failed' |
| Scan-skip: missing content | No | Never entered pipeline |
| Scan-skip: manual-only | No | Never entered AI pipeline |
| User stopped | No | Not processed |

### Verification Plan

1. Run bulk fix on a small set of articles with known mixed states.
2. Check DB: all articles with status 'fixed', 'partially_fixed', or 'no_action_taken' should have `ai_fixed_at` set.
3. Check DB: articles with status 'failed' should NOT have `ai_fixed_at` set for this run.
4. Verify badge appears in the blog management table for all processed articles.
5. Check edge function logs for any remaining parse failures after the JSON cleanup improvement.
6. Re-run on previously failed articles to confirm retry works and fail count decreases.

