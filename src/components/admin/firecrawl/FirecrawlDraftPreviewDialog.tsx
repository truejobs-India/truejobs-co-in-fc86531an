/**
 * Preview dialog for Firecrawl draft jobs — renders the job exactly as
 * it will appear to users on the Employment News Job Detail page.
 */
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { MapPin, Calendar, Users, IndianRupee, ExternalLink, Briefcase } from 'lucide-react';
import DOMPurify from 'dompurify';

export interface PreviewDraft {
  id: string;
  title: string | null;
  seo_title: string | null;
  organization_name: string | null;
  post_name: string | null;
  state: string | null;
  location: string | null;
  salary: string | null;
  qualification: string | null;
  age_limit: string | null;
  application_mode: string | null;
  last_date_of_application: string | null;
  total_vacancies: number | null;
  description_summary: string | null;
  intro_text: string | null;
  meta_description: string | null;
  cover_image_url: string | null;
  official_notification_url: string | null;
  official_apply_url: string | null;
  slug_suggestion: string | null;
  faq_suggestions: any | null;
  category: string | null;
  department: string | null;
  pay_scale: string | null;
  selection_process: string | null;
  source_name: string | null;
  closing_date: string | null;
  opening_date: string | null;
  exam_date: string | null;
  experience_required?: string | null;
  job_role: string | null;
  city: string | null;
}

interface Props {
  draft: PreviewDraft | null;
  open: boolean;
  onClose: () => void;
}

export function FirecrawlDraftPreviewDialog({ draft, open, onClose }: Props) {
  if (!draft) return null;

  const displayTitle = draft.seo_title || draft.title || 'Untitled Job';
  const lastDate = draft.last_date_of_application || draft.closing_date;

  // Build FAQ HTML from faq_suggestions JSON if available
  let faqHtml = '';
  if (draft.faq_suggestions) {
    try {
      const faqs = Array.isArray(draft.faq_suggestions) ? draft.faq_suggestions : [];
      if (faqs.length > 0) {
        faqHtml = faqs.map((faq: any) =>
          `<div class="mb-3"><h3 class="font-semibold text-sm">${faq.question || faq.q || ''}</h3><p class="text-sm text-muted-foreground">${faq.answer || faq.a || ''}</p></div>`
        ).join('');
      }
    } catch { /* ignore */ }
  }

  const sanitizedFaq = faqHtml ? DOMPurify.sanitize(faqHtml) : null;
  const sanitizedIntro = draft.intro_text ? DOMPurify.sanitize(draft.intro_text) : null;
  const sanitizedSummary = draft.description_summary ? DOMPurify.sanitize(draft.description_summary) : null;

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <Briefcase className="h-4 w-4" />
            Preview: How this job will appear to users
          </DialogTitle>
        </DialogHeader>

        {/* SEO Meta Preview */}
        <div className="bg-muted/50 rounded-lg p-3 space-y-1 text-sm">
          <p className="text-blue-600 font-medium truncate">{draft.seo_title || draft.title || 'No SEO title'}</p>
          <p className="text-green-700 text-xs">/jobs/employment-news/{draft.slug_suggestion || 'no-slug'}</p>
          <p className="text-muted-foreground text-xs">{draft.meta_description || 'No meta description'}</p>
        </div>

        {/* Job Card — mirrors EmploymentNewsJobDetail */}
        <Card>
          <CardContent className="p-6">
            {/* Cover Image */}
            {draft.cover_image_url && (
              <img
                src={draft.cover_image_url}
                alt={displayTitle}
                className="w-full h-48 object-cover rounded-lg mb-4"
              />
            )}

            {/* Header */}
            <p className="text-sm font-semibold text-primary">{draft.organization_name || '—'}</p>
            <h1 className="text-2xl font-bold mt-1">{displayTitle}</h1>

            <div className="flex flex-wrap gap-2 mt-3">
              {draft.total_vacancies && (
                <Badge variant="secondary"><Users className="h-3 w-3 mr-1" /> {draft.total_vacancies} Vacancies</Badge>
              )}
              {draft.category && <Badge variant="outline">{draft.category}</Badge>}
              {draft.department && <Badge variant="outline">{draft.department}</Badge>}
              {(draft.location || draft.city) && (
                <Badge variant="outline"><MapPin className="h-3 w-3 mr-1" /> {draft.city || draft.location}</Badge>
              )}
              {draft.state && <Badge variant="outline">{draft.state}</Badge>}
              {draft.job_role && <Badge variant="outline">{draft.job_role}</Badge>}
            </div>

            {/* Key Info Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-6 p-4 bg-muted rounded-lg">
              {(draft.salary || draft.pay_scale) && (
                <div>
                  <p className="text-xs text-muted-foreground">Salary / Pay Scale</p>
                  <p className="text-sm font-medium flex items-center gap-1"><IndianRupee className="h-3 w-3" /> {draft.salary || draft.pay_scale}</p>
                </div>
              )}
              {draft.qualification && (
                <div>
                  <p className="text-xs text-muted-foreground">Qualification</p>
                  <p className="text-sm font-medium">{draft.qualification}</p>
                </div>
              )}
              {draft.age_limit && (
                <div>
                  <p className="text-xs text-muted-foreground">Age Limit</p>
                  <p className="text-sm font-medium">{draft.age_limit}</p>
                </div>
              )}
              {draft.application_mode && (
                <div>
                  <p className="text-xs text-muted-foreground">Application Mode</p>
                  <p className="text-sm font-medium capitalize">{draft.application_mode}</p>
                </div>
              )}
              {lastDate && (
                <div>
                  <p className="text-xs text-muted-foreground">Last Date</p>
                  <p className="text-sm font-medium flex items-center gap-1">
                    <Calendar className="h-3 w-3" /> {lastDate}
                  </p>
                </div>
              )}
              {draft.opening_date && (
                <div>
                  <p className="text-xs text-muted-foreground">Opening Date</p>
                  <p className="text-sm font-medium">{draft.opening_date}</p>
                </div>
              )}
              {draft.exam_date && (
                <div>
                  <p className="text-xs text-muted-foreground">Exam Date</p>
                  <p className="text-sm font-medium">{draft.exam_date}</p>
                </div>
              )}
              {draft.selection_process && (
                <div className="col-span-2">
                  <p className="text-xs text-muted-foreground">Selection Process</p>
                  <p className="text-sm font-medium">{draft.selection_process}</p>
                </div>
              )}
            </div>

            {/* Description / Intro */}
            <div className="mt-6 space-y-4">
              {sanitizedIntro && (
                <div className="prose prose-sm max-w-none dark:prose-invert" dangerouslySetInnerHTML={{ __html: sanitizedIntro }} />
              )}
              {sanitizedSummary && (
                <div>
                  <h2 className="text-lg font-bold mb-2">Job Description</h2>
                  <div className="prose prose-sm max-w-none dark:prose-invert" dangerouslySetInnerHTML={{ __html: sanitizedSummary }} />
                </div>
              )}
              {!sanitizedIntro && !sanitizedSummary && (
                <p className="text-sm text-muted-foreground italic">No description content available yet.</p>
              )}
            </div>

            {/* FAQ Section */}
            {sanitizedFaq && (
              <div className="mt-8 border-t pt-6">
                <h2 className="text-lg font-bold mb-4">Frequently Asked Questions</h2>
                <div className="prose prose-sm max-w-none dark:prose-invert" dangerouslySetInnerHTML={{ __html: sanitizedFaq }} />
              </div>
            )}

            {/* Apply buttons */}
            <div className="flex flex-wrap gap-2 mt-8">
              {draft.official_apply_url && (
                <a href={draft.official_apply_url} target="_blank" rel="noopener noreferrer">
                  <Button size="lg"><ExternalLink className="h-4 w-4 mr-2" /> Apply Now</Button>
                </a>
              )}
              {draft.official_notification_url && (
                <a href={draft.official_notification_url} target="_blank" rel="noopener noreferrer">
                  <Button size="lg" variant="outline"><ExternalLink className="h-4 w-4 mr-2" /> Official Notification</Button>
                </a>
              )}
            </div>

            <p className="text-xs text-muted-foreground mt-8">
              Source: {draft.source_name || 'Firecrawl'} | Preview on TrueJobs
            </p>
          </CardContent>
        </Card>
      </DialogContent>
    </Dialog>
  );
}
