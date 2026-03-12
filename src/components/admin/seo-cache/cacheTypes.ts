export interface PageData {
  slug: string;
  pageType: string;
  title: string;
  h1: string;
  metaDescription: string;
  introContent: string;
  faqItems: { question: string; answer: string }[];
  datePublished: string;
  lastUpdated: string;
  crossLinks: { label: string; slug: string }[];
}

export type CacheStatus = 'cached' | 'missing' | 'stale' | 'queued' | 'rebuilding' | 'failed';

export interface CachePage {
  slug: string;
  pageType: string;
  title: string;
  status: CacheStatus;
  headHtml: string | null;
  bodyHtml: string | null;
  contentHash: string | null;
  cacheUpdatedAt: string | null;
  sourceUpdatedAt: string | null;
  inventoryEntry: PageData | null;
}

export interface CacheStats {
  totalCacheable: number;
  cached: number;
  missing: number;
  stale: number;
  failed: number;
  queuePending: number;
  coveragePercent: number;
  lastFullBuild: string | null;
  lastIncrementalBuild: string | null;
}

export type AuditSeverity = 'error' | 'warning' | 'info';

export interface GlobalAuditResult {
  severity: AuditSeverity;
  category: string;
  message: string;
  slugs: string[];
}

export interface ValidationCheck {
  label: string;
  passed: boolean;
  detail?: string;
}

export interface CacheFiltersState {
  search: string;
  pageType: string;
  status: string;
  quickFilter: 'all' | 'missing' | 'stale' | 'failed' | 'recent';
}

export const STATUS_PRIORITY: Record<CacheStatus, number> = {
  failed: 0,
  missing: 1,
  stale: 2,
  queued: 3,
  rebuilding: 4,
  cached: 5,
};

export const SITE_URL = 'https://truejobs.co.in';

export const PAGE_TYPES = [
  'standalone', 'city', 'category', 'industry', 'authority-exam',
  'authority-notification', 'authority-syllabus', 'authority-salary',
  'authority-cutoff', 'authority-previous-papers', 'exam-hub',
  'previous-year-paper', 'state-govt', 'department', 'qualification',
  'custom-role', 'custom-freshers', 'custom-combo', 'custom-intent',
  'combo-state-qual', 'combo-dept-qual', 'combo-cat-qual',
  'selection-state', 'deadline-today', 'deadline-week', 'deadline-month',
  'discovery-hub', 'blog', 'govt-exam', 'employment-news',
];

// ── Validation Layer Types ──────────────────────────────────────────

export type ValidationSeverity = 'pass' | 'warning' | 'fail';
export type ValidationCategory = 'seo-basics' | 'schema' | 'content-quality' | 'consistency';

export interface ValidationCheckResult {
  id: string;
  label: string;
  severity: ValidationSeverity;
  detail: string;
  fix: string;
  category: ValidationCategory;
}

export interface PageValidationReport {
  slug: string;
  pageType: string;
  title: string;
  checks: ValidationCheckResult[];
  worstSeverity: ValidationSeverity;
  failCount: number;
  warnCount: number;
  passCount: number;
}
