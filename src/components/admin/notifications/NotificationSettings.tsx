import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, Settings, ExternalLink } from 'lucide-react';
import { CTA_CHANNELS } from '@/lib/ctaConfig';

export function NotificationSettings() {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Settings className="h-4 w-4" /> Channel Configuration Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Email */}
            <div className="flex items-center justify-between p-3 rounded-lg border">
              <div className="flex items-center gap-3">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <div>
                  <p className="text-sm font-medium">Email (Resend)</p>
                  <p className="text-xs text-muted-foreground">RESEND_API_KEY configured • Sending enabled</p>
                </div>
              </div>
              <Badge variant="default" className="text-[10px]">Operational</Badge>
            </div>

            {/* Telegram */}
            <div className="flex items-center justify-between p-3 rounded-lg border">
              <div className="flex items-center gap-3">
                <XCircle className="h-4 w-4 text-yellow-500" />
                <div>
                  <p className="text-sm font-medium">Telegram Bot</p>
                  <p className="text-xs text-muted-foreground">TELEGRAM_BOT_TOKEN not configured • Broadcast disabled</p>
                </div>
              </div>
              <Badge variant="outline" className="text-[10px]">Disabled</Badge>
            </div>

            {/* WhatsApp */}
            <div className="flex items-center justify-between p-3 rounded-lg border">
              <div className="flex items-center gap-3">
                <XCircle className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">WhatsApp</p>
                  <p className="text-xs text-muted-foreground">Link-only • No Business API integration</p>
                </div>
              </div>
              <Badge variant="outline" className="text-[10px]">Link Only</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* CTA URLs */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Public CTA URLs (from ctaConfig.ts)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-xs">
          <div className="flex items-center justify-between p-2 rounded border">
            <span className="font-medium">WhatsApp</span>
            <a href={CTA_CHANNELS.whatsapp.url} target="_blank" rel="noopener noreferrer" className="text-primary underline flex items-center gap-1">
              {CTA_CHANNELS.whatsapp.url} <ExternalLink className="h-3 w-3" />
            </a>
          </div>
          <div className="flex items-center justify-between p-2 rounded border">
            <span className="font-medium">Telegram</span>
            <a href={CTA_CHANNELS.telegram.url} target="_blank" rel="noopener noreferrer" className="text-primary underline flex items-center gap-1">
              {CTA_CHANNELS.telegram.url} <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </CardContent>
      </Card>

      {/* Notes */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Admin Notes</CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground space-y-2">
          <p>• Email subscribers are collected via public CTA forms across 24+ pages. No email verification (double opt-in) is currently implemented.</p>
          <p>• Telegram CTA links users to a channel (passive join). To enable tracked subscriptions and broadcasts, configure a Telegram bot.</p>
          <p>• WhatsApp CTA opens a wa.me chat link. No subscriber data is captured or stored.</p>
          <p>• All send operations are logged in the notification_send_log table and visible in the Logs tab.</p>
        </CardContent>
      </Card>
    </div>
  );
}
