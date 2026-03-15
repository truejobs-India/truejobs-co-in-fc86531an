/**
 * Blog category validation and normalization utilities.
 * 
 * The canonical list MUST match the PostgreSQL CHECK constraint
 * on blog_posts.category exactly.
 */

export const VALID_BLOG_CATEGORIES = [
  'Job Search',
  'Career Advice',
  'Resume',
  'Interview',
  'HR & Recruitment',
  'Hiring Trends',
  'AI in Recruitment',
  'Results & Admit Cards',
  'Exam Preparation',
  'Sarkari Naukri Basics',
  'Career Guides & Tips',
  'Job Information',
  'Government Jobs',
  'Syllabus',
  'Current Affairs',
  'Admit Cards',
  'Uncategorized',
] as const;

export type ValidBlogCategory = (typeof VALID_BLOG_CATEGORIES)[number];

const DEFAULT_CATEGORY: ValidBlogCategory = 'Career Advice';

/**
 * Fuzzy mapping from common AI-returned or legacy category strings
 * to valid constraint values.
 */
const CATEGORY_ALIAS_MAP: Record<string, ValidBlogCategory> = {
  // Exact lowercase matches
  'job search': 'Job Search',
  'career advice': 'Career Advice',
  'resume': 'Resume',
  'interview': 'Interview',
  'hr & recruitment': 'HR & Recruitment',
  'hr and recruitment': 'HR & Recruitment',
  'hiring trends': 'Hiring Trends',
  'ai in recruitment': 'AI in Recruitment',
  'results & admit cards': 'Results & Admit Cards',
  'results and admit cards': 'Results & Admit Cards',
  'exam preparation': 'Exam Preparation',
  'sarkari naukri basics': 'Sarkari Naukri Basics',
  'career guides & tips': 'Career Guides & Tips',
  'career guides and tips': 'Career Guides & Tips',
  'job information': 'Job Information',
  'government jobs': 'Government Jobs',
  'govt jobs': 'Government Jobs',
  'sarkari jobs': 'Government Jobs',
  'sarkari naukri': 'Government Jobs',
  'syllabus': 'Syllabus',
  'current affairs': 'Current Affairs',
  'admit cards': 'Admit Cards',
  'admit card': 'Admit Cards',
  'uncategorized': 'Uncategorized',

  // Common AI-generated aliases
  'results & cutoffs': 'Results & Admit Cards',
  'results and cutoffs': 'Results & Admit Cards',
  'result': 'Results & Admit Cards',
  'results': 'Results & Admit Cards',
  'cutoff': 'Results & Admit Cards',
  'cutoffs': 'Results & Admit Cards',
  'exam tips': 'Exam Preparation',
  'exam prep': 'Exam Preparation',
  'preparation': 'Exam Preparation',
  'preparation tips': 'Exam Preparation',
  'career': 'Career Advice',
  'career tips': 'Career Advice',
  'career guide': 'Career Guides & Tips',
  'career development': 'Career Advice',
  'job tips': 'Job Search',
  'jobs': 'Job Search',
  'recruitment': 'HR & Recruitment',
  'hiring': 'Hiring Trends',
  'resume tips': 'Resume',
  'resume writing': 'Resume',
  'interview tips': 'Interview',
  'interview preparation': 'Interview',
  'general': 'Career Advice',
  'other': 'Uncategorized',
  'government exams': 'Exam Preparation',
  'govt exams': 'Exam Preparation',
  'sarkari result': 'Results & Admit Cards',
  'answer key': 'Results & Admit Cards',
  'answer keys': 'Results & Admit Cards',
  'notification': 'Government Jobs',
  'vacancy': 'Government Jobs',
  'vacancies': 'Government Jobs',
};

/**
 * Normalize any category string to a valid blog_posts.category value.
 * Returns DEFAULT_CATEGORY if the input cannot be mapped.
 */
export function normalizeBlogCategory(raw: string | null | undefined): ValidBlogCategory {
  if (!raw || typeof raw !== 'string' || raw.trim().length === 0) {
    return DEFAULT_CATEGORY;
  }

  const trimmed = raw.trim();

  // 1. Exact match (case-sensitive)
  if ((VALID_BLOG_CATEGORIES as readonly string[]).includes(trimmed)) {
    return trimmed as ValidBlogCategory;
  }

  // 2. Case-insensitive exact match
  const lower = trimmed.toLowerCase();
  const exactMatch = VALID_BLOG_CATEGORIES.find(c => c.toLowerCase() === lower);
  if (exactMatch) return exactMatch;

  // 3. Alias map
  const alias = CATEGORY_ALIAS_MAP[lower];
  if (alias) return alias;

  // 4. Partial match — check if any valid category is contained in the input
  for (const valid of VALID_BLOG_CATEGORIES) {
    if (lower.includes(valid.toLowerCase())) {
      return valid;
    }
  }

  // 5. Fallback
  console.warn(`[normalizeBlogCategory] Unknown category "${raw}", defaulting to "${DEFAULT_CATEGORY}"`);
  return DEFAULT_CATEGORY;
}

/**
 * Check if a category value is valid for the blog_posts table.
 */
export function isValidBlogCategory(category: string | null | undefined): boolean {
  if (!category) return false;
  return (VALID_BLOG_CATEGORIES as readonly string[]).includes(category);
}
