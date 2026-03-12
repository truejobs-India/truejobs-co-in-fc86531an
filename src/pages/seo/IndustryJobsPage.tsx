import { Navigate, useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { Factory, TrendingUp, IndianRupee, Zap } from 'lucide-react';
import { getIndustryJobConfig } from './industryJobsData';
import { getCityJobConfig } from './cityJobsData';
import { buildBreadcrumbSchema, buildFAQSchema } from './schemas/seoPageSchemas';
import { FAQAccordion } from './components/FAQAccordion';
import { SEOContentSection } from './components/SEOContentSection';
import { AdPlaceholder } from '@/components/ads/AdPlaceholder';
import { LiveJobListings } from './components/LiveJobListings';
import { RelatedCities } from './components/RelatedCities';
import { RelatedCategories } from './components/RelatedCategories';
import { PopularSearches } from './components/PopularSearches';
import { getCategoryJobConfig } from './categoryJobsData';

const SITE_URL = 'https://truejobs.co.in';

export default function IndustryJobsPage() {
  const { slug } = useParams<{ slug: string }>();
  const config = slug ? getIndustryJobConfig(slug) : undefined;

  if (!config) return <Navigate to="/404" replace />;

  const breadcrumbSchema = buildBreadcrumbSchema([
    { name: 'Home', url: '/' },
    { name: 'Jobs', url: '/jobs' },
    { name: `${config.industry} Jobs`, url: `/${config.slug}` },
  ]);
  const faqSchema = buildFAQSchema(config.faqItems);

  const topCityLinks = config.topCities
    .map(s => { const c = getCityJobConfig(s); return c ? { name: c.city, slug: c.slug } : null; })
    .filter(Boolean) as { name: string; slug: string }[];

  const relatedCatLinks = config.relatedCategories
    .map(s => { const c = getCategoryJobConfig(s); return c ? { name: `${c.category} Jobs`, slug: c.slug } : null; })
    .filter(Boolean) as { name: string; slug: string }[];

  return (
    <Layout>
      <Helmet>
        <title>{config.metaTitle} | TrueJobs</title>
        <meta name="description" content={config.metaDescription} />
        <link rel="canonical" href={`${SITE_URL}/${config.slug}`} />
        <meta name="robots" content="index, follow" />
        <meta property="og:title" content={`${config.metaTitle} | TrueJobs`} />
        <meta property="og:description" content={config.metaDescription} />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={`${SITE_URL}/${config.slug}`} />
        <script type="application/ld+json">{JSON.stringify(breadcrumbSchema)}</script>
        <script type="application/ld+json">{JSON.stringify(faqSchema)}</script>
      </Helmet>

      <main className="container mx-auto px-4 py-8 md:py-12 max-w-4xl">
        <nav aria-label="Breadcrumb" className="mb-6 text-sm text-muted-foreground">
          <ol className="flex items-center gap-1.5 flex-wrap">
            <li><Link to="/" className="hover:text-foreground transition-colors">Home</Link></li>
            <li>/</li>
            <li><Link to="/jobs" className="hover:text-foreground transition-colors">Jobs</Link></li>
            <li>/</li>
            <li className="text-foreground font-medium">{config.industry} Jobs</li>
          </ol>
        </nav>

        <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4 leading-tight">{config.h1}</h1>

        <div className="flex flex-wrap gap-3 mb-8">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
            <Factory className="h-3.5 w-3.5" /> {config.industry}
          </span>
        </div>

        <SEOContentSection htmlContent={config.introContent} />

        <AdPlaceholder variant="banner" />

        <section className="mb-10">
          <h2 className="text-2xl font-semibold text-foreground mb-4 flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" /> Key Roles in {config.industry}
          </h2>
          <div className="flex flex-wrap gap-2">
            {config.keyRoles.map((role) => (
              <span key={role} className="rounded-full bg-secondary px-3 py-1.5 text-sm text-secondary-foreground">{role}</span>
            ))}
          </div>
        </section>

        <section className="mb-10">
          <h2 className="text-2xl font-semibold text-foreground mb-4 flex items-center gap-2">
            <IndianRupee className="h-5 w-5 text-primary" /> Salary Range
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b"><th className="text-left py-2 font-medium text-foreground">Role</th><th className="text-left py-2 font-medium text-foreground">Salary Range</th></tr></thead>
              <tbody>
                {config.salaryRange.map((row, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="py-2 text-muted-foreground">{row.role}</td>
                    <td className="py-2 text-primary font-medium">{row.range}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mb-10">
          <h2 className="text-2xl font-semibold text-foreground mb-4 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" /> Growth Trends
          </h2>
          <ul className="space-y-2">
            {config.growthTrends.map((t, i) => (
              <li key={i} className="flex items-start gap-2.5 text-muted-foreground">
                <span className="text-primary font-bold mt-0.5">•</span><span>{t}</span>
              </li>
            ))}
          </ul>
        </section>

        <LiveJobListings filter={{ keywords: config.filterKeywords, limit: 10 }} title={`Latest ${config.industry} Job Openings`} />
        <FAQAccordion items={config.faqItems} title={`FAQs About ${config.industry} Jobs`} />
        <RelatedCities cities={topCityLinks} title={`Top Cities for ${config.industry} Jobs`} />
        {relatedCatLinks.length > 0 && <RelatedCategories categories={relatedCatLinks} title="Related Job Categories" />}

        <PopularSearches searches={[
          { label: 'Fresher Jobs', slug: 'fresher-jobs' },
          { label: 'Remote Jobs', slug: 'remote-jobs' },
          { label: 'Work From Home Jobs', slug: 'work-from-home-jobs' },
        ]} />

        <section className="rounded-xl bg-primary/5 border border-primary/20 p-8 text-center">
          <h2 className="text-2xl font-semibold text-foreground mb-3">Find Your Next {config.industry} Job</h2>
          <p className="text-muted-foreground mb-6">Browse verified listings and apply directly. New jobs added daily.</p>
          <Link to="/jobs" className="inline-flex items-center justify-center rounded-md bg-primary px-8 py-3 text-base font-medium text-primary-foreground hover:bg-primary/90 transition-colors">Browse All Jobs</Link>
        </section>
      </main>
    </Layout>
  );
}
