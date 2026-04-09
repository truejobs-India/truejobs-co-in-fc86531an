import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { ScrollText, RefreshCw } from 'lucide-react';

interface SendLog {
  id: string;
  channel: string;
  subject: string | null;
  message_body: string;
  audience_count: number;
  sent_count: number;
  failed_count: number;
  status: string;
  created_at: string;
}

export function NotificationLogs() {
  const [logs, setLogs] = useState<SendLog[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLogs = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('notification_send_log')
      .select('id, channel, subject, message_body, audience_count, sent_count, failed_count, status, created_at')
      .order('created_at', { ascending: false })
      .limit(50);
    setLogs((data as SendLog[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchLogs(); }, []);

  const statusColor = (s: string) => {
    if (s === 'completed') return 'default';
    if (s === 'partial') return 'secondary';
    if (s === 'failed') return 'destructive';
    return 'outline';
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <ScrollText className="h-4 w-4" /> Send Logs
          </CardTitle>
          <Button variant="ghost" size="icon" onClick={fetchLogs} className="h-7 w-7">
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : logs.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">No sends recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 pr-3">Channel</th>
                  <th className="pb-2 pr-3">Subject</th>
                  <th className="pb-2 pr-3">Audience</th>
                  <th className="pb-2 pr-3">Sent</th>
                  <th className="pb-2 pr-3">Failed</th>
                  <th className="pb-2 pr-3">Status</th>
                  <th className="pb-2">Date</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-b border-border/50">
                    <td className="py-2 pr-3">
                      <Badge variant="outline" className="text-[10px] capitalize">{log.channel}</Badge>
                    </td>
                    <td className="py-2 pr-3 max-w-[200px] truncate">{log.subject || '—'}</td>
                    <td className="py-2 pr-3">{log.audience_count}</td>
                    <td className="py-2 pr-3 text-green-600">{log.sent_count}</td>
                    <td className="py-2 pr-3 text-red-600">{log.failed_count}</td>
                    <td className="py-2 pr-3">
                      <Badge variant={statusColor(log.status)} className="text-[10px] capitalize">{log.status}</Badge>
                    </td>
                    <td className="py-2">{new Date(log.created_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
