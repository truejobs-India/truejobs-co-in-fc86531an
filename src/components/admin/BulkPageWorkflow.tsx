/**
 * BulkPageWorkflow — Reusable bulk Fix / Enrich / Publish panel.
 * Used by both Custom Pages and Board Result Pages admin views.
 */
import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AiModelSelector } from '@/components/admin/AiModelSelector';
import { usePageAiWorkflow, type PageScanReport, type PageActionResult, type PageWorkflowProgress, type PageWorkflowStatus } from '@/hooks/usePageAiWorkflow';
import { supabase } from '@/integrations/supabase/client';
import { useAdminToast as useToast } from '@/contexts/AdminMessagesContext';
import {
  Search, Loader2, CheckCircle, XCircle, Square,
  Wrench, Sparkles, Globe, BarChart3, AlertTriangle,
} from 'lucide-react';

interface BulkPageWorkflowProps {
  /** Filter for page_type (e.g., 'result-landing', 'landing') or null for all */
  pageTypeFilter?: string | null;
  /** Title for the panel */
  title?: string;
  /** Callback when pages are modified */
  onPagesChanged?: () => void;
}

export function BulkPageWorkflow({ pageTypeFilter, title = 'Bulk AI Workflows', onPagesChanged }: BulkPageWorkflowProps) {
  const { toast } = useToast();
  const workflow = usePageAiWorkflow();
  const [aiModel, setAiModel] = useState(() => getLastUsedModel('text', 'vertex-flash'));
  const [activeAction, setActiveAction] = useState<'fix' | 'enrich' | 'publish' | null>(null);
  const [isScanning, setIsScanning] = useState(false);

  const scanPages = useCallback(async () => {
    setIsScanning(true);
    try {
      let query = supabase.from('custom_pages').select('*');
      if (pageTypeFilter) query = query.eq('page_type', pageTypeFilter);
      // Fetch all pages (up to 1000)
      const { data, error } = await query.order('created_at', { ascending: false }).limit(1000);
      if (error) throw new Error(error.message);
      if (!data || data.length === 0) {
        toast({ title: 'No pages found' });
        setIsScanning(false);
        return;
      }
      await workflow.scan(data);
      toast({ title: `Scanned ${data.length} pages` });
    } catch (e: any) {
      toast({ title: 'Scan failed', description: e.message, variant: 'destructive' });
    } finally {
      setIsScanning(false);
    }
  }, [pageTypeFilter, workflow, toast]);

  const startBulk = useCallback(async (action: 'fix' | 'enrich' | 'publish') => {
    if (!workflow.scanReport) return;
    setActiveAction(action);

    let targetPages: any[];
    if (action === 'fix') {
      targetPages = workflow.scanReport.pages.filter(p => p.needsFix);
    } else if (action === 'enrich') {
      targetPages = workflow.scanReport.pages.filter(p => p.needsEnrich);
    } else {
      targetPages = workflow.scanReport.pages.filter(p => !p.needsFix && !p.needsEnrich && p.quality.score >= 50 && !p.is_published);
    }

    if (targetPages.length === 0) {
      toast({ title: `No pages need ${action}` });
      setActiveAction(null);
      return;
    }

    // Need full page data for fix/enrich
    const pageIds = targetPages.map(p => p.id);
    const { data: fullPages } = await supabase.from('custom_pages').select('*').in('id', pageIds);
    if (!fullPages || fullPages.length === 0) {
      toast({ title: 'No pages found', variant: 'destructive' });
      setActiveAction(null);
      return;
    }

    await workflow.bulkExecute(action, fullPages, aiModel, onPagesChanged);
    toast({ title: `Bulk ${action} complete` });
    setActiveAction(null);
  }, [workflow, aiModel, toast, onPagesChanged]);

  const report = workflow.scanReport;
  const prog = workflow.progress;
  const isExecuting = workflow.status === 'executing';

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <BarChart3 className="h-4 w-4" /> {title}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Controls row */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="w-[200px]">
              <AiModelSelector value={aiModel} onValueChange={setAiModel} capability="text" triggerClassName="w-full" />
            </div>
            <Button onClick={scanPages} disabled={isScanning || isExecuting} variant="outline" size="sm">
              {isScanning ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Search className="h-4 w-4 mr-1" />}
              Scan All Pages
            </Button>
            {workflow.status !== 'idle' && (
              <Button onClick={workflow.reset} variant="ghost" size="sm">
                <XCircle className="h-4 w-4 mr-1" /> Reset
              </Button>
            )}
          </div>

          {/* Scan report */}
          {report && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                <div className="bg-muted rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold">{report.total_scanned}</div>
                  <div className="text-xs text-muted-foreground">Total Scanned</div>
                </div>
                <div className="bg-destructive/10 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-destructive">{report.needs_fix}</div>
                  <div className="text-xs text-muted-foreground">Need Fix</div>
                </div>
                <div className="bg-amber-500/10 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-amber-600">{report.needs_enrich}</div>
                  <div className="text-xs text-muted-foreground">Need Enrich</div>
                </div>
                <div className="bg-emerald-500/10 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-emerald-600">{report.already_good}</div>
                  <div className="text-xs text-muted-foreground">Already Good</div>
                </div>
                <div className="bg-primary/10 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-primary">{report.unpublished_ready}</div>
                  <div className="text-xs text-muted-foreground">Ready to Publish</div>
                </div>
              </div>

              {/* Bulk action buttons */}
              <div className="flex gap-2 flex-wrap">
                <Button
                  onClick={() => startBulk('fix')}
                  disabled={isExecuting || report.needs_fix === 0}
                  variant="outline" size="sm"
                  className="border-destructive/50 text-destructive hover:bg-destructive/10"
                >
                  <Wrench className="h-4 w-4 mr-1" />
                  Bulk Fix ({report.needs_fix})
                </Button>
                <Button
                  onClick={() => startBulk('enrich')}
                  disabled={isExecuting || report.needs_enrich === 0}
                  variant="outline" size="sm"
                  className="border-amber-500/50 text-amber-600 hover:bg-amber-500/10"
                >
                  <Sparkles className="h-4 w-4 mr-1" />
                  Bulk Enrich ({report.needs_enrich})
                </Button>
                <Button
                  onClick={() => startBulk('publish')}
                  disabled={isExecuting || report.unpublished_ready === 0}
                  variant="outline" size="sm"
                  className="border-emerald-500/50 text-emerald-600 hover:bg-emerald-500/10"
                >
                  <Globe className="h-4 w-4 mr-1" />
                  Bulk Publish ({report.unpublished_ready})
                </Button>
                {isExecuting && (
                  <Button variant="destructive" size="sm" onClick={workflow.requestStop}>
                    <Square className="h-4 w-4 mr-1" /> Stop
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Progress */}
          {prog && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground capitalize">
                  {activeAction ? `${activeAction}ing` : 'Processing'}: {prog.done}/{prog.total}
                  {prog.current_title && <span className="ml-2 italic">— {prog.current_title.substring(0, 40)}…</span>}
                </span>
                <div className="flex gap-3">
                  <span className="text-emerald-600">✓ {prog.success}</span>
                  <span className="text-muted-foreground">⊘ {prog.skipped}</span>
                  <span className="text-destructive">✗ {prog.failed}</span>
                </div>
              </div>
              <Progress value={prog.total > 0 ? (prog.done / prog.total) * 100 : 0} className="h-2" />
            </div>
          )}

          {/* Results table */}
          {workflow.results.length > 0 && (
            <div className="max-h-[300px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8">#</TableHead>
                    <TableHead>Slug</TableHead>
                    <TableHead className="w-20">Status</TableHead>
                    <TableHead>Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {workflow.results.map((r, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-xs text-muted-foreground">{i + 1}</TableCell>
                      <TableCell className="text-xs font-mono">/{r.slug}</TableCell>
                      <TableCell>
                        {(r.status === 'fixed' || r.status === 'enriched' || r.status === 'published') && (
                          <Badge className="bg-emerald-500/20 text-emerald-700 text-[10px]">{r.status}</Badge>
                        )}
                        {r.status === 'skipped' && <Badge variant="secondary" className="text-[10px]">skipped</Badge>}
                        {r.status === 'failed' && <Badge variant="destructive" className="text-[10px]">failed</Badge>}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[300px] truncate">{r.reason}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
