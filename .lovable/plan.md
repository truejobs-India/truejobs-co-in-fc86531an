

## Implementation Plan: Multi-Model Dispatcher for `classify-blog-articles`

### Root Cause
`classify-blog-articles/index.ts` is 100% Gemini-hardcoded. It ignores `ai_model` and always calls Gemini, crashing on rate limits when Claude/Mistral is intended.

### Changes

#### File 1: `supabase/functions/classify-blog-articles/index.ts` — Major rewrite

**A. Port provider implementations** from `improve-blog-content` (lines 64-268):
- `awsSigV4Fetch` + `callMistral` (Bedrock, `mistral.mistral-large-2407-v1:0`, `us-west-2`)
- `callClaude` (Anthropic Messages API, `claude-sonnet-4-6`, system field for classification prompt, messages array for user prompt)
- `callGemini` (existing logic, moved into function with `responseMimeType: 'application/json'`)
- `callOpenAI`, `callGroq`, `callLovableGemini`
- Vertex via dynamic import of `_shared/vertex-ai.ts`

**B. Unified dispatcher** `callClassifierAI(aiModel, systemPrompt, userPrompt, maxTokens)`:
- Switch on model key, same pattern as `improve-blog-content`
- Each provider builds request in its native format:
  - **Gemini**: single combined prompt, `responseMimeType: 'application/json'`
  - **Claude**: top-level `system` field = classification prompt + "Return ONLY valid JSON array", `messages[0]` = user prompt
  - **OpenAI/Groq/Lovable**: `system` message + `user` message
  - **Mistral Bedrock**: converse API with combined prompt
- Unknown model → throw structured error (caught by outer try/catch, returned as 400)
- Logs: `model_requested`, `actual_provider`, `actual_model_id`

**C. Robust JSON parsing** (applied to all providers):
1. Strip markdown fences (`\`\`\`json ... \`\`\``)
2. Trim whitespace
3. `JSON.parse` → validate result is `Array.isArray()`
4. On failure: **one** repair attempt — send only first 2000 chars of malformed text with prompt "Fix this malformed JSON array and return ONLY valid JSON". Use same provider.
5. On second failure: return structured 502 error. No loops.

**D. Batch resilience with progressive retry** (slug-keyed):
- Maintain a `Map<string, ClassificationVerdict>` keyed by slug (not array index)
- If full batch call fails:
  1. Log: `[classify] full_batch_failed count=${N}, splitting into halves`
  2. Split into two halves, retry each
  3. If a half fails, retry items individually
  4. Log: `[classify] individual_fallback slug=${slug}`
  5. Items that fail individually → default verdict: `{ verdict: 'manual_review', confidence: 0, reasons: ['AI classification failed'], safe_to_bulk_edit: false, requires_manual_review: true }`
- Response includes `_meta: { total, classified_ok, fallback_half_batch, fallback_individual, failed_to_manual_review }`

**E. Verdict mapping by slug**:
- After AI returns an array of verdicts, match each to its article by `slug` field (not array position)
- Unmatched slugs get `manual_review` default
- This is safe across batch splits since each sub-batch carries its own article slugs

**F. Provider-specific logging**:
```
[classify] START model_requested=claude-sonnet batch_size=8 workflow=enrich
[classify] DISPATCH actual_provider=anthropic actual_model=claude-sonnet-4-6
[classify] FULL_BATCH_OK parsed=8
  -- or --
[classify] FULL_BATCH_FAILED error="429 rate limit" → splitting
[classify] HALF_BATCH_OK half=1 parsed=4
[classify] INDIVIDUAL_FALLBACK slug=my-article reason="parse error"
[classify] DONE classified=7 manual_review_fallback=1
```

#### File 2: `src/hooks/useBulkBlogWorkflow.ts` — Minor safety fix

At both classifier call sites (~line 558 and ~line 849):
- After `const { data, error } = await supabase.functions.invoke(...)`, add:
  ```ts
  if (data?.error) throw new Error(data.error);
  ```
- This ensures edge function errors returned as 200-with-error-body are caught by the existing catch blocks (which already gracefully push `manual_review`), preventing blank screens.

### What stays unchanged
- All three prompt builder functions
- All post-processing safety rules (confidence < 0.7, ranking_risk high, published strong post)
- `verifyAdmin` function
- All interfaces (`ArticleDigest`, `ClassificationVerdict`)
- Frontend batch loop structure, cancel logic, and existing catch blocks

