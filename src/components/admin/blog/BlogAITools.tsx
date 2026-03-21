import { useState, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAdminToast as useToast } from '@/contexts/AdminMessagesContext';
import { filterValidInternalLinks, isValidInternalPagePath } from '@/lib/blogLinkValidator';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Sparkles, FileText, MessageSquare, Link2, Wrench, ShieldCheck,
  RefreshCw, Loader2, ChevronDown, Check, X, AlertTriangle,
  Circle, CheckCircle2, AlertCircle, Clock, Copy, Plus, ArrowRight,
} from 'lucide-react';
import type { Editor } from '@tiptap/react';
import type { PublishComplianceReport } from '@/lib/blogComplianceAnalyzer';
import type { ArticleMetadata, QualityReport, SEOReport } from '@/lib/blogArticleAnalyzer';

// ── Status types ──
type ToolStatus = 'not-started' | 'ready' | 'running' | 'needs-review' | 'applied' | 'warning' | 'error';

const STATUS_CONFIG: Record<ToolStatus, { label: string; className: string; icon: React.ReactNode }> = {
  'not-started': { label: 'Not Started', className: 'bg-muted text-muted-foreground', icon: <Circle className="h-2.5 w-2.5" /> },
  'ready': { label: 'Ready', className: 'bg-primary/10 text-primary', icon: <CheckCircle2 className="h-2.5 w-2.5" /> },
  'running': { label: 'Running…', className: 'bg-primary/10 text-primary animate-pulse', icon: <Loader2 className="h-2.5 w-2.5 animate-spin" /> },
  'needs-review': { label: 'Review', className: 'bg-yellow-500/15 text-yellow-700 dark:text-yellow-400', icon: <Clock className="h-2.5 w-2.5" /> },
  'applied': { label: 'Done', className: 'bg-green-500/15 text-green-700 dark:text-green-400', icon: <CheckCircle2 className="h-2.5 w-2.5" /> },
  'warning': { label: 'Warning', className: 'bg-orange-500/15 text-orange-700 dark:text-orange-400', icon: <AlertTriangle className="h-2.5 w-2.5" /> },
  'error': { label: 'Error', className: 'bg-destructive/15 text-destructive', icon: <AlertCircle className="h-2.5 w-2.5" /> },
};

function StatusBadge({ status }: { status: ToolStatus }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full ${cfg.className}`}>
      {cfg.icon}
      {cfg.label}
    </span>
  );
}

interface BlogAIToolsProps {
  formData: {
    title: string;
    slug: string;
    content: string;
    excerpt: string;
    meta_title: string;
    meta_description: string;
    cover_image_url: string;
    featured_image_alt: string;
    author_name: string;
    category?: string | null;
    tags?: string[] | null;
    canonical_url?: string;
  };
  onApplyField: (field: string, value: string) => void;
  editorInstance: Editor | null;
  currentCompliance: PublishComplianceReport | null;
  existingFaqCount?: number;
  currentMetadata?: ArticleMetadata | null;
  currentQuality?: QualityReport | null;
  currentSEO?: SEOReport | null;
}

interface ToolState {
  isLoading: boolean;
  result: any;
  error: string | null;
}

type ToolKey = 'seo' | 'faq' | 'internalLinks' | 'structure' | 'rewriteSection' | 'complianceFixes' | 'enrichArticle';

// ── Editable fields whitelist (must match server-side) ──
const EDITABLE_FIELDS = new Set(['meta_title', 'meta_description', 'excerpt', 'featured_image_alt', 'author_name', 'canonical_url', 'slug']);

// ── Legacy applyMode normalization ──
const APPLY_MODE_LEGACY_MAP: Record<string, string> = {
  'field': 'apply_field',
  'append': 'append_content',
  'review-and-replace': 'review_replacement',
  'manual': 'advisory',
};

function normalizeApplyMode(mode: string | undefined | null): string {
  if (!mode) return 'advisory';
  return APPLY_MODE_LEGACY_MAP[mode] || mode;
}

// ── Valid whitelist sets for response validation ──
const VALID_FIX_TYPES = new Set([
  'metadata', 'content-block', 'rewrite', 'advisory',
  'canonical_url', 'slug', 'meta_description', 'image_alt',
  'faq', 'intro', 'conclusion', 'trust_signal',
  'affiliate_links', 'internal_links', 'content_rewrite',
]);
const VALID_APPLY_MODES = new Set([
  'apply_field', 'append_content', 'prepend_content',
  'insert_before_first_heading', 'replace_section',
  'review_replacement', 'advisory',
]);

// ── Telemetry + Audit helpers (fire-and-forget) ──
async function trackBlogToolEvent(ev: {
  event_name: string; tool_name: string; action?: string; target?: string;
  apply_mode?: string; status?: string; error_message?: string;
  item_count?: number; slug?: string; category?: string; tags?: string[];
}) {
  try {
    await supabase.from('blog_ai_telemetry' as any).insert({ ...ev, timestamp: new Date().toISOString() });
  } catch (e) { console.warn('telemetry insert failed', e); }
}

async function logBlogAiAudit(entry: {
  tool_name: string; before_value: any; after_value: any;
  apply_mode?: string; target_field?: string; slug?: string;
}) {
  try {
    await supabase.from('blog_ai_audit_log' as any).insert({
      ...entry,
      before_value: typeof entry.before_value === 'string' ? entry.before_value : JSON.stringify(entry.before_value ?? ''),
      after_value: typeof entry.after_value === 'string' ? entry.after_value : JSON.stringify(entry.after_value ?? ''),
      apply_mode: entry.apply_mode || 'advisory',
      timestamp: new Date().toISOString(),
    });
  } catch (e) { console.warn('audit insert failed', e); }
}

// ── Deterministic content helpers ──
function insertBeforeFirstHeading(editor: Editor, html: string): boolean {
  const content = editor.getHTML();
  const match = content.match(/<h[12][^>]*>/i);
  if (match && match.index !== undefined) {
    const before = content.substring(0, match.index);
    const after = content.substring(match.index);
    editor.commands.setContent(before + html + after);
    return true;
  }
  // Fallback: prepend
  editor.commands.setContent(html + content);
  return true;
}

function hasExistingIntro(content: string): boolean {
  // Check if there's substantive text before the first heading
  const firstHeadingIdx = content.search(/<h[12][^>]*>/i);
  if (firstHeadingIdx <= 0) return false;
  const before = content.substring(0, firstHeadingIdx).replace(/<[^>]+>/g, '').trim();
  return before.length > 30;
}

function hasExistingConclusion(content: string): boolean {
  return /<h[2-3][^>]*>.*(?:Conclusion|Final Thoughts|Summary|Key Takeaways|निष्कर्ष|सारांश)/i.test(content);
}

function sentenceAlreadyExists(html: string, sentence: string): boolean {
  const norm = (s: string) => s.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
  return norm(html).includes(norm(sentence).substring(0, 80));
}

function contentBlockAlreadyExists(html: string, block: string): boolean {
  const norm = (s: string) => s.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
  const blockNorm = norm(block);
  if (!blockNorm || blockNorm.length < 10) return false;
  return norm(html).includes(blockNorm.substring(0, 80));
}

// ── Validate/normalize compliance response before rendering ──
function normalizeComplianceFixes(rawFixes: any[]): any[] {
  if (!Array.isArray(rawFixes)) return [];
  return rawFixes
    .map((f: any) => {
      if (!f || typeof f !== 'object') return null;
      const applyMode = normalizeApplyMode(f.applyMode);
      let fixType = typeof f.fixType === 'string' ? f.fixType : 'advisory';
      if (!VALID_FIX_TYPES.has(fixType)) fixType = 'advisory';
      const normalizedApplyMode = VALID_APPLY_MODES.has(applyMode) ? applyMode : 'advisory';
      const issueLabel = typeof f.issueLabel === 'string' ? f.issueLabel : '';
      const explanation = typeof f.explanation === 'string' ? f.explanation : '';
      const priority = ['high', 'medium', 'low'].includes(f.priority) ? f.priority : 'medium';
      // Filter out completely malformed items
      if (!issueLabel && !explanation) return null;
      return {
        ...f,
        fixType,
        applyMode: normalizedApplyMode,
        issueLabel: issueLabel || 'Issue',
        explanation,
        priority,
        suggestedValue: typeof f.suggestedValue === 'string' ? f.suggestedValue : '',
        field: typeof f.field === 'string' ? f.field : '',
        confidence: ['high', 'medium', 'low'].includes(f.confidence) ? f.confidence : 'medium',
      };
    })
    .filter(Boolean);
}

// ── FAQ detection helper ──
function hasFaqHeading(content: string): boolean {
  return /<h[2-3][^>]*>.*(?:FAQ|Frequently Asked Questions)/i.test(content);
}

// ── Status derivation ──
function deriveSeoStatus(tool: ToolState, formData: BlogAIToolsProps['formData']): ToolStatus {
  if (tool.isLoading) return 'running';
  if (tool.error) return 'error';
  if (tool.result) return 'needs-review';
  const hasMeta = !!formData.meta_title && !!formData.meta_description;
  const hasExcerpt = !!formData.excerpt;
  if (hasMeta && hasExcerpt) return 'applied';
  if (hasMeta || hasExcerpt) return 'needs-review';
  return 'not-started';
}

function deriveFaqStatus(tool: ToolState, faqCount: number): ToolStatus {
  if (tool.isLoading) return 'running';
  if (tool.error) return 'error';
  if (tool.result) return 'needs-review';
  if (faqCount > 0) return 'applied';
  return 'not-started';
}

function deriveInternalLinksStatus(tool: ToolState, metadata?: ArticleMetadata | null): ToolStatus {
  if (tool.isLoading) return 'running';
  if (tool.error) return 'error';
  if (tool.result) {
    const suggestions = tool.result.suggestions || [];
    if (suggestions.length === 0) return 'warning';
    return 'needs-review';
  }
  const linkCount = metadata?.internalLinks?.length || 0;
  if (linkCount >= 2) return 'applied';
  if (linkCount >= 1) return 'needs-review';
  return 'not-started';
}

function deriveStructureStatus(tool: ToolState, metadata?: ArticleMetadata | null, quality?: QualityReport | null): ToolStatus {
  if (tool.isLoading) return 'running';
  if (tool.error) return 'error';
  if (tool.result) return 'needs-review';
  if (!metadata) return 'not-started';
  const hasIntro = metadata.hasIntro;
  const hasConclusion = metadata.hasConclusion;
  const h2Count = metadata.headings?.filter(h => h.level === 2).length || 0;
  if (hasIntro && hasConclusion && h2Count >= 2) return 'applied';
  if (hasIntro || hasConclusion || h2Count >= 1) return 'needs-review';
  return 'not-started';
}

function deriveRewriteStatus(tool: ToolState, hasRewritePreview: boolean): ToolStatus {
  if (tool.isLoading) return 'running';
  if (tool.error) return 'error';
  if (hasRewritePreview) return 'needs-review';
  return 'not-started';
}

function deriveComplianceStatus(tool: ToolState, compliance: PublishComplianceReport | null): ToolStatus {
  if (tool.isLoading) return 'running';
  if (tool.error) return 'error';
  if (tool.result) return 'needs-review';
  if (!compliance) return 'not-started';
  const fails = compliance.checks.filter(c => c.status === 'fail').length;
  const warns = compliance.checks.filter(c => c.status === 'warn').length;
  if (fails === 0 && warns === 0) return 'applied';
  if (fails > 0) return 'warning';
  return 'needs-review';
}

export function BlogAITools({ formData, onApplyField, editorInstance, currentCompliance, existingFaqCount, currentMetadata, currentQuality, currentSEO }: BlogAIToolsProps) {
  const { toast } = useToast();
  const [tools, setTools] = useState<Record<ToolKey, ToolState>>({
    seo: { isLoading: false, result: null, error: null },
    faq: { isLoading: false, result: null, error: null },
    internalLinks: { isLoading: false, result: null, error: null },
    structure: { isLoading: false, result: null, error: null },
    rewriteSection: { isLoading: false, result: null, error: null },
    complianceFixes: { isLoading: false, result: null, error: null },
    enrichArticle: { isLoading: false, result: null, error: null },
  });
  const [rewritePreview, setRewritePreview] = useState<{ original: string; rewritten: string; from: number; to: number } | null>(null);
  const [resultsOpen, setResultsOpen] = useState(false);
  const [fixAllRunning, setFixAllRunning] = useState(false);
  const [fixAllResults, setFixAllResults] = useState<{ autoFixed: { field: string; value: string }[]; reviewRequired: any[]; unresolved: any[] } | null>(null);
  const [enrichWordLimit, setEnrichWordLimit] = useState(1500);

  const setToolState = (key: ToolKey, partial: Partial<ToolState>) => {
    setTools(prev => ({ ...prev, [key]: { ...prev[key], ...partial } }));
  };

  const statuses = useMemo(() => ({
    seo: deriveSeoStatus(tools.seo, formData),
    faq: deriveFaqStatus(tools.faq, existingFaqCount || 0),
    internalLinks: deriveInternalLinksStatus(tools.internalLinks, currentMetadata),
    structure: deriveStructureStatus(tools.structure, currentMetadata, currentQuality),
    rewriteSection: deriveRewriteStatus(tools.rewriteSection, !!rewritePreview),
    complianceFixes: deriveComplianceStatus(tools.complianceFixes, currentCompliance),
    enrichArticle: tools.enrichArticle.isLoading ? 'running' as ToolStatus : tools.enrichArticle.error ? 'error' as ToolStatus : tools.enrichArticle.result ? 'needs-review' as ToolStatus : 'not-started' as ToolStatus,
  }), [tools, formData, existingFaqCount, currentMetadata, currentQuality, currentCompliance, rewritePreview]);

  const invokeFunction = useCallback(async (functionName: string, body: any) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');
    const { data, error } = await supabase.functions.invoke(functionName, { body });
    if (error) throw new Error(error.message);
    return data;
  }, []);

  const copyToClipboard = useCallback((text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => {
      toast({ title: `${label} copied to clipboard` });
    }).catch(() => {
      toast({ title: 'Copy failed', variant: 'destructive' });
    });
  }, [toast]);

  // ── Generate SEO Metadata ──
  const handleGenerateSEO = async () => {
    setToolState('seo', { isLoading: true, error: null });
    trackBlogToolEvent({ event_name: 'tool_run_started', tool_name: 'seo', slug: formData.slug, category: formData.category || undefined });
    try {
      const data = await invokeFunction('generate-blog-seo', {
        title: formData.title,
        content: formData.content,
        fields: ['metaTitle', 'metaDescription', 'excerpt'],
        slug: formData.slug,
        category: formData.category || undefined,
        tags: formData.tags || undefined,
      });
      setToolState('seo', { isLoading: false, result: data });
      setResultsOpen(true);
      trackBlogToolEvent({ event_name: 'tool_run_finished', tool_name: 'seo', status: 'success', item_count: Object.keys(data || {}).length, slug: formData.slug });
    } catch (err: any) {
      setToolState('seo', { isLoading: false, error: err.message });
      toast({ title: 'SEO generation failed', description: err.message, variant: 'destructive' });
      trackBlogToolEvent({ event_name: 'tool_run_finished', tool_name: 'seo', status: 'error', error_message: err.message, slug: formData.slug });
    }
  };

  // ── Generate FAQ ──
  const handleGenerateFAQ = async () => {
    const faqCount = existingFaqCount || 0;
    setToolState('faq', { isLoading: true, error: null });
    trackBlogToolEvent({ event_name: 'tool_run_started', tool_name: 'faq', slug: formData.slug });
    try {
      const data = await invokeFunction('generate-blog-faq', {
        title: formData.title,
        content: formData.content,
        existingFaqCount: faqCount,
        category: formData.category || undefined,
        tags: formData.tags || undefined,
        slug: formData.slug,
      });
      setToolState('faq', { isLoading: false, result: data });
      setResultsOpen(true);
      trackBlogToolEvent({ event_name: 'tool_run_finished', tool_name: 'faq', status: 'success', item_count: Array.isArray(data?.faqs) ? data.faqs.length : 0, slug: formData.slug });
    } catch (err: any) {
      setToolState('faq', { isLoading: false, error: err.message });
      toast({ title: 'FAQ generation failed', description: err.message, variant: 'destructive' });
      trackBlogToolEvent({ event_name: 'tool_run_finished', tool_name: 'faq', status: 'error', error_message: err.message, slug: formData.slug });
    }
  };

  // ── Suggest Internal Links ──
  const handleSuggestLinks = async () => {
    setToolState('internalLinks', { isLoading: true, error: null });
    trackBlogToolEvent({ event_name: 'tool_run_started', tool_name: 'internalLinks', slug: formData.slug });
    try {
      const data = await invokeFunction('suggest-blog-internal-links', {
        title: formData.title,
        content: formData.content,
        slug: formData.slug,
        category: formData.category || undefined,
        tags: formData.tags || undefined,
      });
      const validSuggestions = filterValidInternalLinks(data.suggestions || []);
      setToolState('internalLinks', { isLoading: false, result: { ...data, suggestions: validSuggestions } });
      setResultsOpen(true);
      trackBlogToolEvent({ event_name: 'tool_run_finished', tool_name: 'internalLinks', status: 'success', item_count: Array.isArray(validSuggestions) ? validSuggestions.length : 0, slug: formData.slug });
    } catch (err: any) {
      setToolState('internalLinks', { isLoading: false, error: err.message });
      toast({ title: 'Link suggestions failed', description: err.message, variant: 'destructive' });
      trackBlogToolEvent({ event_name: 'tool_run_finished', tool_name: 'internalLinks', status: 'error', error_message: err.message, slug: formData.slug });
    }
  };

  // ── Improve Structure ──
  const handleImproveStructure = async () => {
    setToolState('structure', { isLoading: true, error: null });
    trackBlogToolEvent({ event_name: 'tool_run_started', tool_name: 'structure', slug: formData.slug });
    try {
      const data = await invokeFunction('improve-blog-content', {
        title: formData.title,
        content: formData.content,
        action: 'structure',
        headings: currentMetadata?.headings || [],
        hasIntro: currentMetadata?.hasIntro ?? false,
        hasConclusion: currentMetadata?.hasConclusion ?? false,
        wordCount: currentMetadata?.wordCount || 0,
        category: formData.category || undefined,
        tags: formData.tags || undefined,
      });
      setToolState('structure', { isLoading: false, result: data });
      setResultsOpen(true);
      trackBlogToolEvent({ event_name: 'tool_run_finished', tool_name: 'structure', status: 'success', item_count: Array.isArray(data?.proposedOutline) ? data.proposedOutline.length : 0, slug: formData.slug });
    } catch (err: any) {
      setToolState('structure', { isLoading: false, error: err.message });
      toast({ title: 'Structure analysis failed', description: err.message, variant: 'destructive' });
      trackBlogToolEvent({ event_name: 'tool_run_finished', tool_name: 'structure', status: 'error', error_message: err.message, slug: formData.slug });
    }
  };

  // ── Rewrite Selected Section ──
  const handleRewriteSection = async () => {
    if (!editorInstance) {
      toast({ title: 'No editor available', variant: 'destructive' });
      return;
    }
    const { from, to, empty } = editorInstance.state.selection;
    if (empty) {
      toast({ title: 'Select text first', description: 'Highlight a section in the editor to rewrite it.', variant: 'destructive' });
      return;
    }

    const slice = editorInstance.state.doc.slice(from, to);
    const tempEditor = document.createElement('div');
    const { DOMSerializer } = await import('@tiptap/pm/model');
    const serializer = DOMSerializer.fromSchema(editorInstance.schema);
    const domFragment = serializer.serializeFragment(slice.content);
    tempEditor.appendChild(domFragment);
    const htmlContent = tempEditor.innerHTML;

    setToolState('rewriteSection', { isLoading: true, error: null });
    trackBlogToolEvent({ event_name: 'tool_run_started', tool_name: 'rewriteSection', slug: formData.slug });
    try {
      const data = await invokeFunction('improve-blog-content', {
        title: formData.title,
        content: formData.content,
        action: 'rewrite-section',
        selectedHtml: htmlContent,
        category: formData.category || undefined,
        tags: formData.tags || undefined,
      });
      setRewritePreview({ original: htmlContent, rewritten: data.result, from, to });
      setToolState('rewriteSection', { isLoading: false, result: data });
      setResultsOpen(true);
      trackBlogToolEvent({ event_name: 'tool_run_finished', tool_name: 'rewriteSection', status: 'success', item_count: data?.result ? 1 : 0, slug: formData.slug });
    } catch (err: any) {
      setToolState('rewriteSection', { isLoading: false, error: err.message });
      toast({ title: 'Rewrite failed', description: err.message, variant: 'destructive' });
      trackBlogToolEvent({ event_name: 'tool_run_finished', tool_name: 'rewriteSection', status: 'error', error_message: err.message, slug: formData.slug });
    }
  };

  const applyRewrite = () => {
    if (!editorInstance || !rewritePreview) return;
    const beforeVal = rewritePreview.original;
    editorInstance.chain().focus()
      .deleteRange({ from: rewritePreview.from, to: rewritePreview.to })
      .insertContent(rewritePreview.rewritten)
      .run();
    logBlogAiAudit({ tool_name: 'rewriteSection', before_value: beforeVal, after_value: rewritePreview.rewritten, apply_mode: 'review_replacement', slug: formData.slug });
    setRewritePreview(null);
    setToolState('rewriteSection', { isLoading: false, result: null, error: null });
    toast({ title: 'Section replaced successfully' });
  };

  // ── Compliance Fixes ──
  const handleComplianceFixes = async () => {
    if (!currentCompliance) return;
    const failedChecks = currentCompliance.checks.filter(c => c.status === 'fail' || c.status === 'warn');
    if (failedChecks.length === 0) {
      toast({ title: 'No issues to fix!' });
      return;
    }
    setToolState('complianceFixes', { isLoading: true, error: null });
    trackBlogToolEvent({ event_name: 'tool_run_started', tool_name: 'complianceFixes', slug: formData.slug });
    try {
      const data = await invokeFunction('analyze-blog-compliance-fixes', {
        title: formData.title,
        content: formData.content,
        slug: formData.slug,
        issues: failedChecks.map(c => ({ key: c.key, label: c.label, detail: c.detail, recommendation: c.recommendation })),
        existingMeta: {
          meta_title: formData.meta_title || null,
          meta_description: formData.meta_description || null,
          excerpt: formData.excerpt || null,
          featured_image_alt: formData.featured_image_alt || null,
          author_name: formData.author_name || null,
          canonical_url: formData.canonical_url || null,
          hasCoverImage: !!formData.cover_image_url,
          hasIntro: currentMetadata?.hasIntro ?? false,
          hasConclusion: currentMetadata?.hasConclusion ?? false,
          headings: currentMetadata?.headings || [],
          wordCount: currentMetadata?.wordCount || 0,
          featured_image: formData.cover_image_url || null,
          faqCount: existingFaqCount ?? 0,
          internalLinkCount: currentMetadata?.internalLinks?.length ?? 0,
        },
      });
      // Validate/normalize before rendering
      const normalizedFixes = normalizeComplianceFixes(data?.fixes);
      setToolState('complianceFixes', { isLoading: false, result: { fixes: normalizedFixes } });
      setResultsOpen(true);
      trackBlogToolEvent({ event_name: 'tool_run_finished', tool_name: 'complianceFixes', status: 'success', item_count: normalizedFixes.length, slug: formData.slug });
    } catch (err: any) {
      setToolState('complianceFixes', { isLoading: false, error: err.message });
      toast({ title: 'Compliance analysis failed', description: err.message, variant: 'destructive' });
      trackBlogToolEvent({ event_name: 'tool_run_finished', tool_name: 'complianceFixes', status: 'error', error_message: err.message, slug: formData.slug });
    }
  };

  // ── Fix All With AI (editor context) ──
  const handleFixAll = async () => {
    if (!currentCompliance) return;
    setFixAllRunning(true);
    setFixAllResults(null);
    trackBlogToolEvent({ event_name: 'fix_all_started', tool_name: 'fixAll', slug: formData.slug });
    try {
      const failedChecks = currentCompliance.checks.filter(c => c.status === 'fail' || c.status === 'warn');
      if (failedChecks.length === 0) {
        setFixAllResults({ autoFixed: [], reviewRequired: [], unresolved: [{ issueLabel: 'No issues', explanation: 'All checks passed.' }] });
        setFixAllRunning(false);
        return;
      }
      const data = await invokeFunction('analyze-blog-compliance-fixes', {
        title: formData.title, content: formData.content, slug: formData.slug,
        issues: failedChecks.map(c => ({ key: c.key, label: c.label, detail: c.detail, recommendation: c.recommendation })),
        existingMeta: {
          meta_title: formData.meta_title || null, meta_description: formData.meta_description || null,
          excerpt: formData.excerpt || null, featured_image_alt: formData.featured_image_alt || null,
          author_name: formData.author_name || null, canonical_url: formData.canonical_url || null,
          hasCoverImage: !!formData.cover_image_url, hasIntro: currentMetadata?.hasIntro ?? false,
          hasConclusion: currentMetadata?.hasConclusion ?? false, headings: currentMetadata?.headings || [],
          wordCount: currentMetadata?.wordCount || 0, featured_image: formData.cover_image_url || null,
          faqCount: existingFaqCount ?? 0, internalLinkCount: currentMetadata?.internalLinks?.length ?? 0,
        },
      });
      const fixes = normalizeComplianceFixes(data?.fixes);
      const autoFixed: { field: string; value: string }[] = [];
      const reviewRequired: any[] = [];
      const unresolved: any[] = [];

      for (const fix of fixes) {
        const mode = normalizeApplyMode(fix.applyMode);
        if (mode === 'apply_field' && fix.field && EDITABLE_FIELDS.has(fix.field) && fix.suggestedValue) {
          const currentVal = (formData as any)[fix.field] || '';
          if (!currentVal || currentVal.length < 3) {
            onApplyField(fix.field, fix.suggestedValue);
            logBlogAiAudit({ tool_name: 'fixAll', before_value: currentVal, after_value: fix.suggestedValue, apply_mode: mode, target_field: fix.field, slug: formData.slug });
            autoFixed.push({ field: fix.field, value: fix.suggestedValue });
          } else {
            reviewRequired.push(fix);
          }
        } else if (mode === 'advisory' || fix.confidence === 'low') {
          unresolved.push(fix);
        } else {
          // Safe additive content — only if duplicates don't exist
          if (mode === 'insert_before_first_heading' && fix.fixType === 'intro' && editorInstance) {
            if (!hasExistingIntro(formData.content) && !contentBlockAlreadyExists(formData.content, fix.suggestedValue)) {
              insertBeforeFirstHeading(editorInstance, fix.suggestedValue);
              logBlogAiAudit({ tool_name: 'fixAll', before_value: '', after_value: fix.suggestedValue.substring(0, 500), apply_mode: mode, slug: formData.slug });
              autoFixed.push({ field: 'intro', value: 'Introduction added' });
              continue;
            }
          }
          if (mode === 'append_content' && fix.fixType === 'conclusion' && editorInstance) {
            if (!hasExistingConclusion(formData.content) && !contentBlockAlreadyExists(formData.content, fix.suggestedValue)) {
              editorInstance.commands.focus('end');
              editorInstance.commands.insertContent(fix.suggestedValue);
              logBlogAiAudit({ tool_name: 'fixAll', before_value: '', after_value: fix.suggestedValue.substring(0, 500), apply_mode: mode, slug: formData.slug });
              autoFixed.push({ field: 'conclusion', value: 'Conclusion added' });
              continue;
            }
          }
          reviewRequired.push(fix);
        }
      }
      setFixAllResults({ autoFixed, reviewRequired, unresolved });
      setResultsOpen(true);
      trackBlogToolEvent({ event_name: 'fix_all_completed', tool_name: 'fixAll', status: 'success', item_count: autoFixed.length, slug: formData.slug });
    } catch (err: any) {
      toast({ title: 'Fix All failed', description: err.message, variant: 'destructive' });
      trackBlogToolEvent({ event_name: 'fix_all_completed', tool_name: 'fixAll', status: 'error', error_message: err.message, slug: formData.slug });
    }
    setFixAllRunning(false);
  };

  // ── Enrich Article (editor context) ──
  const handleEnrichArticle = async () => {
    setToolState('enrichArticle', { isLoading: true, error: null });
    trackBlogToolEvent({ event_name: 'tool_run_started', tool_name: 'enrichArticle', slug: formData.slug });
    try {
      const data = await invokeFunction('improve-blog-content', {
        title: formData.title, content: formData.content,
        action: 'enrich-article', targetWordCount: enrichWordLimit,
        category: formData.category || undefined, tags: formData.tags || undefined,
      });
      setToolState('enrichArticle', { isLoading: false, result: data });
      setResultsOpen(true);
      trackBlogToolEvent({ event_name: 'tool_run_finished', tool_name: 'enrichArticle', status: 'success', slug: formData.slug });
    } catch (err: any) {
      setToolState('enrichArticle', { isLoading: false, error: err.message });
      toast({ title: 'Enrichment failed', description: err.message, variant: 'destructive' });
      trackBlogToolEvent({ event_name: 'tool_run_finished', tool_name: 'enrichArticle', status: 'error', error_message: err.message, slug: formData.slug });
    }
  };

  const applyEnrichment = () => {
    if (!editorInstance || !tools.enrichArticle.result?.result) return;
    const beforeVal = editorInstance.getHTML();
    editorInstance.commands.setContent(tools.enrichArticle.result.result);
    logBlogAiAudit({ tool_name: 'enrichArticle', before_value: beforeVal.substring(0, 500), after_value: tools.enrichArticle.result.result.substring(0, 500), apply_mode: 'replace_content', slug: formData.slug });
    toast({ title: 'Enrichment applied', description: `Article expanded to ~${tools.enrichArticle.result.wordCount || 'N/A'} words` });
    setToolState('enrichArticle', { isLoading: false, result: null, error: null });
  };


  const applySeoField = (field: string, value: string) => {
    const fieldMap: Record<string, string> = {
      metaTitle: 'meta_title',
      metaDescription: 'meta_description',
      excerpt: 'excerpt',
    };
    const formField = fieldMap[field] || field;
    const beforeVal = (formData as any)[formField] || '';
    onApplyField(formField, value);
    logBlogAiAudit({ tool_name: 'seo', before_value: beforeVal, after_value: value, apply_mode: 'apply_field', target_field: formField, slug: formData.slug });
    toast({ title: `${field} applied` });
  };

  // ── Apply FAQ via editor ──
  const applyFaq = (mode: 'append' | 'replace') => {
    if (!editorInstance || !tools.faq.result?.faqHtml) return;
    // Block duplicate FAQ insertion
    if (mode === 'append' && hasFaqHeading(formData.content) && contentBlockAlreadyExists(formData.content, tools.faq.result.faqHtml)) {
      toast({ title: 'FAQ already exists', description: 'Similar FAQ content already present in the article.', variant: 'destructive' });
      return;
    }
    const beforeVal = editorInstance.getHTML();
    if (mode === 'replace' && hasFaqHeading(formData.content)) {
      const content = editorInstance.getHTML();
      const faqMatch = content.match(/<h[2-3][^>]*>.*(?:FAQ|Frequently Asked Questions).*<\/h[2-3]>/i);
      if (faqMatch && faqMatch.index !== undefined) {
        const beforeFaq = content.substring(0, faqMatch.index);
        editorInstance.commands.setContent(beforeFaq + tools.faq.result.faqHtml);
        toast({ title: 'FAQ section replaced' });
      } else {
        editorInstance.commands.focus('end');
        editorInstance.commands.insertContent(tools.faq.result.faqHtml);
        toast({ title: 'FAQ section appended' });
      }
    } else {
      editorInstance.commands.focus('end');
      editorInstance.commands.insertContent(tools.faq.result.faqHtml);
      toast({ title: 'FAQ section appended' });
    }
    logBlogAiAudit({ tool_name: 'faq', before_value: beforeVal.substring(0, 500), after_value: tools.faq.result.faqHtml.substring(0, 500), apply_mode: mode === 'replace' ? 'replace_section' : 'append_content', slug: formData.slug });
    setToolState('faq', { isLoading: false, result: null, error: null });
  };

  // ── Insert internal link sentence into editor ──
  const insertLinkSentence = (suggestion: any) => {
    if (!editorInstance) {
      toast({ title: 'No editor available', variant: 'destructive' });
      return;
    }
    const sentence = suggestion.sentenceTemplate || `Learn more about <a href="${suggestion.path}">${suggestion.anchorText}</a>.`;
    // Block duplicate
    if (sentenceAlreadyExists(formData.content, sentence)) {
      toast({ title: 'Link already exists', description: 'Similar link sentence already present.', variant: 'destructive' });
      return;
    }
    editorInstance.commands.focus('end');
    editorInstance.commands.insertContent(`<p>${sentence}</p>`);
    logBlogAiAudit({ tool_name: 'internalLinks', before_value: '', after_value: sentence, apply_mode: 'append_content', slug: formData.slug });
    toast({ title: 'Link sentence inserted at end of article' });
  };

  // ── Insert heading scaffold into editor ──
  const insertHeadingScaffold = (outline: string[]) => {
    if (!editorInstance || !outline?.length) return;
    const scaffold = outline.map(h => `<h2>${h}</h2><p>[Add content here]</p>`).join('');
    editorInstance.commands.focus('end');
    editorInstance.commands.insertContent(`<hr><p><strong>— Draft Heading Scaffold —</strong></p>${scaffold}`);
    logBlogAiAudit({ tool_name: 'structure', before_value: '', after_value: scaffold.substring(0, 500), apply_mode: 'append_content', slug: formData.slug });
    toast({ title: 'Heading scaffold appended to article' });
  };

  // ── Apply compliance fix (normalized applyMode branching) ──
  const applyComplianceFix = (fix: any) => {
    if (!fix.suggestedValue) return;

    const mode = normalizeApplyMode(fix.applyMode);
    trackBlogToolEvent({ event_name: 'fix_applied', tool_name: 'complianceFixes', action: fix.issueKey, apply_mode: mode, target: fix.field || undefined, slug: formData.slug });

    if (mode === 'apply_field' && fix.field && EDITABLE_FIELDS.has(fix.field)) {
      // Skip if value already matches
      const currentVal = (formData as any)[fix.field] || '';
      if (currentVal === fix.suggestedValue) {
        toast({ title: 'Already applied', description: `${fix.field} already has this value.` });
        return;
      }
      const beforeVal = currentVal;
      onApplyField(fix.field, fix.suggestedValue);
      logBlogAiAudit({ tool_name: 'complianceFixes', before_value: beforeVal, after_value: fix.suggestedValue, apply_mode: mode, target_field: fix.field, slug: formData.slug });
      toast({ title: `${fix.issueLabel} fixed — ${fix.field} updated` });

    } else if (mode === 'append_content' && editorInstance) {
      if (contentBlockAlreadyExists(formData.content, fix.suggestedValue)) {
        toast({ title: 'Content already exists', description: 'Similar content already present.', variant: 'destructive' });
        return;
      }
      if (fix.fixType === 'conclusion' && hasExistingConclusion(formData.content)) {
        toast({ title: 'Conclusion already exists', description: 'Article already has a conclusion section.', variant: 'destructive' });
        return;
      }
      if (fix.fixType === 'faq' && hasFaqHeading(formData.content)) {
        toast({ title: 'FAQ already exists', description: 'Article already has a FAQ section.', variant: 'destructive' });
        return;
      }
      editorInstance.commands.focus('end');
      editorInstance.commands.insertContent(fix.suggestedValue);
      logBlogAiAudit({ tool_name: 'complianceFixes', before_value: '', after_value: fix.suggestedValue.substring(0, 500), apply_mode: mode, slug: formData.slug });
      toast({ title: `${fix.issueLabel} — content appended` });

    } else if (mode === 'prepend_content' && editorInstance) {
      if (hasExistingIntro(formData.content) && fix.fixType === 'intro') {
        toast({ title: 'Intro already exists', description: 'Article already has an introduction.', variant: 'destructive' });
        return;
      }
      if (contentBlockAlreadyExists(formData.content, fix.suggestedValue)) {
        toast({ title: 'Content already exists', variant: 'destructive' });
        return;
      }
      const content = editorInstance.getHTML();
      editorInstance.commands.setContent(fix.suggestedValue + content);
      logBlogAiAudit({ tool_name: 'complianceFixes', before_value: '', after_value: fix.suggestedValue.substring(0, 500), apply_mode: mode, slug: formData.slug });
      toast({ title: `${fix.issueLabel} — content prepended` });

    } else if (mode === 'insert_before_first_heading' && editorInstance) {
      if (hasExistingIntro(formData.content) && fix.fixType === 'intro') {
        toast({ title: 'Intro already exists', description: 'Article already has an introduction.', variant: 'destructive' });
        return;
      }
      if (contentBlockAlreadyExists(formData.content, fix.suggestedValue)) {
        toast({ title: 'Content already exists', variant: 'destructive' });
        return;
      }
      insertBeforeFirstHeading(editorInstance, fix.suggestedValue);
      logBlogAiAudit({ tool_name: 'complianceFixes', before_value: '', after_value: fix.suggestedValue.substring(0, 500), apply_mode: mode, slug: formData.slug });
      toast({ title: `${fix.issueLabel} — content inserted before heading` });

    } else if ((mode === 'replace_section' || mode === 'review_replacement') && editorInstance) {
      // These are handled via the ComplianceFixCard review UI — no auto-apply
      toast({ title: 'Review the replacement in the card below' });

    } else if (mode === 'advisory') {
      toast({ title: fix.issueLabel, description: fix.explanation || 'Manual review required' });
    }
  };

  const anyLoading = Object.values(tools).some(t => t.isLoading);

  const toolDefs: { key: ToolKey; label: string; icon: React.ReactNode; handler: () => void; disabled: boolean }[] = [
    { key: 'seo', label: 'SEO Metadata', icon: <FileText className="h-3 w-3" />, handler: handleGenerateSEO, disabled: tools.seo.isLoading || !formData.title },
    { key: 'faq', label: 'Generate FAQ', icon: <MessageSquare className="h-3 w-3" />, handler: handleGenerateFAQ, disabled: tools.faq.isLoading || !formData.title },
    { key: 'internalLinks', label: 'Internal Links', icon: <Link2 className="h-3 w-3" />, handler: handleSuggestLinks, disabled: tools.internalLinks.isLoading || !formData.title },
    { key: 'structure', label: 'Improve Structure', icon: <Wrench className="h-3 w-3" />, handler: handleImproveStructure, disabled: tools.structure.isLoading || !formData.content },
    { key: 'rewriteSection', label: 'Rewrite Selection', icon: <RefreshCw className="h-3 w-3" />, handler: handleRewriteSection, disabled: tools.rewriteSection.isLoading || !editorInstance },
    { key: 'complianceFixes', label: 'Fix Compliance', icon: <ShieldCheck className="h-3 w-3" />, handler: handleComplianceFixes, disabled: tools.complianceFixes.isLoading || !currentCompliance },
    { key: 'enrichArticle', label: 'Enrich Article', icon: <Sparkles className="h-3 w-3" />, handler: handleEnrichArticle, disabled: tools.enrichArticle.isLoading || !formData.content },
  ];

  // ── Detect reliable FAQ presence for replace option ──
  const canReplaceFaq = (existingFaqCount || 0) > 0 && hasFaqHeading(formData.content);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <h4 className="text-sm font-semibold">AI Tools</h4>
        {(anyLoading || fixAllRunning) && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
      </div>

      {/* Fix All With AI — prominent button */}
      <Button
        variant="default"
        size="sm"
        className="w-full text-xs gap-1 h-8"
        onClick={handleFixAll}
        disabled={fixAllRunning || !currentCompliance || !formData.title}
      >
        {fixAllRunning ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
        Fix All With AI
      </Button>

      {/* Enrich word limit selector (inline) */}
      <div className="flex items-center gap-1.5">
        <select className="text-[10px] h-6 px-1 border rounded bg-background text-foreground" value={enrichWordLimit} onChange={(e) => setEnrichWordLimit(Number(e.target.value))}>
          <option value={1200}>1200w</option>
          <option value={1500}>1500w</option>
          <option value={1800}>1800w</option>
          <option value={2200}>2200w</option>
        </select>
      </div>

      {/* Tool buttons with status indicators */}
      <div className="space-y-1">
        {toolDefs.map(({ key, label, icon, handler, disabled }) => (
          <div key={key} className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="text-xs gap-1 flex-1 justify-start h-7"
              onClick={handler}
              disabled={disabled}
            >
              {tools[key].isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : icon}
              {label}
            </Button>
            <StatusBadge status={statuses[key]} />
          </div>
        ))}
      </div>

      {/* Results */}
      <Collapsible open={resultsOpen} onOpenChange={setResultsOpen}>
        {Object.values(tools).some(t => t.result) && (
          <CollapsibleTrigger className="flex items-center gap-2 w-full py-1 text-sm font-medium hover:text-primary">
            <ChevronDown className={`h-4 w-4 transition-transform ${resultsOpen ? 'rotate-180' : ''}`} />
            AI Results
          </CollapsibleTrigger>
        )}
        <CollapsibleContent className="space-y-3 mt-2">
          {/* SEO Results */}
          {tools.seo.result && (
            <div className="border rounded-lg p-3 space-y-2">
              <h5 className="text-xs font-semibold flex items-center gap-1"><FileText className="h-3 w-3" /> SEO Metadata</h5>
              {tools.seo.result.metaTitle && (
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] text-muted-foreground">Meta Title</p>
                    <p className="text-xs truncate">{tools.seo.result.metaTitle}</p>
                  </div>
                  <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={() => applySeoField('metaTitle', tools.seo.result.metaTitle)}>
                    <Check className="h-3 w-3" /> Apply
                  </Button>
                </div>
              )}
              {tools.seo.result.metaDescription && (
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] text-muted-foreground">Meta Description ({tools.seo.result.metaDescription.length} chars)</p>
                    <p className="text-xs">{tools.seo.result.metaDescription}</p>
                  </div>
                  <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={() => applySeoField('metaDescription', tools.seo.result.metaDescription)}>
                    <Check className="h-3 w-3" /> Apply
                  </Button>
                </div>
              )}
              {tools.seo.result.excerpt && (
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] text-muted-foreground">Excerpt</p>
                    <p className="text-xs">{tools.seo.result.excerpt}</p>
                  </div>
                  <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={() => applySeoField('excerpt', tools.seo.result.excerpt)}>
                    <Check className="h-3 w-3" /> Apply
                  </Button>
                </div>
              )}
              <Button size="sm" variant="ghost" className="h-5 text-[10px] text-muted-foreground" onClick={() => setToolState('seo', { result: null, isLoading: false, error: null })}>
                <X className="h-3 w-3" /> Dismiss
              </Button>
            </div>
          )}

          {/* FAQ Results */}
          {tools.faq.result && (
            <div className="border rounded-lg p-3 space-y-2">
              <h5 className="text-xs font-semibold flex items-center gap-1"><MessageSquare className="h-3 w-3" /> Generated FAQ ({tools.faq.result.faqs?.length || 0} items)</h5>
              {tools.faq.result.faqs?.map((f: any, i: number) => (
                <div key={i} className="text-xs border-b border-border/30 pb-1.5">
                  <p className="font-medium">{f.question}</p>
                  <p className="text-muted-foreground">{f.answer}</p>
                </div>
              ))}
              <div className="flex gap-2 flex-wrap">
                <Button size="sm" variant="default" className="h-6 text-[10px]" onClick={() => applyFaq('append')} disabled={!editorInstance}>
                  <Plus className="h-3 w-3" /> Append FAQ
                </Button>
                {canReplaceFaq && (
                  <Button size="sm" variant="secondary" className="h-6 text-[10px]" onClick={() => applyFaq('replace')} disabled={!editorInstance}>
                    <RefreshCw className="h-3 w-3" /> Replace FAQ
                  </Button>
                )}
                <Button size="sm" variant="outline" className="h-6 text-[10px]" onClick={() => copyToClipboard(tools.faq.result.faqHtml || '', 'FAQ HTML')}>
                  <Copy className="h-3 w-3" /> Copy FAQ
                </Button>
                <Button size="sm" variant="ghost" className="h-6 text-[10px] text-muted-foreground" onClick={() => setToolState('faq', { result: null, isLoading: false, error: null })}>
                  <X className="h-3 w-3" /> Dismiss
                </Button>
              </div>
            </div>
          )}

          {/* Internal Links Results */}
          {tools.internalLinks.result && (
            <div className="border rounded-lg p-3 space-y-2">
              <h5 className="text-xs font-semibold flex items-center gap-1"><Link2 className="h-3 w-3" /> Suggested Links</h5>
              {tools.internalLinks.result.suggestions?.length === 0 ? (
                <div className="space-y-2">
                  <div className="text-xs text-muted-foreground bg-muted/30 rounded p-2">
                    <p className="font-medium mb-1">No safe page paths could be confirmed for this article.</p>
                    <p>This can happen when the article topic doesn't closely match known site pages. You can:</p>
                    <ul className="list-disc pl-4 mt-1 space-y-0.5">
                      <li>Retry after adding more content or adjusting the title</li>
                      <li>Manually add links to relevant pages like /sarkari-result, /admit-card, /railway-jobs</li>
                      <li>Link to related blog posts using /blog/[slug] format</li>
                    </ul>
                  </div>
                  <Button size="sm" variant="outline" className="h-6 text-[10px]" onClick={handleSuggestLinks}>
                    <RefreshCw className="h-3 w-3" /> Retry
                  </Button>
                </div>
              ) : (
                tools.internalLinks.result.suggestions?.map((s: any, i: number) => (
                  <div key={i} className="text-xs border-b border-border/30 pb-2 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="text-[10px] px-1 py-0 font-mono">{s.path}</Badge>
                      <span className="text-muted-foreground">→ "{s.anchorText}"</span>
                    </div>
                    {s.reason && <p className="text-muted-foreground">{s.reason}</p>}
                    {s.suggestedPlacement && (
                      <p className="text-[10px] text-muted-foreground/70">📍 {s.suggestedPlacement}</p>
                    )}
                    {s.sentenceTemplate && (
                      <div className="bg-muted/30 rounded p-1.5 text-[11px]" dangerouslySetInnerHTML={{ __html: s.sentenceTemplate }} />
                    )}
                    <div className="flex gap-1.5">
                      <Button size="sm" variant="default" className="h-5 text-[10px]" onClick={() => insertLinkSentence(s)} disabled={!editorInstance}>
                        <ArrowRight className="h-2.5 w-2.5" /> Insert Sentence
                      </Button>
                      <Button size="sm" variant="outline" className="h-5 text-[10px]" onClick={() => {
                        const text = (s.sentenceTemplate || `Learn more about ${s.anchorText} at ${s.path}`).replace(/<[^>]+>/g, '');
                        copyToClipboard(text, 'Link sentence');
                      }}>
                        <Copy className="h-2.5 w-2.5" /> Copy
                      </Button>
                    </div>
                  </div>
                ))
              )}
              <Button size="sm" variant="ghost" className="h-5 text-[10px] text-muted-foreground" onClick={() => setToolState('internalLinks', { result: null, isLoading: false, error: null })}>
                <X className="h-3 w-3" /> Dismiss
              </Button>
            </div>
          )}

          {/* Structure Results */}
          {tools.structure.result && (
            <div className="border rounded-lg p-3 space-y-2">
              <h5 className="text-xs font-semibold flex items-center gap-1"><Wrench className="h-3 w-3" /> Structure Suggestions</h5>
              <p className="text-xs text-muted-foreground">{tools.structure.result.result}</p>
              {tools.structure.result.changes?.length > 0 && (
                <div>
                  <p className="text-[10px] font-medium text-muted-foreground mb-1">Changes:</p>
                  {tools.structure.result.changes.map((c: string, i: number) => (
                    <p key={i} className="text-xs flex items-start gap-1">
                      <span className="text-primary">•</span> {c}
                    </p>
                  ))}
                </div>
              )}
              {tools.structure.result.proposedOutline?.length > 0 && (
                <div>
                  <p className="text-[10px] font-medium text-muted-foreground mb-1">Proposed Outline:</p>
                  <ol className="text-xs space-y-0.5 list-decimal pl-4">
                    {tools.structure.result.proposedOutline.map((h: string, i: number) => (
                      <li key={i} className="text-xs">{h}</li>
                    ))}
                  </ol>
                </div>
              )}
              {tools.structure.result.missingSections?.length > 0 && (
                <div>
                  <p className="text-[10px] font-medium text-muted-foreground mb-1">Missing Sections:</p>
                  <div className="flex flex-wrap gap-1">
                    {tools.structure.result.missingSections.map((s: string, i: number) => (
                      <Badge key={i} variant="secondary" className="text-[10px] px-1.5 py-0">{s}</Badge>
                    ))}
                  </div>
                </div>
              )}
              {/* Suggested Insertions */}
              {Array.isArray(tools.structure.result.suggestedInsertions) && tools.structure.result.suggestedInsertions.length > 0 && (
                <div>
                  <p className="text-[10px] font-medium text-muted-foreground mb-1">Suggested Insertions:</p>
                  {tools.structure.result.suggestedInsertions.map((ins: any, i: number) => (
                    <div key={i} className="text-xs border-b border-border/30 pb-1.5 space-y-1">
                      <p className="font-medium">{ins.label}</p>
                      {ins.suggestedPlacement && <p className="text-[10px] text-muted-foreground">📍 {ins.suggestedPlacement}</p>}
                      <div className="bg-muted/30 rounded p-1.5 max-h-20 overflow-y-auto text-[11px]" dangerouslySetInnerHTML={{ __html: ins.content || '' }} />
                      <Button size="sm" variant="default" className="h-5 text-[10px]" disabled={!editorInstance} onClick={() => {
                        if (!editorInstance || !ins.content) return;
                        const am = normalizeApplyMode(ins.applyMode);
                        if (am === 'insert_before_first_heading') {
                          insertBeforeFirstHeading(editorInstance, ins.content);
                        } else if (am === 'prepend_content') {
                          editorInstance.commands.setContent(ins.content + editorInstance.getHTML());
                        } else {
                          editorInstance.commands.focus('end');
                          editorInstance.commands.insertContent(ins.content);
                        }
                        logBlogAiAudit({ tool_name: 'structure', before_value: '', after_value: ins.content.substring(0, 500), apply_mode: am, slug: formData.slug });
                        toast({ title: `${ins.label} inserted` });
                      }}>
                        <Plus className="h-2.5 w-2.5" /> Insert
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-2 flex-wrap">
                {tools.structure.result.proposedOutline?.length > 0 && (
                  <>
                    <Button size="sm" variant="default" className="h-6 text-[10px]" onClick={() => insertHeadingScaffold(tools.structure.result.proposedOutline)} disabled={!editorInstance}>
                      <Plus className="h-3 w-3" /> Insert Scaffold
                    </Button>
                    <Button size="sm" variant="outline" className="h-6 text-[10px]" onClick={() => copyToClipboard(tools.structure.result.proposedOutline.join('\n'), 'Outline')}>
                      <Copy className="h-3 w-3" /> Copy Outline
                    </Button>
                  </>
                )}
                <Button size="sm" variant="ghost" className="h-5 text-[10px] text-muted-foreground" onClick={() => setToolState('structure', { result: null, isLoading: false, error: null })}>
                  <X className="h-3 w-3" /> Dismiss
                </Button>
              </div>
            </div>
          )}

          {/* Rewrite Preview */}
          {rewritePreview && (
            <div className="border rounded-lg p-3 space-y-2 border-primary/30">
              <h5 className="text-xs font-semibold flex items-center gap-1"><RefreshCw className="h-3 w-3" /> Rewrite Preview</h5>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1">Original</p>
                  <div className="text-xs border rounded p-2 bg-muted/30 max-h-40 overflow-y-auto" dangerouslySetInnerHTML={{ __html: rewritePreview.original }} />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1">Rewritten</p>
                  <div className="text-xs border rounded p-2 bg-primary/5 max-h-40 overflow-y-auto" dangerouslySetInnerHTML={{ __html: rewritePreview.rewritten }} />
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="default" className="h-6 text-[10px]" onClick={applyRewrite}>
                  <Check className="h-3 w-3" /> Replace Selection
                </Button>
                <Button size="sm" variant="ghost" className="h-6 text-[10px] text-muted-foreground" onClick={() => { setRewritePreview(null); setToolState('rewriteSection', { result: null, isLoading: false, error: null }); }}>
                  <X className="h-3 w-3" /> Cancel
                </Button>
              </div>
            </div>
          )}

          {/* Compliance Fixes Results */}
          {tools.complianceFixes.result && (
            <div className="border rounded-lg p-3 space-y-2">
              <h5 className="text-xs font-semibold flex items-center gap-1"><ShieldCheck className="h-3 w-3" /> Compliance Fixes</h5>
              {(tools.complianceFixes.result.fixes || []).map((f: any, i: number) => (
                <ComplianceFixCard
                  key={i}
                  fix={f}
                  onApply={() => applyComplianceFix(f)}
                  onCopy={() => copyToClipboard(f.suggestedValue || f.explanation, f.issueLabel)}
                  onInsertContent={() => {
                    if (editorInstance && f.suggestedValue) {
                      const mode = normalizeApplyMode(f.applyMode);
                      if (mode === 'insert_before_first_heading') {
                        if (hasExistingIntro(formData.content) && f.fixType === 'intro') {
                          toast({ title: 'Intro already exists', variant: 'destructive' });
                          return;
                        }
                        insertBeforeFirstHeading(editorInstance, f.suggestedValue);
                        logBlogAiAudit({ tool_name: 'complianceFixes', before_value: '', after_value: f.suggestedValue.substring(0, 500), apply_mode: mode, slug: formData.slug });
                        toast({ title: `${f.issueLabel} — content inserted` });
                      } else if (mode === 'prepend_content') {
                        const content = editorInstance.getHTML();
                        editorInstance.commands.setContent(f.suggestedValue + content);
                        logBlogAiAudit({ tool_name: 'complianceFixes', before_value: '', after_value: f.suggestedValue.substring(0, 500), apply_mode: mode, slug: formData.slug });
                        toast({ title: `${f.issueLabel} — content prepended` });
                      } else {
                        editorInstance.commands.focus('end');
                        editorInstance.commands.insertContent(f.suggestedValue);
                        logBlogAiAudit({ tool_name: 'complianceFixes', before_value: '', after_value: f.suggestedValue.substring(0, 500), apply_mode: mode, slug: formData.slug });
                        toast({ title: `${f.issueLabel} — content appended` });
                      }
                    }
                  }}
                  editorAvailable={!!editorInstance}
                />
              ))}
              {(!tools.complianceFixes.result.fixes || tools.complianceFixes.result.fixes.length === 0) && (
                <p className="text-xs text-muted-foreground">No structured fixes could be generated. Review the compliance checklist manually.</p>
              )}
              <Button size="sm" variant="ghost" className="h-5 text-[10px] text-muted-foreground" onClick={() => setToolState('complianceFixes', { result: null, isLoading: false, error: null })}>
                <X className="h-3 w-3" /> Dismiss
              </Button>
            </div>
          )}

          {/* Fix All Results */}
          {fixAllResults && (
            <div className="border rounded-lg p-3 space-y-2 border-primary/30">
              <h5 className="text-xs font-semibold flex items-center gap-1"><Sparkles className="h-3 w-3" /> Fix All Results</h5>
              {fixAllResults.autoFixed.length > 0 && (
                <div className="space-y-1">
                  <p className="text-[10px] font-medium text-green-700 dark:text-green-400 flex items-center gap-1"><CheckCircle2 className="h-2.5 w-2.5" /> Auto-Fixed ({fixAllResults.autoFixed.length})</p>
                  {fixAllResults.autoFixed.map((f, i) => (
                    <p key={i} className="text-[10px] bg-green-500/10 rounded px-1.5 py-0.5">{f.field}: {f.value.substring(0, 60)}</p>
                  ))}
                </div>
              )}
              {fixAllResults.reviewRequired.length > 0 && (
                <div className="space-y-1">
                  <p className="text-[10px] font-medium text-yellow-700 dark:text-yellow-400 flex items-center gap-1"><AlertTriangle className="h-2.5 w-2.5" /> Review Required ({fixAllResults.reviewRequired.length})</p>
                  {fixAllResults.reviewRequired.map((f: any, i: number) => (
                    <p key={i} className="text-[10px] bg-yellow-500/10 rounded px-1.5 py-0.5">{f.issueLabel}: {f.explanation?.substring(0, 80)}</p>
                  ))}
                </div>
              )}
              {fixAllResults.unresolved.length > 0 && (
                <div className="space-y-1">
                  <p className="text-[10px] font-medium text-muted-foreground">Unresolved ({fixAllResults.unresolved.length})</p>
                  {fixAllResults.unresolved.map((f: any, i: number) => (
                    <p key={i} className="text-[10px] text-muted-foreground bg-muted/50 rounded px-1.5 py-0.5">{f.issueLabel}: {f.explanation}</p>
                  ))}
                </div>
              )}
              <Button size="sm" variant="ghost" className="h-5 text-[10px] text-muted-foreground" onClick={() => setFixAllResults(null)}>
                <X className="h-3 w-3" /> Dismiss
              </Button>
            </div>
          )}

          {/* Enrich Article Results */}
          {tools.enrichArticle.result && (
            <div className="border rounded-lg p-3 space-y-2 border-primary/30">
              <h5 className="text-xs font-semibold flex items-center gap-1"><Sparkles className="h-3 w-3" /> Enriched Preview (~{tools.enrichArticle.result.wordCount || '?'} words)</h5>
              {tools.enrichArticle.result.changes?.length > 0 && (
                <div className="text-[10px] space-y-0.5">
                  {tools.enrichArticle.result.changes.map((c: string, i: number) => <p key={i} className="text-muted-foreground">• {c}</p>)}
                </div>
              )}
              <div className="max-h-48 overflow-y-auto border rounded p-2 bg-muted/20 text-xs" dangerouslySetInnerHTML={{ __html: tools.enrichArticle.result.result?.substring(0, 3000) || '' }} />
              <div className="flex gap-2">
                <Button size="sm" variant="default" className="h-6 text-[10px]" onClick={applyEnrichment} disabled={!editorInstance}>
                  <Check className="h-3 w-3" /> Apply Enrichment
                </Button>
                <Button size="sm" variant="ghost" className="h-5 text-[10px] text-muted-foreground" onClick={() => setToolState('enrichArticle', { result: null, isLoading: false, error: null })}>
                  <X className="h-3 w-3" /> Discard
                </Button>
              </div>
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

// ── Compliance Fix Card component ──
function ComplianceFixCard({ fix, onApply, onCopy, onInsertContent, editorAvailable }: {
  fix: any;
  onApply: () => void;
  onCopy: () => void;
  onInsertContent: () => void;
  editorAvailable: boolean;
}) {
  const [showReview, setShowReview] = useState(false);

  const mode = normalizeApplyMode(fix.applyMode);
  const priorityVariant = fix.priority === 'high' ? 'destructive' : fix.priority === 'medium' ? 'secondary' : 'outline';
  const isApplyable = (fix.fixType === 'metadata' || mode === 'apply_field') && fix.field && EDITABLE_FIELDS.has(fix.field) && fix.suggestedValue;
  const isAppendable = mode === 'append_content' && fix.suggestedValue;
  const isInsertable = (mode === 'prepend_content' || mode === 'insert_before_first_heading') && fix.suggestedValue;
  const isRewritable = (mode === 'replace_section' || mode === 'review_replacement') && fix.suggestedValue;
  const isAdvisory = mode === 'advisory';

  return (
    <div className="text-xs border-b border-border/30 pb-2 space-y-1">
      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant={priorityVariant} className="text-[10px] px-1 py-0">{fix.priority}</Badge>
        <span className="font-medium">{fix.issueLabel}</span>
        {fix.fixType !== 'advisory' && (
          <Badge variant="outline" className="text-[9px] px-1 py-0">{fix.fixType}</Badge>
        )}
        {fix.confidence && fix.confidence !== 'medium' && (
          <Badge variant="outline" className={`text-[9px] px-1 py-0 ${fix.confidence === 'high' ? 'border-green-500/50 text-green-700 dark:text-green-400' : 'border-orange-500/50 text-orange-700 dark:text-orange-400'}`}>
            {fix.confidence} confidence
          </Badge>
        )}
      </div>
      <p className="text-muted-foreground">{fix.explanation}</p>

      {/* Show suggested value preview for metadata */}
      {isApplyable && (
        <div className="bg-muted/30 rounded p-1.5">
          <p className="text-[10px] text-muted-foreground">{fix.field}:</p>
          <p className="text-[11px] font-medium">{fix.suggestedValue}</p>
        </div>
      )}

      {/* Show content block preview for append/insert */}
      {(isAppendable || isInsertable) && !isApplyable && (
        <div className="bg-muted/30 rounded p-1.5 max-h-24 overflow-y-auto">
          <p className="text-[10px] text-muted-foreground mb-1">
            {mode === 'insert_before_first_heading' ? 'Insert before heading:' : mode === 'prepend_content' ? 'Prepend to content:' : 'Content to append:'}
          </p>
          <div className="text-[11px]" dangerouslySetInnerHTML={{ __html: fix.suggestedValue }} />
        </div>
      )}

      {/* Show rewrite review */}
      {isRewritable && !showReview && (
        <Button size="sm" variant="outline" className="h-5 text-[10px]" onClick={() => setShowReview(true)}>
          Review Replacement
        </Button>
      )}
      {isRewritable && showReview && (
        <div className="space-y-1">
          {fix.targetSnippet && (
            <div>
              <p className="text-[10px] text-muted-foreground">Original:</p>
              <div className="bg-destructive/5 rounded p-1.5 text-[11px] max-h-20 overflow-y-auto" dangerouslySetInnerHTML={{ __html: fix.targetSnippet }} />
            </div>
          )}
          <div>
            <p className="text-[10px] text-muted-foreground">Suggested:</p>
            <div className="bg-primary/5 rounded p-1.5 text-[11px] max-h-20 overflow-y-auto" dangerouslySetInnerHTML={{ __html: fix.suggestedValue }} />
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-1.5 flex-wrap">
        {isApplyable && (
          <Button size="sm" variant="default" className="h-5 text-[10px]" onClick={onApply}>
            <Check className="h-2.5 w-2.5" /> Apply to Field
          </Button>
        )}
        {isInsertable && !isApplyable && (
          <Button size="sm" variant="default" className="h-5 text-[10px]" onClick={onInsertContent} disabled={!editorAvailable}>
            <Plus className="h-2.5 w-2.5" /> {mode === 'insert_before_first_heading' ? 'Insert Before Heading' : 'Insert'}
          </Button>
        )}
        {isAppendable && !isApplyable && !isInsertable && (
          <Button size="sm" variant="default" className="h-5 text-[10px]" onClick={onInsertContent} disabled={!editorAvailable}>
            <Plus className="h-2.5 w-2.5" /> Append to Content
          </Button>
        )}
        {fix.suggestedValue && !isAdvisory && (
          <Button size="sm" variant="outline" className="h-5 text-[10px]" onClick={onCopy}>
            <Copy className="h-2.5 w-2.5" /> Copy
          </Button>
        )}
        {isAdvisory && !isApplyable && !isAppendable && !isInsertable && (
          <span className="text-[10px] text-muted-foreground italic">Manual review required</span>
        )}
      </div>
    </div>
  );
}
