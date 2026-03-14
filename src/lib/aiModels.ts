/**
 * Shared AI Model Registry — single source of truth for all admin model selectors.
 *
 * Every admin workflow (blog, enrichment, employment news, etc.) imports from here.
 * Models are tagged with capabilities and source so selectors can filter appropriately.
 */

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

/** Where the model comes from */
export type AiModelSource = 'built-in' | 'external-api';

/** What the model can do */
export type AiModelCapability = 'text' | 'text-premium' | 'image';

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
  },
  {
    value: 'gemini-pro',
    label: 'Gemini 2.5 Pro',
    desc: 'High quality · ~30s/page',
    speed: 30,
    source: 'built-in',
    provider: 'Google',
    capabilities: ['text', 'text-premium'],
  },
  {
    value: 'groq',
    label: 'Groq (Llama 3.3 70B)',
    desc: 'Fastest · ~10s/page · Great for bulk',
    speed: 10,
    source: 'built-in',
    provider: 'Groq',
    capabilities: ['text'],
  },
  {
    value: 'claude-sonnet',
    label: 'Claude Sonnet 4.6',
    desc: 'Highest quality · ~90s/page · Best for important pages',
    speed: 90,
    source: 'built-in',
    provider: 'Anthropic',
    capabilities: ['text', 'text-premium'],
  },
  {
    value: 'mistral',
    label: 'Mistral Large',
    desc: 'Good quality · ~30s/page',
    speed: 30,
    source: 'built-in',
    provider: 'Mistral',
    capabilities: ['text'],
  },
  {
    value: 'gpt5',
    label: 'OpenAI GPT-5',
    desc: 'Good all-rounder · ~30s/page',
    speed: 30,
    source: 'built-in',
    provider: 'OpenAI',
    capabilities: ['text', 'text-premium'],
  },
  {
    value: 'gpt5-mini',
    label: 'OpenAI GPT-5 Mini',
    desc: 'Fast · ~15s/page',
    speed: 15,
    source: 'built-in',
    provider: 'OpenAI',
    capabilities: ['text'],
  },
  {
    value: 'lovable-gemini',
    label: 'Lovable Gemini (Gateway)',
    desc: 'Via Lovable Gateway · ~20s/page',
    speed: 20,
    source: 'built-in',
    provider: 'Lovable',
    capabilities: ['text'],
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
  },
  {
    value: 'vertex-pro',
    label: 'Gemini 2.5 Pro (From API)',
    desc: 'Your API · Premium articles · ~45s',
    speed: 45,
    source: 'external-api',
    provider: 'Google Vertex AI',
    capabilities: ['text', 'text-premium'],
  },
  {
    value: 'vertex-imagen',
    label: 'Imagen (From API)',
    desc: 'Your API · Image generation',
    speed: 30,
    source: 'external-api',
    provider: 'Google Vertex AI',
    capabilities: ['image'],
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

/** Lookup a model by value key */
export function getModelDef(value: string): AiModelDef | undefined {
  return AI_MODELS.find(m => m.value === value);
}

/** Get speed for ETA calculations */
export function getModelSpeed(value: string): number {
  return getModelDef(value)?.speed ?? 30;
}

/** Check if a model is from an external API */
export function isExternalModel(value: string): boolean {
  return getModelDef(value)?.source === 'external-api';
}
