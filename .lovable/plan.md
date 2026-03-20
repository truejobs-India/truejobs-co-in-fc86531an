

## Word-Count Enforcement Fix — 3-State Validation, Clean Text Counting, and Correction Retry

### Root Causes Confirmed

| # | Bug | Impact |
|---|---|---|
| 1 | `generate-custom-page` `callAI()` accepts no `maxTokens` parameter — every model uses hardcoded values (Nova: 16384, but Nova Pro's real limit is 5120 output tokens) | Nova Pro silently truncates at ~800 words |
| 2 | `improve-blog-content` gives Gemini `maxTokens = effectiveTarget * 2.5` (up to 65536) but the model over-generates because the token budget is too generous | Gemini 2.5 Flash produces ~2000 words for a 1500 target |
| 3 | Word count computed from raw HTML (`replace(/<[^>]+>/g, ' ')`) — includes alt text from images, invisible attributes if mangled, and doesn't handle HTML entities (`&amp;` counted as `amp`) | Word count can be inflated or deflated vs. visible text |
| 4 | No post-generation validation — output is always accepted regardless of length | Under/over-count passes silently |
| 5 | `generate-custom-page` enrich action says "1500-2500 words" in prompt — not parameterized from request body | Cannot control target for custom page enrichment |
| 6 | Claude Sonnet gets `maxTokens: 3500` cap — can only produce ~1400 words of HTML, making it impossible to hit targets above ~1200 | Always under-generates at 1500 target |

### Plan — Files to Change

**File 1: `supabase/functions/_shared/word-count-enforcement.ts` — NEW**

Shared module with:

- `countWordsFromHtml(html)`: Strips all HTML tags, decodes `&amp;` `&lt;` `&gt;` `&nbsp;` `&quot;` entities, normalizes whitespace, then counts words. This counts only visible rendered text.

- `computeMaxTokens(targetWordCount, modelId)`: Returns dynamic `maxTokens` per model:
  - `nova-pro`: `min(target * 2, 5120)` (hard model ceiling)
  - `nova-premier`: `min(target * 2, 10000)`
  - `claude-sonnet`: `min(target * 2.5, 8192)` (raise from current 3500)
  - Gemini (any): `min(target * 2, 16384)` (tighter than current `* 2.5`)
  - Groq/others: `min(target * 2.5, 8192)`

- `buildWordCountInstruction(target, modelId?)`: Standardized prompt block. For Nova models, adds extra reinforcement: "You have a strict budget. Your response must be approximately {target} words."

- `validateWordCount(html, target)`: Returns `WordCountValidation`:
  ```
  {
    targetWordCount: number
    actualWordCount: number
    minPass: number       // target * 0.85
    maxPass: number       // target * 1.15
    minWarn: number       // target * 0.75
    maxWarn: number       // target * 1.25
    status: 'pass' | 'warn' | 'fail'
    deviation: number     // percentage over/under
  }
  ```
  Uses `countWordsFromHtml` for the count.

- `buildCorrectionPrompt(originalHtml, target, actual, status, direction)`: For the optional single correction retry. If `status === 'fail'`:
  - Too short: "Expand this article to exactly {target} words. Current: {actual} words. Add depth to existing sections."
  - Too long: "Trim this article to exactly {target} words. Current: {actual} words. Remove redundancy."
  Returns the prompt string. Caller decides whether to invoke.

---

**File 2: `supabase/functions/improve-blog-content/index.ts`**

Changes in `enrich-article` action (lines 505-745):

- Import shared helper
- Replace inline word count instruction with `buildWordCountInstruction(effectiveTarget, effectiveModel)`
- Replace inline maxTokens calculation with `computeMaxTokens(effectiveTarget, effectiveModel)`
- Remove separate Claude `maxTokens = 3500` cap (now handled by shared helper at 8192)
- After getting `resultHtml` (line 709-734):
  - Use `countWordsFromHtml(resultHtml)` instead of `resultHtml.replace(/<[^>]+>/g, ' ').split(...)`
  - Call `validateWordCount(resultHtml, effectiveTarget)`
  - If `status === 'fail'` AND `wasTruncated === false` AND body does not already have `isRetry: true`:
    - Build correction prompt via `buildCorrectionPrompt()`
    - Call `callAI(effectiveModel, correctionPrompt, computeMaxTokens(effectiveTarget, effectiveModel))` once
    - Re-validate the corrected output
    - Use whichever version (original or corrected) is closer to target
    - Set `correctionAttempted: true` in response
  - If `isRetry: true` in body, skip correction (prevent infinite loops)
- Add to response: `wordCountValidation: { targetWordCount, actualWordCount, maxTokensRequested, status, deviation }`, `selectedModelId`, `actualProviderUsed`, `actualModelUsed`

---

**File 3: `supabase/functions/generate-custom-page/index.ts`**

Changes:

- Import shared helper
- Update `callAI(model, prompt)` → `callAI(model, prompt, maxTokens?)`:
  - Pass `maxTokens` to each provider: Gemini's `maxOutputTokens`, Bedrock's `maxTokens`, OpenAI's `max_tokens`, etc.
  - Default to 8192 if not provided (backward compat for non-enrichment actions)
- In `generate-result` action (line 586-608):
  - Compute `maxTokens = computeMaxTokens(target_word_count, model)`
  - Replace prompt word count line with `buildWordCountInstruction(target_word_count, model)`
  - Pass `maxTokens` to `callAI(model, prompt, maxTokens)`
  - After parsing, call `validateWordCount(parsed.content, target_word_count)`
  - Add `wordCountValidation` to response
- In `enrich` action (line 533-583):
  - Accept `target_word_count` from request body (default 2000)
  - Replace hardcoded "1500-2500 words" with `buildWordCountInstruction(target_word_count, model)`
  - Pass `computeMaxTokens(target_word_count, model)` to `callAI`
  - Add validation to response

---

**File 4: Frontend components — Show 3-state warnings**

In `PendingActionsPanel.tsx`, `BlogAITools.tsx` (or wherever enrichment results are consumed):

- Check `result.wordCountValidation?.status`:
  - `pass`: green indicator or no extra message
  - `warn`: amber toast: "Output was {actual} words (target: {target}). Slightly outside range."
  - `fail`: red toast: "Output was {actual} words (target: {target}). Significantly off target."
- If `result.correctionAttempted`, show note: "Automatic correction was attempted."
- Display `result.wordCountValidation.actualWordCount` alongside existing word count display

---

### Post-Generation Cleanup Audit

Confirmed cleanup steps that can affect final word count:

| Step | File | Line | Impact |
|---|---|---|---|
| Strip ` ```html ` / ` ``` ` fences | `improve-blog-content` | 680-682 | Removes non-visible markup — correct, no word loss |
| JSON extraction (`extractResultFromPseudoJson`) | `improve-blog-content` | 684-726 | Extracts HTML from `"result"` field — can truncate if closing quote misdetected |
| Empty check (`resultHtml === '{}'`) | `improve-blog-content` | 728-730 | Replaces content with empty string if it looks like an object — could discard valid content that starts with `{` |
| Markdown-to-HTML conversion | `improve-blog-content` | 732-734 | Converts `## ` → `<h2>` — adds tags but no words |
| `parseAIResponse` regex extraction | `generate-custom-page` | 380-418 | Extracts content field from JSON — robust but can miss trailing content if JSON is malformed |

**Key finding**: The `extractResultFromPseudoJson` function (line 684-706) scans for the closing `"` of the `result` field by checking if the next content is `"wordCount"` or `}`. If the model puts extra fields between `result` and `wordCount`, or uses single quotes, the extraction silently truncates. This is a real source of word loss. Fix: after extraction, re-validate that the extracted HTML contains the expected tag density (at least N `<h2>` or `<p>` tags proportional to target).

---

### Correction Retry Design

- Only triggered when `status === 'fail'` (outside 75%-125%)
- Only one attempt (flag `correctionAttempted` prevents recursion)
- Uses same model and provider — no provider switching
- Uses a tighter prompt: explicit current vs target word count, direction (expand/trim)
- Token budget recalculated for the correction pass
- If correction also fails validation, return the better of the two attempts
- Response always shows both `status` and `correctionAttempted` so admin sees what happened

### Response Shape After Fix

```json
{
  "result": "...",
  "wordCount": 1487,
  "wordCountValidation": {
    "targetWordCount": 1500,
    "actualWordCount": 1487,
    "maxTokensRequested": 3000,
    "status": "pass",
    "deviation": -0.87
  },
  "selectedModelId": "nova-pro",
  "actualProviderUsed": "bedrock",
  "actualModelUsed": "us.amazon.nova-pro-v1:0",
  "correctionAttempted": false,
  "wasTruncated": false,
  "changes": [...]
}
```

