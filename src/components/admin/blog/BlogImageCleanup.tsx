/**
 * BlogImageCleanup.tsx — Utility-only module for blog image cleanup operations.
 * No UI component — utilities are consumed by BlogPostEditor.tsx directly.
 */

// ── Utility Functions ──────────────────────────────────

/** Extract storage path from a public blog-assets URL */
export function extractStoragePath(publicUrl: string): string | null {
  const marker = '/blog-assets/';
  const idx = publicUrl.indexOf(marker);
  if (idx === -1) return null;
  return publicUrl.substring(idx + marker.length);
}

/** Extract inline image URLs from HTML content that point to blog-assets/inline/ */
export function extractInlineUrlsFromContent(content: string): string[] {
  const urls: string[] = [];
  const re = /<img[^>]+src=["']([^"']*\/blog-assets\/inline\/[^"']*)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    urls.push(m[1]);
  }
  return urls;
}

/** Remove an inline image from HTML content by URL — tries <figure> first, then standalone <img> */
export function removeInlineImageFromContent(content: string, url: string): string {
  const escapedUrl = url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const figureRe = new RegExp(
    `\\s*<figure[^>]*class=["'][^"']*inline-article-image[^"']*["'][^>]*>[\\s\\S]*?${escapedUrl}[\\s\\S]*?<\\/figure>\\s*`,
    'gi'
  );
  let result = content.replace(figureRe, '\n');

  if (result === content) {
    const imgRe = new RegExp(`\\s*<img[^>]+src=["']${escapedUrl}["'][^>]*/?>\\s*`, 'gi');
    result = content.replace(imgRe, '\n');
  }

  return result;
}
