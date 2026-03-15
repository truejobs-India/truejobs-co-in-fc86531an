/**
 * blogInlineImages.ts — HTML-aware inline image slot detection, insertion, and context extraction.
 * 
 * Source of truth: `data-inline-slot="N"` attributes in HTML content.
 * `article_images.inline` JSON is synchronized metadata/cache.
 */

// ── Types ──────────────────────────────────────────────

export interface InlineSlotStatus {
  slot1Filled: boolean;
  slot2Filled: boolean;
  slot1Url?: string;
  slot2Url?: string;
  totalParagraphs: number;
  canPlaceSlot1: boolean;   // totalParagraphs >= 2
  canPlaceSlot2: boolean;   // totalParagraphs >= 5
  skipReasons: string[];
}

export interface SlotContext {
  nearbyText: string;
  nearbyHeading: string;
  articleTitle: string;
  category: string;
}

// ── Constants ──────────────────────────────────────────

const SLOT_1_AFTER_PARAGRAPH = 1;
const SLOT_2_AFTER_PARAGRAPH = 4;
const MIN_PARAGRAPHS_SLOT_1 = 2;
const MIN_PARAGRAPHS_SLOT_2 = 5;
const MIN_BLOCK_TEXT_LENGTH = 20;

/** Regex to split on closing block-level tags — captures the tag itself */
const BLOCK_CLOSE_RE = /(<\/(?:p|div|blockquote|ul|ol|table|section|article|header|footer|aside|main|details|summary)>)/gi;

/** Patterns for obviously invalid image URLs */
const INVALID_URL_PATTERNS = [
  /^\s*$/,
  /placeholder/i,
  /example\.com/i,
  /no-image/i,
  /^#$/,
  /^javascript:/i,
  /^data:text/i,
];

// ── Helpers ────────────────────────────────────────────

/** Strip HTML tags and return plain text */
function stripTags(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
}

/** Check if a URL is obviously invalid */
export function isInvalidImageUrl(url: string | null | undefined): boolean {
  if (!url || typeof url !== 'string') return true;
  const trimmed = url.trim();
  if (trimmed.length === 0) return true;
  return INVALID_URL_PATTERNS.some(pattern => pattern.test(trimmed));
}

/**
 * Parse HTML into substantial paragraph segments.
 * Returns array of { html: string, text: string, endIndex: number } for each substantial block.
 * If no closing block tags found, returns empty (ambiguous structure).
 */
function parseSubstantialBlocks(html: string): { html: string; text: string; endIndex: number }[] {
  const parts = html.split(BLOCK_CLOSE_RE);
  if (parts.length <= 1) return []; // No closing block tags — ambiguous structure

  const blocks: { html: string; text: string; endIndex: number }[] = [];
  let currentPos = 0;

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    const partEnd = currentPos + part.length;

    // Check if this part is a closing tag
    if (BLOCK_CLOSE_RE.test(part)) {
      // The content block is the previous part (i-1), combine with this closing tag
      BLOCK_CLOSE_RE.lastIndex = 0; // reset regex
      if (i > 0) {
        const contentHtml = parts[i - 1] + part;
        const text = stripTags(contentHtml);
        if (text.length >= MIN_BLOCK_TEXT_LENGTH) {
          blocks.push({ html: contentHtml, text, endIndex: partEnd });
        }
      }
    }
    BLOCK_CLOSE_RE.lastIndex = 0; // always reset
    currentPos = partEnd;
  }

  return blocks;
}

/**
 * Find the actual index in the original HTML where the Nth substantial block's closing tag ends.
 * This re-walks the HTML to find exact positions for safe insertion.
 */
function findNthBlockEndIndex(html: string, n: number): number | null {
  // Walk through and find closing block tags, counting only substantial ones
  const closeTagRe = /<\/(?:p|div|blockquote|ul|ol|table|section|article|header|footer|aside|main|details|summary)>/gi;
  let match: RegExpExecArray | null;
  let substantialCount = 0;
  let lastOpenPos = 0;

  // Track position of opening tags to pair with closing ones
  while ((match = closeTagRe.exec(html)) !== null) {
    const closeEnd = match.index + match[0].length;
    // Get the text between last close and this close (approximately the block content)
    const blockContent = html.substring(lastOpenPos, closeEnd);
    const text = stripTags(blockContent);
    
    if (text.length >= MIN_BLOCK_TEXT_LENGTH) {
      substantialCount++;
      if (substantialCount === n) {
        return closeEnd;
      }
    }
    lastOpenPos = closeEnd;
  }

  return null;
}

// ── Public API ─────────────────────────────────────────

/**
 * Detect inline image slot status from HTML content and optional article_images metadata.
 * Primary truth: `data-inline-slot` attributes in HTML.
 * Fallback: `articleImages.inline` JSON.
 */
export function detectInlineSlots(html: string, articleImages?: any): InlineSlotStatus {
  const skipReasons: string[] = [];

  // Check for data-inline-slot attributes in HTML (primary truth)
  const slot1Match = html.match(/data-inline-slot=["']1["'][^>]*>[\s\S]*?<img[^>]+src=["']([^"']+)["']/i);
  const slot2Match = html.match(/data-inline-slot=["']2["'][^>]*>[\s\S]*?<img[^>]+src=["']([^"']+)["']/i);

  let slot1Url = slot1Match?.[1];
  let slot2Url = slot2Match?.[1];
  let slot1Filled = !!slot1Url && !isInvalidImageUrl(slot1Url);
  let slot2Filled = !!slot2Url && !isInvalidImageUrl(slot2Url);

  // Fallback: check articleImages JSON metadata if slots not found in HTML
  if (!slot1Filled && articleImages?.inline) {
    const inlineArr = Array.isArray(articleImages.inline) ? articleImages.inline : [];
    const s1 = inlineArr.find((s: any) => s.slot === 1);
    if (s1?.url && !isInvalidImageUrl(s1.url)) {
      // Verify the URL actually appears in content
      if (html.includes(s1.url)) {
        slot1Filled = true;
        slot1Url = s1.url;
      }
    }
  }
  if (!slot2Filled && articleImages?.inline) {
    const inlineArr = Array.isArray(articleImages.inline) ? articleImages.inline : [];
    const s2 = inlineArr.find((s: any) => s.slot === 2);
    if (s2?.url && !isInvalidImageUrl(s2.url)) {
      if (html.includes(s2.url)) {
        slot2Filled = true;
        slot2Url = s2.url;
      }
    }
  }

  // Count substantial paragraphs
  const blocks = parseSubstantialBlocks(html);
  const totalParagraphs = blocks.length;

  if (totalParagraphs === 0) {
    skipReasons.push('Ambiguous HTML structure — no closing block tags detected');
  }

  const canPlaceSlot1 = totalParagraphs >= MIN_PARAGRAPHS_SLOT_1;
  const canPlaceSlot2 = totalParagraphs >= MIN_PARAGRAPHS_SLOT_2;

  if (!canPlaceSlot1 && !slot1Filled) {
    skipReasons.push(`Only ${totalParagraphs} paragraph(s), need ${MIN_PARAGRAPHS_SLOT_1}+ for slot 1`);
  }
  if (!canPlaceSlot2 && !slot2Filled) {
    skipReasons.push(`Only ${totalParagraphs} paragraph(s), need ${MIN_PARAGRAPHS_SLOT_2}+ for slot 2`);
  }

  return {
    slot1Filled,
    slot2Filled,
    slot1Url,
    slot2Url,
    totalParagraphs,
    canPlaceSlot1,
    canPlaceSlot2,
    skipReasons,
  };
}

/**
 * Insert an inline image after the Nth substantial paragraph.
 * Uses `<figure class="inline-article-image" data-inline-slot="N">` wrapper.
 * 
 * Returns updated HTML, or null if insertion point not found.
 * Returns html unchanged if slot already exists.
 */
export function insertInlineImage(
  html: string,
  slotNumber: 1 | 2,
  imgUrl: string,
  altText: string,
): string | null {
  // Don't insert if slot already exists
  if (html.includes(`data-inline-slot="${slotNumber}"`)) {
    return html; // Already exists, no-op
  }

  const afterParagraph = slotNumber === 1 ? SLOT_1_AFTER_PARAGRAPH : SLOT_2_AFTER_PARAGRAPH;
  const insertIndex = findNthBlockEndIndex(html, afterParagraph);

  if (insertIndex === null) {
    return null; // Target paragraph not found
  }

  const figureHtml = `\n<figure class="inline-article-image" data-inline-slot="${slotNumber}"><img src="${imgUrl}" alt="${altText.replace(/"/g, '&quot;')}" loading="lazy" /></figure>\n`;

  return html.substring(0, insertIndex) + figureHtml + html.substring(insertIndex);
}

/**
 * Extract contextual information around a slot's target paragraph for prompt generation.
 */
export function getContextForSlot(
  html: string,
  slotNumber: 1 | 2,
  title: string,
  category?: string | null,
): SlotContext {
  const afterParagraph = slotNumber === 1 ? SLOT_1_AFTER_PARAGRAPH : SLOT_2_AFTER_PARAGRAPH;
  const blocks = parseSubstantialBlocks(html);

  // Gather text from nearby paragraphs (target ± 1)
  const startIdx = Math.max(0, afterParagraph - 2);
  const endIdx = Math.min(blocks.length - 1, afterParagraph);
  const nearbyBlocks = blocks.slice(startIdx, endIdx + 1);
  let nearbyText = nearbyBlocks.map(b => b.text).join(' ').substring(0, 300);
  if (!nearbyText) nearbyText = stripTags(html).substring(0, 300);

  // Find nearest preceding heading
  let nearbyHeading = '';
  const headingRe = /<h[23][^>]*>([\s\S]*?)<\/h[23]>/gi;
  let headingMatch: RegExpExecArray | null;
  const targetEndIndex = afterParagraph <= blocks.length ? blocks[afterParagraph - 1]?.endIndex || 0 : 0;

  while ((headingMatch = headingRe.exec(html)) !== null) {
    if (headingMatch.index <= targetEndIndex) {
      nearbyHeading = stripTags(headingMatch[1]);
    } else {
      break;
    }
  }

  return {
    nearbyText,
    nearbyHeading: nearbyHeading || title,
    articleTitle: title,
    category: category || 'General',
  };
}

/**
 * Build article_images JSON with inline slot metadata.
 * Merges with existing articleImages data.
 */
export function buildArticleImagesMetadata(
  existingArticleImages: any,
  slotNumber: 1 | 2,
  url: string,
  altText: string,
): any {
  const existing = existingArticleImages || {};
  const inlineArr: any[] = Array.isArray(existing.inline) ? [...existing.inline] : [];

  // Remove existing entry for this slot
  const filtered = inlineArr.filter((s: any) => s.slot !== slotNumber);

  filtered.push({
    slot: slotNumber,
    afterParagraph: slotNumber === 1 ? SLOT_1_AFTER_PARAGRAPH : SLOT_2_AFTER_PARAGRAPH,
    url,
    alt: altText,
    generatedAt: new Date().toISOString(),
  });

  // Sort by slot number
  filtered.sort((a: any, b: any) => a.slot - b.slot);

  return { ...existing, inline: filtered };
}
