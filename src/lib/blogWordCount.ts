/**
 * Canonical word-count utility for blog posts.
 *
 * EVERY path that reads or writes `word_count` must use these helpers so the
 * live-calculated value and the stored DB value stay in sync.
 *
 * HTML cleanup pipeline:
 *  1. Decode common HTML entities (&amp; &lt; &gt; &nbsp; &#NNN; &#xHHH;)
 *  2. Strip all HTML tags
 *  3. Collapse whitespace
 *  4. Count non-empty tokens
 */

const ENTITY_MAP: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&nbsp;': ' ',
  '&quot;': '"',
  '&apos;': "'",
  '&#39;': "'",
};

function decodeEntities(text: string): string {
  // Named entities
  let result = text.replace(/&(?:amp|lt|gt|nbsp|quot|apos|#39);/gi, (match) => {
    return ENTITY_MAP[match.toLowerCase()] || match;
  });
  // Numeric entities: &#123; or &#x1A;
  result = result.replace(/&#(\d+);/g, (_, dec) =>
    String.fromCharCode(Number(dec)),
  );
  result = result.replace(/&#x([0-9a-f]+);/gi, (_, hex) =>
    String.fromCharCode(parseInt(hex, 16)),
  );
  return result;
}

/**
 * Calculate a live word count from HTML content.
 *
 * Null-safe: returns 0 for null / undefined / empty.
 */
export function calcLiveWordCount(html: string | null | undefined): number {
  if (!html) return 0;
  const stripped = decodeEntities(html.replace(/<[^>]+>/g, ' '));
  return stripped.split(/\s+/).filter((w) => w.length > 0).length;
}

/**
 * Derive reading time from a word count (≥ 1 minute).
 */
export function calcReadingTime(wordCount: number): number {
  return Math.max(1, Math.ceil(wordCount / 200));
}

/**
 * Convenience: compute both word count and reading time for a content string
 * and return the fields ready to spread into a DB update payload.
 */
export function wordCountFields(html: string | null | undefined) {
  const wc = calcLiveWordCount(html);
  return { word_count: wc, reading_time: calcReadingTime(wc) };
}
