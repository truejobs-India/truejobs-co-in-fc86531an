export interface SeoFixRuntimeConfig {
  maxConcurrency: number;
  retryCount: number;
  baseRetryDelayMs: number;
  throttleMs: number;
}

const DEFAULT_CONFIG: SeoFixRuntimeConfig = {
  maxConcurrency: 2,
  retryCount: 1,
  baseRetryDelayMs: 2000,
  throttleMs: 2000,
};

const MODEL_CONFIGS: Partial<Record<string, SeoFixRuntimeConfig>> = {
  'gemini-pro': {
    maxConcurrency: 1,
    retryCount: 2,
    baseRetryDelayMs: 4000,
    throttleMs: 7000,
  },
  'gemini-flash': {
    maxConcurrency: 2,
    retryCount: 1,
    baseRetryDelayMs: 2000,
    throttleMs: 2500,
  },
  gpt5: {
    maxConcurrency: 1,
    retryCount: 1,
    baseRetryDelayMs: 2500,
    throttleMs: 3000,
  },
  'gpt5-mini': {
    maxConcurrency: 2,
    retryCount: 1,
    baseRetryDelayMs: 2000,
    throttleMs: 2500,
  },
  'nova-pro': {
    maxConcurrency: 2,
    retryCount: 1,
    baseRetryDelayMs: 2000,
    throttleMs: 2500,
  },
  'nova-premier': {
    maxConcurrency: 1,
    retryCount: 1,
    baseRetryDelayMs: 2500,
    throttleMs: 3000,
  },
  'vertex-3.1-pro': {
    maxConcurrency: 1,
    retryCount: 2,
    baseRetryDelayMs: 4000,
    throttleMs: 7000,
  },
  'vertex-3-flash': {
    maxConcurrency: 2,
    retryCount: 1,
    baseRetryDelayMs: 2000,
    throttleMs: 2500,
  },
  'vertex-3.1-flash-lite': {
    maxConcurrency: 3,
    retryCount: 1,
    baseRetryDelayMs: 1500,
    throttleMs: 1500,
  },
  'azure-gpt4o-mini': {
    maxConcurrency: 2,
    retryCount: 1,
    baseRetryDelayMs: 2000,
    throttleMs: 2000,
  },
};

export function getSeoFixRuntimeConfig(aiModel: string): SeoFixRuntimeConfig {
  return {
    ...DEFAULT_CONFIG,
    ...(MODEL_CONFIGS[aiModel] || {}),
  };
}

export function getSeoFixRetryDelayMs(baseDelayMs: number, attemptIndex: number, maxDelayMs = 30_000): number {
  const exponentialDelay = Math.min(baseDelayMs * Math.pow(2, attemptIndex), maxDelayMs);
  const jitter = Math.floor(Math.random() * Math.max(250, exponentialDelay * 0.4));
  return Math.min(exponentialDelay + jitter, maxDelayMs);
}

export function isRetryableSeoFixReason(reason?: string | null): boolean {
  if (!reason) return false;
  return /\b429\b|rate limit|rate limited|too many requests|resource_exhausted/i.test(reason);
}