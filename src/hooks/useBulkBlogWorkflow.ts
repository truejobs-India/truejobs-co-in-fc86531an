import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  analyzeQuality, analyzeSEO, blogPostToMetadata,
} from '@/lib/blogArticleAnalyzer';
import { analyzePublishCompliance } from '@/lib/blogComplianceAnalyzer';

// ── Types ──────────────────────────────────────────────

export type WorkflowType = 'fix' | 'enrich';

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
}

export interface ScanReport {
  total_scanned: number;
  total_pending: number;
  max_per_run: number;
  capped_remaining: number;
  categories: {
    skip_already_good: ArticleVerdict[];
    skip_ranking_protection: ArticleVerdict[];
    minimal_safe_edit: ArticleVerdict[];
    targeted_fix: ArticleVerdict[];
    deeper_enrichment: ArticleVerdict[];
    manual_review: ArticleVerdict[];
    deferred_by_cap: ArticleVerdict[];
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
      // Mark stale
      await supabase.from('blog_bulk_workflow_sessions').update({ status: 'stale' } as any).eq('id', session.id);
      return;
    }

    // Restore state
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
    setScanProgress({ stage: 1, done: 0, total: posts.length, detail: 'Running heuristic analysis…' });

    try {
      // ── Stage 1: Heuristic triage ──
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
            // LIKELY_PENDING_OBJECTIVE — skip Stage 2
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
            // BORDERLINE → Stage 2
            baseVerdict.heuristic_triage = 'BORDERLINE';
            baseVerdict.reasons.push(`Quality: ${quality.totalScore}, SEO: ${seo.totalScore}, Fails: ${compliance.failCount}, Warns: ${compliance.warnCount}`);
            stage2Candidates.push({ post, verdict: baseVerdict });
          }
        } else {
          // Enrich workflow
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
            // AUTO_PENDING — skip Stage 2
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
            // Everything else → Stage 2
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

      // Update heartbeat after Stage 1
      await updateHeartbeat(sid);

      // ── Stage 2: AI Classification ──
      if (stage2Candidates.length > 0) {
        setScanProgress({ stage: 2, done: 0, total: stage2Candidates.length, detail: 'Starting AI classification…' });

        for (let batchStart = 0; batchStart < stage2Candidates.length; batchStart += STAGE2_BATCH_SIZE) {
          if (cancelRef.current) {
            // Preserve partial data: add stage2 candidates as manual_review
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

                // Apply skip_reason based on verdict
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
            // Mark batch as manual_review
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

      // Build final report
      const report = buildReport(verdicts, maxPerRun);
      setScanReport(report);
      setScanProgress(null);
      setStatus('scan_complete');

      await supabase.from('blog_bulk_workflow_sessions').update({
        status: 'scan_complete',
        scan_report: report as any,
        last_heartbeat_at: new Date().toISOString(),
      } as any).eq('id', sid);

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

  // ── Confirm Execution ──
  const confirmExecution = useCallback(async (
    blogTextModel: string,
    onArticleComplete?: () => void
  ) => {
    if (!sessionId || !scanReport) return;

    const actionable = [
      ...scanReport.categories.minimal_safe_edit,
      ...scanReport.categories.targeted_fix,
      ...scanReport.categories.deeper_enrichment,
    ].filter(v => v.safe_to_bulk_edit);

    const cappedQueue = actionable.slice(0, scanReport.max_per_run);
    const deferred = actionable.slice(scanReport.max_per_run);

    // Mark deferred
    for (const d of deferred) {
      d.skip_reason = 'deferred_by_cap';
    }

    const total = cappedQueue.length;
    const initialProgress: WorkflowProgress = {
      total,
      done: 0,
      success: 0,
      failed: 0,
      skipped: 0,
      current_article_id: null,
      current_title: '',
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

    // Get current session workflow_type
    const { data: sessionData } = await supabase
      .from('blog_bulk_workflow_sessions')
      .select('workflow_type')
      .eq('id', sessionId)
      .single() as any;

    const workflowType = sessionData?.workflow_type || 'fix';

    let done = 0, success = 0, failed = 0, skipped = 0;

    for (const article of cappedQueue) {
      // Check stop_requested
      const { data: sessionCheck } = await supabase
        .from('blog_bulk_workflow_sessions')
        .select('stop_requested')
        .eq('id', sessionId)
        .single() as any;

      if (sessionCheck?.stop_requested) {
        // Mark remaining as skipped_execution
        for (let j = cappedQueue.indexOf(article); j < cappedQueue.length; j++) {
          const remaining = cappedQueue[j];
          if (j === cappedQueue.indexOf(article) && j > 0) continue; // skip current (already counted)
          const result: ExecutionResult = {
            slug: remaining.slug,
            title: remaining.title,
            status: 'skipped',
            reason: 'Stopped by user',
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
          slug: article.slug,
          title: article.title,
          status: 'success',
          reason: `${article.action_type} applied`,
          timestamp: new Date().toISOString(),
        };
        await appendExecutionResult(sessionId, result);
        setExecutionResults(prev => [...prev, result]);
        success++;
      } catch (err: any) {
        const result: ExecutionResult = {
          slug: article.slug,
          title: article.title,
          status: 'failed',
          reason: err.message?.substring(0, 200) || 'Unknown error',
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

      // Rate limit: 3s between articles
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
      current_article_id: null,
      current_title: '',
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

  // ── Execute Fix for single article ──
  const executeFixForArticle = async (article: ArticleVerdict, aiModel: string) => {
    // Fetch current post
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

    // Mark as AI-fixed
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
    // Read current results, append, write back
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

  // Extract FAQ question texts
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
      quality_score: 0, // Will be filled from Stage 1
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

  // Apply cap: move excess to deferred_by_cap
  const actionable = [
    ...categories.minimal_safe_edit,
    ...categories.targeted_fix,
    ...categories.deeper_enrichment,
  ];

  if (actionable.length > maxPerRun) {
    const excess = actionable.slice(maxPerRun);
    for (const item of excess) {
      item.skip_reason = 'deferred_by_cap';
      // Remove from original category and add to deferred
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
    estimated_api_calls: totalPending, // 1 API call per article
  };
}

function buildPartialReport(verdicts: ArticleVerdict[], maxPerRun: number): ScanReport {
  return buildReport(verdicts, maxPerRun);
}
