

# Fix Nova Canvas Frontend Routing in FeaturedImageGenerator

## Problem

The backend edge function (`generate-vertex-image/index.ts`) correctly routes `nova-canvas` in all three purpose paths (cover, inline, backward-compat) — lines 1306, 1334, 1362. No backend changes needed.

The bug is in **`FeaturedImageGenerator.tsx` line 49**: the condition only sends `gemini-flash-image` and `vertex-imagen` to `generate-vertex-image`. When `nova-canvas` is selected, it falls through to the `else` branch (line 63) and calls the **legacy `generate-blog-image`** function, which has no Nova Canvas support.

## Fix

### File: `src/components/admin/blog/FeaturedImageGenerator.tsx` (~3 lines changed)

**Line 49**: Expand the routing condition to include all models that should go through `generate-vertex-image`. The simplest correct approach: check against `KNOWN_IMAGE_MODEL_KEYS` logic — any model with `capabilities: ['image']` or known image model keys should route to `generate-vertex-image`. Practically, change the condition to also include `nova-canvas` and any other vertex-routed models:

```typescript
// Before (line 49):
if (imageModel === 'gemini-flash-image' || imageModel === 'vertex-imagen') {

// After:
if (imageModel === 'gemini-flash-image' || imageModel === 'vertex-imagen' || imageModel === 'nova-canvas') {
```

This sends Nova Canvas requests to the correct edge function where all the routing, prompt building, SigV4 signing, and strict mode enforcement already work.

No other files need changes. The backend is already fully wired.

| File | Change |
|---|---|
| `src/components/admin/blog/FeaturedImageGenerator.tsx` | Add `nova-canvas` to the routing condition on line 49 (~1 line) |

