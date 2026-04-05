import { Navigate, useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { Briefcase, TrendingUp, IndianRupee, Zap } from 'lucide-react';
import { getCategoryJobConfig } from './categoryJobsData';
import { getCityJobConfig } from './cityJobsData';
import { getIndustryJobConfig } from './industryJobsData';
import { buildBreadcrumbSchema, buildFAQSchema } from './schemas/seoPageSchemas';
import { FAQAccordion } from './components/FAQAccordion';
import { JobAlertCTA } from '@/components/shared/JobAlertCTA';
import { SEOContentSection } from './components/SEOContentSection';
import { AdPlaceholder } from '@/components/ads/AdPlaceholder';
import { LiveJobListings } from './components/LiveJobListings';
import { RelatedCities } from './components/RelatedCities';
import { PopularSearches } from './components/PopularSearches';
import { ExploreRelatedSection } from './components/ExploreRelatedSection';
import { GovtJobsCrossLink } from './components/GovtJobsCrossLink';

const SITE_URL = 'https://truejobs.co.in';

export default function CategoryJobsPage() {
  const { slug } = useParams<{ slug: string }>();
  const config = slug ? getCategoryJobConfig(slug) : undefined;

  if (!config) return <Navigate to="/404" replace />;

  const breadcrumbSchema = buildBreadcrumbSchema([
    { name: 'Home', url: '/' },
    { name: 'Jobs', url: '/jobs' },
    { name: `${config.category} Jobs`, url: `/${config.slug}` },
  ]);
  const faqSchema = buildFAQSchema(config.faqItems);

  const topCityLinks = config.topCities
    .map(s => {
      const c = getCityJobConfig(s);
      return c ? { name: c.city, slug: c.slug } : null;
    })
    .filter(Boolean) as { name: string; slug: string }[];

  return (
    <Layout>
      <Helmet>
        <title>{config.metaTitle} | TrueJobs</title>
        <meta name="description" content={config.metaDescription} />
        <link rel="canonical" href={`${SITE_URL}/${config.slug}`} />
        <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />
        <meta property="og:title" content={`${config.metaTitle} | TrueJobs`} />
        <meta property="og:description" content={config.metaDescription} />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={`${SITE_URL}/${config.slug}`} />
        <meta property="og:image" content={`${SITE_URL}/og-image.png`} />
        <script type="application/ld+json">{JSON.stringify(breadcrumbSchema)}</script>
        <script type="application/ld+json">{JSON.stringify(faqSchema)}</script>
      </Helmet>

      <div className="container mx-auto px-4 py-8 md:py-12">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
        <main>
        <nav aria-label="Breadcrumb" className="mb-6 text-sm text-muted-foreground">
          <ol className="flex items-center gap-1.5 flex-wrap">
            <li><Link to="/" className="hover:text-foreground transition-colors">Home</Link></li>
            <li>/</li>
            <li><Link to="/jobs" className="hover:text-foreground transition-colors">Jobs</Link></li>
            <li>/</li>
            <li className="text-foreground font-medium">{config.category} Jobs</li>
          </ol>
        </nav>

        <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4 leading-tight">
          {config.h1}
        </h1>

        <div className="flex flex-wrap gap-3 mb-8">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
            <Briefcase className="h-3.5 w-3.5" /> {config.category}
          </span>
        </div>

        <SEOContentSection htmlContent={config.introContent} />

        <AdPlaceholder variant="banner" />

        {/* Skills Required */}
        <section className="mb-10">
          <h2 className="text-2xl font-semibold text-foreground mb-4 flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" /> Skills Required for {config.category} Jobs
          </h2>
          <div className="flex flex-wrap gap-2">
            {config.skillsRequired.map((skill) => (
              <span key={skill} className="rounded-full bg-secondary px-3 py-1.5 text-sm text-secondary-foreground">
                {skill}
              </span>
            ))}
          </div>
        </section>

        {/* Salary Range */}
        <section className="mb-10">
          <h2 className="text-2xl font-semibold text-foreground mb-4 flex items-center gap-2">
            <IndianRupee className="h-5 w-5 text-primary" /> Salary Range
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 font-medium text-foreground">Level</th>
                  <th className="text-left py-2 font-medium text-foreground">Salary Range</th>
                </tr>
              </thead>
              <tbody>
                {config.salaryRange.map((row, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="py-2 text-muted-foreground">{row.level}</td>
                    <td className="py-2 text-primary font-medium">{row.range}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Growth Trends */}
        <section className="mb-10">
          <h2 className="text-2xl font-semibold text-foreground mb-4 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" /> Growth Trends
          </h2>
          <ul className="space-y-2">
            {config.growthTrends.map((t, i) => (
              <li key={i} className="flex items-start gap-2.5 text-muted-foreground">
                <span className="text-primary font-bold mt-0.5">•</span>
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </section>

        <LiveJobListings
          filter={{ keywords: config.filterKeywords, limit: 10 }}
          title={`Latest ${config.category} Job Openings`}
        />

        <AdPlaceholder variant="in-content" />

        <FAQAccordion items={config.faqItems} title={`FAQs About ${config.category} Jobs`} />

        <RelatedCities cities={topCityLinks} title={`Top Cities for ${config.category} Jobs`} />

        <PopularSearches searches={
          topCityLinks.slice(0, 4).map(c => ({
            label: `${config.category} Jobs in ${c.name}`,
            slug: c.slug,
          }))
        } />

        <GovtJobsCrossLink context={`in ${config.category}`} />

        <ExploreRelatedSection
          title={`Explore Related Opportunities`}
          links={[
            ...(config.relatedIndustries || []).slice(0, 2).map(s => {
              const ind = getIndustryJobConfig(s);
              return ind ? { label: `${ind.industry} Jobs`, href: `/${ind.slug}`, description: `Explore the ${ind.industry} sector` } : null;
            }).filter(Boolean) as { label: string; href: string; description: string }[],
            { label: 'Latest Sarkari Jobs', href: '/sarkari-jobs', description: 'SSC, Railway, Banking & more govt jobs' },
            { label: 'Work From Home Jobs', href: '/work-from-home-jobs', description: 'Remote opportunities across India' },
          ]}
        />
        <JobAlertCTA variant="compact" context={config.category} className="mt-8" />
      </main>
    </Layout>
  );
}
