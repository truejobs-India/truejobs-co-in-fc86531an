/**
 * Admin UI for managing Firecrawl draft jobs (Source 3 Phase 5 + hardening).
 * Lists draft jobs with row-level AI actions, dedup flags, review controls,
 * publish gating, and missing-fields indicators.
 */
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { toast } from '@/hooks/use-toast';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  RefreshCw, Loader2, MoreHorizontal, Sparkles, Wrench, Link2,
  Search, Image, FileText, Zap, CheckCircle, XCircle,
  AlertTriangle, ExternalLink, Copy, ShieldCheck, ShieldAlert, Eye,
  ThumbsUp, Undo2, CircleDot,
} from 'lucide-react';
import { FirecrawlSourcesManager } from './FirecrawlSourcesManager';

interface DraftJob {
  id: string;
  title: string | null;
  organization_name: string | null;
  post_name: string | null;
  state: string | null;
  extraction_confidence: string;
  status: string;
  fields_extracted: number;
  fields_missing: string[];
  ai_clean_at: string | null;
  ai_enrich_at: string | null;
  ai_links_at: string | null;
  ai_fix_missing_at: string | null;
  ai_seo_at: string | null;
  ai_cover_prompt_at: string | null;
  ai_cover_image_at: string | null;
  seo_title: string | null;
  cover_image_url: string | null;
  official_notification_url: string | null;
  official_link_confidence: string | null;
  source_name: string | null;
  source_bucket: string | null;
  dedup_status: string;
  dedup_reason: string | null;
  dedup_match_ids: string[];
  created_at: string;
  updated_at: string;
}

type AiAction = 'ai-clean' | 'ai-enrich' | 'ai-find-links' | 'ai-fix-missing' | 'ai-seo' | 'ai-cover-prompt' | 'ai-cover-image' | 'ai-run-all' | 'rollback-ai-action';

const AI_ACTIONS: { action: AiAction; label: string; icon: typeof Sparkles; description: string }[] = [
  { action: 'ai-clean', label: 'AI Clean', icon: Wrench, description: 'Remove source branding & polish' },
  { action: 'ai-enrich', label: 'AI Enrich', icon: Sparkles, description: 'Improve structured fields' },
  { action: 'ai-find-links', label: 'Find Links', icon: Link2, description: 'Find official govt URLs' },
  { action: 'ai-fix-missing', label: 'Fix Missing', icon: AlertTriangle, description: 'Fill weak/blank fields' },
  { action: 'ai-seo', label: 'AI SEO', icon: Search, description: 'Generate SEO metadata & FAQs' },
  { action: 'ai-cover-prompt', label: 'Cover Prompt', icon: FileText, description: 'Generate image prompt' },
  { action: 'ai-cover-image', label: 'Cover Image', icon: Image, description: 'Generate & upload cover' },
];

type FilterTab = 'all' | 'draft' | 'reviewed' | 'approved' | 'duplicate' | 'rejected';

export function FirecrawlDraftsManager() {
  const [drafts, setDrafts] = useState<DraftJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyRows, setBusyRows] = useState<Record<string, string>>({});
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');
  const [dedupRunning, setDedupRunning] = useState(false);

  const fetchDrafts = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('firecrawl_draft_jobs')
      .select('id, title, organization_name, post_name, state, extraction_confidence, status, fields_extracted, fields_missing, ai_clean_at, ai_enrich_at, ai_links_at, ai_fix_missing_at, ai_seo_at, ai_cover_prompt_at, ai_cover_image_at, seo_title, cover_image_url, official_notification_url, official_link_confidence, source_name, source_bucket, dedup_status, dedup_reason, dedup_match_ids, created_at, updated_at')
      .order('created_at', { ascending: false })
      .limit(100);

    if (activeFilter === 'draft') query = query.eq('status', 'draft');
    else if (activeFilter === 'reviewed') query = query.eq('status', 'reviewed');
    else if (activeFilter === 'approved') query = query.eq('status', 'approved');
    else if (activeFilter === 'duplicate') query = query.eq('dedup_status', 'duplicate');
    else if (activeFilter === 'rejected') query = query.eq('status', 'rejected');

    const { data, error } = await query;
    if (error) {
      toast({ title: 'Error loading drafts', description: error.message, variant: 'destructive' });
    } else {
      setDrafts((data as unknown as DraftJob[]) || []);
    }
    setLoading(false);
  }, [activeFilter]);

  useEffect(() => { fetchDrafts(); }, [fetchDrafts]);

  const runAiAction = async (draftId: string, action: AiAction) => {
    setBusyRows(prev => ({ ...prev, [draftId]: action }));
    try {
      const { data, error } = await supabase.functions.invoke('firecrawl-ai-enrich', {
        body: { action, draft_id: draftId },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      toast({
        title: `${action} complete`,
        description: action === 'ai-run-all'
          ? `${data.succeeded}/${data.total} steps succeeded`
          : data.message || 'Done',
      });
      await fetchDrafts();
    } catch (e: any) {
      toast({ title: `${action} failed`, description: e.message, variant: 'destructive' });
    } finally {
      setBusyRows(prev => { const n = { ...prev }; delete n[draftId]; return n; });
    }
  };

  const runDedup = async () => {
    setDedupRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke('firecrawl-ingest', {
        body: { action: 'dedup-drafts' },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      toast({
        title: 'Dedup complete',
        description: `Checked: ${data.checked || 0}, Duplicates: ${data.duplicatesFound || 0}, Cross-source candidates: ${data.crossSourceCandidates || 0}`,
      });
      await fetchDrafts();
    } catch (e: any) {
      toast({ title: 'Dedup failed', description: e.message, variant: 'destructive' });
    } finally {
      setDedupRunning(false);
    }
  };

  const updateStatus = async (draftId: string, newStatus: string) => {
    // For approval, run publish gating first
    if (newStatus === 'approved') {
      try {
        const { data, error } = await supabase.functions.invoke('firecrawl-ingest', {
          body: { action: 'validate-for-approval', draft_id: draftId },
        });
        if (error) throw new Error(error.message);
        if (data?.error) throw new Error(data.error);

        if (!data.can_approve) {
          toast({
            title: 'Cannot approve',
            description: `Blocking issues: ${data.errors?.join('; ') || 'Unknown'}`,
            variant: 'destructive',
          });
          if (data.warnings?.length > 0) {
            toast({
              title: 'Warnings',
              description: data.warnings.join('; '),
            });
          }
          return;
        }

        if (data.warnings?.length > 0) {
          toast({
            title: 'Approved with warnings',
            description: data.warnings.join('; '),
          });
        }
      } catch (e: any) {
        toast({ title: 'Validation error', description: e.message, variant: 'destructive' });
        return;
      }
    }

    // Get current user for reviewed_by
    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase
      .from('firecrawl_draft_jobs')
      .update({
        status: newStatus,
        reviewed_at: new Date().toISOString(),
        reviewed_by: user?.id || null,
      } as any)
      .eq('id', draftId);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: `Status → ${newStatus}` });
      await fetchDrafts();
    }
  };

  const confidenceBadge = (conf: string) => {
    const map: Record<string, string> = {
      high: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
      low: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
      none: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    };
    return <Badge className={`text-[10px] ${map[conf] || ''}`}>{conf}</Badge>;
  };

  const dedupBadge = (status: string) => {
    switch (status) {
      case 'clean': return <Badge variant="outline" className="text-[9px] gap-0.5"><ShieldCheck className="h-2.5 w-2.5" />Clean</Badge>;
      case 'duplicate': return <Badge variant="destructive" className="text-[9px] gap-0.5"><Copy className="h-2.5 w-2.5" />Dup</Badge>;
      default: return <Badge variant="secondary" className="text-[9px]">—</Badge>;
    }
  };

  const aiStatusDot = (timestamp: string | null) => {
    if (timestamp) return <CheckCircle className="h-3 w-3 text-green-500" />;
    return <XCircle className="h-3 w-3 text-muted-foreground/40" />;
  };

  const filterTabs: { key: FilterTab; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'draft', label: 'Draft' },
    { key: 'reviewed', label: 'Reviewed' },
    { key: 'approved', label: 'Approved' },
    { key: 'duplicate', label: 'Duplicates' },
    { key: 'rejected', label: 'Rejected' },
  ];

  return (
    <div className="space-y-4">
      <FirecrawlSourcesManager />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Firecrawl Draft Jobs
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="outline" size="sm"
              onClick={runDedup} disabled={dedupRunning}
            >
              {dedupRunning ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <ShieldAlert className="h-3.5 w-3.5 mr-1.5" />}
              Run Dedup
            </Button>
            <Button variant="outline" size="sm" onClick={fetchDrafts} disabled={loading}>
              <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-1 mb-3">
            {filterTabs.map(tab => (
              <Button
                key={tab.key}
                variant={activeFilter === tab.key ? 'default' : 'ghost'}
                size="sm"
                className="text-xs h-7"
                onClick={() => setActiveFilter(tab.key)}
              >
                {tab.label}
              </Button>
            ))}
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : drafts.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground text-sm">
              No draft jobs found for this filter.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[200px]">Title / Org</TableHead>
                    <TableHead>State</TableHead>
                    <TableHead>Ready</TableHead>
                    <TableHead>Confidence</TableHead>
                    <TableHead>Dedup</TableHead>
                    <TableHead>Fields</TableHead>
                    <TableHead className="text-center">AI Steps</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {drafts.map(draft => {
                    const missingCount = draft.fields_missing?.length || 0;
                    // Readiness assessment
                    const blockers: string[] = [];
                    const warnings: string[] = [];
                    if (!draft.title || draft.title.length < 10) blockers.push('Title missing/short');
                    if (!draft.organization_name) blockers.push('No organization');
                    if (draft.dedup_status === 'duplicate') blockers.push('Duplicate');
                    if (draft.extraction_confidence === 'none') blockers.push('No confidence');
                    if (!draft.official_notification_url && !draft.seo_title) warnings.push('No official links');
                    if (!draft.seo_title) warnings.push('No SEO');
                    if (!draft.cover_image_url) warnings.push('No cover');
                    if (draft.extraction_confidence === 'low') warnings.push('Low confidence');
                    const readiness = blockers.length > 0 ? 'red' : warnings.length > 0 ? 'yellow' : 'green';
                    const readinessTooltip = blockers.length > 0
                      ? `Blockers: ${blockers.join(', ')}`
                      : warnings.length > 0
                        ? `Warnings: ${warnings.join(', ')}`
                        : 'Ready for review';

                    return (
                      <TableRow key={draft.id} className={busyRows[draft.id] ? 'opacity-70' : ''}>
                        <TableCell>
                          <div className="space-y-0.5">
                            <p className="font-medium text-sm line-clamp-1">{draft.title || 'Untitled'}</p>
                            <p className="text-xs text-muted-foreground line-clamp-1">{draft.organization_name || draft.post_name || '—'}</p>
                            <div className="flex items-center gap-1">
                              <span className="text-[10px] text-muted-foreground">{draft.source_name}</span>
                              {draft.source_bucket && (
                                <Badge variant="outline" className="text-[9px]">{draft.source_bucket}</Badge>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs">{draft.state || '—'}</TableCell>
                        <TableCell>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger>
                                <CircleDot className={`h-4 w-4 ${
                                  readiness === 'green' ? 'text-green-500' :
                                  readiness === 'yellow' ? 'text-yellow-500' : 'text-red-500'
                                }`} />
                              </TooltipTrigger>
                              <TooltipContent side="right" className="max-w-[250px]">
                                <p className="text-xs">{readinessTooltip}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </TableCell>
                        <TableCell>{confidenceBadge(draft.extraction_confidence)}</TableCell>
                        <TableCell>
                          <div className="space-y-0.5">
                            {dedupBadge(draft.dedup_status)}
                            {draft.dedup_reason && (
                              <p className="text-[9px] text-muted-foreground line-clamp-1" title={draft.dedup_reason}>
                                {draft.dedup_reason}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {draft.fields_extracted}
                            {missingCount > 0 && (
                              <span className="text-[10px] text-orange-500 ml-1" title={`Missing: ${draft.fields_missing?.join(', ')}`}>
                                ({missingCount} missing)
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 justify-center" title="Clean | Enrich | Links | Fix | SEO | Prompt | Image">
                            {aiStatusDot(draft.ai_clean_at)}
                            {aiStatusDot(draft.ai_enrich_at)}
                            {aiStatusDot(draft.ai_links_at)}
                            {aiStatusDot(draft.ai_fix_missing_at)}
                            {aiStatusDot(draft.ai_seo_at)}
                            {aiStatusDot(draft.ai_cover_prompt_at)}
                            {aiStatusDot(draft.ai_cover_image_at)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={
                            draft.status === 'approved' ? 'default' :
                            draft.status === 'reviewed' ? 'secondary' :
                            draft.status === 'rejected' ? 'destructive' : 'outline'
                          } className="text-[10px]">
                            {draft.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center gap-1 justify-end">
                            <Button
                              size="sm" variant="default"
                              disabled={!!busyRows[draft.id]}
                              onClick={() => runAiAction(draft.id, 'ai-run-all')}
                              title="Run All AI Steps"
                              className="gap-1"
                            >
                              {busyRows[draft.id] === 'ai-run-all' ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Zap className="h-3 w-3" />
                              )}
                              <span className="hidden sm:inline text-xs">Run All</span>
                            </Button>

                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button size="sm" variant="ghost" disabled={!!busyRows[draft.id]}>
                                  {busyRows[draft.id] && busyRows[draft.id] !== 'ai-run-all' ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <MoreHorizontal className="h-3 w-3" />
                                  )}
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-52">
                                {/* Review actions */}
                                <DropdownMenuItem onClick={() => updateStatus(draft.id, 'reviewed')}>
                                  <Eye className="h-3.5 w-3.5 mr-2" /> Mark Reviewed
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => updateStatus(draft.id, 'approved')}>
                                  <ThumbsUp className="h-3.5 w-3.5 mr-2" /> Approve
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => updateStatus(draft.id, 'rejected')} className="text-destructive">
                                  <XCircle className="h-3.5 w-3.5 mr-2" /> Reject
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />

                                {/* AI actions */}
                                {AI_ACTIONS.map(({ action, label, icon: Icon, description }) => (
                                  <DropdownMenuItem
                                    key={action}
                                    onClick={() => runAiAction(draft.id, action)}
                                    disabled={!!busyRows[draft.id]}
                                    className="flex items-start gap-2"
                                  >
                                    <Icon className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                                    <div>
                                      <p className="text-sm font-medium">{label}</p>
                                      <p className="text-[10px] text-muted-foreground">{description}</p>
                                    </div>
                                  </DropdownMenuItem>
                                ))}
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => runAiAction(draft.id, 'rollback-ai-action')}
                                  disabled={!!busyRows[draft.id]}
                                >
                                  <Undo2 className="h-3.5 w-3.5 mr-2" /> Undo Last AI
                                </DropdownMenuItem>
                                {draft.official_notification_url && (
                                  <DropdownMenuItem asChild>
                                    <a href={draft.official_notification_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">
                                      <ExternalLink className="h-3.5 w-3.5" />
                                      <span className="text-sm">Official Link</span>
                                      {draft.official_link_confidence && (
                                        <Badge variant="outline" className="text-[9px] ml-auto">
                                          {draft.official_link_confidence}
                                        </Badge>
                                      )}
                                    </a>
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
