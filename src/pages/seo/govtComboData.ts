import type { FAQItem } from './types';

/**
 * Wave 3 — Combination programmatic pages:
 * 1. Dept+State: /ssc-jobs-bihar (75 pages)
 * 2. Dept+Qual: /ssc-graduate-jobs (30 pages)
 * 3. State Closing-Soon: /govt-jobs-bihar-closing-soon (15 pages)
 * 4. Without-exam+State: handled by selectionPageData.ts (already exists)
 */

export type ComboType = 'dept-state' | 'dept-qual' | 'closing-soon';

export interface ComboPageConfig {
  slug: string;
  comboType: ComboType;
  h1: string;
  metaTitle: string;
  metaDescription: string;
  introContent: string;
  faqItems: FAQItem[];
  dbFilters: {
    departmentKey?: string;
    stateSlug?: string;
    qualTag?: string;
    closingSoon?: boolean;
  };
  crossLinks: { label: string; href: string }[];
}

// ── Departments ──
interface DeptDef { key: string; name: string; fullName: string; exams: string[] }

const DEPARTMENTS: DeptDef[] = [
  { key: 'ssc', name: 'SSC', fullName: 'Staff Selection Commission', exams: ['CGL', 'CHSL', 'MTS', 'GD Constable', 'CPO'] },
  { key: 'railway', name: 'Railway', fullName: 'Indian Railways', exams: ['RRB NTPC', 'Group D', 'RRB ALP', 'RRB JE'] },
  { key: 'banking', name: 'Banking', fullName: 'Banking Sector', exams: ['IBPS PO', 'IBPS Clerk', 'SBI PO', 'SBI Clerk'] },
  { key: 'defence', name: 'Defence', fullName: 'Indian Defence Forces', exams: ['NDA', 'CDS', 'Agniveer', 'AFCAT'] },
  { key: 'upsc', name: 'UPSC', fullName: 'Union Public Service Commission', exams: ['UPSC CSE', 'CMS', 'CAPF', 'ESE'] },
];

// ── Top 15 states by search volume ──
const TOP_STATES: [string, string][] = [
  ['uttar-pradesh', 'Uttar Pradesh'],
  ['bihar', 'Bihar'],
  ['rajasthan', 'Rajasthan'],
  ['madhya-pradesh', 'Madhya Pradesh'],
  ['maharashtra', 'Maharashtra'],
  ['delhi', 'Delhi'],
  ['haryana', 'Haryana'],
  ['karnataka', 'Karnataka'],
  ['tamil-nadu', 'Tamil Nadu'],
  ['west-bengal', 'West Bengal'],
  ['punjab', 'Punjab'],
  ['jharkhand', 'Jharkhand'],
  ['chhattisgarh', 'Chhattisgarh'],
  ['odisha', 'Odisha'],
  ['gujarat', 'Gujarat'],
];

// ── Qualifications ──
interface QualDef { slug: string; tag: string; label: string; fullLabel: string }

const QUALIFICATIONS: QualDef[] = [
  { slug: '10th-pass', tag: '10th', label: '10th Pass', fullLabel: '10th Pass (Matriculation)' },
  { slug: '12th-pass', tag: '12th', label: '12th Pass', fullLabel: '12th Pass (Intermediate)' },
  { slug: 'graduate', tag: 'graduate', label: 'Graduate', fullLabel: 'Graduate (Bachelor\'s Degree)' },
  { slug: 'post-graduate', tag: 'post-graduate', label: 'Post Graduate', fullLabel: 'Post Graduate (Master\'s Degree)' },
  { slug: 'diploma', tag: 'diploma', label: 'Diploma', fullLabel: 'Diploma Holders' },
  { slug: 'iti', tag: 'iti', label: 'ITI', fullLabel: 'ITI Certificate Holders' },
];

function titleCase(s: string): string {
  return s.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

// ── Registries ──
const COMBO_REGISTRY = new Map<string, ComboPageConfig>();

// ── 1. Dept+State (75 pages) ──
for (const dept of DEPARTMENTS) {
  for (const [stateSlug, stateName] of TOP_STATES) {
    const slug = `${dept.key}-jobs-${stateSlug}`;
    const config: ComboPageConfig = {
      slug,
      comboType: 'dept-state',
      h1: `${dept.name} Jobs in ${stateName} 2026`,
      metaTitle: `${dept.name} Jobs in ${stateName} 2026 – Latest Vacancies`,
      metaDescription: `Find latest ${dept.name} jobs in ${stateName} 2026. ${dept.fullName} recruitment vacancies with eligibility, dates & apply links for ${stateName} candidates. Updated daily.`,
      introContent: generateDeptStateIntro(dept, stateName),
      faqItems: generateDeptStateFAQs(dept, stateName),
      dbFilters: { departmentKey: dept.key, stateSlug: stateSlug.replace(/-/g, ' ') },
      crossLinks: buildDeptStateCrossLinks(dept, stateSlug, stateName),
    };
    COMBO_REGISTRY.set(slug, config);
  }
}

// ── 2. Dept+Qual (30 pages) ──
for (const dept of DEPARTMENTS) {
  for (const qual of QUALIFICATIONS) {
    const slug = `${dept.key}-${qual.slug}-jobs`;
    const config: ComboPageConfig = {
      slug,
      comboType: 'dept-qual',
      h1: `${dept.name} ${qual.label} Jobs 2026`,
      metaTitle: `${dept.name} ${qual.label} Jobs 2026 – Vacancies & Eligibility`,
      metaDescription: `Latest ${dept.name} jobs for ${qual.fullLabel} in 2026. Find ${dept.fullName} recruitment matching ${qual.label.toLowerCase()} qualification with exam dates, syllabus & apply links.`,
      introContent: generateDeptQualIntro(dept, qual),
      faqItems: generateDeptQualFAQs(dept, qual),
      dbFilters: { departmentKey: dept.key, qualTag: qual.tag },
      crossLinks: buildDeptQualCrossLinks(dept, qual),
    };
    COMBO_REGISTRY.set(slug, config);
  }
}

// ── 3. State Closing-Soon (15 pages) ──
for (const [stateSlug, stateName] of TOP_STATES) {
  const slug = `govt-jobs-${stateSlug}-closing-soon`;
  const config: ComboPageConfig = {
    slug,
    comboType: 'closing-soon',
    h1: `Govt Jobs in ${stateName} – Closing Soon 2026`,
    metaTitle: `Govt Jobs ${stateName} Closing Soon – Last Date This Week`,
    metaDescription: `Government jobs in ${stateName} closing soon! Apply before the deadline. SSC, Railway, Banking & state govt vacancies with last dates this week. Don't miss out!`,
    introContent: generateClosingSoonIntro(stateName),
    faqItems: generateClosingSoonFAQs(stateName),
    dbFilters: { stateSlug: stateSlug.replace(/-/g, ' '), closingSoon: true },
    crossLinks: buildClosingSoonCrossLinks(stateSlug, stateName),
  };
  COMBO_REGISTRY.set(slug, config);
}

// ── Public API ──
export function getComboPageConfig(slug: string): ComboPageConfig | undefined {
  return COMBO_REGISTRY.get(slug);
}

export function isComboSlug(slug: string): boolean {
  return COMBO_REGISTRY.has(slug);
}

export function getAllComboSlugs(): string[] {
  return Array.from(COMBO_REGISTRY.keys());
}

// ── Content generators ──

function generateDeptStateIntro(dept: DeptDef, state: string): string {
  return `<h2>Latest ${dept.name} Jobs in ${state}</h2>
<p>Looking for ${dept.fullName} recruitment opportunities in ${state}? This page lists all the latest ${dept.name} job notifications that have vacancies or exam centres in ${state}. Whether you are preparing for ${dept.exams.slice(0, 3).join(', ')} or other ${dept.name} examinations, you'll find relevant openings updated daily.</p>
<p>${dept.fullName} regularly conducts nationwide examinations with postings available across India, including multiple locations in ${state}. Central government positions through ${dept.name} offer competitive salaries under the 7th Pay Commission, job security, DA, HRA, medical benefits, and pension.</p>
<h3>Types of ${dept.name} Jobs Available in ${state}</h3>
<p>${dept.name} jobs in ${state} span multiple levels — from Group-D support staff to officer-level positions. Candidates from ${state} can apply for all-India level ${dept.name} examinations and get postings in their home state based on preference and merit ranking.</p>
<h3>How to Apply</h3>
<p>Browse the listings below for the latest ${dept.name} vacancies relevant to ${state}. Each listing shows the exam name, vacancies, eligibility, last date, and direct links to official notifications and application forms. Bookmark this page for regular updates.</p>`;
}

function generateDeptStateFAQs(dept: DeptDef, state: string): FAQItem[] {
  return [
    { question: `What are the latest ${dept.name} jobs in ${state}?`, answer: `The latest ${dept.name} jobs in ${state} include recruitments for ${dept.exams.slice(0, 3).join(', ')} and other positions with postings available in ${state}. Check this page for the updated list.` },
    { question: `Can I get ${dept.name} posting in ${state}?`, answer: `Yes, ${dept.name} examinations are conducted at all-India level. Candidates can select ${state} as a posting preference. Final posting depends on vacancy availability and merit ranking.` },
    { question: `What is the eligibility for ${dept.name} jobs in ${state}?`, answer: `Eligibility varies by exam. ${dept.name} offers jobs for 10th pass to post-graduate candidates. Age limits are typically 18-27 years for general category with relaxation for reserved categories.` },
  ];
}

function buildDeptStateCrossLinks(dept: DeptDef, stateSlug: string, stateName: string): { label: string; href: string }[] {
  return [
    { label: `All ${dept.name} Jobs`, href: `/${dept.key}-jobs` },
    { label: `All Govt Jobs in ${stateName}`, href: `/govt-jobs-${stateSlug}` },
    { label: `${stateName} Closing Soon`, href: `/govt-jobs-${stateSlug}-closing-soon` },
    { label: 'Latest Sarkari Jobs', href: '/sarkari-jobs' },
    { label: 'Age Calculator', href: '/govt-job-age-calculator' },
  ];
}

function generateDeptQualIntro(dept: DeptDef, qual: QualDef): string {
  return `<h2>${dept.name} Jobs for ${qual.label} Candidates</h2>
<p>Looking for ${dept.fullName} recruitment notifications suitable for ${qual.fullLabel}? This page lists all ${dept.name} examinations that accept ${qual.label.toLowerCase()} qualification. These government positions offer competitive salaries, job security, and career growth opportunities.</p>
<p>${dept.name} conducts multiple examinations every year targeting different qualification levels. For ${qual.label.toLowerCase()} candidates, the primary exams include ${dept.exams.slice(0, 3).join(', ')}. Each exam has specific eligibility requirements — check individual notifications for detailed qualification criteria.</p>
<h3>Benefits of ${dept.name} Jobs for ${qual.label} Holders</h3>
<p>Government jobs through ${dept.name} for ${qual.label.toLowerCase()} candidates typically fall in Pay Level 1-5 of the 7th CPC pay matrix. Benefits include DA, HRA, transport allowance, medical facilities, LTC, and pension under NPS. Employees also receive annual increments and promotion opportunities.</p>
<h3>How to Apply</h3>
<p>Browse the ${dept.name} recruitment listings below filtered for ${qual.label.toLowerCase()} eligibility. Each listing shows vacancy details, eligibility criteria, important dates, and application links. We update this page regularly so you don't miss any relevant opportunity.</p>`;
}

function generateDeptQualFAQs(dept: DeptDef, qual: QualDef): FAQItem[] {
  return [
    { question: `Which ${dept.name} exams can I apply for with ${qual.label} qualification?`, answer: `${qual.label} candidates can apply for ${dept.exams.slice(0, 4).join(', ')} and other ${dept.name} positions matching ${qual.label.toLowerCase()} eligibility. Check individual notifications for specific requirements.` },
    { question: `What is the salary for ${dept.name} ${qual.label} jobs?`, answer: `Salary varies by position. Entry-level ${dept.name} positions for ${qual.label.toLowerCase()} candidates start from ₹18,000-25,000 per month (Level 1-3 of 7th CPC) plus DA, HRA, and other allowances.` },
    { question: `What is the age limit for ${dept.name} ${qual.label} jobs?`, answer: `Age limits typically range from 18-27 years for general category. SC/ST candidates get 5 years relaxation, OBC gets 3 years, and PH candidates get up to 10 years relaxation.` },
  ];
}

function buildDeptQualCrossLinks(dept: DeptDef, qual: QualDef): { label: string; href: string }[] {
  return [
    { label: `All ${dept.name} Jobs`, href: `/${dept.key}-jobs` },
    { label: `All ${qual.label} Govt Jobs`, href: `/${qual.slug}-govt-jobs` },
    { label: `${qual.label} Jobs Without Exam`, href: `/${qual.slug}-govt-jobs-without-exam` },
    { label: 'Latest Sarkari Jobs', href: '/sarkari-jobs' },
    { label: 'Salary Calculator', href: '/govt-salary-calculator' },
  ];
}

function generateClosingSoonIntro(state: string): string {
  return `<h2>Government Jobs Closing Soon in ${state}</h2>
<p>Don't miss the deadline! This page lists all government job notifications with application deadlines approaching in the next 7 days for ${state}. These vacancies are from SSC, Railway, Banking, Defence, UPSC, and state government bodies with postings in ${state}.</p>
<p>Many candidates miss out on government job opportunities simply because they didn't apply before the last date. We update this page daily so you can track every closing deadline for sarkari naukri in ${state} and submit your applications on time.</p>
<h3>How to Use This Page</h3>
<p>All listings below are sorted by deadline — jobs closing soonest appear first. Look for the "Closing Today" and "Closing Tomorrow" badges to identify the most urgent applications. Click on any listing to view the full notification with eligibility details and the official apply link.</p>
<h3>Tips to Apply Before the Deadline</h3>
<p>Keep your documents ready: passport photo, signature, educational certificates, caste/EWS certificate (if applicable), and Aadhaar card. Complete the online form well before the deadline as websites often slow down on the last day. Pay the application fee online or through the designated bank challans as specified in the notification.</p>`;
}

function generateClosingSoonFAQs(state: string): FAQItem[] {
  return [
    { question: `Which govt jobs in ${state} are closing soon?`, answer: `Check the listings above for all government jobs in ${state} with deadlines in the next 7 days. We update this page daily with the latest closing dates.` },
    { question: `Can I apply after the last date?`, answer: `No, government job applications typically close at 11:59 PM on the last date. Late applications are not accepted. We recommend applying at least 2-3 days before the deadline.` },
    { question: `How do I get alerts for jobs closing soon in ${state}?`, answer: `Bookmark this page and check regularly. You can also subscribe to our email alerts or follow us on Telegram for instant notifications about closing deadlines.` },
  ];
}

function buildClosingSoonCrossLinks(stateSlug: string, stateName: string): { label: string; href: string }[] {
  return [
    { label: `All Govt Jobs in ${stateName}`, href: `/govt-jobs-${stateSlug}` },
    { label: `Jobs Without Exam in ${stateName}`, href: `/govt-jobs-without-exam-${stateSlug}` },
    { label: 'Latest Sarkari Jobs', href: '/sarkari-jobs' },
    { label: 'SSC Jobs', href: '/ssc-jobs' },
    { label: 'Railway Jobs', href: '/railway-jobs' },
    { label: 'Age Calculator', href: '/govt-job-age-calculator' },
  ];
}
