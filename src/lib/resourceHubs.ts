/**
 * Resource hub registry — defines valid hub slugs, SEO metadata, deterministic DB filters,
 * and reserved slugs.
 */

export type ResourceType = 'sample_paper' | 'book' | 'previous_year_paper' | 'guide';

export interface HubDbFilter {
  field: 'category' | 'exam_name' | 'subject';
  values: string[]; // exact case-insensitive matches
}

export interface HubConfig {
  label: string;
  metaTitle: string;
  metaDescription: string;
  intro: string;
  /** Deterministic DB filters — checked in order, combined with OR. No fuzzy substring matching. */
  dbFilters: HubDbFilter[];
}

// Resource type → URL path segment mapping
export const RESOURCE_TYPE_PATHS: Record<ResourceType, string> = {
  sample_paper: 'sample-papers',
  book: 'books',
  previous_year_paper: 'previous-year-papers',
  guide: 'guides',
};

export const PATH_TO_RESOURCE_TYPE: Record<string, ResourceType> = {
  'sample-papers': 'sample_paper',
  'books': 'book',
  'previous-year-papers': 'previous_year_paper',
  'guides': 'guide',
};

/**
 * Build a Supabase `.or()` filter string from a hub's dbFilters.
 * E.g. "category.ilike.SSC,category.ilike.Staff Selection Commission,exam_name.ilike.SSC CGL"
 */
export function buildHubFilterString(filters: HubDbFilter[]): string {
  const parts: string[] = [];
  for (const filter of filters) {
    for (const value of filter.values) {
      parts.push(`${filter.field}.ilike.${value}`);
    }
  }
  return parts.join(',');
}

// Hub definitions per resource type
export const RESOURCE_HUBS: Record<ResourceType, Record<string, HubConfig>> = {
  sample_paper: {
    ssc: {
      label: 'SSC Sample Papers',
      metaTitle: 'SSC Sample Papers — Download Free PDF 2026 | TrueJobs',
      metaDescription: 'Download free SSC sample papers in PDF format for CGL, CHSL, MTS and other SSC exams. Practice with latest pattern papers.',
      intro: 'Prepare for SSC exams with our collection of free sample papers. These papers follow the latest SSC exam pattern and cover all sections including Quantitative Aptitude, English, General Awareness, and Reasoning. Download PDF and practice offline.',
      dbFilters: [
        { field: 'category', values: ['SSC'] },
        { field: 'exam_name', values: ['SSC CGL', 'SSC CHSL', 'SSC MTS', 'SSC GD'] },
      ],
    },
    railway: {
      label: 'Railway Sample Papers',
      metaTitle: 'Railway Sample Papers — Free PDF Download 2026 | TrueJobs',
      metaDescription: 'Download free Railway exam sample papers for RRB NTPC, Group D, ALP and other railway recruitment exams in PDF format.',
      intro: 'Get ready for Railway recruitment exams with our curated sample papers. Covering RRB NTPC, Group D, ALP, and other railway exams, these papers help you understand the exam pattern and practice important topics.',
      dbFilters: [
        { field: 'category', values: ['Railway'] },
        { field: 'exam_name', values: ['RRB NTPC', 'RRB Group D', 'RRB ALP'] },
      ],
    },
    banking: {
      label: 'Banking Sample Papers',
      metaTitle: 'Banking Sample Papers — Free PDF Download 2026 | TrueJobs',
      metaDescription: 'Download free banking exam sample papers for IBPS PO, Clerk, SBI PO, RBI and other banking exams in PDF format.',
      intro: 'Ace your banking exams with our comprehensive sample papers. Covering IBPS PO, IBPS Clerk, SBI PO, RBI Grade B and more, these papers are designed to match the latest exam pattern and difficulty level.',
      dbFilters: [
        { field: 'category', values: ['Banking'] },
        { field: 'exam_name', values: ['IBPS PO', 'IBPS Clerk', 'SBI PO', 'SBI Clerk', 'RBI Grade B'] },
      ],
    },
    upsc: {
      label: 'UPSC Sample Papers',
      metaTitle: 'UPSC Sample Papers — Free PDF Download 2026 | TrueJobs',
      metaDescription: 'Download free UPSC sample papers for Civil Services, CDS, NDA, CAPF and other UPSC exams in PDF format.',
      intro: 'Prepare for UPSC examinations with our collection of sample papers. These papers cover Prelims, Mains, and optional subjects for Civil Services along with CDS, NDA, and other UPSC conducted exams.',
      dbFilters: [
        { field: 'category', values: ['UPSC'] },
        { field: 'exam_name', values: ['UPSC Civil Services', 'UPSC CDS', 'UPSC NDA', 'UPSC CAPF'] },
      ],
    },
    defence: {
      label: 'Defence Sample Papers',
      metaTitle: 'Defence Exam Sample Papers — Free PDF 2026 | TrueJobs',
      metaDescription: 'Download free defence exam sample papers for NDA, CDS, AFCAT, Indian Navy, and Army recruitment exams.',
      intro: 'Prepare for defence recruitment exams with practice papers covering NDA, CDS, AFCAT, Indian Navy, and various Army recruitment tests. Download in PDF format for offline preparation.',
      dbFilters: [
        { field: 'category', values: ['Defence'] },
        { field: 'exam_name', values: ['NDA', 'CDS', 'AFCAT'] },
      ],
    },
    'state-psc': {
      label: 'State PSC Sample Papers',
      metaTitle: 'State PSC Sample Papers — Free PDF Download 2026 | TrueJobs',
      metaDescription: 'Download free State PSC sample papers for UPPSC, MPPSC, BPSC, RPSC and other state public service commissions.',
      intro: 'Practice for State Public Service Commission exams with our collection of sample papers covering UPPSC, MPPSC, BPSC, RPSC, and more. Papers are available in both Hindi and English.',
      dbFilters: [
        { field: 'category', values: ['State PSC'] },
        { field: 'exam_name', values: ['UPPSC', 'MPPSC', 'BPSC', 'RPSC', 'WBPSC'] },
      ],
    },
    cbse: {
      label: 'CBSE Sample Papers',
      metaTitle: 'CBSE Sample Papers — Free PDF Download 2026 | TrueJobs',
      metaDescription: 'Download free CBSE sample papers for Class 10 and Class 12 board exams in PDF format. All subjects available.',
      intro: 'Practice with CBSE sample papers for Class 10 and Class 12 board examinations. Papers cover all subjects including Mathematics, Science, English, Hindi, Social Science, and more.',
      dbFilters: [
        { field: 'category', values: ['CBSE', 'Teaching'] },
        { field: 'exam_name', values: ['CBSE Class 10 Board Exam', 'CBSE Class 10 Board Exams', 'CBSE Class 12', 'CBSE Class 12 Hindi Core', 'CBSE Class 12 Fine Arts', 'CBSE Class 12 Home Science', 'CBSE Class 12 Psychology', 'सीबीएसई कक्षा 12', 'CBSE कक्षा 12', 'CBSE कक्षा 12 शारीरिक शिक्षा', 'CBSE कक्षा 12 अंग्रेजी कोर', 'सीबीएसई कक्षा 12 अर्थशास्त्र'] },
      ],
    },
  },
  book: {
    reasoning: {
      label: 'Reasoning Books',
      metaTitle: 'Reasoning Books PDF — Free Download 2026 | TrueJobs',
      metaDescription: 'Download free reasoning books in PDF for government exams. Verbal, non-verbal and analytical reasoning study materials.',
      intro: 'Master reasoning skills with our collection of free PDF books. Covering verbal reasoning, non-verbal reasoning, analytical reasoning, and logical reasoning — essential for SSC, Banking, Railway, and all government exams.',
      dbFilters: [
        { field: 'category', values: ['Reasoning'] },
        { field: 'subject', values: ['Reasoning', 'Logical Reasoning', 'Verbal Reasoning'] },
      ],
    },
    quant: {
      label: 'Quantitative Aptitude Books',
      metaTitle: 'Quantitative Aptitude Books PDF — Free Download | TrueJobs',
      metaDescription: 'Download free quantitative aptitude books in PDF for government exams. Maths, arithmetic, and data interpretation study materials.',
      intro: 'Strengthen your quantitative aptitude with free PDF books covering arithmetic, algebra, geometry, data interpretation, and advanced mathematics — essential for all competitive government exams.',
      dbFilters: [
        { field: 'category', values: ['Quantitative Aptitude', 'Mathematics'] },
        { field: 'subject', values: ['Maths', 'Mathematics', 'Quantitative Aptitude'] },
      ],
    },
    'general-awareness': {
      label: 'General Awareness Books',
      metaTitle: 'General Awareness Books PDF — Free Download 2026 | TrueJobs',
      metaDescription: 'Download free general awareness and GK books in PDF for government exams. Current affairs, static GK study materials.',
      intro: 'Boost your general awareness preparation with free PDF books covering current affairs, static GK, Indian history, geography, polity, economy, and science — crucial for all government exams.',
      dbFilters: [
        { field: 'category', values: ['General Awareness', 'GK'] },
        { field: 'subject', values: ['General Knowledge', 'General Awareness', 'Current Affairs'] },
      ],
    },
    english: {
      label: 'English Books',
      metaTitle: 'English Grammar & Comprehension Books PDF — Free | TrueJobs',
      metaDescription: 'Download free English grammar and comprehension books in PDF for government exams. Vocabulary, grammar rules, and practice materials.',
      intro: 'Improve your English language skills with free PDF books covering grammar rules, vocabulary, reading comprehension, cloze tests, and error spotting — important for SSC, Banking, and all competitive exams.',
      dbFilters: [
        { field: 'category', values: ['English'] },
        { field: 'subject', values: ['English', 'English Grammar', 'English Language'] },
      ],
    },
    'general-science': {
      label: 'General Science Books',
      metaTitle: 'General Science Books PDF — Free Download 2026 | TrueJobs',
      metaDescription: 'Download free general science books in PDF for government exams. Physics, chemistry, biology study materials.',
      intro: 'Prepare the science section with free PDF books covering physics, chemistry, and biology concepts frequently asked in SSC, Railway, and state-level government exams.',
      dbFilters: [
        { field: 'category', values: ['General Science', 'Science'] },
        { field: 'subject', values: ['Science', 'Physics', 'Chemistry', 'Biology'] },
      ],
    },
  },
  previous_year_paper: {
    'ssc-cgl': {
      label: 'SSC CGL Previous Year Papers',
      metaTitle: 'SSC CGL Previous Year Papers PDF — Free Download | TrueJobs',
      metaDescription: 'Download free SSC CGL previous year question papers with solutions in PDF. Tier 1, Tier 2, and Tier 3 papers.',
      intro: 'Practice with actual SSC CGL previous year papers from recent years. Includes Tier 1, Tier 2, and Tier 3 papers with detailed solutions. Understand exam trends and frequently repeated topics.',
      dbFilters: [
        { field: 'exam_name', values: ['SSC CGL'] },
        { field: 'category', values: ['SSC'] },
      ],
    },
    'ssc-chsl': {
      label: 'SSC CHSL Previous Year Papers',
      metaTitle: 'SSC CHSL Previous Year Papers PDF — Free Download | TrueJobs',
      metaDescription: 'Download free SSC CHSL previous year question papers with solutions in PDF format.',
      intro: 'Solve SSC CHSL previous year papers to understand exam pattern, difficulty level, and important topics. Papers available with detailed solutions in Hindi and English.',
      dbFilters: [
        { field: 'exam_name', values: ['SSC CHSL'] },
      ],
    },
    'rrb-ntpc': {
      label: 'RRB NTPC Previous Year Papers',
      metaTitle: 'RRB NTPC Previous Year Papers PDF — Free Download | TrueJobs',
      metaDescription: 'Download free RRB NTPC previous year question papers with solutions in PDF for CBT 1 and CBT 2.',
      intro: 'Get RRB NTPC previous year papers for CBT 1 and CBT 2 stages. Analyze question patterns, understand the difficulty level, and practice with actual exam questions.',
      dbFilters: [
        { field: 'exam_name', values: ['RRB NTPC'] },
        { field: 'category', values: ['Railway'] },
      ],
    },
    railway: {
      label: 'Railway Previous Year Papers',
      metaTitle: 'Railway Exam Previous Year Papers PDF — Free Download | TrueJobs',
      metaDescription: 'Download free Railway exam previous year papers for Group D, ALP, NTPC, and other RRB exams in PDF.',
      intro: 'Practice with Railway exam previous year papers covering Group D, ALP, NTPC, and other RRB examinations. Understand recurring patterns and prepare effectively.',
      dbFilters: [
        { field: 'category', values: ['Railway'] },
        { field: 'exam_name', values: ['RRB Group D', 'RRB ALP', 'RRB NTPC'] },
      ],
    },
    ssc: {
      label: 'SSC Previous Year Papers',
      metaTitle: 'SSC Previous Year Papers PDF — All Exams | TrueJobs',
      metaDescription: 'Download free SSC previous year papers for CGL, CHSL, MTS, GD, Stenographer and other SSC exams in PDF.',
      intro: 'Access SSC previous year papers for all major exams including CGL, CHSL, MTS, GD Constable, and Stenographer. Complete collection with solutions.',
      dbFilters: [
        { field: 'category', values: ['SSC'] },
        { field: 'exam_name', values: ['SSC CGL', 'SSC CHSL', 'SSC MTS', 'SSC GD', 'SSC Stenographer'] },
      ],
    },
    banking: {
      label: 'Banking Previous Year Papers',
      metaTitle: 'Banking Previous Year Papers PDF — IBPS, SBI | TrueJobs',
      metaDescription: 'Download free banking exam previous year papers for IBPS PO, Clerk, SBI PO, RBI exams in PDF format.',
      intro: 'Solve banking exam previous year papers from IBPS PO, IBPS Clerk, SBI PO, SBI Clerk, and RBI exams. Practice with actual questions and improve your exam strategy.',
      dbFilters: [
        { field: 'category', values: ['Banking'] },
        { field: 'exam_name', values: ['IBPS PO', 'IBPS Clerk', 'SBI PO', 'SBI Clerk'] },
      ],
    },
  },
  guide: {
    'exam-strategy': {
      label: 'Exam Strategy Guides',
      metaTitle: 'Exam Strategy Guides PDF — Free Download 2026 | TrueJobs',
      metaDescription: 'Download free exam strategy guides in PDF for government exams. Tips, study plans, and preparation strategies.',
      intro: 'Master your exam preparation with our free strategy guides. Get expert tips on time management, study planning, revision techniques, and scoring strategies for SSC, Banking, Railway, UPSC and other government exams.',
      dbFilters: [
        { field: 'category', values: ['Exam Strategy', 'Strategy'] },
        { field: 'subject', values: ['Exam Strategy', 'Study Plan'] },
      ],
    },
    'syllabus-guide': {
      label: 'Syllabus & Pattern Guides',
      metaTitle: 'Syllabus & Exam Pattern Guides PDF — Free Download | TrueJobs',
      metaDescription: 'Download free syllabus and exam pattern guides for government exams. Detailed breakdowns and topic-wise weightage.',
      intro: 'Understand your exam inside-out with detailed syllabus breakdowns, topic-wise weightage analysis, and exam pattern guides for all major government competitive exams.',
      dbFilters: [
        { field: 'category', values: ['Syllabus', 'Exam Pattern'] },
        { field: 'subject', values: ['Syllabus', 'Exam Pattern'] },
      ],
    },
    'preparation-tips': {
      label: 'Preparation Tips Guides',
      metaTitle: 'Preparation Tips Guides PDF — Free Download 2026 | TrueJobs',
      metaDescription: 'Download free preparation tips guides for government exams. Subject-wise tips, shortcuts, and study techniques.',
      intro: 'Boost your preparation with expert tips guides covering subject-wise strategies, shortcuts, formula sheets, and study techniques for competitive government exams.',
      dbFilters: [
        { field: 'category', values: ['Preparation Tips', 'Tips'] },
        { field: 'subject', values: ['Preparation Tips', 'Study Tips'] },
      ],
    },
  },
};

// All hub slugs flattened
export const ALL_HUB_SLUGS = new Set(
  Object.values(RESOURCE_HUBS).flatMap(hubs => Object.keys(hubs))
);

// Reserved slugs that CANNOT be used as resource slugs
export const RESERVED_SLUGS = new Set([
  'hub', 'download', 'books', 'sample-papers', 'previous-year-papers',
  'resources', 'admin', 'login', 'signup', 'dashboard', 'profile',
  'employer', 'jobs', 'sarkari-jobs', 'blog', 'tools', 'companies',
  'enrol-now', 'thankyou', 'offline', 'contactus', 'aboutus',
  'privacypolicy', 'termsofuse', 'disclaimer', 'editorial-policy',
  'free-guides', 'guides', 'pdf-tools', 'image-resizer', 'photo-resizer',
  ...ALL_HUB_SLUGS,
]);

export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUGS.has(slug);
}

export function getHubConfig(resourceType: ResourceType, hubSlug: string): HubConfig | null {
  return RESOURCE_HUBS[resourceType]?.[hubSlug] || null;
}

export function getHubsForType(resourceType: ResourceType): Array<{ slug: string; config: HubConfig }> {
  const hubs = RESOURCE_HUBS[resourceType] || {};
  return Object.entries(hubs).map(([slug, config]) => ({ slug, config }));
}

// Default cover images per category
export const DEFAULT_COVERS: Record<string, string> = {
  ssc: '/images/defaults/ssc-cover.webp',
  railway: '/images/defaults/railway-cover.webp',
  banking: '/images/defaults/banking-cover.webp',
  upsc: '/images/defaults/upsc-cover.webp',
  default: '/images/defaults/resource-cover.webp',
};

export function getDefaultCover(category: string | null): string {
  if (!category) return DEFAULT_COVERS.default;
  const key = category.toLowerCase();
  return DEFAULT_COVERS[key] || DEFAULT_COVERS.default;
}

// Storage path helpers
export function getStoragePath(resourceType: ResourceType, slug: string, extension: string = 'pdf'): string {
  const typePath = RESOURCE_TYPE_PATHS[resourceType];
  return `pdfs/${typePath}/${slug}.${extension}`;
}

export function getCoverStoragePath(resourceType: ResourceType, slug: string): string {
  const typePath = RESOURCE_TYPE_PATHS[resourceType];
  return `resource-covers/${typePath}/${slug}.webp`;
}
