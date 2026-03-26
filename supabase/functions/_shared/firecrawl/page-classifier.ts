/**
 * Source 3: Page-level bucket classifier.
 * Classifies discovered pages into buckets based on URL path and title signals.
 * Does NOT use AI — purely deterministic keyword matching for cost safety.
 *
 * Buckets:
 *   single_recruitment  — individual job/vacancy notification page
 *   collection_roundup  — listing page with multiple job links
 *   exam_update         — exam schedule, admit card, answer key, result
 *   prep_resource       — syllabus, previous papers, mock test, quiz
 *   rejected            — off-topic, navigation, or blocked content
 */

export type PageBucket = 'single_recruitment' | 'collection_roundup' | 'exam_update' | 'prep_resource' | 'rejected';

export interface ClassificationResult {
  bucket: PageBucket;
  reason: string;
  signals: string[];
  confidence: 'high' | 'medium' | 'low';
}

// ============ Signal Dictionaries ============

const SINGLE_RECRUITMENT_SIGNALS = [
  // English
  'recruitment', 'vacancy', 'vacancies', 'notification',
  'online-form', 'online_form', 'apply-online', 'apply_online',
  'walk-in', 'walkin', 'walk_in', 'advt', 'advertisement',
  'bharti', 'hiring', 'openings',
  // Hindi transliteration
  'naukri', 'nokri', 'rojgar', 'bharti',
  // Patterns that suggest a specific job post
  'post-name', 'post_name', 'total-post', 'total_post',
  'age-limit', 'age_limit', 'last-date', 'last_date',
  'application-fee', 'application_fee', 'how-to-apply',
  'important-dates', 'important_dates', 'eligibility',
  'qualification', 'pay-scale', 'pay_scale', 'salary',
];

const COLLECTION_ROUNDUP_SIGNALS = [
  'latest-government-jobs', 'latest_government_jobs',
  'central-government-jobs', 'central_government_jobs',
  'state-government-jobs', 'state_government_jobs',
  'govt-jobs', 'govt_jobs', 'government-jobs', 'government_jobs',
  'sarkari-naukri', 'sarkari_naukri', 'sarkarinaukri',
  'job-list', 'job_list', 'jobs-list', 'jobs_list',
  'all-jobs', 'all_jobs',
  'latest-jobs', 'latest_jobs', 'new-jobs', 'new_jobs',
  'category', 'department', 'psu',
];

const EXAM_UPDATE_SIGNALS = [
  'result', 'results', 'admit-card', 'admitcard', 'admit_card',
  'answer-key', 'answerkey', 'answer_key',
  'exam-date', 'exam_date', 'exam-schedule', 'exam_schedule',
  'cut-off', 'cutoff', 'cut_off', 'merit-list', 'merit_list',
  'score-card', 'scorecard', 'score_card',
];

const PREP_RESOURCE_SIGNALS = [
  'syllabus', 'previous-paper', 'previous_paper', 'previouspaper',
  'mock-test', 'mocktest', 'mock_test',
  'quiz', 'practice', 'study-material', 'study_material',
  'preparation', 'current-affairs', 'current_affairs',
  'gk', 'general-knowledge', 'general_knowledge',
  'book', 'pdf-download', 'pdf_download',
  'solved-paper', 'solved_paper', 'model-paper', 'model_paper',
];

const REJECT_SIGNALS = [
  'private-jobs', 'private_jobs', 'off-campus', 'offcampus',
  'scholarship', 'internship',
  'privacy-policy', 'terms', 'disclaimer', 'about-us', 'contact',
  'sitemap', 'login', 'register', 'signup',
  'whatsapp-group', 'telegram-group', 'telegram-channel',
  'facebook', 'twitter', 'instagram',
];

// ============ Title-level signals ============

const TITLE_SINGLE_RECRUITMENT = [
  'recruitment', 'vacancy', 'notification', 'bharti',
  'apply online', 'walk-in', 'walk in', 'advt',
  'hiring', 'posts', 'openings',
  /\d+\s*(posts?|vacancies|seats|positions)/i,
];

const TITLE_COLLECTION = [
  'latest', 'government jobs', 'govt jobs', 'sarkari naukri',
  'job list', 'all jobs', 'new jobs', 'today',
  /jobs?\s*\d{4}/i, // e.g. "Jobs 2026"
];

// ============ Classifier ============

function countSignals(text: string, signals: (string | RegExp)[]): string[] {
  const lower = text.toLowerCase();
  const matched: string[] = [];
  for (const signal of signals) {
    if (signal instanceof RegExp) {
      if (signal.test(text)) matched.push(signal.source);
    } else if (lower.includes(signal)) {
      matched.push(signal);
    }
  }
  return matched;
}

/**
 * Classify a discovered page into a bucket.
 * Uses URL path + page title (if available).
 * Returns bucket, reasoning, and matched signals.
 */
/**
 * Score a government page URL for recruitment relevance.
 * Higher score = more likely a job page. PDF links get a +2 bonus.
 */
export function scoreGovtPage(url: string, title?: string | null): number {
  const lower = url.toLowerCase() + ' ' + (title || '').toLowerCase();
  let score = 0;

  // +3: strong recruitment signals
  const strong = ['recruitment', 'vacancy', 'notification', 'advertisement'];
  for (const s of strong) { if (lower.includes(s)) score += 3; }

  // +2: moderate signals
  const moderate = ['careers', 'jobs', 'apply', 'notices', 'walk-in', 'walkin'];
  for (const s of moderate) { if (lower.includes(s)) score += 2; }

  // +1: weak signals
  const weak = ['latest', 'updates', 'circular', 'bharti', 'advt', 'openings', 'hiring', 'naukri'];
  for (const s of weak) { if (lower.includes(s)) score += 1; }

  // -2: navigation/junk
  const negative = ['sitemap', 'login', 'about', 'contact', 'privacy', 'rss', 'feed', 'disclaimer', 'terms'];
  for (const s of negative) { if (lower.includes(s)) score -= 2; }

  // PDF bonus
  if (url.toLowerCase().endsWith('.pdf')) score += 2;

  return score;
}

export function classifyPage(
  url: string,
  pageTitle?: string | null
): ClassificationResult {
  const urlLower = url.toLowerCase();
  const titleLower = (pageTitle || '').toLowerCase();
  const combined = urlLower + ' ' + titleLower;

  // Score each bucket
  const rejectMatches = countSignals(combined, REJECT_SIGNALS);
  if (rejectMatches.length >= 2) {
    return {
      bucket: 'rejected',
      reason: `Strong reject signals in URL/title: ${rejectMatches.join(', ')}`,
      signals: rejectMatches,
      confidence: 'high',
    };
  }

  const prepMatches = countSignals(combined, PREP_RESOURCE_SIGNALS);
  const examMatches = countSignals(combined, EXAM_UPDATE_SIGNALS);
  const singleMatches = countSignals(urlLower, SINGLE_RECRUITMENT_SIGNALS);
  const collectionMatches = countSignals(urlLower, COLLECTION_ROUNDUP_SIGNALS);

  // Title-level boosting
  const titleSingleMatches = countSignals(titleLower, TITLE_SINGLE_RECRUITMENT);
  const titleCollectionMatches = countSignals(titleLower, TITLE_COLLECTION);

  const singleScore = singleMatches.length + titleSingleMatches.length * 2;
  const collectionScore = collectionMatches.length + titleCollectionMatches.length * 2;
  const examScore = examMatches.length;
  const prepScore = prepMatches.length;

  // Pick highest score, with tie-breaking order:
  // single_recruitment > collection_roundup > exam_update > prep_resource > rejected
  const scores: { bucket: PageBucket; score: number; signals: string[] }[] = [
    { bucket: 'single_recruitment', score: singleScore, signals: [...singleMatches, ...titleSingleMatches] },
    { bucket: 'collection_roundup', score: collectionScore, signals: [...collectionMatches, ...titleCollectionMatches] },
    { bucket: 'exam_update', score: examScore, signals: examMatches },
    { bucket: 'prep_resource', score: prepScore, signals: prepMatches },
  ];

  scores.sort((a, b) => b.score - a.score);
  const winner = scores[0];

  if (winner.score === 0) {
    // No signals at all — check if single reject signal
    if (rejectMatches.length > 0) {
      return {
        bucket: 'rejected',
        reason: `Weak reject signal: ${rejectMatches.join(', ')}`,
        signals: rejectMatches,
        confidence: 'low',
      };
    }
    // Truly neutral — default to collection_roundup (likely a listing page)
    return {
      bucket: 'collection_roundup',
      reason: 'No strong signals; defaulting to collection (possible listing page)',
      signals: [],
      confidence: 'low',
    };
  }

  const confidence = winner.score >= 3 ? 'high' : winner.score >= 2 ? 'medium' : 'low';

  return {
    bucket: winner.bucket,
    reason: `Matched ${winner.signals.length} ${winner.bucket} signals: ${winner.signals.slice(0, 5).join(', ')}`,
    signals: winner.signals,
    confidence,
  };
}
