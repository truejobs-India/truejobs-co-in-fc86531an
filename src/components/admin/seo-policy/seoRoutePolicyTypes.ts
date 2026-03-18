// ── SEO Route Policy – Shared Types ─────────────────────────────────

export type RouteCategory = 'public-seo' | 'public-noindex' | 'app-only';
export type PolicySource = 'page-type-policy' | 'app-only-pattern' | 'fallback';

export interface PageTypePolicy {
  category: RouteCategory;
  expectedIndexability: 'index' | 'noindex';
  isCacheServed: boolean;
  includeInSitemap: boolean;
  breadcrumbExpected: boolean;
  schemaExpected: string[];
  notes?: string;
}

/** A single input-fact evaluated against a route */
export interface EvidenceCriterion {
  key: string;
  label: string;
  passed: boolean;
  detail: string;
}

/** The derived policy decision for a route */
export interface PolicyOutput {
  category: RouteCategory;
  expectedIndexability: 'index' | 'noindex';
  includeInSitemap: boolean;
  isCacheServed: boolean;
  canonicalUrl: string;
  policySource: PolicySource;
  /** Set only when policySource is 'fallback' — the unmapped pageType that triggered fallback */
  fallbackPageType?: string;
}

export interface PolicyConflict {
  type: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface EvaluatedRoute {
  slug: string;
  title: string;
  pageType: string;
  evidence: EvidenceCriterion[];
  policy: PolicyOutput;
  conflicts: PolicyConflict[];
  reasonSummary: string;
  evidencePassed: number;
  evidenceFailed: number;
}
