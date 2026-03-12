import { CheckCircle, AlertTriangle, XCircle } from 'lucide-react';
import type { SEOReport } from '@/lib/blogArticleAnalyzer';

interface BlogSEOChecklistProps {
  report: SEOReport;
}

export function BlogSEOChecklist({ report }: BlogSEOChecklistProps) {
  const passCount = report.checks.filter(c => c.status === 'pass').length;
  const total = report.checks.length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">SEO Score</span>
        <span className="text-lg font-bold">{report.totalScore}/100</span>
      </div>
      <p className="text-xs text-muted-foreground">{passCount}/{total} checks passed</p>
      <div className="space-y-1">
        {report.checks.map((check) => (
          <div key={check.name} className="flex items-center gap-2 text-xs py-0.5">
            {check.status === 'pass' && <CheckCircle className="h-3.5 w-3.5 text-green-500 shrink-0" />}
            {check.status === 'warn' && <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />}
            {check.status === 'fail' && <XCircle className="h-3.5 w-3.5 text-destructive shrink-0" />}
            <span className="font-medium">{check.name}</span>
            <span className="text-muted-foreground ml-auto truncate max-w-[50%] text-right">{check.detail}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
