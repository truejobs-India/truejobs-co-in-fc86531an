import { Card, CardContent } from '@/components/ui/card';
import { CacheStats } from './cacheTypes';
import {
  Globe, CheckCircle, AlertTriangle, XCircle, Clock,
  BarChart3, CalendarClock, Zap
} from 'lucide-react';

interface Props {
  stats: CacheStats;
  isLoading: boolean;
}

export function CacheOverviewCards({ stats, isLoading }: Props) {
  const cards = [
    { label: 'Total Cacheable', value: stats.totalCacheable, icon: Globe, color: 'text-blue-500' },
    { label: 'Cached', value: stats.cached, icon: CheckCircle, color: 'text-emerald-500' },
    { label: 'Missing', value: stats.missing, icon: AlertTriangle, color: 'text-yellow-500' },
    { label: 'Stale', value: stats.stale, icon: CalendarClock, color: 'text-orange-500' },
    { label: 'Failed', value: stats.failed, icon: XCircle, color: 'text-destructive' },
    { label: 'Queue Pending', value: stats.queuePending, icon: Clock, color: 'text-muted-foreground' },
    { label: 'Coverage', value: `${stats.coveragePercent}%`, icon: BarChart3, color: 'text-primary' },
    {
      label: 'Last Full Build',
      value: stats.lastFullBuild ? new Date(stats.lastFullBuild).toLocaleDateString() : '—',
      icon: Globe, color: 'text-muted-foreground', small: true,
    },
    {
      label: 'Last Incremental',
      value: stats.lastIncrementalBuild ? new Date(stats.lastIncrementalBuild).toLocaleDateString() : '—',
      icon: Zap, color: 'text-muted-foreground', small: true,
    },
  ];

  return (
    <div className="grid grid-cols-3 md:grid-cols-5 lg:grid-cols-9 gap-3">
      {cards.map(c => (
        <Card key={c.label}>
          <CardContent className="p-3 text-center">
            <c.icon className={`h-4 w-4 mx-auto mb-1 ${c.color}`} />
            <p className={`font-bold ${c.small ? 'text-xs' : 'text-lg'}`}>
              {isLoading ? '…' : c.value}
            </p>
            <p className="text-[10px] text-muted-foreground leading-tight">{c.label}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
