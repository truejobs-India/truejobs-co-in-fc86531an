/**
 * QUARTERLY UPDATE CHECKLIST (run every 3 months)
 *
 * 1. Update `lastUpdated` to current date in each exam config file
 * 2. Notification pages: update application dates, vacancy count, fee table
 * 3. Cutoff data: add latest year's cutoff rows to `cutoffs` array
 * 4. Admit card: update download link and release date in `admitCardInfo`
 * 5. Result: update declaration date and merit list URL in `resultInfo`
 * 6. Syllabus: verify `syllabusSummary` against official notification
 * 7. Replace any "TBA" / "To Be Announced" with actual data
 * 8. Run SEO Content Health check from admin panel to verify
 * 9. Rebuild SEO cache after all updates
 *
 * Use the SEOContentHealth admin panel to identify stale pages automatically.
 */
import type { ExamAuthorityConfig } from './types';
import { SSC_CGL_CONFIGS } from './ssc-cgl';
import { SSC_CHSL_CONFIGS } from './ssc-chsl';
import { SSC_GD_CONFIGS } from './ssc-gd';
import { SSC_MTS_CONFIGS } from './ssc-mts';
import { SSC_CPO_CONFIGS } from './ssc-cpo';
import { RRB_NTPC_CONFIGS } from './rrb-ntpc';
import { RAILWAY_GROUP_D_CONFIGS } from './railway-group-d';
import { RRB_ALP_CONFIGS } from './rrb-alp';
import { RRB_JE_CONFIGS } from './rrb-je';
import { IBPS_PO_CONFIGS } from './ibps-po';
import { IBPS_CLERK_CONFIGS } from './ibps-clerk';
import { SBI_PO_CONFIGS } from './sbi-po';
import { SBI_CLERK_CONFIGS } from './sbi-clerk';
import { UPSC_CSE_CONFIGS } from './upsc-cse';
import { AGNIVEER_CONFIGS } from './agniveer';
import { NDA_CONFIGS } from './nda';

const registry = new Map<string, ExamAuthorityConfig>();

const ALL_CONFIGS: ExamAuthorityConfig[][] = [
  SSC_CGL_CONFIGS,
  SSC_CHSL_CONFIGS,
  SSC_GD_CONFIGS,
  SSC_MTS_CONFIGS,
  SSC_CPO_CONFIGS,
  RRB_NTPC_CONFIGS,
  RAILWAY_GROUP_D_CONFIGS,
  RRB_ALP_CONFIGS,
  RRB_JE_CONFIGS,
  IBPS_PO_CONFIGS,
  IBPS_CLERK_CONFIGS,
  SBI_PO_CONFIGS,
  SBI_CLERK_CONFIGS,
  UPSC_CSE_CONFIGS,
  AGNIVEER_CONFIGS,
  NDA_CONFIGS,
];

ALL_CONFIGS.forEach(group => group.forEach(config => registry.set(config.slug, config)));

// Phase B+F validation: registry must contain exactly 112 authority page slugs (88 Wave1 + 24 Wave2)
if (registry.size !== 112) {
  throw new Error(`ExamAuthority registry expected 112 slugs, got ${registry.size}`);
}

export function getExamAuthorityConfig(slug: string): ExamAuthorityConfig | undefined {
  return registry.get(slug);
}

export function getAllExamAuthoritySlugs(): string[] {
  return Array.from(registry.keys());
}

export type { ExamAuthorityConfig } from './types';
