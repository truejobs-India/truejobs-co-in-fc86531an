import { Helmet } from 'react-helmet-async';

const SITE_URL = 'https://truejobs.co.in';

interface ResourceSEOProps {
  title: string;
  metaTitle?: string | null;
  metaDescription?: string | null;
  canonicalUrl: string;
  coverImage?: string | null;
  noindex?: boolean;
  schemaJson?: object;
  breadcrumbs?: Array<{ name: string; url: string }>;
  faqItems?: Array<{ question: string; answer: string }>;
}

export function ResourceSEO({
  title,
  metaTitle,
  metaDescription,
  canonicalUrl,
  coverImage,
  noindex = false,
  schemaJson,
  breadcrumbs,
  faqItems,
}: ResourceSEOProps) {
  const fullCanonical = canonicalUrl.startsWith('http') ? canonicalUrl : `${SITE_URL}${canonicalUrl}`;
  const pageTitle = metaTitle || title;
  const description = metaDescription || `Download ${title} PDF for free from TrueJobs. Prepare for government exams with quality study materials.`;

  const breadcrumbSchema = breadcrumbs?.length ? {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: breadcrumbs.map((bc, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: bc.name,
      item: bc.url.startsWith('http') ? bc.url : `${SITE_URL}${bc.url}`,
    })),
  } : null;

  const faqSchema = faqItems?.length ? {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqItems.map(f => ({
      '@type': 'Question',
      name: f.question,
      acceptedAnswer: { '@type': 'Answer', text: f.answer },
    })),
  } : null;

  return (
    <Helmet>
      <title>{pageTitle}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={fullCanonical} />

      {noindex && <meta name="robots" content="noindex, nofollow" />}

      <meta property="og:title" content={pageTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={fullCanonical} />
      <meta property="og:type" content="website" />
      {coverImage && <meta property="og:image" content={coverImage} />}

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={pageTitle} />
      <meta name="twitter:description" content={description} />

      {breadcrumbSchema && (
        <script type="application/ld+json">{JSON.stringify(breadcrumbSchema)}</script>
      )}
      {faqSchema && (
        <script type="application/ld+json">{JSON.stringify(faqSchema)}</script>
      )}
      {schemaJson && (
        <script type="application/ld+json">{JSON.stringify(schemaJson)}</script>
      )}
    </Helmet>
  );
}
