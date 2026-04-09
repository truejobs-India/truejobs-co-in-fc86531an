import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MessageCircle, ExternalLink, Info } from 'lucide-react';
import { CTA_CHANNELS } from '@/lib/ctaConfig';

export function WhatsAppTab() {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <MessageCircle className="h-4 w-4 text-green-600" /> WhatsApp Alerts — Status
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">Link-Only</Badge>
            <span className="text-xs text-muted-foreground">No backend delivery system</span>
          </div>

          <div className="rounded-lg border p-3 space-y-2">
            <p className="text-sm font-medium">Current Configuration</p>
            <div className="text-xs space-y-1 text-muted-foreground">
              <p>
                <span className="font-medium text-foreground">CTA Target:</span>{' '}
                <a href={CTA_CHANNELS.whatsapp.url} target="_blank" rel="noopener noreferrer" className="underline inline-flex items-center gap-1">
                  {CTA_CHANNELS.whatsapp.url} <ExternalLink className="h-3 w-3" />
                </a>
              </p>
              <p><span className="font-medium text-foreground">Phone:</span> +91 79823 06492</p>
              <p><span className="font-medium text-foreground">Behavior:</span> Opens WhatsApp chat with pre-filled "Subscribe to job alerts" message</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-800">
        <CardContent className="p-4 flex items-start gap-3">
          <Info className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />
          <div className="text-xs text-muted-foreground space-y-2">
            <p className="font-medium text-foreground">Why no subscriber tracking?</p>
            <p>
              WhatsApp Business API requires Meta Business verification, monthly platform costs, and a dedicated integration.
              The current link-based approach is free, simple, and honest. Users contact you directly via WhatsApp.
            </p>
            <p>
              If you want true WhatsApp automation in the future, you would need to integrate WhatsApp Business API
              (via Twilio, Gupshup, or Meta Cloud API) — this is a separate infrastructure project.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
