import type { PublishComplianceReport } from '@/lib/blogComplianceAnalyzer';
import { AlertTriangle, XCircle } from 'lucide-react';

interface BlogPolicyWarningsProps {
  compliance: PublishComplianceReport;
}

export function BlogPolicyWarnings({ compliance }: BlogPolicyWarningsProps) {
  const issues = compliance.checks
    .filter(c => c.status === 'fail' || c.status === 'warn')
    .sort((a, b) => (a.status === 'fail' ? 0 : 1) - (b.status === 'fail' ? 0 : 1));

  if (issues.length === 0) return null;

  return (
    <div className="border rounded-lg p-3 space-y-1.5 border-amber-300 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-950/20">
      <p className="text-xs font-semibold text-amber-800 dark:text-amber-200">
        {issues.filter(i => i.status === 'fail').length} issues, {issues.filter(i => i.status === 'warn').length} warnings
      </p>
      {issues.map(issue => (
        <div key={issue.key} className="flex items-start gap-1.5 text-xs">
          {issue.status === 'fail'
            ? <XCircle className="h-3 w-3 text-destructive shrink-0 mt-0.5" />
            : <AlertTriangle className="h-3 w-3 text-amber-500 shrink-0 mt-0.5" />
          }
          <span>
            <span className="font-medium">{issue.label}</span>
            {issue.recommendation && (
              <span className="text-muted-foreground"> — {issue.recommendation}</span>
            )}
          </span>
        </div>
      ))}
    </div>
  );
}
