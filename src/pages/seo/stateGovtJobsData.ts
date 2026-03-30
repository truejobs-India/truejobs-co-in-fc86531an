import type { FAQItem } from './types';
import { stateContentOverrides } from '@/data/stateContentOverrides';

export interface StateGovtJobPageConfig {
  state: string;
  slug: string;
  stateSlug: string; // used for DB query e.g. "uttar pradesh"
  h1: string;
  metaTitle: string;
  metaDescription: string;
  introContent: string;
  faqItems: FAQItem[];
}

function titleCase(s: string): string {
  return s.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

/**
 * Manual overrides for state names that can't be derived by simple title-casing.
 * Maps the URL slug portion (without "govt-jobs-") to the exact DB `state` column value.
 */
const STATE_DB_NAME_MAP: Record<string, string> = {
  'jammu-kashmir': 'Jammu & Kashmir',
  'dadra-nagar-haveli': 'Dadra & Nagar Haveli',
  'daman-diu': 'Daman & Diu',
  'andaman-nicobar': 'Andaman & Nicobar',
};

/**
 * Returns the DB-compatible state name for querying employment_news_jobs.state
 */
export function getStateDBName(stateSlug: string): string {
  if (STATE_DB_NAME_MAP[stateSlug]) return STATE_DB_NAME_MAP[stateSlug];
  return titleCase(stateSlug);
}

function buildStateConfig(stateSlug: string, stateName: string): StateGovtJobPageConfig {
  const slug = `govt-jobs-${stateSlug}`;
  const dbState = stateSlug.replace(/-/g, ' ');

  return {
    state: stateName,
    slug,
    stateSlug: dbState,
    h1: `Government Jobs in ${stateName} 2026`,
    metaTitle: `Govt Jobs in ${stateName} 2026 – Latest Sarkari Naukri`,
    metaDescription: `Find latest government jobs in ${stateName} 2026. SSC, Railway, Banking, Defence & state-level sarkari naukri vacancies with eligibility, dates & apply links. Updated daily on TrueJobs.`,
    introContent: stateContentOverrides[`govt-jobs-${stateSlug}`] || generateStateIntro(stateName),
    faqItems: generateStateFAQs(stateName),
  };
}

function generateStateIntro(state: string): string {
  return `<h2>Latest Government Jobs in ${state}</h2>
<p>Looking for sarkari naukri in ${state}? This page lists all the latest central and state government job notifications available for candidates in ${state}. Whether you are a 10th pass, 12th pass, graduate, or post-graduate candidate, you will find relevant government job openings updated daily.</p>
<p>${state} is served by numerous central government organizations such as SSC, Railway Recruitment Boards, IBPS, SBI, UPSC, and Defence recruitment bodies. Additionally, the ${state} state government regularly publishes vacancies through its own Public Service Commission and state-level recruitment boards for positions in education, healthcare, police, revenue, and administrative departments.</p>
<h3>Types of Government Jobs Available in ${state}</h3>
<p>Government jobs in ${state} span multiple sectors and qualification levels. Central government positions include clerical roles through SSC (CHSL, MTS), technical positions through Railway recruitment, banking jobs through IBPS and SBI, and administrative services through UPSC. State-level positions cover teachers, police constables and sub-inspectors, revenue officers, healthcare workers, and various Group-C and Group-D posts.</p>
<p>Many all-India level examinations also have exam centres and postings available in ${state}, making them relevant for candidates domiciled in the state. The list below includes both state-specific and all-India vacancies with posting locations in ${state}.</p>
<h3>How to Apply for Govt Jobs in ${state}</h3>
<p>Browse the listings below to find government job notifications relevant to ${state}. Each listing includes the recruiting organization, number of vacancies, eligibility criteria, important dates, and direct links to official notification and application forms. We recommend bookmarking this page and checking regularly as new notifications are published frequently throughout the year.</p>
<p>Candidates should verify all details including age limits, educational qualifications, domicile requirements, and application fees from the official notification before applying. Age relaxation and reservation benefits as per government rules are applicable for SC/ST/OBC/PH/Ex-servicemen categories.</p>`;
}

function generateStateFAQs(state: string): FAQItem[] {
  return [
    {
      question: `How to find the latest government jobs in ${state}?`,
      answer: `You can find all the latest government jobs in ${state} on this page. We list both central and state government vacancies updated daily. Bookmark this page for regular updates.`,
    },
    {
      question: `Which government exams have postings in ${state}?`,
      answer: `SSC CGL, SSC CHSL, SSC MTS, Railway NTPC, Railway Group D, IBPS PO, IBPS Clerk, SBI PO, SBI Clerk, UPSC CSE, and various state-level PSC exams have postings available in ${state}.`,
    },
    {
      question: `Can I apply for central government jobs from ${state}?`,
      answer: `Yes, candidates from ${state} can apply for all central government examinations conducted by SSC, Railway, IBPS, UPSC, and other national bodies. Exam centres are available in major cities of ${state}.`,
    },
    {
      question: `What is the minimum qualification for govt jobs in ${state}?`,
      answer: `Government jobs in ${state} are available for all qualification levels from 10th pass to post-graduate. Group-D posts require 10th pass, clerical posts need 12th pass or graduation, and officer-level posts typically require a bachelor's or master's degree.`,
    },
    {
      question: `Are there age relaxation benefits for govt jobs in ${state}?`,
      answer: `Yes, age relaxation is provided as per government rules for SC/ST (5 years), OBC (3 years), PH candidates (10 years), and ex-servicemen (as applicable). State government vacancies in ${state} may have additional state-specific relaxation rules.`,
    },
  ];
}

const STATE_LIST: [string, string][] = [
  ['andhra-pradesh', 'Andhra Pradesh'],
  ['arunachal-pradesh', 'Arunachal Pradesh'],
  ['assam', 'Assam'],
  ['bihar', 'Bihar'],
  ['chandigarh', 'Chandigarh'],
  ['chhattisgarh', 'Chhattisgarh'],
  ['dadra-nagar-haveli', 'Dadra & Nagar Haveli'],
  ['daman-diu', 'Daman & Diu'],
  ['delhi', 'Delhi'],
  ['goa', 'Goa'],
  ['gujarat', 'Gujarat'],
  ['haryana', 'Haryana'],
  ['himachal-pradesh', 'Himachal Pradesh'],
  ['jammu-kashmir', 'Jammu & Kashmir'],
  ['jharkhand', 'Jharkhand'],
  ['karnataka', 'Karnataka'],
  ['kerala', 'Kerala'],
  ['ladakh', 'Ladakh'],
  ['lakshadweep', 'Lakshadweep'],
  ['madhya-pradesh', 'Madhya Pradesh'],
  ['maharashtra', 'Maharashtra'],
  ['manipur', 'Manipur'],
  ['meghalaya', 'Meghalaya'],
  ['mizoram', 'Mizoram'],
  ['nagaland', 'Nagaland'],
  ['odisha', 'Odisha'],
  ['puducherry', 'Puducherry'],
  ['punjab', 'Punjab'],
  ['rajasthan', 'Rajasthan'],
  ['sikkim', 'Sikkim'],
  ['tamil-nadu', 'Tamil Nadu'],
  ['telangana', 'Telangana'],
  ['tripura', 'Tripura'],
  ['uttar-pradesh', 'Uttar Pradesh'],
  ['uttarakhand', 'Uttarakhand'],
  ['west-bengal', 'West Bengal'],
];

const stateConfigMap = new Map<string, StateGovtJobPageConfig>();
STATE_LIST.forEach(([slug, name]) => {
  const config = buildStateConfig(slug, name);
  stateConfigMap.set(config.slug, config);
});

export function getStateGovtJobConfig(slug: string): StateGovtJobPageConfig | undefined {
  const config = stateConfigMap.get(slug);
  if (!config) return undefined;
  const overrides = STATE_META_OVERRIDES[slug];
  return overrides ? { ...config, ...overrides } : config;
}

/** All state slugs for sitemap generation */
export function getAllStateGovtSlugs(): string[] {
  return STATE_LIST.map(([s]) => `govt-jobs-${s}`);
}

/**
 * CTR Override Map — per-slug overrides for metaTitle, metaDescription, or introContent.
 * Add entries here when GSC data shows weak CTR for specific states.
 */
const STATE_META_OVERRIDES: Record<string, Partial<Pick<StateGovtJobPageConfig, 'metaTitle' | 'metaDescription' | 'introContent'>>> = {};
