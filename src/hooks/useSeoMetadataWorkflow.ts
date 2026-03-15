import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { blogPostToMetadata, analyzeSEO, BLOG_THRESHOLDS } from '@/lib/blogArticleAnalyzer';

// ── Types ──
export type SeoWorkflowStatus = 'idle' | 'scanning' | 'scan_complete' | 'executing' | 'completed' | 'stopped' | 'failed';

export interface SeoIssue {
  type: 'missing_meta_title' | 'missing_meta_description' | 'weak_meta_title' | 'weak_meta_description'
    | 'bad_slug' | 'missing_excerpt' | 'meta_too_long' | 'meta_too_short' | 'slug_too_long'
    | 'low_keyword_overlap' | 'missing_canonical';
  label: string;
  severity: 'high' | 'medium' | 'low';
}

export interface SeoArticleScanResult {
  id: string;
  title: string;
  slug: string;
  content: string;
  meta_title: string | null;
  meta_description: string | null;
  excerpt: string | null;
  category: string | null;
  tags: string[] | null;
  word_count: number | null;
  is_published: boolean;
  issues: SeoIssue[];
  seo_score: number;
}

export interface SeoScanReport {
  total_scanned: number;
  total_with_issues: number;
  total_already_good: number;
  missing_meta_title: number;
  missing_meta_description: number;
  bad_slug: number;
  weak_metadata: number;
  missing_excerpt: number;
  manual_review: number;
  articles_with_issues: SeoArticleScanResult[];
  articles_good: SeoArticleScanResult[];
}

export interface SeoFixResult {
  id: string;
  slug: string;
  status: 'fixed' | 'skipped' | 'failed';
  reason: string;
  changes: Record<string, { before: string | null; after: string }>;
  ai_summary: string;
}

export interface SeoWorkflowProgress {
  total: number;
  done: number;
  fixed: number;
  skipped: number;
  failed: number;
  current_title: string;
}

// ── SEO Issue Detection ──
function detectSeoIssues(post: any): SeoIssue[] {
  const issues: SeoIssue[] = [];
  const meta = blogPostToMetadata(post);

  // Missing fields
  if (!post.meta_title) {
    issues.push({ type: 'missing_meta_title', label: 'Missing meta title', severity: 'high' });
  } else {
    const len = post.meta_title.length;
    if (len > BLOG_THRESHOLDS.META_TITLE_MAX) {
      issues.push({ type: 'meta_too_long', label: `Meta title too long (${len}/${BLOG_THRESHOLDS.META_TITLE_MAX})`, severity: 'medium' });
    }
    if (len < 20) {
      issues.push({ type: 'weak_meta_title', label: `Meta title too short (${len} chars)`, severity: 'medium' });
    }
  }

  if (!post.meta_description) {
    issues.push({ type: 'missing_meta_description', label: 'Missing meta description', severity: 'high' });
  } else {
    const len = post.meta_description.length;
    if (len > BLOG_THRESHOLDS.META_DESC_MAX) {
      issues.push({ type: 'meta_too_long', label: `Meta description too long (${len}/${BLOG_THRESHOLDS.META_DESC_MAX})`, severity: 'medium' });
    }
    if (len < BLOG_THRESHOLDS.META_DESC_MIN) {
      issues.push({ type: 'meta_too_short', label: `Meta description too short (${len}/${BLOG_THRESHOLDS.META_DESC_MIN})`, severity: 'medium' });
    }
  }

  // Slug issues
  if (!post.slug || post.slug.length < 3) {
    issues.push({ type: 'bad_slug', label: 'Missing or very short slug', severity: 'high' });
  } else if (!/^[a-z0-9-]+$/.test(post.slug)) {
    issues.push({ type: 'bad_slug', label: 'Slug has special characters', severity: 'medium' });
  } else if (post.slug.length > 70) {
    issues.push({ type: 'slug_too_long', label: `Slug too long (${post.slug.length} chars)`, severity: 'low' });
  }

  // Missing excerpt
  if (!post.excerpt) {
    issues.push({ type: 'missing_excerpt', label: 'Missing excerpt', severity: 'low' });
  }

  // Canonical URL check
  const expectedCanonical = `https://truejobs.co.in/blog/${post.slug}`;
  if (!post.canonical_url || post.canonical_url !== expectedCanonical) {
    issues.push({ type: 'missing_canonical', label: 'Canonical URL not set or incorrect', severity: 'low' });
  }

  // Keyword overlap check
  const seoReport = analyzeSEO(meta);
  const keywordCheck = seoReport.checks.find(c => c.name === 'Keyword relevance');
  if (keywordCheck && keywordCheck.status === 'fail') {
    issues.push({ type: 'low_keyword_overlap', label: 'Low title-content keyword overlap', severity: 'medium' });
  }

  return issues;
}

// ── Hook ──
export function useSeoMetadataWorkflow() {
  const [status, setStatus] = useState<SeoWorkflowStatus>('idle');
  const [scanReport, setScanReport] = useState<SeoScanReport | null>(null);
  const [progress, setProgress] = useState<SeoWorkflowProgress | null>(null);
  const [results, setResults] = useState<SeoFixResult[]>([]);
  const cancelRef = useRef(false);

  const scan = useCallback(async (posts: any[]) => {
    setStatus('scanning');
    setScanReport(null);
    setResults([]);

    const articlesWithIssues: SeoArticleScanResult[] = [];
    const articlesGood: SeoArticleScanResult[] = [];
    let missingTitle = 0, missingDesc = 0, badSlug = 0, weakMeta = 0, missingExcerpt = 0;

    for (const post of posts) {
      const issues = detectSeoIssues(post);
      const meta = blogPostToMetadata(post);
      const seoReport = analyzeSEO(meta);

      const result: SeoArticleScanResult = {
        id: post.id,
        title: post.title,
        slug: post.slug,
        content: post.content,
        meta_title: post.meta_title,
        meta_description: post.meta_description,
        excerpt: post.excerpt,
        category: post.category,
        tags: post.tags,
        word_count: post.word_count,
        is_published: post.is_published,
        issues,
        seo_score: seoReport.totalScore,
      };

      if (issues.length > 0) {
        articlesWithIssues.push(result);
        if (issues.some(i => i.type === 'missing_meta_title')) missingTitle++;
        if (issues.some(i => i.type === 'missing_meta_description')) missingDesc++;
        if (issues.some(i => i.type === 'bad_slug' || i.type === 'slug_too_long')) badSlug++;
        if (issues.some(i => i.type.startsWith('weak_') || i.type === 'meta_too_long' || i.type === 'meta_too_short')) weakMeta++;
        if (issues.some(i => i.type === 'missing_excerpt')) missingExcerpt++;
      } else {
        articlesGood.push(result);
      }
    }

    const report: SeoScanReport = {
      total_scanned: posts.length,
      total_with_issues: articlesWithIssues.length,
      total_already_good: articlesGood.length,
      missing_meta_title: missingTitle,
      missing_meta_description: missingDesc,
      bad_slug: badSlug,
      weak_metadata: weakMeta,
      missing_excerpt: missingExcerpt,
      manual_review: 0,
      articles_with_issues: articlesWithIssues,
      articles_good: articlesGood,
    };

    setScanReport(report);
    setStatus('scan_complete');
  }, []);

  const execute = useCallback(async (onArticleComplete?: () => void) => {
    if (!scanReport) return;
    const queue = scanReport.articles_with_issues;
    if (queue.length === 0) return;

    cancelRef.current = false;
    setStatus('executing');
    setResults([]);
    const allResults: SeoFixResult[] = [];

    const total = queue.length;
    let done = 0, fixed = 0, skipped = 0, failed = 0;

    setProgress({ total, done, fixed, skipped, failed, current_title: '' });

    // Process in batches of 5
    const batchSize = 5;
    for (let i = 0; i < queue.length; i += batchSize) {
      if (cancelRef.current) break;

      const batch = queue.slice(i, i + batchSize);
      setProgress({ total, done, fixed, skipped, failed, current_title: `Processing batch ${Math.floor(i / batchSize) + 1}…` });

      try {
        const articlesPayload = batch.map(a => ({
          id: a.id,
          title: a.title,
          slug: a.slug,
          content: a.content,
          meta_title: a.meta_title,
          meta_description: a.meta_description,
          excerpt: a.excerpt,
          category: a.category,
          tags: a.tags,
          word_count: a.word_count,
          is_published: a.is_published,
          issues: a.issues.map(iss => iss.label),
        }));

        const { data, error } = await supabase.functions.invoke('fix-seo-metadata', {
          body: { articles: articlesPayload, mode: 'fix', apply: true },
        });

        if (error) {
          // Mark all in batch as failed
          for (const a of batch) {
            const result: SeoFixResult = {
              id: a.id, slug: a.slug, status: 'failed',
              reason: error.message || 'Edge function error',
              changes: {}, ai_summary: '',
            };
            allResults.push(result);
            failed++;
            done++;
          }
        } else if (data?.results) {
          for (const r of data.results) {
            allResults.push(r);
            if (r.status === 'fixed') fixed++;
            else if (r.status === 'skipped') skipped++;
            else failed++;
            done++;
          }
        }
      } catch (err: any) {
        for (const a of batch) {
          allResults.push({
            id: a.id, slug: a.slug, status: 'failed',
            reason: err.message || 'Unknown error', changes: {}, ai_summary: '',
          });
          failed++;
          done++;
        }
      }

      setResults([...allResults]);
      setProgress({ total, done, fixed, skipped, failed, current_title: '' });
      onArticleComplete?.();

      // Delay between batches
      if (i + batchSize < queue.length && !cancelRef.current) {
        await new Promise(r => setTimeout(r, 2000));
      }
    }

    setProgress({ total, done, fixed, skipped, failed, current_title: '' });
    setStatus(cancelRef.current ? 'stopped' : 'completed');
  }, [scanReport]);

  const fixSingleArticle = useCallback(async (post: any): Promise<SeoFixResult | null> => {
    const issues = detectSeoIssues(post);
    if (issues.length === 0) return null;

    try {
      const { data, error } = await supabase.functions.invoke('fix-seo-metadata', {
        body: {
          articles: [{
            id: post.id,
            title: post.title,
            slug: post.slug,
            content: post.content,
            meta_title: post.meta_title,
            meta_description: post.meta_description,
            excerpt: post.excerpt,
            category: post.category,
            tags: post.tags,
            word_count: post.word_count,
            is_published: post.is_published,
            issues: issues.map(i => i.label),
          }],
          mode: 'fix',
          apply: true,
        },
      });

      if (error) throw new Error(error.message);
      return data?.results?.[0] || null;
    } catch (err: any) {
      return {
        id: post.id, slug: post.slug, status: 'failed',
        reason: err.message || 'Unknown error', changes: {}, ai_summary: '',
      };
    }
  }, []);

  const requestStop = useCallback(() => { cancelRef.current = true; }, []);

  const reset = useCallback(() => {
    setStatus('idle');
    setScanReport(null);
    setProgress(null);
    setResults([]);
    cancelRef.current = false;
  }, []);

  return {
    status, scanReport, progress, results,
    scan, execute, fixSingleArticle, requestStop, reset,
    detectSeoIssues,
  };
}
