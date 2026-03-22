

## Plan: Fix Gemini 3 Pro Image Vertex Endpoint

### Diagnosis

**File**: `supabase/functions/generate-vertex-image/index.ts`

**Line 385** constructs the URL incorrectly:
```typescript
const url = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${vertexModelId}:generateContent`;
```

This produces (for `gemini-3-pro-image-preview`):
```
https://us-central1-aiplatform.googleapis.com/v1/projects/truejobs-485320/locations/us-central1/...
```

**Required** (per proven pattern for all Gemini 3.x models):
```
https://aiplatform.googleapis.com/v1beta1/projects/truejobs-485320/locations/global/...
```

This is the exact same bug that was fixed in `_shared/vertex-ai.ts` — but `generate-vertex-image/index.ts` has its own inline URL construction that was never updated.

### Audit Summary

| Item | Value |
|------|-------|
| Internal key | `vertex-3-pro-image` |
| UI label | `Gemini 3 Pro Image (Preview) (From API)` |
| Vertex model ID | `gemini-3-pro-image-preview` |
| Edge function | `generate-vertex-image/index.ts` |
| Handler function | `generateViaVertexDirectImage()` (line 360) |
| Current URL (WRONG) | `https://us-central1-aiplatform.googleapis.com/v1/...` |
| Required URL | `https://aiplatform.googleapis.com/v1beta1/.../locations/global/...` |
| Payload shape | Correct (`contents/parts`, `responseModalities: ['TEXT', 'IMAGE']`) |
| Gateway used? | No — this path goes direct to Vertex |
| "(From API)" label | Truthful — routes to Vertex AI, not gateway |

### Fix

**File**: `supabase/functions/generate-vertex-image/index.ts`, line 385

Replace the single URL construction line with the same global endpoint logic used in the shared helper:

```typescript
const isGemini3 = vertexModelId.startsWith('gemini-3');
const apiVersion = isGemini3 ? 'v1beta1' : 'v1';
const loc = isGemini3 ? 'global' : location;
const host = isGemini3 ? 'aiplatform.googleapis.com' : `${location}-aiplatform.googleapis.com`;
const url = `https://${host}/${apiVersion}/projects/${projectId}/locations/${loc}/publishers/google/models/${vertexModelId}:generateContent`;
```

Add a log line after:
```typescript
console.log(`[vertex-direct-image] endpoint: ${url}`);
```

### What is NOT changing
- No gateway rerouting
- No model registry changes
- No frontend/label changes
- No payload changes (shape is already correct for Gemini image models)
- No changes to `_shared/vertex-ai.ts` (already fixed)
- No changes to `extract-employment-news/index.ts`

### Verification
After deployment, invoke `generate-vertex-image` with `model: 'vertex-3-pro-image'` and a simple prompt to confirm 200 OK via direct Vertex AI with no gateway involvement.

