

# Manual Image Prompt Test — with Policy Guard

## Summary
Add a "Manual Image Prompt Test" panel to the AI Test section. The user types a raw prompt, selects any image model, and generates. The raw prompt is never sent directly — it is always wrapped through the prompt policy layer on the backend. The UI shows both the raw and final guarded prompt, plus preview and download.

## Architecture

The prompt-guard logic lives on the **backend** (edge function), not the frontend. This prevents any bypass.

### Files changed

**1. `supabase/functions/_shared/flux2-prompt-policy.ts`** — add 1 new export

Add `buildGuardedManualPrompt(userPrompt: string, model: string)`:
- For `azure-flux2-pro`: wraps user prompt as the "scene" input, then applies CONTROLLED_GLAMOUR_BLOCK + AESTHETIC_BLOCK + ANTI_TEXT_BLOCK + ANTI_ADORNMENT_BLOCK + NEGATIVE_BLOCK (same as `buildFlux2CoverPrompt` but using user prompt as the scene instead of auto-detected scene)
- For all other models: constructs a generic guarded prompt that merges the user prompt with the same policy intent — controlled realism, anti-text, anti-adornment, anti-glamour-excess, realistic hands/faces rules — formatted as a universal policy block that any model can interpret

This keeps the policy centralized in one file.

**2. `supabase/functions/generate-vertex-image/index.ts`** — add `purpose=manual-test` route

When `body.purpose === 'manual-test'`:
- Import `buildGuardedManualPrompt` from flux2-prompt-policy
- Call `buildGuardedManualPrompt(body.userPrompt, body.model)` to get `guardedPrompt`
- Route to the correct model generator (same routing logic as existing cover/inline)
- Return `guardedPrompt` in the response as `data.promptUsed` so UI can display it

**3. `src/components/admin/ManualImagePromptTest.tsx`** — new component

UI panel with:
- Textarea for raw user prompt
- Model dropdown (populated from `getImageModels()`)
- Aspect ratio selector (16:9, 4:3, 1:1, 9:16)
- Generate button with loading state
- Read-only textarea showing the final guarded prompt returned by backend
- Image preview
- Download button (uses `<a download>` on the image URL)
- Copy-final-prompt button
- Error display

Calls `supabase.functions.invoke('generate-vertex-image', { body: { purpose: 'manual-test', model, userPrompt, aspectRatio, slug: 'manual-test-...' } })`

**4. `src/components/admin/VertexAITestPanel.tsx`** — import and render

Add `<ManualImagePromptTest />` below the existing 4-card grid.

## Prompt guard logic detail

```typescript
// In flux2-prompt-policy.ts
export function buildGuardedManualPrompt(userPrompt: string, model: string): string {
  const isFlux2 = model === 'azure-flux2-pro';
  
  if (isFlux2) {
    // Use user prompt as the scene, apply full FLUX.2-pro policy
    const parts = [
      userPrompt + '.',
      'Indian context. Young Indian aspirants aged 18–21.',
      CONTROLLED_GLAMOUR_BLOCK,
      AESTHETIC_BLOCK,
      ANTI_TEXT_BLOCK,
      ANTI_ADORNMENT_BLOCK,
      NEGATIVE_BLOCK,
    ];
    return parts.join('\n\n');
  }
  
  // For all other models: universal guard
  const parts = [
    userPrompt,
    UNIVERSAL_GUARD_BLOCK, // (new constant — same rules as FLUX policy but written model-agnostically)
  ];
  return parts.join('\n\n');
}
```

The `UNIVERSAL_GUARD_BLOCK` will contain the same exclusions (anti-text, anti-adornment, controlled realism, realistic hands, no bindi/tilak/sindoor/nose-pin, no bridal/glamour-excess, no corporate drift) written in a model-agnostic format.

## Sample output for "create an image of 2 students"

For FLUX.2-pro, the final prompt would be:
```
create an image of 2 students.
Indian context. Young Indian aspirants aged 18–21.

Subjects should look attractive, polished, and visually appealing while remaining completely believable. Clear, healthy skin with visible natural texture — pores, subtle imperfections — never airbrushed or waxy. [... full CONTROLLED_GLAMOUR_BLOCK ...]

Photorealistic photograph, shot on a professional DSLR camera. [... full AESTHETIC_BLOCK ...]

Absolutely no text anywhere in the image. [... full ANTI_TEXT_BLOCK ...]

No bindi. No tilak. [... full ANTI_ADORNMENT_BLOCK ...]

Strictly avoid: text overlay, written content, [... full NEGATIVE_BLOCK ...]
```

## What is NOT changed
- Existing 4 test cards (Flash, Pro, Imagen, Gemini Image) remain untouched
- Existing `buildBlogCoverPrompt` / `buildBlogInlinePrompt` / `applyFluxRealismLayer` remain untouched
- No other model's production prompt path is affected

## Files changed: 3 (+ 1 new)
- `supabase/functions/_shared/flux2-prompt-policy.ts` — add `buildGuardedManualPrompt` + `UNIVERSAL_GUARD_BLOCK`
- `supabase/functions/generate-vertex-image/index.ts` — add `purpose=manual-test` routing block
- `src/components/admin/ManualImagePromptTest.tsx` — new component
- `src/components/admin/VertexAITestPanel.tsx` — import new component

