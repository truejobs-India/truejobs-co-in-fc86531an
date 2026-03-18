// Deduplication utilities: hash generation, PDF extraction, URL normalization

/**
 * Generate SHA-256 normalized hash for dedup fallback
 */
export async function generateNormalizedHash(
  sourceId: string,
  title: string,
  link: string | null,
  firstPdfUrl: string | null,
  publishedAt: string | null
): Promise<string> {
  const normalizedTitle = (title || '').toLowerCase().replace(/\s+/g, ' ').trim();
  const key = [sourceId, normalizedTitle, link || '', firstPdfUrl || '', publishedAt || ''].join('|');
  const data = new TextEncoder().encode(key);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Extract PDF URLs from enclosures, HTML content, and item link
 * v1: Does NOT fetch linked article pages
 */
export function extractPdfUrls(
  enclosureUrls: string[],
  htmlContent: string | null,
  itemLink: string | null
): { firstPdfUrl: string | null; linkedPdfUrls: string[] } {
  const pdfUrls = new Set<string>();

  // 1. Enclosure URLs ending with .pdf
  for (const url of enclosureUrls) {
    if (isPdfUrl(url)) pdfUrls.add(url);
  }

  // 2. PDF links in HTML content (href attributes)
  if (htmlContent) {
    const hrefRe = /href\s*=\s*["']([^"']*\.pdf[^"']*?)["']/gi;
    let m;
    while ((m = hrefRe.exec(htmlContent)) !== null) {
      if (m[1]) pdfUrls.add(m[1]);
    }
    // Also check src attributes (embedded objects)
    const srcRe = /src\s*=\s*["']([^"']*\.pdf[^"']*?)["']/gi;
    while ((m = srcRe.exec(htmlContent)) !== null) {
      if (m[1]) pdfUrls.add(m[1]);
    }
  }

  // 3. Item link itself if it ends with .pdf
  if (itemLink && isPdfUrl(itemLink)) {
    pdfUrls.add(itemLink);
  }

  const urls = Array.from(pdfUrls);
  return {
    firstPdfUrl: urls[0] || null,
    linkedPdfUrls: urls,
  };
}

function isPdfUrl(url: string): boolean {
  try {
    const path = new URL(url).pathname.toLowerCase();
    return path.endsWith('.pdf');
  } catch {
    return url.toLowerCase().includes('.pdf');
  }
}

/**
 * Normalize a URL by stripping tracking parameters
 */
export function normalizeUrl(url: string): string {
  if (!url) return '';
  try {
    const u = new URL(url);
    // Remove common tracking params
    const trackingParams = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'fbclid', 'gclid', 'ref'];
    for (const p of trackingParams) {
      u.searchParams.delete(p);
    }
    // Remove trailing slash for consistency
    let href = u.href;
    if (href.endsWith('/') && u.pathname !== '/') {
      href = href.slice(0, -1);
    }
    return href;
  } catch {
    return url;
  }
}

/**
 * Determine canonical link from available data
 */
export function getCanonicalLink(link: string | null, guid: string | null): string | null {
  // If guid looks like a URL, it might be canonical
  if (guid && (guid.startsWith('http://') || guid.startsWith('https://'))) {
    return normalizeUrl(guid);
  }
  if (link) return normalizeUrl(link);
  return null;
}
