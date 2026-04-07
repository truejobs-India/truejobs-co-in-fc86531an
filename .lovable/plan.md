

# Connect AWS Nova Canvas — Corrected Implementation Plan

## Verified API Contract (from AWS docs)

Nova Canvas uses the **InvokeModel** API (not Converse). The exact request schema:

```json
{
  "taskType": "TEXT_IMAGE",
  "textToImageParams": {
    "text": "prompt (1-1024 chars)",
    "negativeText": "optional (1-1024 chars)"
  },
  "imageGenerationConfig": {
    "width": int,
    "height": int,
    "quality": "standard" | "premium",
    "cfgScale": float,
    "seed": int,
    "numberOfImages": int
  }
}
```

Response: `{ "images": ["base64string", ...], "error": "optional" }`

**Resolution constraints** (verified from docs):
- Each side: 320–4096 pixels, divisible by 16
- Aspect ratio: between 1:4 and 4:1
- Total pixels < 4,194,304
- Both default to 1024 if omitted
- `quality` accepts only `"standard"` or `"premium"` (not arbitrary strings)

## Technical Details

### Correction 1: Verified request schema
Use only documented fields. `quality` is `"standard"` (default, faster) — not `"premium"` unless user requests it. No invented fields.

### Correction 2: Support all aspect ratios in existing pipeline
The edge function's `ASPECT_RATIOS` map has 5 entries: `1:1`, `16:9`, `4:3`, `3:2` (mapped to `3:4`), `9:16`. Map each to valid Nova Canvas dimensions (divisible by 16, within constraints):

```text
1:1  → 1024×1024
16:9 → 1280×720
4:3  → 1024×768
3:4  → 768×1024
9:16 → 720×1280
```

If the incoming `aspectRatio` doesn't match any key, return a 400 error with the list of supported ratios rather than silently defaulting.

### Correction 3: Reuse existing storage conventions
Follow the exact pattern from other generators:
- Cover: `covers/{slug}-nova-canvas.png`
- Inline: `inline/{slug}-nova-canvas-slot{N}.png`
- Upload via existing `uploadGeneratedImage()` helper to `blog-assets` bucket

### Correction 4: Retry only retryable errors
Retry loop only on: `429` (rate limit), `5xx` (server errors), `AbortError` (timeout/network). Immediately fail (no retry) on: `400` (bad request), `401`/`403` (auth/signature), `422` (validation).

### Correction 5: awsSigV4Fetch compatibility verified
- Existing `awsSigV4Fetch` in `_shared/bedrock-nova.ts` signs any POST to `bedrock-runtime.{region}.amazonaws.com`
- Current usage: `/model/{modelId}/converse` with service `bedrock`
- Nova Canvas uses: `/model/amazon.nova-canvas-v1:0/invoke` with same service `bedrock`
- Same host, same Content-Type, same signing — fully compatible

### Correction 6: Full runtime transparency
Response includes `selectedModelKey: 'nova-canvas'`, `resolvedProvider: 'bedrock'`, `resolvedRuntimeModelId: 'amazon.nova-canvas-v1:0'` via existing `addStrictMetadata()`.

### Correction 7: Strict mode — no fallback
If `strict === true` and Nova Canvas fails, return `buildStrictErrorResponse()` with the error. Never fall back to Vertex AI or Lovable Gateway.

### Correction 8: Backend guard against non-image use
Nova Canvas is added to `KNOWN_IMAGE_MODEL_KEYS` set only. The text generation edge function (`generate-blog-article`) does not reference it. If somehow passed as a text model, the existing dispatcher will reject it as unknown.

---

## Files Changed

### File 1: `src/lib/aiModels.ts` (~15 lines)

Add to `AI_MODELS` array after the existing Amazon models:

```typescript
{
  value: 'nova-canvas',
  label: 'Amazon Nova Canvas (From API)',
  desc: 'Your API · Image generation · ~20s',
  speed: 20,
  source: 'external-api',
  provider: 'Amazon',
  capabilities: ['image'],
  recommendedMaxWords: 0,
  warnAboveWords: 0,
  longFormReliability: 'poor',
  supportsContinuationPass: false,
}
```

### File 2: `supabase/functions/generate-vertex-image/index.ts` (~90 lines)

**A. Add to KNOWN_IMAGE_MODEL_KEYS** (line 34):
```
'nova-canvas'
```

**B. New function `generateViaNovaCanvas()`** (~65 lines):
- Import `awsSigV4Fetch` from `../_shared/bedrock-nova.ts`
- Map aspect ratio to width/height (all 5 ratios supported, else 400 error)
- Build InvokeModel payload with `taskType: "TEXT_IMAGE"`, `quality: "standard"`, `numberOfImages: 1`
- Call `awsSigV4Fetch(host, '/model/amazon.nova-canvas-v1:0/invoke', body, region, 'bedrock')`
- Timeout: 120s (matching `IMAGEN_TIMEOUT_MS`)
- Retry loop: only on 429 and 5xx, up to `MAX_RETRIES` with existing exponential backoff
- On 400/401/403: return error immediately, no retry
- Parse response `images[0]` (base64 string), upload via `uploadGeneratedImage()` to `{pathPrefix}/{slug}-nova-canvas{slotSuffix}.png`
- Return success with `addStrictMetadata()` including `selectedModelKey: 'nova-canvas'`, `resolvedProvider: 'bedrock'`, `resolvedRuntimeModelId: 'amazon.nova-canvas-v1:0'`
- On strict failure: `buildStrictErrorResponse()`, never fallback

**C. Add routing in handler** (lines 1090–1160):
Add `nova-canvas` check in all three routing paths (purpose=cover, purpose=inline, backward-compat):
```typescript
if (selectedModel === 'nova-canvas') {
  return await generateViaNovaCanvas(body, slug, imagePrompt, adminClient, startMs, strict);
}
```

No database changes. No new files. Edge function auto-deploys.

