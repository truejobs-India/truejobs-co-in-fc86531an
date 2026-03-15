import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  analyzeQuality, analyzeSEO, blogPostToMetadata,
} from '@/lib/blogArticleAnalyzer';
import { analyzePublishCompliance } from '@/lib/blogComplianceAnalyzer';

// ── Types ──────────────────────────────────────────────

export type WorkflowType = 'fix' | 'enrich' | 'publish';

export type WorkflowStatus =
  | 'idle' | 'scanning' | 'scan_complete' | 'executing'
  | 'stopped' | 'completed' | 'failed' | 'stale' | 'cancelled';

export type SkipReason =
  | 'already_good' | 'ranking_protection' | 'manual_review'
  | 'deferred_by_cap' | 'skipped_execution';

export type ActionType = 'minimal_safe_edit' | 'targeted_fix' | 'full_enrich' | 'skip';

export interface ArticleVerdict {
  slug: string;
  title: string;
  verdict: 'needs_action' | 'skip' | 'manual_review';
  confidence: number;
  reasons: string[];
  severity: 'minor' | 'moderate' | 'major';
  action_type: ActionType;
  safe_to_bulk_edit: boolean;
  requires_manual_review: boolean;
  preserve_elements: string[];
  missing_elements: string[];
  ranking_risk: 'low' | 'medium' | 'high';
  skip_reason?: SkipReason;
  heuristic_triage?: string;
  post_id: string;
  publish_checks?: PublishChecks;
}

export interface PublishChecks {
  verified_fixed: boolean;
  verified_enriched: boolean;
  publish_requirements_passed: boolean;
  publish_confidence: number;
  soft_warnings: string[];
}

export interface ScanReport {
  total_scanned: number;
  total_pending: number;
  max_per_run: number;
  capped_remaining: number;
  workflow_type?: WorkflowType;
  categories: {
    skip_already_good: ArticleVerdict[];
    skip_ranking_protection: ArticleVerdict[];
    minimal_safe_edit: ArticleVerdict[];
    targeted_fix: ArticleVerdict[];
    deeper_enrichment: ArticleVerdict[];
    manual_review: ArticleVerdict[];
    deferred_by_cap: ArticleVerdict[];
  };
  publish_categories?: {
    ready_to_publish: ArticleVerdict[];
    not_ready_missing_fixes: ArticleVerdict[];
    not_ready_missing_enrichment: ArticleVerdict[];
    not_ready_publish_requirements: ArticleVerdict[];
    manual_review: ArticleVerdict[];
    already_published: ArticleVerdict[];
    deferred_by_cap: ArticleVerdict[];
  };
  publish_summary?: {
    verified_fixed_count: number;
    verified_enriched_count: number;
    publish_requirements_passed_count: number;
    ready_to_publish_count: number;
    manual_review_count: number;
    deferred_count: number;
  };
  estimated_api_calls: number;
}

export interface ExecutionResult {
  slug: string;
  title: string;
  status: 'success' | 'failed' | 'skipped';
  reason: string;
  timestamp: string;
}

export interface WorkflowProgress {
  total: number;
  done: number;
  success: number;
  failed: number;
  skipped: number;
  current_article_id: string | null;
  current_title: string;
  max_per_run: number;
  capped_remaining: number;
}

interface WorkflowSession {
  id: string;
  workflow_type: WorkflowType;
  status: string;
  scan_report: any;
  progress: any;
  execution_results: ExecutionResult[];
  stop_requested: boolean;
  ai_model: string | null;
  max_articles_per_run: number;
  started_at: string;
  completed_at: string | null;
  last_heartbeat_at: string;
  started_by: string;
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
  word_count: number | null;
  category: string | null;
  tags: string[] | null;
  faq_count: number | null;
  has_faq_schema: boolean | null;
  internal_links: any;
  canonical_url: string | null;
  author_name: string | null;
  ai_fixed_at: string | null;
}

const SAFE_METADATA_FIELDS = new Set(['meta_title', 'meta_description', 'excerpt', 'featured_image_alt', 'canonical_url', 'slug', 'author_name']);
const STALE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes
const STAGE2_BATCH_SIZE = 6;

// ── Publish eligibility checker (reusable) ──
// Soft-only keys: canonical and author are not hard blockers
const PUBLISH_SOFT_BLOCK_KEYS = new Set(['missing-canonical', 'missing-author']);

export interface PublishEligibility {
  eligible: boolean;
  verified_fixed: boolean;
  verified_enriched: boolean;
  publish_requirements_passed: boolean;
  confidence: number;
  reasons: string[];
  soft_warnings: string[];
  category: 'ready' | 'missing_fixes' | 'missing_enrichment' | 'publish_requirements' | 'manual_review';
}

export function checkPublishEligibility(post: BlogPost): PublishEligibility {
  const reasons: string[] = [];
  const softWarnings: string[] = [];
  let verified_fixed = true;
  let verified_enriched = true;
  let publish_requirements_passed = true;

  // ── Hard blockers (publish requirements) ──
  if (!post.title || post.title.trim().length === 0) {
    reasons.push('Missing title');
    publish_requirements_passed = false;
  }
  if (!post.slug || post.slug.trim().length === 0) {
    reasons.push('Missing slug');
    publish_requirements_passed = false;
  }
  if (!post.content || post.content.trim().length < 50) {
    reasons.push('Missing or near-empty content');
    publish_requirements_passed = false;
  }

  const wordCount = post.word_count || 0;
  if (wordCount < 100) {
    reasons.push(`Extremely thin content: ${wordCount} words`);
    publish_requirements_passed = false;
  }

  if (!publish_requirements_passed) {
    return {
      eligible: false, verified_fixed, verified_enriched,
      publish_requirements_passed, confidence: 0, reasons, soft_warnings: softWarnings,
      category: 'publish_requirements',
    };
  }

  // ── Verified fixed (compliance) ──
  const meta = blogPostToMetadata(post as any);
  const quality = analyzeQuality(meta);
  const seo = analyzeSEO(meta);
  const compliance = analyzePublishCompliance(meta);

  // Count hard compliance fails (excluding soft-only keys)
  const hardFails = compliance.checks.filter(
    c => c.status === 'fail' && !PUBLISH_SOFT_BLOCK_KEYS.has(c.key)
  );

  if (hardFails.length > 0) {
    reasons.push(`${hardFails.length} compliance failure(s): ${hardFails.map(f => f.key).join(', ')}`);
    verified_fixed = false;
  }

  // Count non-critical fails excluding soft keys
  const relevantFailCount = compliance.checks.filter(
    c => c.status === 'fail' && !PUBLISH_SOFT_BLOCK_KEYS.has(c.key)
  ).length;

  if (relevantFailCount >= 2) {
    reasons.push(`${relevantFailCount} compliance failures (threshold: < 2)`);
    verified_fixed = false;
  }

  if (quality.totalScore < 55) {
    reasons.push(`Quality score ${quality.totalScore} < 55`);
    verified_fixed = false;
  }
  if (seo.totalScore < 55) {
    reasons.push(`SEO score ${seo.totalScore} < 55`);
    verified_fixed = false;
  }

  if (!verified_fixed) {
    return {
      eligible: false, verified_fixed, verified_enriched,
      publish_requirements_passed, confidence: 0, reasons, soft_warnings: softWarnings,
      category: 'missing_fixes',
    };
  }

  // ── Verified enriched (structural) ──
  if (wordCount < 400) {
    reasons.push(`Too thin for publishing: ${wordCount} words (min 400)`);
    verified_enriched = false;
  }

  const h2Count = (meta.headings || []).filter(h => h.level === 2).length;
  if (h2Count === 0) {
    reasons.push('No H2 headings — missing content structure');
    verified_enriched = false;
  }

  if (!meta.hasIntro && !meta.hasConclusion) {
    reasons.push('Missing both intro and conclusion');
    verified_enriched = false;
  }

  if (!verified_enriched) {
    return {
      eligible: false, verified_fixed, verified_enriched,
      publish_requirements_passed, confidence: 0, reasons, soft_warnings: softWarnings,
      category: 'missing_enrichment',
    };
  }

  // ── Soft warnings (tracked, not blocking) ──
  if (!post.cover_image_url) softWarnings.push('No cover image');
  if (!post.excerpt) softWarnings.push('No excerpt');
  if (!post.meta_title) softWarnings.push('No meta title');
  if (!post.meta_description) softWarnings.push('No meta description');
  if (!post.canonical_url) softWarnings.push('No canonical URL');
  if (!post.featured_image_alt) softWarnings.push('No featured image alt');

  // ── Confidence gate ──
  const isBorderline =
    quality.totalScore < 75 || seo.totalScore < 75 ||
    compliance.warnCount >= 3 ||
    wordCount < 800 ||
    relevantFailCount === 1 ||
    (!post.ai_fixed_at && quality.totalScore < 70);

  if (isBorderline) {
    // Borderline — needs Stage 2 AI verification
    return {
      eligible: false, verified_fixed, verified_enriched,
      publish_requirements_passed,
      confidence: 0.5,
      reasons: [`Borderline: quality=${quality.totalScore}, seo=${seo.totalScore}, warns=${compliance.warnCount}, words=${wordCount}`],
      soft_warnings: softWarnings,
      category: 'manual_review', // Will be routed to Stage 2
    };
  }

  // Clear pass
  return {
    eligible: true, verified_fixed, verified_enriched,
    publish_requirements_passed,
    confidence: 0.95,
    reasons: [],
    soft_warnings: softWarnings,
    category: 'ready',
  };
}

export function useBulkBlogWorkflow() {
  const [status, setStatus] = useState<WorkflowStatus>('idle');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [scanReport, setScanReport] = useState<ScanReport | null>(null);
  const [progress, setProgress] = useState<WorkflowProgress | null>(null);
  const [executionResults, setExecutionResults] = useState<ExecutionResult[]>([]);
  const [scanProgress, setScanProgress] = useState<{ stage: number; done: number; total: number; detail: string } | null>(null);
  const cancelRef = useRef(false);

  // ── On mount: check for existing sessions ──
  useEffect(() => {
    checkExistingSessions();
  }, []);

  const checkExistingSessions = async () => {
    const { data: sessions } = await supabase
      .from('blog_bulk_workflow_sessions')
      .select('*')
      .in('status', ['scanning', 'executing', 'scan_complete'])
      .order('started_at', { ascending: false })
      .limit(1) as any;

    if (!sessions || sessions.length === 0) return;
    const session: WorkflowSession = sessions[0];

    const heartbeatAge = Date.now() - new Date(session.last_heartbeat_at).getTime();

    if ((session.status === 'scanning' || session.status === 'executing') && heartbeatAge > STALE_THRESHOLD_MS) {
      await supabase.from('blog_bulk_workflow_sessions').update({ status: 'stale' } as any).eq('id', session.id);
      return;
    }

    setSessionId(session.id);
    if (session.status === 'scan_complete' && session.scan_report) {
      setScanReport(session.scan_report as ScanReport);
      setStatus('scan_complete');
    } else if (session.status === 'executing') {
      setProgress(session.progress as WorkflowProgress);
      setExecutionResults((session.execution_results || []) as ExecutionResult[]);
      setStatus('executing');
    } else if (session.status === 'scanning') {
      setStatus('scanning');
    }
  };

  // ── Heartbeat update helper ──
  const updateHeartbeat = async (sid: string, extraUpdates?: Record<string, any>) => {
    await supabase.from('blog_bulk_workflow_sessions').update({
      last_heartbeat_at: new Date().toISOString(),
      ...extraUpdates,
    } as any).eq('id', sid);
  };

  // ── Start Scan ──
  const startScan = useCallback(async (
    type: WorkflowType,
    posts: BlogPost[],
    aiModel: string,
    maxPerRun: number
  ) => {
    cancelRef.current = false;

    // Check for active sessions
    const { data: active } = await supabase
      .from('blog_bulk_workflow_sessions')
      .select('id, last_heartbeat_at')
      .in('status', ['scanning', 'executing']) as any;

    const now = Date.now();
    const hasActive = (active || []).some((s: any) =>
      now - new Date(s.last_heartbeat_at).getTime() < STALE_THRESHOLD_MS
    );
    if (hasActive) {
      throw new Error('Another bulk workflow is currently running. Please wait or stop it first.');
    }

    // Create session
    const { data: session, error: insertErr } = await supabase
      .from('blog_bulk_workflow_sessions')
      .insert({
        workflow_type: type,
        status: 'scanning',
        ai_model: aiModel,
        max_articles_per_run: maxPerRun,
        started_by: (await supabase.auth.getUser()).data.user?.id || '',
      } as any)
      .select()
      .single();

    if (insertErr) throw insertErr;
    const sid = (session as any).id;
    setSessionId(sid);
    setStatus('scanning');
    setScanProgress({ stage: 1, done: 0, total: posts.length, detail: type === 'publish' ? 'Running publish eligibility checks…' : 'Running heuristic analysis…' });

    try {
      if (type === 'publish') {
        await runPublishScan(posts, aiModel, maxPerRun, sid);
      } else {
        await runFixEnrichScan(type, posts, aiModel, maxPerRun, sid);
      }
    } catch (err: any) {
      console.error('Scan failed:', err);
      await supabase.from('blog_bulk_workflow_sessions').update({
        status: 'failed',
        scan_report: { error: err.message },
      } as any).eq('id', sid);
      setStatus('failed');
      setScanProgress(null);
      throw err;
    }
  }, []);

  // ── Publish Scan ──
  const runPublishScan = async (
    posts: BlogPost[],
    aiModel: string,
    maxPerRun: number,
    sid: string
  ) => {
    const readyToPublish: ArticleVerdict[] = [];
    const notReadyFixes: ArticleVerdict[] = [];
    const notReadyEnrichment: ArticleVerdict[] = [];
    const notReadyRequirements: ArticleVerdict[] = [];
    const manualReview: ArticleVerdict[] = [];
    const alreadyPublished: ArticleVerdict[] = [];
    const stage2Candidates: { post: BlogPost; verdict: ArticleVerdict; eligibility: PublishEligibility }[] = [];

    let verifiedFixedCount = 0;
    let verifiedEnrichedCount = 0;
    let publishReqPassedCount = 0;

    // Stage 1: Deterministic screening
    for (let i = 0; i < posts.length; i++) {
      if (cancelRef.current) {
        await handlePublishScanCancel(sid, maxPerRun, readyToPublish, notReadyFixes, notReadyEnrichment, notReadyRequirements, manualReview, alreadyPublished, [], verifiedFixedCount, verifiedEnrichedCount, publishReqPassedCount);
        return;
      }

      const post = posts[i];

      // Already published → skip
      if (post.is_published) {
        alreadyPublished.push(makePublishVerdict(post, 'skip', 'Already published', 'already_good', {
          verified_fixed: true, verified_enriched: true,
          publish_requirements_passed: true, publish_confidence: 1, soft_warnings: [],
        }));
        setScanProgress({ stage: 1, done: i + 1, total: posts.length, detail: `Checked: ${post.title.substring(0, 40)}…` });
        continue;
      }

      const eligibility = checkPublishEligibility(post);

      if (eligibility.publish_requirements_passed) publishReqPassedCount++;
      if (eligibility.verified_fixed) verifiedFixedCount++;
      if (eligibility.verified_enriched) verifiedEnrichedCount++;

      const checks: PublishChecks = {
        verified_fixed: eligibility.verified_fixed,
        verified_enriched: eligibility.verified_enriched,
        publish_requirements_passed: eligibility.publish_requirements_passed,
        publish_confidence: eligibility.confidence,
        soft_warnings: eligibility.soft_warnings,
      };

      if (eligibility.category === 'publish_requirements') {
        notReadyRequirements.push(makePublishVerdict(post, 'skip', eligibility.reasons.join('; '), undefined, checks));
      } else if (eligibility.category === 'missing_fixes') {
        notReadyFixes.push(makePublishVerdict(post, 'skip', eligibility.reasons.join('; '), undefined, checks));
      } else if (eligibility.category === 'missing_enrichment') {
        notReadyEnrichment.push(makePublishVerdict(post, 'skip', eligibility.reasons.join('; '), undefined, checks));
      } else if (eligibility.category === 'manual_review' && eligibility.confidence < 0.7) {
        // Borderline → Stage 2
        const verdict = makePublishVerdict(post, 'manual_review', eligibility.reasons.join('; '), 'manual_review', checks);
        verdict.heuristic_triage = 'BORDERLINE';
        stage2Candidates.push({ post, verdict, eligibility });
      } else if (eligibility.eligible) {
        readyToPublish.push(makePublishVerdict(post, 'needs_action', 'Passed all publish checks', undefined, checks));
      } else {
        manualReview.push(makePublishVerdict(post, 'manual_review', eligibility.reasons.join('; '), 'manual_review', checks));
      }

      setScanProgress({ stage: 1, done: i + 1, total: posts.length, detail: `Checked: ${post.title.substring(0, 40)}…` });
    }

    await updateHeartbeat(sid);

    // Stage 2: AI verification for borderline candidates
    if (stage2Candidates.length > 0) {
      setScanProgress({ stage: 2, done: 0, total: stage2Candidates.length, detail: 'AI content quality verification…' });

      for (let batchStart = 0; batchStart < stage2Candidates.length; batchStart += STAGE2_BATCH_SIZE) {
        if (cancelRef.current) {
          // Route remaining to manual_review
          for (let j = batchStart; j < stage2Candidates.length; j++) {
            manualReview.push(stage2Candidates[j].verdict);
          }
          break;
        }

        const batch = stage2Candidates.slice(batchStart, batchStart + STAGE2_BATCH_SIZE);
        const digests = batch.map(({ post, verdict }) => buildDigest(post, verdict));

        try {
          const { data, error } = await supabase.functions.invoke('classify-blog-articles', {
            body: { articles: digests, workflow_type: 'publish', ai_model: aiModel },
          });

          if (error) throw error;

          const aiVerdicts = data?.verdicts || [];
          for (let j = 0; j < batch.length; j++) {
            const candidate = batch[j];
            const aiVerdict = aiVerdicts[j];

            if (aiVerdict && aiVerdict.verdict === 'needs_action' && aiVerdict.confidence >= 0.7) {
              // AI says publish-ready — upgrade from borderline
              candidate.verdict.verdict = 'needs_action';
              candidate.verdict.confidence = aiVerdict.confidence;
              candidate.verdict.reasons = ['AI verified as publish-ready', ...(aiVerdict.reasons || [])];
              if (candidate.verdict.publish_checks) {
                candidate.verdict.publish_checks.publish_confidence = aiVerdict.confidence;
              }
              readyToPublish.push(candidate.verdict);
            } else {
              // AI says not ready or low confidence → manual_review
              candidate.verdict.verdict = 'manual_review';
              candidate.verdict.requires_manual_review = true;
              candidate.verdict.skip_reason = 'manual_review';
              if (aiVerdict?.reasons) {
                candidate.verdict.reasons = aiVerdict.reasons;
              }
              candidate.verdict.reasons.push(aiVerdict?.confidence < 0.7 ? 'Low AI confidence' : 'AI: not publish-ready');
              manualReview.push(candidate.verdict);
            }
          }
        } catch (err: any) {
          console.error('Stage 2 publish batch failed:', err);
          for (const candidate of batch) {
            candidate.verdict.reasons.push(`AI classification error: ${err.message?.substring(0, 100)}`);
            manualReview.push(candidate.verdict);
          }
        }

        setScanProgress({ stage: 2, done: Math.min(batchStart + STAGE2_BATCH_SIZE, stage2Candidates.length), total: stage2Candidates.length, detail: `Verified batch ${Math.floor(batchStart / STAGE2_BATCH_SIZE) + 1}` });
        await updateHeartbeat(sid);
      }
    }

    // Apply cap
    const deferredByCap: ArticleVerdict[] = [];
    if (readyToPublish.length > maxPerRun) {
      const excess = readyToPublish.splice(maxPerRun);
      for (const item of excess) {
        item.skip_reason = 'deferred_by_cap';
        deferredByCap.push(item);
      }
    }

    // Build publish report
    const report: ScanReport = {
      total_scanned: posts.length,
      total_pending: readyToPublish.length,
      max_per_run: maxPerRun,
      capped_remaining: deferredByCap.length,
      workflow_type: 'publish',
      categories: {
        skip_already_good: alreadyPublished,
        skip_ranking_protection: [],
        minimal_safe_edit: [],
        targeted_fix: [],
        deeper_enrichment: [],
        manual_review: manualReview,
        deferred_by_cap: deferredByCap,
      },
      publish_categories: {
        ready_to_publish: readyToPublish,
        not_ready_missing_fixes: notReadyFixes,
        not_ready_missing_enrichment: notReadyEnrichment,
        not_ready_publish_requirements: notReadyRequirements,
        manual_review: manualReview,
        already_published: alreadyPublished,
        deferred_by_cap: deferredByCap,
      },
      publish_summary: {
        verified_fixed_count: verifiedFixedCount,
        verified_enriched_count: verifiedEnrichedCount,
        publish_requirements_passed_count: publishReqPassedCount,
        ready_to_publish_count: readyToPublish.length,
        manual_review_count: manualReview.length,
        deferred_count: deferredByCap.length,
      },
      estimated_api_calls: 0, // Publish doesn't use AI calls for execution
    };

    setScanReport(report);
    setScanProgress(null);
    setStatus('scan_complete');

    await supabase.from('blog_bulk_workflow_sessions').update({
      status: 'scan_complete',
      scan_report: report as any,
      last_heartbeat_at: new Date().toISOString(),
    } as any).eq('id', sid);
  };

  const handlePublishScanCancel = async (
    sid: string, maxPerRun: number,
    readyToPublish: ArticleVerdict[], notReadyFixes: ArticleVerdict[],
    notReadyEnrichment: ArticleVerdict[], notReadyRequirements: ArticleVerdict[],
    manualReview: ArticleVerdict[], alreadyPublished: ArticleVerdict[],
    deferredByCap: ArticleVerdict[],
    verifiedFixedCount: number, verifiedEnrichedCount: number, publishReqPassedCount: number
  ) => {
    const report: ScanReport = {
      total_scanned: readyToPublish.length + notReadyFixes.length + notReadyEnrichment.length + notReadyRequirements.length + manualReview.length + alreadyPublished.length,
      total_pending: readyToPublish.length,
      max_per_run: maxPerRun,
      capped_remaining: 0,
      workflow_type: 'publish',
      categories: {
        skip_already_good: alreadyPublished, skip_ranking_protection: [],
        minimal_safe_edit: [], targeted_fix: [], deeper_enrichment: [],
        manual_review: manualReview, deferred_by_cap: deferredByCap,
      },
      publish_categories: {
        ready_to_publish: readyToPublish, not_ready_missing_fixes: notReadyFixes,
        not_ready_missing_enrichment: notReadyEnrichment, not_ready_publish_requirements: notReadyRequirements,
        manual_review: manualReview, already_published: alreadyPublished, deferred_by_cap: deferredByCap,
      },
      publish_summary: {
        verified_fixed_count: verifiedFixedCount, verified_enriched_count: verifiedEnrichedCount,
        publish_requirements_passed_count: publishReqPassedCount,
        ready_to_publish_count: readyToPublish.length,
        manual_review_count: manualReview.length, deferred_count: 0,
      },
      estimated_api_calls: 0,
    };

    await supabase.from('blog_bulk_workflow_sessions').update({
      status: 'cancelled', scan_report: report as any,
    } as any).eq('id', sid);
    setScanReport(report);
    setStatus('cancelled');
    setScanProgress(null);
  };

  // ── Fix/Enrich Scan (existing logic) ──
  const runFixEnrichScan = async (
    type: 'fix' | 'enrich',
    posts: BlogPost[],
    aiModel: string,
    maxPerRun: number,
    sid: string
  ) => {
    const verdicts: ArticleVerdict[] = [];
    const stage2Candidates: { post: BlogPost; verdict: ArticleVerdict }[] = [];

    for (let i = 0; i < posts.length; i++) {
      if (cancelRef.current) {
        await supabase.from('blog_bulk_workflow_sessions').update({
          status: 'cancelled',
          scan_report: buildPartialReport(verdicts, maxPerRun),
        } as any).eq('id', sid);
        setStatus('cancelled');
        setScanProgress(null);
        return;
      }

      const post = posts[i];
      const meta = blogPostToMetadata(post as any);
      const quality = analyzeQuality(meta);
      const seo = analyzeSEO(meta);
      const compliance = analyzePublishCompliance(meta);

      const baseVerdict: ArticleVerdict = {
        slug: post.slug,
        title: post.title,
        post_id: post.id,
        verdict: 'skip',
        confidence: 1,
        reasons: [],
        severity: 'minor',
        action_type: 'skip',
        safe_to_bulk_edit: false,
        requires_manual_review: false,
        preserve_elements: [],
        missing_elements: [],
        ranking_risk: 'low',
      };

      if (type === 'fix') {
        const isPass = quality.totalScore >= 80 && seo.totalScore >= 80 &&
          compliance.failCount === 0 && compliance.warnCount <= 1;
        const isObjectivelyBad = quality.totalScore < 60 || seo.totalScore < 60 || compliance.failCount >= 3;

        if (isPass) {
          baseVerdict.verdict = 'skip';
          baseVerdict.skip_reason = 'already_good';
          baseVerdict.heuristic_triage = 'PASS';
          verdicts.push(baseVerdict);
        } else if (isObjectivelyBad) {
          baseVerdict.verdict = 'needs_action';
          baseVerdict.action_type = 'targeted_fix';
          baseVerdict.severity = compliance.failCount >= 3 ? 'major' : 'moderate';
          baseVerdict.safe_to_bulk_edit = true;
          baseVerdict.confidence = 0.9;
          baseVerdict.reasons = [];
          if (quality.totalScore < 60) baseVerdict.reasons.push(`Quality score ${quality.totalScore} < 60`);
          if (seo.totalScore < 60) baseVerdict.reasons.push(`SEO score ${seo.totalScore} < 60`);
          if (compliance.failCount >= 3) baseVerdict.reasons.push(`${compliance.failCount} compliance failures`);
          baseVerdict.missing_elements = compliance.checks.filter(c => c.status === 'fail').map(c => c.key);
          baseVerdict.heuristic_triage = 'LIKELY_PENDING_OBJECTIVE';
          verdicts.push(baseVerdict);
        } else {
          baseVerdict.heuristic_triage = 'BORDERLINE';
          baseVerdict.reasons.push(`Quality: ${quality.totalScore}, SEO: ${seo.totalScore}, Fails: ${compliance.failCount}, Warns: ${compliance.warnCount}`);
          stage2Candidates.push({ post, verdict: baseVerdict });
        }
      } else {
        const hasIntro = meta.hasIntro;
        const hasConclusion = meta.hasConclusion;
        const h2Count = (meta.headings || []).filter(h => h.level === 2).length;
        const hasFaqs = (meta.faqCount || 0) > 0;
        const hasLinks = (meta.internalLinks?.length || 0) > 0;
        const wordCount = meta.wordCount;

        const isPass = wordCount >= 1200 && hasIntro && hasConclusion && h2Count >= 3 && hasFaqs && hasLinks;
        const isNearEmpty = wordCount < 200;

        if (isPass) {
          baseVerdict.verdict = 'skip';
          baseVerdict.skip_reason = 'already_good';
          baseVerdict.heuristic_triage = 'PASS';
          verdicts.push(baseVerdict);
        } else if (isNearEmpty) {
          baseVerdict.verdict = 'needs_action';
          baseVerdict.action_type = 'full_enrich';
          baseVerdict.severity = 'major';
          baseVerdict.safe_to_bulk_edit = true;
          baseVerdict.confidence = 0.95;
          baseVerdict.reasons = [`Near-empty: ${wordCount} words`];
          baseVerdict.missing_elements = ['substantial_content'];
          baseVerdict.heuristic_triage = 'AUTO_PENDING';
          verdicts.push(baseVerdict);
        } else {
          baseVerdict.heuristic_triage = 'STAGE2';
          const missing: string[] = [];
          if (!hasIntro) missing.push('intro');
          if (!hasConclusion) missing.push('conclusion');
          if (h2Count < 3) missing.push('more_headings');
          if (!hasFaqs) missing.push('faq_section');
          if (!hasLinks) missing.push('internal_links');
          if (wordCount < 1200) missing.push('more_content');
          baseVerdict.missing_elements = missing;
          baseVerdict.reasons.push(`Word count: ${wordCount}, Missing: ${missing.join(', ')}`);
          stage2Candidates.push({ post, verdict: baseVerdict });
        }
      }

      setScanProgress({ stage: 1, done: i + 1, total: posts.length, detail: `Analyzed: ${post.title.substring(0, 40)}…` });
    }

    await updateHeartbeat(sid);

    // Stage 2: AI Classification
    if (stage2Candidates.length > 0) {
      setScanProgress({ stage: 2, done: 0, total: stage2Candidates.length, detail: 'Starting AI classification…' });

      for (let batchStart = 0; batchStart < stage2Candidates.length; batchStart += STAGE2_BATCH_SIZE) {
        if (cancelRef.current) {
          for (let j = batchStart; j < stage2Candidates.length; j++) {
            const c = stage2Candidates[j];
            c.verdict.verdict = 'manual_review';
            c.verdict.requires_manual_review = true;
            c.verdict.skip_reason = 'manual_review';
            c.verdict.reasons.push('Scan cancelled before AI classification');
            verdicts.push(c.verdict);
          }
          await supabase.from('blog_bulk_workflow_sessions').update({
            status: 'cancelled',
            scan_report: buildReport(verdicts, maxPerRun),
          } as any).eq('id', sid);
          setStatus('cancelled');
          setScanReport(buildReport(verdicts, maxPerRun));
          setScanProgress(null);
          return;
        }

        const batch = stage2Candidates.slice(batchStart, batchStart + STAGE2_BATCH_SIZE);
        const digests = batch.map(({ post, verdict }) => buildDigest(post, verdict));

        try {
          const { data, error } = await supabase.functions.invoke('classify-blog-articles', {
            body: { articles: digests, workflow_type: type, ai_model: aiModel },
          });

          if (error) throw error;

          const aiVerdicts = data?.verdicts || [];
          for (let j = 0; j < batch.length; j++) {
            const candidate = batch[j];
            const aiVerdict = aiVerdicts[j];

            if (aiVerdict) {
              candidate.verdict.verdict = aiVerdict.verdict;
              candidate.verdict.confidence = aiVerdict.confidence;
              candidate.verdict.reasons = aiVerdict.reasons || candidate.verdict.reasons;
              candidate.verdict.severity = aiVerdict.severity || 'moderate';
              candidate.verdict.action_type = aiVerdict.action_type || 'skip';
              candidate.verdict.safe_to_bulk_edit = aiVerdict.safe_to_bulk_edit ?? false;
              candidate.verdict.requires_manual_review = aiVerdict.requires_manual_review ?? false;
              candidate.verdict.preserve_elements = aiVerdict.preserve_elements || [];
              candidate.verdict.missing_elements = aiVerdict.missing_elements || candidate.verdict.missing_elements;
              candidate.verdict.ranking_risk = aiVerdict.ranking_risk || 'low';

              if (aiVerdict.verdict === 'skip') {
                candidate.verdict.skip_reason = candidate.post.is_published &&
                  (candidate.verdict as any).heuristic_triage !== 'PASS'
                  ? 'ranking_protection' : 'already_good';
              } else if (aiVerdict.verdict === 'manual_review') {
                candidate.verdict.skip_reason = 'manual_review';
              }
            } else {
              candidate.verdict.verdict = 'manual_review';
              candidate.verdict.requires_manual_review = true;
              candidate.verdict.skip_reason = 'manual_review';
              candidate.verdict.reasons.push('No AI verdict returned');
            }

            verdicts.push(candidate.verdict);
          }
        } catch (err: any) {
          console.error('Stage 2 batch failed:', err);
          for (const candidate of batch) {
            candidate.verdict.verdict = 'manual_review';
            candidate.verdict.requires_manual_review = true;
            candidate.verdict.skip_reason = 'manual_review';
            candidate.verdict.reasons.push(`AI classification error: ${err.message?.substring(0, 100)}`);
            verdicts.push(candidate.verdict);
          }
        }

        setScanProgress({ stage: 2, done: Math.min(batchStart + STAGE2_BATCH_SIZE, stage2Candidates.length), total: stage2Candidates.length, detail: `Classified batch ${Math.floor(batchStart / STAGE2_BATCH_SIZE) + 1}` });
        await updateHeartbeat(sid);
      }
    }

    const report = buildReport(verdicts, maxPerRun);
    report.workflow_type = type;
    setScanReport(report);
    setScanProgress(null);
    setStatus('scan_complete');

    await supabase.from('blog_bulk_workflow_sessions').update({
      status: 'scan_complete',
      scan_report: report as any,
      last_heartbeat_at: new Date().toISOString(),
    } as any).eq('id', sid);
  };

  // ── Confirm Execution ──
  const confirmExecution = useCallback(async (
    blogTextModel: string,
    onArticleComplete?: () => void
  ) => {
    if (!sessionId || !scanReport) return;

    // Get workflow type
    const { data: sessionData } = await supabase
      .from('blog_bulk_workflow_sessions')
      .select('workflow_type')
      .eq('id', sessionId)
      .single() as any;

    const workflowType: WorkflowType = sessionData?.workflow_type || 'fix';

    if (workflowType === 'publish') {
      await executePublish(onArticleComplete);
      return;
    }

    const actionable = [
      ...scanReport.categories.minimal_safe_edit,
      ...scanReport.categories.targeted_fix,
      ...scanReport.categories.deeper_enrichment,
    ].filter(v => v.safe_to_bulk_edit);

    const cappedQueue = actionable.slice(0, scanReport.max_per_run);
    const deferred = actionable.slice(scanReport.max_per_run);

    for (const d of deferred) {
      d.skip_reason = 'deferred_by_cap';
    }

    const total = cappedQueue.length;
    const initialProgress: WorkflowProgress = {
      total, done: 0, success: 0, failed: 0, skipped: 0,
      current_article_id: null, current_title: '',
      max_per_run: scanReport.max_per_run,
      capped_remaining: deferred.length,
    };

    setProgress(initialProgress);
    setExecutionResults([]);
    setStatus('executing');

    await supabase.from('blog_bulk_workflow_sessions').update({
      status: 'executing',
      progress: initialProgress as any,
      stop_requested: false,
      last_heartbeat_at: new Date().toISOString(),
    } as any).eq('id', sessionId);

    let done = 0, success = 0, failed = 0, skipped = 0;

    for (const article of cappedQueue) {
      const { data: sessionCheck } = await supabase
        .from('blog_bulk_workflow_sessions')
        .select('stop_requested')
        .eq('id', sessionId)
        .single() as any;

      if (sessionCheck?.stop_requested) {
        for (let j = cappedQueue.indexOf(article); j < cappedQueue.length; j++) {
          const remaining = cappedQueue[j];
          if (j === cappedQueue.indexOf(article) && j > 0) continue;
          const result: ExecutionResult = {
            slug: remaining.slug, title: remaining.title,
            status: 'skipped', reason: 'Stopped by user',
            timestamp: new Date().toISOString(),
          };
          await appendExecutionResult(sessionId, result);
          skipped++;
        }
        break;
      }

      const currentProgress: WorkflowProgress = {
        total, done, success, failed, skipped,
        current_article_id: article.post_id,
        current_title: article.title,
        max_per_run: scanReport.max_per_run,
        capped_remaining: deferred.length,
      };
      setProgress(currentProgress);

      try {
        if (workflowType === 'fix') {
          await executeFixForArticle(article, blogTextModel);
        } else {
          await executeEnrichForArticle(article, blogTextModel);
        }

        const result: ExecutionResult = {
          slug: article.slug, title: article.title,
          status: 'success', reason: `${article.action_type} applied`,
          timestamp: new Date().toISOString(),
        };
        await appendExecutionResult(sessionId, result);
        setExecutionResults(prev => [...prev, result]);
        success++;
      } catch (err: any) {
        const result: ExecutionResult = {
          slug: article.slug, title: article.title,
          status: 'failed', reason: err.message?.substring(0, 200) || 'Unknown error',
          timestamp: new Date().toISOString(),
        };
        await appendExecutionResult(sessionId, result);
        setExecutionResults(prev => [...prev, result]);
        failed++;
      }

      done++;
      await updateHeartbeat(sessionId, {
        progress: { total, done, success, failed, skipped, current_article_id: null, current_title: '', max_per_run: scanReport.max_per_run, capped_remaining: deferred.length },
      });

      onArticleComplete?.();

      if (done < total) {
        await new Promise(r => setTimeout(r, 3000));
      }
    }

    const finalStatus = (await supabase
      .from('blog_bulk_workflow_sessions')
      .select('stop_requested')
      .eq('id', sessionId)
      .single() as any).data?.stop_requested ? 'stopped' : 'completed';

    const finalProgress: WorkflowProgress = {
      total, done, success, failed, skipped,
      current_article_id: null, current_title: '',
      max_per_run: scanReport.max_per_run,
      capped_remaining: deferred.length,
    };

    setProgress(finalProgress);
    setStatus(finalStatus as WorkflowStatus);

    await supabase.from('blog_bulk_workflow_sessions').update({
      status: finalStatus,
      progress: finalProgress as any,
      completed_at: new Date().toISOString(),
      last_heartbeat_at: new Date().toISOString(),
    } as any).eq('id', sessionId);

  }, [sessionId, scanReport]);

  // ── Execute Publish ──
  const executePublish = async (onArticleComplete?: () => void) => {
    if (!sessionId || !scanReport?.publish_categories) return;

    const publishQueue = scanReport.publish_categories.ready_to_publish;
    const total = publishQueue.length;
    const initialProgress: WorkflowProgress = {
      total, done: 0, success: 0, failed: 0, skipped: 0,
      current_article_id: null, current_title: '',
      max_per_run: scanReport.max_per_run,
      capped_remaining: scanReport.capped_remaining,
    };

    setProgress(initialProgress);
    setExecutionResults([]);
    setStatus('executing');

    await supabase.from('blog_bulk_workflow_sessions').update({
      status: 'executing',
      progress: initialProgress as any,
      stop_requested: false,
      last_heartbeat_at: new Date().toISOString(),
    } as any).eq('id', sessionId);

    let done = 0, success = 0, failed = 0, skipped = 0;

    for (const article of publishQueue) {
      // Check stop_requested
      const { data: sessionCheck } = await supabase
        .from('blog_bulk_workflow_sessions')
        .select('stop_requested')
        .eq('id', sessionId)
        .single() as any;

      if (sessionCheck?.stop_requested) {
        for (let j = publishQueue.indexOf(article); j < publishQueue.length; j++) {
          const remaining = publishQueue[j];
          if (j === publishQueue.indexOf(article) && j > 0) continue;
          const result: ExecutionResult = {
            slug: remaining.slug, title: remaining.title,
            status: 'skipped', reason: 'Stopped by user',
            timestamp: new Date().toISOString(),
          };
          await appendExecutionResult(sessionId, result);
          setExecutionResults(prev => [...prev, result]);
          skipped++;
        }
        break;
      }

      setProgress({
        total, done, success, failed, skipped,
        current_article_id: article.post_id,
        current_title: article.title,
        max_per_run: scanReport.max_per_run,
        capped_remaining: scanReport.capped_remaining,
      });

      try {
        // Re-fetch post from DB
        const { data: freshPost, error: fetchErr } = await supabase
          .from('blog_posts')
          .select('*')
          .eq('id', article.post_id)
          .single();

        if (fetchErr || !freshPost) {
          throw new Error(`Post not found: ${article.slug}`);
        }

        // Re-verify: check if already published
        if (freshPost.is_published) {
          const result: ExecutionResult = {
            slug: article.slug, title: article.title,
            status: 'skipped', reason: 'Already published (changed after scan)',
            timestamp: new Date().toISOString(),
          };
          await appendExecutionResult(sessionId, result);
          setExecutionResults(prev => [...prev, result]);
          skipped++;
          done++;
          continue;
        }

        // Re-verify: full publish eligibility check
        const recheck = checkPublishEligibility(freshPost as any);
        if (!recheck.eligible && recheck.confidence < 0.7) {
          const result: ExecutionResult = {
            slug: article.slug, title: article.title,
            status: 'skipped',
            reason: `Failed re-verification: ${recheck.reasons.join('; ')}`,
            timestamp: new Date().toISOString(),
          };
          await appendExecutionResult(sessionId, result);
          setExecutionResults(prev => [...prev, result]);
          skipped++;
          done++;
          continue;
        }

        // Publish
        const { error: updateErr } = await supabase
          .from('blog_posts')
          .update({
            is_published: true,
            status: 'published',
            published_at: new Date().toISOString(),
          })
          .eq('id', freshPost.id);

        if (updateErr) throw updateErr;

        const result: ExecutionResult = {
          slug: article.slug, title: article.title,
          status: 'success', reason: 'Published successfully',
          timestamp: new Date().toISOString(),
        };
        await appendExecutionResult(sessionId, result);
        setExecutionResults(prev => [...prev, result]);
        success++;
      } catch (err: any) {
        const result: ExecutionResult = {
          slug: article.slug, title: article.title,
          status: 'failed', reason: err.message?.substring(0, 200) || 'Unknown error',
          timestamp: new Date().toISOString(),
        };
        await appendExecutionResult(sessionId, result);
        setExecutionResults(prev => [...prev, result]);
        failed++;
      }

      done++;
      await updateHeartbeat(sessionId, {
        progress: { total, done, success, failed, skipped, current_article_id: null, current_title: '', max_per_run: scanReport.max_per_run, capped_remaining: scanReport.capped_remaining },
      });

      onArticleComplete?.();

      // 1s delay between publishes
      if (done < total) {
        await new Promise(r => setTimeout(r, 1000));
      }
    }

    const finalStatus = (await supabase
      .from('blog_bulk_workflow_sessions')
      .select('stop_requested')
      .eq('id', sessionId)
      .single() as any).data?.stop_requested ? 'stopped' : 'completed';

    const finalProgress: WorkflowProgress = {
      total, done, success, failed, skipped,
      current_article_id: null, current_title: '',
      max_per_run: scanReport.max_per_run,
      capped_remaining: scanReport.capped_remaining,
    };

    setProgress(finalProgress);
    setStatus(finalStatus as WorkflowStatus);

    await supabase.from('blog_bulk_workflow_sessions').update({
      status: finalStatus,
      progress: finalProgress as any,
      completed_at: new Date().toISOString(),
      last_heartbeat_at: new Date().toISOString(),
    } as any).eq('id', sessionId);
  };

  // ── Execute Fix for single article ──
  const executeFixForArticle = async (article: ArticleVerdict, aiModel: string) => {
    const { data: post, error } = await supabase
      .from('blog_posts')
      .select('*')
      .eq('id', article.post_id)
      .single();

    if (error || !post) throw new Error(`Post not found: ${article.slug}`);

    const meta = blogPostToMetadata(post as any);
    const compliance = analyzePublishCompliance(meta);
    const failedChecks = compliance.checks.filter(c => c.status === 'fail' || c.status === 'warn');

    if (failedChecks.length > 0) {
      const { data: fixData, error: fixError } = await supabase.functions.invoke('analyze-blog-compliance-fixes', {
        body: {
          title: post.title, content: post.content, slug: post.slug,
          aiModel,
          issues: failedChecks.map(c => ({ key: c.key, label: c.label, detail: c.detail, recommendation: c.recommendation })),
          existingMeta: {
            meta_title: post.meta_title, meta_description: post.meta_description, excerpt: post.excerpt,
            featured_image_alt: post.featured_image_alt, author_name: post.author_name, canonical_url: post.canonical_url,
            hasCoverImage: !!post.cover_image_url, hasIntro: meta.hasIntro, hasConclusion: meta.hasConclusion,
            headings: meta.headings, wordCount: meta.wordCount, featured_image: post.cover_image_url,
            faqCount: post.faq_count ?? 0, internalLinkCount: meta.internalLinks?.length ?? 0,
          },
        },
      });

      if (fixError) throw fixError;

      const fixes: any[] = Array.isArray(fixData?.fixes) ? fixData.fixes : [];
      const updatePayload: Record<string, any> = {};
      for (const fix of fixes) {
        const mode = fix.applyMode || 'advisory';
        if (mode === 'apply_field' && fix.field && SAFE_METADATA_FIELDS.has(fix.field) && fix.suggestedValue) {
          const currentVal = (post as any)[fix.field] || '';
          if (!currentVal || currentVal.length < 3) {
            updatePayload[fix.field] = fix.suggestedValue;
          }
        }
      }
      if (Object.keys(updatePayload).length > 0) {
        const freshWordCount = (post.content || '').replace(/<[^>]+>/g, '').split(/\s+/).filter((w: string) => w.length > 0).length;
        updatePayload.word_count = freshWordCount;
        updatePayload.reading_time = Math.max(1, Math.ceil(freshWordCount / 200));
        await supabase.from('blog_posts').update(updatePayload).eq('id', post.id);
      }
    }

    await supabase.from('blog_posts').update({ ai_fixed_at: new Date().toISOString() } as any).eq('id', post.id);
  };

  // ── Execute Enrich for single article ──
  const executeEnrichForArticle = async (article: ArticleVerdict, aiModel: string) => {
    const { data: post, error } = await supabase
      .from('blog_posts')
      .select('*')
      .eq('id', article.post_id)
      .single();

    if (error || !post) throw new Error(`Post not found: ${article.slug}`);

    const { data: enrichData, error: enrichError } = await supabase.functions.invoke('improve-blog-content', {
      body: {
        title: post.title, content: post.content,
        action: 'enrich-article', targetWordCount: 1500,
        category: post.category, tags: post.tags,
        aiModel,
        preserveElements: article.preserve_elements,
        missingElements: article.missing_elements,
      },
    });

    if (enrichError) throw enrichError;

    if (enrichData?.result) {
      const newContent = enrichData.result;
      const wordCount = newContent.replace(/<[^>]+>/g, '').split(/\s+/).filter((w: string) => w.length > 0).length;
      await supabase.from('blog_posts').update({
        content: newContent,
        word_count: wordCount,
        reading_time: Math.max(1, Math.ceil(wordCount / 200)),
      }).eq('id', post.id);
    }
  };

  // ── Append execution result (append-safe) ──
  const appendExecutionResult = async (sid: string, result: ExecutionResult) => {
    const { data: current } = await supabase
      .from('blog_bulk_workflow_sessions')
      .select('execution_results')
      .eq('id', sid)
      .single() as any;

    const existing: ExecutionResult[] = Array.isArray(current?.execution_results) ? current.execution_results : [];
    existing.push(result);

    await supabase.from('blog_bulk_workflow_sessions').update({
      execution_results: existing as any,
    } as any).eq('id', sid);
  };

  // ── Request Stop ──
  const requestStop = useCallback(async () => {
    if (!sessionId) return;
    await supabase.from('blog_bulk_workflow_sessions').update({
      stop_requested: true,
    } as any).eq('id', sessionId);
  }, [sessionId]);

  // ── Cancel Scan ──
  const cancelScan = useCallback(async () => {
    cancelRef.current = true;
  }, []);

  // ── Reset ──
  const reset = useCallback(() => {
    setStatus('idle');
    setSessionId(null);
    setScanReport(null);
    setProgress(null);
    setExecutionResults([]);
    setScanProgress(null);
    cancelRef.current = false;
  }, []);

  return {
    status,
    sessionId,
    scanReport,
    progress,
    executionResults,
    scanProgress,
    startScan,
    confirmExecution,
    requestStop,
    cancelScan,
    reset,
  };
}

// ── Helper: Make publish verdict ──
function makePublishVerdict(
  post: BlogPost,
  verdict: 'needs_action' | 'skip' | 'manual_review',
  reason: string,
  skipReason?: SkipReason,
  checks?: PublishChecks
): ArticleVerdict {
  return {
    slug: post.slug,
    title: post.title,
    post_id: post.id,
    verdict,
    confidence: checks?.publish_confidence ?? 0,
    reasons: [reason],
    severity: 'minor',
    action_type: verdict === 'needs_action' ? 'skip' : 'skip',
    safe_to_bulk_edit: verdict === 'needs_action',
    requires_manual_review: verdict === 'manual_review',
    preserve_elements: [],
    missing_elements: [],
    ranking_risk: 'low',
    skip_reason: skipReason,
    publish_checks: checks,
  };
}

// ── Helper: Build content digest for Stage 2 ──
function buildDigest(post: BlogPost, verdict: ArticleVerdict) {
  const plainText = (post.content || '').replace(/<[^>]+>/g, '');
  const isShort = plainText.length < 6000;

  const parser = typeof DOMParser !== 'undefined' ? new DOMParser() : null;
  let headings: { level: number; text: string }[] = [];
  if (parser) {
    const doc = parser.parseFromString(post.content || '', 'text/html');
    doc.querySelectorAll('h1, h2, h3, h4').forEach(el => {
      headings.push({ level: parseInt(el.tagName.substring(1)), text: el.textContent?.trim() || '' });
    });
  }

  const internalLinks = Array.isArray(post.internal_links)
    ? post.internal_links.map((l: any) => l.path || l).filter(Boolean)
    : [];

  const faqSummary: string[] = [];
  if (parser && post.content) {
    const doc = parser.parseFromString(post.content, 'text/html');
    doc.querySelectorAll('strong, b').forEach(el => {
      const text = el.textContent?.trim() || '';
      if (text.endsWith('?') && text.length > 10) {
        faqSummary.push(text);
      }
    });
  }

  return {
    slug: post.slug,
    title: post.title,
    headings,
    meta_summary: {
      has_meta_title: !!post.meta_title,
      has_meta_description: !!post.meta_description,
      has_excerpt: !!post.excerpt,
      has_cover_image: !!post.cover_image_url,
      has_image_alt: !!post.featured_image_alt,
      has_canonical_url: !!post.canonical_url,
    },
    intro_excerpt: isShort ? '' : plainText.substring(0, 500),
    middle_excerpt: isShort ? '' : plainText.substring(Math.floor(plainText.length / 2) - 250, Math.floor(plainText.length / 2) + 250),
    ending_excerpt: isShort ? '' : plainText.substring(Math.max(0, plainText.length - 500)),
    ...(isShort ? { full_plain_text: plainText } : {}),
    faq_summary: faqSummary.slice(0, 10),
    internal_links: internalLinks.slice(0, 10),
    heuristic_scores: {
      quality_score: 0,
      seo_score: 0,
      compliance_fail_count: 0,
      compliance_warn_count: 0,
    },
    is_published: post.is_published,
    word_count: post.word_count || 0,
  };
}

// ── Build report from verdicts ──
function buildReport(verdicts: ArticleVerdict[], maxPerRun: number): ScanReport {
  const categories: ScanReport['categories'] = {
    skip_already_good: [],
    skip_ranking_protection: [],
    minimal_safe_edit: [],
    targeted_fix: [],
    deeper_enrichment: [],
    manual_review: [],
    deferred_by_cap: [],
  };

  for (const v of verdicts) {
    if (v.verdict === 'skip') {
      if (v.skip_reason === 'ranking_protection') {
        categories.skip_ranking_protection.push(v);
      } else {
        categories.skip_already_good.push(v);
      }
    } else if (v.verdict === 'manual_review') {
      categories.manual_review.push(v);
    } else if (v.verdict === 'needs_action') {
      if (v.action_type === 'minimal_safe_edit') {
        categories.minimal_safe_edit.push(v);
      } else if (v.action_type === 'full_enrich') {
        categories.deeper_enrichment.push(v);
      } else {
        categories.targeted_fix.push(v);
      }
    }
  }

  const actionable = [
    ...categories.minimal_safe_edit,
    ...categories.targeted_fix,
    ...categories.deeper_enrichment,
  ];

  if (actionable.length > maxPerRun) {
    const excess = actionable.slice(maxPerRun);
    for (const item of excess) {
      item.skip_reason = 'deferred_by_cap';
      categories.minimal_safe_edit = categories.minimal_safe_edit.filter(v => v.slug !== item.slug);
      categories.targeted_fix = categories.targeted_fix.filter(v => v.slug !== item.slug);
      categories.deeper_enrichment = categories.deeper_enrichment.filter(v => v.slug !== item.slug);
      categories.deferred_by_cap.push(item);
    }
  }

  const totalPending = categories.minimal_safe_edit.length + categories.targeted_fix.length + categories.deeper_enrichment.length;

  return {
    total_scanned: verdicts.length,
    total_pending: totalPending + categories.deferred_by_cap.length,
    max_per_run: maxPerRun,
    capped_remaining: categories.deferred_by_cap.length,
    categories,
    estimated_api_calls: totalPending,
  };
}

function buildPartialReport(verdicts: ArticleVerdict[], maxPerRun: number): ScanReport {
  return buildReport(verdicts, maxPerRun);
}
