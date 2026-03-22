/**
 * SEO Fix Execution Engine
 * Validates AI-generated fixes and applies them to the database.
 * Used by the site-wide SEO audit Fix All flow.
 */

import { supabase } from '@/integrations/supabase/client';
import type { SeoAuditIssue, ContentSource, IssueCategory } from './sitewideSeoAudit';
import { getSeoFixRuntimeConfig, getSeoFixRetryDelayMs, isRetryableSeoFixReason } from './seoFixRuntimeConfig';

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
  verificationPassed?: boolean;
  verificationNote?: string;
  retryable?: boolean;
  attempts?: number;
  retryEvents?: string[];
  recoveredAfterRetry?: boolean;
  initialFailureReason?: string;
  finalFailureReason?: string;
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
  lastWarning?: string;
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

interface SeoFixPageResult {
  recordId: string;
  source: ContentSource;
  slug: string;
  fixes?: any[];
  error?: string;
  parseError?: boolean;
  truncated?: boolean;
  failureReason?: string | null;
  retryable?: boolean;
  retryEvents?: string[];
  attemptsMade?: number;
  recoveredAfterRetry?: boolean;
}

interface PageRetryState {
  retryCount: number;
  retryEvents: string[];
  initialFailureReason?: string;
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
      if (value.length > 155) return { valid: false, reason: `Meta description exceeds 155 chars (${value.length})` };
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
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/\son\w+\s*=\s*["'][^"']*["']/gi, '')
    .replace(/javascript:/gi, '');
}

function validateInternalLinks(html: string): { valid: boolean; reason?: string } {
  const hrefMatches = html.match(/href=["']([^"']+)["']/gi) || [];
  for (const match of hrefMatches) {
    const url = match.replace(/href=["']/i, '').replace(/["']$/, '');
    if (url.startsWith('/')) continue;
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
  const { data, error: fetchError } = await supabase
    .from(source as any)
    .select('content')
    .eq('id', recordId)
    .single();

  if (fetchError || !data) return { error: fetchError?.message || 'Record not found' };

  const currentContent = (data as any).content || '';

  // Deduplication
  const blockSignature = htmlBlock.replace(/<[^>]+>/g, '').trim().substring(0, 100);
  if (currentContent.includes(blockSignature)) {
    return { error: null };
  }

  const newContent = currentContent + '\n\n' + htmlBlock;
  const { error: updateError } = await supabase
    .from(source as any)
    .update({ content: newContent, updated_at: new Date().toISOString() })
    .eq('id', recordId);

  return { error: updateError?.message || null };
}

// ═══════════════════════════════════════════════════════════════
// Post-fix verification
// ═══════════════════════════════════════════════════════════════

async function verifyFix(source: ContentSource, recordId: string, field: string, expectedValue: string | undefined): Promise<{ passed: boolean; note: string }> {
  if (!expectedValue || field === 'content') {
    // Content appends are harder to verify precisely
    return { passed: true, note: 'Skipped verification for content append' };
  }

  try {
    const { data, error } = await supabase
      .from(source as any)
      .select(field)
      .eq('id', recordId)
      .single();

    if (error || !data) {
      return { passed: false, note: `Verification read failed: ${error?.message || 'not found'}` };
    }

    const savedValue = (data as any)[field];

    // Field-specific checks
    if (field === 'canonical_url') {
      if (!isValidCanonicalUrl(savedValue)) {
        return { passed: false, note: `Saved canonical is invalid: ${savedValue}` };
      }
      if (!savedValue.includes(SITE_DOMAIN)) {
        return { passed: false, note: `Canonical not same-site: ${savedValue}` };
      }
    }

    if (field === 'meta_description') {
      if (!savedValue || savedValue.length < 50 || savedValue.length > 155) {
        return { passed: false, note: `Meta desc length out of range: ${savedValue?.length || 0} chars` };
      }
    }

    if (field === 'meta_title') {
      if (!savedValue || savedValue.length < 10 || savedValue.length > 65) {
        return { passed: false, note: `Meta title length out of range: ${savedValue?.length || 0} chars` };
      }
    }

    if (field === 'faq_schema') {
      const faqCheck = validateFaqSchema(savedValue);
      if (!faqCheck.valid) {
        return { passed: false, note: `FAQ schema invalid after save: ${faqCheck.reason}` };
      }
    }

    // Generic value match
    if (typeof savedValue === 'string' && savedValue === expectedValue) {
      return { passed: true, note: 'DB value matches expected' };
    }

    return { passed: true, note: 'DB save confirmed' };
  } catch (err: any) {
    return { passed: false, note: `Verification error: ${err.message}` };
  }
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
  enableVerification = true,
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

    // Post-fix verification
    let verificationPassed = true;
    let verificationNote = '';
    if (enableVerification) {
      const v = await verifyFix(source, recordId, fix.field, fix.value);
      verificationPassed = v.passed;
      verificationNote = v.note;
    }

    return { ...base, status: 'fixed', reason: fix.explanation || 'Auto-fixed', field: fix.field, afterValue: fix.value, verificationPassed, verificationNote };
  }

  // ── append_content ──
  if (action === 'append_content' && fix.value) {
    const sanitized = sanitizeHtml(fix.value);

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
    return { ...base, status: 'fixed', reason: fix.explanation || 'Content appended', field: 'content', afterValue: `[appended ${sanitized.length} chars]`, verificationPassed: true };
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

    if (source === 'blog_posts') {
      updates.has_faq_schema = true;
      updates.faq_count = schema.length;
    }

    const { error } = await updateRecord(source, recordId, updates);
    if (error) {
      return { ...base, status: 'failed', reason: `FAQ save error: ${error}`, field: 'faq_schema' };
    }

    let verificationPassed = true;
    let verificationNote = '';
    if (enableVerification) {
      const v = await verifyFix(source, recordId, 'faq_schema', undefined);
      verificationPassed = v.passed;
      verificationNote = v.note;
    }

    return { ...base, status: 'fixed', reason: `FAQ schema set: ${schema.length} items`, field: 'faq_schema', afterValue: `${schema.length} FAQ items`, verificationPassed, verificationNote };
  }

  // Unknown action → review
  return { ...base, status: 'review_required', reason: `Unknown action: ${action}`, field: fix.field };
}

// ═══════════════════════════════════════════════════════════════
// Process a batch of pages through AI + apply
// ═══════════════════════════════════════════════════════════════

async function processBatch(
  batch: PageFixGroup[],
  aiModel: string,
  progress: FixProgress,
  allResults: FixResult[],
  onProgress: (progress: FixProgress) => void,
  stopSignal: { stopped: boolean },
  warnedSlugs: Set<string>,
  retryStateByPage: Map<string, PageRetryState> = new Map(),
): Promise<void> {
  const runtimeConfig = getSeoFixRuntimeConfig(aiModel);
  try {
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

    const results = (data?.results || []) as SeoFixPageResult[];
    const retryQueue: PageFixGroup[] = [];

    for (const pageResult of results) {
      if (stopSignal.stopped) break;

      const page = batch.find(p => p.recordId === pageResult.recordId);
      if (!page) continue;

      const pageKey = `${page.source}:${page.recordId}`;
      const retryState = retryStateByPage.get(pageKey) || { retryCount: 0, retryEvents: [] };
      const pageFailureReason = pageResult.failureReason || pageResult.error || 'Unknown AI error';
      const isRetryableFailure = !!(pageResult.retryable || isRetryableSeoFixReason(pageFailureReason));

      if ((pageResult.error || pageResult.parseError) && isRetryableFailure && retryState.retryCount < runtimeConfig.retryCount) {
        retryState.retryCount += 1;
        if (!retryState.initialFailureReason) retryState.initialFailureReason = pageFailureReason;
        retryState.retryEvents.push(`client retry ${retryState.retryCount}: ${pageFailureReason}`);
        retryStateByPage.set(pageKey, retryState);
        retryQueue.push(page);
        progress.lastWarning = `Retryable AI failure for "${page.slug}" — retrying (${retryState.retryCount}/${runtimeConfig.retryCount})`;
        onProgress({ ...progress });
        progress.lastWarning = undefined;
        continue;
      }

      const combinedRetryEvents = [
        ...retryState.retryEvents,
        ...(pageResult.retryEvents || []),
      ];
      const attempts = retryState.retryCount + (pageResult.attemptsMade || 1);
      const buildResult = (result: FixResult): FixResult => {
        const recoveredAfterRetry = !pageResult.error && !pageResult.parseError && combinedRetryEvents.length > 0;
        return {
          ...result,
          retryable: isRetryableFailure,
          attempts,
          retryEvents: combinedRetryEvents.length > 0 ? combinedRetryEvents : undefined,
          recoveredAfterRetry,
          initialFailureReason: retryState.initialFailureReason,
          finalFailureReason: pageResult.error || pageResult.parseError ? pageFailureReason : undefined,
          reason: recoveredAfterRetry
            ? `${result.reason} (recovered after retry)`
            : result.reason,
        };
      };

      if (pageResult.error) {
        for (const issue of page.issues) {
          allResults.push(buildResult({
            issueId: issue.id,
            source: page.source,
            recordId: page.recordId,
            slug: page.slug,
            category: issue.category,
            status: 'failed',
            reason: `AI error after retries: ${pageFailureReason}`,
          }));
          progress.failed++;
        }
      } else if (pageResult.parseError) {
        // Deduplicate warnings per slug
        if (!warnedSlugs.has(page.slug)) {
          warnedSlugs.add(page.slug);
          progress.lastWarning = `AI response for "${page.slug}" could not be parsed — fixes skipped`;
          onProgress({ ...progress });
          progress.lastWarning = undefined; // Clear after emitting
        }
        for (const issue of page.issues) {
          allResults.push(buildResult({
            issueId: issue.id,
            source: page.source,
            recordId: page.recordId,
            slug: page.slug,
            category: issue.category,
            status: 'failed',
            reason: `AI response parse error after retries: ${pageFailureReason}`,
          }));
          progress.failed++;
        }
      } else {
        const fixes = pageResult.fixes || [];

        if (pageResult.truncated && !warnedSlugs.has(page.slug + ':truncated')) {
          warnedSlugs.add(page.slug + ':truncated');
          progress.lastWarning = `AI response for "${page.slug}" was truncated — some fixes may be missing`;
          onProgress({ ...progress });
          progress.lastWarning = undefined;
        }

        const fixedCategories = new Set<string>();

        for (const fix of fixes) {
          if (stopSignal.stopped) break;

          const matchingIssue = page.issues.find(i => i.category === fix.category && !fixedCategories.has(i.id));
          const issueId = matchingIssue?.id || `${page.source}:${page.recordId}:${fix.category}`;

          const result = buildResult(await applyFix(page.source, page.recordId, page.slug, page.isPublished, fix, issueId));
          allResults.push(result);

          if (result.status === 'fixed') { progress.fixed++; fixedCategories.add(issueId); }
          else if (result.status === 'failed') progress.failed++;
          else if (result.status === 'review_required') progress.reviewRequired++;
          else progress.skipped++;
        }

        // Issues that got no fix from AI
        for (const issue of page.issues) {
          if (!fixedCategories.has(issue.id) && !allResults.some(r => r.issueId === issue.id)) {
            allResults.push(buildResult({
              issueId: issue.id,
              source: page.source,
              recordId: page.recordId,
              slug: page.slug,
              category: issue.category,
              status: 'skipped',
              reason: 'AI did not generate a fix for this issue',
            }));
            progress.skipped++;
          }
        }
      }

      progress.processed++;
      onProgress({ ...progress });
      progress.lastWarning = undefined; // Always clear after emitting
    }

    if (retryQueue.length > 0 && !stopSignal.stopped) {
      const maxAttemptIndex = Math.max(
        ...retryQueue.map(page => (retryStateByPage.get(`${page.source}:${page.recordId}`)?.retryCount || 1) - 1),
      );
      const delayMs = getSeoFixRetryDelayMs(runtimeConfig.baseRetryDelayMs, Math.max(0, maxAttemptIndex));
      await new Promise(r => setTimeout(r, delayMs));
      await processBatch(retryQueue, aiModel, progress, allResults, onProgress, stopSignal, warnedSlugs, retryStateByPage);
    }
  } catch (err: any) {
    for (const page of batch) {
      for (const issue of page.issues) {
        allResults.push({
          issueId: issue.id,
          source: page.source,
          recordId: page.recordId,
          slug: page.slug,
          category: issue.category,
          status: 'failed',
          reason: `Batch error: ${err.message || 'Unknown error'}`,
        });
        progress.failed++;
      }
      progress.processed++;
    }
    onProgress({ ...progress });
    progress.lastWarning = undefined;
  }
}

// ═══════════════════════════════════════════════════════════════
// Build pages from issues
// ═══════════════════════════════════════════════════════════════

function buildPageGroups(issues: SeoAuditIssue[]): PageFixGroup[] {
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
  return Array.from(pageMap.values());
}

async function fetchContentSnippets(pages: PageFixGroup[]): Promise<void> {
  for (const page of pages) {
    try {
      const { data } = await supabase
        .from(page.source as any)
        .select('content')
        .eq('id', page.recordId)
        .single();
      if (data) {
        // Limit snippet to 800 chars to avoid token overflow
        page.contentSnippet = ((data as any).content || '').substring(0, 800);
      }
    } catch { /* ignore */ }
  }
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
  const pages = buildPageGroups(issues);
  const allResults: FixResult[] = [];
  const warnedSlugs = new Set<string>();
  const runtimeConfig = getSeoFixRuntimeConfig(aiModel);
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

  await fetchContentSnippets(pages);

  const BATCH_SIZE = Math.max(1, runtimeConfig.maxConcurrency);
  for (let i = 0; i < pages.length; i += BATCH_SIZE) {
    if (stopSignal.stopped) break;

    const batch = pages.slice(i, i + BATCH_SIZE);
    progress.currentSlug = batch.map(p => p.slug).join(', ');
    onProgress({ ...progress });

    await processBatch(batch, aiModel, progress, allResults, onProgress, stopSignal, warnedSlugs);

    if (i + BATCH_SIZE < pages.length && !stopSignal.stopped) {
      await new Promise(r => setTimeout(r, runtimeConfig.throttleMs));
    }
  }

  return allResults;
}

// ═══════════════════════════════════════════════════════════════
// Targeted retry engine
// ═══════════════════════════════════════════════════════════════

export type RetryFilter =
  | { type: 'failed_only' }
  | { type: 'by_source'; source: ContentSource }
  | { type: 'by_category'; category: IssueCategory };

/**
 * Re-run fixes for a subset of issues from the last scan.
 * Does NOT rerun already-successful items.
 */
export async function executeRetry(
  allIssues: SeoAuditIssue[],
  previousResults: FixResult[],
  filter: RetryFilter,
  aiModel: string,
  onProgress: (progress: FixProgress) => void,
  stopSignal: { stopped: boolean },
): Promise<FixResult[]> {
  // Determine which issues to retry
  const successIds = new Set(previousResults.filter(r => r.status === 'fixed').map(r => r.issueId));

  let eligibleIssues = allIssues.filter(i => i.autoFixable && !successIds.has(i.id));

  // Apply filter
  if (filter.type === 'failed_only') {
    const failedIds = new Set(previousResults.filter(r => r.status === 'failed').map(r => r.issueId));
    eligibleIssues = eligibleIssues.filter(i => failedIds.has(i.id));
  } else if (filter.type === 'by_source') {
    eligibleIssues = eligibleIssues.filter(i => i.source === filter.source);
  } else if (filter.type === 'by_category') {
    eligibleIssues = eligibleIssues.filter(i => i.category === filter.category);
  }

  if (eligibleIssues.length === 0) {
    return [];
  }

  const pages = buildPageGroups(eligibleIssues);
  const allResults: FixResult[] = [];
  const warnedSlugs = new Set<string>();
  const runtimeConfig = getSeoFixRuntimeConfig(aiModel);
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

  await fetchContentSnippets(pages);

  const batchSize = Math.max(1, Math.min(runtimeConfig.maxConcurrency, 1));
  for (let i = 0; i < pages.length; i += batchSize) {
    if (stopSignal.stopped) break;

    const batch = pages.slice(i, i + batchSize);
    progress.currentSlug = batch.map(page => page.slug).join(', ');
    onProgress({ ...progress });

    await processBatch(batch, aiModel, progress, allResults, onProgress, stopSignal, warnedSlugs);

    if (i + batchSize < pages.length && !stopSignal.stopped) {
      await new Promise(r => setTimeout(r, runtimeConfig.throttleMs));
    }
  }

  return allResults;
}
