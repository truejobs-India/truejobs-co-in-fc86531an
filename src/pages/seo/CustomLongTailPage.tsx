import { useParams, Navigate, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Layout } from '@/components/layout/Layout';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, ExternalLink, BookOpen, Briefcase, Target, BarChart3 } from 'lucide-react';
import { getCustomLongTailConfig, type CustomLongTailSubtype } from './customLongTailData';
import { buildBreadcrumbSchema, buildFAQSchema } from './schemas/seoPageSchemas';
import { FAQAccordion } from './components/FAQAccordion';
import { SEOContentSection } from './components/SEOContentSection';
import { LiveJobListings } from './components/LiveJobListings';
import { AdPlaceholder } from '@/components/ads/AdPlaceholder';
import type { JobFilter } from './hooks/useFilteredJobs';

const SITE_URL = 'https://truejobs.co.in';

const SUBTYPE_META: Record<CustomLongTailSubtype, { icon: typeof Briefcase; label: string; color: string }> = {
  opportunity: { icon: Briefcase, label: 'Job Opportunities', color: 'bg-emerald-100 text-emerald-800' },
  constraint: { icon: Target, label: 'Eligibility Guide', color: 'bg-amber-100 text-amber-800' },
  decision: { icon: BarChart3, label: 'Career Guide', color: 'bg-blue-100 text-blue-800' },
  'exam-support': { icon: BookOpen, label: 'Exam Guide', color: 'bg-purple-100 text-purple-800' },
};

export default function CustomLongTailPage() {
  const { slug } = useParams<{ slug: string }>();
  const config = slug ? getCustomLongTailConfig(slug) : undefined;

  if (!config) return <Navigate to="/404" replace />;

  const subtypeMeta = SUBTYPE_META[config.subtype];
  const SubtypeIcon = subtypeMeta.icon;

  const breadcrumbSchema = buildBreadcrumbSchema([
    { name: 'Home', url: '/' },
    { name: 'Sarkari Jobs', url: '/sarkari-jobs' },
    { name: config.h1, url: `/${config.slug}` },
  ]);

  const faqSchema = config.faqItems.length > 0 ? buildFAQSchema(config.faqItems) : null;

  const canonicalUrl = `${SITE_URL}/${config.slug}`;

  // Build job filter from config
  const jobFilter: JobFilter | undefined = config.filterConfig
    ? {
        ...(config.filterConfig.state ? { city: config.filterConfig.state } : {}),
        ...(config.filterConfig.keyword ? { keywords: [config.filterConfig.keyword] } : {}),
      }
    : undefined;

  return (
    <Layout>
      <Helmet>
        <title>{config.metaTitle} | TrueJobs</title>
        <meta name="description" content={config.metaDescription} />
        <link rel="canonical" href={canonicalUrl} />
        <meta property="og:title" content={config.metaTitle} />
        <meta property="og:description" content={config.metaDescription} />
        <meta property="og:url" content={canonicalUrl} />
        <meta property="og:type" content="website" />
        <script type="application/ld+json">{JSON.stringify(breadcrumbSchema)}</script>
        {faqSchema && <script type="application/ld+json">{JSON.stringify(faqSchema)}</script>}
      </Helmet>

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
            <Link to="/" className="hover:text-primary">Home</Link>
            <span>/</span>
            <Link to="/sarkari-jobs" className="hover:text-primary">Sarkari Jobs</Link>
            <span>/</span>
            <span className="text-foreground">{config.h1}</span>
          </div>

          <div className="flex items-center gap-3 mb-4">
            <Badge className={subtypeMeta.color}>
              <SubtypeIcon className="h-3.5 w-3.5 mr-1" />
              {subtypeMeta.label}
            </Badge>
            {config.lastUpdated && (
              <Badge variant="outline" className="text-xs">
                Updated: {config.lastUpdated}
              </Badge>
            )}
          </div>

          <h1 className="text-3xl font-bold text-foreground leading-tight">{config.h1}</h1>
        </div>

        {/* Main Content */}
        <SEOContentSection htmlContent={config.introContent} />

        <AdPlaceholder variant="banner" />

        {/* Live Job Listings (for opportunity & constraint subtypes) */}
        {jobFilter && (config.subtype === 'opportunity' || config.subtype === 'constraint') && (
          <LiveJobListings
            filter={jobFilter}
            title={`Latest ${config.h1.replace(/2026/g, '').trim()} Openings`}
          />
        )}

        {/* Authority Links */}
        {config.authorityLinks.length > 0 && (
          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-foreground mb-4">Related Exam Notifications</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {config.authorityLinks.map((link) => (
                <Link
                  key={link.href}
                  to={link.href}
                  className="flex items-center justify-between rounded-lg border p-4 hover:border-primary/50 hover:bg-primary/5 transition-colors"
                >
                  <span className="font-medium text-foreground">{link.label}</span>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Guide Links */}
        {config.guideLinks && config.guideLinks.length > 0 && (
          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-foreground mb-4">Helpful Guides</h2>
            <ul className="space-y-2">
              {config.guideLinks.map((link) => (
                <li key={link.href}>
                  <Link to={link.href} className="text-primary hover:underline inline-flex items-center gap-1">
                    {link.label}
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Quick Links */}
        {config.quickLinks.length > 0 && (
          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-foreground mb-4">Quick Links</h2>
            <div className="flex flex-wrap gap-2">
              {config.quickLinks.map((link) => (
                <Link
                  key={link.href}
                  to={link.href}
                  className="rounded-full border px-4 py-2 text-sm font-medium text-foreground hover:bg-primary/10 hover:border-primary/50 transition-colors"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* FAQs */}
        {config.faqItems.length > 0 && (
          <FAQAccordion items={config.faqItems} />
        )}

        {/* Useful tool links (text only per CTA policy) */}
        <section className="mb-10 text-sm text-muted-foreground">
          <p>
            Useful tools: <Link to="/govt-salary-calculator" className="text-primary hover:underline">Govt Salary Calculator</Link>
            {' · '}
            <Link to="/govt-job-age-calculator" className="text-primary hover:underline">Age Calculator</Link>
            {' · '}
            <Link to="/govt-exam-eligibility-checker" className="text-primary hover:underline">Eligibility Checker</Link>
          </p>
        </section>
      </div>
    </Layout>
  );
}
