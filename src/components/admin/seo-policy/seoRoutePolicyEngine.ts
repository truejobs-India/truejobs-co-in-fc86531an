import {
  EvidenceCriterion, PolicyOutput, PolicyConflict, EvaluatedRoute,
} from './seoRoutePolicyTypes';
import { PageData } from '../seo-cache/cacheTypes';
import {
  isAppOnlyRoute, getPageTypePolicy, buildCanonicalUrl,
  NOINDEX_TYPES, APP_ONLY_PATTERNS, PAGE_TYPE_POLICIES,
} from './seoRoutePolicyRegistry';

// ── User-specific slug patterns ─────────────────────────────────────

const USER_SPECIFIC_PATTERNS = [
  '/saved-jobs', '/profile', '/dashboard', '/enrol-now', '/thankyou',
];

function isUserSpecificSlug(slug: string): boolean {
  const path = slug.startsWith('/') ? slug : `/${slug}`;
  return USER_SPECIFIC_PATTERNS.some(p => path === p || path.startsWith(p + '/'));
}

function isAdminOrInternalSlug(slug: string): boolean {
  const path = slug.startsWith('/') ? slug : `/${slug}`;
  return path.startsWith('/admin') || path.startsWith('/employer');
}

// ── Evidence evaluation (9 input-fact checks) ───────────────────────

export function evaluateEvidence(
  slug: string,
  title: string,
  pageType: string,
  inventoryEntry?: PageData | null,
): EvidenceCriterion[] {
  const appOnly = isAppOnlyRoute(slug);

  return [
    {
      key: 'publicly-accessible',
      label: 'Publicly accessible',
      passed: !appOnly,
      detail: appOnly ? `Matches app-only pattern` : 'Not behind auth gate',
    },
    {
      key: 'search-intent',
      label: 'Has standalone search intent',
      passed: !NOINDEX_TYPES.has(pageType) && !appOnly,
      detail: NOINDEX_TYPES.has(pageType)
        ? `Ephemeral page type "${pageType}"`
        : appOnly ? 'App-only route' : 'Standalone search intent',
    },
    {
      key: 'unique-content',
      label: 'Has meaningful unique content',
      passed: appOnly
        ? false
        : Boolean(title && inventoryEntry?.introContent),
      detail: appOnly
        ? 'N/A — app route'
        : !title
          ? 'Missing title'
          : !inventoryEntry?.introContent
            ? 'Missing intro content in inventory'
            : 'Title and intro content present',
    },
    {
      key: 'content-metadata',
      label: 'Content metadata present',
      passed: Boolean(inventoryEntry?.metaDescription),
      detail: inventoryEntry?.metaDescription
        ? `Meta description: ${inventoryEntry.metaDescription.length} chars`
        : 'No meta description in inventory',
    },
    {
      key: 'not-user-specific',
      label: 'Not user-specific',
      passed: !isUserSpecificSlug(slug),
      detail: isUserSpecificSlug(slug) ? 'User-specific route' : 'Not personalised',
    },
    {
      key: 'not-internal',
      label: 'Not admin/internal route',
      passed: !isAdminOrInternalSlug(slug),
      detail: isAdminOrInternalSlug(slug) ? 'Admin or employer route' : 'Public route',
    },
    {
      key: 'canonical-constructible',
      label: 'Canonical route constructible',
      passed: slug !== undefined && slug !== null,
      detail: `Canonical: ${buildCanonicalUrl(slug)}`,
    },
    {
      key: 'not-ephemeral',
      label: 'Not thin/ephemeral by policy',
      passed: !NOINDEX_TYPES.has(pageType),
      detail: NOINDEX_TYPES.has(pageType)
        ? `"${pageType}" is ephemeral`
        : 'Not ephemeral',
    },
    {
      key: 'approved-page-type',
      label: 'Approved page type (has policy mapping)',
      passed: Boolean(getPageTypePolicy(pageType)),
      detail: getPageTypePolicy(pageType)
        ? `Mapped to "${getPageTypePolicy(pageType)!.category}"`
        : `No policy mapping for "${pageType}"`,
    },
  ];
}

// ── Policy derivation ───────────────────────────────────────────────

export function derivePolicy(
  slug: string,
  pageType: string,
  _evidence: EvidenceCriterion[],
): PolicyOutput {
  const canonical = buildCanonicalUrl(slug);

  // 1. App-only pattern
  if (isAppOnlyRoute(slug)) {
    return {
      category: 'app-only',
      expectedIndexability: 'noindex',
      includeInSitemap: false,
      isCacheServed: false,
      canonicalUrl: canonical,
      policySource: 'app-only-pattern',
    };
  }

  // 2. Page-type policy
  const policy = getPageTypePolicy(pageType);
  if (policy) {
    return {
      category: policy.category,
      expectedIndexability: policy.expectedIndexability,
      includeInSitemap: policy.includeInSitemap,
      isCacheServed: policy.isCacheServed,
      canonicalUrl: canonical,
      policySource: 'page-type-policy',
    };
  }

  // 3. Fallback — conservative: noindex, no sitemap, no cache until explicitly mapped
  return {
    category: 'public-noindex',
    expectedIndexability: 'noindex',
    includeInSitemap: false,
    isCacheServed: false,
    canonicalUrl: canonical,
    policySource: 'fallback',
  };
}

// ── Conflict detection ──────────────────────────────────────────────

export function detectConflicts(
  slug: string,
  policy: PolicyOutput,
  isInInventory: boolean,
): PolicyConflict[] {
  const conflicts: PolicyConflict[] = [];

  // public-seo + sitemap=false
  if (policy.category === 'public-seo' && !policy.includeInSitemap) {
    conflicts.push({
      type: 'public-seo-no-sitemap',
      message: 'Public SEO page is excluded from sitemap.',
      severity: 'error',
    });
  }

  // public-seo + noindex
  if (policy.category === 'public-seo' && policy.expectedIndexability === 'noindex') {
    conflicts.push({
      type: 'public-seo-noindex',
      message: 'Public SEO page is set to noindex — contradictory.',
      severity: 'error',
    });
  }

  // app-only in SEO inventory
  if (policy.category === 'app-only' && isInInventory) {
    conflicts.push({
      type: 'app-only-in-inventory',
      message: 'App-only route appears in SEO inventory — should not be cached.',
      severity: 'warning',
    });
  }

  // Missing canonical
  if (!policy.canonicalUrl) {
    conflicts.push({
      type: 'missing-canonical',
      message: 'No canonical URL could be constructed.',
      severity: 'warning',
    });
  }

  // cache-served + app-only
  if (policy.isCacheServed && policy.category === 'app-only') {
    conflicts.push({
      type: 'cache-app-only',
      message: 'Cache-served is enabled for an app-only route — contradictory.',
      severity: 'error',
    });
  }

  // sitemap + noindex
  if (policy.includeInSitemap && policy.expectedIndexability === 'noindex') {
    conflicts.push({
      type: 'sitemap-noindex',
      message: 'Route is in sitemap but set to noindex.',
      severity: 'error',
    });
  }

  // inventory-without-policy
  if (isInInventory && policy.policySource === 'fallback') {
    conflicts.push({
      type: 'inventory-without-policy',
      message: 'Route appears in SEO inventory but has no policy mapping — classification may be incorrect.',
      severity: 'error',
    });
  }

  // Fallback classification
  if (policy.policySource === 'fallback') {
    conflicts.push({
      type: 'fallback-classification',
      message: 'Route classified via fallback — no explicit policy mapping exists. Review and add a page type policy.',
      severity: 'warning',
    });
  }

  return conflicts;
}

// ── Reason summary ──────────────────────────────────────────────────

export function generateReasonSummary(
  evidence: EvidenceCriterion[],
  policy: PolicyOutput,
): string {
  const passedCount = evidence.filter(e => e.passed).length;
  const total = evidence.length;

  const sourceLabel = policy.policySource === 'page-type-policy'
    ? 'page type policy'
    : policy.policySource === 'app-only-pattern'
      ? 'app-only route pattern'
      : 'fallback logic';

  const base = `Classified as "${policy.category}" via ${sourceLabel}. ` +
    `${passedCount}/${total} evidence criteria passed. ` +
    `${policy.expectedIndexability === 'index' ? 'Indexable' : 'Not indexable'}, ` +
    `${policy.includeInSitemap ? 'in sitemap' : 'not in sitemap'}, ` +
    `${policy.isCacheServed ? 'cache-served' : 'not cached'}.`;

  if (policy.policySource === 'fallback') {
    return `REVIEW NEEDED: ${base}`;
  }
  return base;
}

// ── Orchestrator ────────────────────────────────────────────────────

export function evaluateRoute(
  slug: string,
  title: string,
  pageType: string,
  inventoryEntry?: PageData | null,
): EvaluatedRoute {
  const evidence = evaluateEvidence(slug, title, pageType, inventoryEntry);
  const policy = derivePolicy(slug, pageType, evidence);
  const isInInventory = Boolean(inventoryEntry);
  const conflicts = detectConflicts(slug, policy, isInInventory);
  const reasonSummary = generateReasonSummary(evidence, policy);

  return {
    slug,
    title,
    pageType,
    evidence,
    policy,
    conflicts,
    reasonSummary,
    evidencePassed: evidence.filter(e => e.passed).length,
    evidenceFailed: evidence.filter(e => !e.passed).length,
  };
}

// ── Batch evaluator ─────────────────────────────────────────────────

export function evaluateAllRoutes(inventory: PageData[]): EvaluatedRoute[] {
  const results: EvaluatedRoute[] = [];

  // Evaluate all inventory pages
  for (const page of inventory) {
    results.push(evaluateRoute(page.slug, page.title, page.pageType, page));
  }

  // Synthesise app-only routes from patterns (representative/synthetic entries)
  const appOnlyRepresentatives = APP_ONLY_PATTERNS.map(pattern => {
    const slug = pattern.endsWith('/*') ? pattern.slice(1, -2) : pattern.slice(1);
    return slug;
  });

  const inventorySlugs = new Set(inventory.map(p => p.slug));
  for (const slug of appOnlyRepresentatives) {
    if (!inventorySlugs.has(slug)) {
      results.push(evaluateRoute(slug, `[Pattern] App route: /${slug}`, 'app-only', null));
    }
  }

  return results;
}
