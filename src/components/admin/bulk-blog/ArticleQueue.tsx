import { ParsedArticle, getArticleReadiness } from '@/lib/blogParser';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Eye, Pencil, X, FileText, Image, Search, MessageSquare } from 'lucide-react';

interface ArticleQueueProps {
  articles: ParsedArticle[];
  selectedArticleId: string | null;
  onSelectArticle: (id: string) => void;
  onToggleSelection: (id: string) => void;
  onRemoveArticle: (id: string) => void;
}

function StatusDot({ status }: { status: 'green' | 'yellow' | 'red' }) {
  const colors = { green: 'bg-green-500', yellow: 'bg-yellow-500', red: 'bg-destructive' };
  return <span className={`inline-block h-2 w-2 rounded-full ${colors[status]}`} />;
}

export function ArticleQueue({ articles, selectedArticleId, onSelectArticle, onToggleSelection, onRemoveArticle }: ArticleQueueProps) {
  if (articles.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <FileText className="h-12 w-12 mx-auto mb-3 opacity-40" />
        <p>No articles in queue</p>
        <p className="text-sm">Upload .docx files to get started</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {articles.map(article => {
        const readiness = getArticleReadiness(article);
        const borderColor = readiness === 'green' ? 'border-l-green-500' : readiness === 'yellow' ? 'border-l-yellow-500' : 'border-l-destructive';
        const isActive = selectedArticleId === article.id;

        return (
          <div
            key={article.id}
            className={`border rounded-lg p-3 cursor-pointer transition-colors border-l-4 ${borderColor} ${
              isActive ? 'bg-accent' : 'hover:bg-muted/50'
            }`}
            onClick={() => onSelectArticle(article.id)}
          >
            <div className="flex items-start gap-2">
              <Checkbox
                checked={article.selected}
                onCheckedChange={() => onToggleSelection(article.id)}
                onClick={(e) => e.stopPropagation()}
                className="mt-1"
              />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{article.title}</p>
                <p className="text-xs text-muted-foreground truncate">/blog/{article.slug}</p>
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  <Badge variant="outline" className="text-xs">{article.category}</Badge>
                  <span className="text-xs text-muted-foreground">{article.wordCount.toLocaleString()} words</span>
                </div>
                <div className="flex items-center gap-3 mt-1.5">
                  <span className="flex items-center gap-1 text-xs" title="Cover Image">
                    <Image className="h-3 w-3" />
                    Cover
                    <StatusDot status={article.coverImageUrl ? 'green' : 'red'} />
                  </span>
                  <span className="flex items-center gap-1 text-xs" title="Article Images (3-4 recommended)">
                    <Image className="h-3 w-3" />
                    Imgs: {article.articleImages.length}
                    <StatusDot status={article.articleImages.length >= 3 ? 'green' : article.articleImages.length >= 1 ? 'yellow' : 'red'} />
                  </span>
                  <span className="flex items-center gap-1 text-xs" title="Meta SEO">
                    <Search className="h-3 w-3" />
                    <StatusDot status={article.extraction.metaTitle || 'red'} />
                  </span>
                  <span className="flex items-center gap-1 text-xs" title="FAQ">
                    <MessageSquare className="h-3 w-3" />
                    <StatusDot status={article.faqCount > 0 ? 'green' : 'yellow'} />
                    {article.faqCount > 0 && <span>{article.faqCount}</span>}
                  </span>
                </div>
              </div>
              <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={(e) => { e.stopPropagation(); onRemoveArticle(article.id); }}>
                <X className="h-3 w-3" />
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
