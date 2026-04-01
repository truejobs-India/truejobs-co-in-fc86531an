

# Blog Image Pipeline — Gap Fixes Implementation Plan

## Verified Current State

1. **`PendingActionsPanel.tsx`**: YES, it invokes `generate-vertex-image` for both cover (line 220) and inline (lines 302, 319). Must be patched.
2. **Toast system**: Both files use `useAdminToast` from `AdminMessagesContext`, which is already persistent, session-stored, and manually dismissible. Gap #3 is already solved — no new toast system needed.
3. **Backend fallback points**: 6 silent fallbacks identified in `generateViaImagen` (lines 842, 851) and `generateViaGeminiFlashImage` (lines 277, 285, 293), plus safety-filter fallback (line 941).
4. **Frontend registry**: `src/lib/aiModels.ts` has `getModelDef()` with `capabilities` array. Image models have `capabilities: ['image']`.
5. **Backend cannot import `aiModels.ts`** — edge functions run in Deno, separate from the Vite/React build.

## File 1: `src/components/admin/BlogPostEditor.tsx`

### Fix 1: One-time localStorage migration (lines 154-157)

Replace the `coverImageModel` useState initializer with migration-flag logic:

```typescript
const [coverImageModel, setCoverImageModel] = useState<string>(() => {
  try {
    const migrationKey = 'blog_cover_model_migrated_v1';
    const stored = localStorage.getItem('blog_cover_image_model');
    if (!localStorage.getItem(migrationKey)) {
      localStorage.setItem(migrationKey, '1');
      if (!stored || stored === 'gemini-flash-image') {
        localStorage.setItem('blog_cover_image_model', 'gemini-pro-image');
        return 'gemini-pro-image';
      }
    }
    return stored || 'gemini-pro-image';
  } catch { return 'gemini-pro-image'; }
});
```

### Fix 2: Runtime metadata aggregation in bulk cover handler (lines 504-548)

- Add `const runtimeModels = new Set<string>();` before the loop
- After each successful response, extract `imgData.data?.resolvedProvider` and `imgData.data?.resolvedRuntimeModelId` and add to set
- In completion toast, use the set to show actual runtime info:
  - 1 unique entry → show it explicitly
  - Multiple → "mixed runtime"

### Fix 2b: Same for bulk inline handler (lines 560-677)

Same pattern — collect runtime tuples from each successful inline image response.

### Fix 5: Frontend validation guard

Before each bulk generation loop begins, validate:
```typescript
import { getModelDef } from '@/lib/aiModels';
const modelDef = getModelDef(coverImageModel);
if (!modelDef?.capabilities.includes('image')) {
  toast({ title: 'Invalid model', description: `"${coverImageModel}" is not an image-capable model.`, variant: 'destructive' });
  return;
}
```

### Fix 6: Add `strict: true` to all blog image request bodies

Add `strict: true` to the body of every `generate-vertex-image` invocation for cover and inline in this file.

## File 2: `src/components/admin/blog/PendingActionsPanel.tsx`

### Same fixes as BlogPostEditor

- Add `strict: true` to all `generate-vertex-image` invocations (cover lines 220-221, inline lines 302-303 and 319-320)
- Add runtime metadata Set tracking in `executeCover` and `executeInline`
- Include runtime model info in completion toasts
- Add frontend validation guard before execution

## File 3: `supabase/functions/generate-vertex-image/index.ts`

### Fix 4: Strict-mode metadata in all responses

Add a `KNOWN_IMAGE_MODEL_KEYS` set (derived from existing `GATEWAY_IMAGE_MODELS` keys + `vertex-imagen` + `vertex-3-pro-image` + `vertex-3.1-flash-image`) with a comment that it must stay aligned with `src/lib/aiModels.ts`.

### Fix 5: Single source of truth for backend validation

```typescript
// Must stay aligned with image-capable models in src/lib/aiModels.ts
const KNOWN_IMAGE_MODEL_KEYS = new Set([
  ...Object.keys(GATEWAY_IMAGE_MODELS),
  'vertex-imagen',
  'vertex-3-pro-image',
  'vertex-3.1-flash-image',
]);
```

### Fix 6: Make strict mode truly strict

When `body.strict === true`:

1. **Handler validation** (after parsing body): If model is not in `KNOWN_IMAGE_MODEL_KEYS`, return 400 with structured metadata.

2. **Pass `strict` to `generateViaImagen` and `generateViaGeminiFlashImage`**: Add `strict` parameter. At each fallback point (lines 277, 285, 293, 842, 851, 941), if strict → return error with metadata instead of falling back.

3. **Cover routing line 1001 catch-all**: If strict and model falls through to unintended default, return error.

4. **Inline routing line 1021 catch-all**: Same.

### Fix 4: Runtime metadata in all responses

All success responses gain fields:
```json
{
  "selectedModelKey": "gemini-pro-image",
  "resolvedProvider": "lovable-gateway",
  "resolvedRuntimeModelId": "google/gemini-3-pro-image-preview",
  "strict": true
}
```

All strict-mode error responses gain:
```json
{
  "strict": true,
  "selectedModelKey": "...",
  "resolvedProvider": "..." or "unknown",
  "resolvedRuntimeModelId": "..." or "unknown",
  "noFallbackUsed": true
}
```

### Helper for building strict error responses

```typescript
function buildStrictErrorResponse(status: number, error: string, meta: {
  selectedModelKey: string;
  resolvedProvider?: string;
  resolvedRuntimeModelId?: string;
  failureReason?: string;
}): Response {
  return new Response(JSON.stringify({
    success: false,
    error,
    strict: true,
    noFallbackUsed: true,
    selectedModelKey: meta.selectedModelKey,
    resolvedProvider: meta.resolvedProvider || 'unknown',
    resolvedRuntimeModelId: meta.resolvedRuntimeModelId || 'unknown',
    failureReason: meta.failureReason || 'unspecified',
  }), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
```

## Gap #3 — Persistent Toast (Already Solved)

Both files use `useAdminToast` which maps to `AdminMessagesContext`. This system:
- Stores messages in sessionStorage
- Messages persist until manually dismissed
- Survives page re-renders
- Shows in `AdminMessageLog` component

No changes needed. The completion toasts are already persistent by design.

## What stays unchanged

- `blogImageModel` and `inlineImageModel` defaults and localStorage keys
- Non-blog image flows (board results, resources, firecrawl, RSS)
- Database schema
- Public blog rendering
- Other edge functions
- `aiModels.ts` registry

## Risks

- `gemini-pro-image` is slower (~40s vs ~20s) — bulk generation takes longer
- Strict mode means no automatic recovery — admin must retry manually
- Backend `KNOWN_IMAGE_MODEL_KEYS` must be manually kept in sync with `aiModels.ts` (commented clearly)

