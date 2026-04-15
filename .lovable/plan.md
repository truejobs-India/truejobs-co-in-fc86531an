<final-text>Do I know what the issue is? Yes.

What I found
- The MAI2 request is already using the updated shared Rule 10. The captured `promptUsed` now contains “natural, healthy Indian skin tones...”, so the old `very fair complexion` text is not what MAI2 is receiving in this regenerate flow.
- The problem is now twofold:
  1. MAI2 still only gets the generic shared prompt, which is not strong enough to prevent white/Caucasian subject drift for this provider.
  2. Regeneration writes back to the exact same public file path (`covers/<slug>-mai-image-2.png`). Because images are cached aggressively, the UI can keep showing the previous cached image after overwrite, making it look like the exact same white-man image was generated again.
- I also found other prompt sources that still contain `fair` / `fair-skinned` wording, so the previous fix was not fully propagated across the whole image pipeline.

Plan
1. Add a MAI2-only prompt guard
- Create a dedicated MAI2 prompt layer and use it only in `generateViaAzureMaiImage`.
- Keep the shared blog policy, but add MAI2-specific reinforcement such as:
  - explicitly Indian subjects
  - explicitly not Caucasian/European-looking subjects
  - no ghost-white / unnaturally pale skin
  - realistic Indian skin warmth, variation, texture
  - no generic Western stock-photo office look
- Keep model routing unchanged.

2. Fix stale-image regeneration
- Stop reusing the same MAI2 filename on every regenerate.
- Save each new MAI2 render to a versioned path, then store that fresh URL on the article.
- Optionally delete the prior generated cover file when replacing it, to avoid storage buildup.
- This removes the “same image still showing” cache problem without weakening site performance.

3. Expose provider rewrite/debug info
- Surface Azure’s `revisedPrompt` in the MAI2 response/debug payload so we can confirm whether the provider is rewriting the prompt in a problematic way.
- Keep this admin/debug only.

4. Remove remaining fair-skin regressions elsewhere
- Replace remaining `fair` / `fair-skinned` prompt wording in:
  - `supabase/functions/generate-vertex-image/index.ts` (Nova Canvas block)
  - `supabase/functions/_shared/flux2-prompt-policy.ts`
  - `supabase/functions/firecrawl-ai-enrich/index.ts`
  - `supabase/functions/generate-resource-image/index.ts`
  - `mem://style/ai-image-aesthetics`
- Normalize all of them to the same natural Indian skin-tone policy.

5. Verify end to end
- Regenerate the same article with MAI2 and confirm:
  - stronger MAI2 guard is present
  - the returned image URL changes on each regenerate
  - the visible image actually changes
  - the result no longer shows a white/non-Indian man
- Then spot-check one other model to ensure the wording cleanup did not create regressions.

Files to change
- `supabase/functions/generate-vertex-image/index.ts`
- New shared helper: `supabase/functions/_shared/mai-image-prompt-policy.ts`
- `supabase/functions/_shared/flux2-prompt-policy.ts`
- `supabase/functions/firecrawl-ai-enrich/index.ts`
- `supabase/functions/generate-resource-image/index.ts`
- `mem://style/ai-image-aesthetics`

What will not change
- No fallback behavior
- No layout/UI redesign
- No ad placement changes
- No model routing changes</final-text>