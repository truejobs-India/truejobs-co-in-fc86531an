export interface FAQItem {
  question: string;
  answer: string;
}

export interface ExamDate {
  label: string;
  date: string; // ISO or descriptive like "To Be Announced"
}

export interface ExamPatternStage {
  stageName: string;
  rows: {
    subject: string;
    questions: number;
    marks: number;
    duration: string;
    negativeMarking: string;
  }[];
}

export interface FeeStructure {
  general: number;
  obc: number;
  scSt: number;
  female: number;
  ph: number;
  paymentModes: string[];
}

export interface SalaryInfo {
  salaryMin: number;   // monthly basic pay (integer)
  salaryMax: number;   // monthly basic pay (integer)
  payLevels: string;   // e.g. "Pay Level 4 to 11"
  grossRange: string;  // e.g. "₹35,000 – ₹1,80,000"
  netRange: string;    // e.g. "₹30,000 – ₹1,50,000"
  allowances: string[];
  postWiseSalary?: { post: string; payLevel: string; basicPay: string }[];
}

export interface RelatedExamLink {
  label: string;
  href: string;
}

export type AuthorityPageType = 'notification' | 'syllabus' | 'exam-pattern' | 'eligibility' | 'salary' | 'cutoff' | 'age-limit';

export interface ExamAuthorityConfig {
  slug: string;
  pageType: AuthorityPageType;
  departmentSlug: string;        // e.g. 'ssc-jobs'
  examName: string;              // e.g. 'SSC CGL'
  examYear: number;

  // SEO
  metaTitle: string;             // ≤60 chars, no "| TrueJobs" suffix (SEO.tsx appends it)
  metaDescription: string;       // ≤160 chars
  lastUpdated: string;           // ISO date e.g. "2026-03-07"
  datePublished: string;         // ISO date

  // Content sections
  h1: string;
  overview: string;              // HTML string, 300+ words
  dates?: ExamDate[];
  eligibility?: string;          // HTML string
  feeStructure?: FeeStructure;
  selectionProcess?: string[];   // ordered steps
  examPattern?: ExamPatternStage[];
  syllabusSummary?: string;      // HTML string
  salary?: SalaryInfo;
  howToApply?: string[];         // ordered steps (≥6 for notification pages)
  faqs: FAQItem[];

  // Enrichment (notification pages only)
  cutoffs?: {
    year: number;
    category: string;
    cutoffScore: string;
    totalMarks?: string;
  }[];
  admitCardInfo?: {
    releaseDate?: string;
    downloadUrl?: string;
    instructions?: string[];
  };
  resultInfo?: {
    resultDate?: string;
    resultUrl?: string;
    meritListUrl?: string;
    nextSteps?: string[];
  };

  // Links
  relatedExams?: RelatedExamLink[];
  applyLink?: string;
  notificationPdfUrl?: string;
  officialWebsite?: string;

  // Schema
  applicationEndDate?: string;   // ISO date, used for validThrough
  conductingBody?: string;
  totalVacancies?: number;
}

/** OG images keyed by departmentSlug */
export const DEPARTMENT_OG_IMAGES: Record<string, string> = {
  'ssc-jobs': 'https://truejobs.co.in/og-image.png',
  'railway-jobs': 'https://truejobs.co.in/og-image.png',
  'banking-jobs': 'https://truejobs.co.in/og-image.png',
  'upsc-jobs': 'https://truejobs.co.in/og-image.png',
  'defence-jobs': 'https://truejobs.co.in/og-image.png',
  'teaching-jobs': 'https://truejobs.co.in/og-image.png',
  'police-jobs': 'https://truejobs.co.in/og-image.png',
  'state-psc-jobs': 'https://truejobs.co.in/og-image.png',
};

export const DEFAULT_OG_IMAGE = 'https://truejobs.co.in/og-image.png';
