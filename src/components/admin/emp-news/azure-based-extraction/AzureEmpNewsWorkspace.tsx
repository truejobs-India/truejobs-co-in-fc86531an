import { useState, useCallback, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { IssuesTab } from './IssuesTab';
import { UploadTab } from './UploadTab';
import { PlaceholderTab } from './PlaceholderTab';
import { OcrQueueTab } from './OcrQueueTab';
import { ReconstructedNoticesTab } from './ReconstructedNoticesTab';
import { DraftJobsTab } from './DraftJobsTab';
import { PublishLogTab } from './PublishLogTab';
import type { AzureEmpNewsIssue } from '@/types/azureEmpNews';
import { FileText, Upload, Cpu, Layers, Briefcase, ScrollText } from 'lucide-react';

export function AzureEmpNewsWorkspace() {
  const [issues, setIssues] = useState<AzureEmpNewsIssue[]>([]);
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('issues');

  const fetchIssues = useCallback(async () => {
    const { data } = await supabase
      .from('azure_emp_news_issues')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) setIssues(data as unknown as AzureEmpNewsIssue[]);
  }, []);

  useEffect(() => { fetchIssues(); }, [fetchIssues]);

  const handleSelectIssue = (issue: AzureEmpNewsIssue) => {
    setSelectedIssueId(issue.id);
    setActiveTab('upload');
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <h3 className="text-lg font-semibold text-foreground">Azure Based Extraction</h3>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-6 w-full">
          <TabsTrigger value="issues" className="flex items-center gap-1.5 text-xs">
            <FileText className="h-3.5 w-3.5" /> Issues
          </TabsTrigger>
          <TabsTrigger value="upload" className="flex items-center gap-1.5 text-xs">
            <Upload className="h-3.5 w-3.5" /> Upload
          </TabsTrigger>
          <TabsTrigger value="ocr" className="flex items-center gap-1.5 text-xs">
            <Cpu className="h-3.5 w-3.5" /> OCR Queue
          </TabsTrigger>
          <TabsTrigger value="reconstructed" className="flex items-center gap-1.5 text-xs">
            <Layers className="h-3.5 w-3.5" /> Reconstructed
          </TabsTrigger>
          <TabsTrigger value="drafts" className="flex items-center gap-1.5 text-xs">
            <Briefcase className="h-3.5 w-3.5" /> Draft Jobs
          </TabsTrigger>
          <TabsTrigger value="publish" className="flex items-center gap-1.5 text-xs">
            <ScrollText className="h-3.5 w-3.5" /> Publish Log
          </TabsTrigger>
        </TabsList>

        <TabsContent value="issues">
          <IssuesTab onSelectIssue={handleSelectIssue} />
        </TabsContent>

        <TabsContent value="upload">
          <UploadTab
            issues={issues}
            selectedIssueId={selectedIssueId}
            onIssueChange={setSelectedIssueId}
            onUploadComplete={fetchIssues}
          />
        </TabsContent>

        <TabsContent value="ocr">
          <OcrQueueTab />
        </TabsContent>

        <TabsContent value="reconstructed">
          <ReconstructedNoticesTab />
        </TabsContent>

        <TabsContent value="drafts">
          <DraftJobsTab />
        </TabsContent>

        <TabsContent value="publish">
          <PlaceholderTab title="Publish Log" description="Publish history and status logs will appear here. Build in Prompt 4." />
        </TabsContent>
      </Tabs>
    </div>
  );
}
