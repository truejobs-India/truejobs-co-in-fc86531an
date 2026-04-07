/**
 * Long Tail SEO Page Templates — defines 17 intent-specific page types
 * with mandatory sections, prompt instructions, and quality check patterns.
 */

export interface LongTailTemplate {
  key: string;
  label: string;
  description: string;
  mandatorySections: string[];
  /** Regex patterns to detect required sections in generated HTML */
  sectionPatterns: RegExp[];
  /** Whether a summary table is mandatory */
  requiresTable: boolean;
  /** Minimum word count for this template */
  minWordCount: number;
  /** FAQ topic guidance for the AI */
  faqTopics: string[];
  /** Whether this template is time-sensitive (affects stale_after) */
  timeSensitive: boolean;
  /** Prompt instructions injected into AI generation */
  promptInstructions: string;
  /** Internal link categories to prioritize */
  linkCategories: string[];
}

export const LONG_TAIL_TEMPLATES: Record<string, LongTailTemplate> = {
  'age-limit': {
    key: 'age-limit',
    label: 'Age Limit',
    description: 'Age limit breakdown by category for exams/jobs',
    mandatorySections: ['quick-answer', 'summary-table', 'official-rules', 'category-breakdown', 'relaxation', 'faq', 'related-links'],
    sectionPatterns: [/<table/i, /faq|frequently/i, /relaxation|छूट|age\s*relaxation/i, /category|वर्ग/i],
    requiresTable: true,
    minWordCount: 800,
    faqTopics: ['category relaxation', 'age proof documents', 'exceptions', 'upper age limit', 'date of birth calculation'],
    timeSensitive: true,
    promptInstructions: `Write an age limit information page. Start with the DIRECT age limit answer in the first sentence. Include a category-wise age limit table (General/OBC/SC/ST/PwD). Explain official age relaxation rules. Cover common confusion points. Use factual tone, not editorial. Do NOT write a bloggy introduction.`,
    linkCategories: ['eligibility', 'exam-pattern', 'salary'],
  },
  'salary': {
    key: 'salary',
    label: 'Salary',
    description: 'Salary details including basic pay, allowances, in-hand',
    mandatorySections: ['salary-snapshot', 'salary-table', 'basic-pay', 'in-hand', 'allowances', 'faq', 'related-links'],
    sectionPatterns: [/<table/i, /faq|frequently/i, /allowance|भत्ता/i, /in.?hand|इन.?हैंड|net\s*salary/i, /basic\s*pay|मूल\s*वेतन/i],
    requiresTable: true,
    minWordCount: 900,
    faqTopics: ['in-hand salary', 'allowances breakdown', 'deductions', 'probation period salary', 'salary after promotion'],
    timeSensitive: false,
    promptInstructions: `Write a salary information page. Start with the exact salary range in the first sentence. Include a salary breakdown table (Basic Pay, DA, HRA, other allowances, deductions, in-hand). Explain Pay Level/Pay Matrix context. Cover promotion and growth briefly. Use factual tone. Do NOT write a bloggy introduction.`,
    linkCategories: ['eligibility', 'selection-process', 'exam-pattern'],
  },
  'eligibility': {
    key: 'eligibility',
    label: 'Eligibility',
    description: 'Eligibility criteria including education, age, nationality',
    mandatorySections: ['quick-answer', 'qualification', 'age-criteria', 'relaxation', 'summary-table', 'faq', 'related-links'],
    sectionPatterns: [/<table/i, /faq|frequently/i, /qualification|योग्यता/i, /age|आयु/i],
    requiresTable: true,
    minWordCount: 800,
    faqTopics: ['final year eligibility', 'age relaxation for categories', 'attempt limits', 'qualification confusion'],
    timeSensitive: true,
    promptInstructions: `Write an eligibility criteria page. Start with the direct eligibility answer. Include education qualification, age criteria, nationality requirements, attempt limits if applicable, and category-wise relaxation. Use a summary table. Cover special cases and exceptions. Factual tone only.`,
    linkCategories: ['age-limit', 'syllabus', 'exam-pattern'],
  },
  'syllabus': {
    key: 'syllabus',
    label: 'Syllabus',
    description: 'Detailed syllabus and topic breakdown',
    mandatorySections: ['exam-overview', 'paper-structure', 'subject-wise-syllabus', 'topic-breakdown', 'faq', 'related-links'],
    sectionPatterns: [/<table/i, /faq|frequently/i, /syllabus|पाठ्यक्रम/i, /subject|विषय/i],
    requiresTable: true,
    minWordCount: 1000,
    faqTopics: ['latest pattern changes', 'official syllabus source', 'topic weightage', 'preparation priority'],
    timeSensitive: true,
    promptInstructions: `Write a syllabus information page. Start with exam overview. Include paper/stage structure table. Provide subject-wise detailed syllabus with topic breakdown. Note latest pattern changes. Reference official source. Factual, structured format.`,
    linkCategories: ['exam-pattern', 'eligibility', 'selection-process'],
  },
  'exam-pattern': {
    key: 'exam-pattern',
    label: 'Exam Pattern',
    description: 'Exam pattern, marking scheme, paper structure',
    mandatorySections: ['pattern-overview', 'stage-table', 'marking-scheme', 'faq', 'related-links'],
    sectionPatterns: [/<table/i, /faq|frequently/i, /pattern|पैटर्न|marking|अंकन/i],
    requiresTable: true,
    minWordCount: 800,
    faqTopics: ['negative marking', 'sectional cutoff', 'time management', 'calculator allowed'],
    timeSensitive: true,
    promptInstructions: `Write an exam pattern page. Start with pattern overview. Include stage-wise table with subjects, questions, marks, and duration. Explain marking scheme and negative marking. Cover time management tips briefly. Factual tone.`,
    linkCategories: ['syllabus', 'eligibility', 'selection-process'],
  },
  'selection-process': {
    key: 'selection-process',
    label: 'Selection Process',
    description: 'Step-by-step selection process explanation',
    mandatorySections: ['process-overview', 'stages', 'faq', 'related-links'],
    sectionPatterns: [/faq|frequently/i, /selection|चयन/i, /stage|चरण|tier|phase/i],
    requiresTable: false,
    minWordCount: 700,
    faqTopics: ['total time for selection', 'interview requirements', 'document verification process', 'physical test details'],
    timeSensitive: false,
    promptInstructions: `Write a selection process page. Start with process overview. Explain each stage/tier step-by-step. Include timeline if available. Cover document verification and final steps. Use numbered list format for stages.`,
    linkCategories: ['exam-pattern', 'eligibility', 'salary'],
  },
  'application-fee': {
    key: 'application-fee',
    label: 'Application Fee',
    description: 'Application fee details by category and payment methods',
    mandatorySections: ['fee-table', 'payment-methods', 'faq', 'related-links'],
    sectionPatterns: [/<table/i, /faq|frequently/i, /fee|शुल्क|payment|भुगतान/i],
    requiresTable: true,
    minWordCount: 600,
    faqTopics: ['fee refund policy', 'payment methods', 'fee exemption categories', 'fee correction'],
    timeSensitive: true,
    promptInstructions: `Write an application fee page. Start with the fee amount. Include category-wise fee table (General/OBC/SC/ST/PwD/Female). Explain payment methods. Cover refund policy if applicable. Factual format.`,
    linkCategories: ['eligibility', 'dates'],
  },
  'dates': {
    key: 'dates',
    label: 'Important Dates / Last Date',
    description: 'Important dates and deadlines',
    mandatorySections: ['dates-table', 'key-deadlines', 'faq', 'related-links'],
    sectionPatterns: [/<table/i, /faq|frequently/i, /date|तारीख|deadline|अंतिम/i],
    requiresTable: true,
    minWordCount: 600,
    faqTopics: ['date extension possibility', 'correction window', 'late fee period', 'exam date confirmation'],
    timeSensitive: true,
    promptInstructions: `Write an important dates page. Start with the most critical deadline. Include a comprehensive dates table. Cover correction window, late fee period if applicable. Factual format. Keep it concise.`,
    linkCategories: ['application-fee', 'eligibility', 'admit-card'],
  },
  'admit-card': {
    key: 'admit-card',
    label: 'Admit Card',
    description: 'Admit card download steps and details',
    mandatorySections: ['download-steps', 'important-details', 'faq', 'related-links'],
    sectionPatterns: [/faq|frequently/i, /admit\s*card|प्रवेश\s*पत्र|download|डाउनलोड/i],
    requiresTable: false,
    minWordCount: 600,
    faqTopics: ['download steps', 'login credentials needed', 'photo mismatch issue', 'duplicate admit card'],
    timeSensitive: true,
    promptInstructions: `Write an admit card information page. Start with download availability status. Provide step-by-step download instructions. Cover what details the admit card contains. Address common issues like photo mismatch. Factual format.`,
    linkCategories: ['exam-pattern', 'dates', 'result'],
  },
  'result': {
    key: 'result',
    label: 'Result',
    description: 'Result announcement, checking steps, cutoff',
    mandatorySections: ['result-status', 'check-steps', 'cutoff', 'faq', 'related-links'],
    sectionPatterns: [/faq|frequently/i, /result|रिजल्ट|परिणाम/i, /cutoff|कटऑफ|cut.?off/i],
    requiresTable: true,
    minWordCount: 700,
    faqTopics: ['result release timing', 'next steps after result', 'cutoff trends', 'scorecard download'],
    timeSensitive: true,
    promptInstructions: `Write a result information page. Start with current result status. Provide step-by-step result checking instructions. Include expected/previous cutoff table if available. Cover next steps after result. Factual format.`,
    linkCategories: ['admit-card', 'selection-process', 'salary'],
  },
  'qualification': {
    key: 'qualification',
    label: 'Qualification',
    description: 'Educational qualification requirements in detail',
    mandatorySections: ['qualification-summary', 'post-wise-breakdown', 'faq', 'related-links'],
    sectionPatterns: [/faq|frequently/i, /qualification|योग्यता|education|शिक्षा/i],
    requiresTable: true,
    minWordCount: 700,
    faqTopics: ['degree equivalence', 'final year eligibility', 'distance education validity', 'minimum percentage'],
    timeSensitive: false,
    promptInstructions: `Write a qualification requirements page. Start with the minimum qualification. Include post-wise qualification table if multiple posts. Cover degree recognition rules. Address common doubts about equivalence and distance education. Factual format.`,
    linkCategories: ['eligibility', 'age-limit', 'selection-process'],
  },
  'state-landing': {
    key: 'state-landing',
    label: 'State/Department Landing',
    description: 'State or department-specific job overview',
    mandatorySections: ['overview', 'major-recruitments', 'faq', 'related-links'],
    sectionPatterns: [/faq|frequently/i],
    requiresTable: true,
    minWordCount: 800,
    faqTopics: ['domicile requirement', 'state-specific age relaxation', 'major departments hiring'],
    timeSensitive: false,
    promptInstructions: `Write a state/department landing page for government jobs. Start with overview of recruitment landscape. List major recruiting bodies and upcoming exams. Include a table of recent/upcoming recruitments. Cover state-specific rules. Factual format.`,
    linkCategories: ['eligibility', 'salary', 'exam-pattern'],
  },
  'category-landing': {
    key: 'category-landing',
    label: 'Category Landing',
    description: 'Category-specific opportunities overview',
    mandatorySections: ['overview', 'opportunities-list', 'faq', 'related-links'],
    sectionPatterns: [/faq|frequently/i],
    requiresTable: true,
    minWordCount: 800,
    faqTopics: ['reservation percentage', 'certificate requirements', 'creamy layer concept'],
    timeSensitive: false,
    promptInstructions: `Write a category-specific landing page (e.g., OBC/SC/ST opportunities). Start with overview of available opportunities for this category. List major exams with category-specific benefits. Include reservation table. Cover certificate requirements. Factual format.`,
    linkCategories: ['eligibility', 'age-limit', 'salary'],
  },
  'department-landing': {
    key: 'department-landing',
    label: 'Department Landing',
    description: 'Department/ministry-specific job overview',
    mandatorySections: ['overview', 'positions', 'faq', 'related-links'],
    sectionPatterns: [/faq|frequently/i],
    requiresTable: true,
    minWordCount: 800,
    faqTopics: ['department hierarchy', 'transfer policy', 'promotion prospects'],
    timeSensitive: false,
    promptInstructions: `Write a department/ministry landing page. Start with department overview. List available positions and recruitment channels. Include salary and career growth table. Cover work culture and transfer policy briefly. Factual format.`,
    linkCategories: ['salary', 'eligibility', 'selection-process'],
  },
  'comparison': {
    key: 'comparison',
    label: 'Comparison',
    description: 'Side-by-side comparison of exams, jobs, or paths',
    mandatorySections: ['comparison-table', 'key-differences', 'recommendation', 'faq', 'related-links'],
    sectionPatterns: [/<table/i, /faq|frequently/i, /comparison|तुलना|vs|versus|difference|अंतर/i],
    requiresTable: true,
    minWordCount: 900,
    faqTopics: ['which is easier', 'which pays more', 'career growth comparison', 'eligibility overlap'],
    timeSensitive: false,
    promptInstructions: `Write a comparison page. Start with a quick comparison table covering all major aspects. Then explain key differences in detail: eligibility, salary, career path, exam difficulty, work nature. End with a clear recommendation for different profiles. Factual format.`,
    linkCategories: ['eligibility', 'salary', 'exam-pattern'],
  },
  'how-to-guide': {
    key: 'how-to-guide',
    label: 'How-To Guide',
    description: 'Step-by-step guide for a specific process',
    mandatorySections: ['quick-overview', 'steps', 'faq', 'related-links'],
    sectionPatterns: [/faq|frequently/i, /step|चरण|how\s*to|कैसे/i],
    requiresTable: false,
    minWordCount: 700,
    faqTopics: ['common mistakes', 'time required', 'documents needed', 'alternative methods'],
    timeSensitive: false,
    promptInstructions: `Write a how-to guide. Start with a quick overview of what will be covered. Provide clear numbered steps. Include screenshots descriptions if applicable. Cover common mistakes. Address alternatives. Actionable tone.`,
    linkCategories: ['eligibility', 'dates', 'application-fee'],
  },
  'keyword-answer': {
    key: 'keyword-answer',
    label: 'Keyword Answer',
    description: 'Direct answer to a specific search query',
    mandatorySections: ['direct-answer', 'explanation', 'faq', 'related-links'],
    sectionPatterns: [/faq|frequently/i],
    requiresTable: false,
    minWordCount: 600,
    faqTopics: ['related questions', 'follow-up doubts', 'verification source'],
    timeSensitive: false,
    promptInstructions: `Write a keyword answer page. Start with the DIRECT answer in the first sentence — no preamble. Then provide supporting explanation with specifics. Include official source reference if applicable. Cover related follow-up questions. Very concise, factual format.`,
    linkCategories: ['eligibility', 'salary', 'exam-pattern'],
  },
};

export const TEMPLATE_OPTIONS = Object.values(LONG_TAIL_TEMPLATES).map(t => ({
  value: t.key,
  label: t.label,
  description: t.description,
}));

export function getTemplate(key: string): LongTailTemplate | null {
  return LONG_TAIL_TEMPLATES[key] || null;
}

export function getTemplateLabel(key: string): string {
  return LONG_TAIL_TEMPLATES[key]?.label || key;
}

/** Build the long-tail-specific system prompt section for AI generation */
export function buildLongTailPromptSection(template: LongTailTemplate, context: {
  primaryKeyword: string;
  targetExam?: string;
  targetState?: string;
  targetDepartment?: string;
  targetYear?: string;
  officialSourceUrl?: string;
}): string {
  const parts: string[] = [
    `PAGE TYPE: Long Tail SEO Page — ${template.label}`,
    '',
    'CONTENT MODE: This is NOT a regular blog article. This is a factual, intent-driven SEO landing page.',
    '',
    template.promptInstructions,
    '',
    'STRUCTURE RULES:',
    '- Start with the DIRECT ANSWER in the first 1-2 sentences — no editorial introduction',
    '- Use answer-first format throughout',
    template.requiresTable ? '- Include at least ONE data table — this is MANDATORY for this page type' : '',
    '- Include a proper FAQ section with 4-6 relevant Q&As',
    '- End with a Related Links section (suggest 3-5 internal link topics)',
    '- Keep paragraphs to 2-3 sentences maximum',
    '- Use H2 for main sections, H3 for subsections',
    '- Bold only critical data: numbers, dates, salary figures',
    '',
    'MANDATORY SECTIONS:',
    ...template.mandatorySections.map(s => `- ${s}`),
    '',
    'FAQ TOPICS TO COVER:',
    ...template.faqTopics.map(t => `- ${t}`),
  ].filter(Boolean);

  if (context.targetExam) parts.push(`\nTARGET EXAM: ${context.targetExam}`);
  if (context.targetState) parts.push(`TARGET STATE: ${context.targetState}`);
  if (context.targetDepartment) parts.push(`TARGET DEPARTMENT: ${context.targetDepartment}`);
  if (context.targetYear) parts.push(`TARGET YEAR: ${context.targetYear}`);
  if (context.officialSourceUrl) {
    parts.push(`\nOFFICIAL SOURCE: ${context.officialSourceUrl}`);
    parts.push('Reference this official source in the content. Include factual data from this source.');
  }

  return parts.join('\n');
}
