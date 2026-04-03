/**
 * Detail/Edit Dialog for a single intake draft.
 * Includes Approve & Publish and Delete Permanently actions.
 */
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, Trash2, Loader2, Zap } from 'lucide-react';

interface IntakeDraftDetailDialogProps {
  draft: any;
  onClose: () => void;
  onSave: (updates: Record<string, any>) => Promise<void>;
  onApprovePublish?: () => Promise<void>;
  onDelete?: () => Promise<void>;
  onFillEmpty?: () => Promise<void>;
}

export function IntakeDraftDetailDialog({ draft, onClose, onSave, onApprovePublish, onDelete, onFillEmpty }: IntakeDraftDetailDialogProps) {
  const [edits, setEdits] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [fillingEmpty, setFillingEmpty] = useState(false);

  const val = (field: string) => edits[field] !== undefined ? edits[field] : (draft[field] || '');
  const set = (field: string, value: any) => setEdits(prev => ({ ...prev, [field]: value }));

  const handleSave = async () => {
    if (Object.keys(edits).length === 0) { onClose(); return; }
    setSaving(true);
    await onSave(edits);
    setSaving(false);
  };

  const handleApprovePublish = async () => {
    if (!onApprovePublish) return;
    setPublishing(true);
    await onApprovePublish();
    setPublishing(false);
  };

  const handleDelete = async () => {
    if (!onDelete) return;
    await onDelete();
  };

  const handleFillEmpty = async () => {
    if (!onFillEmpty) return;
    setFillingEmpty(true);
    await onFillEmpty();
    setFillingEmpty(false);
  };

  const tags = Array.isArray(draft.secondary_tags) ? draft.secondary_tags : [];
  const blockers = Array.isArray(draft.publish_blockers) ? draft.publish_blockers : [];

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="text-base">
            {draft.normalized_title || draft.raw_title || draft.id.slice(0, 8)}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="h-[60vh] pr-4">
          <Tabs defaultValue="content" className="space-y-3">
            <TabsList className="flex flex-wrap h-auto gap-1 p-1">
              <TabsTrigger value="content" className="text-xs">Content</TabsTrigger>
              <TabsTrigger value="overview" className="text-xs">Overview</TabsTrigger>
              <TabsTrigger value="fields" className="text-xs">Fields</TabsTrigger>
              <TabsTrigger value="dates" className="text-xs">Dates & Links</TabsTrigger>
              <TabsTrigger value="raw" className="text-xs">Raw Source</TabsTrigger>
            </TabsList>

            <TabsContent value="content" className="space-y-3">
              {draft.draft_content_html && (
                <div>
                  <Label className="text-xs">Draft Content Preview</Label>
                  <div className="border rounded-md p-3 mt-1 max-h-[300px] overflow-auto text-sm prose prose-sm dark:prose-invert"
                    dangerouslySetInnerHTML={{ __html: draft.draft_content_html }} />
                </div>
              )}
              <div>
                <Label className="text-xs">Draft Content HTML (editable)</Label>
                <textarea
                  value={val('draft_content_html')}
                  onChange={e => set('draft_content_html', e.target.value)}
                  className="w-full h-40 text-xs border rounded-md p-2 bg-background font-mono"
                />
              </div>
              <div>
                <Label className="text-xs">Summary</Label>
                <textarea
                  value={val('summary')}
                  onChange={e => set('summary', e.target.value)}
                  className="w-full h-20 text-xs border rounded-md p-2 bg-background"
                />
              </div>
              {draft.key_points_json && (
                <div>
                  <Label className="text-xs">Key Points</Label>
                  <pre className="text-xs bg-muted p-2 rounded-md overflow-auto max-h-40">
                    {JSON.stringify(draft.key_points_json, null, 2)}
                  </pre>
                </div>
              )}
              {draft.faq_json && (
                <div>
                  <Label className="text-xs">FAQ</Label>
                  <pre className="text-xs bg-muted p-2 rounded-md overflow-auto max-h-40">
                    {JSON.stringify(draft.faq_json, null, 2)}
                  </pre>
                </div>
              )}
            </TabsContent>

            <TabsContent value="overview" className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Badge variant={draft.primary_status === 'publish_ready' ? 'default' : 'secondary'}>
                  Status: {draft.primary_status || 'Unclassified'}
                </Badge>
                <Badge variant="outline">Processing: {draft.processing_status}</Badge>
                <Badge variant="outline">Review: {draft.review_status}</Badge>
                {draft.content_type && <Badge variant="outline">Type: {draft.content_type}</Badge>}
                {draft.publish_target && <Badge variant="outline">Target: {draft.publish_target}</Badge>}
                {draft.confidence_score != null && <Badge variant="outline">Confidence: {draft.confidence_score}%</Badge>}
                {draft.enrichment_result === 'enriched' && (
                  <Badge className="text-[10px] bg-green-600/15 text-green-700 border-green-600/30 dark:text-green-400">Enriched</Badge>
                )}
                {draft.enrichment_result === 'not_enriched_tech_error' && (
                  <Badge variant="destructive" className="text-[10px]">Fill Failed</Badge>
                )}
                {draft.enrichment_result === 'not_enriched_no_data' && (
                  <Badge className="text-[10px] bg-amber-500/15 text-amber-700 border-amber-500/30 dark:text-amber-400">No Data</Badge>
                )}
              </div>

              {tags.length > 0 && (
                <div>
                  <Label className="text-xs text-muted-foreground">Tags</Label>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {tags.map((t: string) => <Badge key={t} variant="outline" className="text-[10px]">{t}</Badge>)}
                  </div>
                </div>
              )}

              {blockers.length > 0 && (
                <div>
                  <Label className="text-xs text-destructive">Publish Blockers</Label>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {blockers.map((b: string) => <Badge key={b} variant="destructive" className="text-[10px]">{b}</Badge>)}
                  </div>
                </div>
              )}

              {draft.classification_reason && (
                <div>
                  <Label className="text-xs text-muted-foreground">Classification Reason</Label>
                  <p className="text-xs mt-1">{draft.classification_reason}</p>
                </div>
              )}

              {draft.ai_model_used && (
                <div className="text-xs text-muted-foreground">
                  AI Model: {draft.ai_model_used} · Processed: {draft.ai_processed_at ? new Date(draft.ai_processed_at).toLocaleString() : '—'}
                </div>
              )}

              {draft.published_record_id && (
                <div className="text-xs text-green-700">
                  Published to: {draft.published_table_name} · ID: {draft.published_record_id} · At: {new Date(draft.published_at).toLocaleString()}
                </div>
              )}
              {draft.publish_error && (
                <div className="text-xs text-destructive">Publish Error: {draft.publish_error}</div>
              )}
            </TabsContent>

            <TabsContent value="fields" className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                {[
                  ['normalized_title', 'Title'], ['seo_title', 'SEO Title'], ['slug', 'Slug'],
                  ['meta_description', 'Meta Description'], ['organisation_name', 'Organisation'],
                  ['department_name', 'Department'], ['ministry_name', 'Ministry'],
                  ['post_name', 'Post Name'], ['exam_name', 'Exam Name'],
                  ['advertisement_no', 'Advt No.'], ['reference_no', 'Ref No.'],
                  ['job_location', 'Location'], ['application_mode', 'Application Mode'],
                  ['vacancy_count', 'Vacancies'], ['qualification_text', 'Qualification'],
                  ['age_limit_text', 'Age Limit'], ['salary_text', 'Salary'],
                ].map(([field, label]) => (
                  <div key={field}>
                    <Label className="text-xs">{label}</Label>
                    <Input value={val(field)} onChange={e => set(field, e.target.value)} className="h-7 text-xs" />
                  </div>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="dates" className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                {[
                  ['notification_date', 'Notification Date'], ['opening_date', 'Opening Date'],
                  ['closing_date', 'Closing Date'], ['exam_date', 'Exam Date'],
                  ['result_date', 'Result Date'], ['admit_card_date', 'Admit Card Date'],
                  ['answer_key_date', 'Answer Key Date'], ['correction_last_date', 'Correction Last Date'],
                ].map(([field, label]) => (
                  <div key={field}>
                    <Label className="text-xs">{label}</Label>
                    <Input value={val(field)} onChange={e => set(field, e.target.value)} className="h-7 text-xs" />
                  </div>
                ))}
              </div>

              <h4 className="text-xs font-semibold mt-4">Links</h4>
              <div className="grid grid-cols-1 gap-2">
                {[
                  ['official_notification_link', 'Notification Link'], ['official_apply_link', 'Apply Link'],
                  ['official_website_link', 'Website Link'], ['result_link', 'Result Link'],
                  ['admit_card_link', 'Admit Card Link'], ['answer_key_link', 'Answer Key Link'],
                ].map(([field, label]) => (
                  <div key={field}>
                    <Label className="text-xs">{label}</Label>
                    <Input value={val(field)} onChange={e => set(field, e.target.value)} className="h-7 text-xs" />
                  </div>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="raw" className="space-y-3">
              <div>
                <Label className="text-xs">Raw Title</Label>
                <p className="text-xs bg-muted p-2 rounded-md">{draft.raw_title || '—'}</p>
              </div>
              <div>
                <Label className="text-xs">Source URL</Label>
                <p className="text-xs break-all">
                  {draft.source_url ? <a href={draft.source_url} target="_blank" rel="noopener noreferrer" className="text-primary underline">{draft.source_url}</a> : '—'}
                </p>
              </div>
              <div>
                <Label className="text-xs">Source Domain</Label>
                <p className="text-xs">{draft.source_domain || '—'}</p>
              </div>
              {draft.raw_text && (
                <div>
                  <Label className="text-xs">Raw Text (first 2000 chars)</Label>
                  <pre className="text-xs bg-muted p-2 rounded-md overflow-auto max-h-60 whitespace-pre-wrap">
                    {draft.raw_text.slice(0, 2000)}
                  </pre>
                </div>
              )}
              {draft.raw_file_url && (
                <div>
                  <Label className="text-xs">Raw File URL</Label>
                  <p className="text-xs break-all">{draft.raw_file_url}</p>
                </div>
              )}
              <div className="text-xs text-muted-foreground">
                Source Type: {draft.source_type} · File Type: {draft.raw_file_type} · Discovered: {new Date(draft.discovered_at || draft.created_at).toLocaleString()}
              </div>
            </TabsContent>
          </Tabs>
        </ScrollArea>

        <DialogFooter className="flex-wrap gap-2">
          {/* Delete */}
          {onDelete && (
            deleteConfirm ? (
              <div className="flex items-center gap-1">
                <span className="text-xs text-destructive">Confirm?</span>
                <Button variant="destructive" size="sm" onClick={handleDelete}>Yes, Delete</Button>
                <Button variant="ghost" size="sm" onClick={() => setDeleteConfirm(false)}>No</Button>
              </div>
            ) : (
              <Button variant="outline" size="sm" className="text-destructive border-destructive/30" onClick={() => setDeleteConfirm(true)}>
                <Trash2 className="h-3 w-3 mr-1" /> Delete Permanently
              </Button>
            )
          )}

          <div className="flex-1" />

          {onFillEmpty && draft.processing_status !== 'published' && (
            <Button variant="outline" size="sm" onClick={handleFillEmpty} disabled={fillingEmpty}>
              {fillingEmpty ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Zap className="h-3 w-3 mr-1" />}
              AI Fill Empty Fields
            </Button>
          )}

          <Button variant="outline" onClick={onClose} size="sm">Cancel</Button>

          <Button onClick={handleSave} disabled={saving || Object.keys(edits).length === 0} size="sm" variant="secondary">
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>

          {onApprovePublish && draft.processing_status !== 'published' && (
            <Button onClick={handleApprovePublish} disabled={publishing} size="sm">
              {publishing ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Send className="h-4 w-4 mr-1" />}
              Approve & Publish
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
