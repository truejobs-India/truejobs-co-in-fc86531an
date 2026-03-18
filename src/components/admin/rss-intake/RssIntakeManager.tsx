import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarChart3, Rss, FileText, ClipboardCheck } from 'lucide-react';
import { RssDashboardCards } from './RssDashboardCards';
import { RssSourcesTab } from './RssSourcesTab';
import { RssFetchedItemsTab } from './RssFetchedItemsTab';
import { RssReviewQueueTab } from './RssReviewQueueTab';

export function RssIntakeManager() {
  return (
    <div className="space-y-4">
      <Tabs defaultValue="dashboard" className="space-y-4">
        <TabsList className="flex flex-wrap !h-auto gap-1 p-1">
          <TabsTrigger value="dashboard" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Dashboard
          </TabsTrigger>
          <TabsTrigger value="sources" className="flex items-center gap-2">
            <Rss className="h-4 w-4" />
            Sources
          </TabsTrigger>
          <TabsTrigger value="items" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Items
          </TabsTrigger>
          <TabsTrigger value="review" className="flex items-center gap-2">
            <ClipboardCheck className="h-4 w-4" />
            Review Queue
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard">
          <RssDashboardCards />
        </TabsContent>
        <TabsContent value="sources">
          <RssSourcesTab />
        </TabsContent>
        <TabsContent value="items">
          <RssFetchedItemsTab />
        </TabsContent>
        <TabsContent value="review">
          <RssReviewQueueTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
