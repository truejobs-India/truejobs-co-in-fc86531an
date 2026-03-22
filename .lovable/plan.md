

## Plan: Fix Vertex AI Global Endpoint for Gemini 3.x Models

### Root Cause
Line 84 of `supabase/functions/_shared/vertex-ai.ts` uses the regional host (`${location}-aiplatform.googleapis.com`) and regional location path for all models, including Gemini 3.x. Per Google's official docs, Gemini 3.x preview models require:
- Host: `aiplatform.googleapis.com` (not regional)
- Location path: `global` (not `us-central1`)
- API version: `v1beta1`

### Change

**File: `supabase/functions/_shared/vertex-ai.ts`** (lines 82-85)

Replace the `getVertexEndpoint` function with:

```typescript
function getVertexEndpoint(model: string, projectId: string, location: string): string {
  const isGemini3 = model.startsWith('gemini-3');
  const apiVersion = isGemini3 ? 'v1beta1' : 'v1';
  const loc = isGemini3 ? 'global' : location;
  const host = isGemini3 ? 'aiplatform.googleapis.com' : `${location}-aiplatform.googleapis.com`;
  return `https://${host}/${apiVersion}/projects/${projectId}/locations/${loc}/publishers/google/models/${model}:generateContent`;
}
```

### Verification
After deployment, run live tests via `extract-employment-news` for each Gemini 3.x model:
- `gemini-3.1-pro-preview`
- `gemini-3-flash-preview`
- `gemini-3.1-flash-lite-preview`
- `gemini-3-pro-image-preview`

Report exact URL, HTTP status, and raw error for each.

### What is NOT changing
- `extract-employment-news/index.ts` — routing is already correct (`vertex-ai` provider)
- No gateway rerouting
- No model registry changes
- No frontend changes

