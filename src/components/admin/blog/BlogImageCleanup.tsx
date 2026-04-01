import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ChevronDown, Trash2, Search, ImageIcon, Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react';

// ── Types ──────────────────────────────────────────

interface CoverAuditRow {
  postId: string;
  slug: string;
  coverUrl: string;
  storagePath: string;
  fileExists: boolean;
}

interface InlineAuditRow {
  postId: string;
  slug: string;
  inlineUrl: string;
  storagePath: string;
  fileExists: boolean;
  referenceSource: 'article_images' | 'content' | 'both';
}

interface MinimalPost {
  id: string;
  slug: string;
  title: string;
  cover_image_url: string | null;
  article_images: any;
  content: string;
}

// ── Utility ────────────────────────────────────────

function extractStoragePath(publicUrl: string): string | null {
  const marker = '/blog-assets/';
  const idx = publicUrl.indexOf(marker);
  if (idx === -1) return null;
  return publicUrl.substring(idx + marker.length);
}

function extractInlineUrlsFromContent(content: string): string[] {
  const urls: string[] = [];
  const re = /<img[^>]+src=["']([^"']*\/blog-assets\/inline\/[^"']*)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    urls.push(m[1]);
  }
  return urls;
}

function removeInlineImageFromContent(content: string, url: string): string {
  // First try removing <figure> blocks containing this URL
  const escapedUrl = url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const figureRe = new RegExp(
    `\\s*<figure[^>]*class=["'][^"']*inline-article-image[^"']*["'][^>]*>[\\s\\S]*?${escapedUrl}[\\s\\S]*?<\\/figure>\\s*`,
    'gi'
  );
  let result = content.replace(figureRe, '\n');

  // If figure removal didn't match, try standalone <img> tags
  if (result === content) {
    const imgRe = new RegExp(`\\s*<img[^>]+src=["']${escapedUrl}["'][^>]*/?>\\s*`, 'gi');
    result = content.replace(imgRe, '\n');
  }

  return result;
}

// ── Component ──────────────────────────────────────

export function BlogImageCleanup() {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [posts, setPosts] = useState<MinimalPost[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loadingPosts, setLoadingPosts] = useState(false);

  // Cover audit state
  const [coverAudit, setCoverAudit] = useState<CoverAuditRow[] | null>(null);
  const [coverAuditing, setCoverAuditing] = useState(false);
  const [coverDeleting, setCoverDeleting] = useState(false);
  const [coverDeleteResult, setCoverDeleteResult] = useState<string | null>(null);

  // Inline audit state
  const [inlineAudit, setInlineAudit] = useState<InlineAuditRow[] | null>(null);
  const [inlineAuditing, setInlineAuditing] = useState(false);
  const [inlineDeleting, setInlineDeleting] = useState(false);
  const [inlineDeleteResult, setInlineDeleteResult] = useState<string | null>(null);

  // ── Fetch posts ──
  const fetchPosts = useCallback(async () => {
    setLoadingPosts(true);
    try {
      const query = supabase
        .from('blog_posts')
        .select('id, slug, title, cover_image_url, article_images, content')
        .order('created_at', { ascending: false })
        .limit(500);

      const { data, error } = await query;
      if (error) throw error;
      setPosts((data || []) as MinimalPost[]);
    } catch (e) {
      console.error('Failed to fetch posts for cleanup:', e);
    } finally {
      setLoadingPosts(false);
    }
  }, []);

  const handleOpen = useCallback((isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen && posts.length === 0) fetchPosts();
  }, [posts.length, fetchPosts]);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
    // Clear previous audits when selection changes
    setCoverAudit(null);
    setInlineAudit(null);
    setCoverDeleteResult(null);
    setInlineDeleteResult(null);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredPosts.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredPosts.map(p => p.id)));
    }
    setCoverAudit(null);
    setInlineAudit(null);
  };

  const filteredPosts = posts.filter(p =>
    !searchTerm || p.slug.includes(searchTerm.toLowerCase()) || p.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedPosts = posts.filter(p => selectedIds.has(p.id));

  // ── FUNCTION 1: Cover Image Audit ──
  const auditCoverImages = async () => {
    setCoverAuditing(true);
    setCoverAudit(null);
    setCoverDeleteResult(null);
    try {
      const rows: CoverAuditRow[] = [];
      for (const post of selectedPosts) {
        if (!post.cover_image_url) continue;
        const path = extractStoragePath(post.cover_image_url);
        if (!path || !path.startsWith('covers/')) continue;

        // Check file existence
        const dirPath = path.substring(0, path.lastIndexOf('/'));
        const fileName = path.substring(path.lastIndexOf('/') + 1);
        const { data: files } = await supabase.storage.from('blog-assets').list(dirPath, {
          search: fileName,
          limit: 1,
        });
        const fileExists = (files || []).some(f => f.name === fileName);

        rows.push({
          postId: post.id,
          slug: post.slug,
          coverUrl: post.cover_image_url,
          storagePath: path,
          fileExists,
        });
      }
      setCoverAudit(rows);
    } catch (e) {
      console.error('Cover audit failed:', e);
    } finally {
      setCoverAuditing(false);
    }
  };

  // ── FUNCTION 1: Cover Image Delete ──
  const deleteCoverImages = async () => {
    if (!coverAudit || coverAudit.length === 0) return;
    setCoverDeleting(true);
    try {
      let deletedFiles = 0;
      let cleanedDb = 0;

      // Delete storage files
      const pathsToDelete = coverAudit.filter(r => r.fileExists).map(r => r.storagePath);
      if (pathsToDelete.length > 0) {
        const { error } = await supabase.storage.from('blog-assets').remove(pathsToDelete);
        if (error) throw error;
        deletedFiles = pathsToDelete.length;
      }

      // Null out DB references for all audited posts
      const postIds = coverAudit.map(r => r.postId);
      const { error: dbError } = await supabase
        .from('blog_posts')
        .update({ cover_image_url: null, featured_image_alt: null })
        .in('id', postIds);
      if (dbError) throw dbError;
      cleanedDb = postIds.length;

      setCoverDeleteResult(`✓ Deleted ${deletedFiles} storage file(s), cleaned ${cleanedDb} DB reference(s).`);
      setCoverAudit(null);
      // Refresh posts
      fetchPosts();
    } catch (e: any) {
      setCoverDeleteResult(`✗ Error: ${e.message || 'Unknown error'}`);
    } finally {
      setCoverDeleting(false);
    }
  };

  // ── FUNCTION 2: Inline Image Audit ──
  const auditInlineImages = async () => {
    setInlineAuditing(true);
    setInlineAudit(null);
    setInlineDeleteResult(null);
    try {
      const rows: InlineAuditRow[] = [];

      for (const post of selectedPosts) {
        // Collect URLs from article_images.inline
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

        // Collect URLs from content HTML
        const contentUrls = new Set<string>(extractInlineUrlsFromContent(post.content));

        // Union
        const allUrls = new Set([...articleImagesUrls, ...contentUrls]);

        for (const url of allUrls) {
          const path = extractStoragePath(url);
          if (!path || !path.startsWith('inline/')) continue;

          const inArticleImages = articleImagesUrls.has(url);
          const inContent = contentUrls.has(url);
          const referenceSource: 'article_images' | 'content' | 'both' =
            inArticleImages && inContent ? 'both' :
            inArticleImages ? 'article_images' : 'content';

          // Check file existence
          const dirPath = path.substring(0, path.lastIndexOf('/'));
          const fileName = path.substring(path.lastIndexOf('/') + 1);
          const { data: files } = await supabase.storage.from('blog-assets').list(dirPath, {
            search: fileName,
            limit: 1,
          });
          const fileExists = (files || []).some(f => f.name === fileName);

          rows.push({
            postId: post.id,
            slug: post.slug,
            inlineUrl: url,
            storagePath: path,
            fileExists,
            referenceSource,
          });
        }
      }
      setInlineAudit(rows);
    } catch (e) {
      console.error('Inline audit failed:', e);
    } finally {
      setInlineAuditing(false);
    }
  };

  // ── FUNCTION 2: Inline Image Delete ──
  const deleteInlineImages = async () => {
    if (!inlineAudit || inlineAudit.length === 0) return;
    setInlineDeleting(true);
    try {
      let deletedFiles = 0;
      let cleanedPosts = 0;

      // Delete storage files
      const pathsToDelete = inlineAudit.filter(r => r.fileExists).map(r => r.storagePath);
      if (pathsToDelete.length > 0) {
        const { error } = await supabase.storage.from('blog-assets').remove(pathsToDelete);
        if (error) throw error;
        deletedFiles = pathsToDelete.length;
      }

      // Group by post for DB cleanup
      const urlsByPost = new Map<string, string[]>();
      for (const row of inlineAudit) {
        const existing = urlsByPost.get(row.postId) || [];
        existing.push(row.inlineUrl);
        urlsByPost.set(row.postId, existing);
      }

      for (const [postId, urls] of urlsByPost) {
        const post = posts.find(p => p.id === postId);
        if (!post) continue;

        // Clean article_images JSON
        let updatedArticleImages = post.article_images;
        if (updatedArticleImages && typeof updatedArticleImages === 'object') {
          const ai = updatedArticleImages as any;
          if (Array.isArray(ai.inline)) {
            const filtered = ai.inline.filter((entry: any) => !urls.includes(entry?.url));
            updatedArticleImages = { ...ai, inline: filtered.length > 0 ? filtered : undefined };
            if (!updatedArticleImages.inline && Object.keys(updatedArticleImages).length === 1 && updatedArticleImages.inline === undefined) {
              const { inline: _, ...rest } = updatedArticleImages as any;
              updatedArticleImages = Object.keys(rest).length > 0 ? rest : null;
            }
          }
        }

        // Clean content HTML
        let updatedContent = post.content;
        for (const url of urls) {
          updatedContent = removeInlineImageFromContent(updatedContent, url);
        }

        const { error: dbError } = await supabase
          .from('blog_posts')
          .update({
            article_images: updatedArticleImages,
            content: updatedContent,
          })
          .eq('id', postId);

        if (dbError) throw dbError;
        cleanedPosts++;
      }

      setInlineDeleteResult(`✓ Deleted ${deletedFiles} storage file(s), cleaned inline refs in ${cleanedPosts} post(s).`);
      setInlineAudit(null);
      fetchPosts();
    } catch (e: any) {
      setInlineDeleteResult(`✗ Error: ${e.message || 'Unknown error'}`);
    } finally {
      setInlineDeleting(false);
    }
  };

  return (
    <div className="px-6 pb-4 border-b">
      <Collapsible open={open} onOpenChange={handleOpen}>
        <CollapsibleTrigger className="flex items-center gap-2 w-full py-2 text-sm font-medium hover:text-primary">
          <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
          <Trash2 className="h-4 w-4" /> Image Cleanup (Cover & Inline)
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-4 mt-2">
          {/* Search & Select */}
          <div className="space-y-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search articles by slug or title..."
                className="pl-8 text-xs h-8"
              />
            </div>

            {loadingPosts ? (
              <p className="text-xs text-muted-foreground">Loading articles...</p>
            ) : (
              <ScrollArea className="h-[200px] border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8">
                        <Checkbox
                          checked={filteredPosts.length > 0 && selectedIds.size === filteredPosts.length}
                          onCheckedChange={toggleSelectAll}
                        />
                      </TableHead>
                      <TableHead className="text-xs">Slug</TableHead>
                      <TableHead className="text-xs w-16">Cover</TableHead>
                      <TableHead className="text-xs w-16">Inline</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPosts.map(post => {
                      const hasInline = post.article_images &&
                        typeof post.article_images === 'object' &&
                        Array.isArray((post.article_images as any).inline) &&
                        (post.article_images as any).inline.length > 0;
                      return (
                        <TableRow key={post.id} className="cursor-pointer" onClick={() => toggleSelect(post.id)}>
                          <TableCell>
                            <Checkbox checked={selectedIds.has(post.id)} onCheckedChange={() => toggleSelect(post.id)} />
                          </TableCell>
                          <TableCell className="text-xs font-mono truncate max-w-[300px]">{post.slug}</TableCell>
                          <TableCell>
                            {post.cover_image_url ? (
                              <Badge variant="secondary" className="text-[10px]"><ImageIcon className="h-3 w-3 mr-0.5" />Yes</Badge>
                            ) : (
                              <span className="text-[10px] text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {hasInline ? (
                              <Badge variant="secondary" className="text-[10px]"><ImageIcon className="h-3 w-3 mr-0.5" />Yes</Badge>
                            ) : (
                              <span className="text-[10px] text-muted-foreground">—</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </ScrollArea>
            )}

            <p className="text-xs text-muted-foreground">
              {selectedIds.size} article(s) selected
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={auditCoverImages}
              disabled={selectedIds.size === 0 || coverAuditing}
              className="text-xs"
            >
              {coverAuditing ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <ImageIcon className="h-3 w-3 mr-1" />}
              Audit Cover Images
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={auditInlineImages}
              disabled={selectedIds.size === 0 || inlineAuditing}
              className="text-xs"
            >
              {inlineAuditing ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <ImageIcon className="h-3 w-3 mr-1" />}
              Audit Inline Images
            </Button>
          </div>

          {/* ── Cover Audit Results ── */}
          {coverAudit !== null && (
            <div className="space-y-2 border rounded-md p-3 bg-muted/30">
              <h4 className="text-xs font-semibold flex items-center gap-1">
                <ImageIcon className="h-3.5 w-3.5" /> Cover Image Audit — {coverAudit.length} image(s) found
              </h4>
              {coverAudit.length === 0 ? (
                <p className="text-xs text-muted-foreground">No cover images found for selected articles.</p>
              ) : (
                <>
                  <ScrollArea className="h-[150px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-[10px]">Slug</TableHead>
                          <TableHead className="text-[10px]">Storage Path</TableHead>
                          <TableHead className="text-[10px] w-16">Exists</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {coverAudit.map((row, i) => (
                          <TableRow key={i}>
                            <TableCell className="text-[10px] font-mono">{row.slug}</TableCell>
                            <TableCell className="text-[10px] font-mono truncate max-w-[250px]">{row.storagePath}</TableCell>
                            <TableCell>
                              {row.fileExists ? (
                                <CheckCircle2 className="h-3 w-3 text-green-600" />
                              ) : (
                                <AlertTriangle className="h-3 w-3 text-amber-500" />
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={deleteCoverImages}
                    disabled={coverDeleting}
                    className="text-xs"
                  >
                    {coverDeleting ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Trash2 className="h-3 w-3 mr-1" />}
                    Confirm Delete {coverAudit.length} Cover Image(s)
                  </Button>
                </>
              )}
            </div>
          )}
          {coverDeleteResult && (
            <p className={`text-xs ${coverDeleteResult.startsWith('✓') ? 'text-green-600' : 'text-destructive'}`}>
              {coverDeleteResult}
            </p>
          )}

          {/* ── Inline Audit Results ── */}
          {inlineAudit !== null && (
            <div className="space-y-2 border rounded-md p-3 bg-muted/30">
              <h4 className="text-xs font-semibold flex items-center gap-1">
                <ImageIcon className="h-3.5 w-3.5" /> Inline Image Audit — {inlineAudit.length} image(s) found
              </h4>
              {inlineAudit.length === 0 ? (
                <p className="text-xs text-muted-foreground">No inline images found for selected articles.</p>
              ) : (
                <>
                  <ScrollArea className="h-[150px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-[10px]">Slug</TableHead>
                          <TableHead className="text-[10px]">Storage Path</TableHead>
                          <TableHead className="text-[10px] w-16">Exists</TableHead>
                          <TableHead className="text-[10px] w-24">Ref Source</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {inlineAudit.map((row, i) => (
                          <TableRow key={i}>
                            <TableCell className="text-[10px] font-mono">{row.slug}</TableCell>
                            <TableCell className="text-[10px] font-mono truncate max-w-[200px]">{row.storagePath}</TableCell>
                            <TableCell>
                              {row.fileExists ? (
                                <CheckCircle2 className="h-3 w-3 text-green-600" />
                              ) : (
                                <AlertTriangle className="h-3 w-3 text-amber-500" />
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-[9px]">{row.referenceSource}</Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={deleteInlineImages}
                    disabled={inlineDeleting}
                    className="text-xs"
                  >
                    {inlineDeleting ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Trash2 className="h-3 w-3 mr-1" />}
                    Confirm Delete {inlineAudit.length} Inline Image(s)
                  </Button>
                </>
              )}
            </div>
          )}
          {inlineDeleteResult && (
            <p className={`text-xs ${inlineDeleteResult.startsWith('✓') ? 'text-green-600' : 'text-destructive'}`}>
              {inlineDeleteResult}
            </p>
          )}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
