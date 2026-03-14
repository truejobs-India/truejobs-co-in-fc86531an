import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { XCircle, RotateCcw, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAdminToast as useToast } from '@/contexts/AdminMessagesContext';
import { useState } from 'react';

interface Props {
  items: any[];
  onRefresh: () => void;
}

export function CacheFailedItems({ items, onRefresh }: Props) {
  const { toast } = useToast();
  const [retrying, setRetrying] = useState<Set<string>>(new Set());
  const [bulkRetrying, setBulkRetrying] = useState(false);

  const retryOne = async (id: string) => {
    setRetrying(prev => new Set(prev).add(id));
    await supabase
      .from('seo_rebuild_queue' as any)
      .update({ status: 'pending', retry_count: 0, error_message: null } as any)
      .eq('id', id);
    toast({ title: 'Re-queued', description: 'Item queued for retry.' });
    setRetrying(prev => { const n = new Set(prev); n.delete(id); return n; });
    onRefresh();
  };

  const retryAll = async () => {
    setBulkRetrying(true);
    await supabase
      .from('seo_rebuild_queue' as any)
      .update({ status: 'pending', retry_count: 0, error_message: null } as any)
      .eq('status', 'failed');
    toast({ title: 'All Failed Re-queued', description: `${items.length} items queued for retry.` });
    setBulkRetrying(false);
    onRefresh();
  };

  const dismissAll = async () => {
    await supabase
      .from('seo_rebuild_queue' as any)
      .delete()
      .eq('status', 'failed');
    toast({ title: 'Dismissed', description: 'All failed items removed from queue.' });
    onRefresh();
  };

  if (items.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground text-sm">No failed builds</CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2 text-destructive">
            <XCircle className="h-4 w-4" /> Failed Builds ({items.length})
          </CardTitle>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={retryAll} disabled={bulkRetrying} className="gap-1 h-7">
              {bulkRetrying ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
              Retry All
            </Button>
            <Button size="sm" variant="ghost" onClick={dismissAll} className="h-7 text-xs">Dismiss All</Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border overflow-auto max-h-64">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Slug</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Error</TableHead>
                <TableHead>Retries</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item: any) => (
                <TableRow key={item.id}>
                  <TableCell className="font-mono text-xs">{item.slug}</TableCell>
                  <TableCell className="text-xs max-w-[200px] truncate">{item.reason}</TableCell>
                  <TableCell className="text-xs text-destructive max-w-[200px] truncate">{item.error_message || '—'}</TableCell>
                  <TableCell className="text-xs">{item.retry_count}/{item.max_retries}</TableCell>
                  <TableCell>
                    <Button
                      size="sm" variant="ghost" className="h-7 text-xs"
                      disabled={retrying.has(item.id)}
                      onClick={() => retryOne(item.id)}
                    >
                      {retrying.has(item.id) ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Retry'}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
