import { useState, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { filterValidInternalLinks } from '@/lib/blogLinkValidator';
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

type ToolKey = 'seo' | 'faq' | 'internalLinks' | 'structure' | 'rewriteSection' | 'complianceFixes';

// ── Editable fields whitelist (must match server-side) ──
const EDITABLE_FIELDS = new Set(['meta_title', 'meta_description', 'excerpt', 'featured_image_alt', 'author_name']);

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
  });
  const [rewritePreview, setRewritePreview] = useState<{ original: string; rewritten: string; from: number; to: number } | null>(null);
  const [resultsOpen, setResultsOpen] = useState(false);

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
    } catch (err: any) {
      setToolState('seo', { isLoading: false, error: err.message });
      toast({ title: 'SEO generation failed', description: err.message, variant: 'destructive' });
    }
  };

  // ── Generate FAQ ──
  const handleGenerateFAQ = async () => {
    const faqCount = existingFaqCount || 0;
    setToolState('faq', { isLoading: true, error: null });
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
    } catch (err: any) {
      setToolState('faq', { isLoading: false, error: err.message });
      toast({ title: 'FAQ generation failed', description: err.message, variant: 'destructive' });
    }
  };

  // ── Suggest Internal Links ──
  const handleSuggestLinks = async () => {
    setToolState('internalLinks', { isLoading: true, error: null });
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
    } catch (err: any) {
      setToolState('internalLinks', { isLoading: false, error: err.message });
      toast({ title: 'Link suggestions failed', description: err.message, variant: 'destructive' });
    }
  };

  // ── Improve Structure ──
  const handleImproveStructure = async () => {
    setToolState('structure', { isLoading: true, error: null });
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
    } catch (err: any) {
      setToolState('structure', { isLoading: false, error: err.message });
      toast({ title: 'Structure analysis failed', description: err.message, variant: 'destructive' });
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
    } catch (err: any) {
      setToolState('rewriteSection', { isLoading: false, error: err.message });
      toast({ title: 'Rewrite failed', description: err.message, variant: 'destructive' });
    }
  };

  const applyRewrite = () => {
    if (!editorInstance || !rewritePreview) return;
    editorInstance.chain().focus()
      .deleteRange({ from: rewritePreview.from, to: rewritePreview.to })
      .insertContent(rewritePreview.rewritten)
      .run();
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
          hasCoverImage: !!formData.cover_image_url,
          faqCount: existingFaqCount ?? 0,
          internalLinkCount: currentMetadata?.internalLinks?.length ?? 0,
        },
      });
      setToolState('complianceFixes', { isLoading: false, result: data });
      setResultsOpen(true);
    } catch (err: any) {
      setToolState('complianceFixes', { isLoading: false, error: err.message });
      toast({ title: 'Compliance analysis failed', description: err.message, variant: 'destructive' });
    }
  };

  // ── Apply SEO field ──
  const applySeoField = (field: string, value: string) => {
    const fieldMap: Record<string, string> = {
      metaTitle: 'meta_title',
      metaDescription: 'meta_description',
      excerpt: 'excerpt',
    };
    const formField = fieldMap[field] || field;
    onApplyField(formField, value);
    toast({ title: `${field} applied` });
  };

  // ── Apply FAQ via editor ──
  const applyFaq = (mode: 'append' | 'replace') => {
    if (!editorInstance || !tools.faq.result?.faqHtml) return;
    if (mode === 'replace' && hasFaqHeading(formData.content)) {
      // Replace: remove from FAQ heading to end, then append new
      const content = editorInstance.getHTML();
      const faqMatch = content.match(/<h[2-3][^>]*>.*(?:FAQ|Frequently Asked Questions).*<\/h[2-3]>/i);
      if (faqMatch && faqMatch.index !== undefined) {
        const beforeFaq = content.substring(0, faqMatch.index);
        editorInstance.commands.setContent(beforeFaq + tools.faq.result.faqHtml);
        toast({ title: 'FAQ section replaced' });
      } else {
        // Fallback: append
        editorInstance.commands.focus('end');
        editorInstance.commands.insertContent(tools.faq.result.faqHtml);
        toast({ title: 'FAQ section appended' });
      }
    } else {
      editorInstance.commands.focus('end');
      editorInstance.commands.insertContent(tools.faq.result.faqHtml);
      toast({ title: 'FAQ section appended' });
    }
    setToolState('faq', { isLoading: false, result: null, error: null });
  };

  // ── Insert internal link sentence into editor ──
  const insertLinkSentence = (suggestion: any) => {
    if (!editorInstance) {
      toast({ title: 'No editor available', variant: 'destructive' });
      return;
    }
    const sentence = suggestion.sentenceTemplate || `Learn more about <a href="${suggestion.path}">${suggestion.anchorText}</a>.`;
    editorInstance.commands.focus('end');
    editorInstance.commands.insertContent(`<p>${sentence}</p>`);
    toast({ title: 'Link sentence inserted at end of article' });
  };

  // ── Insert heading scaffold into editor ──
  const insertHeadingScaffold = (outline: string[]) => {
    if (!editorInstance || !outline?.length) return;
    const scaffold = outline.map(h => `<h2>${h}</h2><p>[Add content here]</p>`).join('');
    editorInstance.commands.focus('end');
    editorInstance.commands.insertContent(`<hr><p><strong>— Draft Heading Scaffold —</strong></p>${scaffold}`);
    toast({ title: 'Heading scaffold appended to article' });
  };

  // ── Apply compliance fix ──
  const applyComplianceFix = (fix: any) => {
    if (!fix.suggestedValue) return;

    if (fix.fixType === 'metadata' && fix.field && EDITABLE_FIELDS.has(fix.field)) {
      onApplyField(fix.field, fix.suggestedValue);
      toast({ title: `${fix.issueLabel} fixed — ${fix.field} updated` });
    } else if (fix.fixType === 'content-block' && fix.applyMode === 'append' && editorInstance) {
      editorInstance.commands.focus('end');
      editorInstance.commands.insertContent(fix.suggestedValue);
      toast({ title: `${fix.issueLabel} — content appended` });
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
  ];

  // ── Detect reliable FAQ presence for replace option ──
  const canReplaceFaq = (existingFaqCount || 0) > 0 && hasFaqHeading(formData.content);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <h4 className="text-sm font-semibold">AI Tools</h4>
        {anyLoading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
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
                      editorInstance.commands.focus('end');
                      editorInstance.commands.insertContent(f.suggestedValue);
                      toast({ title: `${f.issueLabel} — content appended` });
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

  const priorityVariant = fix.priority === 'high' ? 'destructive' : fix.priority === 'medium' ? 'secondary' : 'outline';
  const isApplyable = fix.fixType === 'metadata' && fix.field && EDITABLE_FIELDS.has(fix.field) && fix.suggestedValue;
  const isAppendable = fix.fixType === 'content-block' && fix.applyMode === 'append' && fix.suggestedValue;
  const isRewritable = fix.fixType === 'rewrite' && fix.applyMode === 'review-and-replace' && fix.suggestedValue;
  const isAdvisory = fix.fixType === 'advisory' || fix.applyMode === 'manual';

  return (
    <div className="text-xs border-b border-border/30 pb-2 space-y-1">
      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant={priorityVariant} className="text-[10px] px-1 py-0">{fix.priority}</Badge>
        <span className="font-medium">{fix.issueLabel}</span>
        {fix.fixType !== 'advisory' && (
          <Badge variant="outline" className="text-[9px] px-1 py-0">{fix.fixType}</Badge>
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

      {/* Show content block preview */}
      {isAppendable && (
        <div className="bg-muted/30 rounded p-1.5 max-h-24 overflow-y-auto">
          <p className="text-[10px] text-muted-foreground mb-1">Content to append:</p>
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
        {isAppendable && (
          <Button size="sm" variant="default" className="h-5 text-[10px]" onClick={onInsertContent} disabled={!editorAvailable}>
            <Plus className="h-2.5 w-2.5" /> Append to Content
          </Button>
        )}
        {fix.suggestedValue && !isAdvisory && (
          <Button size="sm" variant="outline" className="h-5 text-[10px]" onClick={onCopy}>
            <Copy className="h-2.5 w-2.5" /> Copy
          </Button>
        )}
        {isAdvisory && !isApplyable && !isAppendable && (
          <span className="text-[10px] text-muted-foreground italic">Manual review required</span>
        )}
      </div>
    </div>
  );
}
