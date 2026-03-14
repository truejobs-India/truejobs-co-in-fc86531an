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
import { Switch } from '@/components/ui/switch';
import { AiModelSelector } from '@/components/admin/AiModelSelector';
import { getModelDef } from '@/lib/aiModels';
import { useAdminToast as useToast } from '@/contexts/AdminMessagesContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import {
  Plus, Sparkles, Loader2, Eye, Pencil, Trash2, Search,
  ChevronLeft, ChevronRight, CheckCircle, XCircle, FileText,
  Globe, Copy, RotateCcw, Square, Wand2
} from 'lucide-react';

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

const PAGE_SIZE = 20;

export function CustomPagesManager() {
  const { toast } = useToast();
  const { user } = useAuth();

  // List state
  const [pages, setPages] = useState<CustomPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Editor state
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingPage, setEditingPage] = useState<CustomPage | null>(null);
  const [form, setForm] = useState({ title: '', slug: '', content: '', excerpt: '', meta_title: '', meta_description: '', category: 'general', tags: '', page_type: 'landing' });
  const [saving, setSaving] = useState(false);

  // AI state
  const [aiModel, setAiModel] = useState('gemini-flash');
  const [generating, setGenerating] = useState(false);
  const [aiTab, setAiTab] = useState<'generate' | 'improve' | 'bulk'>('generate');
  const [generateTopic, setGenerateTopic] = useState('');
  const [bulkTopics, setBulkTopics] = useState('');
  const [bulkResults, setBulkResults] = useState<{ topic: string; status: 'queued' | 'generating' | 'success' | 'failed'; error?: string }[]>([]);
  const [isBulkGenerating, setIsBulkGenerating] = useState(false);
  const bulkAbortRef = useRef(false);

  // AI improve results
  const [improveResults, setImproveResults] = useState<any>(null);

  const loadPages = useCallback(async () => {
    setLoading(true);
    let query = supabase.from('custom_pages').select('*', { count: 'exact' });
    if (search) query = query.or(`title.ilike.%${search}%,slug.ilike.%${search}%`);
    if (statusFilter !== 'all') query = query.eq('status', statusFilter);
    query = query.order('created_at', { ascending: false }).range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    const { data, count, error } = await query;
    if (error) { toast({ title: 'Error loading pages', description: error.message, variant: 'destructive' }); }
    setPages((data as unknown as CustomPage[]) || []);
    setTotal(count || 0);
    setLoading(false);
  }, [search, statusFilter, page, toast]);

  useEffect(() => { loadPages(); }, [loadPages]);

  const resetForm = () => {
    setForm({ title: '', slug: '', content: '', excerpt: '', meta_title: '', meta_description: '', category: 'general', tags: '', page_type: 'landing' });
    setEditingPage(null);
    setImproveResults(null);
  };

  const openEditor = (p?: CustomPage) => {
    if (p) {
      setEditingPage(p);
      setForm({
        title: p.title,
        slug: p.slug,
        content: p.content,
        excerpt: p.excerpt || '',
        meta_title: p.meta_title || '',
        meta_description: p.meta_description || '',
        category: p.category || 'general',
        tags: (p.tags || []).join(', '),
        page_type: p.page_type || 'landing',
      });
    } else {
      resetForm();
    }
    setEditorOpen(true);
  };

  const savePage = async () => {
    if (!form.title || !form.slug) { toast({ title: 'Title and slug required', variant: 'destructive' }); return; }
    setSaving(true);
    const payload = {
      title: form.title,
      slug: form.slug.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-'),
      content: form.content,
      excerpt: form.excerpt || null,
      meta_title: form.meta_title || null,
      meta_description: form.meta_description || null,
      category: form.category,
      tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
      page_type: form.page_type,
      word_count: form.content.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length,
      author_id: user?.id,
    };

    if (editingPage) {
      const { error } = await supabase.from('custom_pages').update(payload as any).eq('id', editingPage.id);
      if (error) { toast({ title: 'Save failed', description: error.message, variant: 'destructive' }); }
      else { toast({ title: 'Page updated' }); setEditorOpen(false); loadPages(); }
    } else {
      const { error } = await supabase.from('custom_pages').insert(payload as any);
      if (error) { toast({ title: 'Create failed', description: error.message, variant: 'destructive' }); }
      else { toast({ title: 'Page created' }); setEditorOpen(false); loadPages(); }
    }
    setSaving(false);
  };

  const deletePage = async (id: string) => {
    if (!confirm('Delete this page?')) return;
    await supabase.from('custom_pages').delete().eq('id', id);
    toast({ title: 'Page deleted' });
    loadPages();
  };

  const togglePublish = async (p: CustomPage) => {
    const newPublished = !p.is_published;
    await supabase.from('custom_pages').update({
      is_published: newPublished,
      status: newPublished ? 'published' : 'draft',
      published_at: newPublished ? new Date().toISOString() : null,
    } as any).eq('id', p.id);
    toast({ title: newPublished ? 'Published!' : 'Unpublished' });
    loadPages();
  };

  // ── AI: Generate page from topic ──
  const handleGenerate = async () => {
    if (!generateTopic.trim()) return;
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-custom-page', {
        body: { action: 'generate', topic: generateTopic, pageType: form.page_type, category: form.category, tags: form.tags.split(',').map(t => t.trim()).filter(Boolean), aiModel: aiModel },
      });
      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error || 'Generation failed');

      const d = data.data;
      setForm(prev => ({
        ...prev,
        title: d.title || prev.title,
        slug: d.slug || prev.slug,
        content: d.content || prev.content,
        excerpt: d.excerpt || prev.excerpt,
        meta_title: d.meta_title || prev.meta_title,
        meta_description: d.meta_description || prev.meta_description,
        tags: (d.suggested_tags || []).join(', ') || prev.tags,
        category: d.suggested_category || prev.category,
      }));
      toast({ title: '✨ Page generated!', description: `${d.word_count || '?'} words using ${getModelDef(aiModel)?.label || aiModel}` });
    } catch (e: any) {
      toast({ title: 'Generation failed', description: e.message, variant: 'destructive' });
    } finally {
      setGenerating(false);
    }
  };

  // ── AI: Improve existing ──
  const handleImprove = async () => {
    if (!form.title || !form.content) { toast({ title: 'Need title and content to improve', variant: 'destructive' }); return; }
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
    } finally {
      setGenerating(false);
    }
  };

  const applyImprovement = (field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
    toast({ title: `Applied ${field}` });
  };

  // ── AI: Bulk generate ──
  const handleBulkGenerate = async () => {
    const topicsList = bulkTopics.split('\n').map(t => t.trim()).filter(Boolean);
    if (topicsList.length === 0) return;

    bulkAbortRef.current = false;
    setIsBulkGenerating(true);
    setBulkResults(topicsList.map(t => ({ topic: t, status: 'queued' })));

    for (let i = 0; i < topicsList.length; i++) {
      if (bulkAbortRef.current) break;
      setBulkResults(prev => prev.map((r, idx) => idx === i ? { ...r, status: 'generating' } : r));

      try {
        const { data, error } = await supabase.functions.invoke('generate-custom-page', {
          body: { action: 'generate', topic: topicsList[i], pageType: 'landing', category: 'general', tags: [], aiModel },
        });
        if (error) throw new Error(error.message);
        if (!data?.success) throw new Error(data?.error || 'Failed');

        const d = data.data;
        const slug = d.slug || topicsList[i].toLowerCase().replace(/[^a-z0-9]+/g, '-');
        await supabase.from('custom_pages').insert({
          title: d.title || topicsList[i],
          slug,
          content: d.content || '',
          excerpt: d.excerpt || null,
          meta_title: d.meta_title || null,
          meta_description: d.meta_description || null,
          category: d.suggested_category || 'general',
          tags: d.suggested_tags || [],
          faq_schema: d.faq_items || [],
          word_count: d.word_count || 0,
          page_type: 'landing',
          ai_model_used: aiModel,
          ai_generated_at: new Date().toISOString(),
          author_id: user?.id,
        } as any);

        setBulkResults(prev => prev.map((r, idx) => idx === i ? { ...r, status: 'success' } : r));
      } catch (e: any) {
        setBulkResults(prev => prev.map((r, idx) => idx === i ? { ...r, status: 'failed', error: e.message } : r));
      }
    }

    setIsBulkGenerating(false);
    loadPages();
    toast({ title: 'Bulk generation complete' });
  };

  const statusBadge = (s: string) => {
    if (s === 'published') return <Badge className="bg-emerald-500/20 text-emerald-700 border-emerald-300">Published</Badge>;
    if (s === 'archived') return <Badge variant="secondary">Archived</Badge>;
    return <Badge variant="outline">Draft</Badge>;
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Custom Pages ({total})
          </h3>
          <p className="text-sm text-muted-foreground">Create and manage SEO landing pages with AI</p>
        </div>
        <Button onClick={() => openEditor()}>
          <Plus className="h-4 w-4 mr-1" /> New Page
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search pages..." value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={v => { setStatusFilter(v); setPage(0); }}>
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
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Words</TableHead>
                <TableHead>AI</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
              ) : pages.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No pages yet. Click "New Page" to create one.</TableCell></TableRow>
              ) : pages.map(p => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium max-w-[200px] truncate">{p.title}</TableCell>
                  <TableCell className="text-xs text-muted-foreground font-mono">/{p.slug}</TableCell>
                  <TableCell><Badge variant="outline" className="text-xs">{p.page_type}</Badge></TableCell>
                  <TableCell>{statusBadge(p.status)}</TableCell>
                  <TableCell className="text-sm">{p.word_count}</TableCell>
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
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setPage(p => p - 1)} disabled={page === 0}><ChevronLeft className="h-4 w-4" /></Button>
          <span className="text-sm text-muted-foreground">{page + 1} / {totalPages}</span>
          <Button size="sm" variant="outline" onClick={() => setPage(p => p + 1)} disabled={page >= totalPages - 1}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      )}

      {/* Editor dialog */}
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
                  <Input value={form.meta_title} onChange={e => setForm(p => ({ ...p, meta_title: e.target.value }))} placeholder="Meta title (≤60 chars)" />
                  <span className="text-[10px] text-muted-foreground">{form.meta_title.length}/60</span>
                </div>
                <div>
                  <Label className="text-xs">Meta Description</Label>
                  <Input value={form.meta_description} onChange={e => setForm(p => ({ ...p, meta_description: e.target.value }))} placeholder="Meta description (≤160 chars)" />
                  <span className="text-[10px] text-muted-foreground">{form.meta_description.length}/160</span>
                </div>
              </div>

              <div>
                <Label className="text-xs">Excerpt</Label>
                <Textarea value={form.excerpt} onChange={e => setForm(p => ({ ...p, excerpt: e.target.value }))} rows={2} placeholder="Short summary for previews" />
              </div>

              <div>
                <Label className="text-xs">Content (HTML)</Label>
                <Textarea value={form.content} onChange={e => setForm(p => ({ ...p, content: e.target.value }))} rows={12} className="font-mono text-xs" placeholder="<h2>...</h2><p>...</p>" />
                <span className="text-[10px] text-muted-foreground">
                  {form.content.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length} words
                </span>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs">Category</Label>
                  <Input value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))} />
                </div>
                <div>
                  <Label className="text-xs">Tags (comma-separated)</Label>
                  <Input value={form.tags} onChange={e => setForm(p => ({ ...p, tags: e.target.value }))} />
                </div>
                <div>
                  <Label className="text-xs">Page Type</Label>
                  <Select value={form.page_type} onValueChange={v => setForm(p => ({ ...p, page_type: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="landing">Landing Page</SelectItem>
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
                  {editingPage ? 'Update' : 'Create'} Page
                </Button>
                <Button variant="outline" onClick={() => { setEditorOpen(false); resetForm(); }}>Cancel</Button>
              </div>
            </div>

            {/* Right: AI Tools */}
            <div className="space-y-3">
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

                  <Tabs value={aiTab} onValueChange={v => setAiTab(v as any)}>
                    <TabsList className="w-full grid grid-cols-3">
                      <TabsTrigger value="generate" className="text-xs">Generate</TabsTrigger>
                      <TabsTrigger value="improve" className="text-xs">Improve</TabsTrigger>
                      <TabsTrigger value="bulk" className="text-xs">Bulk</TabsTrigger>
                    </TabsList>

                    <TabsContent value="generate" className="space-y-2 mt-2">
                      <Input value={generateTopic} onChange={e => setGenerateTopic(e.target.value)} placeholder="Enter topic (e.g. Best Govt Jobs After B.Tech)" />
                      <Button size="sm" className="w-full" onClick={handleGenerate} disabled={generating || !generateTopic.trim()}>
                        {generating ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Wand2 className="h-4 w-4 mr-1" />}
                        Generate Full Page
                      </Button>
                    </TabsContent>

                    <TabsContent value="improve" className="space-y-2 mt-2">
                      <p className="text-xs text-muted-foreground">Analyze current content and get SEO improvements.</p>
                      <Button size="sm" className="w-full" onClick={handleImprove} disabled={generating || !form.content}>
                        {generating ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Sparkles className="h-4 w-4 mr-1" />}
                        Analyze & Improve
                      </Button>
                      {improveResults && (
                        <div className="space-y-2 text-xs">
                          {improveResults.seo_score && (
                            <div className="flex items-center gap-2">
                              <span className="text-muted-foreground">SEO Score:</span>
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
                          {improveResults.content_suggestions?.length > 0 && (
                            <div>
                              <span className="font-medium">Suggestions:</span>
                              <ul className="list-disc pl-4 mt-1 space-y-0.5">
                                {improveResults.content_suggestions.map((s: string, i: number) => <li key={i}>{s}</li>)}
                              </ul>
                            </div>
                          )}
                        </div>
                      )}
                    </TabsContent>

                    <TabsContent value="bulk" className="space-y-2 mt-2">
                      <Textarea value={bulkTopics} onChange={e => setBulkTopics(e.target.value)} rows={5} placeholder="One topic per line..." className="text-xs" />
                      <div className="flex gap-2">
                        <Button size="sm" className="flex-1" onClick={handleBulkGenerate} disabled={isBulkGenerating || !bulkTopics.trim()}>
                          {isBulkGenerating ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Sparkles className="h-4 w-4 mr-1" />}
                          Generate All
                        </Button>
                        {isBulkGenerating && (
                          <Button size="sm" variant="destructive" onClick={() => { bulkAbortRef.current = true; }}>
                            <Square className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                      {bulkResults.length > 0 && (
                        <div className="space-y-1 max-h-48 overflow-y-auto">
                          {bulkResults.map((r, i) => (
                            <div key={i} className="flex items-center gap-2 text-xs">
                              {r.status === 'queued' && <Clock className="h-3 w-3 text-muted-foreground" />}
                              {r.status === 'generating' && <Loader2 className="h-3 w-3 animate-spin text-primary" />}
                              {r.status === 'success' && <CheckCircle className="h-3 w-3 text-emerald-600" />}
                              {r.status === 'failed' && <XCircle className="h-3 w-3 text-destructive" />}
                              <span className="truncate flex-1">{r.topic}</span>
                              {r.error && <span className="text-destructive truncate max-w-[100px]">{r.error}</span>}
                            </div>
                          ))}
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

// Missing import for Clock used in bulk results
import { Clock } from 'lucide-react';
