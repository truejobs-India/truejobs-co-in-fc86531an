/**
 * UnresolvedSeoResolver — Resolve Pending/Skipped/Review/Failed SEO items using AI.
 * Loads unresolved items from previous seo_audit_runs fix_details,
 * verifies they are still unfixed against the live DB,
 * then re-processes them with targeted single-page batches.
 */

import { useState, useRef, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Loader2, AlertTriangle, CheckCircle2, XCircle, SkipForward, Eye,
  Zap, RefreshCw, FileText, Download, Globe, Filter, Square,
} from 'lucide-react';
import { AiModelSelector, getLastUsedModel } from '@/components/admin/AiModelSelector';
import { useAdminToast as useToast } from '@/contexts/AdminMessagesContext';
import { supabase } from '@/integrations/supabase/client';
import {
  SEO_FIX_MODEL_VALUES,
  getModelLabel,
  normalizeAiModelValue,
} from '@/lib/aiModels';
import {
  type ContentSource,
  type IssueCategory,
} from '@/lib/sitewideSeoAudit';
import {
  type FixResult,
  type FixProgress,
  validateFixValue,
  isValidCanonicalUrl,
  validateFaqSchema,
} from '@/lib/seoFixEngine';
import {
  fetchAuditHistory,
  saveFixRun,
  type AuditRunRecord,
} from '@/lib/seoAuditHistory';

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

/** Statuses considered "unresolved" */
const UNRESOLVED_STATUSES = [
  'failed', 'review_required', 'skipped', 'pending',
  'partial', 'truncated', 'parseError', 'validationFailed',
] as const;

type UnresolvedStatus = typeof UNRESOLVED_STATUSES[number];

interface UnresolvedItem {
  id: string; // unique key
  slug: string;
  source: ContentSource;
  category: string;
  field: string | null;
  status: UnresolvedStatus;
  reason: string;
  afterValue: string | null;
  runId: string;
  runDate: string;
  // Live DB check
  liveValue: string | null;
  stillUnfixed: boolean;
  verificationNote: string;
}

type ResolverPhase = 'idle' | 'loading' | 'ready' | 'dryRun' | 'fixing' | 'done';

const SOURCE_LABELS: Record<ContentSource, string> = {
  blog_posts: 'Blog Articles',
  pdf_resources: 'PDF Resources',
  custom_pages: 'Custom Pages',
};

const SOURCE_ICONS: Record<ContentSource, typeof FileText> = {
  blog_posts: FileText,
  pdf_resources: Download,
  custom_pages: Globe,
};

const CATEGORY_LABELS: Record<string, string> = {
  meta_title: 'Meta Title',
  meta_description: 'Meta Description',
  canonical_url: 'Canonical URL',
  excerpt: 'Excerpt / Summary',
  featured_image_alt: 'Image Alt Text',
  slug: 'Slug',
  h1: 'H1 Heading',
  heading_structure: 'Heading Structure',
  internal_links: 'Internal Links',
  faq_opportunity: 'FAQ Opportunity',
  faq_schema: 'FAQ Schema',
  content_thin: 'Thin Content',
  intro_missing: 'Intro Missing',
  compliance: 'Compliance',
};

const STATUS_LABELS: Record<string, string> = {
  failed: 'Failed',
  review_required: 'Review Required',
  skipped: 'Skipped',
  pending: 'Pending',
  partial: 'Partial',
  truncated: 'Truncated',
  parseError: 'Parse Error',
  validationFailed: 'Validation Failed',
};

const STATUS_COLORS: Record<string, string> = {
  failed: 'border-destructive/40 text-destructive',
  review_required: 'border-amber-500/40 text-amber-700',
  skipped: 'border-muted-foreground/40 text-muted-foreground',
  pending: 'border-blue-500/40 text-blue-700',
  partial: 'border-orange-500/40 text-orange-700',
  truncated: 'border-orange-500/40 text-orange-700',
  parseError: 'border-destructive/40 text-destructive',
  validationFailed: 'border-destructive/40 text-destructive',
};

/** Categories safe for auto-fix (AI can handle without manual review) */
const SAFE_AUTO_FIX_CATEGORIES = new Set<string>([
  'meta_title', 'meta_description', 'canonical_url', 'excerpt',
  'featured_image_alt', 'h1', 'internal_links', 'faq_opportunity',
  'faq_schema', 'intro_missing', 'compliance',
]);

/** Categories that remain review-only */
const REVIEW_ONLY_CATEGORIES = new Set<string>([
  'slug', // slug changes on live pages risk breaking URLs
]);

// ═══════════════════════════════════════════════════════════════
// Component
// ═══════════════════════════════════════════════════════════════

export function UnresolvedSeoResolver() {
  const { toast } = useToast();
  const [phase, setPhase] = useState<ResolverPhase>('idle');
  const [items, setItems] = useState<UnresolvedItem[]>([]);
  const [aiModel, setAiModel] = useState(() => getLastUsedModel('text', 'gemini-pro', SEO_FIX_MODEL_VALUES));

  // Filters
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterSource, setFilterSource] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectAll, setSelectAll] = useState(false);

  // Fix state
  const [fixProgress, setFixProgress] = useState<FixProgress | null>(null);
  const [fixResults, setFixResults] = useState<FixResult[]>([]);
  const stopSignal = useRef({ stopped: false });
  const fixWarnings = useRef<string[]>([]);
  const fixStartedAt = useRef<Date | null>(null);

  // ── Load unresolved items from history ──
  const loadUnresolved = useCallback(async () => {
    setPhase('loading');
    setItems([]);
    setFixResults([]);
    setSelectedIds(new Set());

    try {
      const runs = await fetchAuditHistory(50);
      const fixRuns = runs.filter(r => r.run_type === 'fix' && r.fix_details && r.fix_details.length > 0);

      if (fixRuns.length === 0) {
        toast({ title: 'No fix runs found', description: 'Run a full SEO audit & fix first to generate data.' });
        setPhase('idle');
        return;
      }

      // Collect unresolved items from all fix runs, dedup by slug+category (keep latest)
      const seen = new Map<string, UnresolvedItem>();

      for (const run of fixRuns) {
        const details = (run.fix_details || []) as any[];
        for (const d of details) {
          const status = normalizeStatus(d.status);
          if (!status) continue; // Already resolved (fixed)

          const key = `${d.source}:${d.slug}:${d.category}`;
          // Keep latest run's version
          if (seen.has(key)) {
            const existing = seen.get(key)!;
            if (new Date(run.started_at) < new Date(existing.runDate)) continue;
          }

          seen.set(key, {
            id: key,
            slug: d.slug || 'unknown',
            source: (d.source || 'blog_posts') as ContentSource,
            category: d.category || 'unknown',
            field: d.field || null,
            status,
            reason: d.reason || 'No reason recorded',
            afterValue: d.afterValue || null,
            runId: run.id,
            runDate: run.started_at,
            liveValue: null,
            stillUnfixed: true,
            verificationNote: '',
          });
        }
      }

      const unresolvedItems = Array.from(seen.values());

      if (unresolvedItems.length === 0) {
        toast({ title: 'All clean!', description: 'No unresolved items found in recent fix runs.' });
        setPhase('idle');
        return;
      }

      // Verify against live DB — check if items were fixed outside the audit system
      const verified = await verifyLiveState(unresolvedItems);
      const stillUnfixed = verified.filter(i => i.stillUnfixed);

      setItems(verified);
      // Auto-select all still-unfixed safe items
      const autoSelected = new Set(
        stillUnfixed
          .filter(i => SAFE_AUTO_FIX_CATEGORIES.has(i.category) && !REVIEW_ONLY_CATEGORIES.has(i.category))
          .map(i => i.id)
      );
      setSelectedIds(autoSelected);
      setPhase('ready');

      toast({
        title: `${verified.length} unresolved items loaded`,
        description: `${stillUnfixed.length} still unfixed, ${verified.length - stillUnfixed.length} already resolved`,
      });
    } catch (err: any) {
      toast({ title: 'Load failed', description: err.message, variant: 'destructive' });
      setPhase('idle');
    }
  }, [toast]);

  // ── Normalize status string to UnresolvedStatus or null (if resolved) ──
  function normalizeStatus(raw: string): UnresolvedStatus | null {
    if (!raw) return 'pending';
    const s = raw.toLowerCase().replace(/[_\\s]+/g, '_');
    if (s === 'fixed') return null;
    if (s === 'failed') return 'failed';
    if (s === 'review_required' || s === 'reviewrequired') return 'review_required';
    if (s === 'skipped') return 'skipped';
    if (s === 'pending') return 'pending';
    if (s === 'partial') return 'partial';
    if (s === 'truncated') return 'truncated';
    if (s === 'parseerror' || s === 'parse_error') return 'parseError';
    if (s === 'validationfailed' || s === 'validation_failed') return 'validationFailed';
    // Anything else non-final → treat as failed
    return 'failed';
  }

  // ── Live DB verification ──
  async function verifyLiveState(items: UnresolvedItem[]): Promise<UnresolvedItem[]> {
    // Group by source to batch queries
    const bySource = new Map<ContentSource, UnresolvedItem[]>();
    for (const item of items) {
      if (!bySource.has(item.source)) bySource.set(item.source, []);
      bySource.get(item.source)!.push(item);
    }

    for (const [source, sourceItems] of bySource) {
      const slugs = [...new Set(sourceItems.map(i => i.slug))];
      
      // Fetch in chunks of 50
      for (let i = 0; i < slugs.length; i += 50) {
        const chunk = slugs.slice(i, i + 50);
        try {
          const { data } = await supabase
            .from(source as any)
            .select('slug, meta_title, meta_description, canonical_url, excerpt, featured_image_alt, content, faq_schema')
            .in('slug', chunk);

          if (data) {
            const bySlug = new Map((data as any[]).map(d => [d.slug, d]));
            for (const item of sourceItems) {
              if (!chunk.includes(item.slug)) continue;
              const record = bySlug.get(item.slug);
              if (!record) {
                item.stillUnfixed = false;
                item.verificationNote = 'Record no longer exists';
                continue;
              }

              // Check if the field is now populated/valid
              const fieldToCheck = item.field || categoryToField(item.category);
              if (fieldToCheck && fieldToCheck !== 'content') {
                const val = record[fieldToCheck];
                item.liveValue = typeof val === 'string' ? val : (val ? JSON.stringify(val).substring(0, 100) : null);

                if (isFieldNowValid(fieldToCheck, val, item.slug, source)) {
                  item.stillUnfixed = false;
                  item.verificationNote = 'Already fixed (DB value is valid)';
                } else {
                  item.verificationNote = val ? `Current: \"${String(val).substring(0, 80)}\"` : 'Empty/null';
                }
              } else if (item.category === 'h1') {
                const content = record.content || '';
                const h1Count = (content.match(/<h1[\\s>]/gi) || []).length;
                if (h1Count === 1) {
                  item.stillUnfixed = false;
                  item.verificationNote = 'H1 is now present';
                } else {
                  item.verificationNote = `H1 count: ${h1Count}`;
                }
              } else if (item.category === 'internal_links') {
                const content = record.content || '';
                const linkCount = (content.match(/href=["']\/[^"']+["']/gi) || []).length;
                if (linkCount >= 3) {
                  item.stillUnfixed = false;
                  item.verificationNote = `${linkCount} internal links found`;
                } else {
                  item.verificationNote = `Only ${linkCount} internal links`;
                }
              } else if (item.category === 'faq_opportunity' || item.category === 'faq_schema') {
                const faq = record.faq_schema;
                if (Array.isArray(faq) && faq.length > 0) {
                  item.stillUnfixed = false;
                  item.verificationNote = `FAQ schema has ${faq.length} items`;
                } else {
                  item.verificationNote = 'No FAQ schema';
                }
              }
            }
          }
        } catch { /* continue with remaining */ }
      }
    }

    return items;
  }

  function categoryToField(category: string): string | null {
    const map: Record<string, string> = {
      meta_title: 'meta_title',
      meta_description: 'meta_description',
      canonical_url: 'canonical_url',
      excerpt: 'excerpt',
      featured_image_alt: 'featured_image_alt',
    };
    return map[category] || null;
  }

  function isFieldNowValid(field: string, value: any, slug: string, source: ContentSource): boolean {
    if (!value || (typeof value === 'string' && value.trim().length === 0)) return false;

    switch (field) {
      case 'meta_title':
        return typeof value === 'string' && value.length >= 10 && value.length <= 65;
      case 'meta_description':
        return typeof value === 'string' && value.length >= 50 && value.length <= 155;
      case 'canonical_url':
        return typeof value === 'string' && isValidCanonicalUrl(value);
      case 'excerpt':
        return typeof value === 'string' && value.length >= 20;
      case 'featured_image_alt':
        return typeof value === 'string' && value.length >= 5;
      case 'faq_schema':
        return Array.isArray(value) && value.length > 0;
      default:
        return !!value;
    }
  }

  // ── Filtered + selected items ──
  const filteredItems = useMemo(() => {
    return items.filter(i => {
      if (filterStatus !== 'all' && i.status !== filterStatus) return false;
      if (filterSource !== 'all' && i.source !== filterSource) return false;
      if (filterCategory !== 'all' && i.category !== filterCategory) return false;
      return true;
    });
  }, [items, filterStatus, filterSource, filterCategory]);

  const stillUnfixedItems = useMemo(() => items.filter(i => i.stillUnfixed), [items]);
  const selectedItems = useMemo(() => items.filter(i => selectedIds.has(i.id) && i.stillUnfixed), [items, selectedIds]);

  const activeStatuses = useMemo(() => [...new Set(items.map(i => i.status))].sort(), [items]);
  const activeSources = useMemo(() => [...new Set(items.map(i => i.source))].sort(), [items]);
  const activeCategories = useMemo(() => [...new Set(items.map(i => i.category))].sort(), [items]);

  // ── Toggle selection ──
  const toggleItem = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectAll) {
      setSelectedIds(new Set());
      setSelectAll(false);
    } else {
      setSelectedIds(new Set(filteredItems.filter(i => i.stillUnfixed).map(i => i.id)));
      setSelectAll(true);
    }
  };

  // ── Fix selected items ──
  const handleFix = useCallback(async () => {
    if (selectedItems.length === 0) {
      toast({ title: 'Nothing selected', description: 'Select items to fix first.' });
      return;
    }

    const safeModel = SEO_FIX_MODEL_VALUES.includes(aiModel as typeof SEO_FIX_MODEL_VALUES[number]) ? aiModel : 'gemini-pro';

    setPhase('fixing');
    stopSignal.current = { stopped: false };
    fixStartedAt.current = new Date();
    fixWarnings.current = [];
    setFixResults([]);

    const progress: FixProgress = {
      total: selectedItems.length,
      processed: 0,
      fixed: 0,
      skipped: 0,
      failed: 0,
      reviewRequired: 0,
      currentSlug: '',
      currentModel: safeModel,
    };
    setFixProgress({ ...progress });

    const results: FixResult[] = [];

    // Group by slug+source for batching (1 page at a time for reliability)
    const pageGroups = new Map<string, UnresolvedItem[]>();
    for (const item of selectedItems) {
      const key = `${item.source}:${item.slug}`;
      if (!pageGroups.has(key)) pageGroups.set(key, []);
      pageGroups.get(key)!.push(item);
    }

    const pages = Array.from(pageGroups.entries());

    for (let i = 0; i < pages.length; i++) {
      if (stopSignal.current.stopped) break;

      const [, pageItems] = pages[i];
      const rep = pageItems[0];
      progress.currentSlug = rep.slug;
      setFixProgress({ ...progress });

      try {
        // Fetch content snippet
        let contentSnippet = '';
        try {
          const { data } = await supabase
            .from(rep.source as any)
            .select('content, title')
            .eq('slug', rep.slug)
            .single();
          if (data) {
            contentSnippet = ((data as any).content || '').substring(0, 800);
          }
        } catch { /* ignore */ }

        // Determine title
        let title = rep.slug;
        try {
          const { data } = await supabase
            .from(rep.source as any)
            .select('title, id, slug')
            .eq('slug', rep.slug)
            .single();
          if (data) title = (data as any).title || rep.slug;
        } catch { /* ignore */ }

        // Build focused issues for this page
        const issues = pageItems.map(item => ({
          category: item.category,
          message: `Previously ${item.status}: ${item.reason}`,
          currentValue: item.liveValue || '',
          fixHint: getFixHint(item),
        }));

        // Call the edge function with batch of 1
        const { data, error } = await supabase.functions.invoke('seo-audit-fix', {
          body: {
            pages: [{
              source: rep.source,
              recordId: `resolve:${rep.slug}`, // Will be looked up by slug
              slug: rep.slug,
              title,
              isPublished: true, // Conservative assumption
              issues,
              contentSnippet,
            }],
            aiModel: safeModel,
          },
        });

        if (error) throw new Error(error.message);

        const pageResults = data?.results?.[0];
        if (!pageResults) throw new Error('No result returned from AI');

        if (pageResults.parseError || pageResults.error) {
          const reason = pageResults.failureReason || pageResults.error || 'AI response could not be parsed';
          for (const item of pageItems) {
            results.push({
              issueId: item.id,
              source: item.source,
              recordId: item.id,
              slug: item.slug,
              category: item.category,
              status: 'failed',
              reason: `Parse/AI error: ${reason}`,
            });
            progress.failed++;
          }
          if (pageResults.failureReason) {
            fixWarnings.current.push(`${rep.slug}: ${pageResults.failureReason}`);
          }
        } else {
          const fixes = pageResults.fixes || [];
          const appliedCategories = new Set<string>();

          for (const fix of fixes) {
            if (stopSignal.current.stopped) break;

            const matchingItem = pageItems.find(i => i.category === fix.category && !appliedCategories.has(i.id));
            if (!matchingItem) continue;

            // Look up actual record ID
            let recordId = '';
            try {
              const { data: rec } = await supabase
                .from(matchingItem.source as any)
                .select('id')
                .eq('slug', matchingItem.slug)
                .single();
              if (rec) recordId = (rec as any).id;
            } catch { /* ignore */ }

            if (!recordId) {
              results.push({
                issueId: matchingItem.id,
                source: matchingItem.source,
                recordId: '',
                slug: matchingItem.slug,
                category: matchingItem.category,
                status: 'failed',
                reason: 'Could not find record by slug',
              });
              progress.failed++;
              continue;
            }

            // Apply fix with validation
            const result = await applyResolverFix(
              matchingItem.source, recordId, matchingItem.slug,
              fix, matchingItem.id,
            );
            results.push(result);
            appliedCategories.add(matchingItem.id);

            if (result.status === 'fixed') progress.fixed++;
            else if (result.status === 'failed') progress.failed++;
            else if (result.status === 'review_required') progress.reviewRequired++;
            else progress.skipped++;
          }

          // Items that got no fix
          for (const item of pageItems) {
            if (!appliedCategories.has(item.id) && !results.some(r => r.issueId === item.id)) {
              results.push({
                issueId: item.id,
                source: item.source,
                recordId: '',
                slug: item.slug,
                category: item.category,
                status: 'skipped',
                reason: 'AI did not generate a fix for this issue',
              });
              progress.skipped++;
            }
          }
        }
      } catch (err: any) {
        for (const item of pageItems) {
          results.push({
            issueId: item.id,
            source: item.source,
            recordId: '',
            slug: item.slug,
            category: item.category,
            status: 'failed',
            reason: `Error: ${err.message || 'Unknown'}`,
          });
          progress.failed++;
        }
      }

      progress.processed++;
      setFixProgress({ ...progress });

      // Throttle between pages
      if (i + 1 < pages.length && !stopSignal.current.stopped) {
        await new Promise(r => setTimeout(r, 2000));
      }
    }

    setFixResults(results);
    setPhase('done');

    const fixed = results.filter(r => r.status === 'fixed').length;
    const failed = results.filter(r => r.status === 'failed').length;
    const review = results.filter(r => r.status === 'review_required').length;
    toast({
      title: stopSignal.current.stopped ? 'Resolve Stopped' : 'Resolve Complete',
      description: `${fixed} fixed, ${failed} failed, ${review} review needed`,
    });

    // Save to history
    try {
      const mockReport = {
        scannedAt: new Date().toISOString(),
        totalScanned: { blog_posts: 0, pdf_resources: 0, custom_pages: 0 } as Record<ContentSource, number>,
        issues: [],
        summary: {
          bySource: {} as Record<ContentSource, number>,
          byCategory: {},
          bySeverity: { critical: 0, high: 0, medium: 0, low: 0 },
          autoFixable: selectedItems.length,
          reviewRequired: 0,
        },
      };
      // Count sources
      for (const item of selectedItems) {
        mockReport.totalScanned[item.source] = (mockReport.totalScanned[item.source] || 0) + 1;
      }
      await saveFixRun(mockReport, results, safeModel, fixStartedAt.current!, fixWarnings.current);
    } catch { /* non-critical */ }
  }, [selectedItems, aiModel, toast]);

  const handleStop = () => { stopSignal.current.stopped = true; };

  function getFixHint(item: UnresolvedItem): string {
    switch (item.status) {
      case 'parseError':
      case 'truncated':
        return 'Previous attempt had parse/truncation error. Return compact JSON only.';
      case 'validationFailed':
        return `Previous fix failed validation: ${item.reason}. Ensure output meets length/format rules.`;
      case 'failed':
        return `Previous failure: ${item.reason}. Try a different approach.`;
      case 'review_required':
        return 'Previously flagged for review. If safe, auto-fix. Use high confidence.';
      case 'skipped':
        return 'AI did not generate a fix last time. Please generate one now.';
      default:
        return 'Fix this issue with high confidence.';
    }
  }

  // ── Apply a single fix with strict validation ──
  async function applyResolverFix(
    source: ContentSource, recordId: string, slug: string,
    fix: any, issueId: string,
  ): Promise<FixResult> {
    const base = { issueId, source, recordId, slug, category: fix.category || 'unknown' };

    // Low confidence → review
    if (fix.confidence === 'low') {
      return { ...base, status: 'review_required', reason: `Low confidence: ${fix.explanation || 'AI unsure'}`, field: fix.field };
    }

    // Slug changes → always review
    if (fix.field === 'slug') {
      return { ...base, status: 'review_required', reason: 'Slug changes require manual review', field: 'slug' };
    }

    const action = fix.action || 'set_field';

    if (action === 'set_field' && fix.field && fix.value) {
      const validation = validateFixValue(fix.field, fix.value);
      if (!validation.valid) {
        return { ...base, status: 'failed', reason: `Validation: ${validation.reason}`, field: fix.field, afterValue: fix.value };
      }

      const { error } = await supabase.from(source as any).update({ [fix.field]: fix.value }).eq('id', recordId);
      if (error) {
        return { ...base, status: 'failed', reason: `DB error: ${error.message}`, field: fix.field };
      }

      // Post-save verification
      const verifyResult = await postFixVerify(source, recordId, fix.field, fix.value);
      return {
        ...base, status: 'fixed', reason: fix.explanation || 'Auto-fixed',
        field: fix.field, afterValue: fix.value,
        verificationPassed: verifyResult.passed, verificationNote: verifyResult.note,
      };
    }

    if (action === 'append_content' && fix.value) {
      const sanitized = fix.value
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/\son\w+\s*=\s*["'][^"']*["']/gi, '')
        .replace(/javascript:/gi, '');

      // Fetch current content and check dedup
      const { data: current } = await supabase.from(source as any).select('content').eq('id', recordId).single();
      const currentContent = (current as any)?.content || '';
      const sig = sanitized.replace(/<[^>]+>/g, '').trim().substring(0, 100);
      if (currentContent.includes(sig)) {
        return { ...base, status: 'skipped', reason: 'Content already contains this block', field: 'content' };
      }

      const { error } = await supabase
        .from(source as any)
        .update({ content: currentContent + '\\n\\n' + sanitized, updated_at: new Date().toISOString() })
        .eq('id', recordId);
      if (error) {
        return { ...base, status: 'failed', reason: `Append error: ${error.message}`, field: 'content' };
      }
      return { ...base, status: 'fixed', reason: fix.explanation || 'Content appended', field: 'content', afterValue: `[${sanitized.length} chars appended]` };
    }

    if (action === 'set_faq_schema') {
      let schema = fix.value;
      if (typeof schema === 'string') {
        try { schema = JSON.parse(schema); } catch {
          return { ...base, status: 'failed', reason: 'FAQ schema is not valid JSON', field: 'faq_schema' };
        }
      }
      const faqCheck = validateFaqSchema(schema);
      if (!faqCheck.valid) {
        return { ...base, status: 'failed', reason: `FAQ validation: ${faqCheck.reason}`, field: 'faq_schema' };
      }

      const updates: Record<string, any> = { faq_schema: schema, updated_at: new Date().toISOString() };
      if (source === 'blog_posts') { updates.has_faq_schema = true; updates.faq_count = schema.length; }

      const { error } = await supabase.from(source as any).update(updates).eq('id', recordId);
      if (error) {
        return { ...base, status: 'failed', reason: `FAQ save: ${error.message}`, field: 'faq_schema' };
      }
      return { ...base, status: 'fixed', reason: `FAQ schema set: ${schema.length} items`, field: 'faq_schema', afterValue: `${schema.length} FAQ items` };
    }

    return { ...base, status: 'review_required', reason: `Unknown action: ${action}`, field: fix.field };
  }

  async function postFixVerify(source: ContentSource, recordId: string, field: string, expected: string): Promise<{ passed: boolean; note: string }> {
    try {
      const { data, error } = await supabase.from(source as any).select(field).eq('id', recordId).single();
      if (error || !data) return { passed: false, note: `Read-back failed: ${error?.message || 'not found'}` };
      const saved = (data as any)[field];

      if (field === 'canonical_url' && !isValidCanonicalUrl(saved)) {
        return { passed: false, note: `Saved canonical invalid: ${saved}` };
      }
      if (field === 'meta_description' && (typeof saved !== 'string' || saved.length < 50 || saved.length > 155)) {
        return { passed: false, note: `Meta desc out of range: ${saved?.length || 0}` };
      }
      if (field === 'meta_title' && (typeof saved !== 'string' || saved.length < 10 || saved.length > 65)) {
        return { passed: false, note: `Meta title out of range: ${saved?.length || 0}` };
      }
      return { passed: true, note: 'DB save verified' };
    } catch (err: any) {
      return { passed: false, note: `Verify error: ${err.message}` };
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════

  return (
    <div className="space-y-4">
      {/* Header controls */}
      <div className="flex flex-wrap items-center gap-3">
        <Button
          onClick={loadUnresolved}
          disabled={phase === 'loading' || phase === 'fixing'}
          size="lg"
        >
          {phase === 'loading' ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-2" />
          )}
          {phase === 'loading' ? 'Loading…' : 'Load Unresolved Items'}
        </Button>

        <div className="flex items-center gap-2 ml-auto">
          <span className="text-xs text-muted-foreground">AI Model:</span>
          <AiModelSelector
            value={aiModel}
            onValueChange={setAiModel}
            capability="text"
            size="sm"
            triggerClassName="w-[200px]"
            allowedValues={SEO_FIX_MODEL_VALUES}
          />
        </div>

        {phase === 'fixing' ? (
          <Button size="lg" variant="destructive" onClick={handleStop}>
            <Square className="h-4 w-4 mr-2" /> Stop
          </Button>
        ) : (
          <Button
            size="lg"
            disabled={selectedItems.length === 0 || phase === 'loading'}
            className="bg-gradient-to-r from-primary to-primary/80"
            onClick={handleFix}
          >
            <Zap className="h-4 w-4 mr-2" />
            Fix Selected Items ({selectedItems.length})
          </Button>
        )}
      </div>

      {/* Summary stats when ready */}
      {phase !== 'idle' && phase !== 'loading' && items.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <StatCard label="Total Loaded" value={items.length} />
          <StatCard label="Still Unfixed" value={stillUnfixedItems.length} color="text-destructive" />
          <StatCard label="Already Resolved" value={items.length - stillUnfixedItems.length} color="text-primary" />
          <StatCard label="Selected" value={selectedItems.length} color="text-primary" />
          <StatCard label="Review Only" value={items.filter(i => REVIEW_ONLY_CATEGORIES.has(i.category)).length} />
        </div>
      )}

      {/* Progress */}
      {phase === 'fixing' && fixProgress && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium">Resolving… {fixProgress.processed}/{fixProgress.total} pages</span>
              <span className="text-muted-foreground">Model: {getModelLabel(fixProgress.currentModel)}</span>
            </div>
            <Progress value={fixProgress.total > 0 ? (fixProgress.processed / fixProgress.total) * 100 : 0} className="h-2" />
            <div className="flex flex-wrap gap-3 text-xs">
              <span className="text-primary font-medium">✓ {fixProgress.fixed} fixed</span>
              <span className="text-muted-foreground">⏭ {fixProgress.skipped} skipped</span>
              <span className="text-destructive">✗ {fixProgress.failed} failed</span>
              <span>👁 {fixProgress.reviewRequired} review</span>
            </div>
            {fixProgress.currentSlug && (
              <p className="text-[10px] text-muted-foreground truncate">Processing: {fixProgress.currentSlug}</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Final report */}
      {phase === 'done' && fixResults.length > 0 && (
        <Card className="border-primary/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              Resolve Report
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-5 gap-3 text-center">
              <div>
                <div className="text-sm font-bold text-muted-foreground">{fixResults.length}</div>
                <div className="text-[9px] text-muted-foreground">Processed</div>
              </div>
              <div>
                <div className="text-sm font-bold text-primary">{fixResults.filter(r => r.status === 'fixed').length}</div>
                <div className="text-[9px] text-muted-foreground">Fixed</div>
              </div>
              <div>
                <div className="text-sm font-bold text-destructive">{fixResults.filter(r => r.status === 'failed').length}</div>
                <div className="text-[9px] text-muted-foreground">Failed</div>
              </div>
              <div>
                <div className="text-sm font-bold text-muted-foreground">{fixResults.filter(r => r.status === 'skipped').length}</div>
                <div className="text-[9px] text-muted-foreground">Skipped</div>
              </div>
              <div>
                <div className="text-sm font-bold">{fixResults.filter(r => r.status === 'review_required').length}</div>
                <div className="text-[9px] text-muted-foreground">Review</div>
              </div>
            </div>

            {fixWarnings.current.length > 0 && (
              <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-500/30 rounded p-2 space-y-1">
                <p className="text-xs font-medium text-amber-800 dark:text-amber-400 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" /> Warnings ({fixWarnings.current.length})
                </p>
                {Array.from(new Set(fixWarnings.current)).map((w, i) => (
                  <p key={i} className="text-[10px] text-amber-800 dark:text-amber-300">{w}</p>
                ))}
              </div>
            )}

            <ScrollArea className="max-h-[400px]">
              <div className="space-y-1">
                {fixResults.map((r, idx) => (
                  <div key={idx} className="flex items-start gap-2 text-xs border rounded px-2.5 py-1.5">
                    {r.status === 'fixed' && <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />}
                    {r.status === 'failed' && <XCircle className="h-3.5 w-3.5 text-destructive shrink-0 mt-0.5" />}
                    {r.status === 'review_required' && <Eye className="h-3.5 w-3.5 shrink-0 mt-0.5" style={{ color: 'hsl(var(--muted-foreground))' }} />}
                    {r.status === 'skipped' && <SkipForward className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium truncate">{r.slug}</span>
                        <Badge variant="outline" className="text-[8px]">
                          {r.category}
                        </Badge>
                        {r.field && <span className="text-muted-foreground">→ {r.field}</span>}
                        {r.verificationPassed === false && (
                          <Badge variant="outline" className="text-[8px] border-destructive/40 text-destructive">⚠ verify fail</Badge>
                        )}
                      </div>
                      <p className="text-muted-foreground">{r.reason}</p>
                      {r.afterValue && <p className="text-[10px] text-primary truncate">New: {r.afterValue}</p>}
                    </div>
                    <Badge variant="outline" className={`text-[8px] shrink-0 ${
                      r.status === 'fixed' ? 'border-primary/40 text-primary' :
                      r.status === 'failed' ? 'border-destructive/40 text-destructive' :
                      'border-amber-500/40 text-amber-700'
                    }`}>
                      {r.status === 'fixed' ? '✓' : r.status === 'failed' ? '✗' : r.status === 'review_required' ? '👁' : '⏭'} {r.status}
                    </Badge>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Filters + Items list */}
      {(phase === 'ready' || phase === 'done') && items.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[150px] h-8 text-xs"><SelectValue placeholder="All Statuses" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  {activeStatuses.map(s => (
                    <SelectItem key={s} value={s}>{STATUS_LABELS[s] || s} ({items.filter(i => i.status === s).length})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterSource} onValueChange={setFilterSource}>
                <SelectTrigger className="w-[140px] h-8 text-xs"><SelectValue placeholder="All Sources" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sources</SelectItem>
                  {activeSources.map(s => (
                    <SelectItem key={s} value={s}>{SOURCE_LABELS[s as ContentSource] || s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger className="w-[160px] h-8 text-xs"><SelectValue placeholder="All Categories" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {activeCategories.map(c => (
                    <SelectItem key={c} value={c}>{CATEGORY_LABELS[c] || c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="flex items-center gap-2 ml-auto">
                <Checkbox checked={selectAll} onCheckedChange={toggleSelectAll} id="select-all-resolve" />
                <label htmlFor="select-all-resolve" className="text-xs text-muted-foreground cursor-pointer">
                  Select all filtered ({filteredItems.filter(i => i.stillUnfixed).length})
                </label>
              </div>

              <span className="text-xs text-muted-foreground">
                {filteredItems.length} items shown, {selectedItems.length} selected
              </span>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="max-h-[500px]">
              <div className="divide-y">
                {filteredItems.length === 0 && (
                  <div className="p-8 text-center text-muted-foreground text-sm">
                    No items match current filters.
                  </div>
                )}
                {filteredItems.map(item => {
                  const fixResult = fixResults.find(r => r.issueId === item.id);
                  const Icon = SOURCE_ICONS[item.source];
                  return (
                    <div
                      key={item.id}
                      className={`px-4 py-2.5 flex items-center gap-3 hover:bg-muted/30 ${
                        !item.stillUnfixed ? 'opacity-50' : ''
                      } ${fixResult?.status === 'fixed' ? 'bg-primary/5' : ''}`}
                    >
                      <Checkbox
                        checked={selectedIds.has(item.id)}
                        disabled={!item.stillUnfixed}
                        onCheckedChange={() => toggleItem(item.id)}
                      />
                      <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-medium truncate">{item.slug}</span>
                          <Badge variant="outline" className="text-[8px]">
                            {CATEGORY_LABELS[item.category] || item.category}
                          </Badge>
                        </div>
                        <p className="text-[10px] text-muted-foreground truncate">
                          {item.reason}
                        </p>
                        {item.verificationNote && (
                          <p className="text-[10px] text-muted-foreground truncate italic">
                            Live: {item.verificationNote}
                          </p>
                        )}
                      </div>

                      {/* Status badge */}
                      {fixResult ? (
                        <Badge variant="outline" className={`text-[8px] shrink-0 ${
                          fixResult.status === 'fixed' ? 'border-primary/40 text-primary' :
                          fixResult.status === 'failed' ? 'border-destructive/40 text-destructive' :
                          'border-amber-500/40 text-amber-700'
                        }`}>
                          {fixResult.status === 'fixed' ? '✓ Fixed' : fixResult.status === 'failed' ? '✗ Failed' : fixResult.status === 'review_required' ? '👁 Review' : '⏭ Skip'}
                        </Badge>
                      ) : !item.stillUnfixed ? (
                        <Badge variant="outline" className="text-[8px] border-primary/40 text-primary shrink-0">
                          ✓ Already resolved
                        </Badge>
                      ) : (
                        <Badge variant="outline" className={`text-[8px] shrink-0 ${STATUS_COLORS[item.status] || ''}`}>
                          {STATUS_LABELS[item.status] || item.status}
                        </Badge>
                      )}

                      {/* Source label */}
                      <Badge variant="secondary" className="text-[8px] shrink-0">
                        {SOURCE_LABELS[item.source]?.split(' ')[0] || item.source}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Empty state */}
      {phase === 'idle' && (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground text-sm">
            <AlertTriangle className="h-8 w-8 mx-auto mb-2 opacity-40" />
            <p className="font-medium">Resolve Unresolved SEO Items</p>
            <p className="text-xs mt-1 max-w-md mx-auto">
              This tool loads failed, skipped, pending, and review-required items from previous audit/fix runs,
              verifies them against live DB state, and lets you fix them with targeted AI processing.
            </p>
            <p className="text-xs mt-2 text-muted-foreground">
              Click "Load Unresolved Items" to begin.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ── Small stat card ──
function StatCard({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <Card>
      <CardContent className="p-3 text-center">
        <div className={`text-lg font-bold ${color || 'text-foreground'}`}>{value}</div>
        <div className="text-[10px] text-muted-foreground">{label}</div>
      </CardContent>
    </Card>
  );
}
