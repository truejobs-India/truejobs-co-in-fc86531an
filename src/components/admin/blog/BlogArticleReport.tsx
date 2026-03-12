import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, AlertTriangle, XCircle } from 'lucide-react';
import type { QualityReport, QualityGrade } from '@/lib/blogArticleAnalyzer';

const GRADE_COLORS: Record<QualityGrade, string> = {
  'Excellent': 'bg-green-600',
  'Good': 'bg-blue-600',
  'Needs Improvement': 'bg-amber-500',
  'Poor': 'bg-destructive',
};

interface BlogArticleReportProps {
  report: QualityReport;
}

export function BlogArticleReport({ report }: BlogArticleReportProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Quality Score</span>
          <Badge className={`${GRADE_COLORS[report.grade]} text-white`}>{report.grade}</Badge>
        </div>
        <span className="text-lg font-bold">{report.totalScore}/100</span>
      </div>
      <Progress value={report.totalScore} className="h-2" />
      <div className="space-y-1.5">
        {report.factors.map((f) => (
          <div key={f.name} className="flex items-start gap-2 text-xs">
            {f.status === 'pass' && <CheckCircle className="h-3.5 w-3.5 text-green-500 shrink-0 mt-0.5" />}
            {f.status === 'warn' && <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />}
            {f.status === 'fail' && <XCircle className="h-3.5 w-3.5 text-destructive shrink-0 mt-0.5" />}
            <div className="flex-1">
              <span className="font-medium">{f.name}</span>
              <span className="text-muted-foreground ml-1">({f.score}/{f.maxScore})</span>
              <p className="text-muted-foreground">{f.explanation}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
