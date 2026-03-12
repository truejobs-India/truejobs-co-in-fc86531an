import { useState, useCallback, useEffect, useMemo } from 'react';
import { ParsedArticle, getArticleReadiness } from '@/lib/blogParser';
import { UploadZone } from './bulk-blog/UploadZone';
import { ArticleQueue } from './bulk-blog/ArticleQueue';
import { ArticleEditPanel } from './bulk-blog/ArticleEditPanel';
import { BulkPublishModal } from './bulk-blog/BulkPublishModal';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { CheckSquare, Rocket, Save, Download, Trash2, FileText, Loader2, ShieldAlert, ShieldCheck, AlertTriangle } from 'lucide-react';
import type { ArticleMetadata } from '@/lib/blogArticleAnalyzer';
import { analyzePublishCompliance, getComplianceReadinessStatus } from '@/lib/blogComplianceAnalyzer';

export function BulkBlogUpload() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [articles, setArticles] = useState<ParsedArticle[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [publishModalOpen, setPublishModalOpen] = useState(false);
  const [isSavingDrafts, setIsSavingDrafts] = useState(false);

  const selectedArticle = articles.find(a => a.id === selectedId) || null;
  const selectedCount = articles.filter(a => a.selected).length;
  const readyCount = articles.filter(a => getArticleReadiness(a) === 'green').length;

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSaveAllAsDraft();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [articles.length]);

  const handleArticlesParsed = useCallback((parsed: ParsedArticle[]) => {
    setArticles(prev => [...prev, ...parsed]);
    if (parsed.length > 0 && !selectedId) setSelectedId(parsed[0].id);
  }, [selectedId]);

  const handleUpdateArticle = useCallback((updated: ParsedArticle) => {
    setArticles(prev => prev.map(a => a.id === updated.id ? updated : a));
  }, []);

  const handleToggleSelection = useCallback((id: string) => {
    setArticles(prev => prev.map(a => a.id === id ? { ...a, selected: !a.selected } : a));
  }, []);

  const handleRemoveArticle = useCallback((id: string) => {
    setArticles(prev => prev.filter(a => a.id !== id));
    if (selectedId === id) setSelectedId(null);
  }, [selectedId]);

  const handleSelectAll = () => {
    const allSelected = articles.every(a => a.selected);
    setArticles(prev => prev.map(a => ({ ...a, selected: !allSelected })));
  };

  const handleClearQueue = () => {
    setArticles([]);
    setSelectedId(null);
  };

  // ── Save All as Draft — actually persists to DB ────
  const handleSaveAllAsDraft = async () => {
    if (articles.length === 0 || !user) return;
    setIsSavingDrafts(true);
    let successCount = 0;
    let failCount = 0;

    for (const article of articles) {
      try {
        // Check for existing slug
        let finalSlug = article.slug;
        const { data: existing } = await supabase
          .from('blog_posts')
          .select('slug')
          .like('slug', `${article.slug}%`);
        if (existing && existing.length > 0) {
          const existingSlugs = existing.map(e => e.slug);
          if (existingSlugs.includes(finalSlug)) {
            let counter = 2;
            while (existingSlugs.includes(`${finalSlug}-${counter}`)) counter++;
            finalSlug = `${finalSlug}-${counter}`;
          }
        }

        const { error } = await supabase.from('blog_posts').insert({
          title: article.title,
          slug: finalSlug,
          content: article.content,
          meta_title: article.metaTitle || null,
          meta_description: article.metaDescription || null,
          canonical_url: `https://truejobs.co.in/blog/${finalSlug}`,
          cover_image_url: article.coverImageUrl || null,
          featured_image_alt: article.coverImageAlt || null,
          category: article.category,
          tags: article.tags,
          author_name: article.authorName,
          author_id: user.id,
          reading_time: article.readingTime,
          word_count: article.wordCount,
          faq_count: article.faqCount,
          has_faq_schema: article.hasFaqSchema,
          faq_schema: article.hasFaqSchema && article.faqSchema ? {
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: article.faqSchema.map(f => ({
              '@type': 'Question', name: f.question,
              acceptedAnswer: { '@type': 'Answer', text: f.answer },
            })),
          } : null,
          article_images: article.articleImages as any,
          internal_links: article.internalLinks as any,
          language: article.language,
          status: 'draft',
          is_published: false,
          excerpt: article.metaDescription || null,
        });
        if (error) throw error;
        successCount++;
      } catch (err: any) {
        console.error('Draft save failed:', article.slug, err);
        failCount++;
      }
    }

    setIsSavingDrafts(false);
    toast({
      title: `Drafts saved: ${successCount} success, ${failCount} failed`,
      description: successCount > 0 ? 'Articles saved as drafts in Blog Posts.' : undefined,
      variant: failCount > 0 ? 'destructive' : 'default',
    });

    if (successCount > 0) {
      // Remove successfully saved articles from queue
      setArticles([]);
      setSelectedId(null);
    }
  };

  const handleExportCSV = () => {
    const headers = ['Title', 'Slug', 'URL', 'Meta Title', 'Meta Description', 'Category', 'Tags', 'Word Count', 'Reading Time', 'Cover Image', 'Status', 'Language', 'FAQ Count', 'Internal Links'];
    const rows = articles.map(a => [
      a.title, a.slug, a.canonicalUrl, a.metaTitle, a.metaDescription,
      a.category, a.tags.join('; '), a.wordCount, a.readingTime,
      a.coverImageUrl, a.status, a.language, a.faqCount, a.internalLinks.length,
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `truejobs-blog-articles-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'CSV exported' });
  };

  const handlePublished = (publishedIds: string[]) => {
    setArticles(prev => prev.filter(a => !publishedIds.includes(a.id)));
    if (selectedId && publishedIds.includes(selectedId)) setSelectedId(null);
  };

  const selectedArticles = articles.filter(a => a.selected);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold">Bulk Blog Article Upload</h2>
        <p className="text-sm text-muted-foreground">Upload .docx or .md files. SEO data extracted automatically.</p>
      </div>

      {/* Stats Row */}
      <div className="flex gap-3">
        <Card className="flex-1">
          <CardContent className="p-3 flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <span className="text-lg font-bold">{articles.length}</span>
            <span className="text-xs text-muted-foreground">In Queue</span>
          </CardContent>
        </Card>
        <Card className="flex-1">
          <CardContent className="p-3 flex items-center gap-2">
            <CheckSquare className="h-4 w-4 text-green-500" />
            <span className="text-lg font-bold">{readyCount}</span>
            <span className="text-xs text-muted-foreground">Ready</span>
          </CardContent>
        </Card>
        <Card className="flex-1">
          <CardContent className="p-3 flex items-center gap-2">
            <Rocket className="h-4 w-4 text-primary" />
            <span className="text-lg font-bold">{selectedCount}</span>
            <span className="text-xs text-muted-foreground">Selected</span>
          </CardContent>
        </Card>
      </div>

      {/* Bulk Action Bar */}
      {articles.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={handleSelectAll}>
            <CheckSquare className="h-4 w-4 mr-1" />
            {articles.every(a => a.selected) ? 'Deselect All' : 'Select All'}
          </Button>
          <Button size="sm" onClick={() => setPublishModalOpen(true)} disabled={selectedCount === 0}>
            <Rocket className="h-4 w-4 mr-1" />
            Publish Selected ({selectedCount})
          </Button>
          <Button variant="outline" size="sm" onClick={handleSaveAllAsDraft} disabled={isSavingDrafts}>
            {isSavingDrafts ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
            {isSavingDrafts ? 'Saving...' : 'Save All as Draft'}
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportCSV}>
            <Download className="h-4 w-4 mr-1" />
            Export CSV
          </Button>
          <Button variant="destructive" size="sm" onClick={handleClearQueue}>
            <Trash2 className="h-4 w-4 mr-1" />
            Clear Queue
          </Button>
        </div>
      )}

      {/* Two Column Layout */}
      <div className="flex gap-4">
        <div className={`space-y-4 ${selectedArticle ? 'w-[60%]' : 'w-full'}`}>
          <UploadZone onArticlesParsed={handleArticlesParsed} />
          <ArticleQueue
            articles={articles}
            selectedArticleId={selectedId}
            onSelectArticle={setSelectedId}
            onToggleSelection={handleToggleSelection}
            onRemoveArticle={handleRemoveArticle}
          />
        </div>

        {selectedArticle && (
          <div className="w-[40%] border rounded-lg bg-card">
            <ArticleEditPanel article={selectedArticle} onUpdate={handleUpdateArticle} />
          </div>
        )}
      </div>

      <BulkPublishModal
        open={publishModalOpen}
        onOpenChange={setPublishModalOpen}
        articles={selectedArticles}
        onPublished={handlePublished}
      />
    </div>
  );
}
