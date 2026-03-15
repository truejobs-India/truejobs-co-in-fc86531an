import { useState, useEffect, useCallback } from 'react';
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
import { Switch } from '@/components/ui/switch';
import { AiModelSelector } from '@/components/admin/AiModelSelector';
import { useAdminToast as useToast } from '@/contexts/AdminMessagesContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { isReservedSlug, RESOURCE_TYPE_PATHS, type ResourceType } from '@/lib/resourceHubs';
import {
  Plus, Sparkles, Loader2, Pencil, Trash2, Search,
  ChevronLeft, ChevronRight, Download, Upload, Eye,
  FileText, Image, AlertTriangle, CheckCircle, XCircle,
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

interface PdfResource {
  id: string;
  resource_type: string;
  title: string;
  slug: string;
  download_filename: string | null;
  file_url: string | null;
  file_size_bytes: number | null;
  page_count: number | null;
  file_hash: string | null;
  cover_image_url: string | null;
  featured_image_alt: string | null;
  content: string;
  excerpt: string | null;
  meta_title: string | null;
  meta_description: string | null;
  faq_schema: any;
  category: string | null;
  exam_name: string | null;
  subject: string | null;
  language: string | null;
  exam_year: number | null;
  edition_year: number | null;
  tags: string[] | null;
  status: string;
  is_featured: boolean;
  is_trending: boolean;
  is_published: boolean;
  is_noindex: boolean;
  duplicate_approved: boolean;
  review_notes: string | null;
  published_at: string | null;
  download_count: number;
  cta_click_count: number;
  final_download_count: number;
  word_count: number;
  ai_model_used: string | null;
  ai_generated_at: string | null;
  content_hash: string | null;
  author_id: string;
  created_at: string;
  updated_at: string;
}

const EMPTY_RESOURCE: Partial<PdfResource> = {
  resource_type: 'sample_paper',
  title: '',
  slug: '',
  download_filename: '',
  content: '',
  excerpt: '',
  meta_title: '',
  meta_description: '',
  faq_schema: [],
  category: '',
  exam_name: '',
  subject: '',
  language: 'hindi',
  exam_year: new Date().getFullYear(),
  tags: [],
  status: 'draft',
  is_featured: false,
  is_trending: false,
  is_published: false,
  is_noindex: false,
  duplicate_approved: false,
  review_notes: '',
};

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  generated: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  ready_for_review: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  published: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  archived: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
};

const PAGE_SIZE = 20;

// ═══════════════════════════════════════════════════════════════
// Component
// ═══════════════════════════════════════════════════════════════

export function PdfResourcesManager() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [resources, setResources] = useState<PdfResource[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState<string>('sample_paper');
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<Partial<PdfResource>>(EMPTY_RESOURCE);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [aiModel, setAiModel] = useState('gemini-flash');
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [slugError, setSlugError] = useState('');

  // ─── Fetch ────────────────────────────────────────────────
  const fetchResources = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('pdf_resources')
      .select('*', { count: 'exact' })
      .eq('resource_type', typeFilter)
      .order('created_at', { ascending: false })
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

    if (statusFilter !== 'all') query = query.eq('status', statusFilter);
    if (search) query = query.ilike('title', `%${search}%`);

    const { data, count, error } = await query;
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      setResources((data || []) as unknown as PdfResource[]);
      setTotal(count || 0);
    }
    setLoading(false);
  }, [typeFilter, statusFilter, search, page, toast]);

  useEffect(() => { fetchResources(); }, [fetchResources]);

  // ─── Slug generation ─────────────────────────────────────
  const generateSlug = (title: string) => {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .substring(0, 100);
  };

  const validateSlug = (slug: string) => {
    if (isReservedSlug(slug)) {
      setSlugError('This slug is reserved and cannot be used.');
      return false;
    }
    setSlugError('');
    return true;
  };

  // ─── PDF Upload with metadata extraction ──────────────────
  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.name.endsWith('.pdf')) {
      toast({ title: 'Invalid file', description: 'Please upload a PDF file.', variant: 'destructive' });
      return;
    }

    setUploadingPdf(true);
    try {
      // Extract metadata
      const arrayBuffer = await file.arrayBuffer();
      const fileSizeBytes = file.size;

      // Compute SHA-256 hash
      const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const fileHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

      // Check for duplicate hash
      const { data: dupes } = await supabase
        .from('pdf_resources')
        .select('id, title, slug')
        .eq('file_hash', fileHash)
        .neq('id', editItem.id || '00000000-0000-0000-0000-000000000000');

      if (dupes && dupes.length > 0) {
        const dupe = dupes[0] as any;
        toast({
          title: '⚠️ Duplicate file detected',
          description: `This file appears identical to "${dupe.title}" (${dupe.slug}). You can still proceed.`,
          variant: 'destructive',
        });
      }

      // Try to extract page count using pdf-lib
      let pageCount: number | null = null;
      try {
        const { PDFDocument } = await import('pdf-lib');
        const pdfDoc = await PDFDocument.load(arrayBuffer);
        pageCount = pdfDoc.getPageCount();
      } catch {
        // pdf-lib not available or PDF parsing failed
      }

      // Upload to storage
      const resourceType = editItem.resource_type || 'sample_paper';
      const typePath = RESOURCE_TYPE_PATHS[resourceType as ResourceType];
      const slug = editItem.slug || generateSlug(editItem.title || 'resource');
      const storagePath = `pdfs/${typePath}/${slug}.pdf`;

      const { error: uploadError } = await supabase.storage
        .from('blog-assets')
        .upload(storagePath, file, { upsert: true, contentType: 'application/pdf' });

      if (uploadError) throw uploadError;

      const { data: publicUrl } = supabase.storage.from('blog-assets').getPublicUrl(storagePath);

      setEditItem(prev => ({
        ...prev,
        file_url: publicUrl.publicUrl,
        file_size_bytes: fileSizeBytes,
        file_hash: fileHash,
        page_count: pageCount,
        download_filename: `${slug}.pdf`,
      }));

      toast({ title: 'PDF uploaded', description: `${fileSizeBytes > 1024 * 1024 ? (fileSizeBytes / (1024 * 1024)).toFixed(1) + ' MB' : (fileSizeBytes / 1024).toFixed(0) + ' KB'}${pageCount ? ` · ${pageCount} pages` : ''}` });
    } catch (err: any) {
      toast({ title: 'Upload failed', description: err.message, variant: 'destructive' });
    } finally {
      setUploadingPdf(false);
    }
  };

  // ─── AI Content Generation ────────────────────────────────
  const handleGenerate = async () => {
    if (!editItem.title) {
      toast({ title: 'Title required', description: 'Enter a title before generating content.', variant: 'destructive' });
      return;
    }

    setGenerating(true);
    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;

      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-resource-content`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            action: 'generate',
            title: editItem.title,
            resourceType: editItem.resource_type,
            category: editItem.category,
            examName: editItem.exam_name,
            subject: editItem.subject,
            language: editItem.language,
            tags: editItem.tags,
            year: editItem.exam_year,
            slug: editItem.slug,
            aiModel: aiModel,
          }),
        }
      );

      const result = await resp.json();
      if (!result.success) throw new Error(result.error || 'Generation failed');

      const data = result.data;
      const wordCount = data.word_count || (data.content?.replace(/<[^>]*>/g, '').split(/\s+/).length || 0);

      setEditItem(prev => ({
        ...prev,
        content: data.content || prev.content,
        excerpt: data.excerpt || prev.excerpt,
        meta_title: data.meta_title || prev.meta_title,
        meta_description: data.meta_description || prev.meta_description,
        faq_schema: data.faq_items || prev.faq_schema,
        tags: data.suggested_tags || prev.tags,
        word_count: wordCount,
        ai_model_used: aiModel,
        ai_generated_at: new Date().toISOString(),
        content_hash: data.content_hash || null,
        status: prev.status === 'draft' ? 'generated' : prev.status,
      }));

      toast({ title: 'Content generated', description: `${wordCount} words generated with ${aiModel}` });
    } catch (err: any) {
      toast({ title: 'Generation failed', description: err.message, variant: 'destructive' });
    } finally {
      setGenerating(false);
    }
  };

  // ─── Save ─────────────────────────────────────────────────
  const handleSave = async () => {
    if (!editItem.title || !editItem.slug) {
      toast({ title: 'Missing fields', description: 'Title and slug are required.', variant: 'destructive' });
      return;
    }
    if (!validateSlug(editItem.slug)) return;

    setSaving(true);
    try {
      const payload: any = {
        resource_type: editItem.resource_type,
        title: editItem.title,
        slug: editItem.slug,
        download_filename: editItem.download_filename || `${editItem.slug}.pdf`,
        file_url: editItem.file_url || null,
        file_size_bytes: editItem.file_size_bytes || null,
        page_count: editItem.page_count || null,
        file_hash: editItem.file_hash || null,
        cover_image_url: editItem.cover_image_url || null,
        featured_image_alt: editItem.featured_image_alt || null,
        content: editItem.content || '',
        excerpt: editItem.excerpt || null,
        meta_title: editItem.meta_title || null,
        meta_description: editItem.meta_description || null,
        faq_schema: editItem.faq_schema || [],
        category: editItem.category || null,
        exam_name: editItem.exam_name || null,
        subject: editItem.subject || null,
        language: editItem.language || 'hindi',
        exam_year: editItem.exam_year || null,
        edition_year: editItem.edition_year || null,
        tags: editItem.tags || [],
        status: editItem.status || 'draft',
        is_featured: editItem.is_featured || false,
        is_trending: editItem.is_trending || false,
        is_published: editItem.status === 'published',
        is_noindex: editItem.is_noindex || false,
        duplicate_approved: editItem.duplicate_approved || false,
        review_notes: editItem.review_notes || null,
        word_count: editItem.word_count || 0,
        reading_time: Math.max(1, Math.ceil((editItem.word_count || 0) / 200)),
        ai_model_used: editItem.ai_model_used || null,
        ai_generated_at: editItem.ai_generated_at || null,
        content_hash: editItem.content_hash || null,
      };

      if (editItem.id) {
        // Update
        const { error } = await supabase
          .from('pdf_resources')
          .update(payload)
          .eq('id', editItem.id);
        if (error) throw error;
        toast({ title: 'Resource updated' });
      } else {
        // Insert
        payload.author_id = user?.id;
        if (payload.status === 'published') {
          payload.published_at = new Date().toISOString();
        }
        const { error } = await supabase
          .from('pdf_resources')
          .insert(payload);
        if (error) throw error;
        toast({ title: 'Resource created' });
      }

      setDialogOpen(false);
      fetchResources();
    } catch (err: any) {
      toast({ title: 'Save failed', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  // ─── Status change ────────────────────────────────────────
  const handleStatusChange = async (id: string, newStatus: string) => {
    const updatePayload: any = { status: newStatus };
    if (newStatus === 'published') {
      updatePayload.is_published = true;
      updatePayload.published_at = new Date().toISOString();
    } else {
      updatePayload.is_published = false;
    }

    const { error } = await supabase.from('pdf_resources').update(updatePayload).eq('id', id);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: `Status changed to ${newStatus}` });
      fetchResources();
    }
  };

  // ─── Delete ───────────────────────────────────────────────
  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this resource?')) return;
    const { error } = await supabase.from('pdf_resources').delete().eq('id', id);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Resource deleted' });
      fetchResources();
    }
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  // ─── Render ───────────────────────────────────────────────
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Download className="h-5 w-5" />
          PDF Resources Manager
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Type tabs */}
        <Tabs value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setPage(1); }}>
          <TabsList>
            <TabsTrigger value="sample_paper">Sample Papers</TabsTrigger>
            <TabsTrigger value="book">Books</TabsTrigger>
            <TabsTrigger value="previous_year_paper">Previous Year Papers</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="generated">Generated</SelectItem>
              <SelectItem value="ready_for_review">Ready for Review</SelectItem>
              <SelectItem value="published">Published</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={() => { setEditItem({ ...EMPTY_RESOURCE, resource_type: typeFilter }); setDialogOpen(true); }}>
            <Plus className="h-4 w-4 mr-1" /> New
          </Button>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Downloads</TableHead>
                <TableHead>Words</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8">Loading...</TableCell></TableRow>
              ) : resources.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No resources found</TableCell></TableRow>
              ) : resources.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <div className="max-w-xs">
                      <p className="font-medium truncate">{r.title}</p>
                      <p className="text-xs text-muted-foreground truncate">/{RESOURCE_TYPE_PATHS[r.resource_type as ResourceType]}/{r.slug}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      {r.category && <Badge variant="outline" className="text-xs mr-1">{r.category}</Badge>}
                      {r.exam_name && <span className="text-xs text-muted-foreground">{r.exam_name}</span>}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={STATUS_COLORS[r.status] || ''}>{r.status}</Badge>
                  </TableCell>
                  <TableCell className="text-sm">{r.download_count}</TableCell>
                  <TableCell className="text-sm">{r.word_count}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => { setEditItem(r); setDialogOpen(true); }}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      {r.is_published && (
                        <Button variant="ghost" size="icon" asChild>
                          <a href={`/${RESOURCE_TYPE_PATHS[r.resource_type as ResourceType]}/${r.slug}`} target="_blank" rel="noopener noreferrer">
                            <Eye className="h-4 w-4" />
                          </a>
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(r.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-center items-center gap-4">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
              <ChevronLeft className="h-4 w-4" /> Prev
            </Button>
            <span className="text-sm text-muted-foreground">Page {page} of {totalPages} ({total} total)</span>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
              Next <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Edit Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editItem.id ? 'Edit Resource' : 'New Resource'}</DialogTitle>
            </DialogHeader>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Left column */}
              <div className="space-y-4">
                <div>
                  <Label>Title *</Label>
                  <Input
                    value={editItem.title || ''}
                    onChange={(e) => {
                      const title = e.target.value;
                      setEditItem(prev => ({
                        ...prev,
                        title,
                        slug: prev.id ? prev.slug : generateSlug(title),
                        download_filename: prev.id ? prev.download_filename : `${generateSlug(title)}.pdf`,
                      }));
                    }}
                  />
                </div>

                <div>
                  <Label>Slug *</Label>
                  <Input
                    value={editItem.slug || ''}
                    onChange={(e) => {
                      const slug = e.target.value;
                      setEditItem(prev => ({ ...prev, slug }));
                      validateSlug(slug);
                    }}
                  />
                  {slugError && <p className="text-xs text-destructive mt-1">{slugError}</p>}
                </div>

                <div>
                  <Label>Resource Type</Label>
                  <Select value={editItem.resource_type || 'sample_paper'} onValueChange={(v) => setEditItem(prev => ({ ...prev, resource_type: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sample_paper">Sample Paper</SelectItem>
                      <SelectItem value="book">Book</SelectItem>
                      <SelectItem value="previous_year_paper">Previous Year Paper</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label>Category</Label>
                    <Input value={editItem.category || ''} onChange={(e) => setEditItem(prev => ({ ...prev, category: e.target.value }))} placeholder="e.g. SSC" />
                  </div>
                  <div>
                    <Label>Exam Name</Label>
                    <Input value={editItem.exam_name || ''} onChange={(e) => setEditItem(prev => ({ ...prev, exam_name: e.target.value }))} placeholder="e.g. SSC CGL" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label>Subject</Label>
                    <Input value={editItem.subject || ''} onChange={(e) => setEditItem(prev => ({ ...prev, subject: e.target.value }))} placeholder="e.g. Reasoning" />
                  </div>
                  <div>
                    <Label>Language</Label>
                    <Select value={editItem.language || 'hindi'} onValueChange={(v) => setEditItem(prev => ({ ...prev, language: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="hindi">Hindi</SelectItem>
                        <SelectItem value="english">English</SelectItem>
                        <SelectItem value="bilingual">Bilingual</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label>Exam Year</Label>
                    <Input type="number" value={editItem.exam_year || ''} onChange={(e) => setEditItem(prev => ({ ...prev, exam_year: parseInt(e.target.value) || null }))} />
                  </div>
                  <div>
                    <Label>Edition Year</Label>
                    <Input type="number" value={editItem.edition_year || ''} onChange={(e) => setEditItem(prev => ({ ...prev, edition_year: parseInt(e.target.value) || null }))} />
                  </div>
                </div>

                <div>
                  <Label>Tags (comma-separated)</Label>
                  <Input
                    value={(editItem.tags || []).join(', ')}
                    onChange={(e) => setEditItem(prev => ({ ...prev, tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean) }))}
                    placeholder="ssc, cgl, reasoning"
                  />
                </div>

                {/* PDF Upload */}
                <div>
                  <Label>PDF File</Label>
                  <div className="flex gap-2 items-center">
                    <Input type="file" accept=".pdf" onChange={handlePdfUpload} disabled={uploadingPdf} />
                    {uploadingPdf && <Loader2 className="h-4 w-4 animate-spin" />}
                  </div>
                  {editItem.file_url && (
                    <p className="text-xs text-muted-foreground mt-1">
                      ✓ Uploaded · {editItem.file_size_bytes ? `${(editItem.file_size_bytes / (1024 * 1024)).toFixed(1)} MB` : ''}
                      {editItem.page_count ? ` · ${editItem.page_count} pages` : ''}
                    </p>
                  )}
                </div>

                <div>
                  <Label>Download Filename</Label>
                  <Input value={editItem.download_filename || ''} onChange={(e) => setEditItem(prev => ({ ...prev, download_filename: e.target.value }))} placeholder="e.g. ssc-cgl-sample-paper-2026.pdf" />
                </div>

                <div>
                  <Label>Cover Image URL</Label>
                  <Input value={editItem.cover_image_url || ''} onChange={(e) => setEditItem(prev => ({ ...prev, cover_image_url: e.target.value }))} placeholder="https://..." />
                </div>

                <div>
                  <Label>Image Alt Text</Label>
                  <Input value={editItem.featured_image_alt || ''} onChange={(e) => setEditItem(prev => ({ ...prev, featured_image_alt: e.target.value }))} />
                </div>
              </div>

              {/* Right column */}
              <div className="space-y-4">
                <div>
                  <Label>Meta Title</Label>
                  <Input value={editItem.meta_title || ''} onChange={(e) => setEditItem(prev => ({ ...prev, meta_title: e.target.value }))} />
                  <p className="text-xs text-muted-foreground mt-1">{(editItem.meta_title || '').length}/60 chars</p>
                </div>

                <div>
                  <Label>Meta Description</Label>
                  <Textarea value={editItem.meta_description || ''} onChange={(e) => setEditItem(prev => ({ ...prev, meta_description: e.target.value }))} rows={2} />
                  <p className="text-xs text-muted-foreground mt-1">{(editItem.meta_description || '').length}/160 chars</p>
                </div>

                <div>
                  <Label>Excerpt</Label>
                  <Textarea value={editItem.excerpt || ''} onChange={(e) => setEditItem(prev => ({ ...prev, excerpt: e.target.value }))} rows={2} />
                </div>

                {/* AI Generation */}
                <div className="border rounded-lg p-3 space-y-3 bg-muted/30">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    <span className="font-medium text-sm">AI Content Generation</span>
                  </div>
                  <AiModelSelector value={aiModel} onChange={setAiModel} />
                  <Button onClick={handleGenerate} disabled={generating} className="w-full gap-2">
                    {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                    {generating ? 'Generating...' : 'Generate Content'}
                  </Button>
                </div>

                <div>
                  <Label>Content (HTML)</Label>
                  <Textarea
                    value={editItem.content || ''}
                    onChange={(e) => {
                      const content = e.target.value;
                      const wordCount = content.replace(/<[^>]*>/g, '').split(/\s+/).filter(Boolean).length;
                      setEditItem(prev => ({ ...prev, content, word_count: wordCount }));
                    }}
                    rows={8}
                    className="font-mono text-xs"
                  />
                  <p className="text-xs text-muted-foreground mt-1">{editItem.word_count || 0} words</p>
                </div>

                <div>
                  <Label>Review Notes</Label>
                  <Textarea value={editItem.review_notes || ''} onChange={(e) => setEditItem(prev => ({ ...prev, review_notes: e.target.value }))} rows={2} placeholder="Internal notes for review..." />
                </div>

                {/* Status */}
                <div>
                  <Label>Status</Label>
                  <Select value={editItem.status || 'draft'} onValueChange={(v) => setEditItem(prev => ({ ...prev, status: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="generated">Generated</SelectItem>
                      <SelectItem value="ready_for_review">Ready for Review</SelectItem>
                      <SelectItem value="published">Published</SelectItem>
                      <SelectItem value="archived">Archived</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Toggles */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center gap-2">
                    <Switch checked={editItem.is_featured || false} onCheckedChange={(v) => setEditItem(prev => ({ ...prev, is_featured: v }))} />
                    <Label className="text-sm">Featured</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={editItem.is_trending || false} onCheckedChange={(v) => setEditItem(prev => ({ ...prev, is_trending: v }))} />
                    <Label className="text-sm">Trending</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={editItem.is_noindex || false} onCheckedChange={(v) => setEditItem(prev => ({ ...prev, is_noindex: v }))} />
                    <Label className="text-sm">Noindex</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={editItem.duplicate_approved || false} onCheckedChange={(v) => setEditItem(prev => ({ ...prev, duplicate_approved: v }))} />
                    <Label className="text-sm">Dup. Approved</Label>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                {editItem.id ? 'Update' : 'Create'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
