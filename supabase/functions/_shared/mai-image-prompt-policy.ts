/**
 * ════════════════════════════════════════════════════════════════
 * MAI-Image-2 Dedicated Prompt Policy — TrueJobs Article Images
 * ════════════════════════════════════════════════════════════════
 *
 * This module exists ONLY for Azure MAI-Image-2.
 * It reinforces the shared blog image prompt policy with
 * MAI-Image-2-specific ethnicity and skin-tone guard directives.
 *
 * WHY a separate policy?
 *   MAI-Image-2 (Microsoft's image generation model) tends to
 *   drift toward Caucasian/European-looking subjects even when
 *   the prompt says "Indian". This layer adds explicit,
 *   unambiguous reinforcement to ensure subjects look
 *   authentically Indian with natural skin tones.
 *
 * DO NOT modify other model prompt builders. They remain untouched.
 * ════════════════════════════════════════════════════════════════
 */

const MAI_ETHNICITY_GUARD = [
  'CRITICAL SUBJECT DIRECTIVE FOR THIS IMAGE:',
  'All human subjects MUST be ethnically Indian — South Asian descent with natural brown/wheatish/dusky Indian skin tones.',
  'Skin color must show realistic melanin warmth typical of young Indians aged 18–25 — NOT white, NOT pale, NOT Caucasian, NOT East Asian, NOT European-looking.',
  'Think of the natural skin tones you would see on a college campus in Delhi, Mumbai, Bangalore, or Hyderabad — a range from light brown to medium brown, with warm undertones.',
  'Do NOT default to Western/European-looking subjects. Do NOT use ghost-white or porcelain skin. Do NOT use pink-toned Caucasian skin.',
  'Subjects should have dark hair (black or very dark brown), dark eyes (brown or dark brown), and facial features typical of Indian/South Asian people.',
  'Hair should be natural black or dark brown — never blonde, red, or light brown.',
  'Clothing should be contextually Indian — casual kurta, salwar-kameez, simple shirt, or jeans-and-shirt combination appropriate for Indian students.',
  'The setting should feel like India — Indian-style buildings, classrooms, libraries, parks, or offices with Indian architectural cues.',
].join(' ');

const MAI_ANTI_DRIFT = [
  'STRICT PROHIBITIONS:',
  'No Caucasian-looking subjects. No European-looking subjects. No blonde hair. No blue or green eyes.',
  'No unnaturally pale or ghost-white skin. No pink-toned skin.',
  'No Western office stereotypes (glass skyscrapers, American cubicles) unless explicitly required by topic.',
  'No generic stock-photo composition with non-Indian-looking people.',
  'All faces must appear authentically South Asian/Indian.',
].join(' ');

/**
 * Apply MAI-Image-2-specific prompt reinforcement.
 * Wraps the base prompt with ethnicity and skin-tone guard directives.
 *
 * @param basePrompt - The base prompt from the shared blog image policy
 * @returns Reinforced prompt for MAI-Image-2
 */
export function applyMaiImagePromptGuard(basePrompt: string): string {
  return `${MAI_ETHNICITY_GUARD}\n\n${basePrompt}\n\n${MAI_ANTI_DRIFT}`;
}
