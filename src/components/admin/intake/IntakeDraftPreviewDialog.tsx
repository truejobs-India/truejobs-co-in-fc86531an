/**
 * IntakeDraftPreviewDialog — Renders draft content as it will appear to end users.
 * Adapts layout based on publish_target (jobs vs exams/results/admit-cards).
 */
import { useState, useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Loader2, MapPin, Calendar, Users, IndianRupee, ExternalLink, ChevronDown, Eye, GraduationCap } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface Props {
  draftId: string | null;
  open: boolean;
  onClose: () => void;
}

const SELECT_FIELDS = 'normalized_title, raw_title, draft_content_html, summary, seo_title, meta_description, slug, content_type, publish_target, organisation_name, post_name, closing_date, opening_date, qualification_text, salary_text, age_limit_text, vacancy_count, application_mode, job_location, exam_name, official_notification_link, official_apply_link';

export function IntakeDraftPreviewDialog({ draftId, open, onClose }: Props) {
  const [draft, setDraft] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!draftId || !open) { setDraft(null); return; }
    setLoading(true);
    supabase
      .from('intake_drafts')
      .select(SELECT_FIELDS)
      .eq('id', draftId)
      .single()
      .then(({ data }) => { setDraft(data); setLoading(false); });
  }, [draftId, open]);

  if (!open) return null;

  const isJob = draft?.publish_target === 'jobs' || draft?.content_type === 'job';
  const isExam = ['exams', 'results', 'admit_cards', 'answer_keys'].includes(draft?.publish_target) ||
    ['exam', 'result', 'admit_card', 'answer_key'].includes(draft?.content_type);

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-0">
        {/* Preview banner */}
        <div className="bg-primary/10 border-b px-6 py-2 flex items-center gap-2 text-xs text-primary font-medium sticky top-0 z-10">
          <Eye className="h-3.5 w-3.5" /> Preview Mode — This is how the draft will appear to users
          {draft?.publish_target && <Badge variant="outline" className="ml-auto text-[10px]">{draft.publish_target}</Badge>}
        </div>

        <div className="px-6 pb-6 pt-3 space-y-4">
          {loading ? (
            <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : !draft ? (
            <div className="text-center py-16 text-muted-foreground">Draft not found</div>
          ) : (
            <>
              {/* Collapsible SEO block (admin-only) */}
              <SeoBlock draft={draft} />

              {/* Render based on target */}
              {isJob ? <JobPreview draft={draft} /> : isExam ? <ExamPreview draft={draft} /> : <FallbackPreview draft={draft} />}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ─── SEO Meta (collapsible, admin-only) ─── */
function SeoBlock({ draft }: { draft: any }) {
  const title = draft.normalized_title || draft.raw_title || 'Untitled';
  return (
    <Collapsible>
      <CollapsibleTrigger className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground w-full">
        <ChevronDown className="h-3 w-3" /> SEO Meta
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="bg-muted/50 rounded-lg p-3 space-y-1 mt-1.5 text-sm">
          <p className="text-blue-600 font-medium truncate">{draft.seo_title || title}</p>
          {draft.slug && <p className="text-green-700 text-xs">/{draft.slug}</p>}
          <p className="text-muted-foreground text-xs">{draft.meta_description || 'No meta description'}</p>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

/* ─── Info row helper ─── */
function InfoItem({ label, value, icon: Icon }: { label: string; value: string | number; icon?: any }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium flex items-center gap-1">
        {Icon && <Icon className="h-3 w-3" />} {value}
      </p>
    </div>
  );
}

/* ─── Jobs Preview (mirrors EmploymentNewsJobDetail) ─── */
function JobPreview({ draft }: { draft: any }) {
  const title = draft.normalized_title || draft.raw_title || 'Untitled';
  return (
    <Card>
      <CardContent className="p-6 sm:p-8">
        {draft.organisation_name && (
          <p className="text-sm font-semibold text-primary">{draft.organisation_name}</p>
        )}
        <h1 className="text-2xl sm:text-3xl font-bold mt-1">{title}</h1>

        {/* Badges */}
        <div className="flex flex-wrap gap-2 mt-3">
          {draft.vacancy_count && <Badge variant="secondary"><Users className="h-3 w-3 mr-1" /> {draft.vacancy_count} Vacancies</Badge>}
          {draft.application_mode && <Badge variant="outline" className="capitalize">{draft.application_mode}</Badge>}
          {draft.job_location && <Badge variant="outline"><MapPin className="h-3 w-3 mr-1" /> {draft.job_location}</Badge>}
        </div>

        {/* Info grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-6 p-4 bg-muted rounded-lg">
          {draft.salary_text && <InfoItem label="Salary" value={draft.salary_text} icon={IndianRupee} />}
          {draft.qualification_text && <InfoItem label="Qualification" value={draft.qualification_text} />}
          {draft.age_limit_text && <InfoItem label="Age Limit" value={draft.age_limit_text} />}
          {draft.application_mode && <InfoItem label="Application Mode" value={draft.application_mode} />}
          {draft.opening_date && <InfoItem label="Opening Date" value={draft.opening_date} icon={Calendar} />}
          {draft.closing_date && <InfoItem label="Last Date" value={draft.closing_date} icon={Calendar} />}
        </div>

        {/* Summary */}
        {draft.summary && (
          <div className="mt-6 bg-muted/30 rounded-lg p-4">
            <p className="text-xs font-medium text-muted-foreground mb-1">Summary</p>
            <p className="text-sm">{draft.summary}</p>
          </div>
        )}

        {/* Content */}
        <ContentBlock html={draft.draft_content_html} />

        {/* Official links */}
        <LinksBlock draft={draft} />
      </CardContent>
    </Card>
  );
}

/* ─── Exam Preview (mirrors GovtExamDetail) ─── */
function ExamPreview({ draft }: { draft: any }) {
  const title = draft.exam_name || draft.normalized_title || draft.raw_title || 'Untitled';
  return (
    <Card>
      <CardContent className="p-6 sm:p-8">
        {draft.organisation_name && (
          <p className="text-sm font-semibold text-primary flex items-center gap-1.5">
            <GraduationCap className="h-4 w-4" /> {draft.organisation_name}
          </p>
        )}
        <h1 className="text-2xl sm:text-3xl font-bold mt-1">{title}</h1>

        {draft.post_name && (
          <p className="text-sm text-muted-foreground mt-1">Post: {draft.post_name}</p>
        )}

        {/* Badges */}
        <div className="flex flex-wrap gap-2 mt-3">
          {draft.content_type && <Badge variant="secondary" className="capitalize">{draft.content_type.replace(/_/g, ' ')}</Badge>}
          {draft.publish_target && <Badge variant="outline" className="capitalize">{draft.publish_target.replace(/_/g, ' ')}</Badge>}
          {draft.job_location && <Badge variant="outline"><MapPin className="h-3 w-3 mr-1" /> {draft.job_location}</Badge>}
        </div>

        {/* Info grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-6 p-4 bg-muted rounded-lg">
          {draft.vacancy_count && <InfoItem label="Vacancies" value={draft.vacancy_count} icon={Users} />}
          {draft.salary_text && <InfoItem label="Salary" value={draft.salary_text} icon={IndianRupee} />}
          {draft.qualification_text && <InfoItem label="Qualification" value={draft.qualification_text} />}
          {draft.age_limit_text && <InfoItem label="Age Limit" value={draft.age_limit_text} />}
          {draft.closing_date && <InfoItem label="Last Date" value={draft.closing_date} icon={Calendar} />}
          {draft.opening_date && <InfoItem label="Start Date" value={draft.opening_date} icon={Calendar} />}
        </div>

        {/* Summary */}
        {draft.summary && (
          <div className="mt-6 bg-muted/30 rounded-lg p-4">
            <p className="text-xs font-medium text-muted-foreground mb-1">Summary</p>
            <p className="text-sm">{draft.summary}</p>
          </div>
        )}

        {/* Content */}
        <ContentBlock html={draft.draft_content_html} />

        {/* Official links */}
        <LinksBlock draft={draft} />
      </CardContent>
    </Card>
  );
}

/* ─── Fallback Preview (generic) ─── */
function FallbackPreview({ draft }: { draft: any }) {
  const title = draft.normalized_title || draft.raw_title || 'Untitled';
  return (
    <Card>
      <CardContent className="p-6">
        <h1 className="text-xl font-bold">{title}</h1>
        {draft.organisation_name && <p className="text-sm text-muted-foreground mt-1">{draft.organisation_name}</p>}

        {draft.summary && (
          <div className="mt-4 bg-muted/30 rounded-lg p-4">
            <p className="text-sm">{draft.summary}</p>
          </div>
        )}

        <ContentBlock html={draft.draft_content_html} />
        <LinksBlock draft={draft} />
      </CardContent>
    </Card>
  );
}

/* ─── Shared: Content HTML block ─── */
function ContentBlock({ html }: { html: string | null }) {
  if (!html) {
    return (
      <div className="text-center py-12 text-muted-foreground mt-6">
        No content generated yet — this draft has metadata only.
      </div>
    );
  }
  return (
    <div className="mt-8">
      <div
        className="prose prose-sm max-w-none dark:prose-invert"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}

/* ─── Shared: Official links ─── */
function LinksBlock({ draft }: { draft: any }) {
  if (!draft.official_apply_link && !draft.official_notification_link) return null;
  return (
    <div className="mt-8 flex flex-wrap gap-3">
      {draft.official_apply_link && (
        <a href={draft.official_apply_link} target="_blank" rel="noopener noreferrer">
          <Button size="lg"><ExternalLink className="h-4 w-4 mr-2" /> Apply Now</Button>
        </a>
      )}
      {draft.official_notification_link && (
        <a href={draft.official_notification_link} target="_blank" rel="noopener noreferrer">
          <Button size="lg" variant="outline"><ExternalLink className="h-4 w-4 mr-2" /> Official Notification</Button>
        </a>
      )}
    </div>
  );
}
