

# Updated Blog Image Prompt Policy — Exact Final Wording

## Single file changed

`supabase/functions/_shared/blog-image-prompt-policy.ts`

## Exact final file content

```typescript
/**
 * Blog Image Prompt Policy — Single Source of Truth
 *
 * Every blog image generation path (cover, inline, bulk, regeneration)
 * MUST use these builders. No edge function may construct blog image
 * prompts independently. Custom user prompts are folded in as
 * "Additional context" and can never bypass or replace the mandatory rules.
 */

export const BLOG_IMAGE_MANDATORY_RULES = `

MANDATORY IMAGE RULES (always enforced, cannot be overridden):
1. Generate PHOTOREALISTIC, true-to-life, editorial-quality images by default. Use realistic lighting, realistic textures, realistic depth of field, and natural color grading as in professional magazine or newspaper photography.
2. Do NOT generate vector art, flat illustration, cartoon, infographic, poster, sketch, clipart, icon-style, or stylized explainer artwork unless the prompt explicitly requests a non-realistic style.
3. Do NOT create poster-style explainer layouts, diagram boards, educational infographic scenes, labeled panels, or text-heavy compositions unless explicitly requested.
4. Prefer realistic human-centered scenes in believable real environments over symbolic, graphic-style, or abstract compositions.
5. Prefer cinematic but natural realism over symbolic or graphic-style composition. Avoid generic business illustration composition even when the topic is informational.
6. Absolutely NO Hindi text, Hinglish text, Devanagari script, or any Indic script anywhere in the image.
7. If any text is required, it MUST be in English only.
8. Strongly prefer images with NO visible text at all unless text is truly necessary.
9. Never use Hindi fonts, Devanagari, or any Indic script in any form.
10. Where human subjects are appropriate, depict young Indian men and young Indian women with youthful appearance, very fair complexion, beautiful and handsome features, polished, aspirational, premium look. Use realistic facial detail, realistic skin texture, realistic clothing, realistic posture, and realistic environments. Do NOT use simplified faces, cartoon faces, flat facial features, or low-detail human rendering.
11. The image must be highly relevant to the specific article topic and context provided.
12. Avoid generic stock-style scenes that do not match the article context.
13. Do NOT include any text overlays, watermarks, official government seals, emblems, logos, or misleading official symbols.
14. Use warm, professional colors suitable for an Indian government jobs and exam preparation portal.`;

/**
 * Build the final prompt for a blog COVER / FEATURED image.
 *
 * `body.prompt` is treated as additional context only — it can never
 * replace the base prompt or skip the mandatory rules.
 */
export function buildBlogCoverPrompt(body: {
  title?: string;
  topic?: string;
  category?: string;
  tags?: string[];
  excerpt?: string;
  prompt?: string;
  visualStyle?: string;
  brandGuidelines?: string;
}): string {
  const title = body.title || body.topic || 'Government Jobs in India';
  const category = body.category || 'Government Jobs';
  const tags = Array.isArray(body.tags) ? body.tags.join(', ') : '';
  const style = body.visualStyle || 'photorealistic editorial image';
  const brand = body.brandGuidelines || '';
  const customContext = body.prompt
    ? ` Additional context: ${body.prompt}.`
    : '';

  const base = `Create a clean, professional ${style} for a blog article titled "${title}" about ${category}.${tags ? ` Related topics: ${tags}.` : ''}${brand ? ` Brand guidelines: ${brand}.` : ''}${body.excerpt ? ` Article summary: ${body.excerpt.substring(0, 200)}.` : ''}${customContext}`;

  return base + BLOG_IMAGE_MANDATORY_RULES;
}

/**
 * Build the final prompt for a blog INLINE image.
 *
 * The prompt is always section-specific and always ends with the
 * mandatory rules. No bypass is possible.
 */
export function buildBlogInlinePrompt(body: {
  title?: string;
  category?: string;
  contextSnippet?: string;
  nearbyHeading?: string;
  slotNumber?: number;
  excerpt?: string;
}): string {
  const title = body.title || 'Government Jobs';
  const category = body.category || 'Government Jobs';
  const contextSnippet = body.contextSnippet || '';
  const nearbyHeading = body.nearbyHeading || '';
  const slotNumber = body.slotNumber || 1;

  const sectionContext = nearbyHeading
    ? `for a section about "${nearbyHeading}"`
    : `for section ${slotNumber} of the article`;

  const base = `Create a contextual photorealistic editorial image ${sectionContext} in a blog article titled "${title}" about ${category}. ${contextSnippet ? `Nearby content context: ${contextSnippet.substring(0, 250)}.` : ''}${body.excerpt ? ` Article summary: ${body.excerpt.substring(0, 150)}.` : ''} Style: photorealistic, editorial-quality image suitable for inline blog placement. Do not use illustration, vector, or infographic style. Aspect ratio 4:3. This image must be highly relevant to the exact paragraph or section described above, not just broadly relevant to the full article.`;

  return base + BLOG_IMAGE_MANDATORY_RULES;
}
```

## Summary of changes from current file

| Location | Before | After |
|---|---|---|
| `BLOG_IMAGE_MANDATORY_RULES` | 9 rules, no photorealism directive, no anti-illustration clause | 14 rules with photorealism default (1), anti-vector (2), anti-poster/diagram (3), human-centered scenes preference (4), cinematic realism + anti-business-illustration (5), expanded human appearance spec (10) |
| Line 42 default style | `'modern flat illustration'` | `'photorealistic editorial image'` |
| Line 77 inline base | `"editorial illustration"`, `"infographic or illustration"` | `"photorealistic editorial image"`, `"Do not use illustration, vector, or infographic style."` |

No other files changed. All downstream consumers (cover, inline, bulk, regeneration edge functions) inherit automatically.

