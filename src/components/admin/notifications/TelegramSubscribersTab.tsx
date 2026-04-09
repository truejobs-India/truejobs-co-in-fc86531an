import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { Send, AlertTriangle, Info } from 'lucide-react';
import { CTA_CHANNELS } from '@/lib/ctaConfig';

interface TelegramSub {
  id: string;
  telegram_chat_id: string;
  telegram_username: string | null;
  is_active: boolean;
  created_at: string;
  categories: string[];
}

export function TelegramSubscribersTab() {
  const [subscribers, setSubscribers] = useState<TelegramSub[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('telegram_subscribers')
        .select('id, telegram_chat_id, telegram_username, is_active, created_at, categories')
        .order('created_at', { ascending: false });
      setSubscribers((data as TelegramSub[]) || []);
      setLoading(false);
    })();
  }, []);

  const activeCount = subscribers.filter(s => s.is_active).length;

  return (
    <div className="space-y-4">
      {/* Status Banner */}
      <Card className="border-yellow-200 bg-yellow-50 dark:bg-yellow-950/20 dark:border-yellow-800">
        <CardContent className="p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5 shrink-0" />
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">Telegram Bot Not Configured</p>
            <p className="text-xs text-muted-foreground">
              <code>TELEGRAM_BOT_TOKEN</code> is not set. Broadcast sending is disabled.
              The public CTA currently links users to the Telegram channel at{' '}
              <a href={CTA_CHANNELS.telegram.url} target="_blank" rel="noopener noreferrer" className="underline">
                {CTA_CHANNELS.telegram.url}
              </a>{' '}
              — this is a passive channel join, not tracked bot subscription.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Info */}
      <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-800">
        <CardContent className="p-4 flex items-start gap-3">
          <Info className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />
          <div className="text-xs text-muted-foreground space-y-1">
            <p>To enable Telegram bot broadcasts:</p>
            <ol className="list-decimal ml-4 space-y-0.5">
              <li>Create a Telegram bot via @BotFather</li>
              <li>Add the TELEGRAM_BOT_TOKEN secret</li>
              <li>Set up the bot webhook to the <code>telegram-bot</code> edge function</li>
              <li>Users subscribe by messaging /start to the bot</li>
            </ol>
          </div>
        </CardContent>
      </Card>

      {/* Subscribers Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Send className="h-4 w-4" /> Bot Subscribers ({activeCount} active)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : subscribers.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No bot subscribers yet. Users need to message the bot to subscribe.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 pr-4">Chat ID</th>
                    <th className="pb-2 pr-4">Username</th>
                    <th className="pb-2 pr-4">Status</th>
                    <th className="pb-2 pr-4">Categories</th>
                    <th className="pb-2">Subscribed</th>
                  </tr>
                </thead>
                <tbody>
                  {subscribers.map((s) => (
                    <tr key={s.id} className="border-b border-border/50">
                      <td className="py-2 pr-4 font-mono">{s.telegram_chat_id}</td>
                      <td className="py-2 pr-4">{s.telegram_username || '—'}</td>
                      <td className="py-2 pr-4">
                        <Badge variant={s.is_active ? 'default' : 'secondary'} className="text-[10px]">
                          {s.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                      <td className="py-2 pr-4">{s.categories?.join(', ') || '—'}</td>
                      <td className="py-2">{new Date(s.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
