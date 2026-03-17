/**
 * BatchSelector — Dropdown to select a saved batch for workspace view.
 */
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import type { ImportBatch } from './useBatchPipeline';

interface Props {
  batches: ImportBatch[];
  selectedBatchId: string | null;
  onSelect: (id: string) => void;
}

export function BatchSelector({ batches, selectedBatchId, onSelect }: Props) {
  if (batches.length === 0) return null;

  return (
    <div className="flex items-center gap-3">
      <span className="text-sm font-medium text-muted-foreground">Batch:</span>
      <Select value={selectedBatchId || ''} onValueChange={onSelect}>
        <SelectTrigger className="w-[400px]">
          <SelectValue placeholder="Select a batch…" />
        </SelectTrigger>
        <SelectContent>
          {batches.map(b => (
            <SelectItem key={b.id} value={b.id}>
              <span className="flex items-center gap-2">
                <span className="font-mono text-xs">#{b.batch_number}</span>
                <span className="truncate max-w-[200px]">{b.source_file_name}</span>
                <Badge variant="outline" className="text-[10px]">{b.total_rows} rows</Badge>
                {b.published_count > 0 && (
                  <Badge className="bg-green-100 text-green-800 text-[10px]">{b.published_count} pub</Badge>
                )}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
