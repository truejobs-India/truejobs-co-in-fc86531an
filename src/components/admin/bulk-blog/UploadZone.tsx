import { useCallback, useState } from 'react';
import { UploadCloud, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { parseArticleFile, ParsedArticle } from '@/lib/blogParser';
import { supabase } from '@/integrations/supabase/client';
import { useAdminToast as useToast } from '@/contexts/AdminMessagesContext';

interface UploadZoneProps {
  onArticlesParsed: (articles: ParsedArticle[]) => void;
}

interface FileProgress {
  name: string;
  progress: number;
  status: 'parsing' | 'done' | 'error';
  error?: string;
}

export function UploadZone({ onArticlesParsed }: UploadZoneProps) {
  const { toast } = useToast();
  const [isDragging, setIsDragging] = useState(false);
  const [fileProgress, setFileProgress] = useState<FileProgress[]>([]);
  const [isParsing, setIsParsing] = useState(false);

  const handleFiles = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files).filter(f => {
      const ext = f.name.split('.').pop()?.toLowerCase();
      return ext === 'docx' || ext === 'md';
    });

    if (fileArray.length === 0) {
      toast({ title: 'No valid files', description: 'Only .docx and .md files are supported', variant: 'destructive' });
      return;
    }
    if (fileArray.length > 100) {
      toast({ title: 'Too many files', description: 'Maximum 100 files at once', variant: 'destructive' });
      return;
    }

    setIsParsing(true);
    const progress: FileProgress[] = fileArray.map(f => ({ name: f.name, progress: 0, status: 'parsing' as const }));
    setFileProgress([...progress]);

    const parsed: ParsedArticle[] = [];
    const batchSlugs: string[] = [];
    for (let i = 0; i < fileArray.length; i++) {
      const file = fileArray[i];
      if (file.size > 10 * 1024 * 1024) {
        progress[i] = { ...progress[i], status: 'error', error: 'File too large (10MB max)', progress: 100 };
        setFileProgress([...progress]);
        continue;
      }
      progress[i] = { ...progress[i], progress: 30 };
      setFileProgress([...progress]);
      try {
        const article = await parseArticleFile(file, batchSlugs);
        batchSlugs.push(article.slug);
        parsed.push(article);
        progress[i] = { ...progress[i], status: 'done', progress: 100 };
      } catch (err: any) {
        progress[i] = { ...progress[i], status: 'error', error: err.message || 'Parse failed', progress: 100 };
      }
      setFileProgress([...progress]);
    }

    // Auto-cover generation for .md articles without a cover image
    const needsCover = parsed.filter(a => a.sourceFormat === 'md' && !a.coverImageUrl && a.title && a.slug);
    if (needsCover.length > 0) {
      const semaphore = { count: 0, max: 3 };
      const wait = () => new Promise<void>(resolve => {
        const check = () => {
          if (semaphore.count < semaphore.max) { semaphore.count++; resolve(); }
          else setTimeout(check, 100);
        };
        check();
      });

      const tasks = needsCover.map(async (article) => {
        await wait();
        try {
          const { data, error } = await supabase.functions.invoke('generate-blog-image', {
            body: { slug: article.slug, title: article.title, category: article.category, keywords: article.tags },
          });
          if (error || !data?.imageUrl) throw new Error(data?.error || error?.message || 'No image');
          article.coverImageUrl = data.imageUrl;
          // Only fill alt text if not already set from frontmatter
          if (!article.coverImageAlt || article.coverImageAlt === article.title) {
            article.coverImageAlt = data.altText || article.title;
          }
          article.extraction.coverImage = 'green';
        } catch {
          // stays red
        } finally {
          semaphore.count--;
        }
      });

      await Promise.allSettled(tasks);
      const failCount = needsCover.filter(a => !a.coverImageUrl).length;
      if (failCount > 0) {
        toast({
          title: 'Cover generation warning',
          description: `Cover image generation failed for ${failCount} markdown articles. They were still added to the queue and can be updated manually.`,
          variant: 'destructive',
        });
      }
    }

    if (parsed.length > 0) {
      onArticlesParsed(parsed);
      toast({ title: `${parsed.length} articles parsed`, description: `${fileArray.length - parsed.length} failed` });
    }
    setIsParsing(false);
    setTimeout(() => setFileProgress([]), 3000);
  }, [onArticlesParsed, toast]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        onClick={() => {
          const input = document.createElement('input');
          input.type = 'file';
          input.multiple = true;
          input.accept = '.docx,.md';
          input.onchange = (e) => {
            const files = (e.target as HTMLInputElement).files;
            if (files) handleFiles(files);
          };
          input.click();
        }}
        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
          isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'
        }`}
      >
        {isParsing ? (
          <Loader2 className="h-10 w-10 mx-auto mb-3 animate-spin text-primary" />
        ) : (
          <UploadCloud className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
        )}
        <p className="font-medium">Drag & drop your article .docx or .md files here</p>
        <p className="text-sm text-muted-foreground mt-1">or click to browse</p>
        <p className="text-xs text-muted-foreground mt-2">Supports: .docx, .md  |  Max 100 files  |  10MB each</p>
      </div>

      {fileProgress.length > 0 && (
        <div className="space-y-2 max-h-40 overflow-y-auto">
          {fileProgress.map((fp, i) => (
            <div key={i} className="flex items-center gap-2 text-sm">
              {fp.status === 'done' ? (
                <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
              ) : fp.status === 'error' ? (
                <XCircle className="h-4 w-4 text-destructive shrink-0" />
              ) : (
                <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
              )}
              <span className="truncate flex-1">{fp.name}</span>
              {fp.status === 'parsing' && <Progress value={fp.progress} className="w-20 h-2" />}
              {fp.error && <span className="text-destructive text-xs">{fp.error}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
