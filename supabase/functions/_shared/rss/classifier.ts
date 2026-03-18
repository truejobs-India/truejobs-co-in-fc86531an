// Deterministic keyword-based classifier for RSS items
// No AI — pure rule-based matching

export interface ClassificationResult {
  itemType: string;
  relevanceLevel: 'High' | 'Medium' | 'Low';
  detectionReason: string;
}

interface Rule {
  type: string;
  relevance: 'High' | 'Medium' | 'Low';
  patterns: RegExp[];
}

const RULES: Rule[] = [
  {
    type: 'recruitment',
    relevance: 'High',
    patterns: [
      /\b(recruitment|vacancy|vacancies|openings?|hiring|recruitment\s*drive|भर्ती|नियुक्ति|vacancy\s*circular)\b/i,
      /\b(notification|advertisement|advt|apply\s*online|application\s*form|recruitment\s*notification)\b/i,
    ],
  },
  {
    type: 'vacancy',
    relevance: 'High',
    patterns: [
      /\b(\d+\s*(?:posts?|vacancies|positions?))\b/i,
      /\b(job\s*(?:notification|opening|post)|posts?\s*(?:of|for)|selection\s*process)\b/i,
    ],
  },
  {
    type: 'admit_card',
    relevance: 'High',
    patterns: [
      /\b(admit\s*card|hall\s*ticket|call\s*letter|प्रवेश\s*पत्र)\b/i,
    ],
  },
  {
    type: 'result',
    relevance: 'High',
    patterns: [
      /\b(result|shortlisted|merit\s*list|final\s*list|selected\s*candidates|परिणाम)\b/i,
    ],
  },
  {
    type: 'answer_key',
    relevance: 'High',
    patterns: [
      /\b(answer\s*key|provisional\s*key|final\s*key|उत्तर\s*कुंजी)\b/i,
    ],
  },
  {
    type: 'exam',
    relevance: 'High',
    patterns: [
      /\b(exam(?:ination)?|written\s*test|cbt|exam\s*date|exam\s*schedule|परीक्षा)\b/i,
    ],
  },
  {
    type: 'syllabus',
    relevance: 'Medium',
    patterns: [
      /\b(syllabus|exam\s*pattern|पाठ्यक्रम)\b/i,
    ],
  },
  {
    type: 'policy',
    relevance: 'Medium',
    patterns: [
      /\b(press\s*release|policy|guideline|circular|amendment|gazette|office\s*memorandum|om\b)/i,
    ],
  },
  {
    type: 'signal',
    relevance: 'Low',
    patterns: [
      /\b(notice|update|announcement|tender|corrigendum|extension|addendum)\b/i,
    ],
  },
];

/**
 * Classify an RSS item based on title, summary, and categories
 */
export function classifyItem(
  title: string,
  summary: string | null,
  categories: string[]
): ClassificationResult {
  const text = [title, summary || '', ...categories].join(' ');

  for (const rule of RULES) {
    for (const pattern of rule.patterns) {
      const match = text.match(pattern);
      if (match) {
        return {
          itemType: rule.type,
          relevanceLevel: rule.relevance,
          detectionReason: `Matched "${match[0]}" → ${rule.type}`,
        };
      }
    }
  }

  return {
    itemType: 'unknown',
    relevanceLevel: 'Low',
    detectionReason: 'No keyword match found',
  };
}
