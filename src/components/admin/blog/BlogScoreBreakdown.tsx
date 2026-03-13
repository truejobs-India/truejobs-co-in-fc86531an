import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle, AlertTriangle, XCircle, BarChart3 } from 'lucide-react';
import type { QualityReport, SEOReport, ArticleMetadata, CheckStatus } from '@/lib/blogArticleAnalyzer';
import type { PublishComplianceReport, ComplianceCategory } from '@/lib/blogComplianceAnalyzer';

interface BlogScoreBreakdownProps {
  metadata: ArticleMetadata;
  quality: QualityReport;
  seo: SEOReport;
  compliance: PublishComplianceReport;
}

function StatusIcon({ status }: { status: CheckStatus }) {
  if (status === 'pass') return <CheckCircle className="h-3.5 w-3.5 text-green-500 shrink-0" />;
  if (status === 'warn') return <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />;
  return <XCircle className="h-3.5 w-3.5 text-destructive shrink-0" />;
}

const CATEGORY_LABELS: Record<ComplianceCategory, string> = {
  'google-article': 'Google Article Readiness',
  'seo-quality': 'SEO Quality',
  'adsense-safety': 'AdSense Safety',
  'content-quality': 'Content Quality',
  'trust-signals': 'Trust Signals',
};

export function BlogScoreBreakdown({ metadata, quality, seo, compliance }: BlogScoreBreakdownProps) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1 text-xs h-7">
          <BarChart3 className="h-3.5 w-3.5" /> Score Breakdown
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Score Breakdown</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="quality" className="w-full">
          <TabsList className="w-full">
            <TabsTrigger value="quality" className="flex-1">Quality ({quality.totalScore})</TabsTrigger>
            <TabsTrigger value="seo" className="flex-1">SEO ({seo.totalScore})</TabsTrigger>
            <TabsTrigger value="compliance" className="flex-1">Compliance ({compliance.overallScore})</TabsTrigger>
          </TabsList>

          {/* Quality Tab */}
          <TabsContent value="quality" className="space-y-4">
            <div className="flex items-center justify-between">
              <Badge className={quality.totalScore >= 85 ? 'bg-green-600 text-white' : quality.totalScore >= 70 ? 'bg-blue-600 text-white' : quality.totalScore >= 50 ? 'bg-amber-500 text-white' : 'bg-destructive text-white'}>
                {quality.grade}
              </Badge>
              <span className="text-lg font-bold">{quality.totalScore}/100</span>
            </div>

            <div className="space-y-2">
              {quality.factors.map((f) => (
                <div key={f.name} className="flex items-start gap-2 text-sm border-b border-border/50 pb-2">
                  <StatusIcon status={f.status} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{f.name}</span>
                      <span className="text-muted-foreground text-xs">{f.score}/{f.maxScore}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{f.explanation}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Parsed Input Values */}
            <div className="border rounded-lg p-3 bg-muted/30">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-2">Parsed Input Values</h4>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                <span>Word Count:</span><span className="font-mono">{metadata.wordCount}</span>
                <span>Headings:</span>
                <span className="flex flex-wrap gap-1">
                  {(metadata.headings || []).map((h, i) => (
                    <Badge key={i} variant="outline" className="text-[10px] px-1 py-0">H{h.level}</Badge>
                  ))}
                  {(!metadata.headings || metadata.headings.length === 0) && <span className="text-muted-foreground">None</span>}
                </span>
                <span>Has Intro:</span><span>{metadata.hasIntro ? '✅' : '❌'}</span>
                <span>Has Conclusion:</span><span>{metadata.hasConclusion ? '✅' : '❌'}</span>
                <span>Internal Links:</span><span className="font-mono">{metadata.internalLinks?.length || 0}</span>
                <span>FAQ Count:</span><span className="font-mono">{metadata.faqCount || 0}</span>
                <span>Meta Title:</span><span>{metadata.metaTitle ? '✅' : '❌'}</span>
                <span>Meta Description:</span><span>{metadata.metaDescription ? '✅' : '❌'}</span>
                <span>Excerpt:</span><span>{metadata.excerpt ? '✅' : '❌'}</span>
                <span>Cover Image:</span><span>{metadata.coverImageUrl ? '✅' : '❌'}</span>
                <span>Cover Alt:</span><span>{metadata.coverImageAlt ? '✅' : '❌'}</span>
              </div>
              <p className="text-[10px] text-muted-foreground mt-2">
                Total = sum(factor scores), capped at 100 → grade
              </p>
            </div>
          </TabsContent>

          {/* SEO Tab */}
          <TabsContent value="seo" className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Score derived from pass rate across all checks</span>
              <span className="text-lg font-bold">{seo.totalScore}/100</span>
            </div>

            <div className="space-y-2">
              {seo.checks.map((c) => (
                <div key={c.name} className="flex items-start gap-2 text-sm border-b border-border/50 pb-2">
                  <StatusIcon status={c.status} />
                  <div className="flex-1 min-w-0">
                    <span className="font-medium">{c.name}</span>
                    <p className="text-xs text-muted-foreground">{c.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          {/* Compliance Tab */}
          <TabsContent value="compliance" className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex gap-2 text-xs">
                <Badge variant="default">{compliance.passCount} pass</Badge>
                <Badge variant="secondary">{compliance.warnCount} warn</Badge>
                <Badge variant="destructive">{compliance.failCount} fail</Badge>
              </div>
              <span className="text-lg font-bold">{compliance.overallScore}/100</span>
            </div>

            <p className="text-xs text-muted-foreground bg-muted/30 rounded p-2">
              <strong>Formula:</strong> overallScore = 0.4 × Google Article + 0.3 × SEO + 0.3 × AdSense
            </p>

            {/* Group by category */}
            {(Object.keys(CATEGORY_LABELS) as ComplianceCategory[]).map(cat => {
              const catChecks = compliance.checks.filter(c => c.category === cat);
              if (catChecks.length === 0) return null;
              return (
                <div key={cat} className="space-y-1">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase">{CATEGORY_LABELS[cat]}</h4>
                  {catChecks.map(c => (
                    <div key={c.key} className="flex items-start gap-2 text-sm border-b border-border/50 pb-1.5">
                      <StatusIcon status={c.status} />
                      <div className="flex-1 min-w-0">
                        <span className="font-medium text-xs">{c.label}</span>
                        <p className="text-[11px] text-muted-foreground">{c.detail}</p>
                        {c.recommendation && (
                          <p className="text-[11px] text-primary/80 mt-0.5">💡 {c.recommendation}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
