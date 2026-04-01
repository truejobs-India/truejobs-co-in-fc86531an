/**
 * useBulkAutoFix — Fully autonomous bulk fix pipeline for blog articles.
 * 
 * 2-step flow:
 * 1. scanAll() — scans articles via local compliance analysis, classifies as clean/fixable/skipped
 * 2. executeAutoFix() — processes fixable articles sequentially, applies safe fixes, logs everything
 * 
 * No "review required" state. Every fix ends as: fixed, partially_fixed, skipped, failed, or stopped.
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

// ── Types ──

export type BulkAutoFixPhase = 'idle' | 'scanning' | 'scanned' | 'fixing' | 'done';
export type ScanClassification = 'clean' | 'fixable' | 'skipped';

export interface ScanItem {
  postId: string;
  slug: string;
  title: string;
  classification: ScanClassification;
  failCount: number;
  warnCount: number;
  issuesByType: Record<string, number>;
  skipReason?: string;
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
  status: 'fixed' | 'partially_fixed' | 'skipped' | 'failed' | 'stopped';
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
}

export interface BulkFixSummary {
  totalFixed: number;
  totalPartial: number;
  totalSkipped: number;
  totalFailed: number;
  totalStopped: number;
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
  [key: string]: any;
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
  const scanAll = useCallback(async (targetPosts?: BlogPost[]) => {
    setShowDialog(true);
    setPhase('scanning');
    setScanReport(null);
    setResults([]);
    stopRef.current = false;

    // Always fetch fresh data from DB to avoid stale counts
    let postsToScan: BlogPost[];
    if (targetPosts && targetPosts.length > 0) {
      postsToScan = targetPosts;
    } else {
      // Refresh parent state + fetch fresh from DB
      fetchPosts();
      const { data: freshPosts, error: fetchErr } = await supabase
        .from('blog_posts')
        .select('id, title, slug, content, excerpt, cover_image_url, featured_image_alt, is_published, meta_title, meta_description, canonical_url, author_name, faq_count, has_faq_schema, faq_schema, internal_links, word_count');
      if (fetchErr || !freshPosts) {
        console.error('[BULK_AUTO_FIX] Failed to fetch fresh posts:', fetchErr);
        postsToScan = allPosts; // fallback to in-memory
      } else {
        postsToScan = freshPosts as BlogPost[];
      }
    }

    const items: ScanItem[] = [];
    const issueBreakdown: Record<string, number> = {};
    let cleanCount = 0;
    let skippedCount = 0;

    for (const post of postsToScan) {
      // Skip articles without essential data
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
        continue; // Don't add to items — it's clean
      }

      // Split into actionable (auto-fixable) vs non-actionable
      const { actionable, nonActionable } = splitActionableChecks(failedChecks);

      if (actionable.length === 0) {
        // Has issues but none are auto-fixable by this tool
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
      // Check stop
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
      // Fetch fresh post data from DB for each article to avoid stale content
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
      }

      setResults([...allResults]);

      // Throttle: 3s between AI calls
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
    if (phase === 'fixing') return; // Don't close while fixing
    setShowDialog(false);
    setPhase('idle');
    setScanReport(null);
    setResults([]);
  }, [phase]);

  // Compute summary from results
  const summary: BulkFixSummary | null = phase === 'done' ? computeSummary(results) : null;

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
  };
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
  const failedChecks = compliance.checks.filter(c => c.status === 'fail' || c.status === 'warn');

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

  const fixes: any[] = Array.isArray(data?.fixes) ? data.fixes : [];
  const fixesApplied: FixApplied[] = [];
  const fixesSkipped: FixSkipped[] = [];
  const updatePayload: Record<string, any> = {};
  let modifiedContent = post.content;
  let contentChanged = false;

  // Log first article's raw response for verification
  if (fixes.length > 0) {
    console.log(`[BULK_AUTO_FIX] Article "${post.slug}" received ${fixes.length} fixes. Sample fix shape:`, JSON.stringify(fixes[0]));
  }

  for (const rawFix of fixes) {
    const applyMode = normalizeApplyMode(rawFix.applyMode);
    const fixType = rawFix.fixType || 'advisory';
    const field = rawFix.field || '';
    const suggestedValue = rawFix.suggestedValue || '';
    const confidence = rawFix.confidence || 'medium';

    // Check forbidden modes
    if (BULK_FORBIDDEN_APPLY_MODES[applyMode]) {
      fixesSkipped.push({
        field: field || fixType,
        fixType,
        reason: BULK_FORBIDDEN_APPLY_MODES[applyMode],
      });
      continue;
    }

    // Check allowed modes
    if (!BULK_ALLOWED_APPLY_MODES.has(applyMode)) {
      fixesSkipped.push({
        field: field || fixType,
        fixType,
        reason: `Apply mode "${applyMode}" not supported in bulk mode`,
      });
      continue;
    }

    // Skip low confidence
    if (confidence === 'low') {
      fixesSkipped.push({
        field: field || fixType,
        fixType,
        reason: 'Low confidence — skipped for safety',
      });
      continue;
    }

    // ── APPLY_FIELD: Metadata fixes ──
    if (applyMode === 'apply_field' && field && EDITABLE_FIELDS.has(field)) {
      if (!suggestedValue || suggestedValue.trim().length === 0) {
        fixesSkipped.push({ field, fixType, reason: 'Empty suggested value' });
        continue;
      }

      // Slug protection: never rewrite published slugs
      if (field === 'slug' && post.is_published) {
        fixesSkipped.push({ field, fixType, reason: 'Published article — slug rewrite blocked (no automatic redirect support)' });
        continue;
      }

      const currentVal = (post as any)[field] || '';
      const overwriteContext = {
        title: post.title,
        metaDescription: post.meta_description || '',
      };

      if (!shouldAutoOverwriteField(field, currentVal, overwriteContext)) {
        fixesSkipped.push({ field, fixType, reason: `Current value is compliant (${currentVal.length} chars)` });
        continue;
      }

      // Validate the new value
      const validation = validateFieldValue(field, suggestedValue);
      if (!validation.valid) {
        fixesSkipped.push({ field, fixType, reason: `Validation failed: ${validation.reason}` });
        continue;
      }

      // Additional quality checks for meta_title
      if (field === 'meta_title' && suggestedValue.trim() === post.title.trim()) {
        fixesSkipped.push({ field, fixType, reason: 'Suggested meta_title is identical to title' });
        continue;
      }

      // Additional quality check for excerpt matching meta_description
      if (field === 'excerpt' && updatePayload.meta_description && suggestedValue.trim() === updatePayload.meta_description.trim()) {
        fixesSkipped.push({ field, fixType, reason: 'Suggested excerpt is identical to new meta_description' });
        continue;
      }

      // Apply the fix
      updatePayload[field] = suggestedValue;
      fixesApplied.push({
        field,
        fixType,
        beforeValue: currentVal.substring(0, 100),
        afterValue: suggestedValue.substring(0, 100),
      });

      // Audit log
      logBlogAiAudit({
        tool_name: 'bulk_auto_fix',
        before_value: currentVal,
        after_value: suggestedValue,
        apply_mode: applyMode,
        target_field: field,
        slug: post.slug,
      });

      continue;
    }

    // ── APPEND_CONTENT: FAQ ──
    if (applyMode === 'append_content' && fixType === 'faq') {
      if (hasFaqHeading(modifiedContent)) {
        fixesSkipped.push({ field: 'faq', fixType, reason: 'FAQ section already exists' });
        continue;
      }
      if (!suggestedValue || stripHtmlLength(suggestedValue) < 20) {
        fixesSkipped.push({ field: 'faq', fixType, reason: 'FAQ content too short or empty' });
        continue;
      }
      if (contentBlockAlreadyExists(modifiedContent, suggestedValue)) {
        fixesSkipped.push({ field: 'faq', fixType, reason: 'FAQ content already exists in article' });
        continue;
      }

      const sanitized = sanitizeLinkBlockHtml(suggestedValue);
      modifiedContent = modifiedContent + sanitized;
      contentChanged = true;

      // Write FAQ schema if provided
      if (rawFix.faqSchemaEligible && rawFix.faqSchema) {
        const validSchema = validateFaqSchema(rawFix.faqSchema);
        if (validSchema) {
          updatePayload.faq_schema = validSchema;
          updatePayload.has_faq_schema = true;
          updatePayload.faq_count = validSchema.length;
        }
      }

      fixesApplied.push({
        field: 'content (FAQ)',
        fixType,
        beforeValue: '(no FAQ section)',
        afterValue: `Added FAQ (${stripHtmlLength(sanitized)} chars)`,
      });

      logBlogAiAudit({
        tool_name: 'bulk_auto_fix',
        before_value: '(no FAQ)',
        after_value: sanitized.substring(0, 200),
        apply_mode: applyMode,
        target_field: 'faq',
        slug: post.slug,
      });
      continue;
    }

    // ── APPEND_CONTENT: Conclusion ──
    if (applyMode === 'append_content' && fixType === 'conclusion') {
      if (hasExistingConclusion(modifiedContent)) {
        fixesSkipped.push({ field: 'conclusion', fixType, reason: 'Conclusion already exists' });
        continue;
      }
      if (!suggestedValue || stripHtmlLength(suggestedValue) < 20) {
        fixesSkipped.push({ field: 'conclusion', fixType, reason: 'Conclusion content too short or empty' });
        continue;
      }
      if (contentBlockAlreadyExists(modifiedContent, suggestedValue)) {
        fixesSkipped.push({ field: 'conclusion', fixType, reason: 'Conclusion content already exists' });
        continue;
      }

      const sanitized = sanitizeLinkBlockHtml(suggestedValue);
      modifiedContent = modifiedContent + sanitized;
      contentChanged = true;

      fixesApplied.push({
        field: 'content (Conclusion)',
        fixType,
        beforeValue: '(no conclusion)',
        afterValue: `Added conclusion (${stripHtmlLength(sanitized)} chars)`,
      });

      logBlogAiAudit({
        tool_name: 'bulk_auto_fix',
        before_value: '(no conclusion)',
        after_value: sanitized.substring(0, 200),
        apply_mode: applyMode,
        target_field: 'conclusion',
        slug: post.slug,
      });
      continue;
    }

    // ── APPEND_CONTENT: Internal Links ──
    if (applyMode === 'append_content' && fixType === 'internal_links') {
      if (hasRelatedResourcesBlock(modifiedContent)) {
        fixesSkipped.push({ field: 'internal_links', fixType, reason: 'Related Resources block already exists' });
        continue;
      }

      // Parse links from suggested HTML
      const hrefs = extractHrefsFromHtml(suggestedValue);
      const validLinks: { href: string; text: string }[] = [];

      for (const href of hrefs) {
        if (!isValidInternalPagePath(href)) continue;
        if (linkAlreadyInContent(modifiedContent, href)) continue;
        if (validLinks.length >= MAX_AUTO_LINKS) break;

        // Extract anchor text for this href
        const linkMatch = suggestedValue.match(new RegExp(`<a[^>]*href=["']${href.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["'][^>]*>([^<]*)</a>`, 'i'));
        const text = linkMatch?.[1]?.trim() || href;
        validLinks.push({ href, text });
      }

      if (validLinks.length === 0) {
        fixesSkipped.push({ field: 'internal_links', fixType, reason: 'No valid internal link targets found' });
        continue;
      }

      // Use template-based clean block instead of raw AI HTML
      const cleanBlock = buildCleanLinkBlock(validLinks);
      modifiedContent = modifiedContent + cleanBlock;
      contentChanged = true;

      fixesApplied.push({
        field: 'content (Internal Links)',
        fixType,
        beforeValue: '(no Related Resources)',
        afterValue: `Added ${validLinks.length} internal links`,
      });

      logBlogAiAudit({
        tool_name: 'bulk_auto_fix',
        before_value: '(no links block)',
        after_value: cleanBlock.substring(0, 200),
        apply_mode: applyMode,
        target_field: 'internal_links',
        slug: post.slug,
      });
      continue;
    }

    // ── INSERT_BEFORE_FIRST_HEADING: Intro/H1 ──
    if (applyMode === 'insert_before_first_heading' && (fixType === 'intro' || fixType === 'h1' || fixType === 'heading_structure')) {
      if (hasExistingIntro(modifiedContent)) {
        fixesSkipped.push({ field: 'intro', fixType, reason: 'Intro already exists' });
        continue;
      }
      if (!suggestedValue || stripHtmlLength(suggestedValue) < 20) {
        fixesSkipped.push({ field: 'intro', fixType, reason: 'Intro content too short or empty' });
        continue;
      }
      if (contentBlockAlreadyExists(modifiedContent, suggestedValue)) {
        fixesSkipped.push({ field: 'intro', fixType, reason: 'Intro content already exists' });
        continue;
      }

      const sanitized = sanitizeLinkBlockHtml(suggestedValue);
      modifiedContent = insertBeforeFirstHeadingRaw(modifiedContent, sanitized);
      contentChanged = true;

      fixesApplied.push({
        field: 'content (Intro)',
        fixType,
        beforeValue: '(no intro)',
        afterValue: `Added intro (${stripHtmlLength(sanitized)} chars)`,
      });

      logBlogAiAudit({
        tool_name: 'bulk_auto_fix',
        before_value: '(no intro)',
        after_value: sanitized.substring(0, 200),
        apply_mode: applyMode,
        target_field: 'intro',
        slug: post.slug,
      });
      continue;
    }

    // ── Catch-all: any unhandled fix ──
    fixesSkipped.push({
      field: field || fixType || 'unknown',
      fixType,
      reason: `Unhandled fix type/mode combination: ${fixType}/${applyMode}`,
    });
  }

  // ── Build final DB update ──
  if (contentChanged) {
    // Verify content is still meaningful
    const finalLength = stripHtmlLength(modifiedContent);
    if (finalLength < 100) {
      // Content became too short — revert content changes
      modifiedContent = post.content;
      contentChanged = false;
      // Remove content-related applied fixes
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

  // Always recalculate word count if metadata changed
  if (Object.keys(updatePayload).length > 0 && !updatePayload.word_count) {
    const { word_count, reading_time } = wordCountFields(updatePayload.content || post.content);
    updatePayload.word_count = word_count;
    updatePayload.reading_time = reading_time;
  }

  // Write to DB
  if (Object.keys(updatePayload).length > 0) {
    // Stamp ai_fixed_at only when fixes were applied
    if (fixesApplied.length > 0) {
      updatePayload.ai_fixed_at = new Date().toISOString();
    }
    const { error: updateError } = await supabase
      .from('blog_posts')
      .update(updatePayload)
      .eq('id', post.id);
    if (updateError) throw new Error(`DB update failed: ${updateError.message}`);
  }

  // Telemetry per article
  trackBlogToolEvent({
    event_name: 'bulk_auto_fix_complete',
    tool_name: 'bulk_auto_fix',
    status: fixesApplied.length > 0 ? (fixesSkipped.length > 0 ? 'partially_fixed' : 'fixed') : 'skipped',
    item_count: fixesApplied.length,
    slug: post.slug,
  });

  // Determine result status
  let status: ArticleResult['status'];
  if (fixesApplied.length > 0 && fixesSkipped.length === 0) {
    status = 'fixed';
  } else if (fixesApplied.length > 0 && fixesSkipped.length > 0) {
    status = 'partially_fixed';
  } else {
    status = 'skipped';
  }

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

  for (const r of results) {
    switch (r.status) {
      case 'fixed': totalFixed++; break;
      case 'partially_fixed': totalPartial++; break;
      case 'skipped': totalSkipped++; break;
      case 'failed': totalFailed++; break;
      case 'stopped': totalStopped++; break;
    }
    for (const f of r.fixesApplied) {
      fieldBreakdown[f.field] = (fieldBreakdown[f.field] || 0) + 1;
    }
  }

  return { totalFixed, totalPartial, totalSkipped, totalFailed, totalStopped, fieldBreakdown };
}
