/**
 * SEO Audit History — persistence layer for audit & fix runs.
 */

import { supabase } from '@/integrations/supabase/client';
import type { SeoAuditReport, ContentSource, IssueCategory } from './sitewideSeoAudit';
import type { FixResult } from './seoFixEngine';

export interface AuditRunRecord {
  id: string;
  run_type: 'audit' | 'fix';
  started_at: string;
  completed_at: string | null;
  ai_model: string | null;
  total_scanned: Record<string, number>;
  total_issues: number;
  total_fixed: number;
  total_skipped: number;
  total_failed: number;
  total_review_required: number;
  warnings: string[];
  issue_summary: Record<string, any>;
  fix_details: any[];
  started_by: string | null;
  created_at: string;
}

/** Save an audit-only run (scan completed, no fixes yet). */
export async function saveAuditRun(
  report: SeoAuditReport,
  startedAt: Date,
): Promise<string | null> {
  const { data: user } = await supabase.auth.getUser();

  const issueSummary: Record<string, any> = {
    bySource: report.summary.bySource,
    bySeverity: report.summary.bySeverity,
    byCategory: report.summary.byCategory,
    autoFixable: report.summary.autoFixable,
    reviewRequired: report.summary.reviewRequired,
  };

  const { data, error } = await supabase
    .from('seo_audit_runs' as any)
    .insert({
      run_type: 'audit',
      started_at: startedAt.toISOString(),
      completed_at: new Date().toISOString(),
      total_scanned: report.totalScanned,
      total_issues: report.issues.length,
      issue_summary: issueSummary,
      started_by: user?.user?.id || null,
    })
    .select('id')
    .single();

  if (error) {
    console.error('[SEO-HISTORY] Failed to save audit run:', error.message);
    return null;
  }
  return (data as any)?.id || null;
}

/** Save a fix run after Fix All completes. */
export async function saveFixRun(
  report: SeoAuditReport,
  results: FixResult[],
  aiModel: string,
  startedAt: Date,
  warnings: string[],
): Promise<string | null> {
  const { data: user } = await supabase.auth.getUser();

  const fixed = results.filter(r => r.status === 'fixed').length;
  const skipped = results.filter(r => r.status === 'skipped').length;
  const failed = results.filter(r => r.status === 'failed').length;
  const review = results.filter(r => r.status === 'review_required').length;

  // Deduplicate warnings
  const uniqueWarnings = Array.from(new Set(warnings));

  // Compact fix details — include all non-skipped for transparency
  const compactDetails = results
    .filter(r => r.status !== 'skipped')
    .map(r => ({
      slug: r.slug,
      source: r.source,
      category: r.category,
      status: r.status,
      reason: r.reason,
      field: r.field || null,
      afterValue: r.afterValue ? r.afterValue.substring(0, 200) : null,
      verificationPassed: r.verificationPassed ?? null,
      verificationNote: r.verificationNote || null,
    }));

  // Build truthful issue summary
  // total_issues = scan-phase issue count (from report)
  // total_fixed/failed/skipped/review = fix-phase result counts
  // These are different dimensions and both are recorded honestly
  const issueSummary: Record<string, any> = {
    bySource: report.summary.bySource,
    bySeverity: report.summary.bySeverity,
    byCategory: report.summary.byCategory,
    autoFixable: report.summary.autoFixable,
    reviewRequired_scan: report.summary.reviewRequired, // Scan-phase: non-auto-fixable issues
    reviewRequired_fix: review, // Fix-phase: AI returned low-confidence or unknown actions
    fixesAttempted: results.length,
    fixesApplied: fixed,
    fixesFailed: failed,
    fixesSkipped: skipped,
  };

  const { data, error } = await supabase
    .from('seo_audit_runs' as any)
    .insert({
      run_type: 'fix',
      started_at: startedAt.toISOString(),
      completed_at: new Date().toISOString(),
      ai_model: aiModel,
      total_scanned: report.totalScanned,
      total_issues: report.issues.length,
      total_fixed: fixed,
      total_skipped: skipped,
      total_failed: failed,
      total_review_required: review,
      warnings: uniqueWarnings,
      issue_summary: issueSummary,
      fix_details: compactDetails,
      started_by: user?.user?.id || null,
    })
    .select('id')
    .single();

  if (error) {
    console.error('[SEO-HISTORY] Failed to save fix run:', error.message);
    return null;
  }
  return (data as any)?.id || null;
}

/** Fetch recent audit/fix runs. */
export async function fetchAuditHistory(limit = 20): Promise<AuditRunRecord[]> {
  const { data, error } = await supabase
    .from('seo_audit_runs' as any)
    .select('*')
    .order('started_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[SEO-HISTORY] Failed to fetch history:', error.message);
    return [];
  }
  return (data || []) as unknown as AuditRunRecord[];
}

/** Fetch a single run by ID. */
export async function fetchAuditRunById(id: string): Promise<AuditRunRecord | null> {
  const { data, error } = await supabase
    .from('seo_audit_runs' as any)
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    console.error('[SEO-HISTORY] Failed to fetch run:', error.message);
    return null;
  }
  return (data || null) as unknown as AuditRunRecord | null;
}
