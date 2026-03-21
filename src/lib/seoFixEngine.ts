/**
 * SEO Fix Execution Engine
 * Validates AI-generated fixes and applies them to the database.
 * Used by the site-wide SEO audit Fix All flow.
 */

import { supabase } from '@/integrations/supabase/client';
import type { SeoAuditIssue, ContentSource } from './sitewideSeoAudit';

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

export type FixStatus = 'fixed' | 'skipped' | 'failed' | 'review_required';

export interface FixResult {
  issueId: string;
  source: ContentSource;
  recordId: string;
  slug: string;
  category: string;
  status: FixStatus;
  reason: string;
  field?: string;
  beforeValue?: string;
  afterValue?: string;
}

export interface FixProgress {
  total: number;
  processed: number;
  fixed: number;
  skipped: number;
  failed: number;
  reviewRequired: number;
  currentSlug: string;
  currentModel: string;
}

export interface PageFixGroup {
  source: ContentSource;
  recordId: string;
  slug: string;
  title: string;
  isPublished: boolean;
  issues: SeoAuditIssue[];
  contentSnippet?: string;
}

// ═══════════════════════════════════════════════════════════════
// Validators
// ═══════════════════════════════════════════════════════════════

const SITE_DOMAIN = 'truejobs.co.in';

export function isValidCanonicalUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:') return false;
    if (u.hostname !== SITE_DOMAIN && !u.hostname.endsWith('.' + SITE_DOMAIN)) return false;
    if (u.search || u.hash) return false;
    return true;
  } catch {
    return false;
  }
}

export function validateFixValue(field: string, value: string): { valid: boolean; reason?: string } {
  if (!value || typeof value !== 'string') {
    return { valid: false, reason: 'Empty or non-string value' };
  }

  switch (field) {
    case 'meta_title':
      if (value.length < 10) return { valid: false, reason: `Meta title too short: ${value.length} chars` };
      if (value.length > 65) return { valid: false, reason: `Meta title too long: ${value.length} chars` };
      return { valid: true };

    case 'meta_description':
      if (value.length < 50) return { valid: false, reason: `Meta description too short: ${value.length} chars` };
      if (value.length > 160) return { valid: false, reason: `Meta description too long: ${value.length} chars` };
      // Target is 130-155, warn but still valid if 100-160
      return { valid: true };

    case 'canonical_url':
      if (!isValidCanonicalUrl(value)) return { valid: false, reason: 'Invalid canonical URL' };
      return { valid: true };

    case 'excerpt':
      if (value.length < 20) return { valid: false, reason: 'Excerpt too short' };
      if (value.length > 500) return { valid: false, reason: 'Excerpt too long' };
      return { valid: true };

    case 'featured_image_alt':
      if (value.length < 5) return { valid: false, reason: 'Alt text too short' };
      if (value.length > 150) return { valid: false, reason: 'Alt text too long' };
      return { valid: true };

    default:
      return { valid: true };
  }
}

export function validateFaqSchema(schema: any): { valid: boolean; reason?: string } {
  if (!Array.isArray(schema)) return { valid: false, reason: 'FAQ schema must be an array' };
  if (schema.length === 0) return { valid: false, reason: 'FAQ schema is empty' };
  for (let i = 0; i < schema.length; i++) {
    const item = schema[i];
    if (!item.question || typeof item.question !== 'string' || item.question.trim().length < 5) {
      return { valid: false, reason: `FAQ item ${i + 1}: question missing or too short` };
    }
    if (!item.answer || typeof item.answer !== 'string' || item.answer.trim().length < 10) {
      return { valid: false, reason: `FAQ item ${i + 1}: answer missing or too short` };
    }
  }
  return { valid: true };
}

function sanitizeHtml(html: string): string {
  // Basic sanitization: strip script tags, event handlers
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/\son\w+\s*=\s*["'][^"']*["']/gi, '')
    .replace(/javascript:/gi, '');
}

function validateInternalLinks(html: string): { valid: boolean; reason?: string } {
  const hrefMatches = html.match(/href=["']([^"']+)["']/gi) || [];
  for (const match of hrefMatches) {
    const url = match.replace(/href=["']/i, '').replace(/["']$/, '');
    // Allow relative paths starting with /
    if (url.startsWith('/')) continue;
    // Allow absolute truejobs URLs
    try {
      const u = new URL(url);
      if (u.hostname !== SITE_DOMAIN && !u.hostname.endsWith('.' + SITE_DOMAIN)) {
        return { valid: false, reason: `External link detected: ${url}` };
      }
    } catch {
      return { valid: false, reason: `Invalid URL: ${url}` };
    }
  }
  return { valid: true };
}

// ═══════════════════════════════════════════════════════════════
// DB update helpers
// ═══════════════════════════════════════════════════════════════

async function updateRecord(source: ContentSource, recordId: string, updates: Record<string, any>): Promise<{ error: string | null }> {
  const table = source as string;
  const { error } = await supabase
    .from(table as any)
    .update(updates)
    .eq('id', recordId);
  return { error: error?.message || null };
}

async function appendToContent(source: ContentSource, recordId: string, htmlBlock: string): Promise<{ error: string | null }> {
  // Fetch current content, append block
  const { data, error: fetchError } = await supabase
    .from(source as any)
    .select('content')
    .eq('id', recordId)
    .single();

  if (fetchError || !data) return { error: fetchError?.message || 'Record not found' };

  const currentContent = (data as any).content || '';

  // Deduplication: check if similar block already exists
  const blockSignature = htmlBlock.replace(/<[^>]+>/g, '').trim().substring(0, 100);
  if (currentContent.includes(blockSignature)) {
    return { error: null }; // Already exists, skip silently
  }

  const newContent = currentContent + '\n\n' + htmlBlock;
  const { error: updateError } = await supabase
    .from(source as any)
    .update({ content: newContent, updated_at: new Date().toISOString() })
    .eq('id', recordId);

  return { error: updateError?.message || null };
}

// ═══════════════════════════════════════════════════════════════
// Fix application
// ═══════════════════════════════════════════════════════════════

async function applyFix(
  source: ContentSource,
  recordId: string,
  slug: string,
  isPublished: boolean,
  fix: any,
  issueId: string,
): Promise<FixResult> {
  const base = { issueId, source, recordId, slug, category: fix.category || 'unknown' };

  // Safety: never auto-change slug on published pages
  if (fix.field === 'slug' && isPublished) {
    return { ...base, status: 'review_required', reason: 'Slug change on published page requires redirect handling', field: 'slug' };
  }

  // Low confidence → review
  if (fix.confidence === 'low') {
    return { ...base, status: 'review_required', reason: `Low confidence fix: ${fix.explanation || 'AI unsure'}`, field: fix.field };
  }

  const action = fix.action || 'set_field';

  // ── set_field ──
  if (action === 'set_field' && fix.field && fix.value) {
    const validation = validateFixValue(fix.field, fix.value);
    if (!validation.valid) {
      return { ...base, status: 'failed', reason: `Validation failed: ${validation.reason}`, field: fix.field, afterValue: fix.value };
    }

    const { error } = await updateRecord(source, recordId, { [fix.field]: fix.value });
    if (error) {
      return { ...base, status: 'failed', reason: `DB error: ${error}`, field: fix.field };
    }
    return { ...base, status: 'fixed', reason: fix.explanation || 'Auto-fixed', field: fix.field, afterValue: fix.value };
  }

  // ── append_content ──
  if (action === 'append_content' && fix.value) {
    const sanitized = sanitizeHtml(fix.value);

    // Validate internal links if this is a links block
    if (fix.category === 'internal_links') {
      const linkCheck = validateInternalLinks(sanitized);
      if (!linkCheck.valid) {
        return { ...base, status: 'failed', reason: `Link validation: ${linkCheck.reason}`, field: 'content' };
      }
    }

    const { error } = await appendToContent(source, recordId, sanitized);
    if (error) {
      return { ...base, status: 'failed', reason: `Append error: ${error}`, field: 'content' };
    }
    return { ...base, status: 'fixed', reason: fix.explanation || 'Content appended', field: 'content', afterValue: `[appended ${sanitized.length} chars]` };
  }

  // ── set_faq_schema ──
  if (action === 'set_faq_schema') {
    let schema = fix.value;
    if (typeof schema === 'string') {
      try { schema = JSON.parse(schema); } catch {
        return { ...base, status: 'failed', reason: 'FAQ schema is not valid JSON', field: 'faq_schema' };
      }
    }

    const faqValidation = validateFaqSchema(schema);
    if (!faqValidation.valid) {
      return { ...base, status: 'failed', reason: `FAQ validation: ${faqValidation.reason}`, field: 'faq_schema' };
    }

    const updates: Record<string, any> = {
      faq_schema: schema,
      updated_at: new Date().toISOString(),
    };

    // blog_posts has has_faq_schema and faq_count columns
    if (source === 'blog_posts') {
      updates.has_faq_schema = true;
      updates.faq_count = schema.length;
    }

    const { error } = await updateRecord(source, recordId, updates);
    if (error) {
      return { ...base, status: 'failed', reason: `FAQ save error: ${error}`, field: 'faq_schema' };
    }
    return { ...base, status: 'fixed', reason: `FAQ schema set: ${schema.length} items`, field: 'faq_schema', afterValue: `${schema.length} FAQ items` };
  }

  // Unknown action → review
  return { ...base, status: 'review_required', reason: `Unknown action: ${action}`, field: fix.field };
}

// ═══════════════════════════════════════════════════════════════
// Main execution engine
// ═══════════════════════════════════════════════════════════════

export async function executeFixAll(
  issues: SeoAuditIssue[],
  aiModel: string,
  onProgress: (progress: FixProgress) => void,
  stopSignal: { stopped: boolean },
): Promise<FixResult[]> {
  // Group issues by page
  const pageMap = new Map<string, PageFixGroup>();
  for (const issue of issues) {
    if (!issue.autoFixable) continue;
    const key = `${issue.source}:${issue.recordId}`;
    if (!pageMap.has(key)) {
      pageMap.set(key, {
        source: issue.source,
        recordId: issue.recordId,
        slug: issue.slug,
        title: issue.title,
        isPublished: issue.isPublished,
        issues: [],
      });
    }
    pageMap.get(key)!.issues.push(issue);
  }

  const pages = Array.from(pageMap.values());
  const allResults: FixResult[] = [];
  const progress: FixProgress = {
    total: pages.length,
    processed: 0,
    fixed: 0,
    skipped: 0,
    failed: 0,
    reviewRequired: 0,
    currentSlug: '',
    currentModel: aiModel,
  };

  // Fetch content snippets for context (batch by source)
  for (const page of pages) {
    try {
      const { data } = await supabase
        .from(page.source as any)
        .select('content')
        .eq('id', page.recordId)
        .single();
      if (data) {
        page.contentSnippet = ((data as any).content || '').substring(0, 2000);
      }
    } catch { /* ignore */ }
  }

  // Process in batches of 3 pages per AI call
  const BATCH_SIZE = 3;
  for (let i = 0; i < pages.length; i += BATCH_SIZE) {
    if (stopSignal.stopped) break;

    const batch = pages.slice(i, i + BATCH_SIZE);
    progress.currentSlug = batch.map(p => p.slug).join(', ');
    onProgress({ ...progress });

    try {
      // Call edge function
      const { data, error } = await supabase.functions.invoke('seo-audit-fix', {
        body: {
          pages: batch.map(p => ({
            source: p.source,
            recordId: p.recordId,
            slug: p.slug,
            title: p.title,
            isPublished: p.isPublished,
            issues: p.issues.map(i => ({
              category: i.category,
              message: i.message,
              currentValue: i.currentValue,
              fixHint: i.fixHint,
            })),
            contentSnippet: p.contentSnippet,
          })),
          aiModel,
        },
      });

      if (error) throw new Error(error.message);

      const results = data?.results || [];

      // Apply fixes for each page
      for (const pageResult of results) {
        if (stopSignal.stopped) break;

        const page = batch.find(p => p.recordId === pageResult.recordId);
        if (!page) continue;

        if (pageResult.error) {
          // All issues for this page failed
          for (const issue of page.issues) {
            allResults.push({
              issueId: issue.id,
              source: page.source,
              recordId: page.recordId,
              slug: page.slug,
              category: issue.category,
              status: 'failed',
              reason: pageResult.error,
            });
            progress.failed++;
          }
        } else if (pageResult.parseError) {
          for (const issue of page.issues) {
            allResults.push({
              issueId: issue.id,
              source: page.source,
              recordId: page.recordId,
              slug: page.slug,
              category: issue.category,
              status: 'failed',
              reason: 'AI response parse error',
            });
            progress.failed++;
          }
        } else {
          const fixes = pageResult.fixes || [];

          // Map fixes back to issues
          const fixedCategories = new Set<string>();

          for (const fix of fixes) {
            if (stopSignal.stopped) break;

            const matchingIssue = page.issues.find(i => i.category === fix.category && !fixedCategories.has(i.id));
            const issueId = matchingIssue?.id || `${page.source}:${page.recordId}:${fix.category}`;

            const result = await applyFix(page.source, page.recordId, page.slug, page.isPublished, fix, issueId);
            allResults.push(result);

            if (result.status === 'fixed') { progress.fixed++; fixedCategories.add(issueId); }
            else if (result.status === 'failed') progress.failed++;
            else if (result.status === 'review_required') progress.reviewRequired++;
            else progress.skipped++;
          }

          // Issues that got no fix from AI
          for (const issue of page.issues) {
            if (!fixedCategories.has(issue.id) && !allResults.some(r => r.issueId === issue.id)) {
              allResults.push({
                issueId: issue.id,
                source: page.source,
                recordId: page.recordId,
                slug: page.slug,
                category: issue.category,
                status: 'skipped',
                reason: 'AI did not generate a fix for this issue',
              });
              progress.skipped++;
            }
          }

          if (pageResult.truncated) {
            console.warn(`[SEO-FIX] Truncated response for ${page.slug} — some fixes may be missing`);
          }
        }

        progress.processed++;
        onProgress({ ...progress });
      }
    } catch (err: any) {
      // Entire batch failed
      for (const page of batch) {
        for (const issue of page.issues) {
          allResults.push({
            issueId: issue.id,
            source: page.source,
            recordId: page.recordId,
            slug: page.slug,
            category: issue.category,
            status: 'failed',
            reason: err.message || 'Batch execution error',
          });
          progress.failed++;
        }
        progress.processed++;
      }
      onProgress({ ...progress });
    }

    // Brief delay between batches to avoid rate limits
    if (i + BATCH_SIZE < pages.length && !stopSignal.stopped) {
      await new Promise(r => setTimeout(r, 1500));
    }
  }

  return allResults;
}
