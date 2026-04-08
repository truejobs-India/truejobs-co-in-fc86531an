

# Fix Azure FLUX: Correct Endpoint + Add Missing `model` Parameter

## Root Cause

The Azure sample code you shared reveals two mismatches with our current implementation:

1. **Wrong base URL domain**: We use `truejobsflux-resource.services.ai.azure.com` but Azure expects `truejobsflux-resource.openai.azure.com`
2. **Missing `model` field in request body**: The 400 error explicitly says "Could not find a reference to a model". Azure's OpenAI-compatible endpoint requires `model: "FLUX.1-Kontext-pro"` in the JSON body. Our code never sends it.
3. **Wrong URL path**: We use a BFL provider path, but the correct path from Azure's sample is `/openai/v1/images/generations`

## Changes

### 1. Update secret `AZURE_FLUX_BASE_URL`
From: `https://truejobsflux-resource.services.ai.azure.com`
To: `https://truejobsflux-resource.openai.azure.com`

### 2. Update `supabase/functions/_shared/azure-flux.ts`
- Remove BFL provider path logic entirely
- Hardcode the correct OpenAI-compatible path: `/openai/v1/images/generations`
- Add `model: "FLUX.1-Kontext-pro"` to the request body
- Remove unused `AZURE_FLUX_DEPLOYMENT` env var reference
- Remove unused `DEFAULT_API_VERSION` and `BFL_API_VERSION` constants

The request will become:
```
POST https://truejobsflux-resource.openai.azure.com/openai/v1/images/generations
Headers: { "api-key": "<key>", "Content-Type": "application/json" }
Body: { "model": "FLUX.1-Kontext-pro", "prompt": "...", "n": 1, "size": "1024x1024", "response_format": "b64_json" }
```

This matches the Azure sample exactly.

| Item | Detail |
|---|---|
| Files changed | `supabase/functions/_shared/azure-flux.ts` |
| Secret updated | `AZURE_FLUX_BASE_URL` → `https://truejobsflux-resource.openai.azure.com` |
| Edge function redeployed | `generate-vertex-image` |

