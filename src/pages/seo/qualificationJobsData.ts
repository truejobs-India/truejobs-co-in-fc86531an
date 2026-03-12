import type { FAQItem } from './types';

export interface QualificationJobPageConfig {
  qualification: string;
  qualTag: string; // for DB query against qualification_tags
  slug: string;
  h1: string;
  metaTitle: string;
  metaDescription: string;
  introContent: string;
  faqItems: FAQItem[];
}

interface QualDef {
  slug: string;
  tag: string;
  label: string;
  fullLabel: string;
  examples: string;
}

const QUALIFICATIONS: QualDef[] = [
  {
    slug: '10th-pass-govt-jobs',
    tag: '10th',
    label: '10th Pass',
    fullLabel: '10th Pass (Matriculation)',
    examples: 'SSC MTS, Railway Group D, SSC GD Constable, Postal GDS, Defence Agniveer',
  },
  {
    slug: '12th-pass-govt-jobs',
    tag: '12th',
    label: '12th Pass',
    fullLabel: '12th Pass (Intermediate / Higher Secondary)',
    examples: 'SSC CHSL, Railway NTPC, NDA, Indian Air Force, SSC Stenographer',
  },
  {
    slug: 'graduate-govt-jobs',
    tag: 'graduate',
    label: 'Graduate',
    fullLabel: 'Graduate (Bachelor\'s Degree)',
    examples: 'SSC CGL, IBPS PO, SBI PO, UPSC CSE, SSC CPO, CDS, RBI Grade B',
  },
  {
    slug: 'post-graduate-govt-jobs',
    tag: 'post-graduate',
    label: 'Post Graduate',
    fullLabel: 'Post Graduate (Master\'s Degree)',
    examples: 'UPSC CSE, UGC NET, State PSC, UPSC CMS, Teaching positions',
  },
  {
    slug: 'diploma-govt-jobs',
    tag: 'diploma',
    label: 'Diploma',
    fullLabel: 'Diploma Holders',
    examples: 'RRB JE, SSC JE, DRDO Technical, ISRO Technical, State PWD',
  },
  {
    slug: 'iti-govt-jobs',
    tag: 'iti',
    label: 'ITI',
    fullLabel: 'ITI (Industrial Training Institute) Certificate Holders',
    examples: 'RRB ALP, Railway Group D, Ordnance Factory, HAL, BHEL Apprentice',
  },
];

function buildQualConfig(qual: QualDef): QualificationJobPageConfig {
  return {
    qualification: qual.label,
    qualTag: qual.tag,
    slug: qual.slug,
    h1: `${qual.label} Government Jobs 2026`,
    metaTitle: `${qual.label} Govt Jobs 2026 – Latest Sarkari Naukri`,
    metaDescription: `Find latest ${qual.label.toLowerCase()} government jobs 2026. Complete list of sarkari naukri for ${qual.fullLabel.toLowerCase()} with eligibility, exam dates & apply links. Updated daily on TrueJobs.`,
    introContent: generateQualIntro(qual),
    faqItems: generateQualFAQs(qual),
  };
}

function generateQualIntro(qual: QualDef): string {
  return `<h2>${qual.label} Government Jobs 2026</h2>
<p>Are you a ${qual.fullLabel.toLowerCase()} looking for government jobs? This page lists all the latest central and state government recruitment notifications that match your qualification level. Government organizations across India regularly recruit ${qual.label.toLowerCase()} candidates for various positions in administration, technical services, defence, railways, banking, and other sectors.</p>
<p>Popular government exams for ${qual.label.toLowerCase()} candidates include ${qual.examples}. These examinations offer excellent career opportunities with competitive pay scales, job security, and comprehensive benefits under the 7th Central Pay Commission.</p>
<h3>Why Choose Government Jobs After ${qual.label}?</h3>
<p>Government jobs for ${qual.label.toLowerCase()} candidates offer several advantages including structured pay scales, dearness allowance, house rent allowance, transport allowance, medical facilities, pension benefits, and job security. Additionally, government employees receive annual increments, promotion opportunities, and can avail leave travel concession, children education allowance, and other perks.</p>
<h3>Eligibility for ${qual.label} Government Jobs</h3>
<p>To be eligible for ${qual.label.toLowerCase()} government jobs, candidates typically need to have completed their ${qual.fullLabel.toLowerCase()} from a recognized board or institution. Age limits vary by position and recruiting body, with general category candidates usually eligible between 18-27 years. SC/ST candidates receive 5 years age relaxation, OBC candidates receive 3 years, and PH candidates receive up to 10 years relaxation.</p>
<h3>Latest ${qual.label} Govt Job Notifications</h3>
<p>Browse the listings below for all current government job notifications requiring ${qual.fullLabel.toLowerCase()} qualification. Each listing includes complete details about the recruiting organization, vacancies, selection process, important dates, and application links. Bookmark this page and check regularly for newly published opportunities.</p>`;
}

function generateQualFAQs(qual: QualDef): FAQItem[] {
  return [
    {
      question: `What government jobs are available for ${qual.label.toLowerCase()} candidates?`,
      answer: `Government jobs for ${qual.label.toLowerCase()} candidates include ${qual.examples}. Both central and state government organizations recruit at this qualification level across multiple sectors.`,
    },
    {
      question: `What is the salary for ${qual.label.toLowerCase()} government jobs?`,
      answer: `Salaries for ${qual.label.toLowerCase()} government jobs follow the 7th Pay Commission structure and vary by position. Entry-level posts typically offer ₹18,000-25,000 per month (basic pay) plus DA, HRA, and other allowances, resulting in a gross salary of ₹22,000-35,000 per month.`,
    },
    {
      question: `What is the age limit for ${qual.label.toLowerCase()} govt jobs?`,
      answer: `The age limit typically ranges from 18-27 years for general category. SC/ST candidates get 5 years relaxation, OBC candidates get 3 years, and PH candidates get up to 10 years relaxation. Exact age limits vary by recruitment.`,
    },
    {
      question: `How to prepare for ${qual.label.toLowerCase()} government exams?`,
      answer: `Focus on the specific exam syllabus and pattern. Practice previous year papers, take mock tests, and cover core subjects like General Knowledge, Mathematics, English, and Reasoning. Refer to the syllabus page of each exam for detailed topic-wise guidance.`,
    },
    {
      question: `Can ${qual.label.toLowerCase()} candidates apply for higher-level govt jobs?`,
      answer: `${qual.label} candidates can only apply for positions that specifically list their qualification as eligible. However, candidates can pursue higher education while working in government service and apply for promotions or departmental exams for career advancement.`,
    },
  ];
}

const qualConfigMap = new Map<string, QualificationJobPageConfig>();
QUALIFICATIONS.forEach((q) => {
  const config = buildQualConfig(q);
  qualConfigMap.set(config.slug, config);
});

export function getQualificationJobConfig(slug: string): QualificationJobPageConfig | undefined {
  const config = qualConfigMap.get(slug);
  if (!config) return undefined;
  const overrides = QUAL_META_OVERRIDES[slug];
  return overrides ? { ...config, ...overrides } : config;
}

export function getAllQualificationSlugs(): string[] {
  return QUALIFICATIONS.map((q) => q.slug);
}

/**
 * CTR Override Map — per-slug overrides for metaTitle, metaDescription, or introContent.
 * Add entries here when GSC data shows weak CTR for specific qualifications.
 * Example:
 * '10th-pass-govt-jobs': { metaTitle: '10th Pass Govt Jobs 2026 – 10,000+ Vacancies' },
 */
const QUAL_META_OVERRIDES: Record<string, Partial<Pick<QualificationJobPageConfig, 'metaTitle' | 'metaDescription' | 'introContent'>>> = {};
