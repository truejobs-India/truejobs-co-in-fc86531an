import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  ChevronDown, Search, Play, Square, RotateCcw, CheckCircle2,
  XCircle, AlertTriangle, SkipForward, FileText, Sparkles,
} from 'lucide-react';
import { useAdminToast as useToast } from '@/contexts/AdminMessagesContext';
import {
  useSeoMetadataWorkflow,
  type SeoScanReport, type SeoFixResult, type SeoArticleScanResult,
} from '@/hooks/useSeoMetadataWorkflow';

interface SeoMetadataWorkflowPanelProps {
  posts: any[];
  onComplete?: () => void;
}

export function SeoMetadataWorkflowPanel({ posts, onComplete }: SeoMetadataWorkflowPanelProps) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const { status, scanReport, progress, results, scan, execute, requestStop, reset } = useSeoMetadataWorkflow();

  const handleScan = async () => {
    try {
      await scan(posts);
    } catch (err: any) {
      toast({ title: 'Scan failed', description: err.message, variant: 'destructive' });
    }
  };

  const handleExecute = async () => {
    try {
      await execute(onComplete);
      toast({ title: '✅ SEO metadata fix complete' });
      onComplete?.();
    } catch (err: any) {
      toast({ title: 'Execution failed', description: err.message, variant: 'destructive' });
    }
  };

  const isActive = status !== 'idle';

  return (
    <div className="px-6 pb-4 border-b">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger className="flex items-center gap-2 w-full py-2 text-sm font-medium hover:text-primary">
          <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          <Sparkles className="h-4 w-4" /> SEO Metadata AI Workflow
          {isActive && (
            <Badge variant="secondary" className="ml-2 text-xs">{status}</Badge>
          )}
        </CollapsibleTrigger>

        <CollapsibleContent className="space-y-4 mt-3">
          {/* Idle */}
          {status === 'idle' && (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Scans all {posts.length} blog articles for SEO metadata problems (missing titles, descriptions, bad slugs, weak metadata),
                shows a detailed report, then fixes only problematic fields using Gemini 2.5 Pro.
              </p>
              <Button size="sm" variant="outline" onClick={handleScan}>
                <Search className="h-4 w-4 mr-1" /> Scan SEO Metadata Issues
              </Button>
            </div>
          )}

          {/* Scanning */}
          {status === 'scanning' && (
            <div className="text-sm text-muted-foreground flex items-center gap-2">
              <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
              Scanning {posts.length} articles for SEO metadata issues…
            </div>
          )}

          {/* Report */}
          {status === 'scan_complete' && scanReport && (
            <div className="space-y-4">
              <SeoScanReportView report={scanReport} />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={handleExecute}
                  disabled={scanReport.total_with_issues === 0}
                >
                  <Play className="h-3 w-3 mr-1" /> Fix SEO Metadata with AI ({scanReport.total_with_issues} articles)
                </Button>
                <Button size="sm" variant="outline" onClick={reset}>
                  <RotateCcw className="h-3 w-3 mr-1" /> Discard
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Only fields with actual issues will be generated/fixed. Strong existing metadata is preserved.
              </p>
            </div>
          )}

          {/* Executing */}
          {status === 'executing' && progress && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">
                  Fixing SEO metadata… {progress.done}/{progress.total}
                </span>
                <Button size="sm" variant="destructive" onClick={requestStop}>
                  <Square className="h-3 w-3 mr-1" /> Stop
                </Button>
              </div>
              <Progress value={(progress.done / progress.total) * 100} className="h-2" />
              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                <span className="text-green-600">{progress.fixed} fixed</span>
                <span>•</span>
                <span>{progress.skipped} skipped</span>
                <span>•</span>
                <span className="text-destructive">{progress.failed} failed</span>
              </div>
              {progress.current_title && (
                <p className="text-xs text-muted-foreground">{progress.current_title}</p>
              )}
            </div>
          )}

          {/* Completed / Stopped / Failed */}
          {(status === 'completed' || status === 'stopped' || status === 'failed') && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                {status === 'completed' && <CheckCircle2 className="h-4 w-4 text-green-600" />}
                {status === 'stopped' && <Square className="h-4 w-4 text-yellow-600" />}
                {status === 'failed' && <XCircle className="h-4 w-4 text-destructive" />}
                <span className="text-sm font-medium">SEO Metadata Fix — {status}</span>
                {progress && (
                  <span className="text-xs text-muted-foreground">
                    — {progress.fixed} fixed, {progress.skipped} skipped, {progress.failed} failed
                  </span>
                )}
              </div>

              {results.length > 0 && <SeoFixResultsView results={results} />}

              <Button size="sm" variant="outline" onClick={reset}>
                <RotateCcw className="h-3 w-3 mr-1" /> Start Fresh
              </Button>
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

// ── Report View ──
function SeoScanReportView({ report }: { report: SeoScanReport }) {
  const [showArticles, setShowArticles] = useState(false);

  return (
    <div className="space-y-3">
      <div className="text-xs font-medium text-muted-foreground">SEO Metadata Scan Report</div>

      {/* Summary grid */}
      <div className="grid grid-cols-4 gap-2 text-xs">
        <div className="bg-muted rounded p-2 text-center">
          <div className="font-semibold text-base">{report.total_scanned}</div>
          <div className="text-muted-foreground">Scanned</div>
        </div>
        <div className="bg-muted rounded p-2 text-center">
          <div className="font-semibold text-base text-amber-600">{report.total_with_issues}</div>
          <div className="text-muted-foreground">With Issues</div>
        </div>
        <div className="bg-muted rounded p-2 text-center">
          <div className="font-semibold text-base text-green-600">{report.total_already_good}</div>
          <div className="text-muted-foreground">Already Good</div>
        </div>
        <div className="bg-muted rounded p-2 text-center">
          <div className="font-semibold text-base text-primary">{report.total_with_issues}</div>
          <div className="text-muted-foreground">To Fix</div>
        </div>
      </div>

      {/* Issue breakdown */}
      <div className="grid grid-cols-3 gap-1.5 text-xs">
        {report.missing_meta_title > 0 && (
          <div className="flex items-center gap-1.5 bg-destructive/10 rounded px-2 py-1">
            <XCircle className="h-3 w-3 text-destructive shrink-0" />
            <span>{report.missing_meta_title} missing meta title</span>
          </div>
        )}
        {report.missing_meta_description > 0 && (
          <div className="flex items-center gap-1.5 bg-destructive/10 rounded px-2 py-1">
            <XCircle className="h-3 w-3 text-destructive shrink-0" />
            <span>{report.missing_meta_description} missing meta desc</span>
          </div>
        )}
        {report.bad_slug > 0 && (
          <div className="flex items-center gap-1.5 bg-amber-500/10 rounded px-2 py-1">
            <AlertTriangle className="h-3 w-3 text-amber-600 shrink-0" />
            <span>{report.bad_slug} bad slug</span>
          </div>
        )}
        {report.weak_metadata > 0 && (
          <div className="flex items-center gap-1.5 bg-amber-500/10 rounded px-2 py-1">
            <AlertTriangle className="h-3 w-3 text-amber-600 shrink-0" />
            <span>{report.weak_metadata} weak metadata</span>
          </div>
        )}
        {report.missing_excerpt > 0 && (
          <div className="flex items-center gap-1.5 bg-muted rounded px-2 py-1">
            <SkipForward className="h-3 w-3 text-muted-foreground shrink-0" />
            <span>{report.missing_excerpt} missing excerpt</span>
          </div>
        )}
      </div>

      {/* Article details toggle */}
      {report.articles_with_issues.length > 0 && (
        <Collapsible open={showArticles} onOpenChange={setShowArticles}>
          <CollapsibleTrigger className="flex items-center gap-1 text-xs font-medium text-primary hover:underline">
            <ChevronDown className={`h-3 w-3 transition-transform ${showArticles ? 'rotate-180' : ''}`} />
            Show {report.articles_with_issues.length} affected articles
          </CollapsibleTrigger>
          <CollapsibleContent>
            <ScrollArea className="max-h-60 mt-2">
              <div className="space-y-1.5">
                {report.articles_with_issues.map(a => (
                  <div key={a.id} className="border rounded p-2 text-xs space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium truncate">{a.title}</p>
                        <p className="text-muted-foreground truncate">/blog/{a.slug}</p>
                      </div>
                      <Badge variant={a.is_published ? 'default' : 'secondary'} className="text-[9px] shrink-0">
                        {a.is_published ? 'Published' : 'Draft'}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {a.issues.map((issue, idx) => (
                        <span
                          key={idx}
                          className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] ${
                            issue.severity === 'high' ? 'bg-destructive/10 text-destructive' :
                            issue.severity === 'medium' ? 'bg-amber-500/10 text-amber-700' :
                            'bg-muted text-muted-foreground'
                          }`}
                        >
                          {issue.label}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}

// ── Results View ──
function SeoFixResultsView({ results }: { results: SeoFixResult[] }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Collapsible open={expanded} onOpenChange={setExpanded}>
      <CollapsibleTrigger className="flex items-center gap-1 text-xs font-medium text-primary hover:underline">
        <ChevronDown className={`h-3 w-3 transition-transform ${expanded ? 'rotate-180' : ''}`} />
        View {results.length} results
      </CollapsibleTrigger>
      <CollapsibleContent>
        <ScrollArea className="max-h-60 mt-2">
          <div className="space-y-1">
            {results.map((r, idx) => (
              <div key={idx} className="flex items-start gap-2 text-xs border rounded p-2">
                {r.status === 'fixed' && <CheckCircle2 className="h-3.5 w-3.5 text-green-600 shrink-0 mt-0.5" />}
                {r.status === 'skipped' && <SkipForward className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />}
                {r.status === 'failed' && <XCircle className="h-3.5 w-3.5 text-destructive shrink-0 mt-0.5" />}
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">{r.slug}</p>
                  <p className="text-muted-foreground">{r.reason}</p>
                  {r.ai_summary && <p className="text-muted-foreground italic">{r.ai_summary}</p>}
                  {r.changes && Object.keys(r.changes).length > 0 && (
                    <div className="mt-1 space-y-0.5">
                      {Object.entries(r.changes).map(([field, change]) => (
                        <div key={field} className="text-[10px]">
                          <span className="font-medium">{field}:</span>{' '}
                          <span className="line-through text-muted-foreground">{String(change.before || '(empty)').substring(0, 40)}</span>
                          {' → '}
                          <span className="text-green-700">{String(change.after).substring(0, 60)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CollapsibleContent>
    </Collapsible>
  );
}
