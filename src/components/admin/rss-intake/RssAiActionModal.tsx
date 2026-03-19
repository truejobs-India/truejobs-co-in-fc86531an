/**
 * RssAiActionModal — Shared modal for all 4 RSS AI actions.
 * Supports: analyse, enrich, generate-image, seo-check
 * Works for single and bulk row actions with progress tracking.
 */
import { useState, useRef, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { AiModelSelector, getLastUsedModel } from '@/components/admin/AiModelSelector';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, CheckCircle2, XCircle, SkipForward, Play, Square } from 'lucide-react';

type AiAction = 'analyse' | 'enrich' | 'generate-image' | 'seo-check';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  action: AiAction;
  itemIds: string[];
  onComplete: () => void;
}

const ACTION_LABELS: Record<AiAction, string> = {
  'analyse': 'Analyse',
  'enrich': 'Enrich',
  'generate-image': 'Generate Cover Image',
  'seo-check': 'SEO Check',
};

const ACTION_CAPABILITY: Record<AiAction, 'text' | 'image'> = {
  'analyse': 'text',
  'enrich': 'text',
  'generate-image': 'image',
  'seo-check': 'text',
};

const WORD_LIMITS = [300, 500, 800, 1200, 2000] as const;
const BATCH_SIZE = 5;

interface RowResult {
  itemId: string;
  status: 'completed' | 'skipped' | 'error' | 'pending';
  error?: string;
}

export function RssAiActionModal({ open, onOpenChange, action, itemIds, onComplete }: Props) {
  const capability = ACTION_CAPABILITY[action];
  const [model, setModel] = useState(() => getLastUsedModel(capability, capability === 'image' ? 'gemini-flash-image' : 'gemini-flash'));
  const [wordLimit, setWordLimit] = useState(800);
  const [skipCompleted, setSkipCompleted] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [results, setResults] = useState<RowResult[]>([]);
  const [progress, setProgress] = useState(0);
  const stopRef = useRef(false);

  const totalItems = itemIds.length;
  const completed = results.filter(r => r.status === 'completed').length;
  const skipped = results.filter(r => r.status === 'skipped').length;
  const errors = results.filter(r => r.status === 'error').length;

  const handleStart = useCallback(async () => {
    setProcessing(true);
    setResults([]);
    setProgress(0);
    stopRef.current = false;

    const allResults: RowResult[] = [];

    // Process in batches
    for (let i = 0; i < totalItems; i += BATCH_SIZE) {
      if (stopRef.current) break;

      const batchIds = itemIds.slice(i, i + BATCH_SIZE);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const { data, error } = await supabase.functions.invoke('rss-ai-process', {
          body: {
            action,
            item_ids: batchIds,
            model,
            word_limit: action === 'enrich' ? wordLimit : undefined,
            skip_completed: skipCompleted,
          },
          headers: { Authorization: `Bearer ${session?.access_token}` },
        });

        if (error) throw error;

        const batchResults: RowResult[] = (data?.results || []).map((r: any) => ({
          itemId: r.itemId,
          status: r.status as RowResult['status'],
          error: r.error,
        }));
        allResults.push(...batchResults);

        // Check for quota/rate limit errors to stop early
        const hasQuotaError = batchResults.some(r => 
          r.error?.includes('QUOTA_EXCEEDED') || r.error?.includes('RATE_LIMITED')
        );
        if (hasQuotaError) {
          stopRef.current = true;
        }
      } catch (e: any) {
        // Mark remaining batch as error
        batchIds.forEach(id => {
          allResults.push({ itemId: id, status: 'error', error: e.message?.substring(0, 100) });
        });
      }

      setResults([...allResults]);
      setProgress(Math.min(100, Math.round(((i + batchIds.length) / totalItems) * 100)));

      // Throttle between batches (3s)
      if (i + BATCH_SIZE < totalItems && !stopRef.current) {
        await new Promise(r => setTimeout(r, 3000));
      }
    }

    setProgress(100);
    setProcessing(false);
    onComplete();
  }, [itemIds, action, model, wordLimit, skipCompleted, totalItems, onComplete]);

  const handleStop = () => { stopRef.current = true; };

  const handleClose = () => {
    if (!processing) {
      setResults([]);
      setProgress(0);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{ACTION_LABELS[action]}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Item count */}
          <div className="flex items-center gap-2">
            <Badge variant="outline">{totalItems} item{totalItems !== 1 ? 's' : ''} selected</Badge>
          </div>

          {/* Model selector */}
          <div className="space-y-1.5">
            <Label className="text-sm">AI Model</Label>
            <AiModelSelector
              value={model}
              onValueChange={setModel}
              capability={capability}
              triggerClassName="w-full"
            />
          </div>

          {/* Word limit for enrich */}
          {action === 'enrich' && (
            <div className="space-y-1.5">
              <Label className="text-sm">Word Limit</Label>
              <Select value={String(wordLimit)} onValueChange={(v) => setWordLimit(Number(v))}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WORD_LIMITS.map((wl) => (
                    <SelectItem key={wl} value={String(wl)}>{wl} words</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Skip completed toggle */}
          <div className="flex items-center gap-2">
            <Switch checked={skipCompleted} onCheckedChange={setSkipCompleted} id="skip-completed" />
            <Label htmlFor="skip-completed" className="text-sm">Skip already completed</Label>
          </div>

          {/* Progress */}
          {(processing || results.length > 0) && (
            <div className="space-y-2">
              <Progress value={progress} className="h-2" />
              <div className="flex gap-3 text-xs text-muted-foreground">
                {completed > 0 && (
                  <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3 text-green-500" />{completed} done</span>
                )}
                {skipped > 0 && (
                  <span className="flex items-center gap-1"><SkipForward className="h-3 w-3 text-blue-500" />{skipped} skipped</span>
                )}
                {errors > 0 && (
                  <span className="flex items-center gap-1"><XCircle className="h-3 w-3 text-red-500" />{errors} failed</span>
                )}
                {processing && <span className="flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" />Processing...</span>}
              </div>
            </div>
          )}

          {/* Error details */}
          {results.filter(r => r.status === 'error').length > 0 && !processing && (
            <div className="max-h-32 overflow-y-auto text-xs space-y-1 p-2 bg-destructive/5 rounded border border-destructive/20">
              {results.filter(r => r.status === 'error').map((r, i) => (
                <p key={i} className="text-destructive">{r.error || 'Unknown error'}</p>
              ))}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          {processing ? (
            <Button variant="destructive" size="sm" onClick={handleStop}>
              <Square className="h-4 w-4 mr-1" /> Stop
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={handleClose}>Close</Button>
              <Button onClick={handleStart} disabled={totalItems === 0}>
                <Play className="h-4 w-4 mr-1" /> Start {ACTION_LABELS[action]}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
