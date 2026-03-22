/**
 * Admin UI for managing Firecrawl draft jobs (Source 3 Phase 4).
 * Lists draft jobs with row-level AI action buttons.
 */
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { toast } from '@/hooks/use-toast';
import {
  RefreshCw, Loader2, MoreHorizontal, Sparkles, Wrench, Link2,
  Search, Image, FileText, Zap, CheckCircle, XCircle, Clock,
  AlertTriangle, ExternalLink,
} from 'lucide-react';

interface DraftJob {
  id: string;
  title: string | null;
  organization_name: string | null;
  post_name: string | null;
  state: string | null;
  extraction_confidence: string;
  status: string;
  fields_extracted: number;
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
  created_at: string;
  updated_at: string;
}

type AiAction = 'ai-clean' | 'ai-enrich' | 'ai-find-links' | 'ai-fix-missing' | 'ai-seo' | 'ai-cover-prompt' | 'ai-cover-image' | 'ai-run-all';

const AI_ACTIONS: { action: AiAction; label: string; icon: typeof Sparkles; description: string }[] = [
  { action: 'ai-clean', label: 'AI Clean', icon: Wrench, description: 'Remove source branding & polish' },
  { action: 'ai-enrich', label: 'AI Enrich', icon: Sparkles, description: 'Improve structured fields' },
  { action: 'ai-find-links', label: 'Find Links', icon: Link2, description: 'Find official govt URLs' },
  { action: 'ai-fix-missing', label: 'Fix Missing', icon: AlertTriangle, description: 'Fill weak/blank fields' },
  { action: 'ai-seo', label: 'AI SEO', icon: Search, description: 'Generate SEO metadata & FAQs' },
  { action: 'ai-cover-prompt', label: 'Cover Prompt', icon: FileText, description: 'Generate image prompt' },
  { action: 'ai-cover-image', label: 'Cover Image', icon: Image, description: 'Generate & upload cover' },
];

export function FirecrawlDraftsManager() {
  const [drafts, setDrafts] = useState<DraftJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyRows, setBusyRows] = useState<Record<string, string>>({});

  const fetchDrafts = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('firecrawl_draft_jobs')
      .select('id, title, organization_name, post_name, state, extraction_confidence, status, fields_extracted, ai_clean_at, ai_enrich_at, ai_links_at, ai_fix_missing_at, ai_seo_at, ai_cover_prompt_at, ai_cover_image_at, seo_title, cover_image_url, official_notification_url, official_link_confidence, source_name, created_at, updated_at')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      toast({ title: 'Error loading drafts', description: error.message, variant: 'destructive' });
    } else {
      setDrafts((data as unknown as DraftJob[]) || []);
    }
    setLoading(false);
  }, []);

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

  const confidenceBadge = (conf: string) => {
    const map: Record<string, string> = {
      high: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
      low: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
      none: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    };
    return <Badge className={`text-[10px] ${map[conf] || ''}`}>{conf}</Badge>;
  };

  const aiStatusDot = (timestamp: string | null) => {
    if (timestamp) return <CheckCircle className="h-3 w-3 text-green-500" />;
    return <XCircle className="h-3 w-3 text-muted-foreground/40" />;
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Sparkles className="h-5 w-5" />
          Firecrawl Draft Jobs (Source 3)
        </CardTitle>
        <Button variant="outline" size="sm" onClick={fetchDrafts} disabled={loading}>
          <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : drafts.length === 0 ? (
          <p className="text-center py-8 text-muted-foreground text-sm">
            No draft jobs yet. Run discovery + extraction from the Firecrawl sources first.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[200px]">Title / Org</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead>Confidence</TableHead>
                  <TableHead>Fields</TableHead>
                  <TableHead className="text-center">AI Steps</TableHead>
                  <TableHead>Cover</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {drafts.map(draft => (
                  <TableRow key={draft.id} className={busyRows[draft.id] ? 'opacity-70' : ''}>
                    <TableCell>
                      <div className="space-y-0.5">
                        <p className="font-medium text-sm line-clamp-1">{draft.title || 'Untitled'}</p>
                        <p className="text-xs text-muted-foreground line-clamp-1">{draft.organization_name || draft.post_name || '—'}</p>
                        <p className="text-[10px] text-muted-foreground">{draft.source_name}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs">{draft.state || '—'}</TableCell>
                    <TableCell>{confidenceBadge(draft.extraction_confidence)}</TableCell>
                    <TableCell className="text-sm">{draft.fields_extracted}</TableCell>
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
                      {draft.cover_image_url ? (
                        <img src={draft.cover_image_url} alt="" className="w-10 h-6 object-cover rounded" />
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center gap-1 justify-end">
                        {/* Primary: Run All */}
                        <Button
                          size="sm"
                          variant="default"
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

                        {/* Individual actions dropdown */}
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
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <div className="mt-3 flex items-center gap-4 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1"><CheckCircle className="h-3 w-3 text-green-500" /> Done</span>
          <span className="flex items-center gap-1"><XCircle className="h-3 w-3 text-muted-foreground/40" /> Pending</span>
          <span>AI Steps: Clean | Enrich | Links | Fix | SEO | Prompt | Image</span>
        </div>
      </CardContent>
    </Card>
  );
}
