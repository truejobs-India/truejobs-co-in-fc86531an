/**
 * Shared department mapping for Sarkari Jobs pages.
 * Single source of truth — imported by SarkariJobs.tsx, GovtExamDetail.tsx, etc.
 */

export interface DeptConfig {
  label: string;
  shortLabel: string;
  /** Builds a Supabase filter. Returns the query with filters applied. */
  applyFilter: (query: any) => any;
}

export const VALID_DEPT_SLUGS = new Set([
  'railway', 'ssc', 'banking', 'upsc', 'defence', 'teaching', 'police', 'psu', 'state',
]);

export const DEPT_CONFIG: Record<string, DeptConfig> = {
  railway: {
    label: 'Railway Government Jobs 2026',
    shortLabel: 'Railway',
    applyFilter: (q) => q.or('job_category.eq.Railway,org_name.ilike.%Railway%'),
  },
  ssc: {
    label: 'SSC Government Jobs 2026',
    shortLabel: 'SSC',
    applyFilter: (q) => q.or('org_name.ilike.%SSC%,org_name.ilike.%Staff Selection%'),
  },
  banking: {
    label: 'Banking Government Jobs 2026',
    shortLabel: 'Banking',
    applyFilter: (q) => q.eq('job_category', 'Banking'),
  },
  upsc: {
    label: 'UPSC Government Jobs 2026',
    shortLabel: 'UPSC',
    applyFilter: (q) => q.or('org_name.ilike.%UPSC%,org_name.ilike.%Union Public Service%'),
  },
  defence: {
    label: 'Defence Government Jobs 2026',
    shortLabel: 'Defence',
    applyFilter: (q) => q.eq('job_category', 'Defence'),
  },
  teaching: {
    label: 'Teaching Government Jobs 2026',
    shortLabel: 'Teaching',
    applyFilter: (q) => q.eq('job_category', 'Teaching'),
  },
  police: {
    label: 'Police & Paramilitary Jobs 2026',
    shortLabel: 'Police',
    applyFilter: (q) => q.or('org_name.ilike.%Police%,org_name.ilike.%CRPF%,org_name.ilike.%BSF%,org_name.ilike.%CISF%,org_name.ilike.%ITBP%,org_name.ilike.%SSB%'),
  },
  psu: {
    label: 'PSU Government Jobs 2026',
    shortLabel: 'PSU',
    applyFilter: (q) => q.eq('job_category', 'PSU'),
  },
  state: {
    label: 'State Government Jobs 2026',
    shortLabel: 'State Govt',
    applyFilter: (q) => q.eq('job_category', 'State Government'),
  },
};

export const DEPT_OPTIONS = [
  { value: 'all', label: 'All Departments' },
  ...Object.entries(DEPT_CONFIG).map(([value, c]) => ({ value, label: c.shortLabel })),
];

export function getDeptLabel(slug: string): string {
  return DEPT_CONFIG[slug]?.label || 'Government Jobs';
}

export function isDeptSlug(slug: string): boolean {
  return VALID_DEPT_SLUGS.has(slug);
}
