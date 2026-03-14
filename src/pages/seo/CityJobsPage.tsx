import { Navigate, useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { MapPin, TrendingUp, IndianRupee, Zap } from 'lucide-react';
import { getCityJobConfig, CITY_JOBS_DATA } from './cityJobsData';
import { buildBreadcrumbSchema, buildFAQSchema } from './schemas/seoPageSchemas';
import { FAQAccordion } from './components/FAQAccordion';
import { SEOContentSection } from './components/SEOContentSection';
import { LiveJobListings } from './components/LiveJobListings';
import { AdPlaceholder } from '@/components/ads/AdPlaceholder';
import { RelatedCities } from './components/RelatedCities';
import { RelatedCategories } from './components/RelatedCategories';
import { PopularSearches } from './components/PopularSearches';
import { getCategoryJobConfig } from './categoryJobsData';


const SITE_URL = 'https://truejobs.co.in';

export default function CityJobsPage() {
  const { slug } = useParams<{ slug: string }>();
  const config = slug ? getCityJobConfig(slug) : undefined;

  if (!config) return <Navigate to="/404" replace />;

  const breadcrumbSchema = buildBreadcrumbSchema([
    { name: 'Home', url: '/' },
    { name: 'Jobs', url: '/jobs' },
    { name: `Jobs in ${config.city}`, url: `/${config.slug}` },
  ]);

  const faqSchema = buildFAQSchema(config.faqItems);

  const nearbyCityLinks = config.nearbyCities
    .map(s => {
      const c = getCityJobConfig(s);
      return c ? { name: c.city, slug: c.slug } : null;
    })
    .filter(Boolean) as { name: string; slug: string }[];

  const relatedCatLinks = config.relatedCategories
    .map(s => {
      const c = getCategoryJobConfig(s);
      return c ? { name: `${c.category} Jobs`, slug: c.slug } : null;
    })
    .filter(Boolean) as { name: string; slug: string }[];

  const popularSearches = [
    { label: `IT Jobs in ${config.city}`, slug: 'it-jobs' },
    { label: `Fresher Jobs in ${config.city}`, slug: 'fresher-jobs' },
    { label: `Sales Jobs in ${config.city}`, slug: 'sales-jobs' },
    { label: 'Government Jobs', slug: 'government-jobs' },
    { label: `Remote Jobs`, slug: 'remote-jobs' },
  ];

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
        <meta property="og:site_name" content="TrueJobs" />
        <script type="application/ld+json">{JSON.stringify(breadcrumbSchema)}</script>
        <script type="application/ld+json">{JSON.stringify(faqSchema)}</script>
      </Helmet>

      <main className="container mx-auto px-4 py-8 md:py-12 max-w-4xl content-area my-8">
        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="mb-6 text-sm text-muted-foreground">
          <ol className="flex items-center gap-1.5 flex-wrap">
            <li><Link to="/" className="hover:text-foreground transition-colors">Home</Link></li>
            <li>/</li>
            <li><Link to="/jobs" className="hover:text-foreground transition-colors">Jobs</Link></li>
            <li>/</li>
            <li className="text-foreground font-medium">Jobs in {config.city}</li>
          </ol>
        </nav>

        {/* H1 */}
        <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4 leading-tight">
          {config.h1}
        </h1>

        {/* Tags */}
        <div className="flex flex-wrap gap-3 mb-8">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
            <MapPin className="h-3.5 w-3.5" /> {config.city}, {config.state}
          </span>
        </div>

        {/* SEO Content */}
        <SEOContentSection htmlContent={config.introContent} />

        <AdPlaceholder variant="banner" />

        {/* Hiring Trends */}
        <section className="mb-10">
          <h2 className="text-2xl font-semibold text-foreground mb-4 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" /> Hiring Trends in {config.city}
          </h2>
          <ul className="space-y-2">
            {config.hiringTrends.map((trend, i) => (
              <li key={i} className="flex items-start gap-2.5 text-muted-foreground">
                <span className="text-primary font-bold mt-0.5">•</span>
                <span>{trend}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Salary Insights */}
        <section className="mb-10">
          <h2 className="text-2xl font-semibold text-foreground mb-4 flex items-center gap-2">
            <IndianRupee className="h-5 w-5 text-primary" /> Salary Insights in {config.city}
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 font-medium text-foreground">Role</th>
                  <th className="text-left py-2 font-medium text-foreground">Salary Range</th>
                </tr>
              </thead>
              <tbody>
                {config.salaryInsights.map((row, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="py-2 text-muted-foreground">{row.role}</td>
                    <td className="py-2 text-primary font-medium">{row.range}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Skills in Demand */}
        <section className="mb-10">
          <h2 className="text-2xl font-semibold text-foreground mb-4 flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" /> In-Demand Skills in {config.city}
          </h2>
          <div className="flex flex-wrap gap-2">
            {config.skillsDemand.map((skill) => (
              <span key={skill} className="rounded-full bg-secondary px-3 py-1.5 text-sm text-secondary-foreground">
                {skill}
              </span>
            ))}
          </div>
        </section>

        {/* Live Job Listings */}
        <LiveJobListings
          filter={{ city: config.city, limit: 10 }}
          title={`Latest Job Openings in ${config.city}`}
        />

        {/* FAQ */}
        <FAQAccordion items={config.faqItems} title={`FAQs About Jobs in ${config.city}`} />

        {/* Related Categories */}
        <RelatedCategories
          categories={relatedCatLinks}
          title={`Top Job Categories in ${config.city}`}
        />

        {/* Nearby Cities */}
        <RelatedCities
          cities={nearbyCityLinks}
          title="Jobs in Nearby Cities"
        />

        {/* Popular Searches */}
        <PopularSearches searches={popularSearches} />

        {/* CTA */}
        <section className="rounded-xl bg-primary/5 border border-primary/20 p-8 text-center">
          <h2 className="text-2xl font-semibold text-foreground mb-3">Find Your Dream Job in {config.city}</h2>
          <p className="text-muted-foreground mb-6">Browse verified job listings and apply directly. New jobs added daily.</p>
          <Link
            to="/jobs"
            className="inline-flex items-center justify-center rounded-md bg-primary px-8 py-3 text-base font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Browse All Jobs
          </Link>
        </section>
      </main>
    </Layout>
  );
}
