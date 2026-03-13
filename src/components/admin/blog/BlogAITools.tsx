import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Sparkles, FileText, MessageSquare, Link2, Wrench, ShieldCheck,
  ImageIcon, RefreshCw, Loader2, ChevronDown, Check, X, AlertTriangle,
} from 'lucide-react';
import type { Editor } from '@tiptap/react';
import type { PublishComplianceReport } from '@/lib/blogComplianceAnalyzer';

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
  };
  onApplyField: (field: string, value: string) => void;
  editorInstance: Editor | null;
  currentCompliance: PublishComplianceReport | null;
  existingFaqCount?: number;
}

interface ToolState {
  isLoading: boolean;
  result: any;
  error: string | null;
}

type ToolKey = 'seo' | 'faq' | 'internalLinks' | 'structure' | 'rewriteSection' | 'complianceFixes';

export function BlogAITools({ formData, onApplyField, editorInstance, currentCompliance, existingFaqCount }: BlogAIToolsProps) {
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

  const invokeFunction = useCallback(async (functionName: string, body: any) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');

    const { data, error } = await supabase.functions.invoke(functionName, { body });
    if (error) throw new Error(error.message);
    return data;
  }, []);

  // ── Generate SEO Metadata ──
  const handleGenerateSEO = async () => {
    setToolState('seo', { isLoading: true, error: null });
    try {
      const data = await invokeFunction('generate-blog-seo', {
        title: formData.title,
        content: formData.content,
        fields: ['metaTitle', 'metaDescription', 'excerpt'],
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
    // Check existing FAQ section
    const faqCount = existingFaqCount || 0;
    setToolState('faq', { isLoading: true, error: null });
    try {
      const data = await invokeFunction('generate-blog-faq', {
        title: formData.title,
        content: formData.content,
        existingFaqCount: faqCount,
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
      });
      setToolState('internalLinks', { isLoading: false, result: data });
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

    // Extract selected HTML
    const slice = editorInstance.state.doc.slice(from, to);
    const div = document.createElement('div');
    const fragment = (editorInstance.view.domSerializer || (editorInstance as any).view.domSerializer)
      ? undefined : undefined;
    // Use a simpler approach to get HTML from the selection
    const selectedHtml = editorInstance.state.doc.textBetween(from, to, '\n');
    // Actually get HTML properly
    const tempDiv = document.createElement('div');
    const serializer = (await import('@tiptap/pm/model')).DOMSerializer.fromSchema(editorInstance.schema);
    const domFragment = serializer.serializeFragment(slice.content);
    tempDiv.appendChild(domFragment);
    const htmlContent = tempDiv.innerHTML;

    setToolState('rewriteSection', { isLoading: true, error: null });
    try {
      const data = await invokeFunction('improve-blog-content', {
        title: formData.title,
        content: formData.content,
        action: 'rewrite-section',
        selectedHtml: htmlContent,
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
        issues: failedChecks.map(c => ({ key: c.key, label: c.label, detail: c.detail, recommendation: c.recommendation })),
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

  // ── Apply FAQ via editor (not stale formData) ──
  const applyFaq = () => {
    if (!editorInstance || !tools.faq.result?.faqHtml) return;
    // Move cursor to end then insert
    editorInstance.commands.focus('end');
    editorInstance.commands.insertContent(tools.faq.result.faqHtml);
    toast({ title: 'FAQ section appended' });
  };

  const anyLoading = Object.values(tools).some(t => t.isLoading);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <h4 className="text-sm font-semibold">AI Tools</h4>
        {anyLoading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
      </div>

      {/* Tool buttons */}
      <div className="flex flex-wrap gap-1.5">
        <Button variant="outline" size="sm" className="text-xs gap-1" onClick={handleGenerateSEO} disabled={tools.seo.isLoading || !formData.title}>
          {tools.seo.isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <FileText className="h-3 w-3" />}
          SEO Metadata
        </Button>
        <Button variant="outline" size="sm" className="text-xs gap-1" onClick={handleGenerateFAQ} disabled={tools.faq.isLoading || !formData.title}>
          {tools.faq.isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <MessageSquare className="h-3 w-3" />}
          Generate FAQ
        </Button>
        <Button variant="outline" size="sm" className="text-xs gap-1" onClick={handleSuggestLinks} disabled={tools.internalLinks.isLoading || !formData.title}>
          {tools.internalLinks.isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Link2 className="h-3 w-3" />}
          Internal Links
        </Button>
        <Button variant="outline" size="sm" className="text-xs gap-1" onClick={handleImproveStructure} disabled={tools.structure.isLoading || !formData.content}>
          {tools.structure.isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wrench className="h-3 w-3" />}
          Improve Structure
        </Button>
        <Button variant="outline" size="sm" className="text-xs gap-1" onClick={handleRewriteSection} disabled={tools.rewriteSection.isLoading || !editorInstance}>
          {tools.rewriteSection.isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
          Rewrite Selection
        </Button>
        <Button variant="outline" size="sm" className="text-xs gap-1" onClick={handleComplianceFixes} disabled={tools.complianceFixes.isLoading || !currentCompliance}>
          {tools.complianceFixes.isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <ShieldCheck className="h-3 w-3" />}
          Fix Compliance
        </Button>
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
              <div className="flex gap-2">
                <Button size="sm" variant="default" className="h-6 text-[10px]" onClick={applyFaq} disabled={!editorInstance}>
                  <Check className="h-3 w-3" /> Append FAQ
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
              {tools.internalLinks.result.suggestions?.map((s: any, i: number) => (
                <div key={i} className="text-xs border-b border-border/30 pb-1.5">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px] px-1 py-0 font-mono">{s.path}</Badge>
                  </div>
                  <p className="text-muted-foreground">Anchor: "{s.anchorText}" — {s.reason}</p>
                </div>
              ))}
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
              {tools.structure.result.changes?.map((c: string, i: number) => (
                <p key={i} className="text-xs flex items-start gap-1">
                  <span className="text-primary">•</span> {c}
                </p>
              ))}
              <Button size="sm" variant="ghost" className="h-5 text-[10px] text-muted-foreground" onClick={() => setToolState('structure', { result: null, isLoading: false, error: null })}>
                <X className="h-3 w-3" /> Dismiss
              </Button>
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
              <h5 className="text-xs font-semibold flex items-center gap-1"><ShieldCheck className="h-3 w-3" /> Compliance Fix Suggestions</h5>
              {tools.complianceFixes.result.fixes?.map((f: any, i: number) => (
                <div key={i} className="text-xs border-b border-border/30 pb-1.5">
                  <div className="flex items-center gap-2">
                    <Badge variant={f.priority === 'high' ? 'destructive' : f.priority === 'medium' ? 'secondary' : 'outline'} className="text-[10px] px-1 py-0">
                      {f.priority}
                    </Badge>
                    <span className="font-medium">{f.issue}</span>
                  </div>
                  <p className="text-muted-foreground mt-0.5">{f.suggestion}</p>
                </div>
              ))}
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
