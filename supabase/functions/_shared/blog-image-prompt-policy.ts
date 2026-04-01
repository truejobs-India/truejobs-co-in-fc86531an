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
1. Absolutely NO Hindi text, Hinglish text, Devanagari script, or any Indic script anywhere in the image.
2. If any text is required, it MUST be in English only.
3. Strongly prefer images with NO visible text at all unless text is truly necessary.
4. Never use Hindi fonts, Devanagari, or any Indic script in any form.
5. Where human subjects are appropriate, depict young, very fair, very beautiful and handsome Indian men and women who look well-groomed and aspirational.
6. The image must be highly relevant to the specific article topic and context provided.
7. Avoid generic stock-style scenes that do not match the article context.
8. Do NOT include any text overlays, watermarks, official government seals, emblems, logos, or misleading official symbols.
9. Use warm, professional colors suitable for an Indian government jobs and exam preparation portal.`;

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
  const style = body.visualStyle || 'modern flat illustration';
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

  const base = `Create a contextual editorial illustration ${sectionContext} in a blog article titled "${title}" about ${category}. ${contextSnippet ? `Nearby content context: ${contextSnippet.substring(0, 250)}.` : ''}${body.excerpt ? ` Article summary: ${body.excerpt.substring(0, 150)}.` : ''} Style: clean, professional infographic or illustration suitable for inline blog placement. Aspect ratio 4:3. This image must be highly relevant to the exact paragraph or section described above, not just broadly relevant to the full article.`;

  return base + BLOG_IMAGE_MANDATORY_RULES;
}
