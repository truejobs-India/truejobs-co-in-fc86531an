/**
 * ChatGPT Agent Draft Editor — drawer for editing a single intake draft.
 * Production Format tab exposes all 16 new-format fields. On save, new fields
 * are non-destructively mirrored into legacy fields (raw_title, normalized_title,
 * organisation_name, official_notification_link) so downstream publishing keeps
 * working without losing existing legacy data.
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

/**
 * Non-destructive mirror: only overwrite the legacy field when the new field
 * has a real value, OR when the user explicitly cleared the new field this session.
 */
function safeMirror(newVal: string | null | undefined, legacyVal: any, userTouched: boolean): any {
  if (newVal && String(newVal).trim()) return String(newVal).trim();
  if (userTouched) return null;
  return legacyVal;
}

export function ChatGptAgentDraftEditor({ draft, onClose, onSaved, onPublish }: ChatGptAgentDraftEditorProps) {
  const { toast } = useToast();
  const [edits, setEdits] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const val = (field: string) => edits[field] !== undefined ? edits[field] : (draft?.[field] ?? '');
  const set = (field: string, value: any) => setEdits(prev => ({ ...prev, [field]: value }));
  const touched = (field: string) => Object.prototype.hasOwnProperty.call(edits, field);

  const handleSave = async () => {
    if (Object.keys(edits).length === 0) { onClose(); return; }
    setSaving(true);
    try {
      // Build update payload with non-destructive legacy mirror
      const payload: Record<string, any> = { ...edits };

      // Mirror publish_title → normalized_title + raw_title
      if (touched('publish_title')) {
        const newTitle = edits.publish_title;
        payload.normalized_title = safeMirror(newTitle, draft?.normalized_title, true);
        payload.raw_title = safeMirror(newTitle, draft?.raw_title, true);
      }

      // Mirror organization_authority → organisation_name
      if (touched('organization_authority')) {
        payload.organisation_name = safeMirror(edits.organization_authority, draft?.organisation_name, true);
      }

      // Mirror URL precedence (reference → cta → website) → official_notification_link
      if (touched('official_reference_url') || touched('primary_cta_url') || touched('official_website_url')) {
        const ref = touched('official_reference_url') ? edits.official_reference_url : draft?.official_reference_url;
        const cta = touched('primary_cta_url') ? edits.primary_cta_url : draft?.primary_cta_url;
        const web = touched('official_website_url') ? edits.official_website_url : draft?.official_website_url;
        const candidate = (ref && String(ref).trim()) || (cta && String(cta).trim()) || (web && String(web).trim()) || null;
        const userTouchedAny = touched('official_reference_url') || touched('primary_cta_url') || touched('official_website_url');
        payload.official_notification_link = safeMirror(candidate, draft?.official_notification_link, userTouchedAny);
      }

      const { error } = await supabase.from('intake_drafts').update(payload as any).eq('id', draft.id);
      if (error) throw error;
      toast({ title: 'Draft saved' });
      onSaved();
    } catch (err: any) {
      toast({ title: 'Save failed', description: err?.message, variant: 'destructive' });
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
  const isProduction = (structuredData?._format === 'production_v1') || !!draft?.record_id || !!draft?.publish_title;

  const openLink = (url: string | null | undefined) => {
    if (!url) return null;
    return (
      <Button size="icon" variant="ghost" asChild>
        <a href={url} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" /></a>
      </Button>
    );
  };

  return (
    <Sheet open={!!draft} onOpenChange={v => !v && onClose()}>
      <SheetContent className="w-full sm:max-w-xl flex flex-col">
        <SheetHeader>
          <SheetTitle className="text-base truncate">
            {draft?.publish_title || draft?.normalized_title || draft?.raw_title || 'Draft'}
          </SheetTitle>
        </SheetHeader>

        <ScrollArea className="flex-1 min-h-0 pr-2">
          <Tabs defaultValue={isProduction ? 'production' : 'fields'} className="mt-2">
            <TabsList className="w-full">
              {isProduction && <TabsTrigger value="production" className="flex-1">Production</TabsTrigger>}
              <TabsTrigger value="fields" className="flex-1">Fields</TabsTrigger>
              <TabsTrigger value="seo" className="flex-1">SEO</TabsTrigger>
              <TabsTrigger value="dates" className="flex-1">Dates</TabsTrigger>
              <TabsTrigger value="diagnostics" className="flex-1">Info</TabsTrigger>
            </TabsList>

            {/* ── PRODUCTION FORMAT TAB ── */}
            {isProduction && (
              <TabsContent value="production" className="space-y-3 mt-3">
                <div>
                  <Label className="text-xs">Record ID (read-only)</Label>
                  <Input value={draft?.record_id || ''} readOnly className="bg-muted font-mono text-xs" />
                </div>
                <div>
                  <Label className="text-xs">Publish Title</Label>
                  <Input value={val('publish_title')} onChange={e => set('publish_title', e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">Organization / Board / Authority</Label>
                  <Input value={val('organization_authority')} onChange={e => set('organization_authority', e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Category Family</Label>
                    <Input value={val('category_family')} onChange={e => set('category_family', e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs">Update Type</Label>
                    <Input value={val('update_type')} onChange={e => set('update_type', e.target.value)} />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Official Website URL</Label>
                  <div className="flex gap-2">
                    <Input value={val('official_website_url')} onChange={e => set('official_website_url', e.target.value)} className="flex-1" />
                    {openLink(draft?.official_website_url)}
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Official Reference URL</Label>
                  <div className="flex gap-2">
                    <Input value={val('official_reference_url')} onChange={e => set('official_reference_url', e.target.value)} className="flex-1" />
                    {openLink(draft?.official_reference_url)}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Primary CTA Label</Label>
                    <Input value={val('primary_cta_label')} onChange={e => set('primary_cta_label', e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs">Primary CTA URL</Label>
                    <div className="flex gap-1">
                      <Input value={val('primary_cta_url')} onChange={e => set('primary_cta_url', e.target.value)} className="flex-1" />
                      {openLink(draft?.primary_cta_url)}
                    </div>
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Secondary Official URL</Label>
                  <div className="flex gap-2">
                    <Input value={val('secondary_official_url')} onChange={e => set('secondary_official_url', e.target.value)} className="flex-1" />
                    {openLink(draft?.secondary_official_url)}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Publish Status</Label>
                    <Input value={val('publish_status')} onChange={e => set('publish_status', e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs">Verification Status</Label>
                    <Input value={val('verification_status')} onChange={e => set('verification_status', e.target.value)} />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Verification Confidence</Label>
                  <Input value={val('verification_confidence')} onChange={e => set('verification_confidence', e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">Official Source Used</Label>
                  <Input value={val('official_source_used')} onChange={e => set('official_source_used', e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">Source Verified On</Label>
                  <Input value={val('source_verified_on')} onChange={e => set('source_verified_on', e.target.value)} placeholder="Original text from sheet" />
                  {draft?.source_verified_on_date && (
                    <p className="text-[10px] text-muted-foreground mt-0.5">Parsed date: {draft.source_verified_on_date}</p>
                  )}
                </div>
                <div>
                  <Label className="text-xs">Production Notes</Label>
                  <Textarea value={val('production_notes')} onChange={e => set('production_notes', e.target.value)} rows={3} className="break-words" />
                </div>
              </TabsContent>
            )}

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
                  {openLink(draft?.official_notification_link)}
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
                  <span className="text-muted-foreground">Format</span>
                  <Badge variant="outline">{structuredData?._format || 'legacy'}</Badge>
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
                  <span className="text-muted-foreground">Import Identity</span>
                  <span className="font-mono text-[10px] truncate max-w-[200px]" title={draft?.import_identity}>{draft?.import_identity || '—'}</span>
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
