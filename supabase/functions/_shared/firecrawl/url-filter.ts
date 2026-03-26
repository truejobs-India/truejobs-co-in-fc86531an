/**
 * Source 3: URL filtering, normalization, and domain restriction.
 * Handles dedup, allowed/blocked pattern enforcement, and domain safety.
 */

// ============ URL Normalization ============

/**
 * Normalize a URL for deduplication:
 * - lowercase scheme + host
 * - remove trailing slashes
 * - remove common tracking params (utm_*, ref, source, fbclid, etc.)
 * - remove fragment (#)
 * - sort remaining query params for consistency
 */
export function normalizeUrl(rawUrl: string): string | null {
  try {
    const url = new URL(rawUrl.trim());

    // Lowercase scheme + host
    url.protocol = url.protocol.toLowerCase();
    url.hostname = url.hostname.toLowerCase();

    // Remove fragments
    url.hash = '';

    // Remove tracking params
    const trackingPrefixes = ['utm_', 'ref', 'source', 'fbclid', 'gclid', 'mc_', 'hsa_'];
    const paramsToDelete: string[] = [];
    url.searchParams.forEach((_val, key) => {
      if (trackingPrefixes.some(p => key.toLowerCase().startsWith(p))) {
        paramsToDelete.push(key);
      }
    });
    paramsToDelete.forEach(k => url.searchParams.delete(k));

    // Sort remaining params
    url.searchParams.sort();

    // Remove trailing slash from pathname (but keep root /)
    if (url.pathname.length > 1 && url.pathname.endsWith('/')) {
      url.pathname = url.pathname.slice(0, -1);
    }

    return url.toString();
  } catch {
    return null;
  }
}

// ============ Domain Restriction ============

/**
 * Extract domain from URL
 */
export function extractDomain(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

/**
 * Check if URL belongs to one of the allowed domains
 */
export function isDomainAllowed(url: string, allowedDomains: string[]): boolean {
  if (!allowedDomains || allowedDomains.length === 0) return true; // no restriction
  const domain = extractDomain(url);
  if (!domain) return false;
  return allowedDomains.some(allowed => {
    const normalizedAllowed = allowed.replace(/^www\./, '').toLowerCase();
    return domain === normalizedAllowed || domain.endsWith('.' + normalizedAllowed);
  });
}

// ============ Pattern Matching ============

/**
 * Check if URL matches any of the given patterns (regex or substring)
 */
function matchesAnyPattern(url: string, patterns: string[]): boolean {
  if (!patterns || patterns.length === 0) return false;
  const lowerUrl = url.toLowerCase();
  return patterns.some(pattern => {
    try {
      return new RegExp(pattern, 'i').test(lowerUrl);
    } catch {
      return lowerUrl.includes(pattern.toLowerCase());
    }
  });
}

// ============ Reject Signals (URL-level) ============

const REJECT_URL_SIGNALS = [
  'result', 'admit-card', 'admitcard', 'admit_card',
  'answer-key', 'answerkey', 'answer_key',
  'syllabus', 'current-affairs', 'current_affairs',
  'quiz', 'previous-paper', 'previous_paper', 'previouspaper',
  'mock-test', 'mocktest', 'mock_test',
  'scholarship', 'private-jobs', 'private_jobs',
  'off-campus', 'offcampus', 'off_campus',
  'blog/category', '/tag/', '/author/', '/page/',
  'privacy-policy', 'terms-and-conditions', 'disclaimer',
  'about-us', 'contact-us', 'sitemap',
  'login', 'register', 'signup', 'cart', 'checkout',
  // Removed .pdf from reject — PDFs are often recruitment notices
  '.jpg', '.png', '.gif', '.zip',
  'whatsapp', 'telegram', 'facebook.com', 'twitter.com',
  'youtube.com', 'instagram.com', 'linkedin.com',
  'play.google.com', 'apps.apple.com',
  // New reject signals — noise pages
  '/archive/', '/archives/', '/wp-json/', '/feed/',
  '/rss/', '/amp/', '/print/', '.xml',
];

// ============ Accept Signals (URL-level) ============

const ACCEPT_URL_SIGNALS = [
  'recruitment', 'jobs', 'vacancy', 'vacancies',
  'apply', 'notification', 'online-form', 'online_form',
  'walk-in', 'walkin', 'walk_in',
  'interview', 'advt', 'advertisement',
  'post', 'govt-jobs', 'govt_jobs', 'government-jobs',
  'sarkari-naukri', 'sarkari_naukri', 'sarkarinaukri',
  'bharti', 'naukri', 'rojgar', 'nokri',
  'openings', 'hiring', 'career',
  // New accept signals — aggressive discovery
  'careers', 'engagement', 'opportunity', 'circular',
  'notice', 'tender', 'deputation', 'contractual',
  'apprentice', 'detailed-notification', 'detailed_notification',
  '.pdf', // PDFs are now accepted — often official recruitment notices
];

// ============ Main Filter Pipeline ============

export interface UrlFilterConfig {
  allowedDomains: string[];
  allowedUrlPatterns: string[];
  blockedUrlPatterns: string[];
  maxUrls?: number;
}

export interface FilteredUrl {
  url: string;
  normalized: string;
  accepted: boolean;
  rejectReason?: string;
  acceptSignals: string[];
  rejectSignals: string[];
}

/**
 * Full filter pipeline: domain check → dedup → blocked patterns → accept/reject signals
 * Returns classified URLs with reasons
 */
export function filterAndClassifyUrls(
  rawUrls: string[],
  config: UrlFilterConfig,
  existingNormalized?: Set<string>
): FilteredUrl[] {
  const seen = new Set<string>(existingNormalized || []);
  const results: FilteredUrl[] = [];
  const maxUrls = config.maxUrls || 500;

  for (const rawUrl of rawUrls) {
    if (results.length >= maxUrls) break;

    // Step 1: Normalize
    const normalized = normalizeUrl(rawUrl);
    if (!normalized) continue;

    // Step 2: Dedup
    if (seen.has(normalized)) continue;
    seen.add(normalized);

    // Step 3: Domain restriction
    if (!isDomainAllowed(normalized, config.allowedDomains)) {
      results.push({
        url: rawUrl, normalized, accepted: false,
        rejectReason: 'domain_not_allowed',
        acceptSignals: [], rejectSignals: [],
      });
      continue;
    }

    // Step 4: Source-level blocked patterns
    if (matchesAnyPattern(normalized, config.blockedUrlPatterns)) {
      results.push({
        url: rawUrl, normalized, accepted: false,
        rejectReason: 'blocked_pattern',
        acceptSignals: [], rejectSignals: [],
      });
      continue;
    }

    // Step 5: Global reject signals
    const lowerUrl = normalized.toLowerCase();
    const matchedRejectSignals = REJECT_URL_SIGNALS.filter(s => lowerUrl.includes(s));

    // Step 6: Accept signals
    const matchedAcceptSignals = ACCEPT_URL_SIGNALS.filter(s => lowerUrl.includes(s));

    // Step 7: Source-level allowed patterns boost
    const matchesAllowed = matchesAnyPattern(normalized, config.allowedUrlPatterns);

    // Decision: accept if has accept signals or matches allowed pattern, and not heavily rejected
    const hasAcceptSignal = matchedAcceptSignals.length > 0 || matchesAllowed;
    const hasRejectSignal = matchedRejectSignals.length > 0;

    // Accept if: accept signals present AND reject signals don't dominate
    // OR: allowed pattern matched explicitly
    let accepted: boolean;
    let rejectReason: string | undefined;

    if (matchesAllowed && !hasRejectSignal) {
      accepted = true;
    } else if (hasAcceptSignal && !hasRejectSignal) {
      accepted = true;
    } else if (hasAcceptSignal && hasRejectSignal) {
      // Accept signals must outnumber reject signals
      accepted = matchedAcceptSignals.length > matchedRejectSignals.length;
      if (!accepted) rejectReason = 'reject_signals_dominate';
    } else if (!hasAcceptSignal && !hasRejectSignal) {
      // Neutral URL — accept as potential candidate (listing pages often have neutral URLs)
      accepted = true;
    } else {
      accepted = false;
      rejectReason = 'reject_signal_only';
    }

    results.push({
      url: rawUrl,
      normalized,
      accepted,
      rejectReason,
      acceptSignals: matchedAcceptSignals,
      rejectSignals: matchedRejectSignals,
    });
  }

  return results;
}
