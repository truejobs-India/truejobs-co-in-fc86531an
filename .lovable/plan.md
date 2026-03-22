

## Plan: Add Gemini 3.x Models to Vertex AI Integration

### Summary
Extend the existing centralized Vertex AI integration to support 3 new text models and 1 new image model, all routed directly through the same GCP service account path used by Gemini 2.5 Pro. Add "(From API)" labels consistently. No new integration paths, no flow redesigns.

### New Model Keys and Vertex IDs

| UI Key | Label | Vertex Model ID | Type | Timeout |
|---|---|---|---|---|
| `vertex-3.1-pro` | Gemini 3.1 Pro (Preview) (From API) | `gemini-3.1-pro-preview` | text, text-premium | 120s |
| `vertex-3-flash` | Gemini 3 Flash (From API) | `gemini-3-flash-preview` | text | 90s |
| `vertex-3.1-flash-lite` | Gemini 3.1 Flash-Lite (From API) | `gemini-3.1-flash-lite-preview` | text | 60s |
| `vertex-3-pro-image` | Gemini 3 Pro Image (Preview) (From API) | `gemini-3-pro-image-preview` | image | 45s |

Existing labels also updated:
- `vertex-flash` → "Gemini 2.5 Flash (From API)" (already correct)
- `vertex-pro` → "Gemini 2.5 Pro (From API)" (already correct)

### Files to Change

**A. Model Registry — `src/lib/aiModels.ts`**
- Add 4 new entries to `AI_MODELS` array with correct capabilities, source `external-api`, provider `Google Vertex AI`
- Add `vertex-3.1-pro` and `vertex-3-flash` to `SEO_FIX_MODEL_VALUES`
- Add legacy aliases for gateway model IDs mapping to these new keys
- Keep existing entries unchanged

**B. Client-side throttling — `src/lib/seoFixRuntimeConfig.ts`**
- Add policies for:
  - `vertex-3.1-pro`: concurrency 1, 7s throttle (same as gemini-pro — preview, be conservative)
  - `vertex-3-flash`: concurrency 2, 2.5s throttle (same as gemini-flash)
  - `vertex-3.1-flash-lite`: concurrency 3, 1.5s throttle (fastest model)

**C. Backend throttling — `supabase/functions/_shared/seo-fix-runtime.ts`**
- Add model policies for 3 new text model keys

**D. Backend word-count — `supabase/functions/_shared/word-count-enforcement.ts`**
- Add the 3 new text model keys to the Gemini case block (same token multiplier as existing Gemini models)

**E. Edge Function Routing — 10 files need new `case` statements**

Each file's switch/dispatcher gets 3-4 new cases following the exact same pattern as `vertex-pro`/`vertex-flash`:

1. **`seo-audit-fix/index.ts`** — `resolveProvider()`: add 3 text model cases → `{ provider: 'vertex-ai', vertexModel: '...' }`
2. **`improve-blog-content/index.ts`** — `callAI()` switch + `SUPPORTED_MODELS` array: add 3 text model cases
3. **`generate-blog-article/index.ts`** — `resolveProviderInfo()` + `callAI()`: add 3 text model cases
4. **`enrich-authority-pages/index.ts`** — `resolveProviderInfo()` + `callAI()`: add 3 text model cases
5. **`enrich-employment-news/index.ts`** — `resolveProviderInfo()` + `callAI()`: add 3 text model cases
6. **`rss-ai-process/index.ts`** — `resolveProviderInfo()`: add 3 text model cases
7. **`classify-blog-articles/index.ts`** — `callAI()` switch: add 3 text model cases
8. **`generate-blog-faq/index.ts`** — `callAI()` switch: add 3 text model cases
9. **`generate-custom-page/index.ts`** — `callAI()` switch: add 3 text model cases
10. **`generate-resource-content/index.ts`** — `callAI()` switch: add 3 text model cases

11. **`generate-vertex-image/index.ts`** — Add `vertex-3-pro-image` routing:
    - Add new case in purpose-based routing that calls `generateViaGeminiFlashImage`-style function but using `gemini-3-pro-image-preview` model ID directly through Vertex AI (same auth, same endpoint pattern)
    - This routes through Vertex AI, NOT the gateway

**F. Deploy all updated edge functions**

**G. Verification** — Test each model with a lightweight prompt via `supabase--curl_edge_functions`

### Implementation Pattern (identical for all edge functions)

For text models, each new case follows this exact pattern:
```typescript
case 'vertex-3.1-pro': {
  const { callVertexGemini } = await import('../_shared/vertex-ai.ts');
  return callVertexGemini('gemini-3.1-pro-preview', prompt, 120_000, { maxOutputTokens: mt });
}
case 'vertex-3-flash': {
  const { callVertexGemini } = await import('../_shared/vertex-ai.ts');
  return callVertexGemini('gemini-3-flash-preview', prompt, 90_000, { maxOutputTokens: mt });
}
case 'vertex-3.1-flash-lite': {
  const { callVertexGemini } = await import('../_shared/vertex-ai.ts');
  return callVertexGemini('gemini-3.1-flash-lite-preview', prompt, 60_000, { maxOutputTokens: mt });
}
```

### What is NOT changing
- No changes to `_shared/vertex-ai.ts` (the helper is model-agnostic — it takes model ID as a parameter)
- No changes to GCP auth or credentials
- No new edge functions
- No Lovable AI Gateway routing for these models
- No image flow redesign
- No changes to `supabase/client.ts` or `types.ts`

### Preview-Model Cautions
- All three text models and the image model contain "preview" in their IDs — Google may change behavior or deprecate them
- Labels clearly marked "(Preview)" and "(From API)" to set admin expectations
- Conservative throttling applied for preview models

