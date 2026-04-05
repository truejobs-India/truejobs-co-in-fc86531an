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
import { JobAlertCTA } from '@/components/shared/JobAlertCTA';
import { AdPlaceholder } from '@/components/ads/AdPlaceholder';

import {
  buildBreadcrumbSchema,
  buildWebPageSchema,
  buildFAQSchema,
  buildItemListSchema,
} from '@/pages/seo/schemas/seoPageSchemas';
import type { ExamHubConfig } from '@/data/examAuthority/hubs/types';
import { DEPARTMENT_OG_IMAGES, DEFAULT_OG_IMAGE } from '@/data/examAuthority/types';

export default function ExamClusterHub() {
  const { slug } = useParams<{ slug: string }>();
  const [config, setConfig] = useState<ExamHubConfig | null | undefined>(undefined);

  useEffect(() => {
    if (!slug) { setConfig(null); return; }
    import('@/data/examAuthority/hubs').then(m => {
      setConfig(m.getHubConfig(slug) ?? null);
    });
  }, [slug]);

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
      { name: config.examName, url: `/${config.slug}` },
    ]),
    buildWebPageSchema({
      name: config.h1,
      url: `/${config.slug}`,
      description: config.metaDescription,
      datePublished: config.lastUpdated,
      dateModified: config.lastUpdated,
    }),
    buildItemListSchema(
      `${config.examName} Resources`,
      `/${config.slug}`,
      config.subtopicPages.map(p => ({ name: p.label, url: p.href })),
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

      <div className="container mx-auto px-4 py-8 my-8">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-8">
        <article className="content-area min-w-0">
        <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-3">{config.h1}</h1>

        <div className="flex flex-wrap gap-2 mb-6">
          <LastUpdatedBadge date={config.lastUpdated} />
        </div>

        {/* Intro */}
        <SEOContentSection htmlContent={config.intro} />

        <AdPlaceholder variant="banner" />

        {/* Subtopic Pages Grid */}
        <section className="mb-10">
          <h2 className="text-2xl font-semibold text-foreground mb-4">
            {config.examName} – Complete Resource Guide
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {config.subtopicPages.map((page, i) => (
              <Link
                key={i}
                to={page.href}
                className="rounded-lg border bg-card p-4 hover:bg-accent transition-colors group"
              >
                <h3 className="text-base font-semibold text-primary group-hover:underline mb-1">
                  {page.label}
                </h3>
                <p className="text-sm text-muted-foreground">{page.description}</p>
              </Link>
            ))}
          </div>
        </section>

        <AdPlaceholder variant="in-content" />

        {/* FAQ */}
        {config.faqs.length > 0 && (
          <FAQAccordion items={config.faqs} title={`${config.examName} – Frequently Asked Questions`} />
        )}

        {/* Calculator Links */}
        <div className="flex flex-wrap gap-4 mb-8">
          <Link to="/govt-salary-calculator" className="text-sm text-primary hover:underline font-medium">
            💰 Calculate {config.examName} Salary →
          </Link>
          <Link to="/govt-job-age-calculator" className="text-sm text-primary hover:underline font-medium">
            🎂 Check Age Eligibility →
          </Link>
        </div>

        {/* Related Hubs */}
        {config.relatedHubs.length > 0 && (
          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-foreground mb-4">Explore Other Exam Guides</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {config.relatedHubs.map((hub, i) => (
                <Link
                  key={i}
                  to={hub.href}
                  className="rounded-lg border bg-card px-4 py-3 text-sm font-medium text-primary hover:bg-accent transition-colors"
                >
                  {hub.label}
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Related Exam Links */}
        <JobAlertCTA variant="banner" context={config.examName} className="mb-6" />
        <RelatedExamLinks departmentSlug={config.departmentSlug} />
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
