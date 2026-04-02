/**
 * IntakeDraftPreviewDialog — Shows draft content as it will appear to end users.
 * Uses trusted internal HTML from draft_content_html field.
 */
import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface Props {
  draftId: string | null;
  open: boolean;
  onClose: () => void;
}

export function IntakeDraftPreviewDialog({ draftId, open, onClose }: Props) {
  const [draft, setDraft] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!draftId || !open) { setDraft(null); return; }
    setLoading(true);
    supabase
      .from('intake_drafts')
      .select('normalized_title, raw_title, draft_content_html, summary, seo_title, meta_description, slug, content_type, publish_target, organisation_name, post_name, closing_date, opening_date, qualification_text, salary_text, age_limit_text, vacancy_count, application_mode, job_location, exam_name, official_notification_link, official_apply_link')
      .eq('id', draftId)
      .single()
      .then(({ data }) => { setDraft(data); setLoading(false); });
  }, [draftId, open]);

  if (!open) return null;

  const title = draft?.normalized_title || draft?.raw_title || 'Untitled';

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            Preview: {loading ? '...' : title}
            {draft?.publish_target && <Badge variant="outline" className="text-[10px]">{draft.publish_target}</Badge>}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : draft ? (
          <div className="space-y-4 text-sm">
            {/* SEO meta preview */}
            <div className="bg-muted/50 rounded-lg p-3 space-y-1">
              <p className="text-blue-600 font-medium truncate">{draft.seo_title || title}</p>
              {draft.slug && <p className="text-green-700 text-xs">/{draft.slug}</p>}
              <p className="text-muted-foreground text-xs">{draft.meta_description || 'No meta description'}</p>
            </div>

            {/* Key details table */}
            {(draft.organisation_name || draft.post_name || draft.exam_name || draft.closing_date) && (
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-xs">
                  <tbody>
                    {draft.organisation_name && (
                      <tr className="border-b"><td className="px-3 py-1.5 font-medium bg-muted/30 w-40">Organisation</td><td className="px-3 py-1.5">{draft.organisation_name}</td></tr>
                    )}
                    {draft.post_name && (
                      <tr className="border-b"><td className="px-3 py-1.5 font-medium bg-muted/30">Post</td><td className="px-3 py-1.5">{draft.post_name}</td></tr>
                    )}
                    {draft.exam_name && (
                      <tr className="border-b"><td className="px-3 py-1.5 font-medium bg-muted/30">Exam</td><td className="px-3 py-1.5">{draft.exam_name}</td></tr>
                    )}
                    {draft.vacancy_count && (
                      <tr className="border-b"><td className="px-3 py-1.5 font-medium bg-muted/30">Vacancies</td><td className="px-3 py-1.5">{draft.vacancy_count}</td></tr>
                    )}
                    {draft.qualification_text && (
                      <tr className="border-b"><td className="px-3 py-1.5 font-medium bg-muted/30">Qualification</td><td className="px-3 py-1.5">{draft.qualification_text}</td></tr>
                    )}
                    {draft.salary_text && (
                      <tr className="border-b"><td className="px-3 py-1.5 font-medium bg-muted/30">Salary</td><td className="px-3 py-1.5">{draft.salary_text}</td></tr>
                    )}
                    {draft.age_limit_text && (
                      <tr className="border-b"><td className="px-3 py-1.5 font-medium bg-muted/30">Age Limit</td><td className="px-3 py-1.5">{draft.age_limit_text}</td></tr>
                    )}
                    {draft.job_location && (
                      <tr className="border-b"><td className="px-3 py-1.5 font-medium bg-muted/30">Location</td><td className="px-3 py-1.5">{draft.job_location}</td></tr>
                    )}
                    {draft.application_mode && (
                      <tr className="border-b"><td className="px-3 py-1.5 font-medium bg-muted/30">Apply Mode</td><td className="px-3 py-1.5">{draft.application_mode}</td></tr>
                    )}
                    {draft.opening_date && (
                      <tr className="border-b"><td className="px-3 py-1.5 font-medium bg-muted/30">Opening Date</td><td className="px-3 py-1.5">{draft.opening_date}</td></tr>
                    )}
                    {draft.closing_date && (
                      <tr className="border-b"><td className="px-3 py-1.5 font-medium bg-muted/30">Closing Date</td><td className="px-3 py-1.5">{draft.closing_date}</td></tr>
                    )}
                    {draft.official_notification_link && (
                      <tr className="border-b"><td className="px-3 py-1.5 font-medium bg-muted/30">Notification</td><td className="px-3 py-1.5"><a href={draft.official_notification_link} target="_blank" rel="noopener noreferrer" className="text-primary underline truncate block max-w-xs">View Link</a></td></tr>
                    )}
                    {draft.official_apply_link && (
                      <tr><td className="px-3 py-1.5 font-medium bg-muted/30">Apply Link</td><td className="px-3 py-1.5"><a href={draft.official_apply_link} target="_blank" rel="noopener noreferrer" className="text-primary underline truncate block max-w-xs">Apply Now</a></td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* Summary */}
            {draft.summary && (
              <div className="bg-muted/30 rounded-lg p-4">
                <p className="text-xs font-medium text-muted-foreground mb-1">Summary</p>
                <p className="text-sm">{draft.summary}</p>
              </div>
            )}

            {/* Content preview — trusted internal HTML */}
            {draft.draft_content_html ? (
              <div
                className="prose prose-sm max-w-none dark:prose-invert border rounded-lg p-6"
                dangerouslySetInnerHTML={{ __html: draft.draft_content_html }}
              />
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                No content generated yet — this draft has metadata only.
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground">Draft not found</div>
        )}
      </DialogContent>
    </Dialog>
  );
}
