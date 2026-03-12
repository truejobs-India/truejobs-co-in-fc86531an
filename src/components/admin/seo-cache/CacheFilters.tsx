import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { CacheFiltersState, PAGE_TYPES } from './cacheTypes';

interface Props {
  filters: CacheFiltersState;
  onChange: (f: CacheFiltersState) => void;
}

export function CacheFilters({ filters, onChange }: Props) {
  const update = (partial: Partial<CacheFiltersState>) =>
    onChange({ ...filters, ...partial, quickFilter: partial.quickFilter ?? 'all' });

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        placeholder="Search slug or title…"
        value={filters.search}
        onChange={e => update({ search: e.target.value })}
        className="w-56"
      />
      <Select value={filters.pageType || 'all'} onValueChange={v => update({ pageType: v === 'all' ? '' : v })}>
        <SelectTrigger className="w-40"><SelectValue placeholder="Page type" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All types</SelectItem>
          {PAGE_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select value={filters.status || 'all'} onValueChange={v => update({ status: v === 'all' ? '' : v })}>
        <SelectTrigger className="w-36"><SelectValue placeholder="Status" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All statuses</SelectItem>
          <SelectItem value="cached">Cached</SelectItem>
          <SelectItem value="missing">Missing</SelectItem>
          <SelectItem value="stale">Stale</SelectItem>
          <SelectItem value="failed">Failed</SelectItem>
          <SelectItem value="queued">Queued</SelectItem>
        </SelectContent>
      </Select>
      <div className="flex gap-1">
        {(['missing', 'stale', 'failed', 'recent'] as const).map(q => (
          <Button
            key={q}
            size="sm"
            variant={filters.quickFilter === q ? 'default' : 'outline'}
            onClick={() => onChange({ ...filters, quickFilter: filters.quickFilter === q ? 'all' : q, status: '' })}
            className="text-xs h-8 capitalize"
          >
            {q === 'recent' ? 'Recent' : q}
          </Button>
        ))}
      </div>
    </div>
  );
}
