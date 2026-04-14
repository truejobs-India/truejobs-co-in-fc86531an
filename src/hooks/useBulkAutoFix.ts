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
import { blogPostToMetadata, analyzeQuality, analyzeSEO } from '@/lib/blogArticleAnalyzer';
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
  'missing-intro', 'missing-conclusion', 'missing-lists', 'low-heading-count',
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
  partial: number;       // compat — always 0, merged into failed
  noActionTaken: number;  // compat — always 0, merged into failed
  skippedUnchanged: number; // compat — always 0, replaced by unchanged
  unchanged: number;      // reason = already_fixed_unchanged
  excluded: number;       // reason = excluded (bad data / unknown status)
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
  lastBulkFixStatus?: string | null;
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
  allItems: ScanItem[];
  issueBreakdown: Record<string, number>;
  stateBreakdown: ScanStateBreakdown;
  scope: BulkScanScope;
  previouslyProcessed: number;
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
// Debug flag — set to true to log per-post eligibility decisions
const SMART_SCOPE_DEBUG = false;
const CHANGED_BUFFER_MS = 120_000; // 120 seconds — ignore trigger/metadata bumps

type SmartScopeReason = 'never_fixed' | 'fix_failed' | 'changed_since_fix' | 'already_fixed_unchanged' | 'excluded';

function safeDateMs(value: string | null | undefined): number | null {
  if (!value) return null;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
}

function isEligibleForSmartScope(post: BlogPost): { eligible: boolean; reason: SmartScopeReason } {
  const status = post.last_bulk_fix_status;
  const remaining = post.remaining_auto_fixable_count ?? 0;

  // Rule 1: Never scanned at all
  if (!post.last_bulk_scanned_at) {
    return debugResult(post, true, 'never_fixed');
  }

  // Rule 2: Technical failure — always retry
  if (status === 'failed') {
    return debugResult(post, true, 'fix_failed');
  }

  // Rule 3: Partially fixed with remaining issues
  if (status === 'partially_fixed' && remaining > 0) {
    return debugResult(post, true, 'fix_failed');
  }

  // Rule 4: no_action_taken with remaining fixable issues
  if (status === 'no_action_taken' && remaining > 0) {
    return debugResult(post, true, 'fix_failed');
  }

  // Rule 5: fixed or baseline — check for content changes with buffer
  if (status === 'fixed' || status === 'baseline') {
    const refMs = safeDateMs(post.last_bulk_fixed_at) ?? safeDateMs(post.last_bulk_scanned_at);
    if (refMs === null) {
      // No valid reference time despite having a status — treat as never_fixed
      return debugResult(post, true, 'never_fixed');
    }
    const updatedMs = safeDateMs(post.updated_at);
    if (updatedMs === null) {
      // Can't determine if changed — exclude (don't widen eligibility)
      return debugResult(post, false, 'excluded');
    }
    if (updatedMs > refMs + CHANGED_BUFFER_MS) {
      return debugResult(post, true, 'changed_since_fix');
    }
    return debugResult(post, false, 'already_fixed_unchanged');
  }

  // Rule 6: Any other status (e.g. "skipped", unknown values)
  return debugResult(post, false, 'excluded');
}

function debugResult(post: BlogPost, eligible: boolean, reason: SmartScopeReason): { eligible: boolean; reason: SmartScopeReason } {
  if (SMART_SCOPE_DEBUG) {
    console.debug('[SMART_SCOPE]', {
      id: post.id,
      title: post.title?.substring(0, 60),
      last_bulk_fix_status: post.last_bulk_fix_status,
      remaining_auto_fixable_count: post.remaining_auto_fixable_count,
      updated_at: post.updated_at,
      last_bulk_scanned_at: post.last_bulk_scanned_at,
      last_bulk_fixed_at: post.last_bulk_fixed_at,
      eligible,
      reason,
    });
  }
  return { eligible, reason };
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

    const SELECT_COLS = 'id, title, slug, content, excerpt, cover_image_url, featured_image_alt, is_published, meta_title, meta_description, canonical_url, author_name, faq_count, has_faq_schema, faq_schema, internal_links, word_count, updated_at, last_bulk_scanned_at, last_bulk_fixed_at, last_bulk_fix_status, remaining_auto_fixable_count';

    let allFetchedPosts: BlogPost[];
    let postsToScan: BlogPost[];
    const stateBreakdown: ScanStateBreakdown = {
      neverBulkFixed: 0,
      changed: 0,
      failed: 0,
      partial: 0,         // compat — always 0
      noActionTaken: 0,    // compat — always 0
      skippedUnchanged: 0, // compat — always 0
      unchanged: 0,
      excluded: 0,
      alreadyClean: 0,
    };

    if (scope === 'selected' && targetPosts && targetPosts.length > 0) {
      // Direct by-ID fetch — no 1000-row limit risk
      const targetIds = targetPosts.map(p => p.id);
      console.log(`[BULK_AUTO_FIX] Selected scope: fetching ${targetIds.length} posts by ID`);
      const { data, error } = await supabase
        .from('blog_posts')
        .select(SELECT_COLS)
        .in('id', targetIds);
      if (error || !data) {
        console.error('[BULK_AUTO_FIX] Failed to fetch selected posts:', error);
        allFetchedPosts = [];
      } else {
        allFetchedPosts = data as BlogPost[];
      }
      postsToScan = allFetchedPosts;
      if (postsToScan.length === 0 && targetIds.length > 0) {
        console.error(`[BULK_AUTO_FIX] Selected ${targetIds.length} posts but 0 matched in DB fetch — IDs may be stale`);
      }
      console.log(`[BULK_AUTO_FIX] Selected scope: ${postsToScan.length}/${targetIds.length} fetched`);
    } else {
      // Paginated fetch for all/smart/failed_partial — deterministic order
      allFetchedPosts = [];
      let from = 0;
      const BATCH = 1000;
      while (true) {
        const { data: batch, error } = await supabase
          .from('blog_posts')
          .select(SELECT_COLS)
          .order('id', { ascending: true })
          .range(from, from + BATCH - 1);
        if (error || !batch || batch.length === 0) break;
        allFetchedPosts.push(...(batch as BlogPost[]));
        if (batch.length < BATCH) break;
        from += BATCH;
      }
      console.log(`[BULK_AUTO_FIX] Paginated fetch: ${allFetchedPosts.length} total posts`);

      // Apply scope filtering
      if (scope === 'all') {
        postsToScan = allFetchedPosts;
      } else if (scope === 'failed_partial') {
        postsToScan = allFetchedPosts.filter(p => isEligibleForFailedPartialScope(p));
      } else {
        // Smart scope — filter by eligibility (strict ordering: failed before changed)
        postsToScan = [];
        for (const post of allFetchedPosts) {
          const { eligible, reason } = isEligibleForSmartScope(post);
          if (eligible) {
            postsToScan.push(post);
            // Tag the post so ScanItem can inherit the reason later
            (post as any).__eligibilityReason = reason;
            if (reason === 'never_fixed') stateBreakdown.neverBulkFixed++;
            else if (reason === 'changed_since_fix') stateBreakdown.changed++;
            else if (reason === 'fix_failed') stateBreakdown.failed++;
          } else {
            if (reason === 'already_fixed_unchanged') stateBreakdown.unchanged++;
            else if (reason === 'excluded') stateBreakdown.excluded++;
          }
        }
      }
      console.log(`[BULK_AUTO_FIX] Scope "${scope}": ${postsToScan.length} candidates after filtering`);
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
        items.push({
          postId: post.id,
          slug: post.slug,
          title: post.title,
          classification: 'clean',
          failCount: 0,
          warnCount: 0,
          issuesByType: {},
        });
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
        eligibilityReason: (post as any).__eligibilityReason,
      });
    }

    const report: ScanReport = {
      totalScanned: postsToScan.length,
      totalClean: cleanCount,
      totalFixable: items.filter(i => i.classification === 'fixable').length,
      totalSkipped: skippedCount,
      fixableItems: items.filter(i => i.classification === 'fixable'),
      allItems: items,
      issueBreakdown,
      stateBreakdown,
      scope,
    };

    setScanReport(report);
    setPhase('scanned');
  }, [allPosts, fetchPosts]);

  // ── Phase 2: Execute Auto-Fix ──
  const executeAutoFix = useCallback(async () => {
    if (!scanReport) return;
    
    const cleanItems = scanReport.allItems.filter(i => i.classification === 'clean');
    const fixableItems = scanReport.fixableItems;
    
    // Allow execution even if only clean items exist (to stamp them)
    if (fixableItems.length === 0 && cleanItems.length === 0) return;

    stopRef.current = false;
    setPhase('fixing');
    setResults([]);
    const totalToProcess = fixableItems.length + cleanItems.length;
    setProgress({ done: 0, total: totalToProcess, current: '' });

    // Fetch slug pool once for internal linking (avoids per-article queries)
    let availableSlugs: string[] = [];
    try {
      const slugBatches: string[] = [];
      let from = 0;
      const SLUG_BATCH = 1000;
      while (true) {
        const { data: slugRows } = await supabase
          .from('blog_posts')
          .select('slug')
          .eq('is_published', true)
          .order('id', { ascending: true })
          .range(from, from + SLUG_BATCH - 1);
        if (!slugRows || slugRows.length === 0) break;
        slugBatches.push(...slugRows.map(r => r.slug).filter(Boolean));
        if (slugRows.length < SLUG_BATCH) break;
        from += SLUG_BATCH;
      }
      availableSlugs = slugBatches;
      console.log(`[BULK_AUTO_FIX] Fetched ${availableSlugs.length} published slugs for internal linking`);
    } catch (e) {
      console.warn('[BULK_AUTO_FIX] Failed to fetch slug pool for internal linking:', e);
    }

    const allResults: ArticleResult[] = [];

    // Process fixable items first
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
        await stampBulkFixStatus(item.postId, 'failed', null);
        setResults([...allResults]);
        continue;
      }

      setProgress({ done: i, total: totalToProcess, current: item.title });

      try {
        const result = await processOneArticle(post, item, blogTextModel, availableSlugs);
        allResults.push(result);
      } catch (err: any) {
        allResults.push({
          postId: item.postId, slug: item.slug, title: item.title,
          status: 'failed', issuesFound: item.failCount + item.warnCount,
          fixesApplied: [], fixesSkipped: [],
          error: err.message || 'Unknown error',
        });
        await stampBulkFixStatus(item.postId, 'failed', null);
      }

      setResults([...allResults]);

      if (i < fixableItems.length - 1 && !stopRef.current) {
        await new Promise(r => setTimeout(r, 3000));
      }
    }

    // Stamp clean articles as "AI Fixed" — they already pass all checks
    for (let i = 0; i < cleanItems.length; i++) {
      if (stopRef.current) break;
      const item = cleanItems[i];
      setProgress({ done: fixableItems.length + i, total: totalToProcess, current: `✅ ${item.title}` });
      
      try {
        await stampBulkFixStatus(item.postId, 'fixed', 0);
        // Also update ai_fixed_at
        await supabase.from('blog_posts').update({ ai_fixed_at: new Date().toISOString() }).eq('id', item.postId);
        allResults.push({
          postId: item.postId, slug: item.slug, title: item.title,
          status: 'fixed', issuesFound: 0, fixesApplied: [], fixesSkipped: [],
        });
      } catch {
        allResults.push({
          postId: item.postId, slug: item.slug, title: item.title,
          status: 'skipped', issuesFound: 0, fixesApplied: [], fixesSkipped: [],
          error: 'Failed to stamp clean article',
        });
      }
      setResults([...allResults]);
    }

    setProgress({ done: totalToProcess, total: totalToProcess, current: '' });
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
      const { data, error } = await supabase.rpc('baseline_mark_posts' as any, {
        p_post_ids: targetIds?.length ? targetIds : null,
      });
      if (error) throw error;
      const count = typeof data === 'number' ? data : 0;
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
  await supabase.rpc('stamp_bulk_fix_status' as any, {
    p_post_id: postId,
    p_status: status,
    p_remaining_count: remainingAutoFixableCount ?? 0,
    p_is_fixed: status === 'fixed',
  });
}

// ── Count remaining auto-fixable issues on content ──
function countAutoFixableIssues(post: BlogPost): number {
  const meta = blogPostToMetadata(post);
  const compliance = analyzePublishCompliance(meta);
  const failedChecks = compliance.checks.filter(c => c.status === 'fail' || c.status === 'warn');
  const { actionable } = splitActionableChecks(failedChecks);
  return actionable.length;
}

// ── Shared fix-application loop (used by first and second pass) ──

function applyFixLoop(
  fixes: any[],
  content: string,
  post: BlogPost,
  updatePayload: Record<string, any>,
  fixesApplied: FixApplied[],
  fixesSkipped: FixSkipped[],
): { modifiedContent: string; contentChanged: boolean } {
  let modifiedContent = content;
  let contentChanged = false;

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

      // Fallback: count FAQ items from appended HTML when faqSchema wasn't provided
      if (!updatePayload.faq_count) {
        const faqQuestions = (sanitized.match(/<h[3-4][^>]*>[^<]*\?/gi) || []).length;
        if (faqQuestions > 0) {
          updatePayload.faq_count = faqQuestions;
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

      for (let href of hrefs) {
        // Normalize full URLs to relative paths (AI may return full truejobs URLs despite instructions)
        try {
          const parsed = new URL(href, 'https://truejobs.co.in');
          if (parsed.hostname === 'truejobs.co.in' || parsed.hostname.endsWith('.truejobs.co.in')) {
            href = parsed.pathname;
          }
        } catch {}

        if (!isValidInternalPagePath(href)) continue;
        if (linkAlreadyInContent(modifiedContent, href)) continue;
        if (validLinks.length >= MAX_AUTO_LINKS) break;
        const escapedHref = href.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const linkMatch = suggestedValue.match(new RegExp(`<a[^>]*href=["'][^"']*${escapedHref}["'][^>]*>([^<]*)</a>`, 'i'));
        const text = linkMatch?.[1]?.trim() || href;
        validLinks.push({ href, text });
      }

      if (validLinks.length === 0) {
        console.warn(`[BULK_AUTO_FIX] Internal links: ${hrefs.length} hrefs extracted, 0 passed validation. Raw hrefs:`, hrefs);
        fixesSkipped.push({ field: 'internal_links', fixType, reason: 'No valid internal link targets found' }); continue;
      }

      const cleanBlock = buildCleanLinkBlock(validLinks);
      modifiedContent = modifiedContent + cleanBlock;
      contentChanged = true;

      // Sync structured internal_links jsonb field
      const existingLinks: Array<{ path: string; anchorText: string }> =
        Array.isArray(post.internal_links) ? post.internal_links as any : [];
      const existingPaths = new Set(existingLinks.map((l) => l.path));
      const newStructuredLinks = validLinks
        .filter((l) => !existingPaths.has(l.href))
        .map((l) => ({ path: l.href, anchorText: l.text }));
      updatePayload.internal_links = [...existingLinks, ...newStructuredLinks] as any;

      fixesApplied.push({ field: 'content (Internal Links)', fixType, beforeValue: '(no Related Resources)', afterValue: `Added ${validLinks.length} internal links` });
      logBlogAiAudit({ tool_name: 'bulk_auto_fix', before_value: '(no links block)', after_value: cleanBlock.substring(0, 200), apply_mode: applyMode, target_field: 'internal_links', slug: post.slug });
      continue;
    }

    // ── INSERT_BEFORE_FIRST_HEADING: H1 only ──
    if (applyMode === 'insert_before_first_heading' && fixType === 'h1') {
      if (/<h1[^>]*>/i.test(modifiedContent)) {
        fixesSkipped.push({ field: 'h1', fixType, reason: 'H1 already exists' }); continue;
      }
      if (!suggestedValue || stripHtmlLength(suggestedValue) < 5) {
        fixesSkipped.push({ field: 'h1', fixType, reason: 'H1 content too short' }); continue;
      }
      const sanitized = sanitizeLinkBlockHtml(suggestedValue);
      modifiedContent = insertBeforeFirstHeadingRaw(modifiedContent, sanitized);
      contentChanged = true;
      fixesApplied.push({ field: 'content (H1)', fixType, beforeValue: '(no H1)', afterValue: `Added H1 (${stripHtmlLength(sanitized)} chars)` });
      logBlogAiAudit({ tool_name: 'bulk_auto_fix', before_value: '(no H1)', after_value: sanitized.substring(0, 200), apply_mode: applyMode, target_field: 'h1', slug: post.slug });
      continue;
    }

    // ── INSERT_BEFORE_FIRST_HEADING: Intro ──
    if (applyMode === 'insert_before_first_heading' && (fixType === 'intro' || fixType === 'heading_structure')) {
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

    // ── APPEND_CONTENT: Readability (lists/tables) ──
    if (applyMode === 'append_content' && fixType === 'readability') {
      if (!suggestedValue || stripHtmlLength(suggestedValue) < 20) {
        fixesSkipped.push({ field: 'readability', fixType, reason: 'Content too short' }); continue;
      }
      if (contentBlockAlreadyExists(modifiedContent, suggestedValue)) {
        fixesSkipped.push({ field: 'readability', fixType, reason: 'Content already exists' }); continue;
      }
      // Validate: must contain at least one readability structure
      if (!/<[uo]l|<table|<dl/i.test(suggestedValue)) {
        fixesSkipped.push({ field: 'readability', fixType, reason: 'No list/table/dl structure in suggestion' }); continue;
      }
      const sanitized = sanitizeLinkBlockHtml(suggestedValue);
      // Insert before FAQ/Conclusion if found, else append
      const rdFaqIdx = modifiedContent.search(/<h[23][^>]*>\s*(?:FAQ|Frequently Asked)/i);
      const rdConcIdx = modifiedContent.search(/<h[23][^>]*>\s*(?:Conclusion|Summary|Final Thoughts)/i);
      const rdInsertBefore = Math.min(rdFaqIdx >= 0 ? rdFaqIdx : Infinity, rdConcIdx >= 0 ? rdConcIdx : Infinity);
      if (rdInsertBefore < Infinity) {
        modifiedContent = modifiedContent.substring(0, rdInsertBefore) + sanitized + modifiedContent.substring(rdInsertBefore);
      } else {
        modifiedContent = modifiedContent + sanitized;
      }
      contentChanged = true;
      fixesApplied.push({ field: 'content (Readability)', fixType, beforeValue: '(no lists)', afterValue: `Added structured content (${stripHtmlLength(sanitized)} chars)` });
      logBlogAiAudit({ tool_name: 'bulk_auto_fix', before_value: '(no lists)', after_value: sanitized.substring(0, 200), apply_mode: applyMode, target_field: 'readability', slug: post.slug });
      continue;
    }

    // ── APPEND_CONTENT: Low heading count (add H2 sections) ──
    if (applyMode === 'append_content' && fixType === 'heading_structure') {
      if (!suggestedValue || stripHtmlLength(suggestedValue) < 30) {
        fixesSkipped.push({ field: 'headings', fixType, reason: 'Content too short' }); continue;
      }
      if (!/<h2/i.test(suggestedValue)) {
        fixesSkipped.push({ field: 'headings', fixType, reason: 'No H2 tags in suggestion' }); continue;
      }
      if (contentBlockAlreadyExists(modifiedContent, suggestedValue)) {
        fixesSkipped.push({ field: 'headings', fixType, reason: 'Content already exists' }); continue;
      }
      const sanitized = sanitizeLinkBlockHtml(suggestedValue);
      // Insert before FAQ/Conclusion if found, else append
      const hFaqIdx = modifiedContent.search(/<h[23][^>]*>\s*(?:FAQ|Frequently Asked)/i);
      const hConcIdx = modifiedContent.search(/<h[23][^>]*>\s*(?:Conclusion|Summary|Final Thoughts)/i);
      const hInsertBefore = Math.min(hFaqIdx >= 0 ? hFaqIdx : Infinity, hConcIdx >= 0 ? hConcIdx : Infinity);
      if (hInsertBefore < Infinity) {
        modifiedContent = modifiedContent.substring(0, hInsertBefore) + sanitized + modifiedContent.substring(hInsertBefore);
      } else {
        modifiedContent = modifiedContent + sanitized;
      }
      contentChanged = true;
      fixesApplied.push({ field: 'content (Headings)', fixType, beforeValue: '(low H2 count)', afterValue: `Added H2 sections (${stripHtmlLength(sanitized)} chars)` });
      logBlogAiAudit({ tool_name: 'bulk_auto_fix', before_value: '(low H2 count)', after_value: sanitized.substring(0, 200), apply_mode: applyMode, target_field: 'headings', slug: post.slug });
      continue;
    }

    // ── Catch-all ──
    fixesSkipped.push({ field: field || fixType || 'unknown', fixType, reason: `Unhandled fix type/mode combination: ${fixType}/${applyMode}` });
  }

  return { modifiedContent, contentChanged };
}

// ── Per-article processing ──

async function processOneArticle(
  post: BlogPost,
  scanItem: ScanItem,
  blogTextModel: string,
  availableSlugs: string[] = [],
): Promise<ArticleResult> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  // Pre-fix: sync faq_count from content if DB says 0 but content has FAQs
  if ((post.faq_count ?? 0) === 0 && post.content) {
    const faqQs = (post.content.match(/<h[3-4][^>]*>[^<]*\?/gi) || []).length;
    if (faqQs > 0) {
      console.log(`[BULK_AUTO_FIX] Pre-fix faq_count sync for "${post.slug}": ${faqQs} FAQs found in content`);
      await supabase.from('blog_posts').update({ faq_count: faqQs }).eq('id', post.id);
      (post as any).faq_count = faqQs;
    }
  }

  // Pre-fix: deterministic H1 insertion (in-memory only, persisted via main update)
  let h1WasInserted = false;
  if (post.content && !/<h1[^>]*>/i.test(post.content)) {
    const escapedTitle = post.title
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
    const h1Tag = `<h1>${escapedTitle}</h1>`;
    post.content = insertBeforeFirstHeadingRaw(post.content, h1Tag);
    h1WasInserted = true;
    console.log(`[BULK_AUTO_FIX] Deterministic H1 fix for "${post.slug}"`);
  }

  const meta = blogPostToMetadata(post);
  const compliance = analyzePublishCompliance(meta);
  const allFailedChecks = compliance.checks.filter(c => c.status === 'fail' || c.status === 'warn');
  const { actionable: failedChecks } = splitActionableChecks(allFailedChecks);
  
  if (failedChecks.length === 0) {
    // Article is now clean — stamp as fixed (pipeline confirmed compliance)
    const cleanUpdate: Record<string, any> = { ai_fixed_at: new Date().toISOString() };
    if (h1WasInserted) {
      cleanUpdate.content = post.content;
      const wf = wordCountFields(post.content);
      cleanUpdate.word_count = wf.word_count;
      cleanUpdate.reading_time = wf.reading_time;
    }
    await supabase.from('blog_posts').update(cleanUpdate).eq('id', post.id);
    await stampBulkFixStatus(post.id, 'fixed', 0);
    return {
      postId: post.id, slug: post.slug, title: post.title,
      status: 'fixed', issuesFound: 0,
      fixesApplied: h1WasInserted
        ? [{ field: 'content (H1)', fixType: 'h1', beforeValue: '(no H1)', afterValue: 'Deterministic H1 inserted' }]
        : [],
      fixesSkipped: [],
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
      availableSlugs: availableSlugs.filter(s => s !== post.slug).slice(0, 200),
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

  // Detect AI response failure: parseError means AI returned unusable output
  if (data?.parseError && fixes.length === 0) {
    console.warn(`[BULK_AUTO_FIX] AI parseError for "${post.slug}" — marking failed for retry`);
    await stampBulkFixStatus(post.id, 'failed', failedChecks.length);
    return {
      postId: post.id, slug: post.slug, title: post.title,
      status: 'failed' as const, issuesFound: failedChecks.length, fixesApplied: [], fixesSkipped: [],
      error: 'AI returned unparseable response — will retry next run',
    };
  }

  // Log truncation warnings for observability
  if (data?.truncated && fixes.length > 0) {
    console.warn(`[BULK_AUTO_FIX] Truncated AI response for "${post.slug}" — ${fixes.length} fixes salvaged via recovery`);
  }
  const fixesApplied: FixApplied[] = [];
  const fixesSkipped: FixSkipped[] = [];
  const updatePayload: Record<string, any> = {};
  let modifiedContent = post.content;
  let contentChanged = false;

  if (fixes.length > 0) {
    console.log(`[BULK_AUTO_FIX] Article "${post.slug}" received ${fixes.length} fixes. Sample fix shape:`, JSON.stringify(fixes[0]));
  }

  const loopResult = applyFixLoop(fixes, modifiedContent, post, updatePayload, fixesApplied, fixesSkipped);
  modifiedContent = loopResult.modifiedContent;
  contentChanged = loopResult.contentChanged || contentChanged;

  // ── Ensure deterministic H1 fix is persisted even when no AI fixes triggered contentChanged ──
  if (h1WasInserted && !contentChanged) {
    modifiedContent = post.content;
    contentChanged = true;
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

  // Always stamp ai_fixed_at — article completed AI processing successfully
  updatePayload.ai_fixed_at = new Date().toISOString();

  const { error: updateError } = await supabase
    .from('blog_posts')
    .update(updatePayload)
    .eq('id', post.id);
  if (updateError) throw new Error(`DB update failed: ${updateError.message}`);

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

  // ── Post-fix scoring log ──
  const postFixMeta = blogPostToMetadata(updatedPost);
  const postFixQuality = analyzeQuality(postFixMeta);
  const postFixSEO = analyzeSEO(postFixMeta);
  console.log(`[BULK_AUTO_FIX] Post-fix "${post.slug}": quality=${postFixQuality.totalScore}/100, seo=${postFixSEO.totalScore}/100, remaining=${remainingAutoFixable}, status=${status}`);

  // ── Bounded second-pass repair ──
  if (status === 'partially_fixed' && remainingAutoFixable > 0 && remainingAutoFixable <= 5 && fixesApplied.length > 0) {
    console.log(`[BULK_AUTO_FIX] Second pass for "${post.slug}" — ${remainingAutoFixable} remaining`);
    try {
      const reCompliance = analyzePublishCompliance(postFixMeta);
      const reFailedAll = reCompliance.checks.filter(c => c.status === 'fail' || c.status === 'warn');
      const { actionable: reFailedChecks } = splitActionableChecks(reFailedAll);

      if (reFailedChecks.length > 0 && reFailedChecks.length <= 5) {
        const { data: pass2Data } = await supabase.functions.invoke('analyze-blog-compliance-fixes', {
          body: {
            title: post.title, content: updatedPost.content, slug: post.slug,
            aiModel: blogTextModel,
            issues: reFailedChecks.map(c => ({ key: c.key, label: c.label, detail: c.detail, recommendation: c.recommendation })),
            existingMeta: {
              meta_title: updatedPost.meta_title, meta_description: updatedPost.meta_description,
              excerpt: updatedPost.excerpt, featured_image_alt: updatedPost.featured_image_alt,
              canonical_url: updatedPost.canonical_url, hasCoverImage: !!updatedPost.cover_image_url,
              hasIntro: postFixMeta.hasIntro, hasConclusion: postFixMeta.hasConclusion,
              wordCount: postFixMeta.wordCount, faqCount: postFixMeta.faqCount,
              internalLinkCount: postFixMeta.internalLinks?.length || 0, headings: postFixMeta.headings,
            },
          },
        });

        if (pass2Data?.fixes?.length > 0 && !pass2Data.timedOut && !pass2Data.parseError) {
          console.log(`[BULK_AUTO_FIX] Second pass applying ${pass2Data.fixes.length} fixes for "${post.slug}"`);
          const pass2UpdatePayload: Record<string, any> = {};
          const pass2Result = applyFixLoop(pass2Data.fixes, updatedPost.content, updatedPost, pass2UpdatePayload, fixesApplied, fixesSkipped);

          if (pass2Result.contentChanged) {
            const pass2FinalLength = stripHtmlLength(pass2Result.modifiedContent);
            if (pass2FinalLength >= 100) {
              pass2UpdatePayload.content = pass2Result.modifiedContent;
              const { word_count, reading_time } = wordCountFields(pass2Result.modifiedContent);
              pass2UpdatePayload.word_count = word_count;
              pass2UpdatePayload.reading_time = reading_time;
            }
          }

          if (Object.keys(pass2UpdatePayload).length > 0) {
            pass2UpdatePayload.ai_fixed_at = new Date().toISOString();
            await supabase.from('blog_posts').update(pass2UpdatePayload).eq('id', post.id);
            Object.assign(updatedPost, pass2UpdatePayload);
            if (pass2Result.contentChanged) updatedPost.content = pass2Result.modifiedContent;

            // Re-evaluate after second pass
            const pass2Remaining = countAutoFixableIssues(updatedPost);
            const pass2Status: BulkFixStatus = pass2Remaining === 0 ? 'fixed' : 'partially_fixed';
            await stampBulkFixStatus(post.id, pass2Status, pass2Remaining);
            status = pass2Status;
            console.log(`[BULK_AUTO_FIX] Second pass result for "${post.slug}": status=${pass2Status}, remaining=${pass2Remaining}`);
          }
        }
      }
    } catch (e) {
      console.warn(`[BULK_AUTO_FIX] Second pass failed for "${post.slug}":`, e);
    }
  }

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
