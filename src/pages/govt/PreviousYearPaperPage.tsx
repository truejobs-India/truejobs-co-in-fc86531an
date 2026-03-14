import { useParams, Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Layout } from '@/components/layout/Layout';
import { SEO } from '@/components/SEO';
import NotFound from '@/pages/NotFound';
import { Skeleton } from '@/components/ui/skeleton';
import { LastUpdatedBadge } from '@/pages/seo/components/LastUpdatedBadge';
import { SEOContentSection } from '@/pages/seo/components/SEOContentSection';
import { FAQAccordion } from '@/pages/seo/components/FAQAccordion';
import { RelatedExamLinks } from './components/RelatedExamLinks';
import { EnrichedSection } from '@/components/govt/EnrichedSection';
import { useEnrichmentOverlay } from '@/hooks/useEnrichmentOverlay';
import { deduplicateFaqs, type FAQItem } from '@/lib/faqDedup';

import {
  buildBreadcrumbSchema,
  buildWebPageSchema,
  buildFAQSchema,
  buildItemListSchema,
} from '@/pages/seo/schemas/seoPageSchemas';
import type { PreviousYearPaperConfig } from '@/data/previousYearPapers/types';
import { DEPARTMENT_OG_IMAGES, DEFAULT_OG_IMAGE } from '@/data/examAuthority/types';

export default function PreviousYearPaperPage() {
  const { slug } = useParams<{ slug: string }>();
  const [config, setConfig] = useState<PreviousYearPaperConfig | null | undefined>(undefined);

  useEffect(() => {
    if (!slug) { setConfig(null); return; }
    import('@/data/previousYearPapers').then(m => {
      setConfig(m.getPYPConfig(slug) ?? null);
    });
  }, [slug]);

  const { data: overlay } = useEnrichmentOverlay(slug);

  if (config === undefined) {
    return <Layout><div className="container mx-auto p-8"><Skeleton className="h-96 w-full" /></div></Layout>;
  }
  if (config === null) return <NotFound />;

  const ogImage = DEPARTMENT_OG_IMAGES[config.departmentSlug] || DEFAULT_OG_IMAGE;

  const deptLabel = config.departmentSlug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  const schemas: object[] = [
    buildBreadcrumbSchema([
      { name: 'Home', url: '/' },
      { name: 'Govt Jobs', url: '/latest-govt-jobs' },
      { name: deptLabel, url: `/${config.departmentSlug}` },
      { name: `${config.examName} Previous Year Papers`, url: `/${config.slug}` },
    ]),
    buildWebPageSchema({
      name: config.h1,
      url: `/${config.slug}`,
      description: config.metaDescription,
      datePublished: config.lastUpdated,
      dateModified: config.lastUpdated,
    }),
    buildItemListSchema(
      `${config.examName} Previous Year Papers`,
      `/${config.slug}`,
      config.papers.map(p => ({
        name: `${config.examName} ${p.year}${p.tier ? ` – ${p.tier}` : ''} Question Paper`,
        url: `/${config.slug}`,
      })),
    ),
  ];

  if (config.faqs.length) {
    schemas.push(buildFAQSchema(config.faqs));
  }

  return (
    <Layout>
      <SEO
        title={config.metaTitle}
        description={config.metaDescription}
        url={`/${config.slug}`}
        image={ogImage}
        type="article"
        modifiedTime={config.lastUpdated}
        structuredData={schemas}
        noindex={false}
      />

      <article className="container mx-auto px-4 py-8 max-w-4xl content-area my-8">
        <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-3">{config.h1}</h1>

        <div className="flex flex-wrap gap-2 mb-6">
          <LastUpdatedBadge date={config.lastUpdated} />
        </div>

        {/* Overview */}
        <SEOContentSection htmlContent={config.overview} />

        {/* Papers Table */}
        <section className="mb-10">
          <h2 className="text-2xl font-semibold text-foreground mb-4">
            {config.examName} Question Papers – Year Wise
          </h2>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted">
                  <th className="px-4 py-3 text-left font-semibold text-foreground">Year</th>
                  <th className="px-4 py-3 text-left font-semibold text-foreground">Tier / Set</th>
                  <th className="px-4 py-3 text-left font-semibold text-foreground">Download Paper</th>
                  <th className="px-4 py-3 text-left font-semibold text-foreground">Answer Key</th>
                </tr>
              </thead>
              <tbody>
                {config.papers.map((paper, i) => (
                  <tr key={i} className="border-t">
                    <td className="px-4 py-3 text-foreground font-medium">{paper.year}</td>
                    <td className="px-4 py-3 text-muted-foreground">{paper.tier || '—'}</td>
                    <td className="px-4 py-3">
                      {paper.downloadUrl === '#' ? (
                        <span className="text-muted-foreground/60 italic">Coming Soon</span>
                      ) : (
                        <a href={paper.downloadUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-medium">
                          {paper.downloadLabel}
                        </a>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {!paper.answerKeyUrl || paper.answerKeyUrl === '#' ? (
                        <span className="text-muted-foreground/60 italic">Coming Soon</span>
                      ) : (
                        <a href={paper.answerKeyUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-medium">
                          Download
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Preparation Tips */}
        <section className="mb-10">
          <h2 className="text-2xl font-semibold text-foreground mb-4">How to Use Previous Year Papers</h2>
          <ul className="list-disc pl-6 space-y-3 text-muted-foreground">
            <li><strong className="text-foreground">Understand the exam pattern:</strong> Solve papers to get familiar with the question format, marking scheme, and difficulty level before your actual exam day.</li>
            <li><strong className="text-foreground">Identify important topics:</strong> Analyse which topics and chapters appear most frequently across multiple years to prioritise your preparation effectively.</li>
            <li><strong className="text-foreground">Improve time management:</strong> Attempt full papers under timed conditions to build speed and accuracy, simulating real exam pressure.</li>
            <li><strong className="text-foreground">Track your progress:</strong> Compare your scores across different papers to measure improvement and identify weak areas that need more revision.</li>
          </ul>
        </section>

        {/* FAQ */}
        {/* FAQ — merge static + enrichment */}
        {(() => {
          const staticFaqs: FAQItem[] = config.faqs;
          const enrichmentFaqs: FAQItem[] = overlay?.enrichment_data?.faq
            ? (overlay.enrichment_data.faq as FAQItem[])
            : [];
          const mergedFaqs = deduplicateFaqs(staticFaqs, enrichmentFaqs);
          return mergedFaqs.length > 0 ? (
            <FAQAccordion items={mergedFaqs} title={`${config.examName} Previous Year Papers – FAQs`} />
          ) : null;
        })()}

        {/* Supplemental enrichment sections */}
        {overlay && (() => {
          const skipKeys = new Set(['overview', 'faq']);
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

        {/* Calculator Links */}
        <div className="flex flex-wrap gap-4 mb-8">
          <Link to="/govt-job-age-calculator" className="text-sm text-primary hover:underline font-medium">
            🎂 Check Age Eligibility for {config.examName} →
          </Link>
          <Link to="/govt-salary-calculator" className="text-sm text-primary hover:underline font-medium">
            💰 Calculate Expected Salary →
          </Link>
        </div>

        {/* Related Exam Links */}
        <RelatedExamLinks
          relatedExams={config.relatedExams}
          departmentSlug={config.departmentSlug}
        />

        {/* Back to Hub */}
        <div className="mt-8 mb-4">
          <Link
            to={`/${config.hubSlug}`}
            className="text-primary font-medium hover:underline"
          >
            ← Back to {config.examName} Complete Guide
          </Link>
        </div>
      </article>
    </Layout>
  );
}
