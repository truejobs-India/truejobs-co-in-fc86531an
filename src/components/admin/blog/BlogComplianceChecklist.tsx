import { useState } from 'react';
import type { PublishComplianceReport, ComplianceCategory } from '@/lib/blogComplianceAnalyzer';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { CheckCircle, AlertTriangle, XCircle, ChevronDown } from 'lucide-react';

const CATEGORY_LABELS: Record<ComplianceCategory, string> = {
  'google-article': 'Google Article Readiness',
  'seo-quality': 'SEO Quality',
  'adsense-safety': 'AdSense Safety Signals',
  'content-quality': 'Content Quality',
  'trust-signals': 'Trust Signals',
};

const CATEGORY_ORDER: ComplianceCategory[] = [
  'google-article', 'seo-quality', 'adsense-safety', 'content-quality', 'trust-signals',
];

interface BlogComplianceChecklistProps {
  compliance: PublishComplianceReport;
}

export function BlogComplianceChecklist({ compliance }: BlogComplianceChecklistProps) {
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});

  const toggleSection = (cat: string) => {
    setOpenSections(prev => ({ ...prev, [cat]: !prev[cat] }));
  };

  const grouped = CATEGORY_ORDER.map(cat => ({
    category: cat,
    label: CATEGORY_LABELS[cat],
    checks: compliance.checks.filter(c => c.category === cat),
  })).filter(g => g.checks.length > 0);

  return (
    <div className="space-y-3">
      {/* Overall score */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">Overall Compliance</span>
          <span className="font-bold">{compliance.overallScore}/100</span>
        </div>
        <Progress value={compliance.overallScore} className="h-2" />
      </div>

      {/* Count badges */}
      <div className="flex gap-2 flex-wrap">
        {compliance.failCount > 0 && (
          <Badge variant="destructive" className="text-xs gap-1">
            <XCircle className="h-3 w-3" /> {compliance.failCount} Fail
          </Badge>
        )}
        {compliance.warnCount > 0 && (
          <Badge variant="secondary" className="text-xs gap-1 bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
            <AlertTriangle className="h-3 w-3" /> {compliance.warnCount} Warn
          </Badge>
        )}
        <Badge variant="outline" className="text-xs gap-1">
          <CheckCircle className="h-3 w-3 text-green-500" /> {compliance.passCount} Pass
        </Badge>
      </div>

      {/* Grouped sections */}
      {grouped.map(g => {
        const fails = g.checks.filter(c => c.status === 'fail').length;
        const warns = g.checks.filter(c => c.status === 'warn').length;
        const isOpen = openSections[g.category] ?? false;

        return (
          <Collapsible key={g.category} open={isOpen} onOpenChange={() => toggleSection(g.category)}>
            <CollapsibleTrigger className="flex items-center gap-2 w-full py-1.5 text-sm font-medium hover:text-primary">
              <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
              <span className="flex-1 text-left">{g.label}</span>
              {fails > 0 && <span className="text-xs text-destructive">{fails} fail</span>}
              {warns > 0 && <span className="text-xs text-amber-600">{warns} warn</span>}
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-1 pl-6 mt-1">
              {g.checks.map(check => (
                <div key={check.key} className="flex items-start gap-2 text-xs py-0.5">
                  {check.status === 'pass' && <CheckCircle className="h-3.5 w-3.5 text-green-500 shrink-0 mt-0.5" />}
                  {check.status === 'warn' && <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />}
                  {check.status === 'fail' && <XCircle className="h-3.5 w-3.5 text-destructive shrink-0 mt-0.5" />}
                  <div>
                    <span className="font-medium">{check.label}</span>
                    <span className="text-muted-foreground"> — {check.detail}</span>
                    {check.recommendation && check.status !== 'pass' && (
                      <p className="text-muted-foreground italic mt-0.5">{check.recommendation}</p>
                    )}
                  </div>
                </div>
              ))}
            </CollapsibleContent>
          </Collapsible>
        );
      })}
    </div>
  );
}
