

# Revised Plan: MAI-Image-2 (Azure) Integration

## Critical Endpoint Correction

The previous plan assumed MAI-Image-2 uses the same endpoint path as Azure FLUX (`/openai/v1/images/generations`). **This is wrong.**

Per verified Microsoft documentation:

| | Azure FLUX (existing) | MAI-Image-2 (new) |
|---|---|---|
| **Path** | `/openai/v1/images/generations` | `/mai/v1/images/generations` |
| **Size params** | `size: "1024x1024"` (single string) | `width: 1024, height: 1024` (separate integers) |
| **Output format** | `response_format: "b64_json"` | Always PNG binary — no `response_format` param |
| **Auth header** | `api-key: <key>` | `api-key: <key>` (same) |
| **Body model field** | `model: "FLUX.1-Kontext-pro"` | `model: "<deployment-name>"` |
| **Size constraints** | Fixed sizes (1024x1024, 1792x1024, etc.) | Both dims ≥ 768px, total pixels ≤ 1,048,576 |

Reusing the FLUX caller would produce a **404 or 400** because the path and body format are different.

## Files Changed (4 total)

### 1. `src/lib/aiModels.ts` — Add registry entry

One new entry with `capabilities: ['image']`, `source: 'external-api'`, label `MAI-Image-2 (Azure)`. This automatically populates every `AiModelSelector` filtered by `capability="image"`.

### 2. `supabase/functions/_shared/azure-mai-image.ts` — New dedicated caller

**Endpoint:** `POST {AZURE_MAI_ENDPOINT}/mai/v1/images/generations`

**Request body:**
```json
{
  "model": "<AZURE_MAI_IMAGE_DEPLOYMENT>",
  "prompt": "...",
  "width": 1024,
  "height": 576
}
```

**Auth:** `api-key` header (same pattern as FLUX).

**Response handling:** MAI-Image-2 returns PNG. The response format from the docs uses the same `data[].b64_json` structure. The caller will handle both b64_json and raw binary responses defensively.

**Size validation:** Both dimensions ≥ 768px, width × height ≤ 1,048,576. Aspect ratio mapping:
- 16:9 → 1024×768 (max within pixel budget)
- 1:1 → 1024×1024
- 9:16 → 768×1024

### 3. `supabase/functions/generate-vertex-image/index.ts` — Add routing

- Import `callAzureMaiImage` + size helper
- Add `'azure-mai-image-2'` to `KNOWN_IMAGE_MODEL_KEYS`
- Add `generateViaAzureMaiImage` function (same pattern as `generateViaAzureFlux`)
- Add routing `if` block in all three routing sections (cover, inline, backward-compat)

### 4. `src/components/admin/blog/FeaturedImageGenerator.tsx` — Add to routing guard

Add `'azure-mai-image-2'` to the condition on line 49.

## Env Vars Required

| Name | Purpose |
|---|---|
| `AZURE_MAI_ENDPOINT` | Base URL (e.g. `https://your-resource.services.ai.azure.com`) |
| `AZURE_MAI_API_KEY` | API key |
| `AZURE_MAI_IMAGE_DEPLOYMENT` | Deployment name (e.g. `MAI-Image-2`) |

## Selector-by-Selector Verification Plan

After implementation, each of the following 13 locations will be explicitly verified:

| # | File | Location | Verify appears | Verify routes to MAI only | Verify no fallback | Verify others unchanged |
|---|---|---|---|---|---|---|
| 1 | `BlogPostEditor.tsx:1612` | Single post image selector | Yes | Yes | Yes | Yes |
| 2 | `BlogPostEditor.tsx:1643` | Cover image bulk selector | Yes | Yes | Yes | Yes |
| 3 | `BlogPostEditor.tsx:1658` | Inline image bulk selector | Yes | Yes | Yes | Yes |
| 4 | `ImageGenerationPanel.tsx:292` | Cover model selector | Yes | Yes | Yes | Yes |
| 5 | `ImageGenerationPanel.tsx:333` | Inline model selector | Yes | Yes | Yes | Yes |
| 6 | `BoardResultGenerator.tsx:993` | Image model selector | Yes | Yes | Yes | Yes |
| 7 | `BoardResultAITools.tsx:404` | Cover image model selector | Yes | Yes | Yes | Yes |
| 8 | `BoardResultAITools.tsx:433` | (second image selector in same component) | Yes | Yes | Yes | Yes |
| 9 | `PdfResourcesManager.tsx:1079` | Image AI selector (top bar) | Yes | Yes | Yes | Yes |
| 10 | `PdfResourcesManager.tsx:1405` | Image AI selector (bottom bar) | Yes | Yes | Yes | Yes |
| 11 | `HubPageGenerator.tsx:163` | Image model selector | Yes | Yes | Yes | Yes |
| 12 | `DraftJobsSection.tsx:751` | Image model selector | Yes | Yes | Yes | Yes |
| 13 | `FeaturedImageGenerator.tsx` | Single post cover generator | Yes | Yes | Yes | Yes |

**Verification method for each:**
1. **Appears:** The model registry entry has `capabilities: ['image']`, and every selector above uses `capability="image"` — all read from the same `AI_MODELS` array. Adding one entry guarantees appearance in all 13.
2. **Routes to MAI only:** The edge function checks `selectedModel === 'azure-mai-image-2'` and calls the dedicated `callAzureMaiImage` function. No other code path is reached.
3. **No fallback:** The MAI caller throws on error. In strict mode, errors are returned as-is. In non-strict mode, the existing fallback logic does not include MAI as a fallback target for other models.
4. **Others unchanged:** No existing model key, routing `if` block, or caller function is modified.

After code changes, a live test will be performed via `supabase--curl_edge_functions` with `model: "azure-mai-image-2"` to confirm the endpoint is hit and images are returned (or a clear env-var-missing error if secrets aren't set yet).

## What Is NOT Changed

- No other model's routing, prompt, or behavior
- No GPT-image code paths
- No text-only selectors
- No prompt policies
- FLUX caller (`azure-flux.ts`) is untouched

