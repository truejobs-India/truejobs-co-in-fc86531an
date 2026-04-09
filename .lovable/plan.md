

# Fix: MAI-Image-2 — Wrong Endpoint Path, Auth Header, and Body Format

## Problem

The user's verified curl sample proves three bugs in the current `azure-mai-image.ts`:

| Aspect | Current code (WRONG) | Correct (from curl) |
|---|---|---|
| **Path** | `/mai/v1/images/generations` | `/openai/v1/images/generations` |
| **Auth header** | `api-key: <key>` | `Authorization: Bearer <key>` |
| **Size format** | `width: 1024, height: 1024` (separate ints) | `size: "1024x1024"` (single string) |
| **Body extras** | no `n` field | `n: 1` required |

The project-path stripping logic is correct — the user's target URL (`https://social-5844-resource.services.ai.azure.com/api/projects/social-5844`) needs to be stripped to `https://social-5844-resource.services.ai.azure.com`.

## Files Changed (2)

### 1. `supabase/functions/_shared/azure-mai-image.ts` — Full rewrite

- **Path:** `/mai/v1/...` → `/openai/v1/images/generations`
- **Auth:** `'api-key': apiKey` → `'Authorization': 'Bearer ' + apiKey`
- **Body:** `{ model, prompt, width, height }` → `{ model, prompt, size: "WxH", n: 1, response_format: "b64_json" }`
- **Options interface:** `width/height` → `size?: string`
- **`maiSizeFromAspectRatio`:** returns `string` (`"1024x1024"`) instead of `{ width, height }`
- **Remove:** `validateSize` function (768px constraints were wrong docs)
- **Remove:** binary PNG response handling (API returns JSON with `b64_json`)
- **Keep:** project-path stripping (confirmed needed), URL fallback handling, timeout logic

### 2. `supabase/functions/generate-vertex-image/index.ts` — Update call site

`generateViaAzureMaiImage` currently does:
```typescript
const dims = maiSizeFromAspectRatio(requestedRatio);
// passes dims.width, dims.height
```

Change to:
```typescript
const size = maiSizeFromAspectRatio(requestedRatio);
// passes { size } to callAzureMaiImage
```

Update width/height references in the success response to parse from the size string.

## What is NOT changed

- No model registry changes
- No selector changes
- No FLUX caller changes
- No other model routing
- No frontend changes

## Secrets

All three are already configured (`AZURE_MAI_ENDPOINT`, `AZURE_MAI_API_KEY`, `AZURE_MAI_IMAGE_DEPLOYMENT`). The user has now provided exact values — these should be updated via the secrets tool to match:
- Endpoint: `https://social-5844-resource.services.ai.azure.com/api/projects/social-5844`
- API key: the provided key
- Deployment: `MAI-Image-2`

## Post-fix verification

Deploy the edge function and test with `curl_edge_functions` to confirm a successful image generation.

