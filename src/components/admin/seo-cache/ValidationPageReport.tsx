import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { CheckCircle2, AlertTriangle, XCircle, Wrench, RefreshCw, EyeOff } from 'lucide-react';
import { PageValidationReport, ValidationCheckResult, ValidationCategory } from './cacheTypes';

interface Props {
  report: PageValidationReport | null;
  open: boolean;
  onClose: () => void;
  onRebuild: (slug: string) => void;
  onRevalidate: (slug: string) => void;
  onDismiss: (slug: string) => void;
}

const CATEGORY_LABELS: Record<ValidationCategory, string> = {
  'seo-basics': 'SEO Basics',
  'schema': 'Schema',
  'content-quality': 'Content Quality',
  'consistency': 'Consistency',
};

const CATEGORY_ORDER: ValidationCategory[] = ['seo-basics', 'schema', 'content-quality', 'consistency'];

function SeverityIcon({ severity }: { severity: string }) {
  if (severity === 'pass') return <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />;
  if (severity === 'warning') return <AlertTriangle className="h-4 w-4 text-yellow-600 shrink-0" />;
  return <XCircle className="h-4 w-4 text-red-600 shrink-0" />;
}

export function ValidationPageReport({ report, open, onClose, onRebuild, onRevalidate, onDismiss }: Props) {
  if (!report) return null;

  const grouped = CATEGORY_ORDER.reduce<Record<ValidationCategory, ValidationCheckResult[]>>((acc, cat) => {
    acc[cat] = report.checks.filter(c => c.category === cat);
    return acc;
  }, {} as any);

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <code className="text-xs bg-muted px-1.5 py-0.5 rounded">/{report.slug}</code>
            <Badge variant="outline" className="text-xs">{report.pageType}</Badge>
          </DialogTitle>
          <div className="flex gap-3 text-xs text-muted-foreground pt-1">
            <span className="text-green-600">{report.passCount} pass</span>
            <span className="text-yellow-600">{report.warnCount} warn</span>
            <span className="text-red-600">{report.failCount} fail</span>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {CATEGORY_ORDER.map(cat => {
            const checks = grouped[cat];
            if (!checks || checks.length === 0) return null;
            return (
              <div key={cat}>
                <h4 className="text-sm font-medium text-muted-foreground mb-2 border-b pb-1">
                  {CATEGORY_LABELS[cat]}
                </h4>
                <div className="space-y-2">
                  {checks.map(c => (
                    <div key={c.id} className="flex gap-2 items-start py-1">
                      <SeverityIcon severity={c.severity} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{c.label}</p>
                        <p className="text-xs text-muted-foreground">{c.detail}</p>
                        {c.fix && c.severity !== 'pass' && (
                          <p className="text-xs text-muted-foreground/70 italic mt-0.5">💡 {c.fix}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <DialogFooter className="flex-row gap-2 pt-3">
          <Button size="sm" variant="secondary" className="gap-1" onClick={() => onRebuild(report.slug)}>
            <Wrench className="h-3 w-3" /> Rebuild Page
          </Button>
          <Button size="sm" variant="outline" className="gap-1" onClick={() => onRevalidate(report.slug)}>
            <RefreshCw className="h-3 w-3" /> Revalidate
          </Button>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="sm" variant="ghost" className="gap-1" onClick={() => { onDismiss(report.slug); onClose(); }}>
                  <EyeOff className="h-3 w-3" /> Dismiss
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs max-w-48">Temporarily hides this page from the issues list. Resets when validation is re-run.</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
