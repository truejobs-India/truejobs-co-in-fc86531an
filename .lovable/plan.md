

## Problem Analysis

Three distinct issues cause word count mismatches across AI models during blog enrichment:

### Issue 1: Nova Pro & Nova Premier produce too few words (~800 instead of 1500)
- The enrichment prompt uses soft language: "approximately X words"
- Nova models tend to be conservative with output length and need explicit, strict word count instructions
- The `STRICT Word count` instruction pattern (already used in other edge functions like `generate-custom-page`) is missing from the enrichment prompts

### Issue 2: Gemini 2.5 Flash overshoots (~2000 instead of 1500)
- The `callAI` dispatcher calls `callVertexGemini('gemini-2.5-flash', prompt, 90_000)` passing only a timeout — **no `maxOutputTokens` option**
- This means Vertex AI defaults to 8192 output tokens, giving Gemini unlimited room to overshoot
- The prompt also lacks a strict upper-bound instruction

### Issue 3: No strict word count enforcement in prompts
- Other functions (e.g., `generate-custom-page`) already use the pattern: `STRICT Word count target: X words. Do NOT exceed Y words.`
- The `enrich-article` prompts in `improve-blog-content` don't use this pattern

---

## Plan

### Step 1: Add strict word count instructions to enrichment prompts
**File**: `supabase/functions/improve-blog-content/index.ts`

In both the stub-rebuild prompt (line ~454) and the standard enrichment prompt (line ~491), replace the soft "approximately X words" with:

```
STRICT Word count target: ${effectiveTarget} words. Do NOT exceed ${Math.round(effectiveTarget * 1.15)} words.
${effectiveTarget <= 1200 ? 'Keep sections brief (3-5 sentences max) and skip subsections.' : ''}
```

This matches the proven pattern from `generate-custom-page`.

### Step 2: Pass maxOutputTokens to Vertex AI calls
**File**: `supabase/functions/improve-blog-content/index.ts`

Update the `vertex-flash` and `vertex-pro` cases in `callAI` to pass the `maxTokens` parameter through to Vertex AI as `maxOutputTokens`:

```typescript
case 'vertex-flash': {
  const { callVertexGemini } = await import('../_shared/vertex-ai.ts');
  const text = await callVertexGemini('gemini-2.5-flash', prompt, 90_000, { maxOutputTokens: maxTokens });
  ...
}
case 'vertex-pro': {
  const { callVertexGemini } = await import('../_shared/vertex-ai.ts');
  const text = await callVertexGemini('gemini-2.5-pro', prompt, 120_000, { maxOutputTokens: maxTokens });
  ...
}
```

This caps Gemini's token budget to match the requested word count instead of defaulting to 8192.

### Step 3: Tune Nova token budget relative to word target
**File**: `supabase/functions/improve-blog-content/index.ts`

For Nova models, the `maxTokens` calculation already works, but add a model-specific floor so Nova doesn't cut short. After `maxTokens` is computed for enrichment, add:

```typescript
// Nova models need a generous token budget — 1 word ≈ 1.5 tokens for HTML content
if (model === 'nova-pro' || model === 'nova-premier') {
  maxTokens = Math.max(maxTokens, Math.ceil(effectiveTarget * 2));
}
```

### Step 4: Redeploy and verify
- Redeploy `improve-blog-content` edge function
- Smoke-test with a Nova Premier and Gemini Flash call to verify word counts land closer to target

### Summary of changes
| Model | Problem | Fix |
|-------|---------|-----|
| Nova Pro/Premier | Soft prompt → short output | Add STRICT word count instruction + increase token floor |
| Gemini Flash | No maxOutputTokens passed → overshoot | Pass maxTokens through to Vertex AI options |
| All models | "approximately" wording | Replace with strict upper-bound language |

**Files modified**: `supabase/functions/improve-blog-content/index.ts` (single file, ~4 targeted edits)

