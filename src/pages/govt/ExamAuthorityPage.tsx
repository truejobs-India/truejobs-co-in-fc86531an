import { useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Layout } from '@/components/layout/Layout';
import { SEO } from '@/components/SEO';
import NotFound from '@/pages/NotFound';
import { Skeleton } from '@/components/ui/skeleton';
import { LastUpdatedBadge } from '@/pages/seo/components/LastUpdatedBadge';
import { SEOContentSection } from '@/pages/seo/components/SEOContentSection';
import { FAQAccordion } from '@/pages/seo/components/FAQAccordion';
import { ExamDatesTable } from './components/ExamDatesTable';
import { ExamPatternTable } from './components/ExamPatternTable';
import { FeeTable } from './components/FeeTable';
import { SalaryDetails } from './components/SalaryDetails';
import { RelatedExamLinks } from './components/RelatedExamLinks';
import { JobAlertCTA } from '@/components/shared/JobAlertCTA';
import { AgeCalculatorCTA } from '@/components/govt/AgeCalculatorCTA';
import { AdPlaceholder } from '@/components/ads/AdPlaceholder';
import { EnrichedSection } from '@/components/govt/EnrichedSection';
import { useEnrichmentOverlay } from '@/hooks/useEnrichmentOverlay';
import { deduplicateFaqs, type FAQItem } from '@/lib/faqDedup';
import {
  buildBreadcrumbSchema,
  buildWebPageSchema,
  buildFAQSchema,
  buildItemListSchema,
  buildGovtJobPostingSchema,
} from '@/pages/seo/schemas/seoPageSchemas';
import type { ExamAuthorityConfig } from '@/data/examAuthority/types';
import { DEPARTMENT_OG_IMAGES, DEFAULT_OG_IMAGE } from '@/data/examAuthority/types';

export default function ExamAuthorityPage() {
  const { slug } = useParams<{ slug: string }>();
  const [config, setConfig] = useState<ExamAuthorityConfig | null | undefined>(undefined);

  useEffect(() => {
    if (!slug) { setConfig(null); return; }
    import('@/data/examAuthority').then(m => {
      setConfig(m.getExamAuthorityConfig(slug) ?? null);
    });
  }, [slug]);

  const { data: overlay } = useEnrichmentOverlay(slug);

  if (config === undefined) {
    return <Layout><div className="container mx-auto p-8"><Skeleton className="h-96 w-full" /></div></Layout>;
  }
  if (config === null) return <NotFound />;

  const ogImage = DEPARTMENT_OG_IMAGES[config.departmentSlug] || DEFAULT_OG_IMAGE;

  // Build schemas
  const schemas: object[] = [
    buildBreadcrumbSchema([
      { name: 'Home', url: '/' },
      { name: 'Govt Jobs', url: '/latest-govt-jobs' },
      { name: `${config.examName} ${config.examYear}`, url: `/${config.slug}` },
    ]),
    buildWebPageSchema({
      name: config.h1,
      url: `/${config.slug}`,
      description: config.metaDescription,
      datePublished: config.datePublished,
      dateModified: config.lastUpdated,
    }),
  ];

  if (config.faqs.length) {
    schemas.push(buildFAQSchema(config.faqs));
  }

  if (config.pageType === 'notification' && config.conductingBody) {
    schemas.push(buildGovtJobPostingSchema({
      title: config.h1,
      conductingBody: config.conductingBody,
      datePublished: config.datePublished,
      dateModified: config.lastUpdated,
      validThrough: config.applicationEndDate,
      salaryMin: config.salary?.salaryMin,
      salaryMax: config.salary?.salaryMax,
      slug: config.slug,
      totalVacancies: config.totalVacancies,
      description: config.metaDescription,
    }));
  }

  if ((config.pageType === 'syllabus' || config.pageType === 'cutoff') && config.relatedExams?.length) {
    schemas.push(buildItemListSchema(
      `${config.examName} Related Resources`,
      `/${config.slug}`,
      config.relatedExams.map(e => ({ name: e.label, url: e.href })),
    ));
  }

  if (config.pageType === 'salary' && config.salary?.allowances?.length) {
    schemas.push(buildItemListSchema(
      `${config.examName} Salary Allowances & Benefits`,
      `/${config.slug}`,
      config.salary.allowances.map(a => ({ name: a, url: `/${config.slug}` })),
    ));
  }

  const isCutoffPage = config.pageType === 'cutoff';
  const isAgeLimitPage = config.pageType === 'age-limit';

  return (
    <Layout>
      <SEO
        title={config.metaTitle}
        description={config.metaDescription}
        url={`/${config.slug}`}
        image={ogImage}
        type="article"
        publishedTime={config.datePublished}
        modifiedTime={config.lastUpdated}
        structuredData={schemas}
        noindex={false}
      />

      <div className="container mx-auto px-4 py-8 my-8">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-8">
        <article className="content-area min-w-0">
        <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-3">{config.h1}</h1>

        <div className="flex flex-wrap gap-2 mb-6">
          <LastUpdatedBadge date={config.lastUpdated} applicationEndDate={config.applicationEndDate} />
        </div>

        {/* Overview */}
        <SEOContentSection htmlContent={config.overview} />

        <AdPlaceholder variant="banner" />

        {/* Cutoff Table — shown prominently on cutoff pages, and also on notification pages */}
        {isCutoffPage && config.cutoffs && config.cutoffs.length > 0 && (
          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-foreground mb-4">
              {config.examName} Cutoff Marks — Category-Wise
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-muted">
                    <th className="border border-border px-3 py-2 text-left text-foreground">Year</th>
                    <th className="border border-border px-3 py-2 text-left text-foreground">Category</th>
                    <th className="border border-border px-3 py-2 text-left text-foreground">Cutoff Score</th>
                    <th className="border border-border px-3 py-2 text-left text-foreground">Total Marks</th>
                  </tr>
                </thead>
                <tbody>
                  {config.cutoffs.map((c, i) => (
                    <tr key={i} className={i % 2 === 0 ? 'bg-background' : 'bg-muted/50'}>
                      <td className="border border-border px-3 py-2 text-muted-foreground">{c.year}</td>
                      <td className="border border-border px-3 py-2 text-muted-foreground">{c.category}</td>
                      <td className="border border-border px-3 py-2 text-muted-foreground font-medium">{c.cutoffScore}</td>
                      <td className="border border-border px-3 py-2 text-muted-foreground">{c.totalMarks || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Age Limit — shown prominently on age-limit pages */}
        {isAgeLimitPage && config.eligibility && (
          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-foreground mb-4">
              {config.examName} Age Limit — Detailed Breakdown
            </h2>
            <div
              className="prose prose-neutral max-w-none text-muted-foreground [&_h3]:text-foreground [&_strong]:text-foreground [&_a]:text-primary"
              dangerouslySetInnerHTML={{ __html: config.eligibility }}
            />
            <AgeCalculatorCTA examName={config.examName} />
          </section>
        )}

        {/* Important Dates */}
        {config.dates && config.dates.length > 0 && (
          <ExamDatesTable dates={config.dates} examName={`${config.examName} ${config.examYear}`} />
        )}

        {/* Eligibility (not shown on age-limit pages, already shown above) */}
        {config.eligibility && !isAgeLimitPage && (
          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-foreground mb-4">
              {config.examName} Eligibility Criteria
            </h2>
            <div
              className="prose prose-neutral max-w-none text-muted-foreground [&_h3]:text-foreground [&_strong]:text-foreground [&_a]:text-primary"
              dangerouslySetInnerHTML={{ __html: config.eligibility }}
            />
            {(config.pageType === 'eligibility' || config.pageType === 'notification') && (
              <AgeCalculatorCTA examName={config.examName} />
            )}
          </section>
        )}

        {/* Application Fee */}
        {config.feeStructure && (
          <FeeTable fee={config.feeStructure} examName={`${config.examName} ${config.examYear}`} />
        )}

        {/* Selection Process */}
        {config.selectionProcess && config.selectionProcess.length > 0 && (
          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-foreground mb-4">
              {config.examName} Selection Process
            </h2>
            <ol className="list-decimal pl-6 space-y-2 text-muted-foreground">
              {config.selectionProcess.map((step, i) => (
                <li key={i}>{step}</li>
              ))}
            </ol>
          </section>
        )}

        {/* Exam Pattern */}
        {config.examPattern && config.examPattern.length > 0 && (
          <ExamPatternTable stages={config.examPattern} examName={`${config.examName} ${config.examYear}`} />
        )}

        {/* Syllabus */}
        {config.syllabusSummary && (
          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-foreground mb-4">
              {config.examName} Syllabus Overview
            </h2>
            <div
              className="prose prose-neutral max-w-none text-muted-foreground [&_h3]:text-foreground [&_strong]:text-foreground [&_a]:text-primary"
              dangerouslySetInnerHTML={{ __html: config.syllabusSummary }}
            />
          </section>
        )}

        {/* Salary */}
        {config.salary && (
          <SalaryDetails salary={config.salary} examName={`${config.examName} ${config.examYear}`} />
        )}

        {/* How to Apply */}
        {config.howToApply && config.howToApply.length > 0 && (
          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-foreground mb-4">
              How to Apply for {config.examName} {config.examYear}
            </h2>
            <ol className="list-decimal pl-6 space-y-3 text-muted-foreground">
              {config.howToApply.map((step, i) => (
                <li key={i}>{step}</li>
              ))}
            </ol>
            {config.applyLink && (
              <p className="mt-4">
                <a
                  href={config.applyLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary font-medium hover:underline"
                >
                  → Apply Online at {config.officialWebsite || 'Official Website'}
                </a>
              </p>
            )}
          </section>
        )}

        {/* Admit Card Info */}
        {config.admitCardInfo && (
          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-foreground mb-4">
              {config.examName} {config.examYear} Admit Card
            </h2>
            <div className="space-y-2 text-muted-foreground">
              {config.admitCardInfo.releaseDate && (
                <p><strong className="text-foreground">Release Date:</strong> {config.admitCardInfo.releaseDate}</p>
              )}
              {config.admitCardInfo.downloadUrl && (
                <p>
                  <a href={config.admitCardInfo.downloadUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                    → Download Admit Card
                  </a>
                </p>
              )}
              {config.admitCardInfo.instructions && config.admitCardInfo.instructions.length > 0 && (
                <ul className="list-disc pl-6 space-y-1">
                  {config.admitCardInfo.instructions.map((inst, i) => <li key={i}>{inst}</li>)}
                </ul>
              )}
            </div>
          </section>
        )}

        {/* Previous Year Cutoffs (on notification pages) */}
        {!isCutoffPage && config.cutoffs && config.cutoffs.length > 0 && (
          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-foreground mb-4">
              {config.examName} Previous Year Cutoff Marks
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-muted">
                    <th className="border border-border px-3 py-2 text-left text-foreground">Year</th>
                    <th className="border border-border px-3 py-2 text-left text-foreground">Category</th>
                    <th className="border border-border px-3 py-2 text-left text-foreground">Cutoff Score</th>
                    <th className="border border-border px-3 py-2 text-left text-foreground">Total Marks</th>
                  </tr>
                </thead>
                <tbody>
                  {config.cutoffs.map((c, i) => (
                    <tr key={i} className={i % 2 === 0 ? 'bg-background' : 'bg-muted/50'}>
                      <td className="border border-border px-3 py-2 text-muted-foreground">{c.year}</td>
                      <td className="border border-border px-3 py-2 text-muted-foreground">{c.category}</td>
                      <td className="border border-border px-3 py-2 text-muted-foreground">{c.cutoffScore}</td>
                      <td className="border border-border px-3 py-2 text-muted-foreground">{c.totalMarks || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Result / Merit List */}
        {config.resultInfo && (
          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-foreground mb-4">
              {config.examName} {config.examYear} Result
            </h2>
            <div className="space-y-2 text-muted-foreground">
              {config.resultInfo.resultDate && (
                <p><strong className="text-foreground">Result Date:</strong> {config.resultInfo.resultDate}</p>
              )}
              {config.resultInfo.resultUrl && (
                <p>
                  <a href={config.resultInfo.resultUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                    → Check Result
                  </a>
                </p>
              )}
              {config.resultInfo.meritListUrl && (
                <p>
                  <a href={config.resultInfo.meritListUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                    → Download Merit List
                  </a>
                </p>
              )}
              {config.resultInfo.nextSteps && config.resultInfo.nextSteps.length > 0 && (
                <div>
                  <p className="font-medium text-foreground mt-3 mb-1">Next Steps After Result:</p>
                  <ol className="list-decimal pl-6 space-y-1">
                    {config.resultInfo.nextSteps.map((step, i) => <li key={i}>{step}</li>)}
                  </ol>
                </div>
              )}
            </div>
          </section>
        )}

        <AdPlaceholder variant="in-content" />

        {/* FAQ — merge static + enrichment FAQs */}
        {(() => {
          const staticFaqs: FAQItem[] = config.faqs;
          const enrichmentFaqs: FAQItem[] = overlay?.enrichment_data?.faq
            ? (overlay.enrichment_data.faq as FAQItem[])
            : [];
          const mergedFaqs = deduplicateFaqs(staticFaqs, enrichmentFaqs);
          return mergedFaqs.length > 0 ? (
            <FAQAccordion items={mergedFaqs} title={`${config.examName} ${config.examYear} – FAQs`} />
          ) : null;
        })()}

        {/* Supplemental enrichment sections */}
        {overlay && (() => {
          const skipKeys = new Set(['overview', 'eligibility', 'salary', 'selectionProcess', 'howToApply', 'faq']);
          const entries = Object.entries(overlay.enrichment_data).filter(([k]) => !skipKeys.has(k));
          return entries.map(([key, value]) => (
            <EnrichedSection
              key={key}
              title={key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())}
              content={String(value)}
              type={typeof value === 'string' && value.includes('<') ? 'html' : 'text'}
            />
          ));
        })()}

        {/* Related Links */}
        <JobAlertCTA variant="compact" context={config.examName} className="mb-6" />
        <RelatedExamLinks
          relatedExams={config.relatedExams}
          departmentSlug={config.departmentSlug}
        />
      </article>
        <aside className="hidden lg:block">
          <div className="sticky top-24">
            <AdPlaceholder variant="sidebar" />
          </div>
        </aside>
        </div>
      </div>
    </Layout>
  );
}
