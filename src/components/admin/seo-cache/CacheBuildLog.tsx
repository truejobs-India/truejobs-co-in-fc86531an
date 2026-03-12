import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { History } from 'lucide-react';

interface Props {
  logs: any[];
}

export function CacheBuildLog({ logs }: Props) {
  if (logs.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground text-sm">No rebuild logs yet</CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <History className="h-4 w-4" /> Build Log ({logs.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Rebuilt</TableHead>
                <TableHead>Skipped</TableHead>
                <TableHead>Failed</TableHead>
                <TableHead>CF Purged</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log: any) => (
                <TableRow key={log.id}>
                  <TableCell><Badge variant="outline" className="text-[10px]">{log.rebuild_type}</Badge></TableCell>
                  <TableCell className="text-xs">{log.slugs_rebuilt}</TableCell>
                  <TableCell className="text-xs">{log.slugs_skipped}</TableCell>
                  <TableCell className="text-xs">
                    {log.slugs_failed > 0 ? <span className="text-destructive font-medium">{log.slugs_failed}</span> : '0'}
                  </TableCell>
                  <TableCell className="text-xs">{log.cf_purged}</TableCell>
                  <TableCell className="text-xs">{log.duration_ms ? `${(log.duration_ms / 1000).toFixed(1)}s` : '—'}</TableCell>
                  <TableCell className="text-xs">{log.trigger_source || '—'}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{new Date(log.created_at).toLocaleString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
