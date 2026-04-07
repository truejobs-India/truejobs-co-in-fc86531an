/**
 * imageRequestQueue — Serializes image generation requests to avoid Vertex AI 429 rate limits.
 * 
 * All bulk image callers should use `enqueueImageRequest()` instead of calling
 * `supabase.functions.invoke('generate-vertex-image', ...)` directly.
 * 
 * Features:
 * - Global singleton queue — only ONE image request in-flight at a time
 * - Configurable inter-request cooldown (default 35s for Vertex AI)
 * - Automatic retry with exponential backoff on 429
 * - Abort support via AbortSignal
 */
import { supabase } from '@/integrations/supabase/client';

interface QueuedRequest {
  body: Record<string, unknown>;
  resolve: (value: ImageQueueResult) => void;
  reject: (reason: unknown) => void;
  signal?: AbortSignal;
}

export interface ImageQueueResult {
  success: boolean;
  data?: any;
  error?: string;
  retryAfterMs?: number;
  rateLimited?: boolean;
}

// ── Configuration ──
const DEFAULT_COOLDOWN_MS = 35_000;     // 35s between requests
const RATE_LIMIT_COOLDOWN_MS = 60_000;  // 60s cooldown after a 429
const MAX_CLIENT_RETRIES = 2;           // retry 429s up to 2 times
const RETRY_BACKOFF_BASE = 45_000;      // 45s, 90s backoff

// ── Singleton state ──
let queue: QueuedRequest[] = [];
let processing = false;
let lastRequestEndMs = 0;
let cooldownMs = DEFAULT_COOLDOWN_MS;

/** Set the inter-request cooldown (milliseconds). */
export function setImageQueueCooldown(ms: number) {
  cooldownMs = Math.max(1000, ms);
}

/** Get current queue depth. */
export function getImageQueueDepth(): number {
  return queue.length;
}

/** Clear all pending (not yet started) jobs from the queue. */
export function clearImageQueue() {
  const pending = queue.splice(0);
  for (const item of pending) {
    item.reject(new Error('Queue cleared'));
  }
}

/**
 * Enqueue an image generation request. Returns a promise that resolves
 * when the request completes (after waiting its turn in the queue).
 */
export function enqueueImageRequest(
  body: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<ImageQueueResult> {
  return new Promise<ImageQueueResult>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error('Aborted before enqueue'));
      return;
    }
    queue.push({ body, resolve, reject, signal });
    processQueue();
  });
}

async function processQueue() {
  if (processing) return;
  processing = true;

  while (queue.length > 0) {
    const item = queue.shift()!;

    // Check abort
    if (item.signal?.aborted) {
      item.reject(new Error('Aborted'));
      continue;
    }

    // Enforce cooldown
    const elapsed = Date.now() - lastRequestEndMs;
    const waitMs = Math.max(0, cooldownMs - elapsed);
    if (waitMs > 0 && lastRequestEndMs > 0) {
      await sleep(waitMs, item.signal);
      if (item.signal?.aborted) {
        item.reject(new Error('Aborted during cooldown'));
        continue;
      }
    }

    // Execute with retry
    let result: ImageQueueResult;
    try {
      result = await executeWithRetry(item.body, item.signal);
      item.resolve(result);
    } catch (err: any) {
      item.reject(err);
    }

    lastRequestEndMs = Date.now();

    // Extra cooldown after 429
    if (result! && result.rateLimited) {
      const extraWait = result.retryAfterMs || RATE_LIMIT_COOLDOWN_MS;
      await sleep(extraWait, item.signal);
      lastRequestEndMs = Date.now();
    }
  }

  processing = false;
}

async function executeWithRetry(
  body: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<ImageQueueResult> {
  for (let attempt = 0; attempt <= MAX_CLIENT_RETRIES; attempt++) {
    if (signal?.aborted) throw new Error('Aborted');

    const { data, error } = await supabase.functions.invoke('generate-vertex-image', { body });

    // Supabase client error (network, auth, etc.)
    if (error) {
      const msg = error.message || '';
      // If it's a 429 from the edge function, data may still contain info
      if (msg.includes('429') || msg.includes('rate limit')) {
        if (attempt < MAX_CLIENT_RETRIES) {
          const backoff = RETRY_BACKOFF_BASE * Math.pow(2, attempt);
          console.warn(`[imageQueue] 429 on attempt ${attempt + 1}, waiting ${backoff / 1000}s`);
          await sleep(backoff, signal);
          continue;
        }
        return { success: false, error: msg, rateLimited: true, retryAfterMs: RATE_LIMIT_COOLDOWN_MS };
      }
      return { success: false, error: msg };
    }

    // Edge function returned a response
    if (data?.success === false) {
      const errMsg = data.error || 'Unknown error';
      const is429 = errMsg.toLowerCase().includes('rate limit') || errMsg.includes('429');
      if (is429 && attempt < MAX_CLIENT_RETRIES) {
        const backoff = RETRY_BACKOFF_BASE * Math.pow(2, attempt);
        console.warn(`[imageQueue] Rate limited (response), attempt ${attempt + 1}, waiting ${backoff / 1000}s`);
        await sleep(backoff, signal);
        continue;
      }
      return { success: false, error: errMsg, rateLimited: is429, retryAfterMs: is429 ? RATE_LIMIT_COOLDOWN_MS : undefined };
    }

    // Success
    return { success: true, data };
  }

  return { success: false, error: 'Exhausted client retries', rateLimited: true };
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(new Error('Aborted')); return; }
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => { clearTimeout(timer); reject(new Error('Aborted')); }, { once: true });
  });
}
