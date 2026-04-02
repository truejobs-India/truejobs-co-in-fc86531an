import { useState, useEffect, useCallback, useRef } from 'react';
import type { Editor } from '@tiptap/react';
import { supabase } from '@/integrations/supabase/client';
import { calcLiveWordCount, calcReadingTime, wordCountFields } from '@/lib/blogWordCount';
import { useAuth } from '@/contexts/AuthContext';
import { useAdminToast as useToast } from '@/contexts/AdminMessagesContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogTrigger, DialogFooter, DialogClose, DialogDescription
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger
} from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Edit, Trash2, Eye, EyeOff, ExternalLink, RefreshCw, ClipboardCopy, Link2, AlertTriangle, Search, ChevronDown, ChevronLeft, ChevronRight, ImageIcon, Sparkles, Loader2, Check, X, Zap, Download, FileText, Square, RotateCcw } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { RichTextEditor } from './blog/RichTextEditor';
import { CoverImageUploader } from './blog/CoverImageUploader';
import { WordFileImporter } from './blog/WordFileImporter';
import { BlogAdminStats } from './blog/BlogAdminStats';
import { BlogStatsDrilldown, type DrilldownFilter } from './blog/BlogStatsDrilldown';
import { BlogArticleReport } from './blog/BlogArticleReport';
import { BlogSEOChecklist } from './blog/BlogSEOChecklist';
import { InternalLinkSuggester } from './blog/InternalLinkSuggester';
import { FeaturedImageGenerator } from './blog/FeaturedImageGenerator';
import { PublishReadinessBadge } from './blog/PublishReadinessBadge';
import { BLOG_REDIRECTS } from '@/lib/blogRedirects';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  analyzeQuality, analyzeSEO, getReadinessStatus, blogPostToMetadata,
  type QualityReport, type SEOReport
} from '@/lib/blogArticleAnalyzer';
import {
  detectInlineSlots, insertInlineImage, getContextForSlot,
  buildArticleImagesMetadata, isInvalidImageUrl,
  type InlineSlotStatus,
} from '@/lib/blogInlineImages';
import {
  analyzePublishCompliance, getComplianceReadinessStatus,
} from '@/lib/blogComplianceAnalyzer';
import { ComplianceReadinessBadge } from './blog/ComplianceReadinessBadge';
import { BlogComplianceChecklist } from './blog/BlogComplianceChecklist';
import { BlogPolicyWarnings } from './blog/BlogPolicyWarnings';
import { Checkbox } from '@/components/ui/checkbox';
import { BlogAITools } from './blog/BlogAITools';
import { normalizeBlogCategory, VALID_BLOG_CATEGORIES } from '@/lib/blogCategoryUtils';
import { BulkWorkflowPanel } from './blog/BulkWorkflowPanel';
import { PendingActionsPanel } from './blog/PendingActionsPanel';
import { SeoMetadataWorkflowPanel } from './blog/SeoMetadataWorkflowPanel';
import { BulkEnrichByWordCount } from './blog/BulkEnrichByWordCount';
import { extractStoragePath, extractInlineUrlsFromContent, removeInlineImageFromContent } from './blog/BlogImageCleanup';
import { BlogScoreBreakdown } from './blog/BlogScoreBreakdown';
import { VertexAITools } from './blog/VertexAITools';
import { AiModelSelector } from '@/components/admin/AiModelSelector';
import { getModelDef, getRecommendedModelsForTarget } from '@/lib/aiModels';
import { useBulkAutoFix } from '@/hooks/useBulkAutoFix';

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  content: string;
  excerpt: string | null;
  cover_image_url: string | null;
  featured_image_alt: string | null;
  is_published: boolean;
  published_at: string | null;
  meta_title: string | null;
  meta_description: string | null;
  created_at: string;
  updated_at: string;
  word_count: number | null;
  category: string | null;
  tags: string[] | null;
  faq_count: number | null;
  has_faq_schema: boolean | null;
  faq_schema: any;
  internal_links: any;
  canonical_url: string | null;
  author_name: string | null;
  ai_fixed_at: string | null;
  article_images: any;
}

const POSTS_PER_PAGE = 20;

const generateSlug = (title: string): string => {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
};

export function BlogPostEditor() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<BlogPost | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showRedirectMap, setShowRedirectMap] = useState(false);
  const [showDuplicates, setShowDuplicates] = useState(false);
  const [drilldownFilter, setDrilldownFilter] = useState<DrilldownFilter | null>(null);
  const [drilldownOpen, setDrilldownOpen] = useState(false);
  const [duplicateSlugs, setDuplicateSlugs] = useState<{ slug: string; count: number }[]>([]);

  // Fix All dialog state
  const [fixAllDialogPost, setFixAllDialogPost] = useState<BlogPost | null>(null);
  const [fixAllRunning, setFixAllRunning] = useState(false);
  const [fixAllResults, setFixAllResults] = useState<{ autoFixed: { field: string; value: string }[]; reviewRequired: any[]; unresolved: any[] } | null>(null);

  // Enrich dialog state
  const [enrichDialogPost, setEnrichDialogPost] = useState<BlogPost | null>(null);
  const [enrichWordLimit, setEnrichWordLimit] = useState(1500);
  const [enrichResult, setEnrichResult] = useState<{ content: string; wordCount: number; changes: string[] } | null>(null);
  const [isEnriching, setIsEnriching] = useState(false);

  // Bulk generator state
  const [showBulkGenerator, setShowBulkGenerator] = useState(false);
  const [bulkTopics, setBulkTopics] = useState('');
  const [bulkCategory, setBulkCategory] = useState<string | null>(null);
  const [bulkWordCount, setBulkWordCount] = useState(1500);
  const [duplicateCheckResults, setDuplicateCheckResults] = useState<{ topic: string; matchedTitle: string; matchedSlug: string }[]>([]);
  const [isCheckingDuplicates, setIsCheckingDuplicates] = useState(false);
  const [bulkResults, setBulkResults] = useState<{ topic: string; status: 'queued' | 'generating' | 'success' | 'failed'; articleId?: string; error?: string }[]>([]);
  const [isBulkGenerating, setIsBulkGenerating] = useState(false);
  const bulkGenerateAbortRef = useRef(false);

  // ── Persistent AI Model selectors (localStorage-backed, no fallbacks) ──
  const [blogTextModel, setBlogTextModel] = useState<string>(() => {
    try { return localStorage.getItem('blog_text_ai_model') || 'gemini-flash'; } catch { return 'gemini-flash'; }
  });
  const [outputLanguage, setOutputLanguage] = useState<'auto' | 'english' | 'hindi'>(() => {
    try { return (localStorage.getItem('blog_output_language') as 'auto' | 'english' | 'hindi') || 'auto'; } catch { return 'auto'; }
  });
  const handleOutputLanguageChange = useCallback((v: string) => {
    const val = v as 'auto' | 'english' | 'hindi';
    setOutputLanguage(val);
    try { localStorage.setItem('blog_output_language', val); } catch {}
  }, []);
  const [blogImageModel, setBlogImageModel] = useState<string>(() => {
    try { return localStorage.getItem('blog_image_ai_model') || 'vertex-imagen'; } catch { return 'vertex-imagen'; }
  });
  const handleTextModelChange = useCallback((v: string) => {
    setBlogTextModel(v);
    try { localStorage.setItem('blog_text_ai_model', v); } catch {}
  }, []);
  const handleImageModelChange = useCallback((v: string) => {
    setBlogImageModel(v);
    try { localStorage.setItem('blog_image_ai_model', v); } catch {}
  }, []);

  // Image model selectors (separate for cover and inline)
  const [coverImageModel, setCoverImageModel] = useState<string>(() => {
    try {
      const migrationKey = 'blog_cover_model_migrated_v1';
      const stored = localStorage.getItem('blog_cover_image_model');
      if (!localStorage.getItem(migrationKey)) {
        localStorage.setItem(migrationKey, '1');
        if (!stored || stored === 'gemini-flash-image') {
          localStorage.setItem('blog_cover_image_model', 'gemini-pro-image');
          return 'gemini-pro-image';
        }
      }
      return stored || 'gemini-pro-image';
    } catch { return 'gemini-pro-image'; }
  });
  const [inlineImageModel, setInlineImageModel] = useState<string>(() => {
    try { return localStorage.getItem('blog_inline_image_model') || 'vertex-imagen'; } catch { return 'vertex-imagen'; }
  });
  const handleCoverImageModelChange = useCallback((v: string) => {
    setCoverImageModel(v);
    try { localStorage.setItem('blog_cover_image_model', v); } catch {}
  }, []);
  const handleInlineImageModelChange = useCallback((v: string) => {
    setInlineImageModel(v);
    try { localStorage.setItem('blog_inline_image_model', v); } catch {}
  }, []);

  // Bulk cover image generation state
  const [isBulkCoverRunning, setIsBulkCoverRunning] = useState(false);
  const [bulkCoverProgress, setBulkCoverProgress] = useState<{ total: number; done: number; failed: number; current: string } | null>(null);
  const bulkCoverAbortRef = useRef(false);

  // Bulk inline image generation state
  const [isBulkInlineRunning, setIsBulkInlineRunning] = useState(false);
  const [bulkInlineProgress, setBulkInlineProgress] = useState<{ total: number; done: number; failed: number; skipped: number; current: string } | null>(null);
  const bulkInlineAbortRef = useRef(false);

  // Per-article image generation loading
  const [perArticleLoading, setPerArticleLoading] = useState<Record<string, 'cover' | 'inline' | null>>({});

  // Bulk workflow panel is now handled by BulkWorkflowPanel component

  // Search, filter, pagination
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'published' | 'draft'>('all');
  const [currentPage, setCurrentPage] = useState(1);

  // Image cleanup selection state
  const [selectedPostIds, setSelectedPostIds] = useState<Set<string>>(new Set());
  const [imageCleanupLoading, setImageCleanupLoading] = useState<'cover' | 'inline' | null>(null);

  // Bulk Fix All by AI — hook initialized after fetchPosts below

  // Autosave
  const autosaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Quality/SEO/Compliance panels
  const [qualityOpen, setQualityOpen] = useState(false);
  const [seoOpen, setSeoOpen] = useState(false);
  const [linksOpen, setLinksOpen] = useState(false);
  const [complianceOpen, setComplianceOpen] = useState(false);
  const [publishOverride, setPublishOverride] = useState(false);
  const [showNeedsReviewConfirm, setShowNeedsReviewConfirm] = useState(false);
  const [editorInstance, setEditorInstance] = useState<Editor | null>(null);

  const [formData, setFormData] = useState({
    title: '',
    slug: '',
    content: '',
    excerpt: '',
    cover_image_url: '',
    featured_image_alt: '',
    is_published: false,
    meta_title: '',
    meta_description: '',
    author_name: 'TrueJobs Editorial Team',
    category: null as string | null,
    tags: null as string[] | null,
    canonical_url: '',
  });

  useEffect(() => {
    fetchPosts();
  }, []);

  // Autosave effect
  useEffect(() => {
    if (!editingPost || !hasUnsavedChanges) return;
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = setTimeout(() => {
      handleAutoSave();
    }, 5000);
    return () => {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    };
  }, [formData, hasUnsavedChanges, editingPost]);

  const fetchPosts = async () => {
    const { data, error } = await supabase
      .from('blog_posts')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setPosts(data as BlogPost[]);
    }
    setIsLoading(false);
  };

  // Bulk Fix All by AI — autonomous pipeline
  const bulkAutoFix = useBulkAutoFix(posts, blogTextModel, fetchPosts);

  const resetForm = () => {
    setFormData({
      title: '', slug: '', content: '', excerpt: '',
      cover_image_url: '', featured_image_alt: '', is_published: false,
      meta_title: '', meta_description: '', author_name: 'TrueJobs Editorial Team',
      category: null, tags: null, canonical_url: '',
    });
    setEditingPost(null);
    setHasUnsavedChanges(false);
    setPublishOverride(false);
  };

  const openEditDialog = (post: BlogPost) => {
    setEditingPost(post);
    setFormData({
      title: post.title,
      slug: post.slug,
      content: post.content,
      excerpt: post.excerpt || '',
      cover_image_url: post.cover_image_url || '',
      featured_image_alt: post.featured_image_alt || '',
      is_published: post.is_published,
      meta_title: post.meta_title || '',
      meta_description: post.meta_description || '',
      author_name: post.author_name || 'TrueJobs Editorial Team',
      category: post.category || null,
      tags: post.tags || null,
      canonical_url: post.canonical_url || '',
    });
    setHasUnsavedChanges(false);
    setPublishOverride(false);
    setIsDialogOpen(true);
  };

  const handleFormChange = (updates: Partial<typeof formData>) => {
    setFormData(prev => ({ ...prev, ...updates }));
    setHasUnsavedChanges(true);
  };

  const handleTitleChange = (value: string) => {
    handleFormChange({
      title: value,
      slug: editingPost ? formData.slug : generateSlug(value),
    });
  };

  const handleWordImport = (html: string) => {
    handleFormChange({ content: html });
  };

  const handleArticleParsed = (article: import('@/lib/blogParser').ParsedArticle) => {
    const updates: Partial<typeof formData> = { content: article.content };
    if (article.title) updates.title = article.title;
    if (article.slug) updates.slug = article.slug;
    if (article.excerpt) updates.excerpt = article.excerpt;
    if (article.metaTitle) updates.meta_title = article.metaTitle;
    if (article.metaDescription) updates.meta_description = article.metaDescription;
    if (article.coverImageAlt) updates.featured_image_alt = article.coverImageAlt;
    if (article.coverImageUrl) updates.cover_image_url = article.coverImageUrl;
    if (article.authorName) updates.author_name = article.authorName;
    handleFormChange(updates);
  };

  const handleCoverGenerated = (url: string, alt: string) => {
    handleFormChange({ cover_image_url: url, featured_image_alt: alt });
  };

  const handleAutoSave = async () => {
    if (!editingPost || !formData.title.trim()) return;
    const postData = buildPostData();
    const { error } = await supabase.from('blog_posts').update(postData).eq('id', editingPost.id);
    if (!error) {
      setHasUnsavedChanges(false);
    }
  };

  const buildPostData = () => {
    const contentTrimmed = formData.content.trim();
    const { word_count, reading_time } = wordCountFields(contentTrimmed);
    return {
      title: formData.title.trim(),
      slug: (formData.slug || generateSlug(formData.title)).replace(/^\/+/, ''),
      content: contentTrimmed,
      excerpt: formData.excerpt.trim() || null,
      cover_image_url: formData.cover_image_url.trim() || null,
      featured_image_alt: formData.featured_image_alt.trim() || null,
      is_published: formData.is_published,
      published_at: formData.is_published ? new Date().toISOString() : null,
      meta_title: formData.meta_title.trim() || null,
      meta_description: formData.meta_description.trim() || null,
      author_name: formData.author_name.trim() || null,
      canonical_url: formData.canonical_url.trim() || null,
      category: normalizeBlogCategory(formData.category),
      tags: formData.tags || [],
      author_id: user!.id,
      ai_fixed_at: null, // Clear AI fixed status on manual save
      word_count,
      reading_time,
    };
  };

  const executeSubmit = async () => {
    if (!formData.title.trim() || !formData.content.trim()) {
      toast({ title: 'Error', description: 'Title and content are required', variant: 'destructive' });
      return;
    }
    setIsSaving(true);
    const postData = buildPostData();
    let error;
    if (editingPost) {
      const { error: updateError } = await supabase.from('blog_posts').update(postData).eq('id', editingPost.id);
      error = updateError;
    } else {
      const { error: insertError } = await supabase.from('blog_posts').insert(postData);
      error = insertError;
    }
    setIsSaving(false);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: editingPost ? 'Post updated' : 'Post created' });
      setIsDialogOpen(false);
      resetForm();
      fetchPosts();
    }
  };

  const handleSubmit = () => {
    if (!formData.title.trim() || !formData.content.trim()) {
      toast({ title: 'Error', description: 'Title and content are required', variant: 'destructive' });
      return;
    }

    // Compliance gating — only when publishing
    if (formData.is_published) {
      if (complianceStatus === 'Blocked' && !publishOverride) {
        toast({ title: 'Blocked', description: 'Article is blocked from publishing. Fix critical issues or override.', variant: 'destructive' });
        return;
      }
      if (complianceStatus === 'Needs Review') {
        setShowNeedsReviewConfirm(true);
        return;
      }
    }

    executeSubmit();
  };

  const handleDelete = async (postId: string) => {
    const { error } = await supabase.from('blog_posts').delete().eq('id', postId);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Post deleted' });
      fetchPosts();
    }
  };

  const togglePublish = async (post: BlogPost) => {
    const { word_count, reading_time } = wordCountFields(post.content);
    const { error } = await supabase.from('blog_posts').update({
      is_published: !post.is_published,
      published_at: !post.is_published ? new Date().toISOString() : null,
      word_count,
      reading_time,
    }).eq('id', post.id);
    if (!error) {
      fetchPosts();
      toast({ title: post.is_published ? 'Post unpublished' : 'Post published' });
    }
  };

  // ── Utility Functions ──────────────────────────────
  const handleSyncCanonicalUrls = async () => {
    const { data: allPosts } = await supabase.from('blog_posts').select('id, slug, canonical_url');
    if (allPosts) {
      let updated = 0;
      for (const p of allPosts) {
        const expected = `https://truejobs.co.in/blog/${p.slug}`;
        if (p.canonical_url !== expected) {
          await supabase.from('blog_posts').update({ canonical_url: expected }).eq('id', p.id);
          updated++;
        }
      }
      toast({ title: '✅ Canonical URLs synced', description: `${updated} posts updated.` });
    }
  };

  const handleCopyUrlsForGSC = async () => {
    const { data } = await supabase.from('blog_posts').select('slug').eq('is_published', true).order('published_at', { ascending: false });
    if (data && data.length > 0) {
      const urls = data.map(p => `https://truejobs.co.in/blog/${p.slug}`).join('\n');
      await navigator.clipboard.writeText(urls);
      toast({ title: '📋 Copied!', description: `${data.length} blog URLs copied.` });
    }
  };

  const handleCopyArticleTitles = async () => {
    const { data } = await supabase.from('blog_posts').select('title').order('created_at', { ascending: false });
    if (data && data.length > 0) {
      const titles = data.map(p => p.title).join('\n');
      await navigator.clipboard.writeText(titles);
      toast({ title: '📋 Copied!', description: `${data.length} article titles copied to clipboard.` });
    }
  };

  const handleDownloadArticleTitles = async () => {
    const { data } = await supabase.from('blog_posts').select('title').order('created_at', { ascending: false });
    if (data && data.length > 0) {
      const titles = data.map(p => p.title).join('\n');
      const blob = new Blob([titles], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `blog-article-titles-${new Date().toISOString().slice(0, 10)}.txt`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: '⬇️ Downloaded!', description: `${data.length} article titles saved.` });
    }
  };

  const handleCheckDuplicateSlugs = async () => {
    const { data } = await supabase.from('blog_posts').select('slug');
    if (data) {
      const counts: Record<string, number> = {};
      for (const p of data) counts[p.slug] = (counts[p.slug] || 0) + 1;
      const dupes = Object.entries(counts).filter(([, c]) => c > 1).map(([slug, count]) => ({ slug, count }));
      if (dupes.length > 0) {
        setDuplicateSlugs(dupes);
        setShowDuplicates(true);
      } else {
        toast({ title: '✅ No duplicate slugs found' });
      }
    }
  };

  // ── Bulk Generate Missing Cover Images (ENFORCED: gemini-flash-image) ──
  const handleBulkGenerateCoverImages = async () => {
    bulkCoverAbortRef.current = false;
    setIsBulkCoverRunning(true);
    setBulkCoverProgress(null);
    try {
      // Fetch all posts and filter client-side for invalid cover URLs
      const { data: allPosts, error } = await supabase
        .from('blog_posts')
        .select('id, title, slug, category, tags, cover_image_url')
        .order('created_at', { ascending: false });

      if (error) throw error;
      const noCoverPosts = (allPosts || []).filter(p => isInvalidImageUrl(p.cover_image_url));

      if (noCoverPosts.length === 0) {
        toast({ title: '✅ All articles already have valid cover images!' });
        setIsBulkCoverRunning(false);
        return;
      }

      // Frontend validation guard
      const coverModelDef = getModelDef(coverImageModel);
      if (!coverModelDef?.capabilities.includes('image')) {
        toast({ title: 'Invalid model', description: `"${coverImageModel}" is not an image-capable model.`, variant: 'destructive' });
        setIsBulkCoverRunning(false);
        return;
      }

      const total = noCoverPosts.length;
      let done = 0;
      let failed = 0;
      const runtimeModels = new Set<string>();
      setBulkCoverProgress({ total, done, failed, current: noCoverPosts[0].title });

      for (const post of noCoverPosts) {
        if (bulkCoverAbortRef.current) {
          toast({ title: '⏹️ Cover image generation stopped', description: `${done} generated, ${failed} failed, ${total - done - failed} skipped.` });
          break;
        }
        setBulkCoverProgress({ total, done, failed, current: post.title });
        try {
          const { data: imgData, error: imgError } = await supabase.functions.invoke('generate-vertex-image', {
            body: { slug: post.slug, title: post.title, category: post.category || 'General', tags: post.tags || [], model: coverImageModel, purpose: 'cover', imageCount: 1, aspectRatio: '16:9', strict: true },
          });
          if (imgError || !imgData?.data?.images?.[0]?.url) {
            console.warn(`Cover image failed for "${post.title}":`, imgError?.message || imgData?.error || 'No image returned');
            failed++;
            continue;
          }
          const coverUrl = imgData.data.images[0].url;
          const coverAlt = imgData.data.images[0].altText || post.title;
          // Track runtime metadata
          const rp = imgData.resolvedProvider || imgData.data?.resolvedProvider;
          const rm = imgData.resolvedRuntimeModelId || imgData.data?.resolvedRuntimeModelId || imgData.model;
          if (rp && rm) runtimeModels.add(`${rm} (${rp})`);
          else if (rm) runtimeModels.add(rm);

          await supabase.from('blog_posts').update({
            cover_image_url: coverUrl,
            featured_image_alt: coverAlt,
          }).eq('id', post.id);
          done++;
        } catch (genErr: any) {
          console.warn(`Cover image error for "${post.title}":`, genErr.message);
          failed++;
        }
        setBulkCoverProgress({ total, done: done + failed, failed, current: post.title });

        if (done + failed < total) {
          await new Promise(r => setTimeout(r, 3000));
        }
      }

      if (!bulkCoverAbortRef.current) {
        const runtimeSummary = runtimeModels.size === 1
          ? ` via ${[...runtimeModels][0]}`
          : runtimeModels.size > 1 ? ' (mixed runtime)' : '';
        toast({
          title: '🖼️ Cover image generation complete',
          description: `${done} generated${runtimeSummary}, ${failed} failed out of ${total} articles.`,
        });
      }
      fetchPosts();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setIsBulkCoverRunning(false);
      setBulkCoverProgress(null);
    }
  };

  // ── Bulk Generate Missing In-Between Images (ENFORCED: vertex-imagen) ──
  const handleBulkGenerateInlineImages = async () => {
    bulkInlineAbortRef.current = false;
    setIsBulkInlineRunning(true);
    setBulkInlineProgress(null);
    try {
      const { data: allPosts, error } = await supabase
        .from('blog_posts')
        .select('id, title, slug, content, category, tags, article_images')
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (!allPosts || allPosts.length === 0) {
        toast({ title: '✅ No articles found' });
        setIsBulkInlineRunning(false);
        return;
      }

      // Scan all posts for missing inline slots
      const postsNeedingInline = allPosts.filter(post => {
        const status = detectInlineSlots(post.content || '', post.article_images);
        return (!status.slot1Filled && status.canPlaceSlot1) || (!status.slot2Filled && status.canPlaceSlot2);
      });

      if (postsNeedingInline.length === 0) {
        toast({ title: '✅ All articles already have in-between images!' });
        setIsBulkInlineRunning(false);
        return;
      }

      // Frontend validation guard for inline model
      const inlineModelDef = getModelDef(inlineImageModel);
      if (!inlineModelDef?.capabilities.includes('image')) {
        toast({ title: 'Invalid model', description: `"${inlineImageModel}" is not an image-capable model.`, variant: 'destructive' });
        setIsBulkInlineRunning(false);
        return;
      }

      const total = postsNeedingInline.length;
      let done = 0;
      let failed = 0;
      let skipped = 0;
      const runtimeModels = new Set<string>();
      setBulkInlineProgress({ total, done, failed, skipped, current: postsNeedingInline[0].title });

      for (const post of postsNeedingInline) {
        if (bulkInlineAbortRef.current) {
          toast({ title: '⏹️ Inline image generation stopped', description: `${done} done, ${failed} failed, ${skipped} skipped.` });
          break;
        }
        setBulkInlineProgress({ total, done, failed, skipped, current: post.title });

        try {
          const status = detectInlineSlots(post.content || '', post.article_images);
          let updatedContent = post.content || '';
          let updatedArticleImages = post.article_images || {};
          let anySuccess = false;

          // Helper to track runtime from response
          const trackRuntime = (imgData: any) => {
            const rp = imgData?.resolvedProvider || imgData?.data?.resolvedProvider;
            const rm = imgData?.resolvedRuntimeModelId || imgData?.data?.resolvedRuntimeModelId || imgData?.model;
            if (rp && rm) runtimeModels.add(`${rm} (${rp})`);
            else if (rm) runtimeModels.add(rm);
          };

          // Process slot 1
          if (!status.slot1Filled && status.canPlaceSlot1) {
            const ctx = getContextForSlot(updatedContent, 1, post.title, post.category);
            const { data: imgData, error: imgError } = await supabase.functions.invoke('generate-vertex-image', {
              body: { slug: post.slug, title: post.title, category: post.category || 'General', tags: post.tags || [], model: inlineImageModel, purpose: 'inline', slotNumber: 1, contextSnippet: ctx.nearbyText, nearbyHeading: ctx.nearbyHeading, strict: true },
            });
            if (!imgError && imgData?.data?.images?.[0]?.url) {
              trackRuntime(imgData);
              const imgUrl = imgData.data.images[0].url;
              const altText = imgData.data.images[0].altText || `${post.title} - illustration`;
              const result = insertInlineImage(updatedContent, 1, imgUrl, altText);
              if (result) {
                updatedContent = result;
                updatedArticleImages = buildArticleImagesMetadata(updatedArticleImages, 1, imgUrl, altText);
                anySuccess = true;
              }
            }
          }

          // Process slot 2
          if (!status.slot2Filled && status.canPlaceSlot2) {
            const ctx = getContextForSlot(updatedContent, 2, post.title, post.category);
            const { data: imgData, error: imgError } = await supabase.functions.invoke('generate-vertex-image', {
              body: { slug: post.slug, title: post.title, category: post.category || 'General', tags: post.tags || [], model: inlineImageModel, purpose: 'inline', slotNumber: 2, contextSnippet: ctx.nearbyText, nearbyHeading: ctx.nearbyHeading, strict: true },
            });
            if (!imgError && imgData?.data?.images?.[0]?.url) {
              trackRuntime(imgData);
              const imgUrl = imgData.data.images[0].url;
              const altText = imgData.data.images[0].altText || `${post.title} - illustration`;
              const result = insertInlineImage(updatedContent, 2, imgUrl, altText);
              if (result) {
                updatedContent = result;
                updatedArticleImages = buildArticleImagesMetadata(updatedArticleImages, 2, imgUrl, altText);
                anySuccess = true;
              }
            }
          }

          if (anySuccess) {
            await supabase.from('blog_posts').update({
              content: updatedContent,
              article_images: updatedArticleImages,
            }).eq('id', post.id);
            done++;
          } else {
            skipped++;
          }
        } catch (genErr: any) {
          console.warn(`Inline image error for "${post.title}":`, genErr.message);
          failed++;
        }

        setBulkInlineProgress({ total, done: done + failed + skipped, failed, skipped, current: post.title });
        if (done + failed + skipped < total) {
          await new Promise(r => setTimeout(r, 3000));
        }
      }

      if (!bulkInlineAbortRef.current) {
        const runtimeSummary = runtimeModels.size === 1
          ? ` via ${[...runtimeModels][0]}`
          : runtimeModels.size > 1 ? ' (mixed runtime)' : '';
        toast({
          title: '🖼️ Inline image generation complete',
          description: `${done} done${runtimeSummary}, ${failed} failed, ${skipped} skipped out of ${total} articles.`,
        });
      }
      fetchPosts();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setIsBulkInlineRunning(false);
      setBulkInlineProgress(null);
    }
  };

  // ── Per-article cover image generation ──
  const handleGenerateCoverForPost = async (post: BlogPost) => {
    if (!isInvalidImageUrl(post.cover_image_url)) {
      toast({ title: 'Cover image already exists', description: 'This article already has a valid cover image.' });
      return;
    }
    setPerArticleLoading(prev => ({ ...prev, [post.id]: 'cover' }));
    try {
      const { data: imgData, error: imgError } = await supabase.functions.invoke('generate-vertex-image', {
        body: { slug: post.slug, title: post.title, category: post.category || 'General', tags: post.tags || [], model: coverImageModel, purpose: 'cover', imageCount: 1, aspectRatio: '16:9' },
      });
      if (imgError || !imgData?.data?.images?.[0]?.url) {
        throw new Error(imgError?.message || imgData?.error || 'No image returned');
      }
      await supabase.from('blog_posts').update({
        cover_image_url: imgData.data.images[0].url,
        featured_image_alt: imgData.data.images[0].altText || post.title,
      }).eq('id', post.id);
      toast({ title: '✅ Cover image generated', description: post.title });
      fetchPosts();
    } catch (err: any) {
      toast({ title: 'Cover generation failed', description: err.message, variant: 'destructive' });
    } finally {
      setPerArticleLoading(prev => ({ ...prev, [post.id]: null }));
    }
  };

  // ── Per-article inline image generation ──
  const handleGenerateInlineForPost = async (post: BlogPost) => {
    setPerArticleLoading(prev => ({ ...prev, [post.id]: 'inline' }));
    try {
      const status = detectInlineSlots(post.content || '', post.article_images);
      if (status.slot1Filled && status.slot2Filled) {
        toast({ title: 'All inline slots filled', description: 'Both in-between images already exist.' });
        return;
      }

      let updatedContent = post.content || '';
      let updatedArticleImages = post.article_images || {};
      const outcomes: string[] = [];

      // Slot 1
      if (!status.slot1Filled) {
        if (!status.canPlaceSlot1) {
          outcomes.push(`Slot 1 skipped: ${status.skipReasons.find(r => r.includes('slot 1')) || 'article too short'}`);
        } else {
          const ctx = getContextForSlot(updatedContent, 1, post.title, post.category);
          const { data: imgData, error: imgError } = await supabase.functions.invoke('generate-vertex-image', {
            body: { slug: post.slug, title: post.title, category: post.category || 'General', tags: post.tags || [], model: inlineImageModel, purpose: 'inline', slotNumber: 1, contextSnippet: ctx.nearbyText, nearbyHeading: ctx.nearbyHeading },
          });
          if (!imgError && imgData?.data?.images?.[0]?.url) {
            const imgUrl = imgData.data.images[0].url;
            const altText = imgData.data.images[0].altText || `${post.title} - illustration`;
            const result = insertInlineImage(updatedContent, 1, imgUrl, altText);
            if (result) {
              updatedContent = result;
              updatedArticleImages = buildArticleImagesMetadata(updatedArticleImages, 1, imgUrl, altText);
              outcomes.push('Slot 1 generated ✓');
            } else {
              outcomes.push('Slot 1 skipped: insertion point not found');
            }
          } else {
            outcomes.push(`Slot 1 failed: ${imgError?.message || imgData?.error || 'No image'}`);
          }
        }
      } else {
        outcomes.push('Slot 1 already filled ✓');
      }

      // Slot 2
      if (!status.slot2Filled) {
        if (!status.canPlaceSlot2) {
          outcomes.push(`Slot 2 skipped: ${status.skipReasons.find(r => r.includes('slot 2')) || 'article too short'}`);
        } else {
          const ctx = getContextForSlot(updatedContent, 2, post.title, post.category);
          const { data: imgData, error: imgError } = await supabase.functions.invoke('generate-vertex-image', {
            body: { slug: post.slug, title: post.title, category: post.category || 'General', tags: post.tags || [], model: inlineImageModel, purpose: 'inline', slotNumber: 2, contextSnippet: ctx.nearbyText, nearbyHeading: ctx.nearbyHeading },
          });
          if (!imgError && imgData?.data?.images?.[0]?.url) {
            const imgUrl = imgData.data.images[0].url;
            const altText = imgData.data.images[0].altText || `${post.title} - illustration`;
            const result = insertInlineImage(updatedContent, 2, imgUrl, altText);
            if (result) {
              updatedContent = result;
              updatedArticleImages = buildArticleImagesMetadata(updatedArticleImages, 2, imgUrl, altText);
              outcomes.push('Slot 2 generated ✓');
            } else {
              outcomes.push('Slot 2 skipped: insertion point not found');
            }
          } else {
            outcomes.push(`Slot 2 failed: ${imgError?.message || imgData?.error || 'No image'}`);
          }
        }
      } else {
        outcomes.push('Slot 2 already filled ✓');
      }

      // Save if anything changed
      if (updatedContent !== post.content) {
        await supabase.from('blog_posts').update({
          content: updatedContent,
          article_images: updatedArticleImages,
        }).eq('id', post.id);
        fetchPosts();
      }

      toast({ title: '🖼️ Inline images', description: outcomes.join(' | ') });
    } catch (err: any) {
      toast({ title: 'Inline generation failed', description: err.message, variant: 'destructive' });
    } finally {
      setPerArticleLoading(prev => ({ ...prev, [post.id]: null }));
    }
  };

  // Legacy bulk fix-enrich handler removed — replaced by BulkWorkflowPanel

  // ── Filtered & paginated posts ─────────────────────
  const filteredPosts = posts.filter(post => {
    const matchesSearch = !searchQuery ||
      post.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      post.slug.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' ||
      (statusFilter === 'published' && post.is_published) ||
      (statusFilter === 'draft' && !post.is_published);
    return matchesSearch && matchesStatus;
  });

  const totalPages = Math.ceil(filteredPosts.length / POSTS_PER_PAGE);
  const paginatedPosts = filteredPosts.slice(
    (currentPage - 1) * POSTS_PER_PAGE,
    currentPage * POSTS_PER_PAGE
  );

  // Word count from content
  const liveWordCount = calcLiveWordCount(formData.content);
  const liveReadingTime = calcReadingTime(liveWordCount);

  // ── Compute scores for current form data ───────────
  const currentMetadata = formData.title ? blogPostToMetadata({
    title: formData.title,
    slug: formData.slug,
    content: formData.content,
    meta_title: formData.meta_title || null,
    meta_description: formData.meta_description || null,
    excerpt: formData.excerpt || null,
    cover_image_url: formData.cover_image_url || null,
    featured_image_alt: formData.featured_image_alt || null,
    is_published: formData.is_published,
    author_name: formData.author_name || null,
    word_count: liveWordCount,
  }) : null;

  const currentQuality = currentMetadata ? analyzeQuality(currentMetadata) : null;
  const currentSEO = currentMetadata ? analyzeSEO(currentMetadata) : null;
  const currentReadiness = currentMetadata && currentQuality && currentSEO
    ? getReadinessStatus(currentQuality, currentSEO, currentMetadata) : null;

  const currentCompliance = currentMetadata ? analyzePublishCompliance(currentMetadata) : null;
  const complianceStatus = currentCompliance && currentMetadata
    ? getComplianceReadinessStatus(currentCompliance, currentMetadata) : null;

  // Auto-reset publishOverride when no longer Blocked
  useEffect(() => {
    if (complianceStatus !== 'Blocked' && publishOverride) {
      setPublishOverride(false);
    }
  }, [complianceStatus]);

  const redirectEntries = Object.entries(BLOG_REDIRECTS);

  // Helper to get score for a post in the table
  const getPostScores = (post: BlogPost) => {
    const liveWc = calcLiveWordCount(post.content);
    const postWithLiveWc = { ...post, word_count: liveWc };
    const meta = blogPostToMetadata(postWithLiveWc);
    const q = analyzeQuality(meta);
    const s = analyzeSEO(meta);
    const r = getReadinessStatus(q, s, meta);
    return { quality: q.totalScore, seo: s.totalScore, readiness: r, wordCount: liveWc };
  };

  // ── Image cleanup: toggle selection ──
  const togglePostSelection = (id: string) => {
    setSelectedPostIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const toggleSelectAllVisible = () => {
    setSelectedPostIds(prev => {
      if (prev.size === paginatedPosts.length && paginatedPosts.every(p => prev.has(p.id))) {
        return new Set();
      }
      return new Set(paginatedPosts.map(p => p.id));
    });
  };

  // ── Publish All Drafts ──
  const [isPublishingAllDrafts, setIsPublishingAllDrafts] = useState(false);
  const handlePublishAllDrafts = async () => {
    const drafts = posts.filter(p => !p.is_published);
    if (drafts.length === 0) {
      toast({ title: 'No drafts to publish', variant: 'destructive' });
      return;
    }
    setIsPublishingAllDrafts(true);
    let successCount = 0;
    let failCount = 0;
    for (const draft of drafts) {
      try {
        const { error } = await supabase
          .from('blog_posts')
          .update({
            is_published: true,
            status: 'published',
            published_at: draft.published_at || new Date().toISOString(),
          })
          .eq('id', draft.id);
        if (error) throw error;
        successCount++;
      } catch (err) {
        console.error('Failed to publish draft:', draft.slug, err);
        failCount++;
      }
    }
    setIsPublishingAllDrafts(false);
    toast({
      title: `Published ${successCount} draft(s)${failCount > 0 ? `, ${failCount} failed` : ''}`,
      variant: failCount > 0 ? 'destructive' : 'default',
    });
    if (successCount > 0) fetchPosts();
  };

  // ── Image cleanup: Delete Cover Images ──
  const handleDeleteCoverImages = async () => {
    const selected = posts.filter(p => selectedPostIds.has(p.id) && p.cover_image_url);
    if (selected.length === 0) {
      toast({ title: 'No selected articles have cover images', variant: 'destructive' });
      return;
    }
    setImageCleanupLoading('cover');
    try {
      let deletedFiles = 0;
      let cleanedDb = 0;
      const pathsToDelete: string[] = [];
      const postIdsToClean: string[] = [];

      for (const post of selected) {
        const path = extractStoragePath(post.cover_image_url!);
        if (path && path.startsWith('covers/')) {
          pathsToDelete.push(path);
          postIdsToClean.push(post.id);
        }
      }

      if (pathsToDelete.length > 0) {
        const { error } = await supabase.storage.from('blog-assets').remove(pathsToDelete);
        if (error) throw error;
        deletedFiles = pathsToDelete.length;
      }

      if (postIdsToClean.length > 0) {
        const { error: dbError } = await supabase
          .from('blog_posts')
          .update({ cover_image_url: null, featured_image_alt: null })
          .in('id', postIdsToClean);
        if (dbError) throw dbError;
        cleanedDb = postIdsToClean.length;
      }

      toast({ title: `Deleted ${deletedFiles} cover file(s), cleaned ${cleanedDb} DB record(s)` });
      setSelectedPostIds(new Set());
      fetchPosts();
    } catch (e: any) {
      toast({ title: `Cover delete failed: ${e.message}`, variant: 'destructive' });
    } finally {
      setImageCleanupLoading(null);
    }
  };

  // ── Image cleanup: Delete Inline Images ──
  const handleDeleteInlineImages = async () => {
    const selected = posts.filter(p => selectedPostIds.has(p.id));
    if (selected.length === 0) return;
    setImageCleanupLoading('inline');
    try {
      let deletedFiles = 0;
      let cleanedPosts = 0;

      for (const post of selected) {
        // Collect inline URLs from article_images and content
        const articleImagesUrls = new Set<string>();
        if (post.article_images && typeof post.article_images === 'object') {
          const ai = post.article_images as any;
          const inlineArr = Array.isArray(ai.inline) ? ai.inline : [];
          for (const entry of inlineArr) {
            if (entry?.url && typeof entry.url === 'string' && entry.url.includes('/blog-assets/inline/')) {
              articleImagesUrls.add(entry.url);
            }
          }
        }
        const contentUrls = new Set<string>(extractInlineUrlsFromContent(post.content));
        const allUrls = [...new Set([...articleImagesUrls, ...contentUrls])];

        if (allUrls.length === 0) continue;

        // Delete storage files
        const paths = allUrls
          .map(u => extractStoragePath(u))
          .filter((p): p is string => !!p && p.startsWith('inline/'));

        if (paths.length > 0) {
          const { error } = await supabase.storage.from('blog-assets').remove(paths);
          if (error) console.error('Storage delete error:', error);
          else deletedFiles += paths.length;
        }

        // Clean article_images JSON
        let updatedArticleImages = post.article_images;
        if (updatedArticleImages && typeof updatedArticleImages === 'object') {
          const ai = updatedArticleImages as any;
          if (Array.isArray(ai.inline)) {
            const filtered = ai.inline.filter((entry: any) => !allUrls.includes(entry?.url));
            const { inline: _, ...rest } = ai;
            updatedArticleImages = filtered.length > 0 ? { ...rest, inline: filtered } : (Object.keys(rest).length > 0 ? rest : null);
          }
        }

        // Clean content HTML
        let updatedContent = post.content;
        for (const url of allUrls) {
          updatedContent = removeInlineImageFromContent(updatedContent, url);
        }

        const { error: dbError } = await supabase
          .from('blog_posts')
          .update({ article_images: updatedArticleImages, content: updatedContent })
          .eq('id', post.id);
        if (dbError) throw dbError;
        cleanedPosts++;
      }

      toast({ title: `Deleted ${deletedFiles} inline file(s), cleaned ${cleanedPosts} post(s)` });
      setSelectedPostIds(new Set());
      fetchPosts();
    } catch (e: any) {
      toast({ title: `Inline delete failed: ${e.message}`, variant: 'destructive' });
    } finally {
      setImageCleanupLoading(null);
    }
  };

  // ── Safe metadata fields for auto-apply ──
  const SAFE_METADATA_FIELDS = new Set(['meta_title', 'meta_description', 'excerpt', 'featured_image_alt', 'canonical_url', 'slug', 'author_name']);

  // ── Fix All With AI handler (from list view) ──
  const handleFixAllForPost = async (post: BlogPost) => {
    setFixAllDialogPost(post);
    setFixAllRunning(true);
    setFixAllResults(null);
    try {
      const meta = blogPostToMetadata(post);
      const compliance = analyzePublishCompliance(meta);
      const failedChecks = compliance.checks.filter(c => c.status === 'fail' || c.status === 'warn');
      if (failedChecks.length === 0) {
        setFixAllResults({ autoFixed: [], reviewRequired: [], unresolved: [{ issueLabel: 'No issues found', explanation: 'All compliance checks passed.' }] });
        setFixAllRunning(false);
        return;
      }
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');
      const { data, error } = await supabase.functions.invoke('analyze-blog-compliance-fixes', {
        body: {
          title: post.title, content: post.content, slug: post.slug,
          aiModel: blogTextModel,
          issues: failedChecks.map(c => ({ key: c.key, label: c.label, detail: c.detail, recommendation: c.recommendation })),
          existingMeta: {
            meta_title: post.meta_title, meta_description: post.meta_description, excerpt: post.excerpt,
            featured_image_alt: post.featured_image_alt, author_name: post.author_name, canonical_url: post.canonical_url,
            hasCoverImage: !!post.cover_image_url, hasIntro: meta.hasIntro, hasConclusion: meta.hasConclusion,
            headings: meta.headings, wordCount: meta.wordCount, featured_image: post.cover_image_url,
            faqCount: post.faq_count ?? 0, internalLinkCount: meta.internalLinks?.length ?? 0,
          },
        },
      });
      if (error) throw new Error(error.message);

      const fixes: any[] = Array.isArray(data?.fixes) ? data.fixes : [];
      const autoFixed: { field: string; value: string }[] = [];
      const reviewRequired: any[] = [];
      const unresolved: any[] = [];

      // Separate and auto-apply safe metadata
      const updatePayload: Record<string, string> = {};
      for (const fix of fixes) {
        const mode = fix.applyMode || 'advisory';
        if (mode === 'apply_field' && fix.field && SAFE_METADATA_FIELDS.has(fix.field) && fix.suggestedValue) {
          const currentVal = (post as any)[fix.field] || '';
          if (!currentVal || currentVal.length < 3) {
            updatePayload[fix.field] = fix.suggestedValue;
            autoFixed.push({ field: fix.field, value: fix.suggestedValue });
          } else {
            reviewRequired.push(fix);
          }
        } else if (mode === 'advisory' || fix.confidence === 'low') {
          unresolved.push(fix);
        } else {
          reviewRequired.push(fix);
        }
      }

      // Apply safe metadata to DB
      if (Object.keys(updatePayload).length > 0) {
        // Also recalculate word_count from content to keep it fresh
        const { word_count, reading_time } = wordCountFields(post.content);
        (updatePayload as any).word_count = word_count;
        (updatePayload as any).reading_time = reading_time;
        await supabase.from('blog_posts').update(updatePayload).eq('id', post.id);
      }

      // Always mark as AI-fixed in DB (even if no auto-fixes, the analysis ran)
      await supabase.from('blog_posts').update({ ai_fixed_at: new Date().toISOString() } as any).eq('id', post.id);

      setFixAllResults({ autoFixed, reviewRequired, unresolved });
      await fetchPosts();
      if (Object.keys(updatePayload).length > 0) {
        toast({ title: '✨ Fix All complete', description: `${autoFixed.length} fixes applied, ${reviewRequired.length} need review` });
      } else if (autoFixed.length === 0 && reviewRequired.length === 0) {
        toast({ title: '✅ No issues found', description: 'All compliance checks passed.' });
      } else {
        toast({ title: '⚠️ Review needed', description: `${reviewRequired.length} items need manual review` });
      }
    } catch (err: any) {
      toast({ title: 'Fix All failed', description: err.message, variant: 'destructive' });
      setFixAllResults({ autoFixed: [], reviewRequired: [], unresolved: [{ issueLabel: 'Error', explanation: err.message }] });
    }
    setFixAllRunning(false);
  };

  // ── Bulk Fix All by AI: now handled by useBulkAutoFix hook ──
  const [bulkScanScope, setBulkScanScope] = useState<'smart' | 'all' | 'failed_partial' | 'selected'>('smart');
  const handleBulkFixScan = (scopeOverride?: 'smart' | 'all' | 'failed_partial' | 'selected') => {
    const scope = scopeOverride || bulkScanScope;
    const selectedPosts = posts.filter(p => selectedPostIds.has(p.id));
    if (scope === 'selected' && selectedPosts.length > 0) {
      bulkAutoFix.scanAll('selected', selectedPosts);
    } else {
      bulkAutoFix.scanAll(scope);
    }
  };

  // ── Enrich Now handler (from list view) ──
  const handleEnrichPost = async () => {
    if (!enrichDialogPost) return;
    setIsEnriching(true);
    setEnrichResult(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');
      const { data, error } = await supabase.functions.invoke('improve-blog-content', {
        body: {
          title: enrichDialogPost.title, content: enrichDialogPost.content,
          action: 'enrich-article', targetWordCount: enrichWordLimit,
          category: enrichDialogPost.category, tags: enrichDialogPost.tags,
          aiModel: blogTextModel,
        },
      });
      if (error) throw new Error(error.message);
      setEnrichResult({ content: data.result || '', wordCount: data.wordCount || 0, changes: data.changes || [] });
    } catch (err: any) {
      toast({ title: 'Enrichment failed', description: err.message, variant: 'destructive' });
    }
    setIsEnriching(false);
  };

  const applyEnrichment = async () => {
    if (!enrichDialogPost || !enrichResult) return;
    const wordCount = calcLiveWordCount(enrichResult.content);
    const { error } = await supabase.from('blog_posts').update({
      content: enrichResult.content, word_count: wordCount,
      reading_time: calcReadingTime(wordCount),
    }).eq('id', enrichDialogPost.id);
    if (error) {
      toast({ title: 'Save failed', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Enrichment applied', description: `Article updated to ~${wordCount} words` });
      setEnrichDialogPost(null);
      setEnrichResult(null);
      fetchPosts();
    }
  };

  // ── Bulk Article Generator handler ──
  const handleBulkGenerate = async () => {
    const topics = bulkTopics.split('\n').map(t => t.trim()).filter(t => t.length > 0);
    if (topics.length === 0) { toast({ title: 'Enter at least one topic', variant: 'destructive' }); return; }
    if (topics.length > 20) { toast({ title: 'Maximum 20 topics at a time', variant: 'destructive' }); return; }

    bulkGenerateAbortRef.current = false;
    setIsBulkGenerating(true);
    setBulkResults(topics.map(topic => ({ topic, status: 'queued' })));

    for (let i = 0; i < topics.length; i++) {
      if (bulkGenerateAbortRef.current) {
        setBulkResults(prev => prev.map((r, idx) => idx >= i && r.status === 'queued' ? { ...r, status: 'failed', error: 'Stopped by user' } : r));
        toast({ title: '⏹️ Bulk generation stopped' });
        break;
      }
      setBulkResults(prev => prev.map((r, idx) => idx === i ? { ...r, status: 'generating' } : r));
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error('Not authenticated');
        const { data, error } = await supabase.functions.invoke('generate-blog-article', {
          body: { topic: topics[i], category: bulkCategory, targetWordCount: bulkWordCount, aiModel: blogTextModel, outputLanguage },
        });
        if (error) throw new Error(error.message);
        if (!data?.title || !data?.content) throw new Error('Invalid AI response');

        // Prefer backend-provided word count when available
        const wordCount = data.wordCountValidation?.actualWordCount
          || calcLiveWordCount(data.content);
        // Non-blocking word count warning with model recommendation
        if (data.wordCountValidation?.status === 'fail') {
          const betterModels = getRecommendedModelsForTarget(bulkWordCount).filter(m => m.value !== blogTextModel);
          const suggestion = betterModels.length > 0 ? ` Try ${betterModels[0].label} for better results.` : '';
          toast({ title: `⚠ Word count: ${data.wordCountValidation.actualWordCount}/${data.wordCountValidation.targetWordCount} words — significantly off target.${suggestion}` });
        } else if (data.wordCountValidation?.status === 'warn') {
          toast({ title: `ℹ Word count: ${data.wordCountValidation.actualWordCount}/${data.wordCountValidation.targetWordCount} words — slightly outside range.` });
        }
        const { data: inserted, error: insertErr } = await supabase.from('blog_posts').insert({
          title: data.title, slug: data.slug, content: data.content,
          excerpt: data.excerpt || null, meta_title: data.metaTitle || null,
          meta_description: data.metaDescription || null, category: normalizeBlogCategory(data.category || bulkCategory),
          tags: data.tags || [], author_id: user!.id, author_name: 'TrueJobs Editorial Team',
          canonical_url: `https://truejobs.co.in/blog/${data.slug}`,
          is_published: false, word_count: wordCount, reading_time: Math.max(1, Math.ceil(wordCount / 200)),
        }).select('id').single();
        if (insertErr) throw new Error(insertErr.message);
        setBulkResults(prev => prev.map((r, idx) => idx === i ? { ...r, status: 'success', articleId: inserted?.id } : r));
      } catch (err: any) {
        setBulkResults(prev => prev.map((r, idx) => idx === i ? { ...r, status: 'failed', error: err.message } : r));
      }
      if (i < topics.length - 1) await new Promise(r => setTimeout(r, 2000));
    }

    setIsBulkGenerating(false);
    fetchPosts();
    if (!bulkGenerateAbortRef.current) toast({ title: 'Bulk generation complete' });
  };

  const handleRetryFailedArticles = async () => {
    const failedItems = bulkResults.filter(r => r.status === 'failed');
    if (failedItems.length === 0) { toast({ title: 'No failed articles to retry' }); return; }

    bulkGenerateAbortRef.current = false;
    setIsBulkGenerating(true);
    // Mark failed items as queued again
    setBulkResults(prev => prev.map(r => r.status === 'failed' ? { ...r, status: 'queued', error: undefined } : r));

    for (let i = 0; i < bulkResults.length; i++) {
      const item = bulkResults[i];
      if (item.status !== 'failed') continue; // only retry failed ones

      if (bulkGenerateAbortRef.current) {
        setBulkResults(prev => prev.map((r, idx) => idx >= i && r.status === 'queued' ? { ...r, status: 'failed', error: 'Stopped by user' } : r));
        toast({ title: '⏹️ Retry stopped' });
        break;
      }

      setBulkResults(prev => prev.map((r, idx) => idx === i ? { ...r, status: 'generating' } : r));
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error('Not authenticated');
        const { data, error } = await supabase.functions.invoke('generate-blog-article', {
          body: { topic: item.topic, category: bulkCategory, targetWordCount: bulkWordCount, aiModel: blogTextModel, outputLanguage },
        });
        if (error) throw new Error(error.message);
        if (!data?.title || !data?.content) throw new Error('Invalid AI response');

        // Prefer backend-provided word count when available
        const wordCount = data.wordCountValidation?.actualWordCount
          || calcLiveWordCount(data.content);
        // Non-blocking word count warning with model recommendation
        if (data.wordCountValidation?.status === 'fail') {
          const betterModels = getRecommendedModelsForTarget(bulkWordCount).filter(m => m.value !== blogTextModel);
          const suggestion = betterModels.length > 0 ? ` Try ${betterModels[0].label} for better results.` : '';
          toast({ title: `⚠ Word count: ${data.wordCountValidation.actualWordCount}/${data.wordCountValidation.targetWordCount} words — significantly off target.${suggestion}` });
        } else if (data.wordCountValidation?.status === 'warn') {
          toast({ title: `ℹ Word count: ${data.wordCountValidation.actualWordCount}/${data.wordCountValidation.targetWordCount} words — slightly outside range.` });
        }
        const { data: inserted, error: insertErr } = await supabase.from('blog_posts').insert({
          title: data.title, slug: data.slug, content: data.content,
          excerpt: data.excerpt || null, meta_title: data.metaTitle || null,
          meta_description: data.metaDescription || null, category: data.category || bulkCategory || 'Career Advice',
          tags: data.tags || [], author_id: user!.id, author_name: 'TrueJobs Editorial Team',
          canonical_url: `https://truejobs.co.in/blog/${data.slug}`,
          is_published: false, word_count: wordCount, reading_time: Math.max(1, Math.ceil(wordCount / 200)),
        }).select('id').single();
        if (insertErr) throw new Error(insertErr.message);
        setBulkResults(prev => prev.map((r, idx) => idx === i ? { ...r, status: 'success', articleId: inserted?.id } : r));
      } catch (err: any) {
        setBulkResults(prev => prev.map((r, idx) => idx === i ? { ...r, status: 'failed', error: err.message } : r));
      }
      await new Promise(r => setTimeout(r, 2000));
    }

    setIsBulkGenerating(false);
    fetchPosts();
    if (!bulkGenerateAbortRef.current) toast({ title: 'Retry complete' });
  };

  return (
    <>
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Blog Posts</CardTitle>
          <CardDescription>Manage blog content for SEO and user engagement</CardDescription>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />New Post</Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingPost ? 'Edit Post' : 'Create New Post'}</DialogTitle>
              {editingPost && (
                <DialogDescription className="flex items-center gap-3">
                  <span className="text-xs">Last edited: {formatDistanceToNow(new Date(editingPost.updated_at), { addSuffix: true })}</span>
                  {hasUnsavedChanges && <Badge variant="secondary" className="text-xs">Unsaved</Badge>}
                  {currentReadiness && <PublishReadinessBadge status={currentReadiness} />}
                  {complianceStatus && <ComplianceReadinessBadge status={complianceStatus} />}
                </DialogDescription>
              )}
            </DialogHeader>

            <div className="space-y-4">
              {/* Live stats bar */}
              <div className="flex flex-wrap gap-4 items-center text-xs text-muted-foreground bg-muted/50 rounded px-3 py-2">
                <span>{liveWordCount.toLocaleString()} words</span>
                <span>~{liveReadingTime} min read</span>
                {currentQuality && <span>Quality: {currentQuality.totalScore}/100</span>}
                {currentSEO && <span>SEO: {currentSEO.totalScore}/100</span>}
                {currentCompliance && <span>Compliance: {currentCompliance.overallScore}/100</span>}
                {currentMetadata && currentQuality && currentSEO && currentCompliance && (
                  <BlogScoreBreakdown metadata={currentMetadata} quality={currentQuality} seo={currentSEO} compliance={currentCompliance} />
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Title *</Label>
                  <Input id="title" value={formData.title} onChange={(e) => handleTitleChange(e.target.value)} placeholder="Post title" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="slug">Slug</Label>
                  <Input id="slug" value={formData.slug} onChange={(e) => handleFormChange({ slug: e.target.value })} placeholder="post-url-slug" />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="excerpt">Excerpt</Label>
                <Input id="excerpt" value={formData.excerpt} onChange={(e) => handleFormChange({ excerpt: e.target.value })} placeholder="Brief summary for listings..." />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Content *</Label>
                  <WordFileImporter onImport={handleWordImport} onArticleParsed={handleArticleParsed} onCoverGenerated={handleCoverGenerated} />
                </div>
                <RichTextEditor content={formData.content} onChange={(html) => handleFormChange({ content: html })} onEditorReady={setEditorInstance} />
              </div>

              {/* AI Tools */}
              <BlogAITools
                formData={formData}
                onApplyField={(field, value) => handleFormChange({ [field]: value })}
                editorInstance={editorInstance}
                currentCompliance={currentCompliance}
                existingFaqCount={currentMetadata?.faqCount || 0}
                currentMetadata={currentMetadata}
                currentQuality={currentQuality}
                currentSEO={currentSEO}
              />

              {/* Vertex AI Tools (Flash · Pro · Imagen) */}
              <VertexAITools
                formData={formData}
                onApplyField={(field, value) => handleFormChange({ [field]: value })}
                onApplyContent={(html) => {
                  if (editorInstance) {
                    editorInstance.commands.setContent(html);
                    handleFormChange({ content: html });
                  }
                }}
                onImageGenerated={(url, alt) => handleFormChange({ cover_image_url: url, featured_image_alt: alt })}
              />

              <div className="space-y-2">
                <CoverImageUploader value={formData.cover_image_url} onChange={(url) => handleFormChange({ cover_image_url: url })} />
                <FeaturedImageGenerator
                  slug={formData.slug}
                  title={formData.title}
                  category={undefined}
                  tags={undefined}
                  currentImageUrl={formData.cover_image_url || undefined}
                  imageModel={blogImageModel}
                  onImageGenerated={(url, alt) => handleFormChange({ cover_image_url: url, featured_image_alt: alt })}
                />
                <div className="space-y-1">
                  <Label className="text-xs">Cover Image Alt Text</Label>
                  <Input value={formData.featured_image_alt} onChange={(e) => handleFormChange({ featured_image_alt: e.target.value })} placeholder="Descriptive alt text" className="text-xs" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="meta_title">SEO Title <span className="text-xs text-muted-foreground">({formData.meta_title.length}/60)</span></Label>
                  <Input id="meta_title" value={formData.meta_title} onChange={(e) => handleFormChange({ meta_title: e.target.value })} placeholder="Custom SEO title" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="meta_description">SEO Description <span className="text-xs text-muted-foreground">({formData.meta_description.length}/155)</span></Label>
                  <Input id="meta_description" value={formData.meta_description} onChange={(e) => handleFormChange({ meta_description: e.target.value })} placeholder="Custom meta description" />
                </div>
              </div>

              {/* Policy warnings + publish toggle */}
              {currentCompliance && <BlogPolicyWarnings compliance={currentCompliance} />}

              {complianceStatus === 'Blocked' && formData.is_published && (
                <div className="border border-destructive/30 rounded-lg p-3 bg-destructive/5 space-y-2">
                  <p className="text-xs text-destructive font-medium">This article is blocked from publishing due to critical issues.</p>
                  <div className="flex items-center gap-2">
                    <Checkbox id="publish-override" checked={publishOverride} onCheckedChange={(c) => setPublishOverride(!!c)} />
                    <Label htmlFor="publish-override" className="text-xs">Override and publish anyway</Label>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2">
                <Switch
                  id="is_published"
                  checked={formData.is_published}
                  onCheckedChange={(checked) => {
                    handleFormChange({ is_published: checked });
                    if (!checked) setPublishOverride(false);
                  }}
                  disabled={complianceStatus === 'Blocked' && !publishOverride && formData.is_published}
                />
                <Label htmlFor="is_published">Publish immediately</Label>
              </div>

              {/* Collapsible Quality Report */}
              {currentQuality && (
                <Collapsible open={qualityOpen} onOpenChange={setQualityOpen}>
                  <CollapsibleTrigger className="flex items-center gap-2 w-full py-2 text-sm font-medium hover:text-primary">
                    <ChevronDown className={`h-4 w-4 transition-transform ${qualityOpen ? 'rotate-180' : ''}`} />
                    Article Quality ({currentQuality.totalScore}/100 — {currentQuality.grade})
                  </CollapsibleTrigger>
                  <CollapsibleContent className="border rounded-lg p-3 mt-1">
                    <BlogArticleReport report={currentQuality} />
                  </CollapsibleContent>
                </Collapsible>
              )}

              {/* Collapsible SEO Checklist */}
              {currentSEO && (
                <Collapsible open={seoOpen} onOpenChange={setSeoOpen}>
                  <CollapsibleTrigger className="flex items-center gap-2 w-full py-2 text-sm font-medium hover:text-primary">
                    <ChevronDown className={`h-4 w-4 transition-transform ${seoOpen ? 'rotate-180' : ''}`} />
                    SEO Checklist ({currentSEO.totalScore}/100)
                  </CollapsibleTrigger>
                  <CollapsibleContent className="border rounded-lg p-3 mt-1">
                    <BlogSEOChecklist report={currentSEO} />
                  </CollapsibleContent>
                </Collapsible>
              )}

              {/* Collapsible Compliance Report */}
              {currentCompliance && (
                <Collapsible open={complianceOpen} onOpenChange={setComplianceOpen}>
                  <CollapsibleTrigger className="flex items-center gap-2 w-full py-2 text-sm font-medium hover:text-primary">
                    <ChevronDown className={`h-4 w-4 transition-transform ${complianceOpen ? 'rotate-180' : ''}`} />
                    Compliance & Publish Readiness ({currentCompliance.overallScore}/100)
                  </CollapsibleTrigger>
                  <CollapsibleContent className="border rounded-lg p-3 mt-1">
                    <BlogComplianceChecklist compliance={currentCompliance} />
                  </CollapsibleContent>
                </Collapsible>
              )}

              {/* Collapsible Internal Links */}
              <Collapsible open={linksOpen} onOpenChange={setLinksOpen}>
                <CollapsibleTrigger className="flex items-center gap-2 w-full py-2 text-sm font-medium hover:text-primary">
                  <ChevronDown className={`h-4 w-4 transition-transform ${linksOpen ? 'rotate-180' : ''}`} />
                  Internal Link Suggestions
                </CollapsibleTrigger>
                <CollapsibleContent className="border rounded-lg p-3 mt-1">
                  <InternalLinkSuggester
                    content={formData.content}
                    currentInternalLinks={0}
                    category={undefined}
                    tags={undefined}
                  />
                </CollapsibleContent>
              </Collapsible>
            </div>

            {/* Needs Review confirmation dialog */}
            <AlertDialog open={showNeedsReviewConfirm} onOpenChange={setShowNeedsReviewConfirm}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Publish with issues?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This article has compliance issues that need review. Are you sure you want to publish it now?
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => { executeSubmit(); setShowNeedsReviewConfirm(false); }}>
                    Publish Anyway
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">Cancel</Button>
              </DialogClose>
              <Button onClick={handleSubmit} disabled={isSaving}>
                {isSaving ? 'Saving...' : (editingPost ? 'Update' : 'Create')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>

      {/* ── AI Model Selection Bar ── */}
      <div className="px-6 py-3 border-b flex items-center gap-4 bg-muted/30">
        <Sparkles className="h-4 w-4 text-primary shrink-0" />
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">AI Models</span>
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground">Text:</Label>
          <AiModelSelector value={blogTextModel} onValueChange={handleTextModelChange} capability="text" wordTarget={bulkWordCount} triggerClassName="w-[220px] h-8 text-xs" size="sm" />
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground">Image:</Label>
          <AiModelSelector value={blogImageModel} onValueChange={handleImageModelChange} capability="image" triggerClassName="w-[200px] h-8 text-xs" size="sm" />
        </div>
      </div>

      {/* ── SEO Utility Toolbar ── */}
      <div className="px-6 pb-4 flex flex-wrap gap-2 border-b">
        <Button variant="outline" size="sm" onClick={handleSyncCanonicalUrls}>
          <RefreshCw className="h-4 w-4 mr-1" />Sync Canonical URLs
        </Button>
        <Button variant="outline" size="sm" onClick={handleCopyUrlsForGSC}>
          <ClipboardCopy className="h-4 w-4 mr-1" />Copy Blog URLs for GSC
        </Button>
        <Button variant="outline" size="sm" onClick={handleCopyArticleTitles}>
          <FileText className="h-4 w-4 mr-1" />Copy Article Titles
        </Button>
        <Button variant="outline" size="sm" onClick={handleDownloadArticleTitles}>
          <Download className="h-4 w-4 mr-1" />Download Titles (.txt)
        </Button>
        <Button variant="outline" size="sm" asChild>
          <a href="https://search.google.com/search-console/inspect?resource_id=https://truejobs.co.in" target="_blank" rel="noopener noreferrer">
            <Search className="h-4 w-4 mr-1" />Open GSC URL Inspection →
          </a>
        </Button>
        <Button variant="outline" size="sm" onClick={() => setShowRedirectMap(true)}>
          <Link2 className="h-4 w-4 mr-1" />View Redirect Map
        </Button>
        <Button variant="outline" size="sm" onClick={handleCheckDuplicateSlugs}>
          <AlertTriangle className="h-4 w-4 mr-1" />Check Duplicate Slugs
        </Button>
        {/* Cover Image: model selector + generate button */}
        <div className="flex items-center gap-1">
          <AiModelSelector value={coverImageModel} onValueChange={handleCoverImageModelChange} capability="image" size="sm" triggerClassName="h-8 w-[160px] text-xs" />
          <Button variant="outline" size="sm" onClick={handleBulkGenerateCoverImages} disabled={isBulkCoverRunning}>
            {isBulkCoverRunning ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <ImageIcon className="h-4 w-4 mr-1" />}
            {isBulkCoverRunning
              ? `Generating… ${bulkCoverProgress ? `${bulkCoverProgress.done}/${bulkCoverProgress.total}` : ''}`
              : 'Cover Images'}
          </Button>
          {isBulkCoverRunning && (
            <Button variant="destructive" size="sm" onClick={() => { bulkCoverAbortRef.current = true; }}>
              <Square className="h-4 w-4 mr-1" />Stop
            </Button>
          )}
        </div>
        {/* Inline Image: model selector + generate button */}
        <div className="flex items-center gap-1">
          <AiModelSelector value={inlineImageModel} onValueChange={handleInlineImageModelChange} capability="image" size="sm" triggerClassName="h-8 w-[160px] text-xs" />
          <Button variant="outline" size="sm" onClick={handleBulkGenerateInlineImages} disabled={isBulkInlineRunning}>
            {isBulkInlineRunning ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <ImageIcon className="h-4 w-4 mr-1" />}
            {isBulkInlineRunning
              ? `In-Between… ${bulkInlineProgress ? `${bulkInlineProgress.done}/${bulkInlineProgress.total}` : ''}`
              : 'In-Between Images'}
          </Button>
          {isBulkInlineRunning && (
            <Button variant="destructive" size="sm" onClick={() => { bulkInlineAbortRef.current = true; }}>
              <Square className="h-4 w-4 mr-1" />Stop
            </Button>
          )}
        </div>
      </div>

      {/* ── Bulk Article Generator ── */}
      {/* ── Bulk Fix & Enrich Workflows ── */}
      <BulkWorkflowPanel posts={posts} blogTextModel={blogTextModel} onComplete={fetchPosts} />
      <SeoMetadataWorkflowPanel posts={posts} onComplete={fetchPosts} />
      <PendingActionsPanel
        blogTextModel={blogTextModel}
        coverImageModel={coverImageModel}
        inlineImageModel={inlineImageModel}
        enrichWordLimit={enrichWordLimit}
        onComplete={fetchPosts}
      />

      {/* ── Search & Enrich by Word Count ── */}
      <BulkEnrichByWordCount blogTextModel={blogTextModel} onComplete={fetchPosts} />

      {/* Image cleanup buttons are now inline in the article table */}

      {/* ── Bulk Article Generator ── */}
      <div className="px-6 pb-4 border-b">
        <Collapsible open={showBulkGenerator} onOpenChange={setShowBulkGenerator}>
          <CollapsibleTrigger className="flex items-center gap-2 w-full py-2 text-sm font-medium hover:text-primary">
            <ChevronDown className={`h-4 w-4 transition-transform ${showBulkGenerator ? 'rotate-180' : ''}`} />
            <Sparkles className="h-4 w-4" /> Create Articles in Bulk
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-3 mt-2">
            <div className="space-y-2">
              <Label className="text-xs">Topics (one per line)</Label>
              <Textarea
                value={bulkTopics}
                onChange={(e) => { setBulkTopics(e.target.value); setDuplicateCheckResults([]); }}
                placeholder={"SSC CGL 2026 Notification Details\nRailway Group D Vacancy Update\nUPSC Civil Services Preparation Tips"}
                rows={4}
                className="text-xs"
              />
              {/* Duplicate checker */}
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  disabled={isCheckingDuplicates || !bulkTopics.trim()}
                  onClick={async () => {
                    const topics = bulkTopics.split('\n').map(t => t.trim()).filter(Boolean);
                    if (topics.length === 0) return;
                    setIsCheckingDuplicates(true);
                    setDuplicateCheckResults([]);
                    try {
                      const { data: existingPosts } = await supabase
                        .from('blog_posts')
                        .select('title, slug');
                      if (!existingPosts || existingPosts.length === 0) {
                        toast({ title: 'No duplicates found', description: 'All topics are new.' });
                        setIsCheckingDuplicates(false);
                        return;
                      }
                      const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
                      const matches: { topic: string; matchedTitle: string; matchedSlug: string }[] = [];
                      for (const topic of topics) {
                        const normTopic = normalize(topic);
                        const topicWords = normTopic.split(' ').filter(w => w.length > 2);
                        for (const post of existingPosts) {
                          const normTitle = normalize(post.title);
                          // Exact or near-exact match
                          if (normTopic === normTitle) {
                            matches.push({ topic, matchedTitle: post.title, matchedSlug: post.slug });
                            break;
                          }
                          // Word overlap >= 60%
                          const titleWords = normTitle.split(' ').filter(w => w.length > 2);
                          const overlap = topicWords.filter(w => titleWords.includes(w)).length;
                          const similarity = topicWords.length > 0 ? overlap / Math.max(topicWords.length, titleWords.length) : 0;
                          if (similarity >= 0.6) {
                            matches.push({ topic, matchedTitle: post.title, matchedSlug: post.slug });
                            break;
                          }
                        }
                      }
                      setDuplicateCheckResults(matches);
                      if (matches.length === 0) {
                        toast({ title: 'No duplicates found', description: 'All topics are new.' });
                      } else {
                        toast({ title: `${matches.length} duplicate(s) found`, description: 'Review and remove them below.', variant: 'destructive' });
                      }
                    } catch (err) {
                      toast({ title: 'Check failed', variant: 'destructive' });
                    }
                    setIsCheckingDuplicates(false);
                  }}
                >
                  {isCheckingDuplicates ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Search className="h-3 w-3 mr-1" />}
                  Check Duplicates
                </Button>
                {duplicateCheckResults.length > 0 && (
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    className="h-7 text-xs"
                    onClick={() => {
                      const dupeTopics = new Set(duplicateCheckResults.map(d => d.topic));
                      const filtered = bulkTopics.split('\n').filter(line => !dupeTopics.has(line.trim())).join('\n');
                      setBulkTopics(filtered);
                      toast({ title: `${dupeTopics.size} duplicate topic(s) removed` });
                      setDuplicateCheckResults([]);
                    }}
                  >
                    <Trash2 className="h-3 w-3 mr-1" />
                    Remove All Duplicates ({duplicateCheckResults.length})
                  </Button>
                )}
              </div>
              {duplicateCheckResults.length > 0 && (
                <div className="border rounded-md p-2 space-y-1 max-h-40 overflow-y-auto bg-destructive/5">
                  <p className="text-[10px] font-medium text-destructive">Existing articles found:</p>
                  {duplicateCheckResults.map((d, i) => (
                    <div key={i} className="flex items-center justify-between gap-2 text-[11px]">
                      <div className="flex-1 min-w-0">
                        <span className="font-medium truncate block">{d.topic}</span>
                        <span className="text-muted-foreground truncate block">↳ matches: {d.matchedTitle}</span>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-6 text-[10px] text-destructive hover:text-destructive shrink-0"
                        onClick={() => {
                          const filtered = bulkTopics.split('\n').filter(line => line.trim() !== d.topic).join('\n');
                          setBulkTopics(filtered);
                          setDuplicateCheckResults(prev => prev.filter((_, idx) => idx !== i));
                          toast({ title: 'Topic removed' });
                        }}
                      >
                        <X className="h-3 w-3 mr-0.5" />Remove
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="flex gap-3 items-end flex-wrap">
              <div className="space-y-1">
                <Label className="text-xs">Category</Label>
                <Select value={bulkCategory || ''} onValueChange={(v) => setBulkCategory(v || null)}>
                  <SelectTrigger className="w-[180px] h-8 text-xs"><SelectValue placeholder="Auto-detect" /></SelectTrigger>
                  <SelectContent>
                    {VALID_BLOG_CATEGORIES.filter(c => c !== 'Uncategorized').map(cat => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Target Words</Label>
                <div className="flex items-center gap-1.5">
                  <Select value={[1200, 1500, 1800, 2200].includes(bulkWordCount) ? String(bulkWordCount) : 'custom'} onValueChange={(v) => { if (v === 'custom') setBulkWordCount(2500); else setBulkWordCount(Number(v)); }}>
                    <SelectTrigger className="w-[100px] h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1200">1200</SelectItem>
                      <SelectItem value="1500">1500</SelectItem>
                      <SelectItem value="1800">1800</SelectItem>
                      <SelectItem value="2200">2200</SelectItem>
                      <SelectItem value="custom">Custom</SelectItem>
                    </SelectContent>
                  </Select>
                  {![1200, 1500, 1800, 2200].includes(bulkWordCount) && (
                    <Input
                      type="number"
                      min={300}
                      max={5000}
                      value={bulkWordCount}
                      onChange={(e) => {
                        const val = Math.max(300, Math.min(5000, Number(e.target.value) || 300));
                        setBulkWordCount(val);
                      }}
                      className="w-[80px] h-8 text-xs"
                      placeholder="e.g. 2500"
                    />
                  )}
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Output Language</Label>
                <Select value={outputLanguage} onValueChange={handleOutputLanguageChange}>
                  <SelectTrigger className="w-[120px] h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Auto</SelectItem>
                    <SelectItem value="english">English</SelectItem>
                    <SelectItem value="hindi">Hindi</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-1.5">
                <Badge variant="outline" className="text-[10px] h-5 px-1.5">Using: {getModelDef(blogTextModel)?.label || blogTextModel}</Badge>
              </div>
              <Button size="sm" onClick={handleBulkGenerate} disabled={isBulkGenerating || !bulkTopics.trim()}>
                {isBulkGenerating ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Sparkles className="h-4 w-4 mr-1" />}
                Generate Articles
              </Button>
              {isBulkGenerating && (
                <Button size="sm" variant="destructive" onClick={() => { bulkGenerateAbortRef.current = true; }}>
                  <Square className="h-4 w-4 mr-1" />Stop
                </Button>
              )}
              {!isBulkGenerating && bulkResults.some(r => r.status === 'failed') && (
                <Button size="sm" variant="outline" onClick={handleRetryFailedArticles}>
                  <RotateCcw className="h-4 w-4 mr-1" />Retry Failed ({bulkResults.filter(r => r.status === 'failed').length})
                </Button>
              )}
            </div>
            {bulkResults.length > 0 && (
              <div className="space-y-1 mt-2">
                <div className="text-xs font-medium text-muted-foreground">
                  {bulkResults.filter(r => r.status === 'success').length} succeeded, {bulkResults.filter(r => r.status === 'failed').length} failed
                </div>
                {bulkResults.map((r, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    {r.status === 'queued' && <Badge variant="secondary" className="text-[10px]">Queued</Badge>}
                    {r.status === 'generating' && <Badge className="text-[10px] bg-primary/10 text-primary"><Loader2 className="h-2.5 w-2.5 animate-spin mr-1" />Generating</Badge>}
                    {r.status === 'success' && <Badge className="text-[10px] bg-green-500/15 text-green-700"><Check className="h-2.5 w-2.5 mr-1" />Done</Badge>}
                    {r.status === 'failed' && <Badge variant="destructive" className="text-[10px]"><X className="h-2.5 w-2.5 mr-1" />Failed</Badge>}
                    <span className="truncate max-w-[300px]">{r.topic}</span>
                    {r.status === 'success' && r.articleId && (
                      <Button variant="link" size="sm" className="h-5 text-[10px] p-0" onClick={() => {
                        const found = posts.find(p => p.id === r.articleId);
                        if (found) openEditDialog(found);
                      }}>Open Draft</Button>
                    )}
                    {r.status === 'failed' && r.error && <span className="text-destructive text-[10px]">{r.error}</span>}
                  </div>
                ))}
              </div>
            )}
          </CollapsibleContent>
        </Collapsible>
      </div>

      {/* Redirect Map Dialog */}
      <Dialog open={showRedirectMap} onOpenChange={setShowRedirectMap}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Blog Redirect Map ({redirectEntries.length} entries)</DialogTitle>
            <DialogDescription>Active client-side redirects from old slugs to new destinations.</DialogDescription>
          </DialogHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Old Slug</TableHead>
                <TableHead>New Destination</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {redirectEntries.map(([oldSlug, newSlug]) => (
                <TableRow key={oldSlug}>
                  <TableCell className="font-mono text-xs break-all">/blog/{oldSlug}</TableCell>
                  <TableCell className="font-mono text-xs break-all">{newSlug === '/' ? '/ (homepage)' : `/blog/${newSlug}`}</TableCell>
                  <TableCell><Badge variant="default" className="text-xs">Active</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DialogContent>
      </Dialog>

      {/* Duplicate Slugs Warning Dialog */}
      <Dialog open={showDuplicates} onOpenChange={setShowDuplicates}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>⚠️ Duplicate Slugs Found</DialogTitle>
            <DialogDescription>These slugs appear more than once in the blog_posts table.</DialogDescription>
          </DialogHeader>
          <Table>
            <TableHeader><TableRow><TableHead>Slug</TableHead><TableHead>Count</TableHead></TableRow></TableHeader>
            <TableBody>
              {duplicateSlugs.map(d => (
                <TableRow key={d.slug}>
                  <TableCell className="font-mono text-xs">{d.slug}</TableCell>
                  <TableCell><Badge variant="destructive">{d.count}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DialogContent>
      </Dialog>

      <CardContent>
        {/* Admin Stats */}
        <BlogAdminStats onDrilldown={(filter) => { setDrilldownFilter(filter); setDrilldownOpen(true); }} />

        {/* Search & Filter Bar */}
        <div className="flex gap-2 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by title or slug..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v as any); setCurrentPage(1); }}>
            <SelectTrigger className="w-[130px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Posts</SelectItem>
              <SelectItem value="published">Published</SelectItem>
              <SelectItem value="draft">Drafts</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
          </div>
        ) : filteredPosts.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            {searchQuery || statusFilter !== 'all' ? 'No posts match your filters.' : 'No blog posts yet. Create your first post!'}
          </div>
        ) : (
          <>
            {/* Image cleanup action buttons */}
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs text-muted-foreground">{selectedPostIds.size} selected</span>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm" disabled={selectedPostIds.size === 0 || imageCleanupLoading !== null} className="text-xs gap-1">
                    <Trash2 className="h-3 w-3" /> Delete Cover Images ({selectedPostIds.size})
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete cover images?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete cover image files from storage and clear DB references for {selectedPostIds.size} selected article(s). This cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDeleteCoverImages} className="bg-destructive text-destructive-foreground">
                      Delete Cover Images
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm" disabled={selectedPostIds.size === 0 || imageCleanupLoading !== null} className="text-xs gap-1">
                    <Trash2 className="h-3 w-3" /> Delete Inline Images ({selectedPostIds.size})
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete inline images?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete inline image files from storage, clean article_images metadata, and remove matching image tags from content HTML for {selectedPostIds.size} selected article(s). This cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDeleteInlineImages} className="bg-destructive text-destructive-foreground">
                      Delete Inline Images
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              <div className="flex items-center gap-1">
                <Select value={bulkScanScope} onValueChange={(v: any) => setBulkScanScope(v)}>
                  <SelectTrigger className="h-7 text-[10px] w-[160px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="smart" className="text-xs">Never Fixed / Changed / Failed</SelectItem>
                    <SelectItem value="all" className="text-xs">All Articles</SelectItem>
                    <SelectItem value="failed_partial" className="text-xs">Failed / Partial Only</SelectItem>
                    {selectedPostIds.size > 0 && (
                      <SelectItem value="selected" className="text-xs">Selected Only ({selectedPostIds.size})</SelectItem>
                    )}
                  </SelectContent>
                </Select>
                <Button size="sm" className="text-xs gap-1" disabled={bulkAutoFix.phase === 'scanning' || bulkAutoFix.phase === 'fixing'} onClick={() => handleBulkFixScan()}>
                  {bulkAutoFix.phase === 'scanning' ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                  Scan & Fix
                </Button>
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" className="text-xs gap-1" disabled={isPublishingAllDrafts || posts.filter(p => !p.is_published).length === 0}>
                    {isPublishingAllDrafts ? <Loader2 className="h-3 w-3 animate-spin" /> : <Eye className="h-3 w-3" />}
                    Publish All Drafts ({posts.filter(p => !p.is_published).length})
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Publish all drafts?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will publish {posts.filter(p => !p.is_published).length} draft article(s) immediately. They will become visible to all users.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handlePublishAllDrafts}>
                      Publish All
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              {selectedPostIds.size > 0 && (
                <Button variant="ghost" size="sm" className="text-xs" onClick={() => setSelectedPostIds(new Set())}>
                  Clear selection
                </Button>
              )}
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={paginatedPosts.length > 0 && paginatedPosts.every(p => selectedPostIds.has(p.id))}
                      onCheckedChange={toggleSelectAllVisible}
                    />
                  </TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Words</TableHead>
                  <TableHead>Quality</TableHead>
                  <TableHead>SEO</TableHead>
                  <TableHead>Cover</TableHead>
                  <TableHead>Inline</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedPosts.map((post) => {
                  const scores = getPostScores(post);
                  return (
                    <TableRow key={post.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedPostIds.has(post.id)}
                          onCheckedChange={() => togglePostSelection(post.id)}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="max-w-[280px]">
                          <div className="font-medium truncate">{post.title}</div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-xs text-muted-foreground truncate">/blog/{post.slug}</span>
                            {post.ai_fixed_at && (
                              <Badge variant="outline" className="text-[9px] px-1 py-0 h-[18px] border-green-500/40 bg-green-500/10 text-green-700 dark:text-green-400 shrink-0 inline-flex items-center gap-0.5 whitespace-nowrap">
                                <Sparkles className="h-2.5 w-2.5 fill-current" />
                                AI Fixed
                              </Badge>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <PublishReadinessBadge status={scores.readiness} />
                      </TableCell>
                      <TableCell className="text-xs">{scores.wordCount.toLocaleString()}</TableCell>
                      <TableCell>
                        <Badge variant={scores.quality >= 70 ? 'default' : scores.quality >= 50 ? 'secondary' : 'destructive'} className="text-xs">
                          {scores.quality}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={scores.seo >= 70 ? 'default' : scores.seo >= 50 ? 'secondary' : 'destructive'} className="text-xs">
                          {scores.seo}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {!isInvalidImageUrl(post.cover_image_url) ? (
                          <Button variant="ghost" size="icon" className="h-7 w-7" title="Cover image exists" disabled>
                            <Check className="h-4 w-4 text-green-600" />
                          </Button>
                        ) : (
                          <Button
                            variant="ghost" size="icon" className="h-7 w-7"
                            title="Generate Cover Image"
                            disabled={perArticleLoading[post.id] === 'cover'}
                            onClick={() => handleGenerateCoverForPost(post)}
                          >
                            {perArticleLoading[post.id] === 'cover'
                              ? <Loader2 className="h-4 w-4 animate-spin" />
                              : <ImageIcon className="h-4 w-4 text-muted-foreground" />}
                          </Button>
                        )}
                      </TableCell>
                      <TableCell>
                        {(() => {
                          const inlineStatus = detectInlineSlots(post.content || '', post.article_images);
                          const filledCount = (inlineStatus.slot1Filled ? 1 : 0) + (inlineStatus.slot2Filled ? 1 : 0);
                          const isLoading = perArticleLoading[post.id] === 'inline';
                          if (filledCount === 2) {
                            return <Badge variant="secondary" className="text-[10px]">2/2</Badge>;
                          }
                          return (
                            <Button
                              variant="ghost" size="sm" className="h-7 px-1.5 text-[10px] gap-1"
                              title="Generate In-Between Images"
                              disabled={isLoading}
                              onClick={() => handleGenerateInlineForPost(post)}
                            >
                              {isLoading
                                ? <Loader2 className="h-3 w-3 animate-spin" />
                                : <Badge variant="outline" className="text-[10px] px-1">{filledCount}/2</Badge>}
                            </Button>
                          );
                        })()}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(post.updated_at), { addSuffix: true })}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" title="Fix All With AI" onClick={() => handleFixAllForPost(post)}>
                            <Sparkles className="h-4 w-4 text-primary" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" title="Enrich Now" onClick={() => { setEnrichDialogPost(post); setEnrichResult(null); setEnrichWordLimit(1500); }}>
                            <Zap className="h-4 w-4 text-primary" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" asChild title="Preview article">
                            <a href={`/blog/${post.slug}?preview=${post.id}`} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => togglePublish(post)}>
                            {post.is_published ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditDialog(post)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete this post?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  "{post.title}" will be permanently deleted. This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDelete(post.id)} className="bg-destructive text-destructive-foreground">
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4">
                <span className="text-sm text-muted-foreground">
                  {filteredPosts.length} posts — page {currentPage} of {totalPages}
                </span>
                <div className="flex gap-1">
                  <Button variant="outline" size="sm" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>

    <BlogStatsDrilldown
      open={drilldownOpen}
      onOpenChange={setDrilldownOpen}
      filter={drilldownFilter}
      posts={posts}
      onEditPost={(post) => openEditDialog(post as any)}
      onRefresh={fetchPosts}
    />

    {/* ── Fix All With AI Dialog ── */}
    <Dialog open={!!fixAllDialogPost} onOpenChange={(open) => { if (!open) { setFixAllDialogPost(null); setFixAllResults(null); } }}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Sparkles className="h-4 w-4" /> Fix All With AI</DialogTitle>
          <DialogDescription className="truncate">{fixAllDialogPost?.title}</DialogDescription>
        </DialogHeader>
        {fixAllRunning && (
          <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Analyzing and applying safe fixes…
          </div>
        )}
        {fixAllResults && (
          <div className="space-y-3">
            {fixAllResults.autoFixed.length > 0 && (
              <div className="space-y-1">
                <h4 className="text-xs font-semibold flex items-center gap-1 text-green-700 dark:text-green-400">
                  <Check className="h-3 w-3" /> Auto-Fixed ({fixAllResults.autoFixed.length})
                </h4>
                {fixAllResults.autoFixed.map((f, i) => (
                  <div key={i} className="text-xs bg-green-500/10 rounded px-2 py-1">
                    <span className="font-medium">{f.field}:</span> {f.value.substring(0, 80)}{f.value.length > 80 ? '…' : ''}
                  </div>
                ))}
              </div>
            )}
            {fixAllResults.reviewRequired.length > 0 && (
              <div className="space-y-1">
                <h4 className="text-xs font-semibold flex items-center gap-1 text-yellow-700 dark:text-yellow-400">
                  <AlertTriangle className="h-3 w-3" /> Review Required ({fixAllResults.reviewRequired.length})
                </h4>
                {fixAllResults.reviewRequired.map((f: any, i: number) => (
                  <div key={i} className="text-xs bg-yellow-500/10 rounded px-2 py-1">
                    <span className="font-medium">{f.issueLabel}:</span> {f.explanation || 'Open in editor to apply'}
                    <Button variant="link" size="sm" className="h-5 text-[10px] p-0 ml-2" onClick={() => {
                      setFixAllDialogPost(null);
                      const post = posts.find(p => p.id === fixAllDialogPost?.id);
                      if (post) openEditDialog(post);
                    }}>Open in Editor</Button>
                  </div>
                ))}
              </div>
            )}
            {fixAllResults.unresolved.length > 0 && (
              <div className="space-y-1">
                <h4 className="text-xs font-semibold text-muted-foreground">Unresolved ({fixAllResults.unresolved.length})</h4>
                {fixAllResults.unresolved.map((f: any, i: number) => (
                  <div key={i} className="text-xs text-muted-foreground bg-muted/50 rounded px-2 py-1">
                    <span className="font-medium">{f.issueLabel}:</span> {f.explanation}
                  </div>
                ))}
              </div>
            )}
            {fixAllResults.autoFixed.length === 0 && fixAllResults.reviewRequired.length === 0 && fixAllResults.unresolved.length === 0 && (
              <p className="text-xs text-muted-foreground">No issues found — article looks good!</p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>

    {/* ── Enrich Now Dialog ── */}
    <Dialog open={!!enrichDialogPost} onOpenChange={(open) => { if (!open) { setEnrichDialogPost(null); setEnrichResult(null); } }}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Zap className="h-4 w-4" /> Enrich Article</DialogTitle>
          <DialogDescription className="truncate">
            {enrichDialogPost?.title} — Currently {(enrichDialogPost?.word_count || 0).toLocaleString()} words
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Label className="text-xs whitespace-nowrap">Target Words:</Label>
            {[1200, 1500, 1800, 2200].map(n => (
              <Button key={n} size="sm" variant={enrichWordLimit === n ? 'default' : 'outline'} className="h-7 text-xs" onClick={() => setEnrichWordLimit(n)}>
                {n}
              </Button>
            ))}
            <Input type="number" value={enrichWordLimit} onChange={(e) => setEnrichWordLimit(Number(e.target.value))} className="w-20 h-7 text-xs" min={800} max={3000} />
          </div>
          <Button onClick={handleEnrichPost} disabled={isEnriching}>
            {isEnriching ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Zap className="h-4 w-4 mr-1" />}
            Enrich to ~{enrichWordLimit} words
          </Button>
          {enrichResult && (
            <div className="space-y-2">
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span>Enriched: ~{enrichResult.wordCount} words</span>
                <span>{enrichResult.changes.length} improvements</span>
              </div>
              {enrichResult.changes.length > 0 && (
                <div className="text-xs space-y-0.5">
                  {enrichResult.changes.map((c, i) => <p key={i} className="text-muted-foreground">• {c}</p>)}
                </div>
              )}
              <ScrollArea className="h-[300px] border rounded-lg p-3">
                <div className="prose prose-sm max-w-none text-xs" dangerouslySetInnerHTML={{ __html: enrichResult.content }} />
              </ScrollArea>
              <div className="flex gap-2">
                <Button onClick={applyEnrichment}>
                  <Check className="h-4 w-4 mr-1" /> Apply Enrichment
                </Button>
                <Button variant="outline" onClick={() => setEnrichResult(null)}>
                  <X className="h-4 w-4 mr-1" /> Discard
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>

    {/* ── Bulk Auto-Fix Dialog ── */}
    <Dialog open={bulkAutoFix.showDialog} onOpenChange={(open) => { if (!open) bulkAutoFix.resetDialog(); }}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Sparkles className="h-4 w-4" /> Scan & Auto-Fix by AI</DialogTitle>
          <DialogDescription>
            {bulkAutoFix.phase === 'scanning' && 'Scanning articles for compliance issues…'}
            {bulkAutoFix.phase === 'scanned' && bulkAutoFix.scanReport && `${bulkAutoFix.scanReport.totalFixable} auto-fixable, ${bulkAutoFix.scanReport.totalClean} clean, ${bulkAutoFix.scanReport.totalSkipped} skipped out of ${bulkAutoFix.scanReport.totalScanned} scanned.`}
            {bulkAutoFix.phase === 'fixing' && `Fixing ${bulkAutoFix.progress.done}/${bulkAutoFix.progress.total}…`}
            {bulkAutoFix.phase === 'done' && bulkAutoFix.summary && `Complete — ${bulkAutoFix.summary.totalFixed} fixed, ${bulkAutoFix.summary.totalPartial} partial, ${bulkAutoFix.summary.totalSkipped} skipped, ${bulkAutoFix.summary.totalFailed} failed, ${bulkAutoFix.summary.totalNoAction} no action.`}
          </DialogDescription>
        </DialogHeader>

        {bulkAutoFix.phase === 'scanning' && (
          <div className="flex items-center gap-2 py-6 justify-center text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Scanning articles…
          </div>
        )}

        {bulkAutoFix.phase === 'scanned' && bulkAutoFix.scanReport && bulkAutoFix.scanReport.totalFixable > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-xs font-medium text-muted-foreground">
                Using: {getModelDef(blogTextModel)?.label || blogTextModel}
              </div>
              {bulkAutoFix.scanReport.scope !== 'all' && (
                <Button variant="outline" size="sm" className="text-[10px] h-6 gap-1" onClick={() => handleBulkFixScan('all')}>
                  <RotateCcw className="h-3 w-3" /> Force Full Rescan
                </Button>
              )}
            </div>
            {/* State breakdown for smart scope */}
            {bulkAutoFix.scanReport.scope === 'smart' && (
              <div className="grid grid-cols-7 gap-1 text-center">
                <div className="bg-blue-500/10 rounded p-1.5"><div className="text-sm font-bold text-blue-700 dark:text-blue-400">{bulkAutoFix.scanReport.stateBreakdown.neverBulkFixed}</div><div className="text-[9px] text-muted-foreground">Never Fixed</div></div>
                <div className="bg-amber-500/10 rounded p-1.5"><div className="text-sm font-bold text-amber-700 dark:text-amber-400">{bulkAutoFix.scanReport.stateBreakdown.changed}</div><div className="text-[9px] text-muted-foreground">Changed</div></div>
                <div className="bg-destructive/10 rounded p-1.5"><div className="text-sm font-bold text-destructive">{bulkAutoFix.scanReport.stateBreakdown.failed}</div><div className="text-[9px] text-muted-foreground">Failed</div></div>
                <div className="bg-orange-500/10 rounded p-1.5"><div className="text-sm font-bold text-orange-700 dark:text-orange-400">{bulkAutoFix.scanReport.stateBreakdown.partial}</div><div className="text-[9px] text-muted-foreground">Partial</div></div>
                <div className="bg-muted rounded p-1.5"><div className="text-sm font-bold">{bulkAutoFix.scanReport.stateBreakdown.noActionTaken}</div><div className="text-[9px] text-muted-foreground">No Action</div></div>
                <div className="bg-muted/50 rounded p-1.5"><div className="text-sm font-bold text-muted-foreground">{bulkAutoFix.scanReport.stateBreakdown.skippedUnchanged}</div><div className="text-[9px] text-muted-foreground">Unchanged</div></div>
                <div className="bg-green-500/10 rounded p-1.5"><div className="text-sm font-bold text-green-700 dark:text-green-400">{bulkAutoFix.scanReport.stateBreakdown.alreadyClean}</div><div className="text-[9px] text-muted-foreground">Clean</div></div>
              </div>
            )}
            {/* Standard summary grid for non-smart scopes */}
            {bulkAutoFix.scanReport.scope !== 'smart' && (
              <div className="grid grid-cols-4 gap-2 text-center">
                <div className="bg-muted rounded p-2"><div className="text-lg font-bold">{bulkAutoFix.scanReport.totalScanned}</div><div className="text-[10px] text-muted-foreground">Scanned</div></div>
                <div className="bg-green-500/10 rounded p-2"><div className="text-lg font-bold text-green-700 dark:text-green-400">{bulkAutoFix.scanReport.totalClean}</div><div className="text-[10px] text-muted-foreground">Clean</div></div>
                <div className="bg-primary/10 rounded p-2"><div className="text-lg font-bold text-primary">{bulkAutoFix.scanReport.totalFixable}</div><div className="text-[10px] text-muted-foreground">Auto-Fixable</div></div>
                <div className="bg-muted rounded p-2"><div className="text-lg font-bold">{bulkAutoFix.scanReport.totalSkipped}</div><div className="text-[10px] text-muted-foreground">Skipped</div></div>
              </div>
            )}
            {Object.keys(bulkAutoFix.scanReport.issueBreakdown).length > 0 && (
              <div className="flex flex-wrap gap-1">
                {Object.entries(bulkAutoFix.scanReport.issueBreakdown).map(([key, count]) => (
                  <Badge key={key} variant="outline" className="text-[10px]">{key}: {count}</Badge>
                ))}
              </div>
            )}
            <ScrollArea className="max-h-[250px]">
              <Table>
                <TableHeader><TableRow>
                  <TableHead className="text-xs">Article</TableHead>
                  <TableHead className="text-xs w-16">Fails</TableHead>
                  <TableHead className="text-xs w-16">Warns</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {bulkAutoFix.scanReport.fixableItems.map(item => (
                    <TableRow key={item.postId}>
                      <TableCell className="text-xs truncate max-w-[300px]">{item.title}</TableCell>
                      <TableCell><Badge variant="destructive" className="text-[10px]">{item.failCount}</Badge></TableCell>
                      <TableCell><Badge variant="secondary" className="text-[10px]">{item.warnCount}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
            <div className="flex gap-2">
              <Button onClick={() => bulkAutoFix.executeAutoFix()} className="gap-1">
                <Sparkles className="h-4 w-4" /> Auto-Fix {bulkAutoFix.scanReport.totalFixable} Article(s)
              </Button>
              <Button variant="outline" onClick={() => bulkAutoFix.resetDialog()}>Cancel</Button>
            </div>
          </div>
        )}

        {bulkAutoFix.phase === 'scanned' && bulkAutoFix.scanReport && bulkAutoFix.scanReport.totalFixable === 0 && (
          <div className="text-center py-6 space-y-3">
            <div className="text-sm text-muted-foreground">
              ✅ All {bulkAutoFix.scanReport.scope === 'smart' ? 'eligible' : ''} articles pass auto-fixable checks — no fixes needed.
            </div>
            {bulkAutoFix.scanReport.scope === 'smart' && bulkAutoFix.scanReport.stateBreakdown.skippedUnchanged > 0 && (
              <div className="text-xs text-muted-foreground">
                {bulkAutoFix.scanReport.stateBreakdown.skippedUnchanged} unchanged article(s) were skipped. Use "Force Full Rescan" to scan all.
              </div>
            )}
            {bulkAutoFix.scanReport.scope !== 'all' && (
              <Button variant="outline" size="sm" className="text-xs gap-1" onClick={() => handleBulkFixScan('all')}>
                <RotateCcw className="h-3 w-3" /> Force Full Rescan
              </Button>
            )}
          </div>
        )}

        {(bulkAutoFix.phase === 'fixing' || bulkAutoFix.phase === 'done') && (
          <div className="space-y-3">
            {bulkAutoFix.phase === 'fixing' && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="truncate">Processing: {bulkAutoFix.progress.current}</span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div className="bg-primary rounded-full h-2 transition-all" style={{ width: `${bulkAutoFix.progress.total > 0 ? (bulkAutoFix.progress.done / bulkAutoFix.progress.total) * 100 : 0}%` }} />
                </div>
                <div className="text-xs text-muted-foreground">{bulkAutoFix.progress.done}/{bulkAutoFix.progress.total} completed</div>
                <Button variant="destructive" size="sm" onClick={() => bulkAutoFix.requestStop()}>
                  <Square className="h-3 w-3 mr-1" /> Stop
                </Button>
              </div>
            )}
            {bulkAutoFix.phase === 'done' && bulkAutoFix.summary && (
              <div className="grid grid-cols-6 gap-1.5 text-center text-xs">
                <div className="bg-green-500/10 rounded p-2"><div className="font-bold text-green-700 dark:text-green-400">{bulkAutoFix.summary.totalFixed}</div>Fixed</div>
                <div className="bg-blue-500/10 rounded p-2"><div className="font-bold text-blue-700 dark:text-blue-400">{bulkAutoFix.summary.totalPartial}</div>Partial</div>
                <div className="bg-muted rounded p-2"><div className="font-bold">{bulkAutoFix.summary.totalSkipped}</div>Skipped</div>
                <div className="bg-amber-500/10 rounded p-2"><div className="font-bold text-amber-700 dark:text-amber-400">{bulkAutoFix.summary.totalNoAction}</div>No Action</div>
                <div className="bg-destructive/10 rounded p-2"><div className="font-bold text-destructive">{bulkAutoFix.summary.totalFailed}</div>Failed</div>
                <div className="bg-muted rounded p-2"><div className="font-bold">{bulkAutoFix.summary.totalStopped}</div>Stopped</div>
              </div>
            )}
            {bulkAutoFix.phase === 'done' && bulkAutoFix.summary && Object.keys(bulkAutoFix.summary.fieldBreakdown).length > 0 && (
              <div className="flex flex-wrap gap-1">
                {Object.entries(bulkAutoFix.summary.fieldBreakdown).map(([field, count]) => (
                  <Badge key={field} variant="outline" className="text-[10px]">{field}: {count}</Badge>
                ))}
              </div>
            )}
            <ScrollArea className="max-h-[300px]">
              <div className="space-y-1">
                {bulkAutoFix.results.map((r, i) => (
                  <Collapsible key={i}>
                    <CollapsibleTrigger className="flex items-center gap-2 text-xs py-1.5 border-b border-border/50 w-full text-left hover:bg-muted/50 px-1 rounded">
                      {r.status === 'fixed' && <Badge className="text-[10px] bg-green-500/15 text-green-700 dark:text-green-400 shrink-0"><Check className="h-2.5 w-2.5 mr-0.5" />Fixed</Badge>}
                      {r.status === 'partially_fixed' && <Badge className="text-[10px] bg-blue-500/15 text-blue-700 dark:text-blue-400 shrink-0"><Check className="h-2.5 w-2.5 mr-0.5" />Partial</Badge>}
                      {r.status === 'skipped' && <Badge variant="secondary" className="text-[10px] shrink-0">Skipped</Badge>}
                      {r.status === 'failed' && <Badge variant="destructive" className="text-[10px] shrink-0"><X className="h-2.5 w-2.5 mr-0.5" />Failed</Badge>}
                      {r.status === 'stopped' && <Badge variant="secondary" className="text-[10px] shrink-0">Stopped</Badge>}
                      <span className="truncate max-w-[250px]">{r.title}</span>
                      {r.fixesApplied.length > 0 && <span className="text-green-600 text-[10px] shrink-0">{r.fixesApplied.length} applied</span>}
                      {r.fixesSkipped.length > 0 && <span className="text-muted-foreground text-[10px] shrink-0">{r.fixesSkipped.length} skipped</span>}
                      <ChevronDown className="h-3 w-3 ml-auto shrink-0" />
                    </CollapsibleTrigger>
                    <CollapsibleContent className="pl-4 py-1 space-y-0.5">
                      {r.error && <div className="text-[10px] text-destructive">Error: {r.error}</div>}
                      {r.fixesApplied.map((f, j) => (
                        <div key={`a-${j}`} className="text-[10px] text-green-700 dark:text-green-400">✓ {f.field}: {f.afterValue}</div>
                      ))}
                      {r.fixesSkipped.map((f, j) => (
                        <div key={`s-${j}`} className="text-[10px] text-muted-foreground">⊘ {f.field}: {f.reason}</div>
                      ))}
                    </CollapsibleContent>
                  </Collapsible>
                ))}
              </div>
            </ScrollArea>
            {bulkAutoFix.phase === 'done' && (
              <Button variant="outline" onClick={() => bulkAutoFix.resetDialog()}>Close</Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
    </>
  );
}
