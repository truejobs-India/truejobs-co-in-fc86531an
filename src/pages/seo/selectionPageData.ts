import type { FAQItem } from './types';

/**
 * Selection-based SEO page configuration and content generators.
 * Targets queries like "govt jobs without exam", "10th pass govt jobs without exam", etc.
 */

export interface SelectionPageFilters {
  slug: string;
  department?: string;
  qualification?: string;
  state?: string;
}

export interface SelectionPageConfig {
  slug: string;
  h1: string;
  metaTitle: string;
  metaDescription: string;
  introContent: string;
  faqItems: FAQItem[];
  filters: {
    department?: string;
    qualification?: string;
    state?: string;
  };
}

// Known departments for selection pages
const DEPARTMENTS = ['ssc', 'railway', 'defence', 'psu', 'banking', 'upsc', 'police', 'health'];

// Known qualifications
const QUALIFICATIONS = ['10th', '12th', 'graduate', 'post-graduate', 'diploma', 'iti'];

// Known states (full name slugs)
const STATES = [
  'delhi', 'uttar-pradesh', 'bihar', 'haryana', 'rajasthan', 'madhya-pradesh',
  'maharashtra', 'karnataka', 'tamil-nadu', 'west-bengal', 'punjab', 'jharkhand',
  'chhattisgarh', 'odisha', 'assam', 'uttarakhand', 'himachal-pradesh', 'kerala',
  'andhra-pradesh', 'telangana', 'gujarat', 'jammu-kashmir',
];

// Also accept short forms
const STATE_ALIASES: Record<string, string> = {
  'up': 'uttar-pradesh',
  'mp': 'madhya-pradesh',
  'hp': 'himachal-pradesh',
  'ap': 'andhra-pradesh',
  'wb': 'west-bengal',
  'jk': 'jammu-kashmir',
  'uk': 'uttarakhand',
};

/**
 * Returns all known selection page slugs for sitemap/GSC export.
 */
export function getAllSelectionSlugs(): string[] {
  const slugs: string[] = ['govt-jobs-without-exam'];
  for (const q of QUALIFICATIONS) {
    slugs.push(`${q === '10th' ? '10th-pass' : q === '12th' ? '12th-pass' : q}-govt-jobs-without-exam`);
  }
  for (const d of DEPARTMENTS) {
    slugs.push(`${d}-jobs-without-exam`);
  }
  for (const s of STATES) {
    slugs.push(`govt-jobs-without-exam-${s}`);
  }
  return slugs;
}

function titleCase(s: string): string {
  return s.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function resolveState(s: string): string | undefined {
  if (STATES.includes(s)) return s;
  if (STATE_ALIASES[s]) return STATE_ALIASES[s];
  return undefined;
}

/**
 * Attempt to parse a selection-based slug.
 * Patterns:
 *   govt-jobs-without-exam
 *   {qual}-govt-jobs-without-exam         e.g. 10th-pass-govt-jobs-without-exam
 *   {dept}-jobs-without-exam              e.g. railway-jobs-without-exam
 *   govt-jobs-without-exam-{state}        e.g. govt-jobs-without-exam-bihar
 */
export function parseSelectionSlug(slug: string): SelectionPageFilters | null {
  // Must contain "without-exam"
  if (!slug.includes('without-exam')) return null;

  // Exact main page
  if (slug === 'govt-jobs-without-exam') {
    return { slug };
  }

  // Qualification pattern: {qual}-govt-jobs-without-exam
  // e.g. 10th-pass-govt-jobs-without-exam, graduate-govt-jobs-without-exam
  const qualMatch = slug.match(/^(.+)-govt-jobs-without-exam$/);
  if (qualMatch) {
    const rawQual = qualMatch[1];
    // Normalize: "10th-pass" → "10th", "12th-pass" → "12th"
    const normalizedQual = rawQual.replace(/-pass$/, '');
    if (QUALIFICATIONS.includes(normalizedQual)) {
      return { slug, qualification: normalizedQual };
    }
  }

  // Department pattern: {dept}-jobs-without-exam
  // e.g. railway-jobs-without-exam
  const deptMatch = slug.match(/^(.+)-jobs-without-exam$/);
  if (deptMatch) {
    const dept = deptMatch[1];
    if (DEPARTMENTS.includes(dept)) {
      return { slug, department: dept };
    }
  }

  // State pattern: govt-jobs-without-exam-{state}
  // e.g. govt-jobs-without-exam-delhi, govt-jobs-without-exam-up
  const stateMatch = slug.match(/^govt-jobs-without-exam-(.+)$/);
  if (stateMatch) {
    const rawState = stateMatch[1];
    const resolved = resolveState(rawState);
    if (resolved) {
      return { slug, state: resolved };
    }
  }

  return null;
}

/**
 * Build a complete page config from parsed filters.
 */
export function buildSelectionPageConfig(filters: SelectionPageFilters): SelectionPageConfig {
  const { department, qualification, state } = filters;

  const deptLabel = department ? titleCase(department) : undefined;
  const qualLabel = qualification ? titleCase(qualification) : undefined;
  const stateLabel = state ? titleCase(state) : undefined;

  // Build page title parts
  let pageTitle = 'Government Jobs Without Exam 2026';
  let h1 = 'Government Jobs Without Written Exam 2026';

  if (qualification) {
    pageTitle = `${qualLabel} Pass Govt Jobs Without Exam 2026`;
    h1 = `${qualLabel} Pass Government Jobs Without Written Exam 2026`;
  } else if (department) {
    pageTitle = `${deptLabel} Jobs Without Exam 2026`;
    h1 = `${deptLabel} Jobs Without Written Exam 2026`;
  } else if (state) {
    pageTitle = `Govt Jobs Without Exam in ${stateLabel} 2026`;
    h1 = `Government Jobs Without Written Exam in ${stateLabel} 2026`;
  }

  const metaDescription = buildMetaDescription(deptLabel, qualLabel, stateLabel);
  const introContent = generateSelectionSEOIntro({ department: deptLabel, qualification: qualLabel, state: stateLabel });
  const faqItems = generateSelectionFAQs({ department: deptLabel, qualification: qualLabel, state: stateLabel });

  return {
    slug: filters.slug,
    h1,
    metaTitle: pageTitle,
    metaDescription,
    introContent,
    faqItems,
    filters: { department, qualification, state },
  };
}

function buildMetaDescription(dept?: string, qual?: string, state?: string): string {
  if (qual) {
    return `Find latest ${qual} pass government jobs without written exam 2026. Direct recruitment, interview-based and merit-based govt jobs for ${qual} pass candidates. Apply now on TrueJobs.`;
  }
  if (dept) {
    return `Latest ${dept} jobs without written exam 2026. Interview-based, merit-based and direct recruitment ${dept} vacancies. Check eligibility and apply on TrueJobs.`;
  }
  if (state) {
    return `Government jobs without exam in ${state} 2026. Find direct recruitment, interview-based and merit-based govt jobs in ${state}. Apply online on TrueJobs.`;
  }
  return 'Find latest government jobs without written exam 2026. Direct recruitment, interview-based and merit-based govt job notifications. Check eligibility and apply online on TrueJobs.';
}

function generateSelectionSEOIntro(ctx: { department?: string; qualification?: string; state?: string }): string {
  const { department, qualification, state } = ctx;

  if (qualification) {
    return `<h2>${qualification} Pass Government Jobs Without Written Exam</h2>
<p>Many government departments across India recruit ${qualification} pass candidates without conducting written examinations. These recruitment processes are typically based on interviews, merit lists prepared from academic scores, or direct recruitment drives organized by state and central government bodies.</p>
<p>For ${qualification} pass job seekers, these opportunities are especially valuable as they reduce the preparation burden associated with competitive written exams. Positions available through non-exam recruitment include roles in healthcare, public sector undertakings, railways, postal services, and various state government departments.</p>
<h3>Types of Selection Without Exam for ${qualification} Pass Candidates</h3>
<p>Government jobs without written exams for ${qualification} pass candidates are filled through several methods. Interview-based selection is common for technical and healthcare positions where practical skills are assessed during the selection process. Merit-based recruitment uses academic performance, experience, and other qualifying criteria to prepare a shortlist. Direct recruitment is used for contractual, group-D, and daily wage positions where candidates are appointed based on document verification and basic eligibility.</p>
<h3>How to Find ${qualification} Pass Govt Jobs Without Exam</h3>
<p>On this page, you can find all the latest government job notifications where ${qualification} pass candidates can apply without appearing for a written examination. Each listing includes complete details about the recruiting organization, number of vacancies, selection process, important dates, and direct application links. We update this page regularly to ensure you have access to the most current opportunities.</p>
<p>Candidates are advised to check the official notification carefully before applying, as eligibility criteria including age limits, nationality requirements, and specific educational qualifications may vary between recruitments. Bookmark this page and visit regularly to stay updated with the latest ${qualification} pass government jobs without exam.</p>`;
  }

  if (department) {
    return `<h2>${department} Jobs Without Written Examination</h2>
<p>${department} is one of the major employers in India's government sector. While many ${department} recruitments involve competitive written examinations, several positions are filled through alternative selection methods including interviews, merit-based shortlisting, and direct recruitment processes.</p>
<p>These non-exam ${department} jobs are available across various categories including technical positions, support staff, healthcare workers, and administrative roles. Candidates who meet the basic eligibility criteria can apply for these positions without the stress of preparing for written competitive exams.</p>
<h3>Selection Process for ${department} Jobs Without Exam</h3>
<p>The selection process for ${department} positions that do not require written exams typically involves document verification, skill tests or trade tests for technical positions, personal interviews, and merit-based ranking using academic qualifications and relevant experience. Some positions may also include physical fitness tests or medical examinations depending on the nature of the role.</p>
<h3>Latest ${department} Vacancies Without Exam</h3>
<p>This page lists all current ${department} job notifications where recruitment is conducted without a written examination. Each listing provides complete information including post details, eligibility criteria, selection methodology, application dates, and official notification links. Check this page regularly for newly published ${department} vacancies that match your qualifications.</p>
<p>We recommend candidates to verify all details from the official recruitment notification before submitting applications. Age relaxation rules, reservation policies, and specific qualification requirements may differ between notifications.</p>`;
  }

  if (state) {
    return `<h2>Government Jobs Without Exam in ${state}</h2>
<p>${state} offers numerous government employment opportunities where candidates can secure positions without appearing for written competitive examinations. State government departments, public sector companies, healthcare institutions, and autonomous bodies in ${state} regularly release recruitment notifications based on interview, merit, and direct recruitment methods.</p>
<p>For job seekers in ${state}, these non-exam government vacancies present an excellent opportunity to enter government service. The positions range from Group-D support staff to technical roles, nursing and paramedical positions, teaching posts, and contractual appointments in various state departments.</p>
<h3>Types of Non-Exam Govt Recruitment in ${state}</h3>
<p>Government recruitment without exams in ${state} is conducted through multiple channels. State health departments frequently hire nursing staff, lab technicians, and medical officers through walk-in interviews. State public service commissions may conduct interview-only selections for certain specialist positions. District-level recruitment drives for Group-D and contractual posts often use merit-based selection from eligible applicants.</p>
<h3>How to Apply for Govt Jobs Without Exam in ${state}</h3>
<p>Browse the listings below to find the latest government jobs in ${state} that do not require a written examination. Each notification includes detailed information about the recruiting organization, vacancies, qualification requirements, selection process, important dates, and application links. Stay connected with this page for regular updates on new non-exam government job opportunities in ${state}.</p>
<p>Candidates should always verify eligibility requirements including age limits, educational qualifications, domicile requirements, and any specific conditions mentioned in the official advertisement before applying.</p>`;
  }

  // Default: main page
  return `<h2>Government Jobs Without Written Examination 2026</h2>
<p>Many government departments across India recruit candidates without conducting written examinations. These recruitment processes are based on interviews, merit lists, skill tests, or direct recruitment methods. For lakhs of job seekers who prefer practical assessment over written competitive exams, these opportunities provide an accessible pathway to government employment.</p>
<p>Government jobs without exams are available across sectors including healthcare, railways, public sector undertakings, defence establishments, state government departments, and autonomous educational institutions. The positions range from Group-D support roles to specialized technical and professional positions requiring specific qualifications and experience.</p>
<h3>Types of Government Recruitment Without Written Exam</h3>
<p>Interview-based selection is commonly used for technical and professional positions where candidates are assessed on subject knowledge, communication skills, and relevant experience. Merit-based recruitment prepares shortlists using academic scores, professional qualifications, and other measurable criteria. Direct recruitment involves appointment through document verification and basic eligibility checks, commonly used for contractual and daily wage positions. Skill tests and trade tests are used for technical roles where practical competency matters more than theoretical examination performance.</p>
<h3>Who Can Apply for Government Jobs Without Exam?</h3>
<p>Candidates across all educational qualifications — from 10th pass to post-graduate and professional degree holders — can find government jobs without written exams. Each recruitment notification specifies the required qualifications, age limits, and selection criteria. Healthcare professionals, ITI certificate holders, engineering graduates, and diploma holders often find multiple opportunities that match their specialized qualifications.</p>
<h3>Latest Non-Exam Government Job Notifications</h3>
<p>On this page, you will find a comprehensive and regularly updated list of all government job notifications where recruitment does not involve a written examination. Each listing includes the recruiting organization, number of posts, eligibility criteria, selection process, important dates, and direct links to official notifications and application forms. Bookmark this page to stay informed about the latest non-exam government job opportunities across India.</p>`;
}

function generateSelectionFAQs(ctx: { department?: string; qualification?: string; state?: string }): FAQItem[] {
  const { department, qualification, state } = ctx;
  const location = state || 'India';
  const deptStr = department || 'government';

  const faqs: FAQItem[] = [
    {
      question: `What are ${deptStr} jobs without exam?`,
      answer: `${titleCase(deptStr)} jobs without exam are government positions where candidates are selected through interviews, merit lists, skill tests, or direct recruitment instead of written competitive examinations.`,
    },
    {
      question: `Which ${deptStr} departments recruit without written exams?`,
      answer: `Multiple departments including health services, public sector undertakings, railways, defence establishments, and state government bodies regularly recruit through non-exam selection methods like interviews and merit-based shortlisting.`,
    },
  ];

  if (qualification) {
    faqs.push({
      question: `Can ${qualification} pass candidates get government jobs without exam?`,
      answer: `Yes, many government organizations recruit ${qualification} pass candidates through interviews, merit, and direct recruitment for positions such as Group-D staff, peons, attendants, helpers, and various support roles.`,
    });
  }

  faqs.push({
    question: `Are government jobs without exam permanent?`,
    answer: `Some positions are permanent while others may be contractual or on a fixed-term basis. The nature of appointment is always mentioned in the official recruitment notification. Permanent positions offer benefits like pension, medical coverage, and career growth.`,
  });

  if (state) {
    faqs.push({
      question: `How to find govt jobs without exam in ${state}?`,
      answer: `You can find all latest government jobs without exam in ${state} on this page. We regularly update listings from state government departments, PSUs, and central government offices operating in ${state}.`,
    });
  }

  faqs.push({
    question: `How to apply for government jobs without written examination?`,
    answer: `Visit this page regularly for updated listings. Click on the job notification that matches your qualifications, check the eligibility criteria, and follow the application link provided. Always apply before the last date mentioned in the official notification.`,
  });

  return faqs.slice(0, 5);
}
