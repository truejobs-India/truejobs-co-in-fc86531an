

# Add "Gemini 2.5 Flash Image (From API)" to Image Model Selector

## Summary
Add a new `vertex-flash-image` model entry that routes through the direct Vertex AI path (your GCP service account), distinct from the existing `gemini-flash-image` which routes through the Lovable Gateway.

## Changes

### 1. `src/lib/aiModels.ts` — Add registry entry

Add a new model definition after the existing `vertex-imagen` entry:

```typescript
{
  value: 'vertex-flash-image',
  label: 'Gemini 2.5 Flash Image (From API)',
  desc: 'Your API · Fast image generation via Vertex AI',
  speed: 20,
  source: 'external-api',
  provider: 'Google Vertex AI',
  capabilities: ['image'],
  recommendedMaxWords: 0,
  warnAboveWords: 0,
  longFormReliability: 'poor',
  supportsContinuationPass: false,
}
```

### 2. `supabase/functions/generate-vertex-image/index.ts` — Wire routing

**A.** Add `'vertex-flash-image'` to `KNOWN_IMAGE_MODEL_KEYS` set.

**B.** Update `isVertexDirectImageModel` to include `vertex-flash-image`:
```typescript
const isVertexDirectImageModel = (model: string) =>
  model === 'vertex-3-pro-image' || model === 'vertex-3.1-flash-image' || model === 'vertex-flash-image';
```

**C.** Update `resolveVertexDirectRuntimeModel` to map it:
```typescript
case 'vertex-flash-image':
  return 'gemini-2.5-flash-image';
```

This reuses the existing `generateViaGeminiFlashImage` function (which already calls Vertex AI directly with the `gemini-2.5-flash-image` model). Actually — looking more carefully, `generateViaVertexDirectImage` uses `v1beta1` for `gemini-3*` models and `v1` otherwise, plus it uses `generateContent`. Since `gemini-2.5-flash-image` is a 2.x model, `v1` + regional endpoint is correct. However, `generateViaGeminiFlashImage` is a dedicated function already perfectly tuned for this model. So the cleaner approach:

**Revised B.** Instead of routing through `generateViaVertexDirectImage`, treat `vertex-flash-image` the same as `gemini-flash-image` but via the direct path. Add it alongside `gemini-flash-image` checks in all three routing blocks (cover, inline, default):

```typescript
if (selectedModel === 'gemini-flash-image' || selectedModel === 'vertex-flash-image') {
  return await generateViaGeminiFlashImage(body, slug, imagePrompt, adminClient, startMs, strict);
}
```

This ensures `vertex-flash-image` uses the already-working `generateViaGeminiFlashImage` which routes directly through Vertex AI (not the Lovable Gateway).

### 3. Redeploy the edge function

Deploy `generate-vertex-image` and verify it accepts `vertex-flash-image` without errors.

## What is NOT changed
- Other model routing paths
- Gateway models behavior
- Prompt policy
- Any other edge functions

