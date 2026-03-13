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
import { Plus, Edit, Trash2, Eye, EyeOff, ExternalLink, RefreshCw, ClipboardCopy, Link2, AlertTriangle, Search, ChevronDown, ChevronLeft, ChevronRight, ImageIcon } from 'lucide-react';
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
    slug: formData.slug || generateSlug(formData.title),
    content: formData.content.trim(),
    excerpt: formData.excerpt.trim() || null,
    cover_image_url: formData.cover_image_url.trim() || null,
    featured_image_alt: formData.featured_image_alt.trim() || null,
    is_published: formData.is_published,
    published_at: formData.is_published ? new Date().toISOString() : null,
    meta_title: formData.meta_title.trim() || null,
    meta_description: formData.meta_description.trim() || null,
    author_name: formData.author_name.trim() || null,
    author_id: user!.id,
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
    const meta = blogPostToMetadata(post);
    const q = analyzeQuality(meta);
    const s = analyzeSEO(meta);
    const r = getReadinessStatus(q, s, meta);
    return { quality: q.totalScore, seo: s.totalScore, readiness: r };
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
                        <div>
                          <div className="font-medium truncate max-w-[200px]">{post.title}</div>
                          <div className="text-xs text-muted-foreground truncate max-w-[200px]">/blog/{post.slug}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <PublishReadinessBadge status={scores.readiness} />
                      </TableCell>
                      <TableCell className="text-xs">{(post.word_count || 0).toLocaleString()}</TableCell>
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
    </>
  );
}
