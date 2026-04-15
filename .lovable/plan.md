

# Fix: Ghost-White Skin Tones Across ALL Image Models

## Problem
Rule 10 in `BLOG_IMAGE_MANDATORY_RULES` (line 22 of `supabase/functions/_shared/blog-image-prompt-policy.ts`) contains **"very fair complexion, beautiful and handsome features, polished, aspirational, premium look"**. This is the shared prompt sent to **all** models — Gemini, Imagen, MAI-2, and others. Each interprets it too literally, producing unnaturally pale, ghost-white skin tones. Only FLUX has a separate realism layer that already patches this out.

## Fix

### 1. Update Rule 10 in `blog-image-prompt-policy.ts` (line 22)

**Before:**
> "very fair complexion, beautiful and handsome features, polished, aspirational, premium look"

**After:**
> "natural, healthy Indian skin tones with realistic warmth and subtle color variation, attractive and well-groomed features, clean and professional appearance"

This single-line change fixes the prompt for **all** models (Gemini, Imagen, MAI-2, etc.) at the source. The FLUX realism layer's regex replacements in `FLUX_SENSITIVE_APPEARANCE_REPLACEMENTS` (lines 135-148) that targeted "very fair complexion" will no longer match, but that's fine — the source text is already corrected and FLUX's own `FLUX_REALISM_POSITIVE` block already says "natural skin texture."

### 2. Update memory file `mem://style/ai-image-aesthetics`

Replace references to "very fair" and "fair complexion" with the new natural skin tone policy to prevent future regressions.

### Files Changed
1. `supabase/functions/_shared/blog-image-prompt-policy.ts` — Rule 10 (line 22)
2. `mem://style/ai-image-aesthetics` — updated policy wording

### What Does NOT Change
- FLUX realism layer (already handles skin tone correctly)
- No UI, layout, or ad changes
- No other rules modified
- No model routing changes

