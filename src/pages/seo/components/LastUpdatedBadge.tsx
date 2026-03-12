import { Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface LastUpdatedBadgeProps {
  date: string; // ISO 8601 e.g. "2026-02-21"
  applicationEndDate?: string; // ISO 8601, optional
}

function formatISODate(iso: string): string {
  const [year, month, day] = iso.split('-');
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  return `${parseInt(day, 10)} ${months[parseInt(month, 10) - 1]} ${year}`;
}

function getFreshnessLabel(lastUpdated: string, applicationEndDate?: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Check update freshness
  const updated = new Date(lastUpdated);
  updated.setHours(0, 0, 0, 0);
  const diffUpdated = Math.floor((today.getTime() - updated.getTime()) / 86400000);

  // Check deadline proximity
  let deadlineLabel: { text: string; className: string } | null = null;
  if (applicationEndDate) {
    const endDate = new Date(applicationEndDate);
    endDate.setHours(0, 0, 0, 0);
    const daysUntilEnd = Math.floor((endDate.getTime() - today.getTime()) / 86400000);
    if (daysUntilEnd === 0) {
      deadlineLabel = { text: 'Closing Today', className: 'bg-destructive text-destructive-foreground' };
    } else if (daysUntilEnd === 1) {
      deadlineLabel = { text: 'Closing Tomorrow', className: 'bg-destructive/80 text-destructive-foreground' };
    } else if (daysUntilEnd > 1 && daysUntilEnd <= 7) {
      deadlineLabel = { text: 'Closing Soon', className: 'border-orange-500 bg-orange-500/10 text-orange-700 dark:text-orange-400' };
    }
  }

  let freshnessLabel: { text: string; className: string } | null = null;
  if (diffUpdated === 0) {
    freshnessLabel = { text: 'Updated Today', className: 'border-green-500 bg-green-500/10 text-green-700 dark:text-green-400' };
  } else if (diffUpdated <= 3) {
    freshnessLabel = { text: 'Recently Updated', className: 'border-blue-500 bg-blue-500/10 text-blue-700 dark:text-blue-400' };
  }

  return { freshnessLabel, deadlineLabel };
}

export function LastUpdatedBadge({ date, applicationEndDate }: LastUpdatedBadgeProps) {
  const { freshnessLabel, deadlineLabel } = getFreshnessLabel(date, applicationEndDate);

  return (
    <div className="inline-flex flex-wrap items-center gap-2">
      <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
        <Clock className="h-3 w-3" /> Last updated: {formatISODate(date)}
      </span>
      {freshnessLabel && (
        <Badge variant="outline" className={freshnessLabel.className}>
          {freshnessLabel.text}
        </Badge>
      )}
      {deadlineLabel && (
        <Badge variant="outline" className={deadlineLabel.className}>
          {deadlineLabel.text}
        </Badge>
      )}
    </div>
  );
}
