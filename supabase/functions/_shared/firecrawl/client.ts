/**
 * Source 3: Firecrawl client helper
 * Handles all Firecrawl API interactions with retries, timeouts, and safe error handling.
 * Completely isolated from Source 1 (RSS) and Source 2 (Employment News).
 */

const FIRECRAWL_API_BASE = 'https://api.firecrawl.dev/v1';
const DEFAULT_TIMEOUT = 30_000; // 30 seconds
const MAP_TIMEOUT = 60_000; // 60 seconds — map/discover needs more time for slow govt sites
const SCRAPE_TIMEOUT = 45_000; // 45 seconds for scraping
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 3_000;

/** Non-retryable status codes — fail immediately */
const NON_RETRYABLE_STATUSES = new Set([400, 401, 402, 403, 404, 422]);

export interface FirecrawlScrapeOptions {
  formats?: ('markdown' | 'html' | 'links')[];
  onlyMainContent?: boolean;
  waitFor?: number;
}

export interface FirecrawlMapOptions {
  search?: string;
  limit?: number;
  includeSubdomains?: boolean;
}

export interface FirecrawlScrapeResult {
  success: boolean;
  markdown?: string;
  html?: string;
  links?: string[];
  metadata?: {
    title?: string;
    description?: string;
    language?: string;
    sourceURL?: string;
    statusCode?: number;
    [key: string]: unknown;
  };
  error?: string;
}

export interface FirecrawlMapResult {
  success: boolean;
  links?: string[];
  error?: string;
}

function getApiKey(): string {
  const key = Deno.env.get('FIRECRAWL_API_KEY');
  if (!key) throw new Error('FIRECRAWL_API_KEY not configured — connect Firecrawl in project settings');
  return key;
}

function extractDomainForLog(url: string): string {
  try { return new URL(url).hostname; } catch { return url.substring(0, 50); }
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchWithRetry(
  url: string,
  init: RequestInit,
  retries: number = MAX_RETRIES,
  timeoutMs: number = DEFAULT_TIMEOUT,
  logDomain?: string
): Promise<Response> {
  let lastError: Error | null = null;
  const domain = logDomain || 'unknown';
  for (let attempt = 1; attempt <= retries + 1; attempt++) {
    try {
      const res = await fetchWithTimeout(url, init, timeoutMs);

      // Non-retryable errors — fail immediately
      if (NON_RETRYABLE_STATUSES.has(res.status)) {
        const body = await res.text().catch(() => '');
        throw new Error(`Firecrawl API HTTP ${res.status} (non-retryable, domain=${domain}): ${body.substring(0, 300)}`);
      }

      // Retry on 429 (rate limit) and 5xx
      if (res.status === 429 || res.status >= 500) {
        const body = await res.text().catch(() => '');
        lastError = new Error(`Firecrawl API HTTP ${res.status}: ${body.substring(0, 300)}`);
        if (attempt <= retries) {
          const backoffMs = RETRY_DELAY_MS * Math.pow(2, attempt - 1); // exponential: 3s, 6s, 12s
          console.warn(`[firecrawl-client] domain=${domain} attempt ${attempt}/${retries+1} failed (${res.status}), retrying in ${backoffMs}ms...`);
          await new Promise(r => setTimeout(r, backoffMs));
          continue;
        }
        throw lastError;
      }
      return res;
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
      if (lastError.message.includes('abort')) {
        lastError = new Error(`Firecrawl request timeout (${timeoutMs}ms) for domain=${domain}`);
      }
      // Non-retryable errors thrown above should not be retried
      if (lastError.message.includes('non-retryable')) throw lastError;
      if (attempt <= retries) {
        const backoffMs = RETRY_DELAY_MS * Math.pow(2, attempt - 1);
        console.warn(`[firecrawl-client] domain=${domain} attempt ${attempt}/${retries+1} error: ${lastError.message}, retrying in ${backoffMs}ms...`);
        await new Promise(r => setTimeout(r, backoffMs));
        continue;
      }
    }
  }
  throw lastError || new Error('Firecrawl request failed after retries');
}

/**
 * Scrape a single URL via Firecrawl
 */
export async function scrapePage(
  url: string,
  options?: FirecrawlScrapeOptions
): Promise<FirecrawlScrapeResult> {
  const apiKey = getApiKey();
  const domain = extractDomainForLog(url);

  const body = {
    url: url.trim(),
    formats: options?.formats || ['markdown', 'links'],
    onlyMainContent: options?.onlyMainContent ?? true,
    waitFor: options?.waitFor,
  };

  console.log(`[firecrawl-client] Scraping: ${url}`);

  const res = await fetchWithRetry(`${FIRECRAWL_API_BASE}/scrape`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  }, MAX_RETRIES, SCRAPE_TIMEOUT, domain);

  const data = await res.json();

  if (!res.ok || !data.success) {
    const errMsg = data.error || `HTTP ${res.status}`;
    console.error(`[firecrawl-client] Scrape failed (domain=${domain}): ${errMsg}`);
    return { success: false, error: errMsg };
  }

  // Firecrawl v1 nests content in data.data
  const content = data.data || data;
  return {
    success: true,
    markdown: content.markdown,
    html: content.html,
    links: content.links,
    metadata: content.metadata,
  };
}

/**
 * Map a URL to discover all sub-pages (fast sitemap)
 */
export async function mapUrl(
  url: string,
  options?: FirecrawlMapOptions
): Promise<FirecrawlMapResult> {
  const apiKey = getApiKey();
  const domain = extractDomainForLog(url);

  console.log(`[firecrawl-client] Mapping: ${url}`);

  const res = await fetchWithRetry(`${FIRECRAWL_API_BASE}/map`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      url: url.trim(),
      search: options?.search,
      limit: options?.limit || 100,
      includeSubdomains: options?.includeSubdomains ?? false,
    }),
  }, MAX_RETRIES, MAP_TIMEOUT, domain);

  const data = await res.json();

  if (!res.ok || !data.success) {
    return { success: false, error: data.error || `HTTP ${res.status}` };
  }

  return { success: true, links: data.links };
}

/**
 * Generate a content hash for deduplication
 */
export async function generateContentHash(content: string): Promise<string> {
  const normalized = content.trim().toLowerCase().replace(/\s+/g, ' ').substring(0, 5000);
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(normalized));
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
