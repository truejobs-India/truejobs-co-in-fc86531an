import { PageTypePolicy, RouteCategory } from './seoRoutePolicyTypes';
import { SITE_URL } from '../seo-cache/cacheTypes';

// ── Page Type Policy Registry ───────────────────────────────────────

function seo(opts?: {
  breadcrumb?: boolean;
  schema?: string[];
  notes?: string;
}): PageTypePolicy {
  return {
    category: 'public-seo',
    expectedIndexability: 'index',
    isCacheServed: true,
    includeInSitemap: true,
    breadcrumbExpected: opts?.breadcrumb ?? true,
    schemaExpected: opts?.schema ?? [],
    notes: opts?.notes,
  };
}

function noindex(notes?: string): PageTypePolicy {
  return {
    category: 'public-noindex',
    expectedIndexability: 'noindex',
    isCacheServed: true,
    includeInSitemap: false,
    breadcrumbExpected: false,
    schemaExpected: [],
    notes,
  };
}

export const PAGE_TYPE_POLICIES: Record<string, PageTypePolicy> = {
  // ── Public SEO pages ──
  standalone:                seo({ breadcrumb: false, notes: 'Homepage or standalone landing' }),
  city:                      seo({ schema: ['JobPosting'] }),
  'state-govt':              seo({ schema: ['JobPosting'] }),
  category:                  seo({ schema: ['JobPosting'] }),
  industry:                  seo({ schema: ['JobPosting'] }),
  department:                seo({ schema: ['JobPosting'] }),
  qualification:             seo({ schema: ['JobPosting'] }),
  blog:                      seo({ schema: ['Article'] }),
  'govt-exam':               seo({ schema: ['JobPosting'] }),
  'employment-news':         seo({ schema: ['JobPosting'] }),
  'authority-exam':          seo(),
  'authority-notification':  seo(),
  'authority-syllabus':      seo(),
  'authority-salary':        seo(),
  'authority-cutoff':        seo(),
  'authority-previous-papers': seo(),
  'exam-hub':                seo(),
  'previous-year-paper':     seo(),
  'custom-role':             seo({ schema: ['JobPosting'] }),
  'custom-freshers':         seo({ schema: ['JobPosting'] }),
  'custom-combo':            seo({ schema: ['JobPosting'] }),
  'custom-intent':           seo({ schema: ['JobPosting'] }),
  'combo-state-qual':        seo({ schema: ['JobPosting'] }),
  'combo-dept-qual':         seo({ schema: ['JobPosting'] }),
  'combo-cat-qual':          seo({ schema: ['JobPosting'] }),
  'selection-state':         seo({ schema: ['JobPosting'] }),
  'discovery-hub':           seo(),

  // ── Public noindex pages ──
  'deadline-today':          noindex('Ephemeral – changes daily'),
  'deadline-week':           noindex('Ephemeral – changes weekly'),
  'deadline-month':          noindex('Ephemeral – changes monthly'),
};

// ── Derived sets (drop-in replacements for seoValidationEngine) ─────

export const NOINDEX_TYPES = new Set<string>(
  Object.entries(PAGE_TYPE_POLICIES)
    .filter(([, p]) => p.expectedIndexability === 'noindex')
    .map(([k]) => k)
);

export const BREADCRUMB_EXPECTED_TYPES = new Set<string>(
  Object.entries(PAGE_TYPE_POLICIES)
    .filter(([, p]) => p.breadcrumbExpected)
    .map(([k]) => k)
);

// ── App-Only Route Patterns ─────────────────────────────────────────

export const APP_ONLY_PATTERNS: string[] = [
  '/admin/*',
  '/employer/*',
  '/dashboard/*',
  '/profile/*',
  '/login',
  '/signup',
  '/phone-signup',
  '/forgot-password',
  '/saved-jobs',
  '/enrol-now',
  '/thankyou',
  '/offline',
];

export function isAppOnlyRoute(slug: string): boolean {
  // Normalise: ensure leading slash for matching
  const path = slug.startsWith('/') ? slug : `/${slug}`;
  return APP_ONLY_PATTERNS.some(pattern => {
    if (pattern.endsWith('/*')) {
      const prefix = pattern.slice(0, -2); // e.g. '/admin'
      return path === prefix || path.startsWith(prefix + '/');
    }
    return path === pattern;
  });
}

// ── Helpers ──────────────────────────────────────────────────────────

export function getPageTypePolicy(pageType: string): PageTypePolicy | null {
  return PAGE_TYPE_POLICIES[pageType] ?? null;
}

export function buildCanonicalUrl(slug: string): string {
  if (!slug || slug === '/' || slug === '') return SITE_URL;
  const clean = slug.replace(/^\/+/, '').replace(/\/+$/, '');
  return clean ? `${SITE_URL}/${clean}` : SITE_URL;
}
