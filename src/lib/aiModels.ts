/**
 * Shared AI Model Registry — single source of truth for all admin model selectors.
 *
 * Every admin workflow (blog, enrichment, employment news, etc.) imports from here.
 * Models are tagged with capabilities, source, and long-form reliability metadata
 * so selectors can filter appropriately and warn about poor model choices.
 */

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

/** Where the model comes from */
export type AiModelSource = 'built-in' | 'external-api';

/** What the model can do */
export type AiModelCapability = 'text' | 'text-premium' | 'image';

/** How reliable this model is for long-form generation */
export type LongFormReliability = 'excellent' | 'good' | 'fair' | 'poor';

export interface AiModelDef {
  /** Unique key passed to edge functions as `aiModel` */
  value: string;
  /** Display label shown in selector dropdowns */
  label: string;
  /** Short description / performance hint */
  desc: string;
  /** Estimated seconds per task (for ETA calculations) */
  speed: number;
  /** Source: built-in (Lovable/platform) or external-api (user-connected) */
  source: AiModelSource;
  /** Provider group label for optional visual grouping */
  provider: string;
  /** What this model can do */
  capabilities: AiModelCapability[];

  // ── Long-form suitability metadata ──

  /** Max words this model can reliably produce in a single pass */
  recommendedMaxWords: number;
  /** Show a warning when word target exceeds this threshold */
  warnAboveWords: number;
  /** Overall reliability rating for 1000+ word generation */
  longFormReliability: LongFormReliability;
  /** Whether a continuation pass can recover meaningful content */
  supportsContinuationPass: boolean;
}

// ═══════════════════════════════════════════════════════════════
// Registry
// ═══════════════════════════════════════════════════════════════

export const AI_MODELS: readonly AiModelDef[] = [
  // ── Built-in models (platform-provided) ──
  {
    value: 'gemini-flash',
    label: 'Gemini 2.5 Flash',
    desc: 'Recommended · ~15s/page · Best for bulk',
    speed: 15,
    source: 'built-in',
    provider: 'Google',
    capabilities: ['text'],
    recommendedMaxWords: 1500,
    warnAboveWords: 1200,
    longFormReliability: 'good',
    supportsContinuationPass: true,
  },
  {
    value: 'gemini-pro',
    label: 'Gemini 2.5 Pro',
    desc: 'High quality · ~30s/page · Best for long-form',
    speed: 30,
    source: 'built-in',
    provider: 'Google',
    capabilities: ['text', 'text-premium'],
    recommendedMaxWords: 3000,
    warnAboveWords: 2500,
    longFormReliability: 'excellent',
    supportsContinuationPass: true,
  },
  {
    value: 'groq',
    label: 'Groq (Llama 3.3 70B)',
    desc: 'Fastest · ~10s/page · Best under 800 words',
    speed: 10,
    source: 'built-in',
    provider: 'Groq',
    capabilities: ['text'],
    recommendedMaxWords: 800,
    warnAboveWords: 600,
    longFormReliability: 'poor',
    supportsContinuationPass: false,
  },
  {
    value: 'claude-sonnet',
    label: 'Claude Sonnet 4.6',
    desc: 'Highest quality · ~90s/page · Excellent for long-form',
    speed: 90,
    source: 'external-api',
    provider: 'Anthropic',
    capabilities: ['text', 'text-premium'],
    recommendedMaxWords: 3000,
    warnAboveWords: 2500,
    longFormReliability: 'excellent',
    supportsContinuationPass: true,
  },
  {
    value: 'nova-pro',
    label: 'Amazon Nova Pro',
    desc: 'Good quality · ~25s/page · Usable up to 1500w with retry',
    speed: 25,
    source: 'built-in',
    provider: 'Amazon',
    capabilities: ['text'],
    recommendedMaxWords: 1500,
    warnAboveWords: 1200,
    longFormReliability: 'fair',
    supportsContinuationPass: true,
  },
  {
    value: 'nova-premier',
    label: 'Amazon Nova Premier',
    desc: 'Higher quality · ~45s/page · Reliable up to 1500w',
    speed: 45,
    source: 'built-in',
    provider: 'Amazon',
    capabilities: ['text', 'text-premium'],
    recommendedMaxWords: 1500,
    warnAboveWords: 1200,
    longFormReliability: 'good',
    supportsContinuationPass: true,
  },
  {
    value: 'mistral',
    label: 'Mistral Large',
    desc: 'Good quality · ~30s/page',
    speed: 30,
    source: 'built-in',
    provider: 'Mistral',
    capabilities: ['text'],
    recommendedMaxWords: 1200,
    warnAboveWords: 1000,
    longFormReliability: 'fair',
    supportsContinuationPass: true,
  },
  {
    value: 'gpt5',
    label: 'OpenAI GPT-5',
    desc: 'Good all-rounder · ~30s/page · Good for long-form',
    speed: 30,
    source: 'built-in',
    provider: 'OpenAI',
    capabilities: ['text', 'text-premium'],
    recommendedMaxWords: 2000,
    warnAboveWords: 1500,
    longFormReliability: 'good',
    supportsContinuationPass: true,
  },
  {
    value: 'gpt5-mini',
    label: 'OpenAI GPT-5 Mini',
    desc: 'Fast · ~15s/page',
    speed: 15,
    source: 'built-in',
    provider: 'OpenAI',
    capabilities: ['text'],
    recommendedMaxWords: 1200,
    warnAboveWords: 1000,
    longFormReliability: 'fair',
    supportsContinuationPass: true,
  },
  {
    value: 'lovable-gemini',
    label: 'Lovable Gemini (Gateway)',
    desc: 'Via Lovable Gateway · ~20s/page',
    speed: 20,
    source: 'built-in',
    provider: 'Lovable',
    capabilities: ['text'],
    recommendedMaxWords: 1500,
    warnAboveWords: 1200,
    longFormReliability: 'good',
    supportsContinuationPass: true,
  },

  // ── External API models (user-connected via GCP Service Account) ──
  {
    value: 'vertex-flash',
    label: 'Gemini 2.5 Flash (From API)',
    desc: 'Your API · Fast SEO & text · ~15s',
    speed: 15,
    source: 'external-api',
    provider: 'Google Vertex AI',
    capabilities: ['text'],
    recommendedMaxWords: 1500,
    warnAboveWords: 1200,
    longFormReliability: 'good',
    supportsContinuationPass: true,
  },
  {
    value: 'vertex-pro',
    label: 'Gemini 2.5 Pro (From API)',
    desc: 'Your API · Best for long-form & images · ~45s',
    speed: 45,
    source: 'external-api',
    provider: 'Google Vertex AI',
    capabilities: ['text', 'text-premium', 'image'],
    recommendedMaxWords: 3000,
    warnAboveWords: 2500,
    longFormReliability: 'excellent',
    supportsContinuationPass: true,
  },
  {
    value: 'vertex-3.1-pro',
    label: 'Gemini 3.1 Pro (Preview) (From API)',
    desc: 'Your API · Preview · Best reasoning · ~45s',
    speed: 45,
    source: 'external-api',
    provider: 'Google Vertex AI',
    capabilities: ['text', 'text-premium'],
    recommendedMaxWords: 3000,
    warnAboveWords: 2500,
    longFormReliability: 'excellent',
    supportsContinuationPass: true,
  },
  {
    value: 'vertex-3-flash',
    label: 'Gemini 3 Flash (From API)',
    desc: 'Your API · Fast next-gen · ~15s',
    speed: 15,
    source: 'external-api',
    provider: 'Google Vertex AI',
    capabilities: ['text'],
    recommendedMaxWords: 1500,
    warnAboveWords: 1200,
    longFormReliability: 'good',
    supportsContinuationPass: true,
  },
  {
    value: 'vertex-3.1-flash-lite',
    label: 'Gemini 3.1 Flash-Lite (From API)',
    desc: 'Your API · Fastest & cheapest · ~10s',
    speed: 10,
    source: 'external-api',
    provider: 'Google Vertex AI',
    capabilities: ['text'],
    recommendedMaxWords: 1000,
    warnAboveWords: 800,
    longFormReliability: 'fair',
    supportsContinuationPass: false,
  },
  {
    value: 'vertex-3-pro-image',
    label: 'Gemini 3 Pro Image (Preview) (From API)',
    desc: 'Your API · Premium image generation',
    speed: 40,
    source: 'external-api',
    provider: 'Google Vertex AI',
    capabilities: ['image'],
    recommendedMaxWords: 0,
    warnAboveWords: 0,
    longFormReliability: 'poor',
    supportsContinuationPass: false,
  },
  {
    value: 'vertex-imagen',
    label: 'Imagen (From API)',
    desc: 'Your API · Image generation',
    speed: 30,
    source: 'external-api',
    provider: 'Google Vertex AI',
    capabilities: ['image'],
    recommendedMaxWords: 0,
    warnAboveWords: 0,
    longFormReliability: 'poor',
    supportsContinuationPass: false,
  },
  {
    value: 'vertex-flash-image',
    label: 'Gemini 2.5 Flash Image (From API)',
    desc: 'Your API · Fast image generation via Vertex AI',
    speed: 20,
    source: 'external-api',
    provider: 'Google Vertex AI',
    capabilities: ['image'],
    recommendedMaxWords: 0,
    warnAboveWords: 0,
    longFormReliability: 'poor',
    supportsContinuationPass: false,
  },
  {
    value: 'vertex-3.1-flash-image',
    label: 'Gemini 3.1 Flash Image (From API)',
    desc: 'Your API · Fast + pro quality images',
    speed: 25,
    source: 'external-api',
    provider: 'Google Vertex AI',
    capabilities: ['image'],
    recommendedMaxWords: 0,
    warnAboveWords: 0,
    longFormReliability: 'poor',
    supportsContinuationPass: false,
  },
  {
    value: 'gemini-flash-image',
    label: 'Gemini 2.5 Flash Image',
    desc: 'Lovable AI · Fast image generation',
    speed: 20,
    source: 'built-in',
    provider: 'Google',
    capabilities: ['image'],
    recommendedMaxWords: 0,
    warnAboveWords: 0,
    longFormReliability: 'poor',
    supportsContinuationPass: false,
  },
  {
    value: 'gemini-pro-image',
    label: 'Gemini 3 Pro Image',
    desc: 'Lovable AI · Premium image quality',
    speed: 40,
    source: 'built-in',
    provider: 'Google',
    capabilities: ['image'],
    recommendedMaxWords: 0,
    warnAboveWords: 0,
    longFormReliability: 'poor',
    supportsContinuationPass: false,
  },
  {
    value: 'gemini-flash-image-2',
    label: 'Gemini 3.1 Flash Image',
    desc: 'Lovable AI · Fast + pro quality',
    speed: 25,
    source: 'built-in',
    provider: 'Google',
    capabilities: ['image'],
    recommendedMaxWords: 0,
    warnAboveWords: 0,
    longFormReliability: 'poor',
    supportsContinuationPass: false,
  },

  // ── Amazon Bedrock image model ──
  {
    value: 'nova-canvas',
    label: 'Amazon Nova Canvas (From API)',
    desc: 'Your API · Image generation · ~20s',
    speed: 20,
    source: 'external-api',
    provider: 'Amazon',
    capabilities: ['image'],
    recommendedMaxWords: 0,
    warnAboveWords: 0,
    longFormReliability: 'poor',
    supportsContinuationPass: false,
  },

  // ── Sarvam AI models (Indian languages specialist) ──
  {
    value: 'sarvam-30b',
    label: 'Sarvam 30B',
    desc: 'Indian languages · 30B MoE · ~25s/page',
    speed: 25,
    source: 'external-api',
    provider: 'Sarvam AI',
    capabilities: ['text'],
    recommendedMaxWords: 1500,
    warnAboveWords: 1200,
    longFormReliability: 'good',
    supportsContinuationPass: false,
  },
  {
    value: 'sarvam-105b',
    label: 'Sarvam 105B',
    desc: 'Indian languages · Flagship · ~45s/page',
    speed: 45,
    source: 'external-api',
    provider: 'Sarvam AI',
    capabilities: ['text', 'text-premium'],
    recommendedMaxWords: 2000,
    warnAboveWords: 1500,
    longFormReliability: 'good',
    supportsContinuationPass: false,
  },
] as const;

// ═══════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════

/** Get models filtered by capability */
export function getModelsByCapability(cap: AiModelCapability): AiModelDef[] {
  return AI_MODELS.filter(m => m.capabilities.includes(cap));
}

/** Get text-capable models (excludes image-only) */
export function getTextModels(): AiModelDef[] {
  return AI_MODELS.filter(m => m.capabilities.includes('text') || m.capabilities.includes('text-premium'));
}

/** Get image-capable models */
export function getImageModels(): AiModelDef[] {
  return AI_MODELS.filter(m => m.capabilities.includes('image'));
}

/** SEO Fix All only supports these UI model keys safely. */
export const SEO_FIX_MODEL_VALUES = [
  'gemini-flash',
  'gemini-pro',
  'gpt5-mini',
  'gpt5',
  'lovable-gemini',
  'nova-pro',
  'nova-premier',
  'mistral',
  'vertex-3.1-pro',
  'vertex-3-flash',
  'vertex-3.1-flash-lite',
] as const;

const LEGACY_MODEL_ALIASES: Record<string, string> = {
  'google/gemini-2.5-flash': 'gemini-flash',
  'google/gemini-2.5-pro': 'gemini-pro',
  'openai/gpt-5-mini': 'gpt5-mini',
  'openai/gpt-5': 'gpt5',
  'openai/gpt-5-nano': 'gpt5-mini',
  'google/gemini-3-flash-preview': 'vertex-3-flash',
  'google/gemini-3.1-pro-preview': 'vertex-3.1-pro',
  'google/gemini-3.1-flash-lite-preview': 'vertex-3.1-flash-lite',
  'google/gemini-3-pro-image-preview': 'vertex-3-pro-image',
  'vertex-flash': 'gemini-flash',
  'vertex-pro': 'gemini-pro',
  'groq': 'gemini-flash',
  'claude-sonnet': 'gemini-pro',
};

/** Normalize saved/legacy model values to a current registry key. */
export function normalizeAiModelValue(value: string | null | undefined, fallback = 'gemini-flash'): string {
  if (!value) return fallback;
  if (AI_MODELS.some(m => m.value === value)) return value;
  return LEGACY_MODEL_ALIASES[value] || fallback;
}

/** Lookup a model by value key */
export function getModelDef(value: string): AiModelDef | undefined {
  return AI_MODELS.find(m => m.value === value);
}

/** Human label for a model key, with safe fallback. */
export function getModelLabel(value: string): string {
  const normalized = normalizeAiModelValue(value, value);
  return getModelDef(normalized)?.label || value;
}

/** Get speed for ETA calculations */
export function getModelSpeed(value: string): number {
  return getModelDef(normalizeAiModelValue(value, 'gemini-pro'))?.speed ?? 30;
}

/** Check if a model is from an external API */
export function isExternalModel(value: string): boolean {
  return getModelDef(normalizeAiModelValue(value, 'gemini-flash'))?.source === 'external-api';
}

/**
 * Get recommended models for a given word target, sorted by suitability.
 * Returns models whose recommendedMaxWords >= target, sorted best-first.
 */
export function getRecommendedModelsForTarget(
  targetWords: number,
  capability: AiModelCapability = 'text',
): AiModelDef[] {
  const reliabilityOrder: Record<LongFormReliability, number> = {
    excellent: 0,
    good: 1,
    fair: 2,
    poor: 3,
  };

  return AI_MODELS
    .filter(m =>
      m.capabilities.includes(capability) &&
      m.recommendedMaxWords >= targetWords
    )
    .sort((a, b) => {
      // Sort by reliability first, then by speed (faster is better)
      const rDiff = reliabilityOrder[a.longFormReliability] - reliabilityOrder[b.longFormReliability];
      if (rDiff !== 0) return rDiff;
      return a.speed - b.speed;
    });
}

/**
 * Check if a model is suitable for a given word target.
 * Returns: 'ok' | 'warn' | 'avoid'
 */
export function checkModelSuitability(
  modelValue: string,
  targetWords: number,
): 'ok' | 'warn' | 'avoid' {
  const model = getModelDef(modelValue);
  if (!model) return 'ok';
  if (targetWords <= model.warnAboveWords) return 'ok';
  if (targetWords <= model.recommendedMaxWords) return 'warn';
  return 'avoid';
}
