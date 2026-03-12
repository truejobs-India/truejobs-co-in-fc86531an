import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CheckCircle, XCircle } from 'lucide-react';
import { CachePage, ValidationCheck } from './cacheTypes';
import { validateCachedPage } from './cacheValidation';

interface Props {
  page: CachePage | null;
  open: boolean;
  onClose: () => void;
}

export function CacheValidationPanel({ page, open, onClose }: Props) {
  if (!page) return null;
  const checks = validateCachedPage(page.headHtml, page.bodyHtml, page.slug, page.pageType);
  const passed = checks.filter(c => c.passed).length;

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="text-sm">
            Validation — <span className="font-mono">/{page.slug}</span>
          </DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground mb-2">
          {passed}/{checks.length} checks passed
        </p>
        <ScrollArea className="max-h-[60vh]">
          <div className="space-y-1">
            {checks.map((c, i) => (
              <div key={i} className="flex items-start gap-2 py-1.5 border-b last:border-0">
                {c.passed
                  ? <CheckCircle className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                  : <XCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                }
                <div className="min-w-0">
                  <p className="text-sm">{c.label}</p>
                  {c.detail && <p className="text-xs text-muted-foreground truncate">{c.detail}</p>}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
