import type { FAQItem } from '../types';

const SITE_URL = 'https://truejobs.co.in';

export function buildBreadcrumbSchema(items: { name: string; url: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: item.url.startsWith('http') ? item.url : `${SITE_URL}${item.url}`,
    })),
  };
}

export function buildFAQSchema(faqItems: FAQItem[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqItems.map(faq => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  };
}

export function buildItemListSchema(name: string, url: string, items: { name: string; url: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name,
    url: url.startsWith('http') ? url : `${SITE_URL}${url}`,
    itemListOrder: 'https://schema.org/ItemListOrderDescending',
    numberOfItems: items.length,
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      url: item.url.startsWith('http') ? item.url : `${SITE_URL}${item.url}`,
    })),
  };
}

export function buildWebPageSchema(opts: {
  name: string;
  url: string;
  description: string;
  datePublished: string;
  dateModified: string;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: opts.name,
    url: opts.url.startsWith('http') ? opts.url : `${SITE_URL}${opts.url}`,
    description: opts.description,
    datePublished: opts.datePublished,
    dateModified: opts.dateModified,
  };
}

export function buildEventSchema(events: { name: string; startDate: string; location?: string; description?: string; url?: string }[]) {
  return events.map(event => ({
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: event.name,
    startDate: event.startDate,
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    eventStatus: 'https://schema.org/EventScheduled',
    location: {
      '@type': 'Place',
      name: event.location || 'Various Centres Across India',
      address: { '@type': 'PostalAddress', addressCountry: 'IN' },
    },
    organizer: {
      '@type': 'Organization',
      name: 'Government of India',
      url: SITE_URL,
    },
    ...(event.description ? { description: event.description } : {}),
    ...(event.url ? { url: event.url.startsWith('http') ? event.url : `${SITE_URL}${event.url}` } : {}),
  }));
}

export function buildJobPostingSchemaFromDB(job: {
  title: string;
  company_name?: string | null;
  city?: string | null;
  location?: string | null;
  salary_min?: number | null;
  salary_max?: number | null;
  salary_currency?: string | null;
  slug: string;
  created_at: string;
}) {
  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org/',
    '@type': 'JobPosting',
    title: job.title,
    datePosted: job.created_at.split('T')[0],
    validThrough: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
    hiringOrganization: {
      '@type': 'Organization',
      name: job.company_name || 'Confidential',
      sameAs: SITE_URL,
    },
    jobLocation: {
      '@type': 'Place',
      address: {
        '@type': 'PostalAddress',
        addressLocality: job.city || job.location || 'India',
        addressCountry: 'IN',
      },
    },
    directApply: true,
  };

  if (job.salary_min || job.salary_max) {
    schema.baseSalary = {
      '@type': 'MonetaryAmount',
      currency: job.salary_currency || 'INR',
      value: {
        '@type': 'QuantitativeValue',
        minValue: job.salary_min,
        maxValue: job.salary_max,
        unitText: 'YEAR',
      },
    };
  }

  return schema;
}

export function buildGovtJobPostingSchema(opts: {
  title: string;
  conductingBody?: string;
  location?: string;
  datePublished: string;
  dateModified: string;
  validThrough?: string;
  salaryMin?: number;
  salaryMax?: number;
  employmentType?: string;
  description?: string;
  slug: string;
  totalVacancies?: number;
}) {
  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org/',
    '@type': 'JobPosting',
    title: opts.title,
    datePosted: opts.datePublished,
    employmentType: opts.employmentType || 'FULL_TIME',
    hiringOrganization: {
      '@type': 'Organization',
      name: opts.conductingBody || 'Government of India',
      sameAs: SITE_URL,
    },
    jobLocation: {
      '@type': 'Place',
      address: {
        '@type': 'PostalAddress',
        addressLocality: opts.location || 'India',
        addressCountry: 'IN',
      },
    },
    directApply: false,
  };

  if (opts.validThrough && opts.validThrough.length > 0) {
    schema.validThrough = opts.validThrough;
  }

  if (opts.description) {
    schema.description = opts.description;
  }

  if (opts.totalVacancies) {
    schema.totalJobOpenings = opts.totalVacancies;
  }

  if (opts.salaryMin || opts.salaryMax) {
    schema.baseSalary = {
      '@type': 'MonetaryAmount',
      currency: 'INR',
      value: {
        '@type': 'QuantitativeValue',
        minValue: opts.salaryMin,
        maxValue: opts.salaryMax,
        unitText: 'MONTH',
      },
    };
  }

  return schema;
}
