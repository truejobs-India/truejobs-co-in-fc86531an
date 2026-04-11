

# Update FLUX.2-pro Prompt Policy — Anti-Adornment & Age Tightening

## What Changes
Only one file is modified: `supabase/functions/_shared/flux2-prompt-policy.ts`. No other image model is touched.

## Exact Edits

### 1. New block: `ANTI_ADORNMENT_BLOCK` (insert after `ANTI_TEXT_BLOCK`, ~line 37)
A dedicated suppression block for facial adornments:
```
No bindi. No tilak. No teeka. No sindoor. No forehead marks of any kind.
No nose pin. No nose stud. No nose ring.
No visible facial adornment unless the article explicitly requires it.
No culturally stylized forehead decoration. No devotional-poster styling.
No ethnic bridal styling. No festive or ceremonial appearance.
No ornate facial accessories. Clean, unadorned faces only.
```

### 2. Update `AESTHETIC_BLOCK` (lines 40-52)
Replace people/subject guidance:
- Change age from "20–24" → **"18–21"**
- Add: "fair young Indian women and men"
- Add: "clean natural face with no facial adornments — no bindi, no tilak, no teeka, no sindoor, no forehead marks, no nose pin, no nose stud, no nose ring"
- Add: "simple grooming, not glamorized, not ceremonial, not festive, not bridal, not devotional-poster style"
- Keep all existing photorealism, clothing, and background rules

### 3. Update `NEGATIVE_BLOCK` (lines 55-65)
Add to the "Strictly avoid" list:
```
bindi, tilak, teeka, sindoor, forehead marks, nose pin, nose stud, nose ring,
facial adornments, bridal styling, ceremonial appearance, festive styling,
devotional-poster style, ornate facial accessories,
```

### 4. Wire `ANTI_ADORNMENT_BLOCK` into prompt assembly
In both `buildFlux2CoverPrompt` and `buildFlux2InlinePrompt`, insert `ANTI_ADORNMENT_BLOCK` between `ANTI_TEXT_BLOCK` and `NEGATIVE_BLOCK`.

### 5. Update scene descriptions
Update all 16 scene mappings + fallback to specify "aged 18–21" and "clean unadorned face" where people are described.

## What Is NOT Changed
- `blog-image-prompt-policy.ts` (FLUX.1-Kontext) — untouched
- `azure-flux2.ts` (API caller) — untouched
- `generate-vertex-image/index.ts` — untouched
- All other model routes (MAI-Image-2, gpt-image, Stable Image, Gemini, etc.) — untouched

## Verification
After deployment, test the edge function with 6 scenarios (UPSC, SSC admit card, Railway, college admission, exam result, govt job application). For each, confirm the generated prompt contains the anti-adornment directives, age 18–21, and all existing anti-text rules.

## File
- **Modified:** `supabase/functions/_shared/flux2-prompt-policy.ts`

