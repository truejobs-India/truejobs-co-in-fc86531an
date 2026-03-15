import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  ChevronDown, Wrench, Zap, Square, CheckCircle2,
  XCircle, AlertTriangle, Shield, Clock, SkipForward, Play, RotateCcw, Upload,
} from 'lucide-react';
import { useAdminToast as useToast } from '@/contexts/AdminMessagesContext';
import {
  useBulkBlogWorkflow,
  type WorkflowType, type ArticleVerdict, type ScanReport, type ExecutionResult,
} from '@/hooks/useBulkBlogWorkflow';

interface BulkWorkflowPanelProps {
  posts: any[];
  blogTextModel: string;
  onComplete?: () => void;
}

// ── Workflow-specific labels ──
function getWorkflowLabel(type: WorkflowType | null): string {
  if (type === 'enrich') return 'Enrichment';
  if (type === 'publish') return 'Publish';
  return 'Fix';
}

function getScanTitle(type: WorkflowType | null): string {
  if (type === 'enrich') return 'Enrichment Scan';
  if (type === 'publish') return 'Publish Eligibility Scan';
  return 'Fix Scan';
}

function getConfirmLabel(type: WorkflowType | null, count: number): string {
  if (type === 'enrich') return `Confirm & Enrich (${count} articles)`;
  if (type === 'publish') return `Publish ${count} Ready Articles`;
  return `Confirm & Fix (${count} articles)`;
}

function getExecutingLabel(type: WorkflowType | null, title: string): string {
  if (type === 'enrich') return `Enriching: ${title || 'Processing…'}`;
  if (type === 'publish') return `Publishing: ${title || 'Processing…'}`;
  return `Fixing: ${title || 'Processing…'}`;
}

export function BulkWorkflowPanel({ posts, blogTextModel, onComplete }: BulkWorkflowPanelProps) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [maxPerRun, setMaxPerRun] = useState(50);

  const {
    status, scanReport, progress, executionResults, scanProgress, workflowType,
    startScan, confirmExecution, requestStop, cancelScan, reset,
  } = useBulkBlogWorkflow();

  const handleStartScan = async (type: WorkflowType) => {
    try {
      await startScan(type, posts, blogTextModel, maxPerRun);
    } catch (err: any) {
      toast({ title: 'Scan failed', description: err.message, variant: 'destructive' });
    }
  };

  const handleConfirm = async () => {
    try {
      await confirmExecution(blogTextModel, onComplete);
      const label = getWorkflowLabel(workflowType);
      toast({ title: `✅ ${label} workflow complete` });
      onComplete?.();
    } catch (err: any) {
      toast({ title: 'Execution failed', description: err.message, variant: 'destructive' });
    }
  };

  const isActive = status !== 'idle';
  const isPublishWorkflow = workflowType === 'publish';
  const isEnrichWorkflow = workflowType === 'enrich';

  return (
    <div className="px-6 pb-4 border-b">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger className="flex items-center gap-2 w-full py-2 text-sm font-medium hover:text-primary">
          <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          <Zap className="h-4 w-4" /> Bulk Fix, Enrich & Publish Workflows
          {isActive && <Badge variant="secondary" className="ml-2 text-xs">{status}{workflowType ? ` (${getWorkflowLabel(workflowType)})` : ''}</Badge>}
        </CollapsibleTrigger>

        <CollapsibleContent className="space-y-4 mt-3">
          {/* ── Idle State ── */}
          {status === 'idle' && (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Max articles per run</Label>
                  <Input
                    type="number"
                    value={maxPerRun}
                    onChange={e => setMaxPerRun(Math.max(1, Math.min(200, parseInt(e.target.value) || 50)))}
                    className="w-24 h-8 text-xs"
                    min={1}
                    max={200}
                  />
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => handleStartScan('fix')}>
                  <Wrench className="h-4 w-4 mr-1" /> Fix All Pending
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleStartScan('enrich')}>
                  <Zap className="h-4 w-4 mr-1" /> Enrich All Pending
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleStartScan('publish')} className="border-green-600/30 text-green-700 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-950/30">
                  <Upload className="h-4 w-4 mr-1" /> Publish All Fixed & Enriched
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Scans all {posts.length} articles, classifies them, then shows a report before making changes.
              </p>
            </div>
          )}

          {/* ── Scanning State ── */}
          {status === 'scanning' && scanProgress && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">
                  {getScanTitle(workflowType)} — Stage {scanProgress.stage}: {scanProgress.stage === 1 ? 'Eligibility Analysis' : 'AI Content Verification'}
                </span>
                <Button size="sm" variant="destructive" onClick={cancelScan}>
                  <Square className="h-3 w-3 mr-1" /> Cancel
                </Button>
              </div>
              <Progress value={(scanProgress.done / scanProgress.total) * 100} className="h-2" />
              <p className="text-xs text-muted-foreground">
                {scanProgress.stage === 2
                  ? `${scanProgress.done}/${scanProgress.total} borderline articles — ${scanProgress.detail}`
                  : `${scanProgress.done}/${scanProgress.total} — ${scanProgress.detail}`}
              </p>
            </div>
          )}

          {/* ── Cancelled State ── */}
          {status === 'cancelled' && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <XCircle className="h-4 w-4" /> {getWorkflowLabel(workflowType)} scan cancelled. Partial data preserved.
              </div>
              {scanReport && (isPublishWorkflow ? <PublishReportView report={scanReport} /> : <ReportView report={scanReport} workflowType={workflowType} />)}
              <Button size="sm" variant="outline" onClick={reset}>
                <RotateCcw className="h-3 w-3 mr-1" /> Start Fresh
              </Button>
            </div>
          )}

          {/* ── Report State ── */}
          {status === 'scan_complete' && scanReport && (
            <div className="space-y-4">
              {isPublishWorkflow ? (
                <>
                  <PublishReportView report={scanReport} />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleConfirm} disabled={(scanReport.publish_categories?.ready_to_publish.length || 0) === 0} className="bg-green-600 hover:bg-green-700 text-white">
                      <Play className="h-3 w-3 mr-1" /> Publish {scanReport.publish_categories?.ready_to_publish.length || 0} Ready Articles
                    </Button>
                    <Button size="sm" variant="outline" onClick={reset}>
                      <RotateCcw className="h-3 w-3 mr-1" /> Discard
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    ⚠️ Each article will be re-verified immediately before publishing.
                  </p>
                </>
              ) : (
                <>
                  <ReportView report={scanReport} workflowType={workflowType} />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleConfirm} disabled={scanReport.total_actionable === 0}>
                      <Play className="h-3 w-3 mr-1" /> {getConfirmLabel(workflowType, Math.min(scanReport.total_actionable, scanReport.max_per_run))}
                    </Button>
                    <Button size="sm" variant="outline" onClick={reset}>
                      <RotateCcw className="h-3 w-3 mr-1" /> Discard
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── Executing State ── */}
          {status === 'executing' && progress && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{getExecutingLabel(workflowType, progress.current_title)}</span>
                <Button size="sm" variant="destructive" onClick={requestStop}>
                  <Square className="h-3 w-3 mr-1" /> Stop
                </Button>
              </div>
              <Progress value={(progress.done / progress.total) * 100} className="h-2" />
              <div className="flex gap-3 text-xs text-muted-foreground">
                <span>{progress.done}/{progress.total} done</span>
                {isEnrichWorkflow ? (
                  <>
                    <span className="text-green-600">{progress.fully_enriched} enriched</span>
                    <span className="text-yellow-600">{progress.partially_improved} partial</span>
                    <span className="text-orange-600">{progress.still_pending} still pending</span>
                    <span className="text-destructive">{progress.failed} failed</span>
                  </>
                ) : (
                  <>
                    <span className="text-green-600">{progress.success} success</span>
                    <span className="text-destructive">{progress.failed} failed</span>
                    <span>{progress.skipped} skipped</span>
                  </>
                )}
              </div>
            </div>
          )}

          {/* ── Completed / Stopped / Failed States ── */}
          {(status === 'completed' || status === 'stopped' || status === 'failed') && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                {status === 'completed' && <CheckCircle2 className="h-4 w-4 text-green-600" />}
                {status === 'stopped' && <Square className="h-4 w-4 text-yellow-600" />}
                {status === 'failed' && <XCircle className="h-4 w-4 text-destructive" />}
                <span className="text-sm font-medium">{getWorkflowLabel(workflowType)} — {status}</span>
                {progress && (
                  <span className="text-xs text-muted-foreground">
                    {isEnrichWorkflow
                      ? `— ${progress.fully_enriched} enriched, ${progress.partially_improved} partial, ${progress.still_pending} still pending, ${progress.failed} failed, ${progress.skipped} skipped`
                      : `— ${progress.success} success, ${progress.failed} failed, ${progress.skipped} skipped`
                    }
                    {progress.capped_remaining > 0 && `, ${progress.capped_remaining} deferred by cap`}
                  </span>
                )}
              </div>

              {executionResults.length > 0 && (
                <ExecutionResultsView results={executionResults} cappedRemaining={progress?.capped_remaining || 0} isEnrichWorkflow={isEnrichWorkflow} />
              )}

              <Button size="sm" variant="outline" onClick={reset}>
                <RotateCcw className="h-3 w-3 mr-1" /> Start Fresh
              </Button>
            </div>
          )}

          {/* ── Stale State ── */}
          {status === 'stale' && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-yellow-600">
                <Clock className="h-4 w-4" /> Previous session went stale (no heartbeat for 5+ min).
              </div>
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

// ── Fix/Enrich Report View ──
function ReportView({ report, workflowType }: { report: ScanReport; workflowType: WorkflowType | null }) {
  const cats = report.categories;
  const label = getWorkflowLabel(workflowType);

  const categoryCards: { label: string; icon: React.ReactNode; items: ArticleVerdict[]; color: string }[] = [
    { label: 'Skip (Already Good)', icon: <CheckCircle2 className="h-3.5 w-3.5" />, items: cats.skip_already_good, color: 'text-green-600' },
    { label: 'Skip (Ranking Protection)', icon: <Shield className="h-3.5 w-3.5" />, items: cats.skip_ranking_protection, color: 'text-blue-600' },
    { label: 'Minimal Safe Edit', icon: <Wrench className="h-3.5 w-3.5" />, items: cats.minimal_safe_edit, color: 'text-yellow-600' },
    { label: 'Targeted Fix', icon: <Wrench className="h-3.5 w-3.5" />, items: cats.targeted_fix, color: 'text-orange-600' },
    { label: 'Deeper Enrichment', icon: <Zap className="h-3.5 w-3.5" />, items: cats.deeper_enrichment, color: 'text-purple-600' },
    { label: 'Manual Review', icon: <AlertTriangle className="h-3.5 w-3.5" />, items: cats.manual_review, color: 'text-destructive' },
    { label: 'Deferred by Cap', icon: <SkipForward className="h-3.5 w-3.5" />, items: cats.deferred_by_cap, color: 'text-muted-foreground' },
  ];

  return (
    <div className="space-y-3">
      <div className="text-xs font-medium text-muted-foreground">{label} Scan Report</div>
      <div className="grid grid-cols-4 gap-2 text-xs">
        <div className="bg-muted rounded p-2 text-center">
          <div className="font-semibold text-base">{report.total_scanned}</div>
          <div className="text-muted-foreground">Scanned</div>
        </div>
        <div className="bg-muted rounded p-2 text-center">
          <div className="font-semibold text-base">{report.total_pending}</div>
          <div className="text-muted-foreground">Pending</div>
        </div>
        <div className="bg-muted rounded p-2 text-center">
          <div className="font-semibold text-base">{Math.min(report.total_pending, report.max_per_run)}</div>
          <div className="text-muted-foreground">This Run</div>
        </div>
        <div className="bg-muted rounded p-2 text-center">
          <div className="font-semibold text-base">{report.capped_remaining}</div>
          <div className="text-muted-foreground">Deferred</div>
        </div>
      </div>

      <div className="space-y-1">
        {categoryCards.filter(c => c.items.length > 0).map(cat => (
          <CategoryRow key={cat.label} label={cat.label} icon={cat.icon} items={cat.items} color={cat.color} />
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        Estimated API calls: ~{report.estimated_api_calls}
      </p>
    </div>
  );
}

// ── Publish Report View ──
function PublishReportView({ report }: { report: ScanReport }) {
  const pc = report.publish_categories;
  const ps = report.publish_summary;

  if (!pc || !ps) return null;

  const categoryCards: { label: string; icon: React.ReactNode; items: ArticleVerdict[]; color: string }[] = [
    { label: 'Ready to Publish', icon: <CheckCircle2 className="h-3.5 w-3.5" />, items: pc.ready_to_publish, color: 'text-green-600' },
    { label: 'Already Published', icon: <Shield className="h-3.5 w-3.5" />, items: pc.already_published, color: 'text-blue-600' },
    { label: 'Not Ready — Missing Fixes', icon: <Wrench className="h-3.5 w-3.5" />, items: pc.not_ready_missing_fixes, color: 'text-orange-600' },
    { label: 'Not Ready — Missing Enrichment', icon: <Zap className="h-3.5 w-3.5" />, items: pc.not_ready_missing_enrichment, color: 'text-purple-600' },
    { label: 'Not Ready — Publish Requirements', icon: <XCircle className="h-3.5 w-3.5" />, items: pc.not_ready_publish_requirements, color: 'text-destructive' },
    { label: 'Manual Review', icon: <AlertTriangle className="h-3.5 w-3.5" />, items: pc.manual_review, color: 'text-yellow-600' },
    { label: 'Deferred by Cap', icon: <SkipForward className="h-3.5 w-3.5" />, items: pc.deferred_by_cap, color: 'text-muted-foreground' },
  ];

  return (
    <div className="space-y-3">
      <div className="text-xs font-medium text-muted-foreground">Publish Scan Report</div>
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-xs">
        <div className="bg-muted rounded p-2 text-center">
          <div className="font-semibold text-base">{report.total_scanned}</div>
          <div className="text-muted-foreground">Scanned</div>
        </div>
        <div className="bg-green-50 dark:bg-green-950/30 rounded p-2 text-center">
          <div className="font-semibold text-base text-green-600">{ps.ready_to_publish_count}</div>
          <div className="text-muted-foreground">Ready</div>
        </div>
        <div className="bg-blue-50 dark:bg-blue-950/30 rounded p-2 text-center">
          <div className="font-semibold text-base text-blue-600">{pc.already_published.length}</div>
          <div className="text-muted-foreground">Published</div>
        </div>
        <div className="bg-muted rounded p-2 text-center">
          <div className="font-semibold text-base">{ps.verified_fixed_count}</div>
          <div className="text-muted-foreground">V. Fixed</div>
        </div>
        <div className="bg-muted rounded p-2 text-center">
          <div className="font-semibold text-base">{ps.verified_enriched_count}</div>
          <div className="text-muted-foreground">V. Enriched</div>
        </div>
        <div className="bg-muted rounded p-2 text-center">
          <div className="font-semibold text-base">{ps.manual_review_count}</div>
          <div className="text-muted-foreground">Review</div>
        </div>
      </div>

      <div className="space-y-1">
        {categoryCards.filter(c => c.items.length > 0).map(cat => (
          <CategoryRow key={cat.label} label={cat.label} icon={cat.icon} items={cat.items} color={cat.color} showPublishChecks />
        ))}
      </div>
    </div>
  );
}

// ── Category Row with expandable articles ──
function CategoryRow({ label, icon, items, color, showPublishChecks }: {
  label: string;
  icon: React.ReactNode;
  items: ArticleVerdict[];
  color: string;
  showPublishChecks?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Collapsible open={expanded} onOpenChange={setExpanded}>
      <CollapsibleTrigger className="flex items-center gap-2 w-full py-1.5 px-2 rounded hover:bg-muted text-xs">
        <ChevronDown className={`h-3 w-3 transition-transform ${expanded ? 'rotate-180' : ''}`} />
        <span className={color}>{icon}</span>
        <span className="font-medium">{label}</span>
        <Badge variant="secondary" className="ml-auto text-xs h-5">{items.length}</Badge>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <ScrollArea className="max-h-40">
          <div className="ml-7 space-y-1 py-1">
            {items.map(item => (
              <div key={item.slug} className="text-xs py-1 px-2 rounded bg-muted/50 flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{item.title}</div>
                  <div className="text-muted-foreground truncate">
                    {item.reasons.slice(0, 2).join(' · ')}
                    {item.confidence < 1 && item.confidence > 0 && ` · ${Math.round(item.confidence * 100)}% conf`}
                  </div>
                  {showPublishChecks && item.publish_checks && (
                    <div className="flex gap-2 mt-0.5">
                      {item.publish_checks.verified_fixed && <span className="text-green-600">✓ Fixed</span>}
                      {!item.publish_checks.verified_fixed && <span className="text-destructive">✗ Fixed</span>}
                      {item.publish_checks.verified_enriched && <span className="text-green-600">✓ Enriched</span>}
                      {!item.publish_checks.verified_enriched && <span className="text-destructive">✗ Enriched</span>}
                      {item.publish_checks.soft_warnings.length > 0 && (
                        <span className="text-yellow-600">⚠ {item.publish_checks.soft_warnings.join(', ')}</span>
                      )}
                    </div>
                  )}
                </div>
                <Badge variant="outline" className="text-[10px] h-4 shrink-0">
                  {item.severity}
                </Badge>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CollapsibleContent>
    </Collapsible>
  );
}

// ── Execution Results View ──
function ExecutionResultsView({ results, cappedRemaining, isEnrichWorkflow }: { results: ExecutionResult[]; cappedRemaining: number; isEnrichWorkflow: boolean }) {
  const [expanded, setExpanded] = useState(false);

  // Group results based on workflow type
  const grouped = isEnrichWorkflow
    ? {
        fully_enriched: results.filter(r => r.status === 'fully_enriched'),
        partially_improved: results.filter(r => r.status === 'partially_improved'),
        still_pending: results.filter(r => r.status === 'still_pending'),
        failed: results.filter(r => r.status === 'failed'),
        skipped: results.filter(r => r.status === 'skipped'),
      }
    : {
        success: results.filter(r => r.status === 'success' || r.status === 'fully_enriched'),
        failed: results.filter(r => r.status === 'failed'),
        skipped: results.filter(r => r.status === 'skipped'),
      };

  return (
    <Collapsible open={expanded} onOpenChange={setExpanded}>
      <CollapsibleTrigger className="flex items-center gap-2 text-xs font-medium hover:text-primary">
        <ChevronDown className={`h-3 w-3 transition-transform ${expanded ? 'rotate-180' : ''}`} />
        View detailed results
      </CollapsibleTrigger>
      <CollapsibleContent>
        <ScrollArea className="max-h-60 mt-2">
          <div className="space-y-2">
            {isEnrichWorkflow ? (
              <>
                {/* Fully Enriched */}
                {(grouped as any).fully_enriched?.length > 0 && (
                  <ResultGroup
                    label="✅ Fully Enriched"
                    color="text-green-600"
                    results={(grouped as any).fully_enriched}
                    bgClass="bg-green-50/50 dark:bg-green-950/20"
                  />
                )}
                {/* Partially Improved */}
                {(grouped as any).partially_improved?.length > 0 && (
                  <ResultGroup
                    label="🟡 Partially Improved"
                    color="text-yellow-600"
                    results={(grouped as any).partially_improved}
                    bgClass="bg-yellow-50/50 dark:bg-yellow-950/20"
                    showFailingCriteria
                  />
                )}
                {/* Still Pending */}
                {(grouped as any).still_pending?.length > 0 && (
                  <ResultGroup
                    label="🟠 Still Pending After Enrichment"
                    color="text-orange-600"
                    results={(grouped as any).still_pending}
                    bgClass="bg-orange-50/50 dark:bg-orange-950/20"
                    showFailingCriteria
                  />
                )}
                {/* Failed */}
                {(grouped as any).failed?.length > 0 && (
                  <ResultGroup
                    label="❌ Failed"
                    color="text-destructive"
                    results={(grouped as any).failed}
                    bgClass="bg-destructive/5"
                  />
                )}
                {/* Skipped */}
                {(grouped as any).skipped?.length > 0 && (
                  <ResultGroup
                    label="⏭️ Skipped"
                    color="text-muted-foreground"
                    results={(grouped as any).skipped}
                    bgClass="bg-muted/30"
                  />
                )}
              </>
            ) : (
              <>
                {(grouped as any).success?.length > 0 && (
                  <ResultGroup
                    label="✅ Success"
                    color="text-green-600"
                    results={(grouped as any).success}
                    bgClass="bg-muted/30"
                  />
                )}
                {(grouped as any).failed?.length > 0 && (
                  <ResultGroup
                    label="❌ Failed"
                    color="text-destructive"
                    results={(grouped as any).failed}
                    bgClass="bg-destructive/5"
                  />
                )}
                {(grouped as any).skipped?.length > 0 && (
                  <ResultGroup
                    label="⏭️ Skipped"
                    color="text-yellow-600"
                    results={(grouped as any).skipped}
                    bgClass="bg-muted/30"
                  />
                )}
              </>
            )}
            {cappedRemaining > 0 && (
              <div className="text-xs text-muted-foreground py-1">
                ⏩ {cappedRemaining} articles deferred by safety cap — run again to process them.
              </div>
            )}
          </div>
        </ScrollArea>
      </CollapsibleContent>
    </Collapsible>
  );
}

// ── Result Group Component ──
function ResultGroup({ label, color, results, bgClass, showFailingCriteria }: {
  label: string;
  color: string;
  results: ExecutionResult[];
  bgClass: string;
  showFailingCriteria?: boolean;
}) {
  return (
    <div>
      <div className={`text-xs font-medium ${color} mb-1`}>{label} ({results.length})</div>
      {results.map(r => (
        <div key={r.slug} className={`text-xs py-1 px-2 ${bgClass} rounded mb-0.5`}>
          <div className="flex justify-between">
            <span className="font-medium truncate">{r.title}</span>
            <span className="text-muted-foreground shrink-0 ml-2 max-w-[50%] truncate">{r.reason}</span>
          </div>
          {showFailingCriteria && r.failing_criteria && r.failing_criteria.length > 0 && (
            <div className="mt-0.5 text-[10px] text-muted-foreground">
              Still failing: {r.failing_criteria.join(' · ')}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
