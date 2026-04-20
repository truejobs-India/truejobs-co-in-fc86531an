

## Goal
Make the ChatGPT-Agent image-model dropdown show **all** image models (Gemini Flash/Pro/Flash-2, Vertex 3 Pro/3.1 Flash, Azure FLUX.1 Kontext, Azure FLUX.2 Pro, Azure MAI-Image-2, Amazon Nova Canvas) and actually use the selected one — by reusing the blog's existing `generate-vertex-image` edge function (no rebuild).

## Why the current dropdown is short
`ChatGptAgentManager.tsx` hard-restricts the selector with:
```ts
const ALLOWED_IMAGE_MODELS = ['gemini-flash-image','gemini-flash-image-2','gemini-pro-image']
```
because the new `intake-generate-image` function only routes those 3. Meanwhile `generate-vertex-image` (used by the blog `FeaturedImageGenerator`) already supports **all 9** image models with proper provider routing (Gemini Direct, Lovable Gateway, Azure FLUX/FLUX2/MAI, Bedrock Nova Canvas).

## Approach — reuse, don't rebuild
Keep `intake-generate-image` as the orchestrator (it owns draft lookup, prompt building, 512×512 cropping, upload, `runtime_meta` writes). Inside it, **delegate the actual image generation call** to `generate-vertex-image` for any model outside the 3 native gateway ones. This mirrors the blog flow exactly.

## Changes (3 files)

### 1. `supabase/functions/intake-generate-image/index.ts`
- Accept the full set of `imageModel` keys: `gemini-flash-image`, `gemini-flash-image-2`, `gemini-pro-image`, `vertex-3-pro-image`, `vertex-3.1-flash-image`, `azure-flux-kontext`, `azure-flux2-pro`, `azure-mai-image-2`, `nova-canvas`.
- Routing rule:
  - If model is one of the 3 Lovable-Gateway Gemini models → keep current direct gateway call (already works, fast path).
  - Else → invoke `generate-vertex-image` via `supabase.functions.invoke()` with `{ slug: draftId, title: draft.publish_title, model: imageModel, imageCount: 1, aspectRatio: '1:1', purpose: 'intake', customPrompt: draft.image_prompt }` and use its returned base64 / URL.
- Continue post-processing: download → `ImageScript` center-cover crop → exact 512×512 PNG → upload to `blog-assets/chatgpt-agent-intake/<draftId>.png` → write `image_url` + `runtime_meta.image_model_used`.
- Errors stay non-blocking: failure writes `runtime_meta.image_error` only, never touches `master_file_raw`, returns 200.

### 2. `src/components/admin/chatgpt-agent/ChatGptAgentManager.tsx`
- Expand `ALLOWED_IMAGE_MODELS` to all 9 supported keys (matches `KNOWN_IMAGE_MODEL_KEYS` in `generate-vertex-image`).
- No UI restructuring — `AiModelSelector capability="image"` already groups built-in vs API and shows the API badge.

### 3. `src/components/admin/chatgpt-agent/ChatGptAgentDraftEditor.tsx`
- Replace the hardcoded `imageModel: 'gemini-flash-image'` in the manual Generate/Regenerate button with the model already persisted via `getLastUsedModel('image', …)` so the per-draft button honours the selector choice (same pattern the blog uses).

## Verification (after implementation)
For each of the 9 models I will:
1. Deploy `intake-generate-image`.
2. Use `supabase--curl_edge_functions` to invoke it against a test draft with each `imageModel` key.
3. Check `supabase--edge_function_logs intake-generate-image` and `generate-vertex-image` for routing confirmation (`resolvedProvider`, `resolvedRuntimeModelId`).
4. Confirm `intake_drafts.image_url` is set, file is exactly 512×512 PNG, and `runtime_meta.image_model_used` matches the requested key.
5. Negative test: force a bad model key → expect 400 with clear error, no `master_file_raw` mutation, draft enrichment status untouched.

## Out of scope
- No changes to `aiModels.ts` (registry already has all 9 image models).
- No changes to `AiModelSelector.tsx` (already capability-aware).
- No changes to text-enrichment flow.
- No automatic fallback between image providers (per project policy).

