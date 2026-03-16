/**
 * Shared AI workflow hook for Custom Pages and Board Result Pages.
 * Provides: per-page fix/enrich/publish, bulk fix/enrich/publish with scan-report-execute pattern.
 * Reuses the same model registry and edge function pattern as Blog Posts.
 */
import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { scoreCustomPage, type QualityBreakdown } from '@/lib/pageQualityScorer';

// ── Types ──

export type PageWorkflowStatus = 'idle' | 'scanning' | 'scan_complete' | 'executing' | 'completed' | 'stopped' | 'failed';

export interface PageScanResult {
  id: string;
  title: string;
  slug: string;
  content: string;
  meta_title: string | null;
  meta_description: string | null;
  excerpt: string | null;
  word_count: number | null;
  is_published: boolean;
  page_type: string | null;
  quality: QualityBreakdown;
  issues: string[];
  needsFix: boolean;
  needsEnrich: boolean;
}

export interface PageScanReport {
  total_scanned: number;
  needs_fix: number;
  needs_enrich: number;
  already_good: number;
  publishable: number;
  unpublished_ready: number;
  pages: PageScanResult[];
}

export interface PageActionResult {
  id: string;
  slug: string;
  status: 'fixed' | 'enriched' | 'published' | 'skipped' | 'failed';
  reason: string;
  changes?: Record<string, { before: string | null; after: string }>;
}

export interface PageWorkflowProgress {
  total: number;
  done: number;
  success: number;
  skipped: number;
  failed: number;
  current_title: string;
}

// ── Helpers ──

function detectPageIssues(page: any): { issues: string[]; needsFix: boolean; needsEnrich: boolean } {
  const issues: string[] = [];
  const quality = scoreCustomPage({
    content: page.content,
    meta_title: page.meta_title,
    meta_description: page.meta_description,
    excerpt: page.excerpt,
    faq_schema: page.faq_schema,
    tags: page.tags,
  });

  let needsFix = false;
  let needsEnrich = false;

  // Fix-level issues (metadata problems)
  if (!page.meta_title) { issues.push('Missing meta title'); needsFix = true; }
  else if (page.meta_title.length > 65) { issues.push(`Meta title too long (${page.meta_title.length})`); needsFix = true; }
  else if (page.meta_title.length < 25) { issues.push(`Meta title too short (${page.meta_title.length})`); needsFix = true; }

  if (!page.meta_description) { issues.push('Missing meta description'); needsFix = true; }
  else if (page.meta_description.length > 170) { issues.push(`Meta desc too long (${page.meta_description.length})`); needsFix = true; }
  else if (page.meta_description.length < 80) { issues.push(`Meta desc too short (${page.meta_description.length})`); needsFix = true; }

  if (!page.excerpt) { issues.push('Missing excerpt'); needsFix = true; }

  if (!page.slug || page.slug.length < 3) { issues.push('Missing/short slug'); needsFix = true; }
  else if (!/^[a-z0-9-]+$/.test(page.slug)) { issues.push('Slug has special chars'); needsFix = true; }

  // Enrich-level issues (thin/weak content)
  const wordCount = (page.content || '').replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
  if (wordCount < 800) { issues.push(`Thin content (${wordCount} words)`); needsEnrich = true; }
  if (quality.h2Count < 3) { issues.push(`Few headings (${quality.h2Count} H2s)`); needsEnrich = true; }
  if (quality.faqCount < 3) { issues.push(`Few/no FAQs (${quality.faqCount})`); needsEnrich = true; }
  if (quality.listCount === 0) { issues.push('No lists'); needsEnrich = true; }
  if (quality.score < 50) { issues.push(`Low quality score (${quality.score})`); needsEnrich = true; }

  return { issues, needsFix, needsEnrich };
}

// ── Hook ──

export function usePageAiWorkflow() {
  const [status, setStatus] = useState<PageWorkflowStatus>('idle');
  const [scanReport, setScanReport] = useState<PageScanReport | null>(null);
  const [progress, setProgress] = useState<PageWorkflowProgress | null>(null);
  const [results, setResults] = useState<PageActionResult[]>([]);
  const cancelRef = useRef(false);

  // ── Scan pages ──
  const scan = useCallback(async (pages: any[]): Promise<PageScanReport> => {
    setStatus('scanning');
    setScanReport(null);
    setResults([]);

    const scannedPages: PageScanResult[] = [];

    for (const page of pages) {
      const { issues, needsFix, needsEnrich } = detectPageIssues(page);
      const quality = scoreCustomPage({
        content: page.content,
        meta_title: page.meta_title,
        meta_description: page.meta_description,
        excerpt: page.excerpt,
        faq_schema: page.faq_schema,
        tags: page.tags,
      });

      scannedPages.push({
        id: page.id,
        title: page.title,
        slug: page.slug,
        content: page.content,
        meta_title: page.meta_title,
        meta_description: page.meta_description,
        excerpt: page.excerpt,
        word_count: page.word_count,
        is_published: page.is_published,
        page_type: page.page_type,
        quality,
        issues,
        needsFix,
        needsEnrich,
      });
    }

    const report: PageScanReport = {
      total_scanned: pages.length,
      needs_fix: scannedPages.filter(p => p.needsFix).length,
      needs_enrich: scannedPages.filter(p => p.needsEnrich).length,
      already_good: scannedPages.filter(p => !p.needsFix && !p.needsEnrich && p.quality.score >= 65).length,
      publishable: scannedPages.filter(p => !p.needsFix && !p.needsEnrich && p.quality.score >= 65 && !p.is_published).length,
      unpublished_ready: scannedPages.filter(p => p.quality.score >= 65 && !p.is_published).length,
      pages: scannedPages,
    };

    setScanReport(report);
    setStatus('scan_complete');
    return report;
  }, []);

  // ── Fix single page ──
  const fixPage = useCallback(async (page: any, aiModel: string): Promise<PageActionResult> => {
    try {
      const { data, error } = await supabase.functions.invoke('generate-custom-page', {
        body: {
          action: 'fix',
          id: page.id,
          title: page.title,
          slug: page.slug,
          content: page.content,
          meta_title: page.meta_title,
          meta_description: page.meta_description,
          excerpt: page.excerpt,
          category: page.category,
          tags: page.tags,
          aiModel,
        },
      });
      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error || 'Fix failed');

      // Apply fixes to DB
      const fixes = data.data;
      const updatePayload: any = {};
      const changes: Record<string, { before: string | null; after: string }> = {};

      if (fixes.meta_title) {
        changes.meta_title = { before: page.meta_title, after: fixes.meta_title };
        updatePayload.meta_title = fixes.meta_title;
      }
      if (fixes.meta_description) {
        changes.meta_description = { before: page.meta_description, after: fixes.meta_description };
        updatePayload.meta_description = fixes.meta_description;
      }
      if (fixes.excerpt) {
        changes.excerpt = { before: page.excerpt, after: fixes.excerpt };
        updatePayload.excerpt = fixes.excerpt;
      }
      if (fixes.slug && fixes.slug !== page.slug) {
        changes.slug = { before: page.slug, after: fixes.slug };
        updatePayload.slug = fixes.slug;
      }

      if (Object.keys(updatePayload).length > 0) {
        updatePayload.ai_fixed_at = new Date().toISOString();
        await supabase.from('custom_pages').update(updatePayload).eq('id', page.id);
        return { id: page.id, slug: page.slug, status: 'fixed', reason: `Fixed ${Object.keys(changes).join(', ')}`, changes };
      }

      return { id: page.id, slug: page.slug, status: 'skipped', reason: 'No fixes needed' };
    } catch (e: any) {
      return { id: page.id, slug: page.slug, status: 'failed', reason: e.message };
    }
  }, []);

  // ── Enrich single page ──
  const enrichPage = useCallback(async (page: any, aiModel: string): Promise<PageActionResult> => {
    try {
      const { data, error } = await supabase.functions.invoke('generate-custom-page', {
        body: {
          action: 'enrich',
          id: page.id,
          title: page.title,
          slug: page.slug,
          content: page.content,
          meta_title: page.meta_title,
          meta_description: page.meta_description,
          excerpt: page.excerpt,
          category: page.category,
          tags: page.tags,
          faq_schema: page.faq_schema,
          word_count: page.word_count,
          aiModel,
        },
      });
      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error || 'Enrich failed');

      const enriched = data.data;
      const updatePayload: any = {
        content: enriched.content || page.content,
        word_count: enriched.word_count || page.word_count,
        ai_model_used: aiModel,
        ai_generated_at: new Date().toISOString(),
      };
      if (enriched.meta_title) updatePayload.meta_title = enriched.meta_title;
      if (enriched.meta_description) updatePayload.meta_description = enriched.meta_description;
      if (enriched.excerpt) updatePayload.excerpt = enriched.excerpt;
      if (enriched.faq_items) updatePayload.faq_schema = enriched.faq_items;
      if (enriched.suggested_tags) updatePayload.tags = enriched.suggested_tags;

      await supabase.from('custom_pages').update(updatePayload).eq('id', page.id);

      return {
        id: page.id, slug: page.slug, status: 'enriched',
        reason: `Enriched: ${enriched.word_count || '?'} words, ${(enriched.faq_items || []).length} FAQs`,
      };
    } catch (e: any) {
      return { id: page.id, slug: page.slug, status: 'failed', reason: e.message };
    }
  }, []);

  // ── Publish single page ──
  const publishPage = useCallback(async (page: any): Promise<PageActionResult> => {
    const quality = scoreCustomPage({
      content: page.content,
      meta_title: page.meta_title,
      meta_description: page.meta_description,
      excerpt: page.excerpt,
      faq_schema: page.faq_schema,
      tags: page.tags,
    });

    if (quality.score < 50) {
      return { id: page.id, slug: page.slug, status: 'skipped', reason: `Quality too low (${quality.score}/100)` };
    }
    if (!page.meta_title || !page.meta_description) {
      return { id: page.id, slug: page.slug, status: 'skipped', reason: 'Missing meta title or description' };
    }

    await supabase.from('custom_pages').update({
      is_published: true,
      status: 'published',
      published_at: new Date().toISOString(),
    } as any).eq('id', page.id);

    return { id: page.id, slug: page.slug, status: 'published', reason: 'Published successfully' };
  }, []);

  // ── Bulk execute ──
  const bulkExecute = useCallback(async (
    action: 'fix' | 'enrich' | 'publish',
    pages: any[],
    aiModel: string,
    onProgress?: () => void,
  ) => {
    if (pages.length === 0) return;
    cancelRef.current = false;
    setStatus('executing');
    setResults([]);

    const allResults: PageActionResult[] = [];
    let done = 0, success = 0, skipped = 0, failed = 0;
    setProgress({ total: pages.length, done, success, skipped, failed, current_title: '' });

    for (const page of pages) {
      if (cancelRef.current) break;
      setProgress({ total: pages.length, done, success, skipped, failed, current_title: page.title });

      let result: PageActionResult;
      if (action === 'fix') {
        result = await fixPage(page, aiModel);
      } else if (action === 'enrich') {
        result = await enrichPage(page, aiModel);
      } else {
        result = await publishPage(page);
      }

      allResults.push(result);
      done++;
      if (result.status === 'fixed' || result.status === 'enriched' || result.status === 'published') success++;
      else if (result.status === 'skipped') skipped++;
      else failed++;

      setResults([...allResults]);
      setProgress({ total: pages.length, done, success, skipped, failed, current_title: '' });
      onProgress?.();

      // Small delay between AI calls to avoid rate limits
      if (action !== 'publish' && !cancelRef.current) {
        await new Promise(r => setTimeout(r, 1500));
      }
    }

    setProgress({ total: pages.length, done, success, skipped, failed, current_title: '' });
    setStatus(cancelRef.current ? 'stopped' : 'completed');
  }, [fixPage, enrichPage, publishPage]);

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
    scan, fixPage, enrichPage, publishPage, bulkExecute,
    requestStop, reset, detectPageIssues,
  };
}
