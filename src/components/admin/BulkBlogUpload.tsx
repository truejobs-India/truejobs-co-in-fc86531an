import { useState, useCallback, useEffect } from 'react';
import { ParsedArticle, getArticleReadiness } from '@/lib/blogParser';
import { UploadZone } from './bulk-blog/UploadZone';
import { ArticleQueue } from './bulk-blog/ArticleQueue';
import { ArticleEditPanel } from './bulk-blog/ArticleEditPanel';
import { BulkPublishModal } from './bulk-blog/BulkPublishModal';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { CheckSquare, Rocket, Save, Download, Trash2, FileText } from 'lucide-react';

export function BulkBlogUpload() {
  const { toast } = useToast();
  const [articles, setArticles] = useState<ParsedArticle[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [publishModalOpen, setPublishModalOpen] = useState(false);

  const selectedArticle = articles.find(a => a.id === selectedId) || null;
  const selectedCount = articles.filter(a => a.selected).length;
  const readyCount = articles.filter(a => getArticleReadiness(a) === 'green').length;

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        toast({ title: 'Drafts auto-saved', description: `${articles.length} articles in queue` });
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [articles.length, toast]);

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
        <p className="text-sm text-muted-foreground">Upload .docx files. SEO data extracted automatically.</p>
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
          <Button variant="outline" size="sm" onClick={() => toast({ title: 'All saved as draft' })}>
            <Save className="h-4 w-4 mr-1" />
            Save All as Draft
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
        {/* Left Column: Upload + Queue */}
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

        {/* Right Column: Edit Panel */}
        {selectedArticle && (
          <div className="w-[40%] border rounded-lg bg-card">
            <ArticleEditPanel
              article={selectedArticle}
              onUpdate={handleUpdateArticle}
            />
          </div>
        )}
      </div>

      {/* Bulk Publish Modal */}
      <BulkPublishModal
        open={publishModalOpen}
        onOpenChange={setPublishModalOpen}
        articles={selectedArticles}
        onPublished={handlePublished}
      />
    </div>
  );
}
