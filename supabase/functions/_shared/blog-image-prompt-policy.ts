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

// ═══════════════════════════════════════════════════════════════
// FLUX-ONLY STRICT REALISM LAYER
// ═══════════════════════════════════════════════════════════════
//
// WHY THIS EXISTS:
//   FLUX.1-Kontext-pro interprets the shared BLOG_IMAGE_MANDATORY_RULES
//   (especially rule 10: "very fair complexion, beautiful and handsome
//   features, polished, aspirational, premium look") too literally,
//   producing glamorized, stock-photo-style images with stereotypical
//   beauty markers (bindi, heavy makeup, gold jewellery, fashion-model
//   look). This layer overrides those tendencies for FLUX only.
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
FLUX-SPECIFIC REALISM DIRECTIVES (override any conflicting aesthetic rules above):
Style: Documentary-style candid editorial photography with natural lighting and believable imperfections.
Subjects: Authentic ordinary Indian college-going students and aspirants aged 20–24 — NOT fashion models, NOT faculty, NOT office workers, NOT corporate professionals. Grounded everyday student clothing (simple kurta, t-shirt, jeans, salwar-kameez — whatever ordinary students actually wear). Natural skin texture with realistic pores and tonal variation. Realistic facial proportions and natural expressions — no surreal symmetry or artificial smoothing.
Gaze and behavior: Subjects must be visibly focused on study material — books, notebooks, printed notes, question papers, laptop screens, or whiteboard content. Gaze directed toward academic material, NOT toward each other or the camera. Body language must show real studying: reading, writing, solving, note-checking, or revision. If multiple students are present, they must be engaged in shared academic work over visible study material — their interaction must remain study-centered with the primary visual signal being exam preparation, revision, problem solving, or academic review. Social chemistry, conversational posing, and mutual attention to each other must never become the main scene. Even collaborative discussion must be visually anchored to shared notes, a textbook, or a screen — not to each other.
Environment: Realistic classroom, study desk, library, exam hall, coaching center, or campus setting. Desks and study surfaces must look actively used with believable academic clutter — open textbooks, scattered notes, stationery, admit-card-style sheets. Realistic object interaction: natural pen grip, correct notebook handling, proper arm posture on desk. No staged commercial setups, no decorative empty desks.
Anatomy: Anatomically correct hands with natural finger count (five per hand). Realistic pen grip, believable wrist posture, proper desk contact. No malformed or fused fingers, no extra digits, no broken wrists, no floating objects, no warped pages, no distorted teeth.
Jewellery: If any jewellery is present, keep it subtle, minimal, and like ordinary college-going students might wear (simple studs, thin chain). No heavy, ornate, or gold-dominant pieces.`;

const FLUX_REALISM_NEGATIVE = `
FLUX NEGATIVE CONSTRAINTS (strictly enforced defaults):
Do NOT depict: mutual eye contact between subjects, staring at each other, romantic pose or body language, social posing, interview-style conversation, teacher-student framing, office discussion setup, faculty appearance, corporate meeting vibe, camera-facing posed expressions, perfect-smile stock-photo energy, hyper-polished ad photography, fake study scene with decorative empty desks, over-aged subjects who look older than mid-20s.
Do NOT add: bindi, tilak, heavy makeup, bright lipstick, glam or beauty-editorial styling, fashion-model posing, stock-photo aesthetic, artificial face smoothing or over-retouching, surreal facial symmetry, plastic or oversmoothed skin, heavy gold jewellery, bridal jewellery, ornate festive jewellery, overdressed styling that does not fit ordinary college students, nonsense or gibberish text on blackboards or books or screens or walls or posters, decorative irrelevant cultural symbolism, ad-style commercial beauty photography.
Do NOT render: malformed hands, fused fingers, extra fingers, broken wrists, floating pens, warped pages, distorted teeth.`;

/** Keywords that signal the user explicitly wants cultural/styling elements — suppress conflicting negatives. */
const FLUX_USER_OVERRIDE_KEYWORDS = [
  'traditional', 'bridal', 'festive', 'bindi', 'tilak',
  'makeup', 'jewellery', 'jewelry', 'ornate', 'wedding',
  'ceremonial', 'ethnic wear', 'saree', 'lehenga',
];

/**
 * FLUX.1-Kontext is more sensitive than other providers to appearance-focused wording
 * in the shared mandatory rules (especially the "very fair complexion / beautiful and
 * handsome features / premium look" phrasing). Sanitize those phrases ONLY for FLUX
 * while leaving the shared policy untouched for other models.
 */
const FLUX_SENSITIVE_APPEARANCE_REPLACEMENTS: Array<[RegExp, string]> = [
  [
    /depict young Indian men and young Indian women with youthful appearance, very fair complexion, beautiful and handsome features, polished, aspirational, premium look\./i,
    'depict young Indian adults with a natural, healthy, realistic appearance appropriate to the article context.',
  ],
  [/\bvery fair complexion\b/gi, 'natural skin tone'],
  [/\bbeautiful and handsome features\b/gi, 'natural-looking features'],
  [/\bpolished,\s*aspirational,\s*premium look\b/gi, 'clean, credible, professional look'],
];

function sanitizePromptForFlux(prompt: string): string {
  let sanitized = prompt;
  for (const [pattern, replacement] of FLUX_SENSITIVE_APPEARANCE_REPLACEMENTS) {
    sanitized = sanitized.replace(pattern, replacement);
  }
  return sanitized;
}

/**
 * Apply the FLUX-only strict realism layer to a prompt.
 *
 * This function is called ONLY when the selected model is FLUX.
 * It first sanitizes appearance-focused phrases that can trigger Azure's
 * content blocklists, then appends positive realism directives and negative
 * constraints. It still respects explicit user intent — if the user's custom
 * prompt contains keywords like "traditional", "bridal", "bindi", etc.,
 * the negative constraints for those elements are softened.
 *
 * @param prompt     The fully-built image prompt (from buildBlogCoverPrompt or buildBlogInlinePrompt)
 * @param userPrompt Optional raw user-provided prompt text to check for override keywords
 * @returns          The prompt with FLUX realism layer appended
 */
export function applyFluxRealismLayer(
  prompt: string,
  userPrompt?: string,
): string {
  // First neutralize FLUX-sensitive appearance phrases from the shared policy
  let result = sanitizePromptForFlux(prompt) + '\n' + FLUX_REALISM_POSITIVE;

  // Check if user explicitly requested cultural/styling elements
  const lowerUser = (userPrompt || '').toLowerCase();
  const hasOverride = FLUX_USER_OVERRIDE_KEYWORDS.some(kw => lowerUser.includes(kw));

  if (hasOverride) {
    // User explicitly wants styling elements — skip the negative block
    // so their intent is preserved
    result += `\nNote: User has explicitly requested specific styling. Respect the user's styling choices while maintaining photorealistic quality.`;
  } else {
    // Default: apply full negative constraints
    result += '\n' + FLUX_REALISM_NEGATIVE;
  }

  return result;
}
