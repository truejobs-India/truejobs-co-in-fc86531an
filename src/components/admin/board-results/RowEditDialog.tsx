/**
 * RowEditDialog — Editable form for saved row draft fields.
 * Now includes the full AI Tools panel (same as Blog's VertexAITools).
 * Saves changes to board_result_batch_rows only. Does NOT sync to live custom_pages.
 */
import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Save } from 'lucide-react';
import { BoardResultAITools } from './BoardResultAITools';
import type { BatchRow } from './useBatchPipeline';

interface Props {
  row: BatchRow | null;
  open: boolean;
  onClose: () => void;
  onSave: (rowId: string, updates: Partial<BatchRow>) => Promise<boolean>;
}

export function RowEditDialog({ row, open, onClose, onSave }: Props) {
  const [form, setForm] = useState<any>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (row) {
      setForm({
        slug: row.slug,
        display_title: row.display_title || '',
        meta_title: row.meta_title || '',
        meta_description: row.meta_description || '',
        excerpt: row.excerpt || '',
        content: row.content || '',
        tags: (row.tags || []).join(', '),
        faq_schema: row.faq_schema || [],
      });
    }
  }, [row]);

  if (!row) return null;

  const handleSave = async () => {
    setSaving(true);
    const wordCount = form.content.split(/\s+/).filter(Boolean).length;
    const ok = await onSave(row.id, {
      slug: form.slug,
      display_title: form.display_title || null,
      meta_title: form.meta_title || null,
      meta_description: form.meta_description || null,
      excerpt: form.excerpt || null,
      content: form.content,
      word_count: wordCount,
      tags: form.tags.split(',').map((t: string) => t.trim()).filter(Boolean),
      faq_schema: form.faq_schema,
    } as any);
    setSaving(false);
    if (ok) onClose();
  };

  const handleApplyField = (field: string, value: string) => {
    setForm((prev: any) => ({ ...prev, [field]: value }));
  };

  const handleApplyContent = (html: string) => {
    const wordCount = html.split(/\s+/).filter(Boolean).length;
    setForm((prev: any) => ({ ...prev, content: html, word_count: wordCount }));
  };

  const handleApplyFaqs = (faqs: Array<{ question: string; answer: string }>) => {
    setForm((prev: any) => ({ ...prev, faq_schema: faqs }));
  };

  const handleApplyTags = (tags: string[]) => {
    setForm((prev: any) => ({ ...prev, tags: tags.join(', ') }));
  };

  const isPublished = row.workflow_status === 'published';

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Edit Row #{row.row_index + 1} — {row.board_name}
            {isPublished && <Badge variant="secondary">Published — edits save to draft only</Badge>}
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
          {/* Left: Form fields */}
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>State/UT</Label>
                <Input value={row.state_ut} disabled />
              </div>
              <div>
                <Label>Board Name</Label>
                <Input value={row.board_name} disabled />
              </div>
            </div>

            <div>
              <Label>Slug</Label>
              <Input value={form.slug || ''} onChange={e => setForm({ ...form, slug: e.target.value })} />
            </div>

            <div>
              <Label>Display Title (visible page title)</Label>
              <Input value={form.display_title || ''} onChange={e => setForm({ ...form, display_title: e.target.value })} placeholder="Auto-derived if empty" />
            </div>

            <div>
              <Label>Meta Title (SEO)</Label>
              <Input value={form.meta_title || ''} onChange={e => setForm({ ...form, meta_title: e.target.value })} />
              <p className="text-xs text-muted-foreground mt-1">{(form.meta_title || '').length}/60 chars</p>
            </div>

            <div>
              <Label>Meta Description (SEO)</Label>
              <Textarea value={form.meta_description || ''} onChange={e => setForm({ ...form, meta_description: e.target.value })} rows={2} />
              <p className="text-xs text-muted-foreground mt-1">{(form.meta_description || '').length}/160 chars</p>
            </div>

            <div>
              <Label>Excerpt</Label>
              <Textarea value={form.excerpt || ''} onChange={e => setForm({ ...form, excerpt: e.target.value })} rows={2} />
            </div>

            <div>
              <Label>Tags (comma-separated)</Label>
              <Input value={form.tags || ''} onChange={e => setForm({ ...form, tags: e.target.value })} />
            </div>

            <div>
              <Label>Content (HTML)</Label>
              <Textarea value={form.content || ''} onChange={e => setForm({ ...form, content: e.target.value })} rows={12} className="font-mono text-xs" />
              <p className="text-xs text-muted-foreground mt-1">{form.content?.split(/\s+/).filter(Boolean).length || 0} words</p>
            </div>

            {/* FAQ Schema display */}
            {form.faq_schema && Array.isArray(form.faq_schema) && form.faq_schema.length > 0 && (
              <div>
                <Label>FAQ Schema ({form.faq_schema.length} items)</Label>
                <div className="border rounded p-2 max-h-[150px] overflow-auto text-xs space-y-1">
                  {form.faq_schema.map((faq: any, i: number) => (
                    <div key={i} className="bg-muted/50 rounded p-1.5">
                      <strong>Q: {faq.question}</strong>
                      <p className="text-muted-foreground">{faq.answer}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving}>
                <Save className="h-4 w-4 mr-2" /> {saving ? 'Saving…' : 'Save Draft'}
              </Button>
            </div>
          </div>

          {/* Right: AI Tools Panel */}
          <div className="space-y-3">
            <BoardResultAITools
              formData={{
                title: form.display_title || row.display_title || `${row.board_name} Result ${new Date().getFullYear()} - ${row.state_ut}`,
                slug: form.slug || row.slug,
                content: form.content || '',
                excerpt: form.excerpt || '',
                meta_title: form.meta_title || '',
                meta_description: form.meta_description || '',
                category: 'Board Results',
                tags: (form.tags || '').split(',').map((t: string) => t.trim()).filter(Boolean),
                state_ut: row.state_ut,
                board_name: row.board_name,
              }}
              onApplyField={handleApplyField}
              onApplyContent={handleApplyContent}
              onApplyFaqs={handleApplyFaqs}
              onApplyTags={handleApplyTags}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
