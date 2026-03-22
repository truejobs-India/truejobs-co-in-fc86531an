export interface SeoFixModelPolicy {
  retryCount: number;
  baseRetryDelayMs: number;
  throttleMs: number;
  maxOutputTokens: number;
}

const DEFAULT_POLICY: SeoFixModelPolicy = {
  retryCount: 2,
  baseRetryDelayMs: 2000,
  throttleMs: 1000,
  maxOutputTokens: 2048,
};

const MODEL_POLICIES: Partial<Record<string, SeoFixModelPolicy>> = {
  'gemini-pro': {
    retryCount: 5,
    baseRetryDelayMs: 3000,
    throttleMs: 3500,
    maxOutputTokens: 2048,
  },
  'gemini-flash': {
    retryCount: 4,
    baseRetryDelayMs: 1500,
    throttleMs: 1000,
    maxOutputTokens: 2048,
  },
  gpt5: {
    retryCount: 3,
    baseRetryDelayMs: 2500,
    throttleMs: 1000,
    maxOutputTokens: 2048,
  },
  'gpt5-mini': {
    retryCount: 3,
    baseRetryDelayMs: 2000,
    throttleMs: 750,
    maxOutputTokens: 2048,
  },
  'nova-pro': {
    retryCount: 2,
    baseRetryDelayMs: 2000,
    throttleMs: 750,
    maxOutputTokens: 2048,
  },
  'nova-premier': {
    retryCount: 2,
    baseRetryDelayMs: 2500,
    throttleMs: 1000,
    maxOutputTokens: 2048,
  },
  mistral: {
    retryCount: 2,
    baseRetryDelayMs: 2000,
    throttleMs: 750,
    maxOutputTokens: 2048,
  },
};

export function getSeoFixModelPolicy(aiModel: string): SeoFixModelPolicy {
  return {
    ...DEFAULT_POLICY,
    ...(MODEL_POLICIES[aiModel] || {}),
  };
}

export function getSeoFixRetryDelayMs(baseDelayMs: number, attemptIndex: number, maxDelayMs = 30_000): number {
  const exponentialDelay = Math.min(baseDelayMs * Math.pow(2, attemptIndex), maxDelayMs);
  const jitter = Math.floor(Math.random() * Math.max(250, exponentialDelay * 0.4));
  return Math.min(exponentialDelay + jitter, maxDelayMs);
}

export function isRetryableSeoFixStatus(status: number): boolean {
  return status === 429;
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}