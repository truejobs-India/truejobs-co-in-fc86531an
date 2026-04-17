import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Layout } from '@/components/layout/Layout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { SEO } from '@/components/SEO';
import { AdPlaceholder } from '@/components/ads/AdPlaceholder';
import { supabase } from '@/integrations/supabase/client';
import { ChevronLeft, MapPin, Calendar, Users, IndianRupee, ExternalLink, Briefcase } from 'lucide-react';
import DOMPurify from 'dompurify';
import { JobAlertCTA } from '@/components/shared/JobAlertCTA';
import { QuickLinksBlock } from '@/components/govt/QuickLinksBlock';
import { GovtJobsCrossLink } from '@/pages/seo/components/GovtJobsCrossLink';

export default function EmploymentNewsJobDetail() {
  const { slug } = useParams<{ slug: string }>();

  const { data: job, isLoading, error } = useQuery({
    queryKey: ['emp-news-job', slug],
    queryFn: async () => {
      // Try slug first, fallback to id for un-enriched jobs
      let query = supabase
        .from('employment_news_jobs')
        .select('*')
        .eq('status', 'published');

      // If slug looks like a UUID, query by id
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slug!);
      if (isUuid) {
        query = query.eq('id', slug!);
      } else {
        query = query.eq('slug', slug!);
      }

      const { data, error } = await query.single();
      if (error) throw error;
      return data;
    },
    enabled: !!slug,
  });

  if (isLoading) {
    return (
      <Layout>
        <div className="container mx-auto py-8 px-4 max-w-4xl min-h-[500px]">
          <Skeleton className="h-6 w-40 mb-3" /> {/* breadcrumb */}
          <Skeleton className="h-[110px] w-full rounded mb-5" /> {/* banner ad space */}
          <Skeleton className="h-10 w-3/4 mb-4" /> {/* title */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            <Skeleton className="h-16 w-full rounded" />
            <Skeleton className="h-16 w-full rounded" />
            <Skeleton className="h-16 w-full rounded" />
            <Skeleton className="h-16 w-full rounded" />
          </div>
          <Skeleton className="h-64 w-full" />
        </div>
      </Layout>
    );
  }

  if (error || !job) {
    return (
      <Layout>
        <SEO title="Job Not Found" description="This job listing may have been removed." noindex={true} />
        <div className="container mx-auto py-16 text-center">
          <Briefcase className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
          <h1 className="text-2xl font-bold mb-2">Job Not Found</h1>
          <p className="text-muted-foreground mb-4">This job listing may have been removed or is not yet published.</p>
          <Link to="/jobs/employment-news">
            <Button variant="outline"><ChevronLeft className="h-4 w-4 mr-2" /> Back to Employment News Jobs</Button>
          </Link>
        </div>
      </Layout>
    );
  }

  const sanitizedHtml = job.enriched_description
    ? DOMPurify.sanitize(job.enriched_description)
    : null;

  const sanitizedFaqHtml = job.faq_html
    ? DOMPurify.sanitize(job.faq_html)
    : null;

  const pageTitle = job.meta_title || job.enriched_title || `${job.post} – ${job.org_name}`;
  const pageDescription = job.meta_description || job.description?.slice(0, 155) || `${job.post} vacancy at ${job.org_name}. Apply now.`;
  const canonicalPath = `/jobs/employment-news/${job.slug || job.id}`;

  return (
    <Layout>
      <SEO
        title={pageTitle}
        description={pageDescription}
        canonical={`https://truejobs.co.in${canonicalPath}`}
        structuredData={job.schema_markup ? (job.schema_markup as unknown as object) : undefined}
      />
      <div className="container mx-auto py-8 px-4">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
        <div className="content-area my-8">
        {/* Breadcrumb */}
        {job.job_category === 'Notification' ? (
          <Link to="/notifications" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4">
            <ChevronLeft className="h-4 w-4 mr-1" /> Back to Notifications
          </Link>
        ) : (
          <Link to="/jobs/employment-news" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4">
            <ChevronLeft className="h-4 w-4 mr-1" /> Back to Employment News Jobs
          </Link>
        )}

        <AdPlaceholder variant="banner" />

        <Card>
          <CardContent className="p-6 sm:p-8">
            {/* Header */}
            <p className="text-sm font-semibold text-primary">{job.org_name}</p>
            <h1 className="text-2xl sm:text-3xl font-bold mt-1">
              {job.enriched_title || job.post}
            </h1>

            <div className="flex flex-wrap gap-2 mt-3">
              {job.vacancies && (
                <Badge variant="secondary"><Users className="h-3 w-3 mr-1" /> {job.vacancies} Vacancies</Badge>
              )}
              {job.job_type && <Badge variant="outline" className="capitalize">{job.job_type}</Badge>}
              {job.job_category && <Badge variant="outline">{job.job_category}</Badge>}
              {job.location && (
                <Badge variant="outline"><MapPin className="h-3 w-3 mr-1" /> {job.location}</Badge>
              )}
              {job.state && <Badge variant="outline">{job.state}</Badge>}
            </div>

            {/* Key Info Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-6 p-4 bg-muted rounded-lg">
              {job.salary && (
                <div>
                  <p className="text-xs text-muted-foreground">Salary</p>
                  <p className="text-sm font-medium flex items-center gap-1"><IndianRupee className="h-3 w-3" /> {job.salary}</p>
                </div>
              )}
              {job.qualification && (
                <div>
                  <p className="text-xs text-muted-foreground">Qualification</p>
                  <p className="text-sm font-medium">{job.qualification}</p>
                </div>
              )}
              {job.age_limit && (
                <div>
                  <p className="text-xs text-muted-foreground">Age Limit</p>
                  <p className="text-sm font-medium">{job.age_limit}</p>
                </div>
              )}
              {job.application_mode && (
                <div>
                  <p className="text-xs text-muted-foreground">Application Mode</p>
                  <p className="text-sm font-medium capitalize">{job.application_mode}</p>
                </div>
              )}
              {job.last_date && (
                <div>
                  <p className="text-xs text-muted-foreground">Last Date</p>
                  <p className="text-sm font-medium flex items-center gap-1">
                    <Calendar className="h-3 w-3" /> {job.last_date}
                  </p>
                </div>
              )}
              {job.experience_required && (
                <div>
                  <p className="text-xs text-muted-foreground">Experience</p>
                  <p className="text-sm font-medium">{job.experience_required}</p>
                </div>
              )}
              {job.advertisement_number && (
                <div>
                  <p className="text-xs text-muted-foreground">Advertisement No.</p>
                  <p className="text-sm font-medium">{job.advertisement_number}</p>
                </div>
              )}
              {job.notification_reference_number && (
                <div>
                  <p className="text-xs text-muted-foreground">Reference No.</p>
                  <p className="text-sm font-medium">{job.notification_reference_number}</p>
                </div>
              )}
            </div>

            {/* Keywords */}
            {job.keywords && job.keywords.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-4">
                {job.keywords.map((kw: string, i: number) => (
                  <Badge key={i} variant="secondary" className="text-xs font-normal">{kw}</Badge>
                ))}
              </div>
            )}

            {/* Description */}
            <div className="mt-8">
              {sanitizedHtml ? (
                <div
                  className="prose prose-sm max-w-none dark:prose-invert"
                  dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
                />
              ) : (
                <div>
                  <h2 className="text-lg font-bold mb-2">Job Description</h2>
                  <p className="text-sm whitespace-pre-wrap">{job.description}</p>
                </div>
              )}
            </div>

            <AdPlaceholder variant="in-content" />

            {/* FAQ Section */}
            {sanitizedFaqHtml && (
              <div className="mt-8 border-t pt-6">
                <h2 className="text-lg font-bold mb-4">Frequently Asked Questions</h2>
                <div
                  className="prose prose-sm max-w-none dark:prose-invert space-y-3"
                  dangerouslySetInnerHTML={{ __html: sanitizedFaqHtml }}
                />
              </div>
            )}

            {/* Apply / Official Links */}
            {(job.apply_link || (job as any).official_website) && (
              <div className="mt-8 flex flex-wrap gap-3">
                {job.apply_link && (
                  <a href={job.apply_link} target="_blank" rel="noopener noreferrer">
                    <Button size="lg" className="bg-orange-600 hover:bg-orange-700 text-white font-semibold">
                      <ExternalLink className="h-4 w-4 mr-2" />
                      {job.job_category === 'Notification' ? 'View Official Notice' : 'Apply Now on Official Site'}
                    </Button>
                  </a>
                )}
                {!job.apply_link && (job as any).official_website && (
                  <a href={(job as any).official_website} target="_blank" rel="noopener noreferrer">
                    <Button size="lg" className="bg-orange-600 hover:bg-orange-700 text-white font-semibold">
                      <ExternalLink className="h-4 w-4 mr-2" /> Apply Now on Official Site
                    </Button>
                  </a>
                )}
              </div>
            )}

            {/* Source */}
            <p className="text-xs text-muted-foreground mt-8">
              Published on TrueJobs
            </p>

            <JobAlertCTA variant="strong" context={job?.org_name || job?.post || 'Government Jobs'} className="mt-8" />
          </CardContent>
        </Card>

        <div className="mt-6">
          <QuickLinksBlock
            states={job.state ? [job.state] : undefined}
            qualificationRequired={job.qualification}
          />
          <GovtJobsCrossLink context={job.state ? `in ${job.state}` : undefined} />
        </div>
        </div>
        <aside className="hidden lg:block">
          <div className="sticky top-20">
            <AdPlaceholder variant="sidebar" />
          </div>
        </aside>
        </div>
      </div>
    </Layout>
  );
}
