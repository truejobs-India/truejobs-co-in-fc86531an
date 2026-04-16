/**
 * Compact badge row showing the 8 pipeline steps for a single draft.
 * Pulls the latest run for each step from intake_pipeline_runs (passed as prop).
 */
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const STEPS = [
  { key: 'deterministic', label: 'Det' },
  { key: 'classify', label: 'Cls' },
  { key: 'enrich', label: 'Enr' },
  { key: 'improve_title', label: 'Ttl' },
  { key: 'improve_summary', label: 'Sum' },
  { key: 'generate_slug', label: 'Slg' },
  { key: 'seo_fix', label: 'SEO' },
  { key: 'validate', label: 'Val' },
] as const;

export interface PipelineRun {
  step: string;
  status: 'ok' | 'skipped' | 'error';
  reason?: string | null;
  created_at: string;
}

interface Props {
  runs?: PipelineRun[];
  currentStep?: string | null;
  isProcessing?: boolean;
}

export function PipelineStepBadges({ runs = [], currentStep, isProcessing }: Props) {
  // Latest run per step
  const latest: Record<string, PipelineRun> = {};
  for (const r of runs) {
    if (!latest[r.step] || new Date(r.created_at) > new Date(latest[r.step].created_at)) {
      latest[r.step] = r;
    }
  }

  return (
    <div className="flex flex-wrap gap-0.5">
      {STEPS.map(s => {
        const run = latest[s.key];
        const isCurrent = isProcessing && currentStep === s.key;
        let cls = 'border-muted-foreground/20 text-muted-foreground bg-muted/30';
        let content: React.ReactNode = s.label;
        if (isCurrent) {
          cls = 'border-blue-500 text-blue-600 bg-blue-50 dark:bg-blue-950/30';
          content = <><Loader2 className="h-2.5 w-2.5 animate-spin mr-0.5" />{s.label}</>;
        } else if (run?.status === 'ok') {
          cls = 'border-green-500 text-green-700 bg-green-50 dark:bg-green-950/30';
        } else if (run?.status === 'skipped') {
          cls = 'border-muted-foreground/30 text-muted-foreground bg-muted/40';
        } else if (run?.status === 'error') {
          cls = 'border-destructive text-destructive bg-destructive/10';
        }
        return (
          <Badge
            key={s.key}
            variant="outline"
            className={cn('text-[9px] h-4 px-1 gap-0 font-mono', cls)}
            title={run ? `${s.key}: ${run.status}${run.reason ? ' — ' + run.reason : ''}` : `${s.key}: pending`}
          >
            {content}
          </Badge>
        );
      })}
    </div>
  );
}
