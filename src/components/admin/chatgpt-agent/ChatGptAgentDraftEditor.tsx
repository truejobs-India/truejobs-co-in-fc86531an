/**
 * ChatGPT Agent Draft Editor — drawer for editing a single intake draft.
 */
import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Save, Trash2, Send, ExternalLink } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { SECTION_BUCKET_LABELS, type SectionBucket } from './chatgptAgentExcelParser';

interface ChatGptAgentDraftEditorProps {
  draft: any;
  onClose: () => void;
  onSaved: () => void;
  onPublish: (id: string) => Promise<void>;
}

export function ChatGptAgentDraftEditor({ draft, onClose, onSaved, onPublish }: ChatGptAgentDraftEditorProps) {
  const { toast } = useToast();
  const [edits, setEdits] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const val = (field: string) => edits[field] !== undefined ? edits[field] : (draft?.[field] || '');
  const set = (field: string, value: any) => setEdits(prev => ({ ...prev, [field]: value }));

  const handleSave = async () => {
    if (Object.keys(edits).length === 0) { onClose(); return; }
    setSaving(true);
    try {
      await supabase.from('intake_drafts').update(edits as any).eq('id', draft.id);
      toast({ title: 'Draft saved' });
      onSaved();
    } catch {
      toast({ title: 'Save failed', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    setPublishing(true);
    try {
      await onPublish(draft.id);
    } finally {
      setPublishing(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await supabase.from('intake_drafts').delete().eq('id', draft.id);
      toast({ title: 'Draft deleted' });
      onSaved();
    } catch {
      toast({ title: 'Delete failed', variant: 'destructive' });
    } finally {
      setDeleting(false);
    }
  };

  const structuredData = draft?.structured_data_json || {};
  const bucket = draft?.section_bucket as SectionBucket | undefined;

  return (
    <Sheet open={!!draft} onOpenChange={v => !v && onClose()}>
      <SheetContent className="w-full sm:max-w-xl flex flex-col">
        <SheetHeader>
          <SheetTitle className="text-base truncate">{draft?.normalized_title || draft?.raw_title || 'Draft'}</SheetTitle>
        </SheetHeader>

        <ScrollArea className="flex-1 min-h-0 pr-2">
          <Tabs defaultValue="fields" className="mt-2">
            <TabsList className="w-full">
              <TabsTrigger value="fields" className="flex-1">Fields</TabsTrigger>
              <TabsTrigger value="seo" className="flex-1">SEO</TabsTrigger>
              <TabsTrigger value="dates" className="flex-1">Dates</TabsTrigger>
              <TabsTrigger value="diagnostics" className="flex-1">Info</TabsTrigger>
            </TabsList>

            <TabsContent value="fields" className="space-y-3 mt-3">
              <div>
                <Label className="text-xs">Title</Label>
                <Input value={val('normalized_title')} onChange={e => set('normalized_title', e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Organization</Label>
                <Input value={val('organisation_name')} onChange={e => set('organisation_name', e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Post / Exam Name</Label>
                <Input value={val('post_name')} onChange={e => set('post_name', e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Official Link</Label>
                <div className="flex gap-2">
                  <Input value={val('official_notification_link')} onChange={e => set('official_notification_link', e.target.value)} className="flex-1" />
                  {draft?.official_notification_link && (
                    <Button size="icon" variant="ghost" asChild>
                      <a href={draft.official_notification_link} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </Button>
                  )}
                </div>
              </div>
              <div>
                <Label className="text-xs">Summary</Label>
                <Textarea value={val('summary')} onChange={e => set('summary', e.target.value)} rows={3} />
              </div>
              <div>
                <Label className="text-xs">Qualification</Label>
                <Input value={val('qualification_text')} onChange={e => set('qualification_text', e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Age Limit</Label>
                <Input value={val('age_limit_text')} onChange={e => set('age_limit_text', e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Review Notes</Label>
                <Textarea value={val('review_notes')} onChange={e => set('review_notes', e.target.value)} rows={2} />
              </div>
            </TabsContent>

            <TabsContent value="seo" className="space-y-3 mt-3">
              <div>
                <Label className="text-xs">Slug</Label>
                <Input value={val('slug')} onChange={e => set('slug', e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">SEO Title</Label>
                <Input value={val('seo_title')} onChange={e => set('seo_title', e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Meta Description</Label>
                <Textarea value={val('meta_description')} onChange={e => set('meta_description', e.target.value)} rows={3} />
              </div>
            </TabsContent>

            <TabsContent value="dates" className="space-y-3 mt-3">
              <div>
                <Label className="text-xs">Last Date / Closing Date</Label>
                <Input value={val('closing_date')} onChange={e => set('closing_date', e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Opening Date</Label>
                <Input value={val('opening_date')} onChange={e => set('opening_date', e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Exam Date</Label>
                <Input value={val('exam_date')} onChange={e => set('exam_date', e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Result Date</Label>
                <Input value={val('result_date')} onChange={e => set('result_date', e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Admit Card Date</Label>
                <Input value={val('admit_card_date')} onChange={e => set('admit_card_date', e.target.value)} />
              </div>
            </TabsContent>

            <TabsContent value="diagnostics" className="space-y-3 mt-3">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Section</span>
                  <Badge variant="outline">{bucket ? SECTION_BUCKET_LABELS[bucket] : 'Unknown'}</Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Content Type</span>
                  <Badge variant="outline">{draft?.content_type || '—'}</Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Publish Target</span>
                  <Badge variant="outline">{draft?.publish_target || '—'}</Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Import Sheet</span>
                  <span className="font-mono text-xs">{draft?.import_source_sheet || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Import Row</span>
                  <span className="font-mono text-xs">{draft?.import_row_number || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status</span>
                  <Badge variant={draft?.primary_status === 'publish_ready' ? 'default' : 'secondary'}>
                    {draft?.primary_status || '—'}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Processing</span>
                  <Badge variant="outline">{draft?.processing_status || '—'}</Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Official Link</span>
                  <Badge variant={draft?.official_notification_link ? 'default' : 'destructive'}>
                    {draft?.official_notification_link ? 'Present' : 'Missing'}
                  </Badge>
                </div>
                {Object.keys(structuredData).length > 0 && (
                  <div className="pt-2 border-t">
                    <p className="text-xs font-medium mb-1">Import Metadata</p>
                    {Object.entries(structuredData).map(([k, v]) => (
                      <div key={k} className="flex justify-between text-xs">
                        <span className="text-muted-foreground">{k.replace(/_/g, ' ')}</span>
                        <span className="truncate max-w-[200px]">{String(v)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </ScrollArea>

        <SheetFooter className="flex-row gap-2 pt-3 border-t">
          <Button variant="destructive" size="sm" onClick={handleDelete} disabled={deleting}>
            {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4 mr-1" />}
            Delete
          </Button>
          <div className="flex-1" />
          <Button variant="outline" size="sm" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
            Save
          </Button>
          <Button size="sm" onClick={handlePublish} disabled={publishing}>
            {publishing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Send className="h-4 w-4 mr-1" />}
            Publish
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
