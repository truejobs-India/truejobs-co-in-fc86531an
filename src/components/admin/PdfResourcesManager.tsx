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
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { AiModelSelector, getLastUsedModel } from '@/components/admin/AiModelSelector';
import { useAdminToast as useToast } from '@/contexts/AdminMessagesContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { isReservedSlug, RESOURCE_TYPE_PATHS, type ResourceType } from '@/lib/resourceHubs';
import {
  Plus, Sparkles, Loader2, Pencil, Trash2, Search,
  ChevronLeft, ChevronRight, Download, Upload, Eye,
  FileText, Image, AlertTriangle, CheckCircle, XCircle,
  ImagePlus, ScanSearch, Wrench, Camera,
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
// SEO health helpers
// ═══════════════════════════════════════════════════════════════

interface SeoHealth {
  hasTitle: boolean;
  hasMetaTitle: boolean;
  hasSlug: boolean;
  hasMetaDesc: boolean;
  hasCategory: boolean;
  hasExcerpt: boolean;
  hasSubject: boolean;
  hasTags: boolean;
  hasImage: boolean;
  hasContent: boolean;
  score: number; // 0-10
  missing: string[];
}

function computeSeoHealth(r: PdfResource): SeoHealth {
  const checks = {
    hasTitle: !!(r.title && r.title.length > 5),
    hasMetaTitle: !!(r.meta_title && r.meta_title.length > 10),
    hasSlug: !!(r.slug && r.slug.length > 3),
    hasMetaDesc: !!(r.meta_description && r.meta_description.length > 30),
    hasCategory: !!r.category,
    hasExcerpt: !!(r.excerpt && r.excerpt.length > 10),
    hasSubject: !!r.subject,
    hasTags: !!(r.tags && r.tags.length > 0),
    hasImage: !!r.cover_image_url,
    hasContent: !!(r.word_count && r.word_count > 100),
  };
  const missing: string[] = [];
  if (!checks.hasTitle) missing.push('Title');
  if (!checks.hasMetaTitle) missing.push('Meta Title');
  if (!checks.hasSlug) missing.push('Slug');
  if (!checks.hasMetaDesc) missing.push('Meta Desc');
  if (!checks.hasCategory) missing.push('Category');
  if (!checks.hasExcerpt) missing.push('Excerpt');
  if (!checks.hasSubject) missing.push('Subject');
  if (!checks.hasTags) missing.push('Tags');
  if (!checks.hasImage) missing.push('Image');
  if (!checks.hasContent) missing.push('Content');
  const score = Object.values(checks).filter(Boolean).length;
  return { ...checks, score, missing };
}

function needsMetadataFix(r: PdfResource): boolean {
  const h = computeSeoHealth(r);
  return !h.hasTitle || !h.hasMetaTitle || !h.hasSlug || !h.hasMetaDesc || !h.hasCategory || !h.hasExcerpt || !h.hasSubject || !h.hasTags;
}

function needsCoverImage(r: PdfResource): boolean {
  return !r.cover_image_url;
}

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
  const [aiModel, setAiModel] = useState(() => getLastUsedModel('text', 'gemini-flash'));
  const [imageAiModel, setImageAiModel] = useState(() => getLastUsedModel('image', 'gemini-flash-image'));
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [extractingMeta, setExtractingMeta] = useState(false);
  const [generatingImage, setGeneratingImage] = useState(false);
  const [slugError, setSlugError] = useState('');

  // Bulk state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkUploading, setBulkUploading] = useState(false);
  const [bulkUploadProgress, setBulkUploadProgress] = useState({ current: 0, total: 0 });

  // Bulk AI scan/fix state
  const [bulkMetaScanResult, setBulkMetaScanResult] = useState<number | null>(null);
  const [bulkMetaFixing, setBulkMetaFixing] = useState(false);
  const [bulkMetaProgress, setBulkMetaProgress] = useState({ current: 0, total: 0 });

  const [bulkImageScanResult, setBulkImageScanResult] = useState<number | null>(null);
  const [bulkImageGenerating, setBulkImageGenerating] = useState(false);
  const [bulkImageProgress, setBulkImageProgress] = useState({ current: 0, total: 0 });

  // Bulk publish state
  const [bulkPublishPhase, setBulkPublishPhase] = useState<'idle' | 'selected' | 'publishing'>('idle');
  const [bulkPublishProgress, setBulkPublishProgress] = useState({ current: 0, total: 0 });

  // Per-row loading states
  const [rowFixingId, setRowFixingId] = useState<string | null>(null);
  const [rowImageId, setRowImageId] = useState<string | null>(null);

  const bulkFileRef = useRef<HTMLInputElement>(null);
  const stopBulkRef = useRef(false);

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
    setSelectedIds(new Set());
    setBulkMetaScanResult(null);
    setBulkImageScanResult(null);
  }, [typeFilter, statusFilter, search, page, toast]);

  useEffect(() => { fetchResources(); }, [fetchResources]);

  // ─── Helpers ──────────────────────────────────────────────
  const generateSlug = (title: string) =>
    title.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').substring(0, 100);

  const validateSlug = (slug: string) => {
    if (isReservedSlug(slug)) { setSlugError('This slug is reserved.'); return false; }
    setSlugError('');
    return true;
  };

  const getAuthToken = async () => {
    const session = await supabase.auth.getSession();
    return session.data.session?.access_token;
  };

  const isRetryableImageError = (message: string, status?: number) => {
    const normalized = message.toLowerCase();
    return status === 429
      || status === 408
      || status === 503
      || normalized.includes('rate limit')
      || normalized.includes('429')
      || normalized.includes('timed out')
      || normalized.includes('timeout')
      || normalized.includes('signal has been aborted')
      || normalized.includes('temporarily unavailable');
  };

  // ─── AI Metadata Extraction from filename ─────────────────
  const extractMetadataForFile = async (fileName: string, resourceType: string, token: string) => {
    const resp = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-resource-content`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'extract-metadata', fileName, resourceType, aiModel }),
      },
    );
    const result = await resp.json();
    if (!result.success) throw new Error(result.error || 'Metadata extraction failed');
    return result.data?.[0];
  };

  const handleExtractMetadata = async (fileName: string) => {
    setExtractingMeta(true);
    try {
      const token = await getAuthToken();
      const meta = await extractMetadataForFile(fileName, editItem.resource_type || 'sample_paper', token!);
      if (!meta) throw new Error('No metadata returned');
      setEditItem(prev => ({
        ...prev,
        title: meta.title || prev.title,
        meta_title: meta.meta_title || prev.meta_title,
        slug: meta.slug || prev.slug,
        meta_description: meta.meta_description || prev.meta_description,
        category: meta.category || prev.category,
        excerpt: meta.excerpt || prev.excerpt,
        subject: meta.subject || prev.subject,
        language: meta.language || prev.language,
        exam_year: meta.exam_year || prev.exam_year,
        edition_year: meta.edition_year || prev.edition_year,
        tags: meta.tags || prev.tags,
        download_filename: meta.download_filename || prev.download_filename,
        featured_image_alt: meta.featured_image_alt || prev.featured_image_alt,
        exam_name: meta.exam_name || prev.exam_name,
      }));
      toast({ title: '✨ Metadata auto-filled', description: `AI extracted SEO fields from "${fileName}"` });
    } catch (err: any) {
      toast({ title: 'Metadata extraction failed', description: err.message, variant: 'destructive' });
    } finally {
      setExtractingMeta(false);
    }
  };

  // ─── Single row metadata fix ──────────────────────────────
  const handleRowMetaFix = async (r: PdfResource) => {
    setRowFixingId(r.id);
    try {
      const token = await getAuthToken();
      const fileName = r.download_filename || r.title || r.slug;
      const meta = await extractMetadataForFile(fileName, r.resource_type, token!);
      if (!meta) throw new Error('No metadata returned');

      const updates: any = {};
      if (!r.title || r.title.length <= 5) updates.title = meta.title;
      if (!r.meta_title || r.meta_title.length <= 10) updates.meta_title = meta.meta_title;
      if (!r.slug || r.slug.length <= 3) updates.slug = meta.slug;
      if (!r.meta_description || r.meta_description.length <= 30) updates.meta_description = meta.meta_description;
      if (!r.category) updates.category = meta.category;
      if (!r.excerpt || r.excerpt.length <= 10) updates.excerpt = meta.excerpt;
      if (!r.subject) updates.subject = meta.subject || meta.category || 'General';
      if (!r.tags || r.tags.length === 0) updates.tags = meta.tags;
      if (!r.featured_image_alt) updates.featured_image_alt = meta.featured_image_alt;
      if (!r.download_filename) updates.download_filename = meta.download_filename;
      if (!r.exam_name) updates.exam_name = meta.exam_name;
      if (!r.language) updates.language = meta.language;
      if (meta.exam_year && !r.exam_year) updates.exam_year = meta.exam_year;
      if (meta.edition_year && !r.edition_year) updates.edition_year = meta.edition_year;

      if (Object.keys(updates).length > 0) {
        updates.ai_model_used = aiModel;
        updates.ai_generated_at = new Date().toISOString();
        const { error } = await supabase.from('pdf_resources').update(updates).eq('id', r.id);
        if (error) throw error;
      }
      toast({ title: '✓ Fixed', description: `SEO metadata updated for "${r.title}"` });
      fetchResources();
    } catch (err: any) {
      toast({ title: 'Fix failed', description: err.message, variant: 'destructive' });
    } finally {
      setRowFixingId(null);
    }
  };

  // ─── Single row image generation ──────────────────────────
  const generateImageForResource = async (r: PdfResource, token: string) => {
    const resp = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-resource-image`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          slug: r.slug, title: r.title, category: r.category,
          subject: r.subject, resourceType: r.resource_type, imageModel: imageAiModel,
        }),
      },
    );
    if (resp.status === 429) throw new Error('Rate limited — try again later');
    if (resp.status === 402) throw new Error('Payment required — add funds');
    const result = await resp.json();
    if (!result.success && !result.imageUrl) throw new Error(result.error || 'Image generation failed');
    return result;
  };

  const handleRowImageGen = async (r: PdfResource) => {
    setRowImageId(r.id);
    try {
      const token = await getAuthToken();
      const result = await generateImageForResource(r, token!);
      const { error } = await supabase.from('pdf_resources').update({
        cover_image_url: result.imageUrl,
        featured_image_alt: result.altText || r.featured_image_alt,
      }).eq('id', r.id);
      if (error) throw error;
      toast({ title: '🖼️ Cover generated', description: `Image created for "${r.title}"` });
      fetchResources();
    } catch (err: any) {
      toast({ title: 'Image failed', description: err.message, variant: 'destructive' });
    } finally {
      setRowImageId(null);
    }
  };

  // ─── PDF Upload (single) ─────────────────────────────────
  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.name.endsWith('.pdf')) {
      toast({ title: 'Invalid file', description: 'Please upload a PDF file.', variant: 'destructive' });
      return;
    }
    setUploadingPdf(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const fileSizeBytes = file.size;
      const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const fileHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

      const { data: dupes } = await supabase
        .from('pdf_resources').select('id, title, slug')
        .eq('file_hash', fileHash).neq('id', editItem.id || '00000000-0000-0000-0000-000000000000');
      if (dupes && dupes.length > 0) {
        const dupe = dupes[0] as any;
        toast({ title: '⚠️ Duplicate file', description: `Identical to "${dupe.title}".`, variant: 'destructive' });
      }

      let pageCount: number | null = null;
      try {
        const { PDFDocument } = await import('pdf-lib');
        const pdfDoc = await PDFDocument.load(arrayBuffer);
        pageCount = pdfDoc.getPageCount();
      } catch {}

      const resourceType = editItem.resource_type || 'sample_paper';
      const typePath = RESOURCE_TYPE_PATHS[resourceType as ResourceType];
      const slug = editItem.slug || generateSlug(editItem.title || 'resource');
      const storagePath = `pdfs/${typePath}/${slug}.pdf`;

      const { error: uploadError } = await supabase.storage
        .from('blog-assets').upload(storagePath, file, { upsert: true, contentType: 'application/pdf' });
      if (uploadError) throw uploadError;

      const { data: publicUrl } = supabase.storage.from('blog-assets').getPublicUrl(storagePath);
      setEditItem(prev => ({
        ...prev, file_url: publicUrl.publicUrl, file_size_bytes: fileSizeBytes,
        file_hash: fileHash, page_count: pageCount, download_filename: `${slug}.pdf`,
      }));
      toast({ title: 'PDF uploaded', description: `${fileSizeBytes > 1048576 ? (fileSizeBytes / 1048576).toFixed(1) + ' MB' : (fileSizeBytes / 1024).toFixed(0) + ' KB'}${pageCount ? ` · ${pageCount} pages` : ''}` });
      handleExtractMetadata(file.name);
    } catch (err: any) {
      toast({ title: 'Upload failed', description: err.message, variant: 'destructive' });
    } finally {
      setUploadingPdf(false);
    }
  };

  // ─── Bulk PDF Upload ──────────────────────────────────────
  const handleBulkUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const pdfFiles = Array.from(files).filter(f => f.name.toLowerCase().endsWith('.pdf'));
    if (pdfFiles.length === 0) {
      toast({ title: 'No PDFs', description: 'No PDF files found in selection.', variant: 'destructive' });
      return;
    }

    setBulkUploading(true);
    setBulkUploadProgress({ current: 0, total: pdfFiles.length });
    const token = await getAuthToken();
    let successCount = 0;

    for (let i = 0; i < pdfFiles.length; i++) {
      setBulkUploadProgress({ current: i + 1, total: pdfFiles.length });
      const file = pdfFiles[i];
      try {
        const arrayBuffer = await file.arrayBuffer();
        const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
        const fileHash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');

        const tempSlug = generateSlug(file.name.replace('.pdf', ''));
        const resourceType = typeFilter;
        const typePath = RESOURCE_TYPE_PATHS[resourceType as ResourceType];
        const storagePath = `pdfs/${typePath}/${tempSlug}.pdf`;

        await supabase.storage.from('blog-assets').upload(storagePath, file, { upsert: true, contentType: 'application/pdf' });
        const { data: publicUrl } = supabase.storage.from('blog-assets').getPublicUrl(storagePath);

        let pageCount: number | null = null;
        try {
          const { PDFDocument } = await import('pdf-lib');
          const pdfDoc = await PDFDocument.load(arrayBuffer);
          pageCount = pdfDoc.getPageCount();
        } catch {}

        // Extract metadata via AI
        let meta: any = {};
        try {
          meta = await extractMetadataForFile(file.name, resourceType, token!) || {};
        } catch {}

        const { error } = await supabase.from('pdf_resources').insert({
          resource_type: resourceType,
          title: meta.title || file.name.replace('.pdf', ''),
          slug: meta.slug || tempSlug,
          download_filename: meta.download_filename || `${tempSlug}.pdf`,
          file_url: publicUrl.publicUrl,
          file_size_bytes: file.size,
          file_hash: fileHash,
          page_count: pageCount,
          meta_title: meta.meta_title || null,
          meta_description: meta.meta_description || null,
          category: meta.category || null,
          excerpt: meta.excerpt || null,
          subject: meta.subject || null,
          language: meta.language || 'hindi',
          exam_year: meta.exam_year || null,
          edition_year: meta.edition_year || null,
          tags: meta.tags || [],
          exam_name: meta.exam_name || null,
          featured_image_alt: meta.featured_image_alt || null,
          content: '',
          status: 'draft',
          author_id: user?.id,
          ai_model_used: aiModel,
          ai_generated_at: new Date().toISOString(),
        } as any);
        if (!error) successCount++;
      } catch (err: any) {
        console.error(`Bulk upload failed for ${file.name}:`, err.message);
      }
    }

    setBulkUploading(false);
    toast({ title: `Bulk upload complete`, description: `${successCount}/${pdfFiles.length} files uploaded & metadata extracted.` });
    if (bulkFileRef.current) bulkFileRef.current.value = '';
    fetchResources();
  };

  // ─── Fetch ALL resources of current type (for bulk ops) ───
  const fetchAllResourcesForBulk = async (): Promise<PdfResource[]> => {
    const all: PdfResource[] = [];
    const batchSize = 500;
    let from = 0;
    let hasMore = true;
    while (hasMore) {
      let query = supabase
        .from('pdf_resources')
        .select('*')
        .eq('resource_type', typeFilter)
        .order('created_at', { ascending: false })
        .range(from, from + batchSize - 1);
      if (statusFilter !== 'all') query = query.eq('status', statusFilter);
      if (search) query = query.ilike('title', `%${search}%`);
      const { data, error } = await query;
      if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); break; }
      all.push(...((data || []) as unknown as PdfResource[]));
      hasMore = (data?.length || 0) === batchSize;
      from += batchSize;
    }
    return all;
  };

  // ─── Bulk Metadata Scan & Fix ─────────────────────────────
  const handleBulkMetaScan = async () => {
    const allResources = await fetchAllResourcesForBulk();
    const count = allResources.filter(needsMetadataFix).length;
    setBulkMetaScanResult(count);
    toast({ title: 'Scan complete', description: `${count} of ${allResources.length} file(s) need SEO metadata fix.` });
  };

  const handleBulkMetaFix = async () => {
    const allResources = await fetchAllResourcesForBulk();
    const toFix = allResources.filter(needsMetadataFix);
    if (toFix.length === 0) { toast({ title: 'All good', description: 'No files need metadata fix.' }); return; }

    setBulkMetaFixing(true);
    setBulkMetaProgress({ current: 0, total: toFix.length });
    stopBulkRef.current = false;
    const token = await getAuthToken();
    let fixed = 0;
    let failed = 0;

    for (let i = 0; i < toFix.length; i++) {
      if (stopBulkRef.current) break;
      setBulkMetaProgress({ current: i + 1, total: toFix.length });
      const r = toFix[i];
      try {
        const fileName = r.download_filename || r.title || r.slug;
        const meta = await extractMetadataForFile(fileName, r.resource_type, token!);
        if (!meta) { failed++; continue; }

        const updates: any = {};
        if (!r.title || r.title.length <= 5) updates.title = meta.title;
        if (!r.meta_title || r.meta_title.length <= 10) updates.meta_title = meta.meta_title?.substring(0, 60);
        if (!r.slug || r.slug.length <= 3) updates.slug = meta.slug;
        if (!r.meta_description || r.meta_description.length <= 30) updates.meta_description = meta.meta_description?.substring(0, 160);
        if (!r.category) updates.category = meta.category;
        if (!r.excerpt || r.excerpt.length <= 10) updates.excerpt = meta.excerpt;
        // Subject: use AI value, fallback to category or "General"
        if (!r.subject) updates.subject = meta.subject || meta.category || 'General';
        if (!r.tags || r.tags.length === 0) updates.tags = meta.tags;
        if (!r.featured_image_alt) updates.featured_image_alt = meta.featured_image_alt;
        if (!r.download_filename) updates.download_filename = meta.download_filename;
        if (!r.exam_name) updates.exam_name = meta.exam_name;
        if (!r.language) updates.language = meta.language;
        if (meta.exam_year && !r.exam_year) updates.exam_year = meta.exam_year;
        if (meta.edition_year && !r.edition_year) updates.edition_year = meta.edition_year;

        if (Object.keys(updates).length > 0) {
          updates.ai_model_used = aiModel;
          updates.ai_generated_at = new Date().toISOString();
          const { error } = await supabase.from('pdf_resources').update(updates).eq('id', r.id);
          if (error) { console.error(`DB update failed for ${r.id}:`, error.message); failed++; }
          else fixed++;
        }
      } catch (err: any) {
        console.error(`Bulk meta fix failed for ${r.id}:`, err.message);
        failed++;
      }
    }

    setBulkMetaFixing(false);
    setBulkMetaScanResult(null);
    toast({ title: 'Bulk fix complete', description: `${fixed} fixed, ${failed} failed out of ${toFix.length}.` });
    fetchResources();
  };

  // ─── Bulk Image Scan & Generate ───────────────────────────
  const handleBulkImageScan = async () => {
    const allResources = await fetchAllResourcesForBulk();
    const count = allResources.filter(needsCoverImage).length;
    setBulkImageScanResult(count);
    toast({ title: 'Scan complete', description: `${count} of ${allResources.length} file(s) need a cover image.` });
  };

  const handleBulkImageGenerate = async () => {
    const allResources = await fetchAllResourcesForBulk();
    const toGen = allResources.filter(needsCoverImage);
    if (toGen.length === 0) { toast({ title: 'All good', description: 'All files have cover images.' }); return; }

    setBulkImageGenerating(true);
    setBulkImageProgress({ current: 0, total: toGen.length });
    stopBulkRef.current = false;
    const token = await getAuthToken();
    const interRequestDelayMs = imageAiModel.startsWith('vertex') ? 35000 : 10000;
    let generated = 0;

    for (let i = 0; i < toGen.length; i++) {
      if (stopBulkRef.current) break;
      setBulkImageProgress({ current: i + 1, total: toGen.length });
      const r = toGen[i];
      try {
        const result = await generateImageForResource(r, token!);
        const { error } = await supabase.from('pdf_resources').update({
          cover_image_url: result.imageUrl,
          featured_image_alt: result.altText || r.featured_image_alt,
        }).eq('id', r.id);
        if (error) { console.error(`DB update failed for ${r.id}:`, error.message); }
        else generated++;
      } catch (err: any) {
        // Stop immediately on payment/credits error — no point retrying
        if (err.message?.includes('Payment') || err.message?.includes('402') || err.message?.includes('funds')) {
          toast({ title: '⛔ Credits exhausted', description: 'Bulk generation stopped. Add funds or switch to Vertex AI model.', variant: 'destructive' });
          break;
        }
        if (err?.retryable || isRetryableImageError(err.message, err.status)) {
          const cooldownMs = imageAiModel.startsWith('vertex') ? 60000 : 30000;
          toast({ title: 'Retrying image generation', description: `Rate limit hit. Cooling down ${Math.round(cooldownMs / 1000)}s before retry...`, variant: 'destructive' });
          await new Promise(resolve => setTimeout(resolve, cooldownMs));
          if (!stopBulkRef.current) {
            try {
              const retryResult = await generateImageForResource(r, token!);
              const { error } = await supabase.from('pdf_resources').update({
                cover_image_url: retryResult.imageUrl,
                featured_image_alt: retryResult.altText || r.featured_image_alt,
              }).eq('id', r.id);
              if (!error) generated++;
              else console.error(`Retry DB update failed for ${r.id}:`, error.message);
            } catch (retryErr: any) {
              console.error(`Retry also failed for ${r.id}:`, retryErr.message);
            }
          }
        } else {
          console.error(`Bulk image failed for ${r.id}:`, err.message);
        }
      }

      if (i < toGen.length - 1 && !stopBulkRef.current) {
        await new Promise(resolve => setTimeout(resolve, interRequestDelayMs));
      }
    }

    setBulkImageGenerating(false);
    setBulkImageScanResult(null);
    toast({ title: 'Bulk image complete', description: `${generated}/${toGen.length} images generated.` });
    fetchResources();
  };

  // ─── AI Cover Image Generation (dialog) ───────────────────
  const handleGenerateImage = async () => {
    if (!editItem.title || !editItem.slug) {
      toast({ title: 'Title & slug required', variant: 'destructive' });
      return;
    }
    setGeneratingImage(true);
    try {
      const token = await getAuthToken();
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-resource-image`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            slug: editItem.slug, title: editItem.title, category: editItem.category,
            subject: editItem.subject, resourceType: editItem.resource_type, imageModel: imageAiModel,
          }),
        },
      );
      if (resp.status === 429) { toast({ title: 'Rate limited', variant: 'destructive' }); return; }
      if (resp.status === 402) { toast({ title: 'Payment required', variant: 'destructive' }); return; }
      const result = await resp.json();
      if (!result.success && !result.imageUrl) throw new Error(result.error || 'Failed');
      setEditItem(prev => ({ ...prev, cover_image_url: result.imageUrl, featured_image_alt: result.altText || prev.featured_image_alt }));
      toast({ title: '🖼️ Cover image generated' });
    } catch (err: any) {
      toast({ title: 'Image failed', description: err.message, variant: 'destructive' });
    } finally {
      setGeneratingImage(false);
    }
  };

  // ─── AI Content Generation ────────────────────────────────
  const handleGenerate = async () => {
    if (!editItem.title) { toast({ title: 'Title required', variant: 'destructive' }); return; }
    setGenerating(true);
    try {
      const token = await getAuthToken();
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-resource-content`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            action: 'generate', title: editItem.title, resourceType: editItem.resource_type,
            category: editItem.category, examName: editItem.exam_name, subject: editItem.subject,
            language: editItem.language, tags: editItem.tags, year: editItem.exam_year,
            slug: editItem.slug, aiModel,
          }),
        },
      );
      const result = await resp.json();
      if (!result.success) throw new Error(result.error || 'Generation failed');
      const data = result.data;
      const wordCount = data.word_count || (data.content?.replace(/<[^>]*>/g, '').split(/\s+/).length || 0);
      setEditItem(prev => ({
        ...prev, content: data.content || prev.content, excerpt: data.excerpt || prev.excerpt,
        meta_title: data.meta_title || prev.meta_title, meta_description: data.meta_description || prev.meta_description,
        faq_schema: data.faq_items || prev.faq_schema, tags: data.suggested_tags || prev.tags,
        word_count: wordCount, ai_model_used: aiModel, ai_generated_at: new Date().toISOString(),
        content_hash: data.content_hash || null, status: prev.status === 'draft' ? 'generated' : prev.status,
      }));
      toast({ title: 'Content generated', description: `${wordCount} words` });
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
        resource_type: editItem.resource_type, title: editItem.title, slug: editItem.slug,
        download_filename: editItem.download_filename || `${editItem.slug}.pdf`,
        file_url: editItem.file_url || null, file_size_bytes: editItem.file_size_bytes || null,
        page_count: editItem.page_count || null, file_hash: editItem.file_hash || null,
        cover_image_url: editItem.cover_image_url || null, featured_image_alt: editItem.featured_image_alt || null,
        content: editItem.content || '', excerpt: editItem.excerpt || null,
        meta_title: editItem.meta_title || null, meta_description: editItem.meta_description || null,
        faq_schema: editItem.faq_schema || [], category: editItem.category || null,
        exam_name: editItem.exam_name || null, subject: editItem.subject || null,
        language: editItem.language || 'hindi', exam_year: editItem.exam_year || null,
        edition_year: editItem.edition_year || null, tags: editItem.tags || [],
        status: editItem.status || 'draft', is_featured: editItem.is_featured || false,
        is_trending: editItem.is_trending || false, is_published: editItem.status === 'published',
        is_noindex: editItem.is_noindex || false, duplicate_approved: editItem.duplicate_approved || false,
        review_notes: editItem.review_notes || null, word_count: editItem.word_count || 0,
        reading_time: Math.max(1, Math.ceil((editItem.word_count || 0) / 200)),
        ai_model_used: editItem.ai_model_used || null, ai_generated_at: editItem.ai_generated_at || null,
        content_hash: editItem.content_hash || null,
      };
      if (editItem.id) {
        const { error } = await supabase.from('pdf_resources').update(payload).eq('id', editItem.id);
        if (error) throw error;
        toast({ title: 'Resource updated' });
      } else {
        payload.author_id = user?.id;
        if (payload.status === 'published') payload.published_at = new Date().toISOString();
        const { error } = await supabase.from('pdf_resources').insert(payload);
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

  // ─── Status & Delete ──────────────────────────────────────
  const handleStatusChange = async (id: string, newStatus: string) => {
    const updatePayload: any = { status: newStatus };
    if (newStatus === 'published') { updatePayload.is_published = true; updatePayload.published_at = new Date().toISOString(); }
    else updatePayload.is_published = false;
    const { error } = await supabase.from('pdf_resources').update(updatePayload).eq('id', id);
    if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' });
    else { toast({ title: `Status → ${newStatus}` }); fetchResources(); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this resource?')) return;
    const { error } = await supabase.from('pdf_resources').delete().eq('id', id);
    if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' });
    else { toast({ title: 'Deleted' }); fetchResources(); }
  };

  // ─── Selection ────────────────────────────────────────────
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  };
  const toggleSelectAll = () => {
    if (selectedIds.size === resources.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(resources.map(r => r.id)));
  };

  // ─── Bulk Publish ─────────────────────────────────────────
  const handleBulkPublish = async () => {
    if (bulkPublishPhase === 'idle') {
      // Phase 1: select all unpublished
      const unpublishedIds = resources.filter(r => r.status !== 'published').map(r => r.id);
      if (unpublishedIds.length === 0) {
        toast({ title: 'All resources are already published' });
        return;
      }
      setSelectedIds(new Set(unpublishedIds));
      setBulkPublishPhase('selected');
      toast({ title: `${unpublishedIds.length} unpublished resources selected`, description: 'Click "Publish Selected" again to publish them all.' });
      return;
    }

    // Phase 2: publish selected
    const toPublish = resources.filter(r => selectedIds.has(r.id) && r.status !== 'published');
    if (toPublish.length === 0) {
      toast({ title: 'No unpublished resources selected' });
      setBulkPublishPhase('idle');
      return;
    }

    setBulkPublishPhase('publishing');
    setBulkPublishProgress({ current: 0, total: toPublish.length });

    let published = 0;
    for (const r of toPublish) {
      const { error } = await supabase.from('pdf_resources').update({
        status: 'published',
        is_published: true,
        published_at: new Date().toISOString(),
      }).eq('id', r.id);
      if (!error) published++;
      setBulkPublishProgress(prev => ({ ...prev, current: prev.current + 1 }));
    }

    toast({ title: `Published ${published}/${toPublish.length} resources` });
    setBulkPublishPhase('idle');
    setSelectedIds(new Set());
    fetchResources();
  };

  // ─── Download Titles ──────────────────────────────────────
  const handleDownloadTitles = async () => {
    // Fetch ALL titles for the current type (not just current page)
    const { data, error } = await supabase
      .from('pdf_resources')
      .select('title')
      .eq('resource_type', typeFilter)
      .order('created_at', { ascending: false });

    if (error || !data) {
      toast({ title: 'Error fetching titles', variant: 'destructive' });
      return;
    }

    const text = data.map(r => r.title).join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${typeFilter}_titles.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: `Downloaded ${data.length} titles` });
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const isBulkBusy = bulkMetaFixing || bulkImageGenerating || bulkUploading || bulkPublishPhase === 'publishing';

  // ─── SEO indicator dot ────────────────────────────────────
  const SeoIndicator = ({ resource }: { resource: PdfResource }) => {
    const h = computeSeoHealth(resource);
    const color = h.score >= 9 ? 'text-green-600' : h.score >= 6 ? 'text-yellow-500' : 'text-destructive';
    const Icon = h.score >= 9 ? CheckCircle : h.score >= 6 ? AlertTriangle : XCircle;
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className={`inline-flex items-center gap-0.5 ${color}`}>
              <Icon className="h-3.5 w-3.5" />
              <span className="text-[10px] font-medium">{h.score}/10</span>
            </span>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-xs">
            {h.missing.length > 0
              ? <p className="text-xs">Missing: {h.missing.join(', ')}</p>
              : <p className="text-xs text-green-600">All SEO fields filled ✓</p>
            }
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };

  // ═══════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col lg:flex-row lg:items-center gap-3 justify-between">
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            PDF Resources Manager
          </CardTitle>

          {/* AI Model Selectors — sidebar-level */}
          <div className="flex flex-wrap items-center gap-3 p-2 rounded-lg border bg-muted/30">
            <div className="flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Text AI</span>
              <AiModelSelector value={aiModel} onValueChange={setAiModel} capability="text" size="sm" triggerClassName="w-[180px] h-7 text-xs" />
            </div>
            <div className="flex items-center gap-1.5">
              <Camera className="h-3.5 w-3.5 text-primary" />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Image AI</span>
              <AiModelSelector value={imageAiModel} onValueChange={setImageAiModel} capability="image" size="sm" triggerClassName="w-[180px] h-7 text-xs" />
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Type tabs */}
        <Tabs value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setPage(1); }}>
          <TabsList>
            <TabsTrigger value="sample_paper">Sample Papers</TabsTrigger>
            <TabsTrigger value="book">Books</TabsTrigger>
            <TabsTrigger value="previous_year_paper">Previous Year Papers</TabsTrigger>
            <TabsTrigger value="guide">Guides</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Toolbar */}
        <div className="flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
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

          {/* Bulk actions row */}
          <div className="flex flex-wrap items-center gap-2 p-2.5 rounded-lg border bg-muted/20">
            {/* Bulk Upload */}
            <input ref={bulkFileRef} type="file" accept=".pdf" multiple className="hidden"
              onChange={handleBulkUpload} />
            <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs"
              disabled={isBulkBusy}
              onClick={() => bulkFileRef.current?.click()}>
              {bulkUploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
              {bulkUploading ? `Uploading ${bulkUploadProgress.current}/${bulkUploadProgress.total}…` : 'Bulk Upload PDFs'}
            </Button>

            <div className="h-5 w-px bg-border" />

            {/* Bulk Meta Scan → Fix */}
            {bulkMetaScanResult === null ? (
              <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs"
                disabled={isBulkBusy || resources.length === 0}
                onClick={handleBulkMetaScan}>
                <ScanSearch className="h-3.5 w-3.5" />
                Scan Metadata
              </Button>
            ) : (
              <div className="flex items-center gap-1.5">
                <Badge variant={bulkMetaScanResult > 0 ? 'destructive' : 'default'} className="text-xs">
                  {bulkMetaScanResult} need fix
                </Badge>
                {bulkMetaScanResult > 0 && (
                  <Button variant="default" size="sm" className="gap-1.5 h-8 text-xs"
                    disabled={bulkMetaFixing}
                    onClick={handleBulkMetaFix}>
                    {bulkMetaFixing
                      ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Fixing {bulkMetaProgress.current}/{bulkMetaProgress.total}</>
                      : <><Wrench className="h-3.5 w-3.5" /> Fix All</>
                    }
                  </Button>
                )}
                {!bulkMetaFixing && (
                  <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setBulkMetaScanResult(null)}>✕</Button>
                )}
              </div>
            )}

            {bulkMetaFixing && (
              <div className="flex-1 min-w-[100px] max-w-[200px]">
                <Progress value={(bulkMetaProgress.current / bulkMetaProgress.total) * 100} className="h-2" />
              </div>
            )}

            <div className="h-5 w-px bg-border" />

            {/* Bulk Image Scan → Generate */}
            {bulkImageScanResult === null ? (
              <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs"
                disabled={isBulkBusy || resources.length === 0}
                onClick={handleBulkImageScan}>
                <ScanSearch className="h-3.5 w-3.5" />
                Scan Images
              </Button>
            ) : (
              <div className="flex items-center gap-1.5">
                <Badge variant={bulkImageScanResult > 0 ? 'destructive' : 'default'} className="text-xs">
                  {bulkImageScanResult} need image
                </Badge>
                {bulkImageScanResult > 0 && (
                  <Button variant="default" size="sm" className="gap-1.5 h-8 text-xs"
                    disabled={bulkImageGenerating}
                    onClick={handleBulkImageGenerate}>
                    {bulkImageGenerating
                      ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Generating {bulkImageProgress.current}/{bulkImageProgress.total}</>
                      : <><ImagePlus className="h-3.5 w-3.5" /> Generate All</>
                    }
                  </Button>
                )}
                {!bulkImageGenerating && (
                  <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setBulkImageScanResult(null)}>✕</Button>
                )}
              </div>
            )}

            {bulkImageGenerating && (
              <div className="flex-1 min-w-[100px] max-w-[200px]">
                <Progress value={(bulkImageProgress.current / bulkImageProgress.total) * 100} className="h-2" />
              </div>
            )}

            <div className="h-5 w-px bg-border" />

            {/* Bulk Publish */}
            <Button
              variant={bulkPublishPhase === 'selected' ? 'default' : 'outline'}
              size="sm"
              className="gap-1.5 h-8 text-xs"
              disabled={isBulkBusy && bulkPublishPhase !== 'selected'}
              onClick={handleBulkPublish}
            >
              {bulkPublishPhase === 'publishing' ? (
                <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Publishing {bulkPublishProgress.current}/{bulkPublishProgress.total}</>
              ) : bulkPublishPhase === 'selected' ? (
                <><CheckCircle className="h-3.5 w-3.5" /> Publish Selected ({selectedIds.size})</>
              ) : (
                <><Eye className="h-3.5 w-3.5" /> Select Unpublished</>
              )}
            </Button>
            {bulkPublishPhase === 'selected' && (
              <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => { setBulkPublishPhase('idle'); setSelectedIds(new Set()); }}>✕</Button>
            )}

            {bulkPublishPhase === 'publishing' && (
              <div className="flex-1 min-w-[100px] max-w-[200px]">
                <Progress value={(bulkPublishProgress.current / bulkPublishProgress.total) * 100} className="h-2" />
              </div>
            )}

            <div className="h-5 w-px bg-border" />

            {/* Download Titles */}
            <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs"
              disabled={isBulkBusy || resources.length === 0}
              onClick={handleDownloadTitles}>
              <FileText className="h-3.5 w-3.5" /> Download Titles
            </Button>

            {(bulkMetaFixing || bulkImageGenerating) && (
              <Button variant="destructive" size="sm" className="h-8 text-xs ml-auto"
                onClick={() => { stopBulkRef.current = true; }}>
                Stop
              </Button>
            )}
          </div>
        </div>

        {/* Bulk upload progress */}
        {bulkUploading && (
          <div className="space-y-1">
            <Progress value={(bulkUploadProgress.current / bulkUploadProgress.total) * 100} className="h-2" />
            <p className="text-xs text-muted-foreground text-center">
              Uploading {bulkUploadProgress.current}/{bulkUploadProgress.total} PDFs…
            </p>
          </div>
        )}

        {/* Table */}
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8">
                  <Checkbox checked={resources.length > 0 && selectedIds.size === resources.length}
                    onCheckedChange={toggleSelectAll} />
                </TableHead>
                <TableHead>Title</TableHead>
                <TableHead className="w-16">SEO</TableHead>
                <TableHead className="w-14">
                  <Camera className="h-3.5 w-3.5" />
                </TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-12">DLs</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8">Loading...</TableCell></TableRow>
              ) : resources.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No resources found</TableCell></TableRow>
              ) : resources.map((r) => {
                const seo = computeSeoHealth(r);
                return (
                  <TableRow key={r.id} className={selectedIds.has(r.id) ? 'bg-primary/5' : ''}>
                    <TableCell>
                      <Checkbox checked={selectedIds.has(r.id)} onCheckedChange={() => toggleSelect(r.id)} />
                    </TableCell>
                    <TableCell>
                      <div className="max-w-xs">
                        <p className="font-medium text-sm truncate">{r.title}</p>
                        <p className="text-[11px] text-muted-foreground truncate">/{RESOURCE_TYPE_PATHS[r.resource_type as ResourceType]}/{r.slug}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <SeoIndicator resource={r} />
                    </TableCell>
                    <TableCell>
                      {r.cover_image_url ? (
                        <CheckCircle className="h-3.5 w-3.5 text-green-600" />
                      ) : (
                        <XCircle className="h-3.5 w-3.5 text-destructive" />
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {r.category && <Badge variant="outline" className="text-[10px] mr-1">{r.category}</Badge>}
                        {r.exam_name && <span className="text-[10px] text-muted-foreground">{r.exam_name}</span>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={`text-[10px] ${STATUS_COLORS[r.status] || ''}`}>{r.status}</Badge>
                    </TableCell>
                    <TableCell className="text-xs">{r.download_count}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-0.5 justify-end">
                        {/* AI Fix metadata button */}
                        {needsMetadataFix(r) && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-7 w-7"
                                  disabled={rowFixingId === r.id}
                                  onClick={() => handleRowMetaFix(r)}>
                                  {rowFixingId === r.id
                                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    : <Wrench className="h-3.5 w-3.5 text-yellow-600" />}
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Fix SEO metadata with AI</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                        {/* AI Generate image button */}
                        {needsCoverImage(r) && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-7 w-7"
                                  disabled={rowImageId === r.id}
                                  onClick={() => handleRowImageGen(r)}>
                                  {rowImageId === r.id
                                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    : <ImagePlus className="h-3.5 w-3.5 text-blue-600" />}
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Generate cover image with AI</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                        <Button variant="ghost" size="icon" className="h-7 w-7"
                          onClick={() => { setEditItem(r); setDialogOpen(true); }}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        {r.is_published && (
                          <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                            <a href={`/${RESOURCE_TYPE_PATHS[r.resource_type as ResourceType]}/${r.slug}`} target="_blank" rel="noopener noreferrer">
                              <Eye className="h-3.5 w-3.5" />
                            </a>
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDelete(r.id)}>
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
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

        {/* ═══════════════════════════════════════════════════════════ */}
        {/* Edit Dialog */}
        {/* ═══════════════════════════════════════════════════════════ */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editItem.id ? 'Edit Resource' : 'New Resource'}</DialogTitle>
            </DialogHeader>

            {/* AI Model Selectors — dialog bar */}
            <div className="flex flex-wrap gap-3 p-3 rounded-lg border bg-muted/30">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="text-xs font-medium text-muted-foreground">Text AI:</span>
                <AiModelSelector value={aiModel} onValueChange={setAiModel} capability="text" size="sm" />
              </div>
              <div className="flex items-center gap-2">
                <Image className="h-4 w-4 text-primary" />
                <span className="text-xs font-medium text-muted-foreground">Image AI:</span>
                <AiModelSelector value={imageAiModel} onValueChange={setImageAiModel} capability="image" size="sm" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Left column */}
              <div className="space-y-4">
                {/* PDF Upload */}
                <div className="border rounded-lg p-3 space-y-2 bg-primary/5">
                  <div className="flex items-center gap-2 mb-1">
                    <Upload className="h-4 w-4 text-primary" />
                    <span className="font-medium text-sm">Upload PDF</span>
                    {extractingMeta && (
                      <Badge variant="outline" className="text-xs gap-1 animate-pulse">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        AI extracting…
                      </Badge>
                    )}
                  </div>
                  <div className="flex gap-2 items-center">
                    <Input type="file" accept=".pdf" onChange={handlePdfUpload} disabled={uploadingPdf || extractingMeta} />
                    {uploadingPdf && <Loader2 className="h-4 w-4 animate-spin" />}
                  </div>
                  {editItem.file_url && (
                    <p className="text-xs text-muted-foreground">
                      ✓ Uploaded · {editItem.file_size_bytes ? `${(editItem.file_size_bytes / 1048576).toFixed(1)} MB` : ''}
                      {editItem.page_count ? ` · ${editItem.page_count} pages` : ''}
                    </p>
                  )}
                  <p className="text-[11px] text-muted-foreground">Upload PDF → AI auto-fills Title, Meta, Slug, Tags, etc.</p>
                </div>

                <div>
                  <Label>Title *</Label>
                  <Input value={editItem.title || ''} onChange={(e) => {
                    const title = e.target.value;
                    setEditItem(prev => ({
                      ...prev, title, slug: prev.id ? prev.slug : generateSlug(title),
                      download_filename: prev.id ? prev.download_filename : `${generateSlug(title)}.pdf`,
                    }));
                  }} />
                </div>
                <div>
                  <Label>Slug *</Label>
                  <Input value={editItem.slug || ''} onChange={(e) => { setEditItem(prev => ({ ...prev, slug: e.target.value })); validateSlug(e.target.value); }} />
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
                      <SelectItem value="guide">Guide</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div><Label>Category</Label><Input value={editItem.category || ''} onChange={(e) => setEditItem(prev => ({ ...prev, category: e.target.value }))} placeholder="e.g. SSC" /></div>
                  <div><Label>Exam Name</Label><Input value={editItem.exam_name || ''} onChange={(e) => setEditItem(prev => ({ ...prev, exam_name: e.target.value }))} placeholder="e.g. SSC CGL" /></div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div><Label>Subject</Label><Input value={editItem.subject || ''} onChange={(e) => setEditItem(prev => ({ ...prev, subject: e.target.value }))} placeholder="e.g. Reasoning" /></div>
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
                  <div><Label>Exam Year</Label><Input type="number" value={editItem.exam_year || ''} onChange={(e) => setEditItem(prev => ({ ...prev, exam_year: parseInt(e.target.value) || null }))} /></div>
                  <div><Label>Edition Year</Label><Input type="number" value={editItem.edition_year || ''} onChange={(e) => setEditItem(prev => ({ ...prev, edition_year: parseInt(e.target.value) || null }))} /></div>
                </div>
                <div>
                  <Label>Tags (comma-separated)</Label>
                  <Input value={(editItem.tags || []).join(', ')} onChange={(e) => setEditItem(prev => ({ ...prev, tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean) }))} placeholder="ssc, cgl, reasoning" />
                </div>
                <div>
                  <Label>Download Filename</Label>
                  <Input value={editItem.download_filename || ''} onChange={(e) => setEditItem(prev => ({ ...prev, download_filename: e.target.value }))} />
                </div>

                {/* Cover Image */}
                <div className="border rounded-lg p-3 space-y-2 bg-muted/30">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Image className="h-4 w-4 text-primary" />
                      <span className="font-medium text-sm">Cover Image</span>
                    </div>
                    <Button size="sm" variant="outline" onClick={handleGenerateImage}
                      disabled={generatingImage || !editItem.title || !editItem.slug} className="gap-1 h-7 text-xs">
                      {generatingImage ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                      {generatingImage ? 'Generating…' : 'Generate with AI'}
                    </Button>
                  </div>
                  {editItem.cover_image_url && (
                    <img src={editItem.cover_image_url} alt={editItem.featured_image_alt || editItem.title || ''} className="w-full h-32 object-cover rounded border" />
                  )}
                  <Input value={editItem.cover_image_url || ''} onChange={(e) => setEditItem(prev => ({ ...prev, cover_image_url: e.target.value }))} placeholder="Image URL" className="text-xs" />
                  <div>
                    <Label className="text-xs">Image Alt Text</Label>
                    <Input value={editItem.featured_image_alt || ''} onChange={(e) => setEditItem(prev => ({ ...prev, featured_image_alt: e.target.value }))} className="text-xs" />
                  </div>
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

                {/* AI Content Generation */}
                <div className="border rounded-lg p-3 space-y-3 bg-muted/30">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    <span className="font-medium text-sm">AI Content Generation</span>
                  </div>
                  <Button onClick={handleGenerate} disabled={generating} className="w-full gap-2">
                    {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                    {generating ? 'Generating…' : 'Generate Content'}
                  </Button>
                </div>

                <div>
                  <Label>Content (HTML)</Label>
                  <Textarea value={editItem.content || ''} onChange={(e) => {
                    const content = e.target.value;
                    const wordCount = content.replace(/<[^>]*>/g, '').split(/\s+/).filter(Boolean).length;
                    setEditItem(prev => ({ ...prev, content, word_count: wordCount }));
                  }} rows={8} className="font-mono text-xs" />
                  <p className="text-xs text-muted-foreground mt-1">{editItem.word_count || 0} words</p>
                </div>

                <div>
                  <Label>Review Notes</Label>
                  <Textarea value={editItem.review_notes || ''} onChange={(e) => setEditItem(prev => ({ ...prev, review_notes: e.target.value }))} rows={2} placeholder="Internal notes…" />
                </div>

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
