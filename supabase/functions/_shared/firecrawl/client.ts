/**
 * Source 3: Firecrawl client helper
 * Handles all Firecrawl API interactions with retries, timeouts, and safe error handling.
 * Completely isolated from Source 1 (RSS) and Source 2 (Employment News).
 */

const FIRECRAWL_API_BASE = 'https://api.firecrawl.dev/v1';
const DEFAULT_TIMEOUT = 30_000; // 30 seconds
const MAP_TIMEOUT = 60_000; // 60 seconds — map/discover needs more time for slow govt sites
const SCRAPE_TIMEOUT = 45_000; // 45 seconds for scraping
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 3_000;

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
  timeoutMs: number = DEFAULT_TIMEOUT
): Promise<Response> {
  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= retries + 1; attempt++) {
    try {
      const res = await fetchWithTimeout(url, init, timeoutMs);
      // Retry on 429 (rate limit) and 5xx
      if (res.status === 429 || res.status >= 500) {
        const body = await res.text().catch(() => '');
        lastError = new Error(`Firecrawl API HTTP ${res.status}: ${body.substring(0, 300)}`);
        if (attempt <= retries) {
          console.warn(`[firecrawl-client] Attempt ${attempt} failed (${res.status}), retrying in ${RETRY_DELAY_MS}ms...`);
          await new Promise(r => setTimeout(r, RETRY_DELAY_MS * attempt));
          continue;
        }
        throw lastError;
      }
      return res;
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
      if (lastError.message.includes('abort')) {
        lastError = new Error(`Firecrawl request timeout (${timeoutMs}ms)`);
      }
      if (attempt <= retries) {
        console.warn(`[firecrawl-client] Attempt ${attempt} error: ${lastError.message}, retrying...`);
        await new Promise(r => setTimeout(r, RETRY_DELAY_MS * attempt));
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
  });

  const data = await res.json();

  if (!res.ok || !data.success) {
    const errMsg = data.error || `HTTP ${res.status}`;
    console.error(`[firecrawl-client] Scrape failed: ${errMsg}`);
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
  });

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
