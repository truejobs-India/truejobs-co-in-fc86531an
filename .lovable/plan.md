

# Fix: Gemini Image Model Routing Bugs

Two bugs discovered during live verification need fixing.

## Bug 1: Property name mismatch in `generateViaGeminiDirectImage`

`callGeminiDirectImage()` returns `{ base64, mimeType, altText }` but `generateViaGeminiDirectImage()` references `result.imageBase64` (lines 281, 293). This causes all direct Gemini image generation to falsely report "No image data returned."

**Fix**: In `supabase/functions/generate-vertex-image/index.ts`, change `result.imageBase64` → `result.base64` on lines 281 and 293.

## Bug 2: `gemini-2.5-flash-preview-image-generation` returns 404

The model ID used by `generateViaGeminiFlashImage()` (line 25: `GEMINI_IMAGE_MODEL = 'gemini-2.5-flash-preview-image-generation'`) does not exist in the direct Gemini API for this account.

**Fix**: 
- Update `GEMINI_IMAGE_MODEL` to the correct model name. The Lovable Gateway uses `google/gemini-2.5-flash-image` which maps to `gemini-2.5-flash-preview-image-generation` — but since that's not available, we should route `vertex-flash-image` through `generateViaGeminiDirectImage` using `gemini-2.5-flash-preview-image-generation` isn't the right fix. Instead:
  - Add `vertex-flash-image` to `isGeminiDirectImageModel()` 
  - Map it in `resolveGeminiDirectRuntimeModel()` — but we need the correct direct API model ID
  - Since the model ID `gemini-2.5-flash-preview-image-generation` doesn't work via direct API, and this is a model availability issue, `vertex-flash-image` should either be removed from selectors OR routed through the Lovable Gateway (which already has `gemini-flash-image` → `google/gemini-2.5-flash-image`)

**Recommended approach**: Remove `vertex-flash-image` from the Direct API image selectors since the model is not available via the direct API for this account. The equivalent capability is already available via the Lovable Gateway's `gemini-flash-image` entry.

## Changes

### File: `supabase/functions/generate-vertex-image/index.ts`
1. Fix `result.imageBase64` → `result.base64` (lines 281, 293)
2. Remove `vertex-flash-image` from `KNOWN_IMAGE_MODEL_KEYS` direct routing; route it to Lovable Gateway instead, OR remove it from the "Direct API" image model list entirely
3. Update `generateViaGeminiFlashImage` references that use the broken model ID

### File: `src/lib/aiModels.ts`
1. Remove `vertex-flash-image` entry (model not available via direct API; same capability exists via `gemini-flash-image` through Lovable Gateway)

### Deploy
- Redeploy `generate-vertex-image`
- Re-test `vertex-3-pro-image` and `vertex-3.1-flash-image` to confirm images are now generated and uploaded correctly

## Verification after fix
- Test `vertex-3-pro-image` via direct API → expect image uploaded successfully
- Test `vertex-3.1-flash-image` via direct API → expect image uploaded successfully
- Confirm `vertex-flash-image` is no longer in Direct API selectors

