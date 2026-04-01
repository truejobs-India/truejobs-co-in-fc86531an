
# Blog Image Pipeline — Strict Mode & Gap Fixes (Implemented)

## Files Changed

1. `src/components/admin/BlogPostEditor.tsx`
2. `src/components/admin/blog/PendingActionsPanel.tsx`
3. `supabase/functions/generate-vertex-image/index.ts`

## Changes Summary

### Fix 1: One-time localStorage migration
- Added `blog_cover_model_migrated_v1` flag
- Migration upgrades `gemini-flash-image` → `gemini-pro-image` exactly once
- Admin can freely re-select `gemini-flash-image` after migration without being overridden
- Default changed from `gemini-flash-image` to `gemini-pro-image`

### Fix 2: Runtime metadata aggregation in bulk toasts
- Both `BlogPostEditor.tsx` and `PendingActionsPanel.tsx` now track `Set<string>` of runtime tuples
- Extracts `resolvedProvider` and `resolvedRuntimeModelId` from backend responses
- Toast shows actual runtime model if uniform, "mixed runtime" if multiple

### Fix 3: Persistent toast (already solved)
- Both files use `useAdminToast` from `AdminMessagesContext` which is already persistent

### Fix 4: Strict-mode metadata in error responses
- `buildStrictErrorResponse()` helper returns structured `{ strict, noFallbackUsed, selectedModelKey, resolvedProvider, resolvedRuntimeModelId }`
- Applied to all strict-mode error paths

### Fix 5: Single source of truth for backend validation
- `KNOWN_IMAGE_MODEL_KEYS` set derived from `GATEWAY_IMAGE_MODELS` keys + vertex models
- Commented that it must stay aligned with `src/lib/aiModels.ts`
- Frontend uses `getModelDef(model)?.capabilities.includes('image')` guard

### Fix 6: Strict mode truly strict
- 6 fallback points blocked: 3 in `generateViaGeminiFlashImage`, 3 in `generateViaImagen`
- Safety-filter fallback in `generateViaImagen` blocked in strict mode
- Catch-all routing defaults blocked in strict mode (cover, inline, backward-compat)
- Unknown model key validated at handler entry

### Fix 7: PendingActionsPanel verified and patched
- YES, it invokes `generate-vertex-image` for both cover and inline
- Added `strict: true`, runtime metadata tracking, validation guard
