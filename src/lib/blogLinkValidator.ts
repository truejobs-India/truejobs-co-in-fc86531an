/**
 * Shared validation for internal page links.
 * Rejects storage URLs, image/asset URLs, full URLs, and non-page paths.
 */

const BLOCKED_EXTENSIONS = /\.(png|jpg|jpeg|webp|gif|svg|pdf|css|js|json|xml|mp4|mp3|zip|doc|docx|xls|xlsx)$/i;

const BLOCKED_PATH_SEGMENTS = [
  '/storage/',
  '/blog-assets/',
  '/covers/',
  '/api/',
  '/auth/',
  'supabase.co',
  'supabase.in',
];

const BLOCKED_PREFIXES = [
  'http:',
  'https:',
  '//',
  'data:',
  'javascript:',
  'mailto:',
  'tel:',
];

/**
 * Returns true if the path is a valid internal page link for TrueJobs.
 * Must be a relative path starting with / that points to a navigable page.
 */
export function isValidInternalPagePath(path: unknown): path is string {
  if (typeof path !== 'string') return false;

  const trimmed = path.trim();
  if (!trimmed || trimmed.length < 2) return false;

  // Must start with exactly one /
  if (!trimmed.startsWith('/')) return false;
  if (trimmed.startsWith('//')) return false;

  // Reject protocol-based or special links
  for (const prefix of BLOCKED_PREFIXES) {
    if (trimmed.toLowerCase().startsWith(prefix)) return false;
  }

  // Reject blocked path segments (storage, assets, API, auth)
  const lower = trimmed.toLowerCase();
  for (const segment of BLOCKED_PATH_SEGMENTS) {
    if (lower.includes(segment)) return false;
  }

  // Reject file extensions (images, media, documents)
  if (BLOCKED_EXTENSIONS.test(trimmed)) return false;

  return true;
}

/**
 * Filter and deduplicate an array of internal link suggestions.
 * Returns only entries with valid page paths and non-empty anchor text.
 */
export function filterValidInternalLinks<T extends { path: string; anchorText?: string }>(
  suggestions: T[],
  maxResults = 8,
): T[] {
  if (!Array.isArray(suggestions)) return [];

  const seen = new Set<string>();
  const valid: T[] = [];

  for (const s of suggestions) {
    if (!s || typeof s !== 'object') continue;

    const path = typeof s.path === 'string' ? s.path.trim() : '';
    if (!isValidInternalPagePath(path)) continue;
    if (seen.has(path)) continue;

    seen.add(path);
    valid.push({ ...s, path });
  }

  return valid.slice(0, maxResults);
}
