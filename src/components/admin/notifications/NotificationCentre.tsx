import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LayoutDashboard, Mail, Send, MessageCircle, ScrollText, Settings } from 'lucide-react';
import { NotificationOverview } from './NotificationOverview';
import { EmailSubscribersTab } from './EmailSubscribersTab';
import { TelegramSubscribersTab } from './TelegramSubscribersTab';
import { WhatsAppTab } from './WhatsAppTab';
import { NotificationLogs } from './NotificationLogs';
import { NotificationSettings } from './NotificationSettings';

export function NotificationCentre() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-foreground">Notification Centre</h2>
        <p className="text-sm text-muted-foreground">Manage alert channels, view subscribers, and send notifications.</p>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="flex flex-wrap !h-auto gap-1 p-2">
          <TabsTrigger value="overview" className="flex items-center gap-1.5 text-xs">
            <LayoutDashboard className="h-3.5 w-3.5" /> Overview
          </TabsTrigger>
          <TabsTrigger value="email" className="flex items-center gap-1.5 text-xs">
            <Mail className="h-3.5 w-3.5" /> Email
          </TabsTrigger>
          <TabsTrigger value="telegram" className="flex items-center gap-1.5 text-xs">
            <Send className="h-3.5 w-3.5" /> Telegram
          </TabsTrigger>
          <TabsTrigger value="whatsapp" className="flex items-center gap-1.5 text-xs">
            <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
          </TabsTrigger>
          <TabsTrigger value="logs" className="flex items-center gap-1.5 text-xs">
            <ScrollText className="h-3.5 w-3.5" /> Logs
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-1.5 text-xs">
            <Settings className="h-3.5 w-3.5" /> Settings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview"><NotificationOverview /></TabsContent>
        <TabsContent value="email"><EmailSubscribersTab /></TabsContent>
        <TabsContent value="telegram"><TelegramSubscribersTab /></TabsContent>
        <TabsContent value="whatsapp"><WhatsAppTab /></TabsContent>
        <TabsContent value="logs"><NotificationLogs /></TabsContent>
        <TabsContent value="settings"><NotificationSettings /></TabsContent>
      </Tabs>
    </div>
  );
}
