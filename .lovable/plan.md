

# Add Pre-Generation Source Freshness Validation to Edge Function

## Where It Runs

Inside `supabase/functions/generate-blog-article/index.ts`, a new `validateSourceFreshness()` function executes **after** request parsing (line 711) and **before** prompt construction (line 738). This is purely backend — no UI involvement.

```text
Line 711: parse request params
Line 735: wordTarget calc
  ──► NEW: validateSourceFreshness() runs here (after line 735)
  ──► Result stored in `sourceFreshness` variable
  ──► If hedging required, FRESHNESS_CONTEXT block prepended to prompt
Line 738: prompt construction (now freshness-aware)
Line 813: callAI()
```

---

## The Function

### Signature & Return Type

```typescript
interface SourceFreshnessResult {
  warnings: string[];
  riskLevel: 'none' | 'low' | 'medium' | 'high';
  hedgingRequired: boolean;
  reduceFactualSpecificity: boolean;
  blockSafeReady: boolean;
}

function validateSourceFreshness(
  topic: string,
  contentMode: string | undefined,
  pageTemplate: string | undefined,
  targetYear: string | undefined,
  targetExam: string | undefined,
  officialSourceUrl: string | undefined
): SourceFreshnessResult
```

### Checks Performed (all rule-based, no external calls)

1. **Time-sensitive template without source URL** — If `pageTemplate` is one of `['dates', 'admit-card', 'result', 'answer-key', 'application-fee', 'selection-process']` and `officialSourceUrl` is empty → warning + `hedgingRequired = true`

2. **Stale target year** — If `targetYear` is present and is less than the current runtime year → warning: "Target year is in the past" + high risk

3. **Time-sensitive topic keywords without source** — Scan `topic` for time-sensitive tokens (`notification`, `last date`, `application form`, `admit card`, `result date`, `answer key`, `counseling`, `vacancy`, `अधिसूचना`, `आखिरी तारीख`, `प्रवेश पत्र`, `रिजल्ट`) and if found but `officialSourceUrl` is empty → warning + `reduceFactualSpecificity = true`

4. **Exam-specific topic without official source** — If `targetExam` is set (or topic matches known exam names like SSC/UPSC/Railway/IBPS) but no `officialSourceUrl` → medium risk, hedging required for date/vacancy claims

5. **Long-tail mode with weak context** — If `contentMode === 'long_tail_seo'` and the template is time-sensitive but both `officialSourceUrl` and `targetYear` are missing → high risk, `blockSafeReady = true`

6. **Risk level calculation** — `high` if ≥2 warnings or any critical check fires; `medium` if 1 warning; `none` otherwise. `blockSafeReady = true` when riskLevel is `high`.

---

## How It Changes Prompt Behavior

After `validateSourceFreshness()` returns, if `hedgingRequired` or `reduceFactualSpecificity` is true, a `FRESHNESS_CONTEXT` block is built dynamically and **prepended** to the prompt in all three branches (gemini/mistral at line 741, claude at line 752, default at line 775):

```
TODAY'S DATE: {runtime date}
CURRENT YEAR: {runtime year}

FRESHNESS SAFETY (MANDATORY):
- Distinguish CONFIRMED official facts vs EXPECTED/HISTORICAL vs NOT YET ANNOUNCED
- If official notification for current cycle is not confirmed: "official notification is awaited"
- NEVER fabricate: application windows, exam dates, result dates, vacancy counts, cutoff marks
- For trend-based info, prefix with "as per previous year trends" / "पिछले वर्ष के अनुसार"
- ALL years must be consistent with the title year
- When mentioning previous-cycle data, explicitly label it as previous cycle
```

If `reduceFactualSpecificity` is also true, an additional block is appended:

```
REDUCED SPECIFICITY MODE: Source context for this topic is weak.
Do NOT include specific dates, vacancy numbers, or deadlines unless the topic text itself provides them.
Use "awaited" / "not yet announced" / "based on previous trends" for all time-sensitive claims.
```

If neither flag is set (clean source context), no freshness block is injected — prompts remain unchanged for safe topics.

---

## How It Affects the Response

The `sourceFreshness` result is included in the response JSON alongside existing fields:

```typescript
return new Response(JSON.stringify({
  // ... existing fields (title, slug, content, etc.) ...
  sourceFreshnessValidation: {
    warnings: sourceFreshness.warnings,
    riskLevel: sourceFreshness.riskLevel,
    hedgingInjected: sourceFreshness.hedgingRequired,
    reducedSpecificity: sourceFreshness.reduceFactualSpecificity,
    blockSafeReady: sourceFreshness.blockSafeReady,
  },
}));
```

The client (both `LongTailSeoPanel.tsx` and `BlogPostEditor.tsx`) can then use `blockSafeReady` to prevent auto-publishing of high-risk drafts. This is authoritative — the backend has already determined the risk level.

---

## Diagnostic Logging

A structured log is emitted immediately after validation runs:

```typescript
console.log(JSON.stringify({
  tag: '[SOURCE_FRESHNESS]',
  model: useModel,
  contentMode: contentMode || 'article',
  pageTemplate: pageTemplate || null,
  targetYear: targetYear || null,
  targetExam: targetExam || null,
  hasOfficialSource: !!officialSourceUrl,
  warnings: sourceFreshness.warnings,
  riskLevel: sourceFreshness.riskLevel,
  hedgingInjected: sourceFreshness.hedgingRequired,
  reducedSpecificity: sourceFreshness.reduceFactualSpecificity,
  blockSafeReady: sourceFreshness.blockSafeReady,
  topicPreview: topic.substring(0, 80),
}));
```

---

## Client-Side Integration (minimal)

### `LongTailSeoPanel.tsx` (~10 lines)
After receiving response, read `data.sourceFreshnessValidation`:
- If `blockSafeReady === true` → set `review_status = 'freshness_blocked'` and `noindex = true` on insert
- Store validation data in `long_tail_metadata.sourceFreshness`

### `BlogPostEditor.tsx` (~10 lines)
Same pattern for bulk article results — read backend validation, auto-block if high risk.

---

## Files Changed

| File | Change |
|---|---|
| `supabase/functions/generate-blog-article/index.ts` | New `validateSourceFreshness()` function (~60 lines), freshness context injection (~20 lines), response field addition (~5 lines), diagnostic log (~10 lines) |
| `src/components/admin/blog/LongTailSeoPanel.tsx` | Read `sourceFreshnessValidation` from response, auto-block high risk (~10 lines) |
| `src/components/admin/BlogPostEditor.tsx` | Read `sourceFreshnessValidation` from response, auto-block high risk (~10 lines) |

No database changes. No new files. Edge function auto-deploys.

