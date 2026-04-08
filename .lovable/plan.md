

# FLUX-Only Strict Realism Prompt Layer

## Root Cause
FLUX outputs drift toward beautified, stereotyped stock-photo aesthetics because it receives the same `BLOG_IMAGE_MANDATORY_RULES` as all other models — which includes directives like "very fair complexion, beautiful and handsome features, polished, aspirational, premium look" (rule 10). These work fine for Gemini/Imagen but cause FLUX to over-beautify.

## Architecture

The prompt flows like this today:

```text
buildCoverImagePrompt(body) → imagePrompt → generateViaAzureFlux() → callAzureFlux(imagePrompt)
```

All 3 FLUX call sites (cover, inline, backward-compat) in `generate-vertex-image/index.ts` pass `imagePrompt` directly. The fix adds a FLUX-only prompt transformation at a single point.

## Changes

### File 1: `supabase/functions/_shared/blog-image-prompt-policy.ts`

Add a new exported constant `FLUX_STRICT_REALISM_RULES` and a function `applyFluxRealismLayer(prompt, userPrompt?)`.

The function:
- Appends FLUX-specific strict realism directives that **override** conflicting rules from the shared block (e.g., replaces "very fair, beautiful, polished, aspirational" with "authentic, natural, ordinary student")
- Adds negative constraints block (no bindi, no tilak, no heavy makeup, no glamour, no stock-photo aesthetic, no heavy gold jewellery, etc.)
- Preserves explicit user intent: if the user's custom prompt contains keywords like "traditional", "bridal", "festive", "bindi", "tilak", "makeup", "jewellery", those negative constraints are softened
- Keeps the prompt concise and well-structured

### File 2: `supabase/functions/generate-vertex-image/index.ts`

In `generateViaAzureFlux()` (line ~1283), wrap `imagePrompt` through `applyFluxRealismLayer()` before passing to `callAzureFlux()`. This is the single insertion point — all 3 routing branches (cover, inline, backward-compat) call this same function.

No other model's prompt path is touched.

## FLUX-Only Prompt Content (condensed)

**Positive directives:**
- Documentary-style candid editorial photography
- Authentic real-life Indian environments
- Ordinary college-going students/aspirants, not fashion models
- Age-appropriate appearance, grounded everyday clothing
- Natural skin texture, realistic facial proportions, natural expressions
- Realistic classroom/study/exam-prep environments
- Natural lighting, believable imperfections

**Negative constraints (FLUX-only):**
- NO bindi, tilak, heavy makeup, bright lipstick, glamour styling
- NO heavy gold/bridal/ornate jewellery (subtle casual jewellery OK)
- NO stock-photo aesthetic, beauty-shot styling, artificial face smoothing
- NO fashion-model look, surreal symmetry, over-retouched portraits
- NO nonsense text on blackboards, books, screens, walls
- NO decorative irrelevant symbolism

**User-intent preservation:** If user prompt contains "traditional", "bridal", "festive", "bindi", "tilak", "makeup", or "jewellery", the negative constraints for those specific elements are excluded.

## Example Before/After

**Example 1 — Cover image for "SSC CGL 2026 Preparation Tips":**

Before (current): `Create a clean, professional photorealistic editorial image for a blog article titled "SSC CGL 2026 Preparation Tips" about Government Jobs. ... depict young Indian men and young Indian women with youthful appearance, very fair complexion, beautiful and handsome features, polished, aspirational, premium look...`

After (with FLUX layer): Same base prompt + `FLUX-SPECIFIC REALISM DIRECTIVES: Documentary-style candid editorial photography. Depict authentic ordinary Indian college-going students/aspirants with natural appearance, realistic skin texture, natural facial proportions, grounded everyday student clothing. Realistic study environment with believable books and materials. FLUX NEGATIVE CONSTRAINTS: Do NOT add bindi, tilak, heavy makeup, bright lipstick, glamour styling, heavy gold jewellery, bridal or ornate jewellery, stock-photo beauty aesthetic, artificial face smoothing, fashion-model look, nonsense text on any surface.`

**Example 2 — Inline image for "Best Books for UPSC Prelims":**

Before: `Create a contextual photorealistic editorial image for a section about "Recommended Study Materials"... very fair complexion, beautiful and handsome features...`

After: Same + FLUX realism layer appended, pushing toward a natural student browsing books at a desk with realistic environment.

## Files Changed Summary

| File | Change |
|---|---|
| `supabase/functions/_shared/blog-image-prompt-policy.ts` | Add `FLUX_STRICT_REALISM_RULES` constant + `applyFluxRealismLayer()` function |
| `supabase/functions/generate-vertex-image/index.ts` | Import `applyFluxRealismLayer`, call it in `generateViaAzureFlux()` (~1 line change) |

No other files touched. No routing changes. No selector changes. No storage changes.

