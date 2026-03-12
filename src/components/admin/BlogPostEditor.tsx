import { useState, useEffect } from 'react';
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, Edit, Trash2, Eye, EyeOff, ExternalLink, RefreshCw, ClipboardCopy, Link2, AlertTriangle, Search } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { RichTextEditor } from './blog/RichTextEditor';
import { CoverImageUploader } from './blog/CoverImageUploader';
import { WordFileImporter } from './blog/WordFileImporter';
import { BLOG_REDIRECTS } from '@/lib/blogRedirects';

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  content: string;
  excerpt: string | null;
  cover_image_url: string | null;
  is_published: boolean;
  published_at: string | null;
  meta_title: string | null;
  meta_description: string | null;
  created_at: string;
}

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
  const [duplicateSlugs, setDuplicateSlugs] = useState<{ slug: string; count: number }[]>([]);

  const [formData, setFormData] = useState({
    title: '',
    slug: '',
    content: '',
    excerpt: '',
    cover_image_url: '',
    is_published: false,
    meta_title: '',
    meta_description: '',
  });

  useEffect(() => {
    fetchPosts();
  }, []);

  const fetchPosts = async () => {
    const { data, error } = await supabase
      .from('blog_posts')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setPosts(data);
    }
    setIsLoading(false);
  };

  const resetForm = () => {
    setFormData({
      title: '',
      slug: '',
      content: '',
      excerpt: '',
      cover_image_url: '',
      is_published: false,
      meta_title: '',
      meta_description: '',
    });
    setEditingPost(null);
  };

  const openEditDialog = (post: BlogPost) => {
    setEditingPost(post);
    setFormData({
      title: post.title,
      slug: post.slug,
      content: post.content,
      excerpt: post.excerpt || '',
      cover_image_url: post.cover_image_url || '',
      is_published: post.is_published,
      meta_title: post.meta_title || '',
      meta_description: post.meta_description || '',
    });
    setIsDialogOpen(true);
  };

  const handleTitleChange = (value: string) => {
    setFormData(prev => ({
      ...prev,
      title: value,
      slug: editingPost ? prev.slug : generateSlug(value),
    }));
  };

  const handleWordImport = (html: string) => {
    setFormData(prev => ({ ...prev, content: html }));
  };

  const handleSubmit = async () => {
    if (!formData.title.trim() || !formData.content.trim()) {
      toast({
        title: 'Error',
        description: 'Title and content are required',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);

    const postData = {
      title: formData.title.trim(),
      slug: formData.slug || generateSlug(formData.title),
      content: formData.content.trim(),
      excerpt: formData.excerpt.trim() || null,
      cover_image_url: formData.cover_image_url.trim() || null,
      is_published: formData.is_published,
      published_at: formData.is_published ? new Date().toISOString() : null,
      meta_title: formData.meta_title.trim() || null,
      meta_description: formData.meta_description.trim() || null,
      author_id: user!.id,
    };

    let error;
    if (editingPost) {
      const { error: updateError } = await supabase
        .from('blog_posts')
        .update(postData)
        .eq('id', editingPost.id);
      error = updateError;
    } else {
      const { error: insertError } = await supabase
        .from('blog_posts')
        .insert(postData);
      error = insertError;
    }

    setIsSaving(false);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({
        title: 'Success',
        description: editingPost ? 'Post updated successfully' : 'Post created successfully',
      });
      setIsDialogOpen(false);
      resetForm();
      fetchPosts();
    }
  };

  const handleDelete = async (postId: string) => {
    const { error } = await supabase
      .from('blog_posts')
      .delete()
      .eq('id', postId);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Post deleted' });
      fetchPosts();
    }
  };

  const togglePublish = async (post: BlogPost) => {
    const { error } = await supabase
      .from('blog_posts')
      .update({
        is_published: !post.is_published,
        published_at: !post.is_published ? new Date().toISOString() : null,
      })
      .eq('id', post.id);

    if (!error) {
      fetchPosts();
      toast({ title: post.is_published ? 'Post unpublished' : 'Post published' });
    }
  };

  // ── Admin Utility Functions ──────────────────────────
  const handleSyncCanonicalUrls = async () => {
    const { data, error } = await supabase.rpc('sync_blog_canonical_urls' as never);
    if (error) {
      // Fallback: fetch all posts and update one by one
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
    } else {
      toast({ title: '✅ Canonical URLs synced' });
    }
  };

  const handleCopyUrlsForGSC = async () => {
    const { data } = await supabase
      .from('blog_posts')
      .select('slug')
      .eq('is_published', true)
      .order('published_at', { ascending: false });

    if (data && data.length > 0) {
      const urls = data.map(p => `https://truejobs.co.in/blog/${p.slug}`).join('\n');
      await navigator.clipboard.writeText(urls);
      toast({ title: '📋 Copied!', description: `${data.length} blog URLs copied to clipboard.` });
    } else {
      toast({ title: 'No published posts found', variant: 'destructive' });
    }
  };

  const handleCheckDuplicateSlugs = async () => {
    const { data } = await supabase.from('blog_posts').select('slug');
    if (data) {
      const counts: Record<string, number> = {};
      for (const p of data) {
        counts[p.slug] = (counts[p.slug] || 0) + 1;
      }
      const dupes = Object.entries(counts)
        .filter(([, c]) => c > 1)
        .map(([slug, count]) => ({ slug, count }));

      if (dupes.length > 0) {
        setDuplicateSlugs(dupes);
        setShowDuplicates(true);
      } else {
        toast({ title: '✅ No duplicate slugs found' });
      }
    }
  };

  const redirectEntries = Object.entries(BLOG_REDIRECTS);

  return (
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
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Post
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingPost ? 'Edit Post' : 'Create New Post'}</DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Title *</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => handleTitleChange(e.target.value)}
                    placeholder="Post title"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="slug">Slug</Label>
                  <Input
                    id="slug"
                    value={formData.slug}
                    onChange={(e) => setFormData(prev => ({ ...prev, slug: e.target.value }))}
                    placeholder="post-url-slug"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="excerpt">Excerpt</Label>
                <Input
                  id="excerpt"
                  value={formData.excerpt}
                  onChange={(e) => setFormData(prev => ({ ...prev, excerpt: e.target.value }))}
                  placeholder="Brief summary for listings..."
                />
              </div>

              {/* Content Editor with Word Import */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Content *</Label>
                  <WordFileImporter onImport={handleWordImport} />
                </div>
                <RichTextEditor
                  content={formData.content}
                  onChange={(html) => setFormData(prev => ({ ...prev, content: html }))}
                />
              </div>

              {/* Cover Image with Upload */}
              <CoverImageUploader
                value={formData.cover_image_url}
                onChange={(url) => setFormData(prev => ({ ...prev, cover_image_url: url }))}
              />

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="meta_title">SEO Title</Label>
                  <Input
                    id="meta_title"
                    value={formData.meta_title}
                    onChange={(e) => setFormData(prev => ({ ...prev, meta_title: e.target.value }))}
                    placeholder="Custom SEO title"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="meta_description">SEO Description</Label>
                  <Input
                    id="meta_description"
                    value={formData.meta_description}
                    onChange={(e) => setFormData(prev => ({ ...prev, meta_description: e.target.value }))}
                    placeholder="Custom meta description"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  id="is_published"
                  checked={formData.is_published}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_published: checked }))}
                />
                <Label htmlFor="is_published">Publish immediately</Label>
              </div>
            </div>

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
          <RefreshCw className="h-4 w-4 mr-1" />
          Sync Canonical URLs
        </Button>
        <Button variant="outline" size="sm" onClick={handleCopyUrlsForGSC}>
          <ClipboardCopy className="h-4 w-4 mr-1" />
          Copy Blog URLs for GSC
        </Button>
        <Button variant="outline" size="sm" asChild>
          <a
            href="https://search.google.com/search-console/inspect?resource_id=https://truejobs.co.in"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Search className="h-4 w-4 mr-1" />
            Open GSC URL Inspection →
          </a>
        </Button>
        <Button variant="outline" size="sm" onClick={() => setShowRedirectMap(true)}>
          <Link2 className="h-4 w-4 mr-1" />
          View Redirect Map
        </Button>
        <Button variant="outline" size="sm" onClick={handleCheckDuplicateSlugs}>
          <AlertTriangle className="h-4 w-4 mr-1" />
          Check Duplicate Slugs
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
                  <TableCell className="font-mono text-xs break-all">
                    {newSlug === '/' ? '/ (homepage)' : `/blog/${newSlug}`}
                  </TableCell>
                  <TableCell>
                    <Badge variant="default" className="text-xs">Active</Badge>
                  </TableCell>
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
            <TableHeader>
              <TableRow>
                <TableHead>Slug</TableHead>
                <TableHead>Count</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {duplicateSlugs.map(d => (
                <TableRow key={d.slug}>
                  <TableCell className="font-mono text-xs">{d.slug}</TableCell>
                  <TableCell>
                    <Badge variant="destructive">{d.count}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DialogContent>
      </Dialog>

      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No blog posts yet. Create your first post!
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {posts.map((post) => (
                <TableRow key={post.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{post.title}</div>
                      <div className="text-sm text-muted-foreground">/blog/{post.slug}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={post.is_published ? 'default' : 'secondary'}>
                      {post.is_published ? 'Published' : 'Draft'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      {post.is_published && (
                        <Button variant="ghost" size="icon" asChild>
                          <a href={`/blog/${post.slug}`} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" onClick={() => togglePublish(post)}>
                        {post.is_published ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => openEditDialog(post)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(post.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
