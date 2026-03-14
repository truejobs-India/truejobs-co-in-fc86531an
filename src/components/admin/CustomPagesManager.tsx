import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { AiModelSelector } from '@/components/admin/AiModelSelector';
import { getModelDef, getModelSpeed } from '@/lib/aiModels';
import { scoreCustomPage, scoreColor, scoreBgColor, type QualityBreakdown } from '@/lib/pageQualityScorer';
import { useAdminToast as useToast } from '@/contexts/AdminMessagesContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import {
  Plus, Sparkles, Loader2, Pencil, Trash2, Search,
  ChevronLeft, ChevronRight, CheckCircle, XCircle,
  Globe, Copy, Square, Wand2, Clock, RotateCcw,
  BarChart3, FileText, Zap, Eye
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

interface CustomPage {
  id: string;
  title: string;
  slug: string;
  content: string;
  excerpt: string | null;
  meta_title: string | null;
  meta_description: string | null;
  category: string | null;
  tags: string[] | null;
  faq_schema: any;
  page_type: string;
  status: string;
  is_published: boolean;
  published_at: string | null;
  word_count: number;
  ai_model_used: string | null;
  ai_generated_at: string | null;
  created_at: string;
  updated_at: string;
}

interface BulkItem {
  topic: string;
  status: 'queued' | 'generating' | 'success' | 'failed' | 're-enriching';
  error?: string;
  pageId?: string;
  quality?: QualityBreakdown;
  page?: Partial<CustomPage>;
}

const PAGE_SIZE = 20;

// ═══════════════════════════════════════════════════════════════
// Quality Score Indicator component
// ═══════════════════════════════════════════════════════════════

function QualityIndicator({ quality, compact }: { quality: QualityBreakdown; compact?: boolean }) {
  const color = scoreColor(quality.score);
  const bg = scoreBgColor(quality.score);

  if (compact) {
    return (
      <div className="flex items-center gap-1.5">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white ${bg}`}>
          {quality.score}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white ${bg}`}>
          {quality.score}
        </div>
        <div>
          <span className={`text-sm font-semibold capitalize ${color}`}>{quality.grade}</span>
          <span className="text-xs text-muted-foreground block">{quality.wordCount} words</span>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-[10px]">
        <span>Meta Title: {quality.metaTitleScore}/15</span>
        <span>Meta Desc: {quality.metaDescScore}/15</span>
        <span>Content: {quality.contentScore}/30</span>
        <span>Structure: {quality.structureScore}/20</span>
        <span>FAQs ({quality.faqCount}): {quality.faqScore}/10</span>
        <span>Tags: {quality.tagScore}/5</span>
      </div>
      {quality.issues.length > 0 && (
        <div className="text-[10px] text-destructive space-y-0.5 max-h-20 overflow-y-auto">
          {quality.issues.map((issue, i) => (
            <div key={i} className="flex items-start gap-1">
              <XCircle className="h-2.5 w-2.5 mt-0.5 shrink-0" />
              <span>{issue}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════════════════

export function CustomPagesManager() {
  const { toast } = useToast();
  const { user } = useAuth();

  // List state
  const [pages, setPages] = useState<CustomPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [pageNum, setPageNum] = useState(0);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // View mode: 'list' or 'bulk'
  const [viewMode, setViewMode] = useState<'list' | 'bulk'>('list');

  // Editor state
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingPage, setEditingPage] = useState<CustomPage | null>(null);
  const [form, setForm] = useState({ title: '', slug: '', content: '', excerpt: '', meta_title: '', meta_description: '', category: 'general', tags: '', page_type: 'landing' });
  const [saving, setSaving] = useState(false);
  const [editorQuality, setEditorQuality] = useState<QualityBreakdown | null>(null);

  // AI state
  const [aiModel, setAiModel] = useState('gemini-flash');
  const [generating, setGenerating] = useState(false);
  const [generateTopic, setGenerateTopic] = useState('');

  // AI improve results
  const [improveResults, setImproveResults] = useState<any>(null);

  // Bulk state
  const [bulkTopics, setBulkTopics] = useState('');
  const [bulkItems, setBulkItems] = useState<BulkItem[]>([]);
  const [isBulkRunning, setIsBulkRunning] = useState(false);
  const bulkAbortRef = useRef(false);

  // ── Load pages ──
  const loadPages = useCallback(async () => {
    setLoading(true);
    let query = supabase.from('custom_pages').select('*', { count: 'exact' });
    if (search) query = query.or(`title.ilike.%${search}%,slug.ilike.%${search}%`);
    if (statusFilter !== 'all') query = query.eq('status', statusFilter);
    query = query.order('created_at', { ascending: false }).range(pageNum * PAGE_SIZE, (pageNum + 1) * PAGE_SIZE - 1);
    const { data, count, error } = await query;
    if (error) toast({ title: 'Error loading pages', description: error.message, variant: 'destructive' });
    setPages((data as unknown as CustomPage[]) || []);
    setTotal(count || 0);
    setLoading(false);
  }, [search, statusFilter, pageNum, toast]);

  useEffect(() => { loadPages(); }, [loadPages]);

  // Recompute editor quality when form changes
  useEffect(() => {
    if (editorOpen) {
      const q = scoreCustomPage({
        content: form.content,
        meta_title: form.meta_title,
        meta_description: form.meta_description,
        excerpt: form.excerpt,
        faq_schema: editingPage?.faq_schema,
        tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
      });
      setEditorQuality(q);
    }
  }, [form.content, form.meta_title, form.meta_description, form.excerpt, form.tags, editorOpen, editingPage?.faq_schema]);

  // ── Form helpers ──
  const resetForm = () => {
    setForm({ title: '', slug: '', content: '', excerpt: '', meta_title: '', meta_description: '', category: 'general', tags: '', page_type: 'landing' });
    setEditingPage(null);
    setImproveResults(null);
    setEditorQuality(null);
  };

  const openEditor = (p?: CustomPage) => {
    if (p) {
      setEditingPage(p);
      setForm({
        title: p.title, slug: p.slug, content: p.content,
        excerpt: p.excerpt || '', meta_title: p.meta_title || '',
        meta_description: p.meta_description || '',
        category: p.category || 'general',
        tags: (p.tags || []).join(', '),
        page_type: p.page_type || 'landing',
      });
    } else { resetForm(); }
    setEditorOpen(true);
  };

  const savePage = async () => {
    if (!form.title || !form.slug) { toast({ title: 'Title and slug required', variant: 'destructive' }); return; }
    setSaving(true);
    const wc = form.content.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
    const payload = {
      title: form.title,
      slug: form.slug.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-'),
      content: form.content, excerpt: form.excerpt || null,
      meta_title: form.meta_title || null, meta_description: form.meta_description || null,
      category: form.category,
      tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
      page_type: form.page_type, word_count: wc, author_id: user?.id,
    };
    if (editingPage) {
      const { error } = await supabase.from('custom_pages').update(payload as any).eq('id', editingPage.id);
      if (error) toast({ title: 'Save failed', description: error.message, variant: 'destructive' });
      else { toast({ title: 'Page updated' }); setEditorOpen(false); loadPages(); }
    } else {
      const { error } = await supabase.from('custom_pages').insert(payload as any);
      if (error) toast({ title: 'Create failed', description: error.message, variant: 'destructive' });
      else { toast({ title: 'Page created' }); setEditorOpen(false); loadPages(); }
    }
    setSaving(false);
  };

  const deletePage = async (id: string) => {
    if (!confirm('Delete this page?')) return;
    await supabase.from('custom_pages').delete().eq('id', id);
    toast({ title: 'Page deleted' }); loadPages();
  };

  const togglePublish = async (p: CustomPage) => {
    const newPub = !p.is_published;
    await supabase.from('custom_pages').update({
      is_published: newPub, status: newPub ? 'published' : 'draft',
      published_at: newPub ? new Date().toISOString() : null,
    } as any).eq('id', p.id);
    toast({ title: newPub ? 'Published!' : 'Unpublished' }); loadPages();
  };

  // ── AI: Generate single ──
  const handleGenerate = async () => {
    if (!generateTopic.trim()) return;
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-custom-page', {
        body: { action: 'generate', topic: generateTopic, pageType: form.page_type, category: form.category, tags: form.tags.split(',').map(t => t.trim()).filter(Boolean), aiModel },
      });
      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error || 'Generation failed');
      const d = data.data;
      setForm(prev => ({
        ...prev, title: d.title || prev.title, slug: d.slug || prev.slug,
        content: d.content || prev.content, excerpt: d.excerpt || prev.excerpt,
        meta_title: d.meta_title || prev.meta_title,
        meta_description: d.meta_description || prev.meta_description,
        tags: (d.suggested_tags || []).join(', ') || prev.tags,
        category: d.suggested_category || prev.category,
      }));
      toast({ title: '✨ Page generated!', description: `${d.word_count || '?'} words` });
    } catch (e: any) {
      toast({ title: 'Generation failed', description: e.message, variant: 'destructive' });
    } finally { setGenerating(false); }
  };

  // ── AI: Improve ──
  const handleImprove = async () => {
    if (!form.title || !form.content) { toast({ title: 'Need title and content', variant: 'destructive' }); return; }
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-custom-page', {
        body: { action: 'improve', title: form.title, content: form.content, metaTitle: form.meta_title, metaDescription: form.meta_description, aiModel },
      });
      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error || 'Improve failed');
      setImproveResults(data.data);
      toast({ title: '✨ Analysis complete' });
    } catch (e: any) {
      toast({ title: 'Improve failed', description: e.message, variant: 'destructive' });
    } finally { setGenerating(false); }
  };

  const applyImprovement = (field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
    toast({ title: `Applied ${field}` });
  };

  // ═══════════════════════════════════════════════════════════════
  // BULK GENERATION
  // ═══════════════════════════════════════════════════════════════

  const startBulkGeneration = async () => {
    const topics = bulkTopics.split('\n').map(t => t.trim()).filter(Boolean);
    if (topics.length === 0) return;

    bulkAbortRef.current = false;
    setIsBulkRunning(true);
    const items: BulkItem[] = topics.map(t => ({ topic: t, status: 'queued' }));
    setBulkItems(items);

    for (let i = 0; i < items.length; i++) {
      if (bulkAbortRef.current) break;
      setBulkItems(prev => prev.map((r, idx) => idx === i ? { ...r, status: 'generating' } : r));

      try {
        const { data, error } = await supabase.functions.invoke('generate-custom-page', {
          body: { action: 'generate', topic: items[i].topic, pageType: 'landing', category: 'general', tags: [], aiModel },
        });
        if (error) throw new Error(error.message);
        if (!data?.success) throw new Error(data?.error || 'Failed');

        const d = data.data;
        const slug = d.slug || items[i].topic.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        const pagePayload = {
          title: d.title || items[i].topic,
          slug, content: d.content || '', excerpt: d.excerpt || null,
          meta_title: d.meta_title || null, meta_description: d.meta_description || null,
          category: d.suggested_category || 'general',
          tags: d.suggested_tags || [], faq_schema: d.faq_items || [],
          word_count: d.word_count || 0, page_type: 'landing' as const,
          ai_model_used: aiModel, ai_generated_at: new Date().toISOString(),
          author_id: user?.id,
        };

        const { data: inserted, error: insertErr } = await supabase
          .from('custom_pages').insert(pagePayload as any).select('id').single();

        if (insertErr) throw new Error(insertErr.message);

        const quality = scoreCustomPage({
          content: d.content || '',
          meta_title: d.meta_title, meta_description: d.meta_description,
          excerpt: d.excerpt, faq_schema: d.faq_items, tags: d.suggested_tags,
        });

        setBulkItems(prev => prev.map((r, idx) =>
          idx === i ? { ...r, status: 'success', pageId: inserted?.id, quality, page: pagePayload } : r
        ));
      } catch (e: any) {
        setBulkItems(prev => prev.map((r, idx) => idx === i ? { ...r, status: 'failed', error: e.message } : r));
      }
    }

    setIsBulkRunning(false);
    loadPages();
    toast({ title: 'Bulk generation complete' });
  };

  // Re-enrich a single item
  const reEnrichItem = async (index: number) => {
    const item = bulkItems[index];
    if (!item || !item.pageId) return;

    setBulkItems(prev => prev.map((r, idx) => idx === index ? { ...r, status: 're-enriching' } : r));

    try {
      const { data, error } = await supabase.functions.invoke('generate-custom-page', {
        body: { action: 'generate', topic: item.topic, pageType: 'landing', category: 'general', tags: [], aiModel },
      });
      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error || 'Failed');

      const d = data.data;
      const updatePayload = {
        content: d.content || '', excerpt: d.excerpt || null,
        meta_title: d.meta_title || null, meta_description: d.meta_description || null,
        category: d.suggested_category || 'general',
        tags: d.suggested_tags || [], faq_schema: d.faq_items || [],
        word_count: d.word_count || 0,
        ai_model_used: aiModel, ai_generated_at: new Date().toISOString(),
      };

      await supabase.from('custom_pages').update(updatePayload as any).eq('id', item.pageId);

      const quality = scoreCustomPage({
        content: d.content || '', meta_title: d.meta_title,
        meta_description: d.meta_description, excerpt: d.excerpt,
        faq_schema: d.faq_items, tags: d.suggested_tags,
      });

      setBulkItems(prev => prev.map((r, idx) =>
        idx === index ? { ...r, status: 'success', quality, page: { ...r.page, ...updatePayload } } : r
      ));
      toast({ title: `Re-enriched: ${item.topic}` });
    } catch (e: any) {
      setBulkItems(prev => prev.map((r, idx) =>
        idx === index ? { ...r, status: 'failed', error: e.message } : r
      ));
      toast({ title: 'Re-enrich failed', description: e.message, variant: 'destructive' });
    }
  };

  // Publish a single bulk item
  const publishBulkItem = async (index: number) => {
    const item = bulkItems[index];
    if (!item?.pageId) return;
    await supabase.from('custom_pages').update({
      is_published: true, status: 'published', published_at: new Date().toISOString(),
    } as any).eq('id', item.pageId);
    toast({ title: `Published: ${item.topic}` });
    loadPages();
  };

  // ── Stats ──
  const bulkCompleted = bulkItems.filter(i => i.status === 'success').length;
  const bulkFailed = bulkItems.filter(i => i.status === 'failed').length;
  const bulkProgress = bulkItems.length > 0 ? ((bulkCompleted + bulkFailed) / bulkItems.length) * 100 : 0;
  const lowQualityCount = bulkItems.filter(i => i.quality && i.quality.score < 65).length;
  const avgSpeed = getModelSpeed(aiModel);
  const remaining = bulkItems.filter(i => i.status === 'queued' || i.status === 'generating').length;
  const eta = remaining * avgSpeed;

  // ── Quality for list pages ──
  const getPageQuality = (p: CustomPage): QualityBreakdown => scoreCustomPage({
    content: p.content, meta_title: p.meta_title, meta_description: p.meta_description,
    excerpt: p.excerpt, faq_schema: p.faq_schema, tags: p.tags,
  });

  const statusBadge = (s: string) => {
    if (s === 'published') return <Badge className="bg-emerald-500/20 text-emerald-700 border-emerald-300">Published</Badge>;
    if (s === 'archived') return <Badge variant="secondary">Archived</Badge>;
    return <Badge variant="outline">Draft</Badge>;
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  // ═══════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Globe className="h-5 w-5" /> Custom Pages ({total})
          </h3>
          <p className="text-sm text-muted-foreground">Create and manage SEO landing pages with AI</p>
        </div>
        <div className="flex gap-2">
          <Button variant={viewMode === 'list' ? 'default' : 'outline'} size="sm" onClick={() => setViewMode('list')}>
            <FileText className="h-4 w-4 mr-1" /> Pages
          </Button>
          <Button variant={viewMode === 'bulk' ? 'default' : 'outline'} size="sm" onClick={() => setViewMode('bulk')}>
            <Zap className="h-4 w-4 mr-1" /> Bulk Generate
          </Button>
          <Button size="sm" onClick={() => openEditor()}>
            <Plus className="h-4 w-4 mr-1" /> New Page
          </Button>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* BULK GENERATION VIEW */}
      {/* ═══════════════════════════════════════════════════════════ */}
      {viewMode === 'bulk' && (
        <div className="space-y-4">
          {/* Input + controls */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Zap className="h-4 w-4" /> Bulk Page Generation
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="lg:col-span-2">
                  <Label className="text-xs mb-1 block">Enter page topics (one per line)</Label>
                  <Textarea
                    value={bulkTopics}
                    onChange={e => setBulkTopics(e.target.value)}
                    rows={6}
                    placeholder={"sbi-po\nrrb-ntpc-2025\nssc-cgl-preparation-guide\nbest-govt-jobs-after-btech\nupsc-capf-exam"}
                    className="font-mono text-xs"
                    disabled={isBulkRunning}
                  />
                  <span className="text-[10px] text-muted-foreground">
                    {bulkTopics.split('\n').map(t => t.trim()).filter(Boolean).length} topics
                  </span>
                </div>
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs">AI Model</Label>
                    <AiModelSelector value={aiModel} onValueChange={setAiModel} capability="text" triggerClassName="w-full" />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      className="flex-1"
                      onClick={startBulkGeneration}
                      disabled={isBulkRunning || !bulkTopics.trim()}
                    >
                      {isBulkRunning ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Sparkles className="h-4 w-4 mr-1" />}
                      {isBulkRunning ? 'Generating...' : 'Generate All'}
                    </Button>
                    {isBulkRunning && (
                      <Button variant="destructive" size="icon" onClick={() => { bulkAbortRef.current = true; }}>
                        <Square className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  {isBulkRunning && eta > 0 && (
                    <p className="text-[10px] text-muted-foreground">ETA: ~{Math.ceil(eta / 60)}m ({remaining} remaining × ~{avgSpeed}s)</p>
                  )}
                </div>
              </div>

              {/* Progress bar */}
              {bulkItems.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Progress: {bulkCompleted + bulkFailed}/{bulkItems.length}</span>
                    <div className="flex gap-3">
                      <span className="text-emerald-600">✓ {bulkCompleted}</span>
                      <span className="text-destructive">✗ {bulkFailed}</span>
                      {lowQualityCount > 0 && <span className="text-amber-600">⚠ {lowQualityCount} low quality</span>}
                    </div>
                  </div>
                  <Progress value={bulkProgress} className="h-2" />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Results table with quality scores */}
          {bulkItems.length > 0 && (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8">#</TableHead>
                      <TableHead>Topic</TableHead>
                      <TableHead className="w-16">Status</TableHead>
                      <TableHead className="w-16 text-center">Score</TableHead>
                      <TableHead className="w-16 text-center">Words</TableHead>
                      <TableHead className="w-12 text-center">FAQs</TableHead>
                      <TableHead className="w-12 text-center">H2s</TableHead>
                      <TableHead className="text-right w-32">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bulkItems.map((item, i) => (
                      <TableRow key={i} className={item.quality && item.quality.score < 65 ? 'bg-amber-50/50 dark:bg-amber-950/10' : ''}>
                        <TableCell className="text-xs text-muted-foreground">{i + 1}</TableCell>
                        <TableCell className="font-medium text-sm max-w-[200px] truncate">{item.topic}</TableCell>
                        <TableCell>
                          {item.status === 'queued' && <Clock className="h-4 w-4 text-muted-foreground" />}
                          {item.status === 'generating' && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
                          {item.status === 're-enriching' && <Loader2 className="h-4 w-4 animate-spin text-amber-600" />}
                          {item.status === 'success' && <CheckCircle className="h-4 w-4 text-emerald-600" />}
                          {item.status === 'failed' && (
                            <span title={item.error}><XCircle className="h-4 w-4 text-destructive" /></span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {item.quality && <QualityIndicator quality={item.quality} compact />}
                        </TableCell>
                        <TableCell className="text-center text-xs">
                          {item.quality?.wordCount ?? '—'}
                        </TableCell>
                        <TableCell className="text-center text-xs">
                          {item.quality?.faqCount ?? '—'}
                        </TableCell>
                        <TableCell className="text-center text-xs">
                          {item.quality?.h2Count ?? '—'}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {item.status === 'success' && item.quality && item.quality.score < 65 && (
                              <Button
                                size="sm" variant="outline"
                                className="h-7 text-xs text-amber-600 border-amber-300"
                                onClick={() => reEnrichItem(i)}
                                disabled={isBulkRunning}
                              >
                                <RotateCcw className="h-3 w-3 mr-1" /> Re-enrich
                              </Button>
                            )}
                            {item.status === 'success' && item.pageId && (
                              <>
                                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => {
                                  // Open editor for this page
                                  supabase.from('custom_pages').select('*').eq('id', item.pageId!).single()
                                    .then(({ data }) => { if (data) openEditor(data as unknown as CustomPage); });
                                }}>
                                  <Eye className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  size="sm" variant="outline"
                                  className="h-7 text-xs text-emerald-600 border-emerald-300"
                                  onClick={() => publishBulkItem(i)}
                                >
                                  <CheckCircle className="h-3 w-3 mr-1" /> Publish
                                </Button>
                              </>
                            )}
                            {item.status === 'failed' && (
                              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => reEnrichItem(i)} disabled={isBulkRunning}>
                                <RotateCcw className="h-3 w-3 mr-1" /> Retry
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* LIST VIEW */}
      {/* ═══════════════════════════════════════════════════════════ */}
      {viewMode === 'list' && (
        <>
          {/* Filters */}
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search pages..." value={search} onChange={e => { setSearch(e.target.value); setPageNum(0); }} className="pl-9" />
            </div>
            <Select value={statusFilter} onValueChange={v => { setStatusFilter(v); setPageNum(0); }}>
              <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="published">Published</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Pages table */}
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Slug</TableHead>
                    <TableHead className="text-center w-16">Score</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-16">Words</TableHead>
                    <TableHead>AI</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
                  ) : pages.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No pages yet. Click "New Page" or "Bulk Generate".</TableCell></TableRow>
                  ) : pages.map(p => {
                    const q = getPageQuality(p);
                    return (
                      <TableRow key={p.id} className={q.score < 65 ? 'bg-amber-50/50 dark:bg-amber-950/10' : ''}>
                        <TableCell className="font-medium max-w-[200px] truncate">{p.title}</TableCell>
                        <TableCell className="text-xs text-muted-foreground font-mono">/{p.slug}</TableCell>
                        <TableCell className="text-center">
                          <QualityIndicator quality={q} compact />
                        </TableCell>
                        <TableCell>{statusBadge(p.status)}</TableCell>
                        <TableCell className="text-sm">{q.wordCount}</TableCell>
                        <TableCell>
                          {p.ai_model_used && (
                            <Badge variant="outline" className="text-[10px]">{getModelDef(p.ai_model_used)?.label || p.ai_model_used}</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right space-x-1">
                          <Button size="icon" variant="ghost" onClick={() => openEditor(p)}><Pencil className="h-3.5 w-3.5" /></Button>
                          <Button size="icon" variant="ghost" onClick={() => togglePublish(p)}>
                            {p.is_published ? <XCircle className="h-3.5 w-3.5 text-destructive" /> : <CheckCircle className="h-3.5 w-3.5 text-emerald-600" />}
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => deletePage(p.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <Button size="sm" variant="outline" onClick={() => setPageNum(p => p - 1)} disabled={pageNum === 0}><ChevronLeft className="h-4 w-4" /></Button>
              <span className="text-sm text-muted-foreground">{pageNum + 1} / {totalPages}</span>
              <Button size="sm" variant="outline" onClick={() => setPageNum(p => p + 1)} disabled={pageNum >= totalPages - 1}><ChevronRight className="h-4 w-4" /></Button>
            </div>
          )}
        </>
      )}

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* EDITOR DIALOG */}
      {/* ═══════════════════════════════════════════════════════════ */}
      <Dialog open={editorOpen} onOpenChange={v => { if (!v) { setEditorOpen(false); resetForm(); } }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingPage ? 'Edit Page' : 'Create New Page'}</DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Left: Form */}
            <div className="lg:col-span-2 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Title</Label>
                  <Input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="Page title" />
                </div>
                <div>
                  <Label className="text-xs">Slug</Label>
                  <Input value={form.slug} onChange={e => setForm(p => ({ ...p, slug: e.target.value }))} placeholder="url-slug" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Meta Title</Label>
                  <Input value={form.meta_title} onChange={e => setForm(p => ({ ...p, meta_title: e.target.value }))} placeholder="≤60 chars" />
                  <span className="text-[10px] text-muted-foreground">{form.meta_title.length}/60</span>
                </div>
                <div>
                  <Label className="text-xs">Meta Description</Label>
                  <Input value={form.meta_description} onChange={e => setForm(p => ({ ...p, meta_description: e.target.value }))} placeholder="≤160 chars" />
                  <span className="text-[10px] text-muted-foreground">{form.meta_description.length}/160</span>
                </div>
              </div>

              <div>
                <Label className="text-xs">Excerpt</Label>
                <Textarea value={form.excerpt} onChange={e => setForm(p => ({ ...p, excerpt: e.target.value }))} rows={2} placeholder="Short summary" />
              </div>

              <div>
                <Label className="text-xs">Content (HTML)</Label>
                <Textarea value={form.content} onChange={e => setForm(p => ({ ...p, content: e.target.value }))} rows={12} className="font-mono text-xs" />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs">Category</Label>
                  <Input value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))} />
                </div>
                <div>
                  <Label className="text-xs">Tags (comma-sep)</Label>
                  <Input value={form.tags} onChange={e => setForm(p => ({ ...p, tags: e.target.value }))} />
                </div>
                <div>
                  <Label className="text-xs">Page Type</Label>
                  <Select value={form.page_type} onValueChange={v => setForm(p => ({ ...p, page_type: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="landing">Landing</SelectItem>
                      <SelectItem value="guide">Guide</SelectItem>
                      <SelectItem value="resource">Resource</SelectItem>
                      <SelectItem value="comparison">Comparison</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button onClick={savePage} disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <CheckCircle className="h-4 w-4 mr-1" />}
                  {editingPage ? 'Update' : 'Create'}
                </Button>
                <Button variant="outline" onClick={() => { setEditorOpen(false); resetForm(); }}>Cancel</Button>
              </div>
            </div>

            {/* Right: AI Tools + Quality */}
            <div className="space-y-3">
              {/* Real-time quality indicator */}
              {editorQuality && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <BarChart3 className="h-4 w-4" /> Quality Score
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <QualityIndicator quality={editorQuality} />
                  </CardContent>
                </Card>
              )}

              {/* AI Tools */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Sparkles className="h-4 w-4" /> AI Tools
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <Label className="text-xs">AI Model</Label>
                    <AiModelSelector value={aiModel} onValueChange={setAiModel} capability="text" triggerClassName="w-full" />
                  </div>

                  <Tabs defaultValue="generate">
                    <TabsList className="w-full grid grid-cols-2">
                      <TabsTrigger value="generate" className="text-xs">Generate</TabsTrigger>
                      <TabsTrigger value="improve" className="text-xs">Improve</TabsTrigger>
                    </TabsList>

                    <TabsContent value="generate" className="space-y-2 mt-2">
                      <Input value={generateTopic} onChange={e => setGenerateTopic(e.target.value)} placeholder="Enter topic..." />
                      <Button size="sm" className="w-full" onClick={handleGenerate} disabled={generating || !generateTopic.trim()}>
                        {generating ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Wand2 className="h-4 w-4 mr-1" />}
                        Generate Full Page
                      </Button>
                    </TabsContent>

                    <TabsContent value="improve" className="space-y-2 mt-2">
                      <p className="text-xs text-muted-foreground">Analyze and get SEO improvements.</p>
                      <Button size="sm" className="w-full" onClick={handleImprove} disabled={generating || !form.content}>
                        {generating ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Sparkles className="h-4 w-4 mr-1" />}
                        Analyze & Improve
                      </Button>
                      {improveResults && (
                        <div className="space-y-2 text-xs">
                          {improveResults.seo_score && (
                            <div className="flex items-center gap-2">
                              <span className="text-muted-foreground">AI SEO Score:</span>
                              <Badge variant={improveResults.seo_score >= 70 ? 'default' : 'destructive'}>{improveResults.seo_score}/100</Badge>
                            </div>
                          )}
                          {improveResults.meta_title && (
                            <div className="flex items-center justify-between gap-1">
                              <span className="truncate flex-1">Meta: {improveResults.meta_title}</span>
                              <Button size="sm" variant="ghost" className="h-6 px-1" onClick={() => applyImprovement('meta_title', improveResults.meta_title)}>
                                <Copy className="h-3 w-3" />
                              </Button>
                            </div>
                          )}
                          {improveResults.meta_description && (
                            <div className="flex items-center justify-between gap-1">
                              <span className="truncate flex-1">Desc: {improveResults.meta_description}</span>
                              <Button size="sm" variant="ghost" className="h-6 px-1" onClick={() => applyImprovement('meta_description', improveResults.meta_description)}>
                                <Copy className="h-3 w-3" />
                              </Button>
                            </div>
                          )}
                          {improveResults.issues?.length > 0 && (
                            <div>
                              <span className="font-medium text-destructive">Issues:</span>
                              <ul className="list-disc pl-4 mt-1 space-y-0.5">
                                {improveResults.issues.map((issue: string, i: number) => <li key={i}>{issue}</li>)}
                              </ul>
                            </div>
                          )}
                        </div>
                      )}
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
