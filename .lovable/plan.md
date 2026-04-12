

# Gemini Migration: Vertex AI to Direct Google Gemini API — Final Execution Plan

## Scope

Replace all Gemini model calls that currently depend on Vertex AI (GCP service account, OAuth JWT, project/location endpoints) with direct Google Gemini API calls via `generativelanguage.googleapis.com` using a single `GEMINI_API_KEY`. Non-Gemini providers remain untouched.

## Exact File Inventory

**Category A — 26 files importing `_shared/vertex-ai.ts` (shared dynamic import):**

| # | File |
|---|---|
| 1 | `analyze-blog-compliance-fixes/index.ts` |
| 2 | `azure-emp-news-ai-clean-drafts/index.ts` |
| 3 | `classify-blog-articles/index.ts` |
| 4 | `company-research/index.ts` |
| 5 | `enrich-authority-pages/index.ts` |
| 6 | `enrich-blog-articles/index.ts` |
| 7 | `enrich-employment-news/index.ts` |
| 8 | `extract-employment-news/index.ts` |
| 9 | `firecrawl-ai-enrich/index.ts` |
| 10 | `fix-seo-metadata/index.ts` |
| 11 | `gemini-generate/index.ts` |
| 12 | `generate-blog-article/index.ts` |
| 13 | `generate-blog-faq/index.ts` |
| 14 | `generate-blog-seo/index.ts` |
| 15 | `generate-custom-page/index.ts` |
| 16 | `generate-guide-content/index.ts` |
| 17 | `generate-resource-content/index.ts` |
| 18 | `generate-resource-image/index.ts` |
| 19 | `improve-blog-content/index.ts` |
| 20 | `intake-ai-classify/index.ts` |
| 21 | `job-search-ai/index.ts` |
| 22 | `linkedin-import/index.ts` |
| 23 | `resume-ai/index.ts` |
| 24 | `rss-ai-process/index.ts` |
| 25 | `seo-audit-fix/index.ts` |
| 26 | `suggest-blog-internal-links/index.ts` |

**Category B — 3 files with their own LOCAL duplicated `getVertexAccessToken()` (do NOT import from shared):**

| # | File |
|---|---|
| 27 | `generate-premium-article/index.ts` |
| 28 | `generate-seo-helper/index.ts` |
| 29 | `generate-vertex-image/index.ts` |

**Category C — Frontend model registry:**

| # | File |
|---|---|
| 30 | `src/lib/aiModels.ts` |

**Category D — New shared helper:**

| # | File |
|---|---|
| 31 | `supabase/functions/_shared/gemini-direct.ts` (NEW) |

**Total files changed: 31** (26 shared-import replacements + 3 local-auth rewrites + 1 frontend registry + 1 new shared helper)

## Model Availability

Models will be verified at runtime during end-to-end testing. The following are expected to be available via direct Google Gemini API based on current documentation, but will only be exposed in selectors after live verification confirms they work for this account:

**Text models (pending verification):**
| Registry Key | Direct API Model ID |
|---|---|
| `vertex-flash` | `gemini-2.5-flash` |
| `vertex-pro` | `gemini-2.5-pro` |
| `vertex-3.1-pro` | `gemini-3.1-pro-preview` |
| `vertex-3-flash` | `gemini-3-flash-preview` |
| `vertex-3.1-flash-lite` | `gemini-3.1-flash-lite-preview` |

**Image-capable models (pending verification):**
| Registry Key | Direct API Model ID |
|---|---|
| `vertex-flash-image` | `gemini-2.5-flash-preview-image-generation` |
| `vertex-3-pro-image` | `gemini-3-pro-image-preview` |
| `vertex-3.1-flash-image` | `gemini-3.1-flash-image-preview` |

**NOT migratable (remove from selectors):**
| Model | Reason |
|---|---|
| `vertex-imagen` | Uses Vertex predict API, not generateContent. Vertex-only. |

## Execution Steps

### Step 1: Add `GEMINI_API_KEY` secret
Use `add_secret` tool. Wait for user to provide the key before proceeding.

### Step 2: Create `supabase/functions/_shared/gemini-direct.ts`
New shared helper exporting:
- `callGeminiDirect(model, prompt, timeoutMs, options)` — same signature as `callVertexGemini`
- `callGeminiDirectWithMeta(model, prompt, timeoutMs, options)` — same signature as `callVertexGeminiWithMeta`
- `callGeminiDirectImage(model, prompt, timeoutMs)` — for image generation with `responseModalities: ['IMAGE', 'TEXT']`

Authentication: `GEMINI_API_KEY` in URL query param. Endpoint: `https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent`. Retry logic for 429s preserved.

### Step 3: Update Category A — 26 files (shared import replacement)
In each file, replace every `import('../_shared/vertex-ai.ts')` with `import('../_shared/gemini-direct.ts')` and swap function names:
- `callVertexGemini` → `callGeminiDirect`
- `callVertexGeminiWithMeta` → `callGeminiDirectWithMeta`
- `getVertexAccessToken` → removed (not needed)

Also update provider metadata strings from `'vertex-ai'` to `'gemini-direct'` where used in response metadata.

### Step 4: Rewrite Category B — 3 files (local Vertex auth removal)

**4a. `generate-premium-article/index.ts`** — Delete the local `getVertexAccessToken()` function and local `callVertexGemini()`. Import `callGeminiDirect` from `_shared/gemini-direct.ts` instead.

**4b. `generate-seo-helper/index.ts`** — Same treatment: delete local Vertex auth, import from shared helper.

**4c. `generate-vertex-image/index.ts`** — Delete the local `getVertexAccessToken()`. Replace `generateViaGeminiFlashImage()` and `generateViaVertexDirectImage()` to use `callGeminiDirectImage()` from the shared helper. Remove Imagen routing (Vertex-only). Keep non-Gemini image providers (Nova Canvas, Azure FLUX, Azure MAI-Image, Lovable Gateway) unchanged.

### Step 5: Update `src/lib/aiModels.ts`
- Change `provider` from `'Google Vertex AI'` to `'Google Gemini API'` for all `vertex-*` entries
- Update labels: replace `(From API)` with `(Direct API)` 
- Remove `vertex-imagen` entry entirely
- Remove `'image'` from `vertex-pro` capabilities (was routing to Imagen)
- Keep registry key values unchanged (e.g. `vertex-flash` stays `vertex-flash`) to preserve localStorage preferences

### Step 6: Deploy all 29 modified edge functions
Deploy all functions from Categories A and B.

### Step 7: Live verification
- Test one text model (`gemini-2.5-flash`) via `analyze-blog-compliance-fixes`
- Test one image model via `generate-vertex-image`
- If any model returns 404 or unsupported error, remove it from selectors before finalizing

### Step 8: Final codebase search for remaining Vertex imports
Run `grep -r "vertex-ai\.ts" supabase/functions/` to confirm zero remaining imports. Only then decide whether `_shared/vertex-ai.ts` can be deleted (it will be deleted only if zero imports remain and no non-Gemini code depends on it).

## Secrets Summary

| Secret | Status |
|---|---|
| `GEMINI_API_KEY` | **Must add** (new) |
| `GCP_PROJECT_ID` | Already deleted |
| `GCP_CLIENT_EMAIL` | Already deleted |
| `GCP_PRIVATE_KEY` | Already deleted |
| `GCP_LOCATION` | Already deleted |

## What stays unchanged
- All non-Gemini providers: Sarvam, Azure OpenAI, Azure DeepSeek, Azure FLUX, Azure MAI-Image, Amazon Bedrock (Nova), Anthropic Claude, Groq, Lovable Gateway
- Lovable Gateway Gemini models (`gemini-flash-image`, `gemini-pro-image`, `gemini-flash-image-2`) — these route through Lovable AI Gateway, not direct API
- Built-in platform `gemini-flash` and `gemini-pro` entries (source: `built-in`, provider: `Google`) — these also route through Lovable Gateway

