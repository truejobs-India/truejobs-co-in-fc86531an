// Deterministic keyword-based classifier for RSS items
// Tightened for TrueJobs.co.in: strict focus on govt jobs, exams, results, admit cards
// Two-level taxonomy: primary_domain + item_type
// No AI — pure rule-based matching with specificity-first ordering

export interface ClassificationResult {
  itemType: string;
  primaryDomain: string;
  displayGroup: string;
  relevanceLevel: 'High' | 'Medium' | 'Low';
  detectionReason: string;
  truejobsScore: number; // 0–100 relevance score for TrueJobs business goal
}

interface Rule {
  type: string;
  domain: string;
  displayGroup: string;
  relevance: 'High' | 'Medium' | 'Low';
  baseScore: number; // base TrueJobs relevance score for this rule
  patterns: RegExp[];
}

// ── Noise Rejection Patterns ──
// Items matching these are immediately rejected as irrelevant to TrueJobs
const NOISE_PATTERNS: RegExp[] = [
  // Satellite / telemetry / remote sensing (use lookahead instead of \b for underscore-separated codes)
  /(?:^|[\s,;|])(?:3RIMG|3RSND|3DIMG|L1B|L2B|SB1|SA1|MER2|L1C|HDF5|S1SCT|S1IRS)(?:[\s_,;|]|$)/i,
  /\b(sounder|imager|radiance|spectral|geolocation|swath)\b/i,
  /\b(INSAT[\s-]*3D|INSAT[\s-]*3DR|Kalpana[\s-]*1|Oceansat|Resourcesat|Cartosat|RISAT)\b/i,
  /\b(satellite\s*data|satellite\s*image|remote\s*sensing|earth\s*observation|meteorological\s*data)\b/i,
  // Weather / science / research
  /\b(cyclone\s*warning|weather\s*bulletin|monsoon\s*forecast|seismograph|earthquake\s*bulletin)\b/i,
  /\b(research\s*paper|scientific\s*journal|laboratory\s*report|technical\s*report)\b/i,
  // Financial / legal / SEBI
  /\b(recovery\s*certificate|attachment\s*order|illiquid\s*stock|SEBI\s*order|adjudicating\s*officer)\b/i,
  /\b(penalty\s*order|debarment\s*order|settlement\s*order|consent\s*order|PAN:\s*[A-Z]{5}\d{4}[A-Z])\b/i,
  /\b(mutual\s*fund\s*NAV|stock\s*exchange|securities\s*board|market\s*regulator)\b/i,
  // Utility / NOC / grievance
  /\b(NOC\s*(?:of|for)\s*(?:Mobile|Tower|Construction|Building))\b/i,
  /\b(status\s*check|status\s*lookup|application\s*status\s*(?:page|portal|check))\b/i,
  /\b(public\s*grievance|RTI\s*(?:reply|response|portal)|consumer\s*complaint)\b/i,
  // Tender-only (no co-occurring recruitment keywords)
  /\b(e[\s-]*tender|tender\s*notice|tender\s*document|NIT\s*for|invitation\s*(?:for|of)\s*tender)\b/i,
];

// Keywords that rescue an item from noise rejection if they co-occur
const RESCUE_KEYWORDS = /\b(recruitment|vacancy|vacancies|bharti|भर्ती|niyukti|नियुक्ति|exam(?:ination)?|result|admit\s*card|answer\s*key|merit\s*list|cut[\s-]*off|selection\s*list)\b/i;

// ── Core TrueJobs signal patterns for scoring ──
const RECRUITMENT_SIGNAL = /\b(recruitment|vacancy|vacancies|hiring|bharti|भर्ती|नियुक्ति|appointment|posts?\s*(?:of|for)|job\s*(?:notification|opening))\b/i;
const EXAM_SIGNAL = /\b(exam(?:ination)?|written\s*test|CBT|परीक्षा|admit\s*card|hall\s*ticket|answer\s*key|syllabus|exam\s*date|exam\s*schedule)\b/i;
const RESULT_SIGNAL = /\b(result|merit\s*list|cut[\s-]*off|score\s*card|selection\s*list|shortlisted|selected\s*candidates|परिणाम)\b/i;
const URGENCY_SIGNAL = /\b(last\s*date|closing\s*date|apply\s*(?:before|by)|deadline|correction\s*window|application\s*start|opening\s*date)\b/i;

/**
 * Check if text matches noise patterns and is NOT rescued by recruitment/exam keywords
 */
function isNoise(text: string): boolean {
  for (const pattern of NOISE_PATTERNS) {
    if (pattern.test(text)) {
      // Check if rescued by co-occurring recruitment keywords
      if (RESCUE_KEYWORDS.test(text)) return false;
      return true;
    }
  }
  return false;
}

/**
 * Compute TrueJobs relevance score (0–100)
 */
function computeTrueJobsScore(text: string, domain: string, hasPdf: boolean): number {
  let score = 0;

  // Recruitment intent: +40
  if (RECRUITMENT_SIGNAL.test(text)) score += 40;
  // Exam/result/admit card: +35
  if (EXAM_SIGNAL.test(text)) score += 25;
  if (RESULT_SIGNAL.test(text)) score += 20;
  // Urgency (dates, deadlines): +15
  if (URGENCY_SIGNAL.test(text)) score += 15;
  // PDF presence: +5
  if (hasPdf) score += 5;

  // Non-core domain penalty
  if (['policy_updates', 'public_services', 'education_services'].includes(domain)) {
    score -= 30;
  }
  if (domain === 'general_alerts') {
    score -= 40;
  }

  return Math.max(0, Math.min(100, score));
}

// IMPORTANT: Rules are ordered by specificity — most specific first.
// TrueJobs core rules (jobs, exams, results) come first with High relevance.
// Education services, policy, public services are deprioritized to Low.

const RULES: Rule[] = [
  // ── NEW: Post-exam / post-recruitment process (very specific, checked first) ──
  {
    type: 'result',
    domain: 'exam_updates',
    displayGroup: 'Exam Updates',
    relevance: 'High',
    baseScore: 80,
    patterns: [
      /\b(cut[\s-]*off|cutoff)\b/i,
      /\b(score\s*card|scorecard)\b/i,
      /\b(merit\s*list|final\s*list|select(?:ion)?\s*list|selected\s*candidates)\b/i,
      /\b(counselling|counseling)\b/i,
    ],
  },
  {
    type: 'exam',
    domain: 'exam_updates',
    displayGroup: 'Exam Updates',
    relevance: 'High',
    baseScore: 75,
    patterns: [
      /\b(document\s*verification|DV\s*schedule|DV\s*date)\b/i,
      /\b(interview\s*schedule|interview\s*date|viva[\s-]*voce)\b/i,
      /\b(PET|PST|physical\s*(?:efficiency|standard)\s*test)\b/i,
      /\b(skill\s*test|typing\s*test|computer\s*test)\b/i,
      /\b(joining\s*(?:date|letter|notice|schedule))\b/i,
    ],
  },

  // ── Recruitment dates (very high intent) ──
  {
    type: 'recruitment',
    domain: 'jobs',
    displayGroup: 'Government Jobs',
    relevance: 'High',
    baseScore: 85,
    patterns: [
      /\b(last\s*date\s*(?:of|for|to)\s*(?:apply|application|submission))\b/i,
      /\b(application\s*start\s*date|opening\s*date\s*(?:of|for)\s*application)\b/i,
      /\b(correction\s*window|edit\s*window)\b/i,
      /\b(apply\s*(?:before|by)\s*\d)/i,
    ],
  },

  // ── Exam Updates (core TrueJobs content) ──
  {
    type: 'admit_card',
    domain: 'exam_updates',
    displayGroup: 'Exam Updates',
    relevance: 'High',
    baseScore: 85,
    patterns: [
      /\b(admit\s*card|hall\s*ticket|call\s*letter|प्रवेश\s*पत्र)\b/i,
    ],
  },
  {
    type: 'answer_key',
    domain: 'exam_updates',
    displayGroup: 'Exam Updates',
    relevance: 'High',
    baseScore: 85,
    patterns: [
      /\b(answer\s*key|provisional\s*key|final\s*key|उत्तर\s*कुंजी)\b/i,
    ],
  },
  {
    type: 'result',
    domain: 'exam_updates',
    displayGroup: 'Exam Updates',
    relevance: 'High',
    baseScore: 80,
    patterns: [
      /\b(result|shortlisted|परिणाम)\b/i,
    ],
  },
  {
    type: 'syllabus',
    domain: 'exam_updates',
    displayGroup: 'Exam Updates',
    relevance: 'Medium',
    baseScore: 55,
    patterns: [
      /\b(syllabus|exam\s*pattern|पाठ्यक्रम)\b/i,
    ],
  },
  {
    type: 'exam',
    domain: 'exam_updates',
    displayGroup: 'Exam Updates',
    relevance: 'High',
    baseScore: 75,
    patterns: [
      /\b(exam(?:ination)?|written\s*test|cbt|exam\s*date|exam\s*schedule|परीक्षा)\b/i,
    ],
  },

  // ── Jobs (core TrueJobs content) ──
  {
    type: 'recruitment',
    domain: 'jobs',
    displayGroup: 'Government Jobs',
    relevance: 'High',
    baseScore: 90,
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
    baseScore: 90,
    patterns: [
      /\b(vacancy|vacancies)\b/i,
      /\b(\d+\s*(?:posts?|vacancies|positions?))\b/i,
      /\b(job\s*(?:notification|opening|post)|posts?\s*(?:of|for)|selection\s*process)\b/i,
    ],
  },

  // ── Education Services (DEPRIORITIZED — Low unless clearly tied to recruitment) ──
  {
    type: 'scholarship',
    domain: 'education_services',
    displayGroup: 'Education Services',
    relevance: 'Low',
    baseScore: 15,
    patterns: [
      /\b(scholarship|stipend|fellowship|financial\s*assistance|छात्रवृत्ति|merit[\s-]*cum[\s-]*means)\b/i,
    ],
  },
  {
    type: 'marksheet',
    domain: 'education_services',
    displayGroup: 'Education Services',
    relevance: 'Low',
    baseScore: 10,
    patterns: [
      /\b(marksheet|mark\s*sheet|grade\s*sheet|transcript|duplicate\s*marksheet|marksheet\s*correction|अंकपत्र|अंक\s*पत्र)\b/i,
    ],
  },
  {
    type: 'certificate',
    domain: 'education_services',
    displayGroup: 'Education Services',
    relevance: 'Low',
    baseScore: 10,
    patterns: [
      /\b(provisional\s*certificate|migration\s*certificate|duplicate\s*certificate|character\s*certificate|issue\s*certificate|प्रमाण\s*पत्र)\b/i,
    ],
  },
  {
    type: 'school_service',
    domain: 'education_services',
    displayGroup: 'Education Services',
    relevance: 'Low',
    baseScore: 10,
    patterns: [
      /\b(school\s*admission|residential\s*school|school\s*service|school\s*transfer|board\s*school\s*service|विद्यालय\s*सेवा)\b/i,
    ],
  },
  {
    type: 'university_service',
    domain: 'education_services',
    displayGroup: 'Education Services',
    relevance: 'Low',
    baseScore: 10,
    patterns: [
      /\b(college\s*affiliation|degree\s*college|noc\s*for\s*college|higher\s*education\s*service|affiliation\s*service|college\s*service|विश्वविद्यालय\s*सेवा)\b/i,
    ],
  },
  {
    type: 'document_service',
    domain: 'education_services',
    displayGroup: 'Education Services',
    relevance: 'Low',
    baseScore: 10,
    patterns: [
      /\b(document\s*verification|document\s*correction|document\s*service|upload\s*document|education\s*record\s*service)\b/i,
    ],
  },

  // ── Policy Updates (DEPRIORITIZED) ──
  {
    type: 'circular',
    domain: 'policy_updates',
    displayGroup: 'Policy Updates',
    relevance: 'Low',
    baseScore: 10,
    patterns: [
      /\b(circular|office\s*memorandum|परिपत्र)\b/i,
    ],
  },
  {
    type: 'policy',
    domain: 'policy_updates',
    displayGroup: 'Policy Updates',
    relevance: 'Low',
    baseScore: 10,
    patterns: [
      /\b(press\s*release|policy|guideline|regulation|amendment|gazette|framework|नीति)\b/i,
    ],
  },

  // ── Public Services (DEPRIORITIZED) ──
  {
    type: 'notification',
    domain: 'public_services',
    displayGroup: 'Public Services',
    relevance: 'Low',
    baseScore: 10,
    patterns: [
      /\b(public\s*service|citizen\s*service|e-?governance|digital\s*service|service\s*delivery)\b/i,
    ],
  },

  // ── General Alerts (catch-all, always Low) ──
  {
    type: 'signal',
    domain: 'general_alerts',
    displayGroup: 'General Alerts',
    relevance: 'Low',
    baseScore: 5,
    patterns: [
      /\b(notice|update|announcement|tender|corrigendum|extension|addendum|notification)\b/i,
    ],
  },
];

/**
 * Classify an RSS item based on title, summary, and categories.
 * Tightened for TrueJobs: noise-rejected first, then specificity-ordered rules.
 */
export function classifyItem(
  title: string,
  summary: string | null,
  categories: string[],
  hasPdf = false
): ClassificationResult {
  const text = [title, summary || '', ...categories].join(' ');

  // ── Step 0: Noise rejection ──
  if (isNoise(text)) {
    return {
      itemType: 'unknown',
      primaryDomain: 'general_alerts',
      displayGroup: 'General Alerts',
      relevanceLevel: 'Low',
      detectionReason: 'noise_rejected',
      truejobsScore: 0,
    };
  }

  // ── Step 1: Rule-based classification ──
  for (const rule of RULES) {
    for (const pattern of rule.patterns) {
      const match = text.match(pattern);
      if (match) {
        const score = computeTrueJobsScore(text, rule.domain, hasPdf);
        const finalScore = Math.max(score, rule.baseScore);
        return {
          itemType: rule.type,
          primaryDomain: rule.domain,
          displayGroup: rule.displayGroup,
          relevanceLevel: rule.relevance,
          detectionReason: `score=${finalScore} | Matched "${match[0]}" → ${rule.domain}/${rule.type}`,
          truejobsScore: finalScore,
        };
      }
    }
  }

  // ── Step 2: No match — unknown ──
  const fallbackScore = computeTrueJobsScore(text, 'general_alerts', hasPdf);
  return {
    itemType: 'unknown',
    primaryDomain: 'general_alerts',
    displayGroup: 'General Alerts',
    relevanceLevel: 'Low',
    detectionReason: `score=${fallbackScore} | No keyword match found`,
    truejobsScore: fallbackScore,
  };
}
