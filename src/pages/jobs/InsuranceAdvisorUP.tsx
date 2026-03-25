import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { AdPlaceholder } from '@/components/ads/AdPlaceholder';
import { Button } from '@/components/ui/button';
import { MapPin, Briefcase, TrendingUp, Users, CheckCircle, Building2 } from 'lucide-react';
import { getCitiesByState } from './cityData';

const SITE_URL = 'https://truejobs.co.in';
const PAGE_PATH = '/insurance-advisor-jobs-uttar-pradesh';
const APPLY_URL = '/enrol-now';
const VALID_THROUGH = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString();

const JOB_DESCRIPTION = `TrueJobs is hiring Insurance Advisors / Insurance Consultants to work with leading MNC insurance companies across Uttar Pradesh.

This is a performance-driven opportunity suitable for freshers, experienced professionals, career switchers, retired professionals, and individuals seeking high earning potential in the insurance industry.

The role offers flexibility, professional training, and long-term career growth with reputed insurance brands.`;

const jobPostingSchema = {
  '@context': 'https://schema.org/',
  '@type': 'JobPosting',
  title: 'Insurance Advisor / Insurance Consultant',
  description: `<p>${JOB_DESCRIPTION.replace(/\n\n/g, '</p><p>')}</p><h3>Key Responsibilities</h3><ul><li>Understand customer insurance and financial protection needs</li><li>Recommend suitable life, or general insurance products</li><li>Work with leading insurance companies and follow company guidelines</li><li>Build and manage a client portfolio</li><li>Assist customers with documentation and onboarding</li><li>Maintain ethical sales practices and customer relationships</li></ul><h3>Job Highlights</h3><ul><li>No age limit</li><li>High earning potential based on performance with high commissions</li><li>Hybrid working model (Office + Online)</li><li>Training and onboarding support provided</li><li>Opportunity to work with Leading Insurance Companies</li></ul><h3>Eligibility</h3><ul><li>Freshers and experienced candidates can apply</li><li>Good communication skills preferred</li><li>Willingness to work in a client-facing advisory role</li></ul>`,
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
      addressRegion: 'Uttar Pradesh',
      addressCountry: 'IN',
    },
  },
  industry: 'Insurance',
  directApply: true,
  applicantLocationRequirements: {
    '@type': 'State',
    name: 'Uttar Pradesh',
  },
};

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
    { '@type': 'ListItem', position: 2, name: 'Jobs', item: `${SITE_URL}/jobs` },
    { '@type': 'ListItem', position: 3, name: 'Insurance Advisor Jobs in Uttar Pradesh', item: `${SITE_URL}${PAGE_PATH}` },
  ],
};

const locations = [
  'Lucknow', 'Noida', 'Greater Noida', 'Ghaziabad', 'Kanpur', 'Agra',
  'Varanasi', 'Prayagraj', 'Meerut', 'Gorakhpur',
];

const responsibilities = [
  'Understand customer insurance and financial protection needs',
  'Recommend suitable life, or general insurance products',
  'Work with leading insurance companies and follow company guidelines',
  'Build and manage a client portfolio',
  'Assist customers with documentation and onboarding',
  'Maintain ethical sales practices and customer relationships',
];

const highlights = [
  { icon: Users, text: 'No age limit' },
  { icon: TrendingUp, text: 'High earning potential based on performance with high commissions' },
  { icon: Building2, text: 'Hybrid working model (Office + Online)' },
  { icon: CheckCircle, text: 'Training and onboarding support provided' },
  { icon: Briefcase, text: 'Opportunity to work with Leading Insurance Companies' },
];

export default function InsuranceAdvisorUP() {
  return (
    <Layout>
      <AdPlaceholder variant="banner" />
      <Helmet>
        <title>Insurance Advisor Jobs in Uttar Pradesh | Work with Top Insurance Companies – TrueJobs</title>
        <meta name="description" content="Apply for Insurance Advisor and Insurance Consultant jobs in Uttar Pradesh. Work with top MNC insurance companies. Freshers welcome. High earning potential. Apply now on TrueJobs." />
        <link rel="canonical" href={`${SITE_URL}${PAGE_PATH}`} />
        <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />
        <meta property="og:title" content="Insurance Advisor Jobs in Uttar Pradesh | TrueJobs" />
        <meta property="og:description" content="Hiring Insurance Advisors across Uttar Pradesh. Commission-based, flexible, freshers welcome." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={`${SITE_URL}${PAGE_PATH}`} />
        <meta property="og:image" content={`${SITE_URL}/og-image.png`} />
        <meta property="og:site_name" content="TrueJobs" />
        <script type="application/ld+json">{JSON.stringify(jobPostingSchema)}</script>
        <script type="application/ld+json">{JSON.stringify(breadcrumbSchema)}</script>
      </Helmet>

      <main className="container mx-auto px-4 py-8 md:py-12 max-w-4xl">
        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="mb-6 text-sm text-muted-foreground">
          <ol className="flex items-center gap-1.5 flex-wrap">
            <li><Link to="/" className="hover:text-foreground transition-colors">Home</Link></li>
            <li>/</li>
            <li><Link to="/jobs" className="hover:text-foreground transition-colors">Jobs</Link></li>
            <li>/</li>
            <li className="text-foreground font-medium">Insurance Advisor Jobs – UP</li>
          </ol>
        </nav>

        {/* H1 */}
        <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-6 leading-tight">
          Insurance Advisor / Insurance Consultant Jobs – Uttar Pradesh
        </h1>

        {/* Quick info badges */}
        <div className="flex flex-wrap gap-3 mb-8">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
            <Briefcase className="h-3.5 w-3.5" /> Full Time
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
            <MapPin className="h-3.5 w-3.5" /> Uttar Pradesh
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
            <TrendingUp className="h-3.5 w-3.5" /> Commission Based
          </span>
        </div>

        {/* CTA top */}
        <div className="mb-10">
          <Button asChild size="lg" className="text-base px-8">
            <Link to={APPLY_URL}>Apply Now</Link>
          </Button>
        </div>

        {/* Job Description */}
        <section className="mb-10">
          <h2 className="text-2xl font-semibold text-foreground mb-4">Job Description</h2>
          <div className="prose prose-neutral max-w-none text-muted-foreground space-y-4">
            {JOB_DESCRIPTION.split('\n\n').map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        </section>

        {/* Key Responsibilities */}
        <section className="mb-10">
          <h2 className="text-2xl font-semibold text-foreground mb-4">Key Responsibilities</h2>
          <ul className="space-y-2.5">
            {responsibilities.map((item, i) => (
              <li key={i} className="flex items-start gap-2.5 text-muted-foreground">
                <CheckCircle className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Job Highlights */}
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

        {/* Eligibility */}
        <section className="mb-10">
          <h2 className="text-2xl font-semibold text-foreground mb-4">Eligibility</h2>
          <ul className="space-y-2.5">
            {[
              'Freshers and experienced candidates can apply',
              'Good communication skills preferred',
              'Willingness to work in a client-facing advisory role',
            ].map((item, i) => (
              <li key={i} className="flex items-start gap-2.5 text-muted-foreground">
                <CheckCircle className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Job Locations */}
        <section className="mb-10">
          <h2 className="text-2xl font-semibold text-foreground mb-4">Job Locations</h2>
          <div className="flex flex-wrap gap-2">
            {locations.map((loc) => (
              <span key={loc} className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm text-foreground">
                <MapPin className="h-3.5 w-3.5 text-primary" /> {loc}
              </span>
            ))}
            <span className="inline-flex items-center rounded-full border px-3 py-1.5 text-sm text-muted-foreground">
              + other cities across Uttar Pradesh
            </span>
          </div>
        </section>

        {/* City/District Links */}
        <section className="mb-10">
          <h2 className="text-2xl font-semibold text-foreground mb-4">Insurance Advisor Jobs by City</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-2">
            {getCitiesByState('Uttar Pradesh').map((c) => (
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
        {/* CTA bottom */}
        <section className="rounded-xl bg-primary/5 border border-primary/20 p-8 text-center">
          <h2 className="text-2xl font-semibold text-foreground mb-3">Ready to Start Your Insurance Career?</h2>
          <p className="text-muted-foreground mb-6">Join top insurance companies across Uttar Pradesh. No age limit. Training provided.</p>
          <Button asChild size="lg" className="text-base px-10">
            <Link to={APPLY_URL}>Apply Now</Link>
          </Button>
        </section>
      </main>
    </Layout>
  );
}
