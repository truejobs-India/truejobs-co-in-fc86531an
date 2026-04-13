

# Update FLUX.2-pro Prompt Policy — Controlled Glamour Layer

## What changes

**Single file**: `supabase/functions/_shared/flux2-prompt-policy.ts`

No other model routes, prompt builders, or edge functions are touched.

## Changes in detail

### 1. Add new `CONTROLLED_GLAMOUR_BLOCK` constant (after `ANTI_ADORNMENT_BLOCK`)

A dedicated, clearly named block that encourages attractive presentation while preserving realism:

```typescript
const CONTROLLED_GLAMOUR_BLOCK = [
  'Subjects should look attractive, polished, and visually appealing while remaining completely believable.',
  'Clear, healthy skin with visible natural texture — pores, subtle imperfections — never airbrushed or waxy.',
  'Neat, well-groomed hair styled simply and naturally.',
  'Flattering, soft directional lighting that sculpts facial features — golden-hour warmth or gentle window light.',
  'Refined, photogenic composition with shallow depth-of-field drawing attention to the subject.',
  'Elegant, clean, aspirational presentation — the kind of person you would see on a top university prospectus.',
  'Confident, appealing, youthful appearance with natural posture and relaxed body language.',
  'Believable body proportions, realistic hands with correct finger count, natural arm positioning.',
  'Expressions: focused study concentration, or a mild pleasant look — never an exaggerated smile or blank stare.',
  'Do not apply beauty-filter smoothing, fashion-shoot posing, stock-photo grinning, Bollywood poster styling, or over-sexualized framing.',
  'Do not create plastic or synthetic-looking faces. Maintain documentary-style photographic realism throughout.',
].join(' ');
```

### 2. Update `AESTHETIC_BLOCK` — tune two lines

- Change `'Simple grooming, not glamorized, …'` → `'Simple but well-groomed appearance, polished without being glamorized, not ceremonial, not festive, not bridal, not devotional-poster style.'`
- Change `'Natural skin textures, realistic expressions, no airbrushed perfection.'` → `'Natural skin textures with visible pores, realistic expressions, no airbrushed or waxy perfection.'`

### 3. Expand `NEGATIVE_BLOCK` — add 11 suppression terms

Append after the existing `malformed anatomy` line:

```
'uncanny face, waxy skin, plastic skin, artificial smile, excessive beauty retouching,',
'fashion shoot pose, ad poster look, bridal look, forehead mark, nose stud,',
'corporate stock photo drift, beauty-filter smoothing, hyper-glossy skin,',
```

### 4. Wire `CONTROLLED_GLAMOUR_BLOCK` into both prompt builders

In `buildFlux2CoverPrompt` and `buildFlux2InlinePrompt`, insert `CONTROLLED_GLAMOUR_BLOCK` into the `parts` array between the scene and `AESTHETIC_BLOCK`.

### 5. Verification — 3 sample prompts

After the code change, I will generate and display 3 sample prompts for these article contexts:
1. "UPSC CSE 2025 Prelims Admit Card Released" (category: Admit Card)
2. "SBI PO Recruitment 2025 Notification — 2000 Vacancies" (category: Banking)
3. "Best Books for SSC CGL Tier 1 Preparation" (category: Study Tips)

This lets you compare the glamour increase vs. realism preservation.

## Files changed: 1
- `supabase/functions/_shared/flux2-prompt-policy.ts`

No edge function redeployment needed — this shared module is imported at runtime by the existing `generate-vertex-image` function which will pick up changes on next deploy.

