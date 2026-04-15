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
10. Where human subjects are appropriate, depict young Indian men and young Indian women with youthful appearance, natural, healthy Indian skin tones with realistic warmth and subtle color variation, attractive and well-groomed features, clean and professional appearance. Use realistic facial detail, realistic skin texture, realistic clothing, realistic posture, and realistic environments. Do NOT use simplified faces, cartoon faces, flat facial features, or low-detail human rendering.
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

// ═══════════════════════════════════════════════════════════════
// FLUX-ONLY STRICT REALISM LAYER
// ═══════════════════════════════════════════════════════════════
//
// WHY THIS EXISTS:
//   FLUX.1-Kontext-pro interprets appearance-related wording too
//   literally, producing glamorized, stock-photo-style images with
//   stereotypical beauty markers (bindi, heavy makeup, gold jewellery,
//   fashion-model look). This layer overrides those tendencies for
//   FLUX only.
//
// HOW TO TUNE:
//   - Edit FLUX_REALISM_POSITIVE / FLUX_REALISM_NEGATIVE below.
//   - The applyFluxRealismLayer() function is called ONLY inside
//     generateViaAzureFlux() in generate-vertex-image/index.ts.
//   - No other model is affected. Gemini, Imagen, OpenAI etc. still
//     receive the original BLOG_IMAGE_MANDATORY_RULES unchanged.
//
// HOW TO UPDATE SAFELY:
//   1. Only modify the constants in this section.
//   2. Do NOT change BLOG_IMAGE_MANDATORY_RULES or the shared builders
//      above — those serve all non-FLUX models.
//   3. Test by generating a FLUX cover image from the admin panel.
// ═══════════════════════════════════════════════════════════════

const FLUX_REALISM_POSITIVE = `
FLUX-SPECIFIC GUIDANCE:
Photorealistic editorial-style image in an Indian education, exam, recruitment, or career-guidance context.
Show ordinary young Indian adults in a believable real-world scene that matches the article topic.
Use natural skin texture, natural expressions, everyday clothing, realistic anatomy, and realistic hands.
Focus the scene on study, reading, writing, reviewing notes, checking a notice, using a laptop, or discussing application details.
Keep the styling neutral, grounded, and documentary-like rather than glamorous or symbolic.
No visible text overlays, logos, watermarks, seals, or readable signage.
Avoid poster-style layouts, infographic styling, heavy adornment, and exaggerated beauty-shoot aesthetics.`;

/** Keywords that signal the user explicitly wants cultural/styling elements — suppress conflicting negatives. */
const FLUX_USER_OVERRIDE_KEYWORDS = [
  'traditional', 'bridal', 'festive', 'bindi', 'tilak',
  'makeup', 'jewellery', 'jewelry', 'ornate', 'wedding',
  'ceremonial', 'ethnic wear', 'saree', 'lehenga',
];

/**
 * FLUX.1-Kontext is more sensitive than other providers to appearance-focused wording
 * and long negative lists. Sanitize those phrases ONLY for FLUX while leaving the
 * shared policy untouched for other models.
 */
const FLUX_SENSITIVE_APPEARANCE_REPLACEMENTS: Array<[RegExp, string]> = [
  [/Absolutely NO Hindi text, Hinglish text, Devanagari script, or any Indic script anywhere in the image\./gi, 'Do not include visible text in the image.'],
  [/If any text is required, it MUST be in English only\./gi, 'Avoid readable text whenever possible.'],
  [/Strongly prefer images with NO visible text at all unless text is truly necessary\./gi, 'Prefer no readable text.'],
  [/Never use Hindi fonts, Devanagari, or any Indic script in any form\./gi, 'Do not include readable text or script.'],
  [/Do NOT include any text overlays, watermarks, official government seals, emblems, logos, or misleading official symbols\./gi, 'Do not include text overlays, watermarks, seals, emblems, or logos.'],
];

function sanitizePromptForFlux(prompt: string): string {
  let sanitized = prompt;
  for (const [pattern, replacement] of FLUX_SENSITIVE_APPEARANCE_REPLACEMENTS) {
    sanitized = sanitized.replace(pattern, replacement);
  }
  return sanitized;
}

function extractFluxSafeBasePrompt(prompt: string): string {
  const marker = 'MANDATORY IMAGE RULES';
  const markerIndex = prompt.indexOf(marker);
  const base = markerIndex >= 0 ? prompt.slice(0, markerIndex) : prompt;
  return base.replace(/\s+/g, ' ').trim();
}

/**
 * Apply the FLUX-only compact realism layer to a prompt.
 *
 * This function is called ONLY when the selected model is FLUX.
 * It strips the long shared rule block, sanitizes sensitive wording,
 * and replaces it with a shorter FLUX-safe guidance block to reduce
 * Azure content-filter false positives.
 */
export function applyFluxRealismLayer(
  prompt: string,
  userPrompt?: string,
): string {
  const safeBasePrompt = sanitizePromptForFlux(extractFluxSafeBasePrompt(prompt));
  let result = `${safeBasePrompt}\n\n${FLUX_REALISM_POSITIVE}`;

  const lowerUser = (userPrompt || '').toLowerCase();
  const hasOverride = FLUX_USER_OVERRIDE_KEYWORDS.some(kw => lowerUser.includes(kw));

  if (hasOverride) {
    result += '\n\nRespect any explicitly requested cultural styling while keeping the image photorealistic and grounded.';
  } else {
    result += '\n\nKeep accessories minimal, avoid heavy ceremonial styling, and keep the scene visually neutral and grounded.';
  }

  return result;
}
