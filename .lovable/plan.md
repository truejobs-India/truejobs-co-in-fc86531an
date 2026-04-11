

# Dedicated FLUX.2-pro Prompt Policy

## Problem
FLUX.2-pro currently uses the same prompt pipeline as FLUX.1-Kontext (`buildBlogCoverPrompt` → `applyFluxRealismLayer`). This shared policy doesn't enforce strict anti-text rules, causing FLUX.2-pro to render unwanted text in images.

## Solution
Create a dedicated FLUX.2-pro prompt builder that replaces the entire prompt construction chain for this model only. No other model's prompt logic is touched.

## Changes

### 1. New file: `supabase/functions/_shared/flux2-prompt-policy.ts`
A standalone FLUX.2-pro prompt module with:

- **`buildFlux2CoverPrompt(body)`** — converts article metadata (title, category, tags, excerpt) into a concrete photorealistic scene description, appends the strict anti-text block and negative constraints
- **`buildFlux2InlinePrompt(body)`** — same but tailored for inline/section images with nearby-content awareness
- **Anti-text block** — 30+ explicit suppression rules (no words, no letters, no Hindi, no English text, no typography, no captions, no labels, no watermarks, no logos, no signage, no poster text, no newspaper text, no book-cover text, no UI text, no handwritten text, no printed text, no exam paper text, no banner text, no badge text, no stamp text, no visible alphanumeric characters)
- **Negative block** — explicit suppression of text overlays, title cards, infographic style, meme composition, thumbnail-with-text, ad creative, document-like visuals
- **Scene construction logic** — converts generic article intent into concrete visual scenes (e.g., "SSC admit card" → students checking hall tickets in a corridor; "Railway recruitment" → candidates at a station with preparation materials)
- **Aesthetic rules** — photorealistic, Indian context, ordinary students/aspirants aged 20-24, simple clothing, no glamour, no fantasy, clean backgrounds
- **Fallback** — if article context is weak, generates a clean study/education scene relevant to government jobs, never generic corporate stock

### 2. Modified: `supabase/functions/generate-vertex-image/index.ts`
In the `generateViaAzureFlux2` function only (around line 1354):
- Import `buildFlux2CoverPrompt` and `buildFlux2InlinePrompt` from the new policy file
- Replace line 1373 (`const fluxPrompt = applyFluxRealismLayer(imagePrompt, body.prompt)`) with:
  ```typescript
  const fluxPrompt = purpose === 'inline'
    ? buildFlux2InlinePrompt(body)
    : buildFlux2CoverPrompt(body);
  ```
- This means FLUX.2-pro no longer uses `imagePrompt` (from the shared builder) at all — it builds its own prompt from scratch using `body` directly
- The `imagePrompt` parameter is kept in the function signature for interface consistency but ignored

**No other model path is changed.** FLUX.1-Kontext still uses `applyFluxRealismLayer`. Gemini, Imagen, Nova Canvas, MAI-Image-2 all keep their existing prompt builders untouched.

### 3. Verification
After deployment, test the edge function with 6 real article scenarios:
1. UPSC preparation article
2. SSC admit card article
3. Railway recruitment article
4. Exam result article
5. College admission guidance article
6. Government job application mistake article

Each test will verify the prompt output contains strong anti-text directives and scene-relevant content.

## Files
- **New:** `supabase/functions/_shared/flux2-prompt-policy.ts`
- **Modified:** `supabase/functions/generate-vertex-image/index.ts` (only the `generateViaAzureFlux2` function, ~3 lines changed)

