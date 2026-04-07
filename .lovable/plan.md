

# Fix Nova Canvas Prompt — Actually Implement buildNovaCanvasPrompt

## Problem
Line 1089 truncates the full prompt at 1024 chars, cutting off all 14 mandatory style rules (photorealism, no cartoons, Indian subjects, etc.). The `buildNovaCanvasPrompt()` function from the previous plan was never added.

## Fix

### File: `supabase/functions/generate-vertex-image/index.ts`

**A. Add `buildNovaCanvasPrompt()` function** (~25 lines, before `generateViaNovaCanvas`)

Takes the request body and returns `{ text: string, negativeText: string }`, both under 1024 chars.

**Positive prompt** (~800 chars):
```
Photorealistic editorial photograph for blog article titled "{title}" about {category}.
{tags if present}. {excerpt snippet if present}.
Style: True-to-life, cinematic, magazine-quality photo with realistic lighting,
textures, depth of field, natural color grading. Warm professional colors suitable
for Indian government jobs portal. Young Indian men and women with youthful, fair,
polished, aspirational, premium appearance. Realistic facial detail, skin texture,
clothing, posture in believable real environments. Highly relevant to the specific
article topic. No text overlays or watermarks. English only if any text needed.
```

**Negative prompt** (~350 chars, uses Nova Canvas `negativeText` field):
```
vector art, flat illustration, cartoon, infographic, poster, sketch, clipart,
icon, stylized artwork, diagram board, labeled panels, text-heavy composition,
simplified faces, low-detail faces, Hindi text, Devanagari script, Hinglish,
Indic script, watermarks, government seals, emblems, logos, generic stock photo,
abstract symbolic composition
```

**B. Replace truncation** (lines 1088-1095):

```typescript
// Before:
const truncatedPrompt = imagePrompt.length > 1024 ? imagePrompt.substring(0, 1024) : imagePrompt;
// ...
textToImageParams: { text: truncatedPrompt },

// After:
const novaPrompt = buildNovaCanvasPrompt(body);
console.log(`[nova-canvas] prompt: ${novaPrompt.text.length} chars, negativeText: ${novaPrompt.negativeText.length} chars`);
// ...
textToImageParams: {
  text: novaPrompt.text,
  negativeText: novaPrompt.negativeText,
},
```

This ensures Nova Canvas receives the same aesthetic intent as Gemini, split across both its supported fields instead of being silently truncated.

| File | Change |
|---|---|
| `supabase/functions/generate-vertex-image/index.ts` | Add `buildNovaCanvasPrompt()` (~25 lines), replace truncation with structured prompt + negativeText (~10 lines changed) |

