import type { FAQItem } from './types';

export interface DepartmentJobPageConfig {
  department: string;
  deptKey: string; // e.g. "ssc" for DB query
  slug: string;
  h1: string;
  metaTitle: string;
  metaDescription: string;
  introContent: string;
  faqItems: FAQItem[];
}

interface DeptDef {
  key: string;
  name: string;
  fullName: string;
  body: string;
  website: string;
  exams: string[];
}

const DEPARTMENTS: DeptDef[] = [
  {
    key: 'ssc',
    name: 'SSC',
    fullName: 'Staff Selection Commission',
    body: 'Staff Selection Commission (SSC)',
    website: 'ssc.gov.in',
    exams: ['CGL', 'CHSL', 'MTS', 'GD Constable', 'CPO', 'Stenographer', 'JE', 'JHT'],
  },
  {
    key: 'railway',
    name: 'Railway',
    fullName: 'Indian Railways',
    body: 'Railway Recruitment Boards (RRBs)',
    website: 'rrbcdg.gov.in',
    exams: ['RRB NTPC', 'Railway Group D', 'RRB ALP', 'RRB JE', 'RPF Constable', 'RPF SI'],
  },
  {
    key: 'banking',
    name: 'Banking',
    fullName: 'Banking Sector',
    body: 'IBPS, SBI, RBI and other banking bodies',
    website: 'ibps.in',
    exams: ['IBPS PO', 'IBPS Clerk', 'IBPS SO', 'SBI PO', 'SBI Clerk', 'RBI Grade B', 'RBI Assistant'],
  },
  {
    key: 'defence',
    name: 'Defence',
    fullName: 'Indian Defence Forces',
    body: 'Indian Army, Navy, Air Force and paramilitary organizations',
    website: 'joinindianarmy.nic.in',
    exams: ['NDA', 'CDS', 'Agniveer Army', 'Agniveer Navy', 'Agniveer Air Force', 'AFCAT', 'Territorial Army'],
  },
  {
    key: 'upsc',
    name: 'UPSC',
    fullName: 'Union Public Service Commission',
    body: 'Union Public Service Commission (UPSC)',
    website: 'upsc.gov.in',
    exams: ['UPSC CSE (IAS/IPS)', 'UPSC CMS', 'UPSC CAPF', 'UPSC ESE', 'UPSC NDA', 'UPSC CDS', 'UPSC EPFO'],
  },
];

function buildDeptConfig(dept: DeptDef): DepartmentJobPageConfig {
  const slug = `${dept.key}-jobs`;
  return {
    department: dept.name,
    deptKey: dept.key,
    slug,
    h1: `${dept.name} Jobs 2026 – Latest Vacancies & Notifications`,
    metaTitle: `${dept.name} Jobs 2026 – Latest Recruitment Notifications`,
    metaDescription: `Find latest ${dept.name} jobs 2026. Complete list of ${dept.fullName} recruitment notifications with eligibility, exam dates, syllabus & apply links. Updated daily on TrueJobs.`,
    introContent: generateDeptIntro(dept),
    faqItems: generateDeptFAQs(dept),
  };
}

function generateDeptIntro(dept: DeptDef): string {
  const examList = dept.exams.join(', ');
  return `<h2>Latest ${dept.name} Recruitment 2026</h2>
<p>${dept.body} conducts recruitment for thousands of vacancies across India every year. ${dept.name} jobs are among the most sought-after government positions, offering competitive salaries, job security, allowances, and career growth opportunities. This page lists all the latest ${dept.name} recruitment notifications for 2026.</p>
<p>Major ${dept.name} examinations include ${examList}. These exams cover vacancies from Group-D support staff to officer-level positions, catering to candidates from 10th pass to post-graduate qualifications.</p>
<h3>Why Choose ${dept.name} Jobs?</h3>
<p>${dept.name} jobs are highly regarded for their stability, structured pay scales under the 7th Central Pay Commission, and comprehensive benefits including DA, HRA, transport allowance, medical facilities, and pension. Employees also receive annual increments, promotion opportunities, and posting preferences in various locations across India.</p>
<h3>${dept.name} Recruitment Process</h3>
<p>The recruitment process typically involves a written examination followed by document verification, physical tests (where applicable), and final merit preparation. Some positions may also require skill tests, typing tests, or interviews. Detailed exam patterns, syllabus, and selection criteria are available in the individual exam notification links below.</p>
<h3>How to Apply for ${dept.name} Jobs</h3>
<p>Browse the listings below to find the latest ${dept.name} job notifications. Each listing includes vacancy details, eligibility criteria, important dates, and application links. We update this page regularly so you don't miss any ${dept.name} recruitment opportunity. Visit the official website at ${dept.website} for detailed notifications.</p>`;
}

function generateDeptFAQs(dept: DeptDef): FAQItem[] {
  return [
    {
      question: `What are the latest ${dept.name} jobs in 2026?`,
      answer: `The latest ${dept.name} jobs 2026 include recruitments for ${dept.exams.slice(0, 4).join(', ')} and other positions. Check this page for a complete updated list of all ${dept.name} vacancies.`,
    },
    {
      question: `What is the eligibility for ${dept.name} jobs?`,
      answer: `Eligibility varies by position. ${dept.name} offers jobs for 10th pass, 12th pass, graduates, and post-graduates. Age limits typically range from 18-27 years for general category with relaxation for SC/ST/OBC/PH candidates.`,
    },
    {
      question: `How to apply for ${dept.name} recruitment 2026?`,
      answer: `Visit the official ${dept.name} website (${dept.website}) or click the apply link on the specific job notification listed on this page. Applications are typically submitted online with the required fee and documents.`,
    },
    {
      question: `What is the salary for ${dept.name} jobs?`,
      answer: `${dept.name} salaries follow the 7th Pay Commission pay matrix. Entry-level positions start from ₹18,000-25,000 per month (Level 1-3), while officer-level positions range from ₹44,900-56,100 per month (Level 7-8) plus DA, HRA, and other allowances.`,
    },
    {
      question: `When are ${dept.name} exams conducted?`,
      answer: `${dept.body} publishes an annual examination calendar. Major exams are typically conducted between March-November each year. Check individual notifications on this page for confirmed exam dates.`,
    },
  ];
}

const deptConfigMap = new Map<string, DepartmentJobPageConfig>();
const DEPT_SLUGS = new Set<string>();
DEPARTMENTS.forEach((dept) => {
  const config = buildDeptConfig(dept);
  deptConfigMap.set(config.slug, config);
  DEPT_SLUGS.add(config.slug);
});

export function getDepartmentJobConfig(slug: string): DepartmentJobPageConfig | undefined {
  const config = deptConfigMap.get(slug);
  if (!config) return undefined;
  const overrides = DEPT_META_OVERRIDES[slug];
  return overrides ? { ...config, ...overrides } : config;
}

/** Check if a slug matches the department allowlist to avoid conflicts with category pages */
export function isDepartmentSlug(slug: string): boolean {
  return DEPT_SLUGS.has(slug);
}

export function getAllDepartmentSlugs(): string[] {
  return Array.from(DEPT_SLUGS);
}

/**
 * CTR Override Map — per-slug overrides for metaTitle, metaDescription, or introContent.
 * Add entries here when GSC data shows weak CTR for specific departments.
 * Example:
 * 'ssc-jobs': { metaTitle: 'SSC Jobs 2026 – CGL, CHSL, GD & MTS Vacancies' },
 */
const DEPT_META_OVERRIDES: Record<string, Partial<Pick<DepartmentJobPageConfig, 'metaTitle' | 'metaDescription' | 'introContent'>>> = {};
