import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { Mail, Send, MessageCircle, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';

interface ChannelStatus {
  emailCount: number;
  telegramCount: number;
  recentSends: number;
  loading: boolean;
}

export function NotificationOverview() {
  const [status, setStatus] = useState<ChannelStatus>({
    emailCount: 0,
    telegramCount: 0,
    recentSends: 0,
    loading: true,
  });

  useEffect(() => {
    (async () => {
      const [emailRes, telegramRes, logsRes] = await Promise.all([
        supabase.from('email_subscribers').select('id', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('telegram_subscribers').select('id', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('notification_send_log').select('id', { count: 'exact', head: true }),
      ]);
      setStatus({
        emailCount: emailRes.count || 0,
        telegramCount: telegramRes.count || 0,
        recentSends: logsRes.count || 0,
        loading: false,
      });
    })();
  }, []);

  if (status.loading) {
    return <p className="text-sm text-muted-foreground">Loading channel status...</p>;
  }

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {/* Email */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Mail className="h-4 w-4 text-primary" /> Email Alerts
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-green-500" />
            <Badge variant="secondary" className="text-xs">Configured</Badge>
          </div>
          <p className="text-2xl font-bold">{status.emailCount}</p>
          <p className="text-xs text-muted-foreground">Active subscribers</p>
          <p className="text-xs text-muted-foreground">Sends via Resend API • Operational</p>
        </CardContent>
      </Card>

      {/* Telegram */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Send className="h-4 w-4 text-blue-500" /> Telegram Alerts
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
            <Badge variant="outline" className="text-xs">Bot Token Missing</Badge>
          </div>
          <p className="text-2xl font-bold">{status.telegramCount}</p>
          <p className="text-xs text-muted-foreground">Bot subscribers</p>
          <p className="text-xs text-muted-foreground">Public CTA links to channel (passive join). Bot broadcast disabled until TELEGRAM_BOT_TOKEN is configured.</p>
        </CardContent>
      </Card>

      {/* WhatsApp */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <MessageCircle className="h-4 w-4 text-green-600" /> WhatsApp Alerts
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center gap-2">
            <XCircle className="h-4 w-4 text-muted-foreground" />
            <Badge variant="outline" className="text-xs">Link-Only</Badge>
          </div>
          <p className="text-2xl font-bold">N/A</p>
          <p className="text-xs text-muted-foreground">No subscriber tracking</p>
          <p className="text-xs text-muted-foreground">CTA opens wa.me chat link. No backend delivery or subscriber database.</p>
        </CardContent>
      </Card>

      {/* Send Activity */}
      <Card className="md:col-span-3">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Send Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Total broadcasts sent: <span className="font-semibold text-foreground">{status.recentSends}</span>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
