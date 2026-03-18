// Deterministic keyword-based classifier for RSS items
// Two-level taxonomy: primary_domain + item_type
// No AI — pure rule-based matching with specificity-first ordering

export interface ClassificationResult {
  itemType: string;
  primaryDomain: string;
  displayGroup: string;
  relevanceLevel: 'High' | 'Medium' | 'Low';
  detectionReason: string;
}

interface Rule {
  type: string;
  domain: string;
  displayGroup: string;
  relevance: 'High' | 'Medium' | 'Low';
  patterns: RegExp[];
}

// IMPORTANT: Rules are ordered by specificity — most specific first.
// Education/exam-specific rules come before generic jobs rules to prevent
// items like "scholarship result" or "school admission" from being swallowed
// by broad recruitment/notification patterns.

const RULES: Rule[] = [
  // ── Education Services (most specific, checked first) ──
  {
    type: 'scholarship',
    domain: 'education_services',
    displayGroup: 'Education Services',
    relevance: 'Medium',
    patterns: [
      /\b(scholarship|stipend|fellowship|financial\s*assistance|छात्रवृत्ति|merit[\s-]*cum[\s-]*means)\b/i,
    ],
  },
  {
    type: 'marksheet',
    domain: 'education_services',
    displayGroup: 'Education Services',
    relevance: 'Medium',
    patterns: [
      /\b(marksheet|mark\s*sheet|grade\s*sheet|transcript|duplicate\s*marksheet|marksheet\s*correction|अंकपत्र|अंक\s*पत्र)\b/i,
    ],
  },
  {
    type: 'certificate',
    domain: 'education_services',
    displayGroup: 'Education Services',
    relevance: 'Medium',
    patterns: [
      /\b(provisional\s*certificate|migration\s*certificate|duplicate\s*certificate|character\s*certificate|issue\s*certificate|प्रमाण\s*पत्र)\b/i,
    ],
  },
  {
    type: 'school_service',
    domain: 'education_services',
    displayGroup: 'Education Services',
    relevance: 'Medium',
    patterns: [
      /\b(school\s*admission|residential\s*school|school\s*service|school\s*transfer|board\s*school\s*service|विद्यालय\s*सेवा)\b/i,
    ],
  },
  {
    type: 'university_service',
    domain: 'education_services',
    displayGroup: 'Education Services',
    relevance: 'Medium',
    patterns: [
      /\b(college\s*affiliation|degree\s*college|noc\s*for\s*college|higher\s*education\s*service|affiliation\s*service|college\s*service|विश्वविद्यालय\s*सेवा)\b/i,
    ],
  },
  {
    type: 'document_service',
    domain: 'education_services',
    displayGroup: 'Education Services',
    relevance: 'Medium',
    patterns: [
      /\b(document\s*verification|document\s*correction|document\s*service|upload\s*document|education\s*record\s*service)\b/i,
    ],
  },

  // ── Exam Updates (specific exam-related, before generic jobs) ──
  {
    type: 'admit_card',
    domain: 'exam_updates',
    displayGroup: 'Exam Updates',
    relevance: 'High',
    patterns: [
      /\b(admit\s*card|hall\s*ticket|call\s*letter|प्रवेश\s*पत्र)\b/i,
    ],
  },
  {
    type: 'answer_key',
    domain: 'exam_updates',
    displayGroup: 'Exam Updates',
    relevance: 'High',
    patterns: [
      /\b(answer\s*key|provisional\s*key|final\s*key|उत्तर\s*कुंजी)\b/i,
    ],
  },
  {
    type: 'result',
    domain: 'exam_updates',
    displayGroup: 'Exam Updates',
    relevance: 'High',
    patterns: [
      /\b(result|shortlisted|merit\s*list|final\s*list|selected\s*candidates|cut[\s-]*off|परिणाम)\b/i,
    ],
  },
  {
    type: 'syllabus',
    domain: 'exam_updates',
    displayGroup: 'Exam Updates',
    relevance: 'Medium',
    patterns: [
      /\b(syllabus|exam\s*pattern|पाठ्यक्रम)\b/i,
    ],
  },
  {
    type: 'exam',
    domain: 'exam_updates',
    displayGroup: 'Exam Updates',
    relevance: 'High',
    patterns: [
      /\b(exam(?:ination)?|written\s*test|cbt|exam\s*date|exam\s*schedule|परीक्षा)\b/i,
    ],
  },

  // ── Jobs (after exam-specific rules) ──
  {
    type: 'recruitment',
    domain: 'jobs',
    displayGroup: 'Government Jobs',
    relevance: 'High',
    patterns: [
      /\b(recruitment|recruitment\s*drive|भर्ती|नियुक्ति|vacancy\s*circular)\b/i,
      /\b(advertisement|advt|apply\s*online|application\s*form|recruitment\s*notification)\b/i,
      /\b(hiring|appointment|application\s*for\s*post)\b/i,
    ],
  },
  {
    type: 'vacancy',
    domain: 'jobs',
    displayGroup: 'Government Jobs',
    relevance: 'High',
    patterns: [
      /\b(vacancy|vacancies)\b/i,
      /\b(\d+\s*(?:posts?|vacancies|positions?))\b/i,
      /\b(job\s*(?:notification|opening|post)|posts?\s*(?:of|for)|selection\s*process)\b/i,
    ],
  },

  // ── Policy Updates ──
  {
    type: 'circular',
    domain: 'policy_updates',
    displayGroup: 'Policy Updates',
    relevance: 'Medium',
    patterns: [
      /\b(circular|office\s*memorandum|परिपत्र)\b/i,
    ],
  },
  {
    type: 'policy',
    domain: 'policy_updates',
    displayGroup: 'Policy Updates',
    relevance: 'Medium',
    patterns: [
      /\b(press\s*release|policy|guideline|regulation|amendment|gazette|framework|नीति)\b/i,
    ],
  },

  // ── Public Services ──
  {
    type: 'notification',
    domain: 'public_services',
    displayGroup: 'Public Services',
    relevance: 'Medium',
    patterns: [
      /\b(public\s*service|citizen\s*service|e-?governance|digital\s*service|service\s*delivery)\b/i,
    ],
  },

  // ── General Alerts (catch-all signals) ──
  {
    type: 'signal',
    domain: 'general_alerts',
    displayGroup: 'General Alerts',
    relevance: 'Low',
    patterns: [
      /\b(notice|update|announcement|tender|corrigendum|extension|addendum|notification)\b/i,
    ],
  },
];

/**
 * Classify an RSS item based on title, summary, and categories.
 * Rules are ordered by specificity: education/exam-specific before generic jobs/notification.
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
          primaryDomain: rule.domain,
          displayGroup: rule.displayGroup,
          relevanceLevel: rule.relevance,
          detectionReason: `Matched "${match[0]}" → ${rule.domain}/${rule.type}`,
        };
      }
    }
  }

  return {
    itemType: 'unknown',
    primaryDomain: 'general_alerts',
    displayGroup: 'General Alerts',
    relevanceLevel: 'Low',
    detectionReason: 'No keyword match found',
  };
}
