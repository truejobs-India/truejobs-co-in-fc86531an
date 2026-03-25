import { Helmet } from 'react-helmet-async';
import { Link, useParams, Navigate } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { AdPlaceholder } from '@/components/ads/AdPlaceholder';
import { Button } from '@/components/ui/button';
import { MapPin, Briefcase, TrendingUp, Users, CheckCircle, Building2 } from 'lucide-react';
import { INSURANCE_CITIES, INSURANCE_STATES, getNearbyCities, CityConfig } from './cityData';

const SITE_URL = 'https://truejobs.co.in';
const APPLY_URL = '/enrol-now';

function buildSchema(cfg: CityConfig) {
  const VALID_THROUGH = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString();
  const desc = `<p>TrueJobs is hiring Insurance Advisors / Insurance Consultants to work with leading MNC insurance companies in ${cfg.city} and nearby areas of ${cfg.state}.</p><p>This is a performance-driven, commission-based role suitable for freshers, experienced professionals, career switchers, retired professionals, and individuals looking to build a high-income career in insurance.</p><h3>Key Responsibilities</h3><ul><li>Understand customer insurance and financial protection needs in ${cfg.city}</li><li>Recommend suitable life, health, or general insurance products</li><li>Work with reputed insurance companies as per guidelines</li><li>Build and manage a local client base</li><li>Assist customers with documentation and onboarding</li><li>Maintain ethical sales practices and long-term relationships</li></ul><h3>Job Highlights</h3><ul><li>No age limit</li><li>High earning potential based on performance with high commissions</li><li>Hybrid working model (Office + Online)</li><li>Training and onboarding support provided</li><li>Opportunity to work with Leading Insurance Companies</li></ul><h3>Eligibility</h3><ul><li>Minimum qualification: 12th pass or above</li><li>Freshers and experienced candidates can apply</li><li>Good communication skills preferred</li><li>Willingness to work in a client-facing advisory role</li></ul>`;

  return {
    jobPosting: {
      '@context': 'https://schema.org/',
      '@type': 'JobPosting',
      title: 'Insurance Advisor / Insurance Consultant',
      description: desc,
      datePosted: new Date().toISOString().split('T')[0],
      validThrough: VALID_THROUGH,
      employmentType: 'FULL_TIME',
      hiringOrganization: {
        '@type': 'Organization',
        name: 'TrueJobs',
        sameAs: SITE_URL,
        logo: `${SITE_URL}/favicon.png`,
      },
      jobLocation: {
        '@type': 'Place',
        address: {
          '@type': 'PostalAddress',
          addressLocality: cfg.city,
          addressRegion: cfg.state,
          addressCountry: 'IN',
        },
      },
      industry: 'Insurance',
      directApply: true,
      applicantLocationRequirements: {
        '@type': 'State',
        name: cfg.state,
      },
    },
    breadcrumb: {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
        { '@type': 'ListItem', position: 2, name: 'Jobs', item: `${SITE_URL}/jobs` },
        { '@type': 'ListItem', position: 3, name: `Insurance Advisor Jobs in ${cfg.city}`, item: `${SITE_URL}/${cfg.slug}` },
      ],
    },
  };
}

const responsibilities = (city: string) => [
  `Understand customer insurance and financial protection needs in ${city}`,
  'Recommend suitable life, health, or general insurance products',
  'Work with reputed insurance companies as per guidelines',
  'Build and manage a local client base',
  'Assist customers with documentation and onboarding',
  'Maintain ethical sales practices and long-term relationships',
];

const highlights = [
  { icon: Users, text: 'No age limit' },
  { icon: TrendingUp, text: 'High earning potential based on performance with high commissions' },
  { icon: Building2, text: 'Hybrid working model (Office + Online)' },
  { icon: CheckCircle, text: 'Training and onboarding support provided' },
  { icon: Briefcase, text: 'Opportunity to work with Leading Insurance Companies' },
];

const eligibility = [
  'Minimum qualification: 12th pass or above',
  'Freshers and experienced candidates can apply',
  'Good communication skills preferred',
  'Willingness to work in a client-facing advisory role',
];

export default function InsuranceAdvisorCity() {
  const { citySlug } = useParams<{ citySlug: string }>();
  const fullSlug = `insurance-advisor-jobs-${citySlug}`;
  const cityConfig = INSURANCE_CITIES.find((c) => c.slug === fullSlug);

  if (!cityConfig) return <Navigate to="/404" replace />;

  const { city, slug, state, nearbyAreas, localFlavor } = cityConfig;
  const { jobPosting, breadcrumb } = buildSchema(cityConfig);
  const pagePath = `/${slug}`;
  const stateConfig = INSURANCE_STATES.find((s) => s.state === state);
  const relatedCities = getNearbyCities(slug, state, 8);

  return (
    <Layout>
      <AdPlaceholder variant="banner" />
      <Helmet>
        <title>{`Insurance Advisor Jobs in ${city} | Insurance Consultant Hiring – TrueJobs`}</title>
        <meta name="description" content={`Apply for Insurance Advisor and Insurance Consultant jobs in ${city}, ${state}. Work with top MNC insurance companies. Freshers welcome. Commission-based, high earning potential. Apply now on TrueJobs.`} />
        <link rel="canonical" href={`${SITE_URL}${pagePath}`} />
        <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />
        <meta property="og:title" content={`Insurance Advisor Jobs in ${city} | TrueJobs`} />
        <meta property="og:description" content={`Hiring Insurance Advisors in ${city}, ${state}. Commission-based, flexible, freshers welcome.`} />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={`${SITE_URL}${pagePath}`} />
        <meta property="og:image" content={`${SITE_URL}/og-image.png`} />
        <meta property="og:site_name" content="TrueJobs" />
        <script type="application/ld+json">{JSON.stringify(jobPosting)}</script>
        <script type="application/ld+json">{JSON.stringify(breadcrumb)}</script>
      </Helmet>

      <main className="container mx-auto px-4 py-8 md:py-12 max-w-4xl content-area my-8">
        <nav aria-label="Breadcrumb" className="mb-6 text-sm text-muted-foreground">
          <ol className="flex items-center gap-1.5 flex-wrap">
            <li><Link to="/" className="hover:text-foreground transition-colors">Home</Link></li>
            <li>/</li>
            <li><Link to="/jobs" className="hover:text-foreground transition-colors">Jobs</Link></li>
            <li>/</li>
            <li><Link to="/jobs" className="hover:text-foreground transition-colors">Insurance Advisor Jobs</Link></li>
            <li>/</li>
            {stateConfig && (
              <>
                <li><Link to={stateConfig.path} className="hover:text-foreground transition-colors">{state}</Link></li>
                <li>/</li>
              </>
            )}
            <li className="text-foreground font-medium">{city}</li>
          </ol>
        </nav>

        <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-6 leading-tight">
          Insurance Advisor / Insurance Consultant Jobs in {city}
        </h1>

        <div className="flex flex-wrap gap-3 mb-8">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
            <Briefcase className="h-3.5 w-3.5" /> Full Time
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
            <MapPin className="h-3.5 w-3.5" /> {city}, {state}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
            <TrendingUp className="h-3.5 w-3.5" /> Commission Based
          </span>
        </div>

        <div className="mb-10">
          <Button asChild size="lg" className="text-base px-8">
            <Link to={APPLY_URL}>Apply Now</Link>
          </Button>
        </div>

        <section className="mb-10">
          <h2 className="text-2xl font-semibold text-foreground mb-4">Job Description</h2>
          <div className="prose prose-neutral max-w-none text-muted-foreground space-y-4">
            <p>
              TrueJobs is hiring Insurance Advisors / Insurance Consultants to work with leading MNC insurance companies in {city} and nearby areas of {state}.
              {` ${city} is ${localFlavor}, making it an excellent location for building a rewarding career in insurance advisory.`}
            </p>
            <p>
              This is a performance-driven, commission-based role suitable for freshers, experienced professionals, career switchers, retired professionals, and individuals looking to build a high-income career in insurance.
            </p>
          </div>
        </section>

        <section className="mb-10">
          <h2 className="text-2xl font-semibold text-foreground mb-4">Key Responsibilities</h2>
          <ul className="space-y-2.5">
            {responsibilities(city).map((item, i) => (
              <li key={i} className="flex items-start gap-2.5 text-muted-foreground">
                <CheckCircle className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="mb-10">
          <h2 className="text-2xl font-semibold text-foreground mb-4">Job Highlights</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {highlights.map((item, i) => (
              <div key={i} className="flex items-start gap-3 rounded-lg border p-4">
                <item.icon className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <span className="text-sm text-foreground">{item.text}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="mb-10">
          <h2 className="text-2xl font-semibold text-foreground mb-4">Eligibility</h2>
          <ul className="space-y-2.5">
            {eligibility.map((item, i) => (
              <li key={i} className="flex items-start gap-2.5 text-muted-foreground">
                <CheckCircle className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="mb-10">
          <h2 className="text-2xl font-semibold text-foreground mb-4">Job Location</h2>
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm text-foreground">
              <MapPin className="h-3.5 w-3.5 text-primary" /> {nearbyAreas}
            </span>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">{city}, {state} and nearby areas</p>
        </section>

        {/* Related Jobs Section */}
        {relatedCities.length > 0 && (
          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-foreground mb-4">More Insurance Advisor Jobs in {state}</h2>
            <div className="flex flex-wrap gap-2 mb-4">
              {stateConfig && (
                <Link
                  to={stateConfig.path}
                  className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary/20 transition-colors"
                >
                  <MapPin className="h-3.5 w-3.5" /> All Jobs in {state}
                </Link>
              )}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-2">
              {relatedCities.map((c) => (
                <Link
                  key={c.slug}
                  to={`/${c.slug}`}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors py-1"
                >
                  Insurance Advisor Jobs in {c.city}
                </Link>
              ))}
            </div>
          </section>
        )}

        <section className="rounded-xl bg-primary/5 border border-primary/20 p-8 text-center">
          <h2 className="text-2xl font-semibold text-foreground mb-3">Ready to Start Your Insurance Career in {city}?</h2>
          <p className="text-muted-foreground mb-6">Join top insurance companies in {city}. No age limit. Training provided.</p>
          <Button asChild size="lg" className="text-base px-10">
            <Link to={APPLY_URL}>Apply Now</Link>
          </Button>
        </section>
      </main>
    </Layout>
  );
}
