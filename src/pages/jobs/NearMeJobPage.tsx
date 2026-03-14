import { Helmet } from 'react-helmet-async';
import { Link, useParams, Navigate } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { MapPin, Briefcase, TrendingUp, Users, CheckCircle, Building2, Home } from 'lucide-react';
import { NEAR_ME_PAGES, NearMePageConfig } from './nearMeData';
import { INSURANCE_STATES, INSURANCE_CITIES } from './cityData';

const SITE_URL = 'https://truejobs.co.in';
const APPLY_URL = '/enrol-now';

function buildSchema(cfg: NearMePageConfig) {
  const VALID_THROUGH = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString();

  const descHtml = [
    `<p>${cfg.intro}</p>`,
    ...cfg.descriptionParagraphs.map((p) => `<p>${p}</p>`),
    '<h3>Job Highlights</h3><ul>' + cfg.highlights.map((h) => `<li>${h}</li>`).join('') + '</ul>',
    '<h3>Eligibility</h3><ul>' + cfg.eligibility.map((e) => `<li>${e}</li>`).join('') + '</ul>',
  ].join('');

  return {
    jobPosting: {
      '@context': 'https://schema.org/',
      '@type': 'JobPosting',
      title: cfg.h1.replace(' Near Me', ''),
      description: descHtml,
      datePosted: new Date().toISOString().split('T')[0],
      validThrough: VALID_THROUGH,
      employmentType: cfg.employmentType,
      hiringOrganization: {
        '@type': 'Organization',
        name: 'TrueJobs',
        sameAs: SITE_URL,
        logo: `${SITE_URL}/favicon.png`,
      },
      jobLocationType: 'TELECOMMUTE',
      applicantLocationRequirements: {
        '@type': 'Country',
        name: 'India',
      },
      industry: cfg.industry,
      directApply: true,
    },
    breadcrumb: {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
        { '@type': 'ListItem', position: 2, name: 'Jobs', item: `${SITE_URL}/jobs` },
        { '@type': 'ListItem', position: 3, name: cfg.h1, item: `${SITE_URL}/${cfg.slug}` },
      ],
    },
  };
}

const highlightIcons = [Users, TrendingUp, Building2, CheckCircle, Briefcase];

export default function NearMeJobPage() {
  const { slug, nearMeSlug } = useParams<{ slug?: string; nearMeSlug?: string }>();
  const resolvedSlug = slug || nearMeSlug;
  const cfg = NEAR_ME_PAGES.find((p) => p.slug === resolvedSlug);

  if (!cfg) return <Navigate to="/404" replace />;

  const { jobPosting, breadcrumb } = buildSchema(cfg);
  const pagePath = `/${cfg.slug}`;

  return (
    <Layout>
      <Helmet>
        <title>{cfg.title}</title>
        <meta name="description" content={cfg.metaDescription} />
        <link rel="canonical" href={`${SITE_URL}${pagePath}`} />
        <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />
        <meta property="og:title" content={cfg.title} />
        <meta property="og:description" content={cfg.metaDescription} />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={`${SITE_URL}${pagePath}`} />
        <meta property="og:image" content={`${SITE_URL}/og-image.png`} />
        <meta property="og:site_name" content="TrueJobs" />
        <script type="application/ld+json">{JSON.stringify(jobPosting)}</script>
        <script type="application/ld+json">{JSON.stringify(breadcrumb)}</script>
      </Helmet>

      <main className="container mx-auto px-4 py-8 md:py-12 max-w-4xl content-area my-8">
        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="mb-6 text-sm text-muted-foreground">
          <ol className="flex items-center gap-1.5 flex-wrap">
            <li><Link to="/" className="hover:text-foreground transition-colors">Home</Link></li>
            <li>/</li>
            <li><Link to="/jobs" className="hover:text-foreground transition-colors">Jobs</Link></li>
            <li>/</li>
            <li className="text-foreground font-medium">{cfg.h1}</li>
          </ol>
        </nav>

        {/* H1 */}
        <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-6 leading-tight">
          {cfg.h1}
        </h1>

        {/* Tags */}
        <div className="flex flex-wrap gap-3 mb-8">
          {cfg.tags.map((tag) => (
            <span key={tag} className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
              {tag}
            </span>
          ))}
        </div>

        {/* CTA */}
        <div className="mb-10">
          <Button asChild size="lg" className="text-base px-8">
            <Link to={APPLY_URL}>Apply Now — 100% Free</Link>
          </Button>
          <p className="text-xs text-muted-foreground mt-2">No placement fees. No joining fees. Direct apply to opportunities.</p>
        </div>

        {/* Intro */}
        <section className="mb-10">
          <div className="prose prose-neutral max-w-none text-muted-foreground">
            <p className="text-base leading-relaxed">{cfg.intro}</p>
          </div>
        </section>

        {/* Job Description */}
        <section className="mb-10">
          <h2 className="text-2xl font-semibold text-foreground mb-4">Job Description</h2>
          <div className="prose prose-neutral max-w-none text-muted-foreground space-y-4">
            {cfg.descriptionParagraphs.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        </section>

        {/* Highlights */}
        <section className="mb-10">
          <h2 className="text-2xl font-semibold text-foreground mb-4">Job Highlights</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {cfg.highlights.map((item, i) => {
              const Icon = highlightIcons[i % highlightIcons.length];
              return (
                <div key={i} className="flex items-start gap-3 rounded-lg border p-4">
                  <Icon className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  <span className="text-sm text-foreground">{item}</span>
                </div>
              );
            })}
          </div>
        </section>

        {/* Eligibility */}
        <section className="mb-10">
          <h2 className="text-2xl font-semibold text-foreground mb-4">Eligibility</h2>
          <ul className="space-y-2.5">
            {cfg.eligibility.map((item, i) => (
              <li key={i} className="flex items-start gap-2.5 text-muted-foreground">
                <CheckCircle className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Location */}
        <section className="mb-10">
          <h2 className="text-2xl font-semibold text-foreground mb-4">Available Locations</h2>
          <p className="text-muted-foreground mb-4">{cfg.locationExamples}</p>
          <p className="text-sm text-muted-foreground">
            Jobs are matched based on your current city, district, or nearby areas. Opportunities may be available in surrounding locations across India.
          </p>
        </section>

        {/* Internal Links — State Pages */}
        <section className="mb-10">
          <h2 className="text-2xl font-semibold text-foreground mb-4">Explore Jobs by State</h2>
          <div className="flex flex-wrap gap-2 mb-4">
            {INSURANCE_STATES.map((s) => (
              <Link
                key={s.slug}
                to={s.path}
                className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm text-foreground hover:bg-muted transition-colors"
              >
                <MapPin className="h-3.5 w-3.5 text-primary" />
                {s.state}
              </Link>
            ))}
          </div>
        </section>

        {/* Internal Links — Top Cities */}
        <section className="mb-10">
          <h2 className="text-2xl font-semibold text-foreground mb-4">Popular City Job Pages</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-2">
            {INSURANCE_CITIES.slice(0, 12).map((c) => (
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

        {/* Final CTA */}
        <section className="rounded-xl bg-primary/5 border border-primary/20 p-8 text-center">
          <h2 className="text-2xl font-semibold text-foreground mb-3">Ready to Get Started?</h2>
          <p className="text-muted-foreground mb-2">100% free registration. No placement or joining fees.</p>
          <p className="text-muted-foreground mb-6">Apply directly to opportunities matched to your location.</p>
          <Button asChild size="lg" className="text-base px-10">
            <Link to={APPLY_URL}>Register & Apply Now</Link>
          </Button>
        </section>
      </main>
    </Layout>
  );
}
