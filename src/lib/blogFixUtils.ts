/**
 * blogFixUtils.ts — Shared deterministic helpers for blog compliance fixes.
 * Used by both BlogAITools (single-article TipTap flow) and useBulkAutoFix (bulk DB-direct flow).
 * Single source of truth for overwrite rules, validation, content guards, and telemetry.
 */

import { supabase } from '@/integrations/supabase/client';
// isValidInternalPagePath is re-exported for consumers that need link validation alongside these utils
import { isValidInternalPagePath } from '@/lib/blogLinkValidator';
export { isValidInternalPagePath };

// ── Constants ──

export const EDITABLE_FIELDS = new Set([
  'meta_title', 'meta_description', 'excerpt',
  'featured_image_alt', 'author_name', 'canonical_url', 'slug',
]);

export const VALID_FIX_TYPES = new Set([
  'metadata', 'content-block', 'rewrite', 'advisory',
  'canonical_url', 'slug', 'meta_description', 'image_alt',
  'faq', 'intro', 'conclusion', 'trust_signal',
  'affiliate_links', 'internal_links', 'content_rewrite',
  'h1', 'heading_structure', 'excerpt',
]);

export const VALID_APPLY_MODES = new Set([
  'apply_field', 'append_content', 'prepend_content',
  'insert_before_first_heading', 'replace_section',
  'review_replacement', 'advisory',
]);

export const MAX_AUTO_LINKS = 6;

// Apply modes allowed in bulk auto-fix (DB-direct, no TipTap)
export const BULK_ALLOWED_APPLY_MODES = new Set([
  'apply_field',
  'append_content',
  'insert_before_first_heading',
]);

// Apply modes forbidden in bulk with reasons
export const BULK_FORBIDDEN_APPLY_MODES: Record<string, string> = {
  'replace_section': 'Not auto-applied in bulk mode — section replacement needs editor context',
  'review_replacement': 'Not auto-applied in bulk mode — requires editor context',
  'advisory': 'Advisory only — no actionable fix',
  'prepend_content': 'Blocked in bulk mode for safety',
};

// ── Legacy applyMode normalization ──

const APPLY_MODE_LEGACY_MAP: Record<string, string> = {
  'field': 'apply_field',
  'append': 'append_content',
  'review-and-replace': 'review_replacement',
  'manual': 'advisory',
};

export function normalizeApplyMode(mode: string | undefined | null): string {
  if (!mode) return 'advisory';
  return APPLY_MODE_LEGACY_MAP[mode] || mode;
}

// ── Telemetry + Audit helpers (fire-and-forget) ──

export async function trackBlogToolEvent(ev: {
  event_name: string; tool_name: string; action?: string; target?: string;
  apply_mode?: string; status?: string; error_message?: string;
  item_count?: number; slug?: string; category?: string; tags?: string[];
}) {
  try {
    await supabase.from('blog_ai_telemetry' as any).insert({ ...ev, timestamp: new Date().toISOString() });
  } catch (e) { console.warn('telemetry insert failed', e); }
}

export async function logBlogAiAudit(entry: {
  tool_name: string; before_value: any; after_value: any;
  apply_mode?: string; target_field?: string; slug?: string;
}) {
  try {
    await supabase.from('blog_ai_audit_log' as any).insert({
      ...entry,
      before_value: typeof entry.before_value === 'string' ? entry.before_value : JSON.stringify(entry.before_value ?? ''),
      after_value: typeof entry.after_value === 'string' ? entry.after_value : JSON.stringify(entry.after_value ?? ''),
      apply_mode: entry.apply_mode || 'advisory',
      timestamp: new Date().toISOString(),
    });
  } catch (e) { console.warn('audit insert failed', e); }
}

// ── Canonical URL validator ──

export function isValidCanonicalUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return false;
    const h = parsed.hostname;
    if (h !== 'truejobs.co.in' && !h.endsWith('.truejobs.co.in')) return false;
    if (h !== 'truejobs.co.in') {
      const subIdx = h.indexOf('.truejobs.co.in');
      if (subIdx <= 0) return false;
    }
    if (parsed.pathname.includes('//')) return false;
    if (parsed.search && parsed.search.length > 1) return false;
    if (parsed.hash && parsed.hash.length > 1) return false;
    return true;
  } catch { return false; }
}

// ── Field value validators (pre-save) ──

export function validateFieldValue(field: string, value: string): { valid: boolean; reason?: string } {
  if (!value || value.trim().length === 0) return { valid: false, reason: 'Empty value' };
  switch (field) {
    case 'meta_title':
      if (value.length < 10) return { valid: false, reason: `Too short (${value.length} chars, min 10)` };
      if (value.length > 60) return { valid: false, reason: `Too long (${value.length} chars, max 60)` };
      // Reject keyword stuffing (more than 3 commas)
      if ((value.match(/,/g) || []).length > 3) return { valid: false, reason: 'Suspected keyword stuffing' };
      return { valid: true };
    case 'meta_description':
      if (value.length < 50) return { valid: false, reason: `Too short (${value.length} chars, min 50)` };
      if (value.length > 155) return { valid: false, reason: `Too long (${value.length} chars, max 155)` };
      // Reject truncation artifacts
      if (value.endsWith('...') || value.endsWith('…')) return { valid: false, reason: 'Contains truncation artifact' };
      return { valid: true };
    case 'excerpt':
      if (value.length < 20) return { valid: false, reason: `Too short (${value.length} chars, min 20)` };
      if (value.length > 320) return { valid: false, reason: `Too long (${value.length} chars, max 320)` };
      return { valid: true };
    case 'featured_image_alt':
      if (value.length < 3) return { valid: false, reason: `Too short (${value.length} chars, min 3)` };
      if (value.length > 200) return { valid: false, reason: `Too long (${value.length} chars, max 200)` };
      return { valid: true };
    case 'canonical_url':
      if (!isValidCanonicalUrl(value)) return { valid: false, reason: 'Invalid canonical URL' };
      return { valid: true };
    case 'slug':
      if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(value) && value.length > 1) return { valid: false, reason: 'Invalid slug format' };
      if (value.includes('--')) return { valid: false, reason: 'Slug contains double hyphens' };
      if (value.length > 80) return { valid: false, reason: `Slug too long (${value.length} chars, max 80)` };
      return { valid: true };
    default:
      return { valid: value.length > 0 };
  }
}

// ── Smart overwrite logic ──

const GENERIC_ALT_WORDS = new Set(['image', 'photo', 'picture', 'img', 'alt', 'thumbnail', 'banner', 'cover']);

export function isPlaceholderOrGeneric(field: string, value: string): boolean {
  const v = value.trim().toLowerCase();
  if (field === 'featured_image_alt') {
    return GENERIC_ALT_WORDS.has(v) || v.length < 5;
  }
  return false;
}

export function shouldAutoOverwriteField(
  field: string,
  currentVal: string,
  context?: { title?: string; metaDescription?: string }
): boolean {
  // Always overwrite empty or near-empty fields
  if (!currentVal || currentVal.trim().length < 3) return true;

  switch (field) {
    case 'meta_title':
      if (currentVal.length > 60 || currentVal.length < 15) return true;
      // Overwrite if identical to article title (lazy duplicate)
      if (context?.title && currentVal.trim() === context.title.trim()) return true;
      return false;
    case 'meta_description':
      if (currentVal.length > 155 || currentVal.length < 50) return true;
      return false;
    case 'excerpt':
      if (currentVal.length < 20 || currentVal.length > 320) return true;
      // Overwrite if identical to meta_description
      if (context?.metaDescription && currentVal.trim() === context.metaDescription.trim()) return true;
      return false;
    case 'featured_image_alt':
      if (isPlaceholderOrGeneric(field, currentVal)) return true;
      return false;
    case 'canonical_url':
      return !isValidCanonicalUrl(currentVal);
    case 'slug':
      // Never auto-overwrite slug in bulk — handled separately with published check
      return false;
    case 'author_name':
      return false; // Don't auto-overwrite author names
    default:
      return false;
  }
}

// ── Content duplication guards ──

export function hasExistingIntro(content: string): boolean {
  const firstHeadingIdx = content.search(/<h[12][^>]*>/i);
  if (firstHeadingIdx <= 0) return false;
  const before = content.substring(0, firstHeadingIdx).replace(/<[^>]+>/g, '').trim();
  return before.length > 30;
}

export function hasExistingConclusion(content: string): boolean {
  return /<h[2-3][^>]*>.*(?:Conclusion|Final Thoughts|Summary|Key Takeaways|निष्कर्ष|सारांश)/i.test(content);
}

export function hasFaqHeading(content: string): boolean {
  return /<h[2-3][^>]*>.*(?:FAQ|Frequently Asked Questions)/i.test(content);
}

export function hasRelatedResourcesBlock(content: string): boolean {
  return /<h[2-4][^>]*>\s*(?:Related\s+Resources|Related\s+Articles|संबंधित\s+लेख)/i.test(content);
}

export function contentBlockAlreadyExists(html: string, block: string): boolean {
  const norm = (s: string) => s.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
  const blockNorm = norm(block);
  if (!blockNorm || blockNorm.length < 10) return false;
  return norm(html).includes(blockNorm.substring(0, 80));
}

export function linkAlreadyInContent(content: string, href: string): boolean {
  const escaped = href.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`<a\s[^>]*href=["']${escaped}["']`, 'i').test(content);
}

// ── HTML sanitization for link/content blocks ──

export function sanitizeLinkBlockHtml(html: string): string {
  let clean = html.replace(/<script[\s\S]*?<\/script>/gi, '');
  clean = clean.replace(/<style[\s\S]*?<\/style>/gi, '');
  clean = clean.replace(/\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '');
  // Keep only safe tags
  clean = clean.replace(/<(h[2-4]|p|ul|ol|li)(\s[^>]*)?>/gi, '<$1>');
  clean = clean.replace(/<a\s[^>]*href=["']([^"']+)["'][^>]*>/gi, '<a href="$1">');
  clean = clean.replace(/<(?!\/?(?:h[2-4]|p|ul|ol|li|a|strong|em|br)\b)[^>]+>/gi, '');
  return clean.trim();
}

export function buildCleanLinkBlock(links: { href: string; text: string }[]): string {
  const items = links.map(l => `<li><a href="${l.href}">${l.text}</a></li>`).join('');
  return `<h3>Related Resources</h3><ul>${items}</ul>`;
}

// ── FAQ schema validator ──

export function validateFaqSchema(schema: any): { question: string; answer: string }[] | null {
  if (!Array.isArray(schema)) return null;
  const valid = schema.filter(
    (item: any) => typeof item?.question === 'string' && item.question.trim().length > 5
      && typeof item?.answer === 'string' && item.answer.trim().length > 10
  );
  return valid.length > 0 ? valid : null;
}

// ── Bulk-specific content helpers (DB-direct, no TipTap) ──

/**
 * Insert HTML block before the first <h1> or <h2> in raw content string.
 * Falls back to prepend if no heading found.
 */
export function insertBeforeFirstHeadingRaw(content: string, html: string): string {
  const match = content.match(/<h[12][^>]*>/i);
  if (match && match.index !== undefined) {
    return content.substring(0, match.index) + html + content.substring(match.index);
  }
  // Fallback: prepend
  return html + content;
}

/**
 * Extract href values from HTML link tags.
 */
export function extractHrefsFromHtml(html: string): string[] {
  const hrefs: string[] = [];
  const re = /<a\s[^>]*href=["']([^"']+)["'][^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    hrefs.push(m[1]);
  }
  return hrefs;
}

/**
 * Strip HTML tags from content and return plain text length.
 */
export function stripHtmlLength(html: string): number {
  return html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().length;
}

// ── Compliance response normalizer ──

export function normalizeComplianceFixes(rawFixes: any[]): any[] {
  if (!Array.isArray(rawFixes)) return [];
  return rawFixes
    .map((f: any) => {
      if (!f || typeof f !== 'object') return null;
      const applyMode = normalizeApplyMode(f.applyMode);
      let fixType = typeof f.fixType === 'string' ? f.fixType : 'advisory';
      if (!VALID_FIX_TYPES.has(fixType)) fixType = 'advisory';
      const normalizedApplyMode = VALID_APPLY_MODES.has(applyMode) ? applyMode : 'advisory';
      const issueLabel = typeof f.issueLabel === 'string' ? f.issueLabel : '';
      const explanation = typeof f.explanation === 'string' ? f.explanation : '';
      const priority = ['high', 'medium', 'low'].includes(f.priority) ? f.priority : 'medium';
      if (!issueLabel && !explanation) return null;
      return {
        ...f,
        fixType,
        applyMode: normalizedApplyMode,
        issueLabel: issueLabel || 'Issue',
        explanation,
        priority,
        suggestedValue: typeof f.suggestedValue === 'string' ? f.suggestedValue : '',
        field: typeof f.field === 'string' ? f.field : '',
        confidence: ['high', 'medium', 'low'].includes(f.confidence) ? f.confidence : 'medium',
      };
    })
    .filter(Boolean);
}
