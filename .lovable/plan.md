

## Plan: Fix Vertex AI Endpoint for Gemini 3.x Models

### Root Cause

The shared Vertex AI helper (`supabase/functions/_shared/vertex-ai.ts`) constructs endpoints using region-specific URLs:
```
https://us-central1-aiplatform.googleapis.com/v1/projects/.../locations/us-central1/publishers/google/models/gemini-3.1-pro-preview:generateContent
```

Gemini 3.x preview models are not served from `us-central1`. They require the **global endpoint**:
```
https://global-aiplatform.googleapis.com/v1/projects/.../locations/global/publishers/google/models/gemini-3.1-pro-preview:generateContent
```

This is the real fix — not rerouting to gateway.

### Changes

#### File 1: `supabase/functions/_shared/vertex-ai.ts`

Both `callVertexGemini` and `callVertexGeminiWithMeta` need the same fix:

- Detect Gemini 3.x model IDs (those starting with `gemini-3`)
- Use `global-aiplatform.googleapis.com` with `locations/global` for those models
- Use the existing region-based endpoint for Gemini 2.x models
- Log the exact endpoint used

Implementation: Add a helper function:
```typescript
function getVertexEndpoint(model: string, projectId: string, location: string): string {
  const isGlobal = model.startsWith('gemini-3');
  const host = isGlobal ? 'global-aiplatform.googleapis.com' : `${location}-aiplatform.googleapis.com`;
  const loc = isGlobal ? 'global' : location;
  return `https://${host}/v1/projects/${projectId}/locations/${loc}/publishers/google/models/${model}:generateContent`;
}
```

Apply this in both functions (replacing the current `url` construction on lines 93 and 184).

#### File 2: `supabase/functions/extract-employment-news/index.ts`

Restore true Vertex routing for the 3 incorrectly rerouted models (lines 39-45):
- `vertex-3.1-pro` → `{ provider: 'vertex-ai', modelId: 'gemini-3.1-pro-preview', timeout: 120_000 }`
- `vertex-3-flash` → `{ provider: 'vertex-ai', modelId: 'gemini-3-flash-preview', timeout: 90_000 }`
- `vertex-3.1-flash-lite` → `{ provider: 'vertex-ai', modelId: 'gemini-3.1-flash-lite-preview', timeout: 60_000 }`

Remove the comment about "not available on this GCP project."

#### Deployment & Verification

Deploy `extract-employment-news` and test each model via the edge function to confirm Vertex routing works with global endpoint.

### What is NOT changing
- No changes to any other edge function (they already route correctly to Vertex — the shared helper fix covers them all)
- No model registry changes
- No frontend changes
- No selector changes

### Files Changed
1. `supabase/functions/_shared/vertex-ai.ts` — global endpoint for Gemini 3.x
2. `supabase/functions/extract-employment-news/index.ts` — restore Vertex routing (remove gateway fallback)

