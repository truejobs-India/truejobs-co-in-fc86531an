

# Fix Nova/Mistral Length Control — Logging-First Implementation

## What Changes

### 1. Structured Diagnostic Summary (bedrock-nova.ts)

**File:** `supabase/functions/_shared/bedrock-nova.ts`

Update `callBedrockNovaWithMeta` to:
- Log `maxTokens` sent in request payload
- Parse and return `data.usage` (inputTokens, outputTokens) from Bedrock response
- Return a richer object: `{ text, stopReason, usage }` where `usage = { inputTokens, outputTokens }`

### 2. Structured Diagnostic Summary (improve-blog-content/index.ts)

**File:** `supabase/functions/improve-blog-content/index.ts`

Add a structured `[ENRICHMENT_DIAGNOSTIC]` JSON log line emitted just before the final response for `enrich-article` action. This single log line contains all 11 requested data points:

```json
{
  "tag": "ENRICHMENT_DIAGNOSTIC",
  "articleTitle": "...",
  "modelRequested": "nova-pro",
  "actualProvider": "aws-bedrock",
  "actualModelId": "amazon.nova-pro-v1:0",
  "targetWordCount": 1500,
  "maxTokensSent": 3000,
  "finishReason": "end_turn",
  "usageTokens": { "inputTokens": 1200, "outputTokens": 2800 },
  "firstPassWordCount": 780,
  "correctionAttempted": false,
  "correctionSkipped": true,
  "correctionSkipReason": "model in CONTINUATION_INELIGIBLE_MODELS",
  "finalWordCount": 780,
  "finalValidationStatus": "fail",
  "finalDeviation": -48
}
```

Changes to the dispatcher (`callAI`):
- Return `usage` from Nova calls (passed through from `callBedrockNovaWithMeta`)
- Return `usage` from Mistral calls (parse `data.usage` from Converse API response)
- For other models, return `usage: null` (no change to their code)
- Update `callAI` return type to include `usage?: { inputTokens?: number; outputTokens?: number }`

Changes to `callMistral`:
- Parse and include `data.usage` and `data.stopReason` in the returned JSON string (for logging only, no behavior change)

Changes to the `enrich-article` response path (lines 638-718):
- Capture `firstPassWordCount` before any correction logic
- Add explicit `correctionSkipReason` logging when correction is not attempted
- Emit the `[ENRICHMENT_DIAGNOSTIC]` structured log line
- Include diagnostic summary in the response JSON as `diagnostics` field (so the client can also display/store it)

### 3. Enable Nova Correction (word-count-enforcement.ts)

**File:** `supabase/functions/_shared/word-count-enforcement.ts`

- Remove `'nova-pro'` and `'nova-premier'` from `CONTINUATION_INELIGIBLE_MODELS` (line 198-199)
- Add them to `CONTINUATION_ELIGIBLE_MODELS` (line 192-194)

This is the one proven fix: Nova models are currently blocked from any correction/retry pass.

### 4. Clean Up Nova Dispatcher (improve-blog-content/index.ts)

**File:** `supabase/functions/improve-blog-content/index.ts` lines 300-307

Remove the redundant `computeNovaBudget(Math.ceil(maxTokens / 2), model)` re-computation. Pass `maxTokens` directly to `callBedrockNovaWithMeta`. The value is identical today but the double-computation is confusing and fragile.

Before:
```typescript
const { computeMaxTokens: computeNovaBudget } = await import(...);
const novaBudget = computeNovaBudget(Math.ceil(maxTokens / 2), model);
const result = await callBedrockNovaWithMeta(model, prompt, { maxTokens: novaBudget, ... });
```

After:
```typescript
const result = await callBedrockNovaWithMeta(model, prompt, { maxTokens, ... });
```

### 5. Persistence Proof Logging (BulkEnrichByWordCount.tsx)

**File:** `src/components/admin/blog/BulkEnrichByWordCount.tsx`

After each proposal insert (line 267-279), log the insert result to console:
```typescript
const { error: insertErr } = await supabase.from('blog_enrichment_proposals').insert({...});
if (insertErr) console.error('[BulkEnrich] Proposal insert failed:', insertErr);
else console.log('[BulkEnrich] Proposal stored:', { articleId: post.id, proposedWc, status: 'pending_review' });
```

Also include `diagnostics` from the edge function response in the proposal row's `generation_config` jsonb field for post-hoc review.

### 6. Include Diagnostics in Proposal Storage

Store the structured diagnostic from the edge function response into the `generation_config` jsonb column of `blog_enrichment_proposals` so the admin can review exact runtime data per proposal without needing to read logs.

## Files Changed

| File | Change Type |
|------|------------|
| `supabase/functions/_shared/bedrock-nova.ts` | Add usage logging + return usage in result |
| `supabase/functions/_shared/word-count-enforcement.ts` | Move Nova to CONTINUATION_ELIGIBLE (proven fix) |
| `supabase/functions/improve-blog-content/index.ts` | Structured diagnostic log, Nova dispatcher cleanup, Mistral usage parsing |
| `src/components/admin/blog/BulkEnrichByWordCount.tsx` | Store diagnostics in proposal, log persistence result |

## What This Does NOT Change

- No token multiplier changes (pending log evidence)
- No Mistral system prompt addition (pending log evidence)
- No Nova Pro ceiling change (correct per AWS docs)
- No new UI components (diagnostics stored in existing `generation_config` column)

## After Deployment

Run enrichment tests for Nova Pro, Nova Premier, and Mistral at 1500 words. Read the `[ENRICHMENT_DIAGNOSTIC]` logs and proposal `generation_config` to produce the evidence report with the 11 data points per model.

