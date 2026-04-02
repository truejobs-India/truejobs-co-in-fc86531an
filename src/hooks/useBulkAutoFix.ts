/**
 * useBulkAutoFix — Fully autonomous bulk fix pipeline for blog articles.
 * 
 * 2-step flow:
 * 1. scanAll(scope) — scans articles via local compliance analysis, classifies as clean/fixable/skipped
 * 2. executeAutoFix() — processes fixable articles sequentially, applies safe fixes, logs everything
 * 
 * Supports change-aware eligibility with 5-status model:
 *   fixed | partially_fixed | skipped | failed | no_action_taken
 */

import { useState, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { calcLiveWordCount, calcReadingTime, wordCountFields } from '@/lib/blogWordCount';
import { blogPostToMetadata } from '@/lib/blogArticleAnalyzer';
import { analyzePublishCompliance } from '@/lib/blogComplianceAnalyzer';
import { isValidInternalPagePath } from '@/lib/blogLinkValidator';
import {
  shouldAutoOverwriteField,
  validateFieldValue,
  isValidCanonicalUrl,
  hasExistingIntro,
  hasExistingConclusion,
  hasFaqHeading,
  hasRelatedResourcesBlock,
  contentBlockAlreadyExists,
  linkAlreadyInContent,
  sanitizeLinkBlockHtml,
  buildCleanLinkBlock,
  validateFaqSchema,
  normalizeApplyMode,
  insertBeforeFirstHeadingRaw,
  extractHrefsFromHtml,
  stripHtmlLength,
  trackBlogToolEvent,
  logBlogAiAudit,
  EDITABLE_FIELDS,
  BULK_ALLOWED_APPLY_MODES,
  BULK_FORBIDDEN_APPLY_MODES,
  MAX_AUTO_LINKS,
} from '@/lib/blogFixUtils';

// ── Check keys that this bulk pipeline can actually auto-fix ──
const AUTO_FIXABLE_CHECK_KEYS = new Set([
  'meta-title', 'meta-description', 'missing-canonical', 'missing-slug',
  'excerpt', 'image-alt', 'missing-author',
  'h1-present', 'heading-hierarchy', 'faq-schema',
  'seo-meta-title', 'seo-meta-description', 'seo-internal-links',
  'seo-headings', 'seo-excerpt/summary',
]);

function splitActionableChecks<T extends { key: string; status: string }>(checks: T[]) {
  const actionable: T[] = [];
  const nonActionable: T[] = [];
  for (const c of checks) {
    if (AUTO_FIXABLE_CHECK_KEYS.has(c.key)) actionable.push(c);
    else nonActionable.push(c);
  }
  return { actionable, nonActionable };
}

// ── Types ──

export type BulkAutoFixPhase = 'idle' | 'scanning' | 'scanned' | 'fixing' | 'done';
export type ScanClassification = 'clean' | 'fixable' | 'skipped';
export type BulkScanScope = 'smart' | 'all' | 'failed_partial' | 'selected';
export type BulkFixStatus = 'fixed' | 'partially_fixed' | 'skipped' | 'failed' | 'no_action_taken' | 'baseline';

export interface ScanStateBreakdown {
  neverBulkFixed: number;
  changed: number;
  failed: number;
  partial: number;
  noActionTaken: number;
  skippedUnchanged: number;
  alreadyClean: number;
}

export interface ScanItem {
  postId: string;
  slug: string;
  title: string;
  classification: ScanClassification;
  failCount: number;
  warnCount: number;
  issuesByType: Record<string, number>;
  skipReason?: string;
  eligibilityReason?: string;
}

export interface FixApplied {
  field: string;
  fixType: string;
  beforeValue: string;
  afterValue: string;
}

export interface FixSkipped {
  field: string;
  fixType: string;
  reason: string;
}

export interface ArticleResult {
  postId: string;
  slug: string;
  title: string;
  status: 'fixed' | 'partially_fixed' | 'skipped' | 'failed' | 'stopped' | 'no_action_taken';
  issuesFound: number;
  fixesApplied: FixApplied[];
  fixesSkipped: FixSkipped[];
  error?: string;
}

export interface ScanReport {
  totalScanned: number;
  totalClean: number;
  totalFixable: number;
  totalSkipped: number;
  fixableItems: ScanItem[];
  issueBreakdown: Record<string, number>;
  stateBreakdown: ScanStateBreakdown;
  scope: BulkScanScope;
}

export interface BulkFixSummary {
  totalFixed: number;
  totalPartial: number;
  totalSkipped: number;
  totalFailed: number;
  totalStopped: number;
  totalNoAction: number;
  fieldBreakdown: Record<string, number>;
}

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  content: string;
  excerpt: string | null;
  cover_image_url: string | null;
  featured_image_alt: string | null;
  is_published: boolean;
  meta_title: string | null;
  meta_description: string | null;
  canonical_url: string | null;
  author_name: string | null;
  faq_count: number | null;
  has_faq_schema: boolean | null;
  faq_schema: any;
  internal_links: any;
  word_count: number | null;
  updated_at?: string;
  last_bulk_scanned_at?: string | null;
  last_bulk_fixed_at?: string | null;
  last_bulk_fix_status?: string | null;
  remaining_auto_fixable_count?: number | null;
  [key: string]: any;
}

// ── Eligibility check for smart scope ──
function isEligibleForSmartScope(post: BlogPost): { eligible: boolean; reason: string } {
  // Never scanned
  if (!post.last_bulk_scanned_at) {
    return { eligible: true, reason: 'neverBulkFixed' };
  }

  // Content changed since last scan
  if (post.updated_at && post.last_bulk_scanned_at) {
    const updatedAt = new Date(post.updated_at).getTime();
    const scannedAt = new Date(post.last_bulk_scanned_at).getTime();
    if (updatedAt > scannedAt) {
      return { eligible: true, reason: 'changed' };
    }
  }

  // Technical failure — always retry
  if (post.last_bulk_fix_status === 'failed') {
    return { eligible: true, reason: 'failed' };
  }

  // Partially fixed with remaining issues
  if (post.last_bulk_fix_status === 'partially_fixed' && (post.remaining_auto_fixable_count ?? 0) > 0) {
    return { eligible: true, reason: 'partial' };
  }

  // no_action_taken — only re-eligible if content changed (already covered by changed check above)
  // If we reach here, content hasn't changed, so don't retry
  
  return { eligible: false, reason: 'skippedUnchanged' };
}

function isEligibleForFailedPartialScope(post: BlogPost): boolean {
  if (post.last_bulk_fix_status === 'failed') return true;
  if (post.last_bulk_fix_status === 'partially_fixed' && (post.remaining_auto_fixable_count ?? 0) > 0) return true;
  if (post.last_bulk_fix_status === 'no_action_taken' && (post.remaining_auto_fixable_count ?? 0) > 0) return true;
  return false;
}

export function useBulkAutoFix(
  allPosts: BlogPost[],
  blogTextModel: string,
  fetchPosts: () => Promise<void>,
) {
  const [phase, setPhase] = useState<BulkAutoFixPhase>('idle');
  const [scanReport, setScanReport] = useState<ScanReport | null>(null);
  const [results, setResults] = useState<ArticleResult[]>([]);
  const [progress, setProgress] = useState<{ done: number; total: number; current: string }>({ done: 0, total: 0, current: '' });
  const [showDialog, setShowDialog] = useState(false);
  const stopRef = useRef(false);

  // ── Phase 1: Scan ──
  const scanAll = useCallback(async (scope: BulkScanScope = 'smart', targetPosts?: BlogPost[]) => {
    setShowDialog(true);
    setPhase('scanning');
    setScanReport(null);
    setResults([]);
    stopRef.current = false;

    // Always fetch fresh data from DB including tracking columns
    let allFetchedPosts: BlogPost[];
    
    const { data: freshPosts, error: fetchErr } = await supabase
      .from('blog_posts')
      .select('id, title, slug, content, excerpt, cover_image_url, featured_image_alt, is_published, meta_title, meta_description, canonical_url, author_name, faq_count, has_faq_schema, faq_schema, internal_links, word_count, updated_at, last_bulk_scanned_at, last_bulk_fixed_at, last_bulk_fix_status, remaining_auto_fixable_count');
    
    if (fetchErr || !freshPosts) {
      console.error('[BULK_AUTO_FIX] Failed to fetch fresh posts:', fetchErr);
      allFetchedPosts = allPosts as BlogPost[];
    } else {
      allFetchedPosts = freshPosts as BlogPost[];
    }

    // Determine which posts to scan based on scope
    let postsToScan: BlogPost[];
    const stateBreakdown: ScanStateBreakdown = {
      neverBulkFixed: 0,
      changed: 0,
      failed: 0,
      partial: 0,
      noActionTaken: 0,
      skippedUnchanged: 0,
      alreadyClean: 0,
    };

    if (scope === 'selected' && targetPosts && targetPosts.length > 0) {
      // For selected scope, use the target post IDs to find fresh data
      const targetIds = new Set(targetPosts.map(p => p.id));
      postsToScan = allFetchedPosts.filter(p => targetIds.has(p.id));
    } else if (scope === 'all') {
      postsToScan = allFetchedPosts;
    } else if (scope === 'failed_partial') {
      postsToScan = allFetchedPosts.filter(p => isEligibleForFailedPartialScope(p));
    } else {
      // Smart scope — filter by eligibility
      postsToScan = [];
      for (const post of allFetchedPosts) {
        const { eligible, reason } = isEligibleForSmartScope(post);
        if (eligible) {
          postsToScan.push(post);
          if (reason === 'neverBulkFixed') stateBreakdown.neverBulkFixed++;
          else if (reason === 'changed') stateBreakdown.changed++;
          else if (reason === 'failed') stateBreakdown.failed++;
          else if (reason === 'partial') stateBreakdown.partial++;
        } else {
          stateBreakdown.skippedUnchanged++;
        }
      }
    }

    // Now scan eligible posts for compliance issues
    const items: ScanItem[] = [];
    const issueBreakdown: Record<string, number> = {};
    let cleanCount = 0;
    let skippedCount = 0;

    for (const post of postsToScan) {
      if (!post.title || !post.content || post.content.trim().length < 50) {
        items.push({
          postId: post.id,
          slug: post.slug,
          title: post.title || '(untitled)',
          classification: 'skipped',
          failCount: 0,
          warnCount: 0,
          issuesByType: {},
          skipReason: !post.title ? 'Missing title' : 'Content too short or missing',
        });
        skippedCount++;
        continue;
      }

      const meta = blogPostToMetadata(post);
      const compliance = analyzePublishCompliance(meta);
      const failedChecks = compliance.checks.filter(c => c.status === 'fail' || c.status === 'warn');

      if (failedChecks.length === 0) {
        cleanCount++;
        stateBreakdown.alreadyClean++;
        continue;
      }

      const { actionable, nonActionable } = splitActionableChecks(failedChecks);

      if (actionable.length === 0) {
        items.push({
          postId: post.id,
          slug: post.slug,
          title: post.title,
          classification: 'skipped',
          failCount: failedChecks.filter(c => c.status === 'fail').length,
          warnCount: failedChecks.filter(c => c.status === 'warn').length,
          issuesByType: {},
          skipReason: `${nonActionable.length} issue(s) require manual review (e.g. ${nonActionable[0]?.key})`,
        });
        skippedCount++;
        continue;
      }

      const byType: Record<string, number> = {};
      for (const c of actionable) {
        byType[c.key] = (byType[c.key] || 0) + 1;
        issueBreakdown[c.key] = (issueBreakdown[c.key] || 0) + 1;
      }

      items.push({
        postId: post.id,
        slug: post.slug,
        title: post.title,
        classification: 'fixable',
        failCount: actionable.filter(c => c.status === 'fail').length,
        warnCount: actionable.filter(c => c.status === 'warn').length,
        issuesByType: byType,
      });
    }

    const report: ScanReport = {
      totalScanned: postsToScan.length,
      totalClean: cleanCount,
      totalFixable: items.filter(i => i.classification === 'fixable').length,
      totalSkipped: skippedCount,
      fixableItems: items.filter(i => i.classification === 'fixable'),
      issueBreakdown,
      stateBreakdown,
      scope,
    };

    setScanReport(report);
    setPhase('scanned');
  }, [allPosts, fetchPosts]);

  // ── Phase 2: Execute Auto-Fix ──
  const executeAutoFix = useCallback(async () => {
    if (!scanReport || scanReport.fixableItems.length === 0) return;

    stopRef.current = false;
    setPhase('fixing');
    setResults([]);
    const fixableItems = scanReport.fixableItems;
    setProgress({ done: 0, total: fixableItems.length, current: '' });

    const allResults: ArticleResult[] = [];

    for (let i = 0; i < fixableItems.length; i++) {
      if (stopRef.current) {
        for (let j = i; j < fixableItems.length; j++) {
          allResults.push({
            postId: fixableItems[j].postId,
            slug: fixableItems[j].slug,
            title: fixableItems[j].title,
            status: 'stopped',
            issuesFound: 0,
            fixesApplied: [],
            fixesSkipped: [],
          });
        }
        break;
      }

      const item = fixableItems[i];
      const { data: freshPost, error: fetchErr } = await supabase
        .from('blog_posts')
        .select('*')
        .eq('id', item.postId)
        .single();
      const post = fetchErr || !freshPost ? allPosts.find(p => p.id === item.postId) : freshPost as BlogPost;
      if (!post) {
        allResults.push({
          postId: item.postId, slug: item.slug, title: item.title,
          status: 'failed', issuesFound: 0, fixesApplied: [], fixesSkipped: [],
          error: 'Post not found in current data',
        });
        // Stamp failed
        await stampBulkFixStatus(item.postId, 'failed', null);
        setResults([...allResults]);
        continue;
      }

      setProgress({ done: i, total: fixableItems.length, current: item.title });

      try {
        const result = await processOneArticle(post, item, blogTextModel);
        allResults.push(result);
      } catch (err: any) {
        allResults.push({
          postId: item.postId, slug: item.slug, title: item.title,
          status: 'failed', issuesFound: item.failCount + item.warnCount,
          fixesApplied: [], fixesSkipped: [],
          error: err.message || 'Unknown error',
        });
        // Stamp technical failure
        await stampBulkFixStatus(item.postId, 'failed', null);
      }

      setResults([...allResults]);

      if (i < fixableItems.length - 1 && !stopRef.current) {
        await new Promise(r => setTimeout(r, 3000));
      }
    }

    setProgress({ done: fixableItems.length, total: fixableItems.length, current: '' });
    setPhase('done');
    await fetchPosts();
  }, [scanReport, allPosts, blogTextModel, fetchPosts]);

  const requestStop = useCallback(() => {
    stopRef.current = true;
  }, []);

  const resetDialog = useCallback(() => {
    if (phase === 'fixing') return;
    setShowDialog(false);
    setPhase('idle');
    setScanReport(null);
    setResults([]);
  }, [phase]);

  const summary: BulkFixSummary | null = phase === 'done' ? computeSummary(results) : null;

  // ── Baseline marking ──
  const [isBaselining, setIsBaselining] = useState(false);
  const [baselineResult, setBaselineResult] = useState<{ count: number } | null>(null);

  const baselineMarkPosts = useCallback(async (targetIds?: string[]): Promise<number> => {
    setIsBaselining(true);
    setBaselineResult(null);
    try {
      const now = new Date().toISOString();
      const updatePayload = {
        last_bulk_scanned_at: now,
        last_bulk_fix_status: 'baseline' as string,
        remaining_auto_fixable_count: 0,
      };

      let query = supabase.from('blog_posts').update(updatePayload).select('id');

      if (targetIds && targetIds.length > 0) {
        query = query.in('id', targetIds);
      } else {
        query = query.is('last_bulk_scanned_at', null);
      }

      const { data, error } = await query;
      if (error) throw error;
      const count = data?.length ?? 0;
      setBaselineResult({ count });
      return count;
    } catch (err) {
      console.error('Baseline marking failed:', err);
      setBaselineResult({ count: 0 });
      throw err;
    } finally {
      setIsBaselining(false);
    }
  }, []);

  return {
    phase,
    scanReport,
    results,
    progress,
    summary,
    showDialog,
    scanAll,
    executeAutoFix,
    requestStop,
    resetDialog,
    isBaselining,
    baselineResult,
    baselineMarkPosts,
  };
}

// ── Stamp bulk fix tracking columns ──
async function stampBulkFixStatus(
  postId: string,
  status: BulkFixStatus,
  remainingAutoFixableCount: number | null,
) {
  const now = new Date().toISOString();
  const updateData: Record<string, any> = {
    last_bulk_scanned_at: now,
    last_bulk_fix_status: status,
    remaining_auto_fixable_count: remainingAutoFixableCount,
  };
  
  // Only stamp last_bulk_fixed_at when fully fixed
  if (status === 'fixed') {
    updateData.last_bulk_fixed_at = now;
  }

  await supabase
    .from('blog_posts')
    .update(updateData)
    .eq('id', postId);
}

// ── Count remaining auto-fixable issues on content ──
function countAutoFixableIssues(post: BlogPost): number {
  const meta = blogPostToMetadata(post);
  const compliance = analyzePublishCompliance(meta);
  const failedChecks = compliance.checks.filter(c => c.status === 'fail' || c.status === 'warn');
  const { actionable } = splitActionableChecks(failedChecks);
  return actionable.length;
}

// ── Per-article processing ──

async function processOneArticle(
  post: BlogPost,
  scanItem: ScanItem,
  blogTextModel: string,
): Promise<ArticleResult> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const meta = blogPostToMetadata(post);
  const compliance = analyzePublishCompliance(meta);
  const allFailedChecks = compliance.checks.filter(c => c.status === 'fail' || c.status === 'warn');
  const { actionable: failedChecks } = splitActionableChecks(allFailedChecks);
  
  if (failedChecks.length === 0) {
    await stampBulkFixStatus(post.id, 'skipped', 0);
    return {
      postId: post.id, slug: post.slug, title: post.title,
      status: 'skipped', issuesFound: 0, fixesApplied: [], fixesSkipped: [],
    };
  }

  // Call the edge function
  const { data, error } = await supabase.functions.invoke('analyze-blog-compliance-fixes', {
    body: {
      title: post.title,
      content: post.content,
      slug: post.slug,
      aiModel: blogTextModel,
      issues: failedChecks.map(c => ({ key: c.key, label: c.label, detail: c.detail, recommendation: c.recommendation })),
      existingMeta: {
        meta_title: post.meta_title,
        meta_description: post.meta_description,
        excerpt: post.excerpt,
        featured_image_alt: post.featured_image_alt,
        author_name: post.author_name,
        canonical_url: post.canonical_url,
        hasCoverImage: !!post.cover_image_url,
        hasIntro: meta.hasIntro,
        hasConclusion: meta.hasConclusion,
        headings: meta.headings,
        wordCount: meta.wordCount,
        faqCount: post.faq_count ?? 0,
        internalLinkCount: meta.internalLinks?.length ?? 0,
      },
    },
  });

  if (error) throw new Error(error.message);

  // Handle timeout gracefully — mark as failed so it retries next run
  if (data?.timedOut) {
    console.warn(`[BULK_AUTO_FIX] AI timed out for "${post.slug}"`);
    await stampBulkFixStatus(post.id, 'failed', failedChecks.length);
    return {
      postId: post.id, slug: post.slug, title: post.title,
      status: 'failed' as const, issuesFound: failedChecks.length, fixesApplied: [], fixesSkipped: [],
    };
  }

  const fixes: any[] = Array.isArray(data?.fixes) ? data.fixes : [];
  const fixesApplied: FixApplied[] = [];
  const fixesSkipped: FixSkipped[] = [];
  const updatePayload: Record<string, any> = {};
  let modifiedContent = post.content;
  let contentChanged = false;

  if (fixes.length > 0) {
    console.log(`[BULK_AUTO_FIX] Article "${post.slug}" received ${fixes.length} fixes. Sample fix shape:`, JSON.stringify(fixes[0]));
  }

  for (const rawFix of fixes) {
    const applyMode = normalizeApplyMode(rawFix.applyMode);
    const fixType = rawFix.fixType || 'advisory';
    const field = rawFix.field || '';
    const suggestedValue = rawFix.suggestedValue || '';
    const confidence = rawFix.confidence || 'medium';

    if (BULK_FORBIDDEN_APPLY_MODES[applyMode]) {
      fixesSkipped.push({ field: field || fixType, fixType, reason: BULK_FORBIDDEN_APPLY_MODES[applyMode] });
      continue;
    }

    if (!BULK_ALLOWED_APPLY_MODES.has(applyMode)) {
      fixesSkipped.push({ field: field || fixType, fixType, reason: `Apply mode "${applyMode}" not supported in bulk mode` });
      continue;
    }

    if (confidence === 'low') {
      fixesSkipped.push({ field: field || fixType, fixType, reason: 'Low confidence — skipped for safety' });
      continue;
    }

    // ── APPLY_FIELD: Metadata fixes ──
    if (applyMode === 'apply_field' && field && EDITABLE_FIELDS.has(field)) {
      if (!suggestedValue || suggestedValue.trim().length === 0) {
        fixesSkipped.push({ field, fixType, reason: 'Empty suggested value' });
        continue;
      }

      if (field === 'slug' && post.is_published) {
        fixesSkipped.push({ field, fixType, reason: 'Published article — slug rewrite blocked (no automatic redirect support)' });
        continue;
      }

      const currentVal = (post as any)[field] || '';
      const overwriteContext = { title: post.title, metaDescription: post.meta_description || '' };

      if (!shouldAutoOverwriteField(field, currentVal, overwriteContext)) {
        fixesSkipped.push({ field, fixType, reason: `Current value is compliant (${currentVal.length} chars)` });
        continue;
      }

      const validation = validateFieldValue(field, suggestedValue);
      if (!validation.valid) {
        fixesSkipped.push({ field, fixType, reason: `Validation failed: ${validation.reason}` });
        continue;
      }

      if (field === 'meta_title' && suggestedValue.trim() === post.title.trim()) {
        fixesSkipped.push({ field, fixType, reason: 'Suggested meta_title is identical to title' });
        continue;
      }

      if (field === 'excerpt' && updatePayload.meta_description && suggestedValue.trim() === updatePayload.meta_description.trim()) {
        fixesSkipped.push({ field, fixType, reason: 'Suggested excerpt is identical to new meta_description' });
        continue;
      }

      updatePayload[field] = suggestedValue;
      fixesApplied.push({ field, fixType, beforeValue: currentVal.substring(0, 100), afterValue: suggestedValue.substring(0, 100) });
      logBlogAiAudit({ tool_name: 'bulk_auto_fix', before_value: currentVal, after_value: suggestedValue, apply_mode: applyMode, target_field: field, slug: post.slug });
      continue;
    }

    // ── APPEND_CONTENT: FAQ ──
    if (applyMode === 'append_content' && fixType === 'faq') {
      if (hasFaqHeading(modifiedContent)) { fixesSkipped.push({ field: 'faq', fixType, reason: 'FAQ section already exists' }); continue; }
      if (!suggestedValue || stripHtmlLength(suggestedValue) < 20) { fixesSkipped.push({ field: 'faq', fixType, reason: 'FAQ content too short or empty' }); continue; }
      if (contentBlockAlreadyExists(modifiedContent, suggestedValue)) { fixesSkipped.push({ field: 'faq', fixType, reason: 'FAQ content already exists in article' }); continue; }

      const sanitized = sanitizeLinkBlockHtml(suggestedValue);
      modifiedContent = modifiedContent + sanitized;
      contentChanged = true;

      if (rawFix.faqSchemaEligible && rawFix.faqSchema) {
        const validSchema = validateFaqSchema(rawFix.faqSchema);
        if (validSchema) {
          updatePayload.faq_schema = validSchema;
          updatePayload.has_faq_schema = true;
          updatePayload.faq_count = validSchema.length;
        }
      }

      fixesApplied.push({ field: 'content (FAQ)', fixType, beforeValue: '(no FAQ section)', afterValue: `Added FAQ (${stripHtmlLength(sanitized)} chars)` });
      logBlogAiAudit({ tool_name: 'bulk_auto_fix', before_value: '(no FAQ)', after_value: sanitized.substring(0, 200), apply_mode: applyMode, target_field: 'faq', slug: post.slug });
      continue;
    }

    // ── APPEND_CONTENT: Conclusion ──
    if (applyMode === 'append_content' && fixType === 'conclusion') {
      if (hasExistingConclusion(modifiedContent)) { fixesSkipped.push({ field: 'conclusion', fixType, reason: 'Conclusion already exists' }); continue; }
      if (!suggestedValue || stripHtmlLength(suggestedValue) < 20) { fixesSkipped.push({ field: 'conclusion', fixType, reason: 'Conclusion content too short or empty' }); continue; }
      if (contentBlockAlreadyExists(modifiedContent, suggestedValue)) { fixesSkipped.push({ field: 'conclusion', fixType, reason: 'Conclusion content already exists' }); continue; }

      const sanitized = sanitizeLinkBlockHtml(suggestedValue);
      modifiedContent = modifiedContent + sanitized;
      contentChanged = true;
      fixesApplied.push({ field: 'content (Conclusion)', fixType, beforeValue: '(no conclusion)', afterValue: `Added conclusion (${stripHtmlLength(sanitized)} chars)` });
      logBlogAiAudit({ tool_name: 'bulk_auto_fix', before_value: '(no conclusion)', after_value: sanitized.substring(0, 200), apply_mode: applyMode, target_field: 'conclusion', slug: post.slug });
      continue;
    }

    // ── APPEND_CONTENT: Internal Links ──
    if (applyMode === 'append_content' && fixType === 'internal_links') {
      if (hasRelatedResourcesBlock(modifiedContent)) { fixesSkipped.push({ field: 'internal_links', fixType, reason: 'Related Resources block already exists' }); continue; }

      const hrefs = extractHrefsFromHtml(suggestedValue);
      const validLinks: { href: string; text: string }[] = [];

      for (const href of hrefs) {
        if (!isValidInternalPagePath(href)) continue;
        if (linkAlreadyInContent(modifiedContent, href)) continue;
        if (validLinks.length >= MAX_AUTO_LINKS) break;
        const linkMatch = suggestedValue.match(new RegExp(`<a[^>]*href=["']${href.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["'][^>]*>([^<]*)</a>`, 'i'));
        const text = linkMatch?.[1]?.trim() || href;
        validLinks.push({ href, text });
      }

      if (validLinks.length === 0) { fixesSkipped.push({ field: 'internal_links', fixType, reason: 'No valid internal link targets found' }); continue; }

      const cleanBlock = buildCleanLinkBlock(validLinks);
      modifiedContent = modifiedContent + cleanBlock;
      contentChanged = true;
      fixesApplied.push({ field: 'content (Internal Links)', fixType, beforeValue: '(no Related Resources)', afterValue: `Added ${validLinks.length} internal links` });
      logBlogAiAudit({ tool_name: 'bulk_auto_fix', before_value: '(no links block)', after_value: cleanBlock.substring(0, 200), apply_mode: applyMode, target_field: 'internal_links', slug: post.slug });
      continue;
    }

    // ── INSERT_BEFORE_FIRST_HEADING: Intro/H1 ──
    if (applyMode === 'insert_before_first_heading' && (fixType === 'intro' || fixType === 'h1' || fixType === 'heading_structure')) {
      if (hasExistingIntro(modifiedContent)) { fixesSkipped.push({ field: 'intro', fixType, reason: 'Intro already exists' }); continue; }
      if (!suggestedValue || stripHtmlLength(suggestedValue) < 20) { fixesSkipped.push({ field: 'intro', fixType, reason: 'Intro content too short or empty' }); continue; }
      if (contentBlockAlreadyExists(modifiedContent, suggestedValue)) { fixesSkipped.push({ field: 'intro', fixType, reason: 'Intro content already exists' }); continue; }

      const sanitized = sanitizeLinkBlockHtml(suggestedValue);
      modifiedContent = insertBeforeFirstHeadingRaw(modifiedContent, sanitized);
      contentChanged = true;
      fixesApplied.push({ field: 'content (Intro)', fixType, beforeValue: '(no intro)', afterValue: `Added intro (${stripHtmlLength(sanitized)} chars)` });
      logBlogAiAudit({ tool_name: 'bulk_auto_fix', before_value: '(no intro)', after_value: sanitized.substring(0, 200), apply_mode: applyMode, target_field: 'intro', slug: post.slug });
      continue;
    }

    // ── Catch-all ──
    fixesSkipped.push({ field: field || fixType || 'unknown', fixType, reason: `Unhandled fix type/mode combination: ${fixType}/${applyMode}` });
  }

  // ── Build final DB update ──
  if (contentChanged) {
    const finalLength = stripHtmlLength(modifiedContent);
    if (finalLength < 100) {
      modifiedContent = post.content;
      contentChanged = false;
      const contentFields = new Set(['content (FAQ)', 'content (Conclusion)', 'content (Internal Links)', 'content (Intro)']);
      const removedFixes = fixesApplied.filter(f => contentFields.has(f.field));
      for (const rf of removedFixes) {
        const idx = fixesApplied.indexOf(rf);
        if (idx >= 0) {
          fixesApplied.splice(idx, 1);
          fixesSkipped.push({ field: rf.field, fixType: rf.fixType, reason: 'Reverted — final content too short' });
        }
      }
    } else {
      updatePayload.content = modifiedContent;
      const { word_count, reading_time } = wordCountFields(modifiedContent);
      updatePayload.word_count = word_count;
      updatePayload.reading_time = reading_time;
    }
  }

  if (Object.keys(updatePayload).length > 0 && !updatePayload.word_count) {
    const { word_count, reading_time } = wordCountFields(updatePayload.content || post.content);
    updatePayload.word_count = word_count;
    updatePayload.reading_time = reading_time;
  }

  // Write content/metadata to DB
  if (Object.keys(updatePayload).length > 0) {
    if (fixesApplied.length > 0) {
      updatePayload.ai_fixed_at = new Date().toISOString();
    }
    const { error: updateError } = await supabase
      .from('blog_posts')
      .update(updatePayload)
      .eq('id', post.id);
    if (updateError) throw new Error(`DB update failed: ${updateError.message}`);
  }

  // ── Post-fix re-evaluation ──
  // Build a virtual post with updated fields for re-analysis
  const updatedPost: BlogPost = { ...post, ...updatePayload };
  if (contentChanged) updatedPost.content = modifiedContent;
  const remainingAutoFixable = countAutoFixableIssues(updatedPost);

  // Determine final status using 5-status model
  let status: ArticleResult['status'];
  if (fixesApplied.length > 0 && remainingAutoFixable === 0) {
    status = 'fixed';
  } else if (fixesApplied.length > 0 && remainingAutoFixable > 0) {
    status = 'partially_fixed';
  } else if (fixesApplied.length === 0 && failedChecks.length > 0) {
    status = 'no_action_taken';
  } else {
    status = 'skipped';
  }

  // Stamp tracking columns
  await stampBulkFixStatus(post.id, status as BulkFixStatus, remainingAutoFixable);

  // Telemetry
  trackBlogToolEvent({
    event_name: 'bulk_auto_fix_complete',
    tool_name: 'bulk_auto_fix',
    status,
    item_count: fixesApplied.length,
    slug: post.slug,
  });

  return {
    postId: post.id,
    slug: post.slug,
    title: post.title,
    status,
    issuesFound: scanItem.failCount + scanItem.warnCount,
    fixesApplied,
    fixesSkipped,
  };
}

// ── Summary computation ──

function computeSummary(results: ArticleResult[]): BulkFixSummary {
  const fieldBreakdown: Record<string, number> = {};
  let totalFixed = 0;
  let totalPartial = 0;
  let totalSkipped = 0;
  let totalFailed = 0;
  let totalStopped = 0;
  let totalNoAction = 0;

  for (const r of results) {
    switch (r.status) {
      case 'fixed': totalFixed++; break;
      case 'partially_fixed': totalPartial++; break;
      case 'skipped': totalSkipped++; break;
      case 'failed': totalFailed++; break;
      case 'stopped': totalStopped++; break;
      case 'no_action_taken': totalNoAction++; break;
    }
    for (const f of r.fixesApplied) {
      fieldBreakdown[f.field] = (fieldBreakdown[f.field] || 0) + 1;
    }
  }

  return { totalFixed, totalPartial, totalSkipped, totalFailed, totalStopped, totalNoAction, fieldBreakdown };
}
