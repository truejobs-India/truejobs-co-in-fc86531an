import { useState, useEffect, useCallback, useRef } from 'react';
import type { Editor } from '@tiptap/react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
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
import { Plus, Edit, Trash2, Eye, EyeOff, ExternalLink, RefreshCw, ClipboardCopy, Link2, AlertTriangle, Search, ChevronDown, ChevronLeft, ChevronRight, ImageIcon, Sparkles, Loader2, Check, X, Zap } from 'lucide-react';
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
  analyzePublishCompliance, getComplianceReadinessStatus,
} from '@/lib/blogComplianceAnalyzer';
import { ComplianceReadinessBadge } from './blog/ComplianceReadinessBadge';
import { BlogComplianceChecklist } from './blog/BlogComplianceChecklist';
import { BlogPolicyWarnings } from './blog/BlogPolicyWarnings';
import { Checkbox } from '@/components/ui/checkbox';
import { BlogAITools } from './blog/BlogAITools';
import { BlogScoreBreakdown } from './blog/BlogScoreBreakdown';

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
  internal_links: any;
  canonical_url: string | null;
  author_name: string | null;
  ai_fixed_at: string | null;
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
  const [bulkResults, setBulkResults] = useState<{ topic: string; status: 'queued' | 'generating' | 'success' | 'failed'; articleId?: string; error?: string }[]>([]);
  const [isBulkGenerating, setIsBulkGenerating] = useState(false);

  // Bulk cover image generation state
  const [isBulkCoverRunning, setIsBulkCoverRunning] = useState(false);
  const [bulkCoverProgress, setBulkCoverProgress] = useState<{ total: number; done: number; failed: number; current: string } | null>(null);

  // Search, filter, pagination
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'published' | 'draft'>('all');
  const [currentPage, setCurrentPage] = useState(1);

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

  const buildPostData = () => ({
    title: formData.title.trim(),
    slug: (formData.slug || generateSlug(formData.title)).replace(/^\/+/, ''),
    content: formData.content.trim(),
    excerpt: formData.excerpt.trim() || null,
    cover_image_url: formData.cover_image_url.trim() || null,
    featured_image_alt: formData.featured_image_alt.trim() || null,
    is_published: formData.is_published,
    published_at: formData.is_published ? new Date().toISOString() : null,
    meta_title: formData.meta_title.trim() || null,
    meta_description: formData.meta_description.trim() || null,
    author_name: formData.author_name.trim() || null,
    canonical_url: formData.canonical_url.trim() || null,
    author_id: user!.id,
    ai_fixed_at: null, // Clear AI fixed status on manual save
  });

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
    const { error } = await supabase.from('blog_posts').update({
      is_published: !post.is_published,
      published_at: !post.is_published ? new Date().toISOString() : null,
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
  const liveWordCount = formData.content.replace(/<[^>]+>/g, '').split(/\s+/).filter(w => w.length > 0).length;
  const liveReadingTime = Math.max(1, Math.ceil(liveWordCount / 200));

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
    // Recalculate word count from content to avoid stale DB values
    const liveWc = post.content.replace(/<[^>]+>/g, '').split(/\s+/).filter(w => w.length > 0).length;
    const postWithLiveWc = { ...post, word_count: liveWc };
    const meta = blogPostToMetadata(postWithLiveWc);
    const q = analyzeQuality(meta);
    const s = analyzeSEO(meta);
    const r = getReadinessStatus(q, s, meta);
    return { quality: q.totalScore, seo: s.totalScore, readiness: r, wordCount: liveWc };
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
        const freshWordCount = post.content.replace(/<[^>]+>/g, '').split(/\s+/).filter(w => w.length > 0).length;
        (updatePayload as any).word_count = freshWordCount;
        (updatePayload as any).reading_time = Math.max(1, Math.ceil(freshWordCount / 200));
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
    const wordCount = enrichResult.content.replace(/<[^>]+>/g, '').split(/\s+/).filter(w => w.length > 0).length;
    const { error } = await supabase.from('blog_posts').update({
      content: enrichResult.content, word_count: wordCount,
      reading_time: Math.max(1, Math.ceil(wordCount / 200)),
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

    setIsBulkGenerating(true);
    setBulkResults(topics.map(topic => ({ topic, status: 'queued' })));

    for (let i = 0; i < topics.length; i++) {
      setBulkResults(prev => prev.map((r, idx) => idx === i ? { ...r, status: 'generating' } : r));
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error('Not authenticated');
        const { data, error } = await supabase.functions.invoke('generate-blog-article', {
          body: { topic: topics[i], category: bulkCategory, targetWordCount: bulkWordCount },
        });
        if (error) throw new Error(error.message);
        if (!data?.title || !data?.content) throw new Error('Invalid AI response');

        // Save as draft
        const wordCount = data.content.replace(/<[^>]+>/g, '').split(/\s+/).filter((w: string) => w.length > 0).length;
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
      // 2s delay between topics
      if (i < topics.length - 1) await new Promise(r => setTimeout(r, 2000));
    }

    setIsBulkGenerating(false);
    fetchPosts();
    toast({ title: 'Bulk generation complete' });
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

              {/* Cover Image with Upload + AI Generate */}
              <div className="space-y-2">
                <CoverImageUploader value={formData.cover_image_url} onChange={(url) => handleFormChange({ cover_image_url: url })} />
                <FeaturedImageGenerator
                  slug={formData.slug}
                  title={formData.title}
                  category={undefined}
                  tags={undefined}
                  currentImageUrl={formData.cover_image_url || undefined}
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

      {/* ── SEO Utility Toolbar ── */}
      <div className="px-6 pb-4 flex flex-wrap gap-2 border-b">
        <Button variant="outline" size="sm" onClick={handleSyncCanonicalUrls}>
          <RefreshCw className="h-4 w-4 mr-1" />Sync Canonical URLs
        </Button>
        <Button variant="outline" size="sm" onClick={handleCopyUrlsForGSC}>
          <ClipboardCopy className="h-4 w-4 mr-1" />Copy Blog URLs for GSC
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
      </div>

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
                onChange={(e) => setBulkTopics(e.target.value)}
                placeholder={"SSC CGL 2026 Notification Details\nRailway Group D Vacancy Update\nUPSC Civil Services Preparation Tips"}
                rows={4}
                className="text-xs"
              />
            </div>
            <div className="flex gap-3 items-end flex-wrap">
              <div className="space-y-1">
                <Label className="text-xs">Category</Label>
                <Select value={bulkCategory || ''} onValueChange={(v) => setBulkCategory(v || null)}>
                  <SelectTrigger className="w-[180px] h-8 text-xs"><SelectValue placeholder="Auto-detect" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Career Advice">Career Advice</SelectItem>
                    <SelectItem value="Government Jobs">Government Jobs</SelectItem>
                    <SelectItem value="Exam Preparation">Exam Preparation</SelectItem>
                    <SelectItem value="Results & Cutoffs">Results & Cutoffs</SelectItem>
                    <SelectItem value="Admit Cards">Admit Cards</SelectItem>
                    <SelectItem value="Syllabus">Syllabus</SelectItem>
                    <SelectItem value="Current Affairs">Current Affairs</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Target Words</Label>
                <Select value={String(bulkWordCount)} onValueChange={(v) => setBulkWordCount(Number(v))}>
                  <SelectTrigger className="w-[100px] h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1200">1200</SelectItem>
                    <SelectItem value="1500">1500</SelectItem>
                    <SelectItem value="1800">1800</SelectItem>
                    <SelectItem value="2200">2200</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button size="sm" onClick={handleBulkGenerate} disabled={isBulkGenerating || !bulkTopics.trim()}>
                {isBulkGenerating ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Sparkles className="h-4 w-4 mr-1" />}
                Generate Articles
              </Button>
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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Words</TableHead>
                  <TableHead>Quality</TableHead>
                  <TableHead>SEO</TableHead>
                  <TableHead>Cover</TableHead>
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
                        {post.cover_image_url ? (
                          <ImageIcon className="h-4 w-4 text-green-500" />
                        ) : (
                          <ImageIcon className="h-4 w-4 text-muted-foreground" />
                        )}
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
                          {post.is_published && (
                            <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                              <a href={`/blog/${post.slug}`} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="h-4 w-4" />
                              </a>
                            </Button>
                          )}
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
    </>
  );
}
