/**
 * Source 3 Phase 5: Deduplication logic for firecrawl draft jobs.
 * Uses multi-signal matching: normalized title, org name, official URLs, dates, vacancies.
 * Flags duplicates rather than silently merging.
 */

export interface DedupCandidate {
  id: string;
  normalized_title: string | null;
  organization_name: string | null;
  official_notification_url: string | null;
  official_apply_url: string | null;
  last_date_of_application: string | null;
  total_vacancies: number | null;
}

export interface DedupResult {
  isDuplicate: boolean;
  confidence: 'high' | 'medium' | 'low';
  matchedIds: string[];
  reason: string;
}

function normalizeText(s: string | null): string {
  if (!s) return '';
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
}

function normalizeUrlForDedup(u: string | null): string {
  if (!u) return '';
  try {
    const url = new URL(u);
    return (url.hostname + url.pathname).toLowerCase().replace(/\/+$/, '');
  } catch {
    return u.toLowerCase().trim();
  }
}

/**
 * Check a single draft against a list of existing drafts for duplicates.
 * Returns dedup result with evidence.
 */
export function checkDuplicate(
  target: DedupCandidate,
  existingDrafts: DedupCandidate[],
): DedupResult {
  const matchedIds: string[] = [];
  const reasons: string[] = [];
  let highestConfidence: 'low' | 'medium' | 'high' = 'low';

  const targetTitle = normalizeText(target.normalized_title);
  const targetOrg = normalizeText(target.organization_name);

  for (const existing of existingDrafts) {
    if (existing.id === target.id) continue;

    let signals = 0;
    const matchReasons: string[] = [];

    // 1. Official notification URL match (strong signal)
    if (target.official_notification_url && existing.official_notification_url) {
      const tUrl = normalizeUrlForDedup(target.official_notification_url);
      const eUrl = normalizeUrlForDedup(existing.official_notification_url);
      if (tUrl && eUrl && tUrl === eUrl) {
        signals += 3;
        matchReasons.push('same_notification_url');
      }
    }

    // 2. Official apply URL match (strong signal)
    if (target.official_apply_url && existing.official_apply_url) {
      const tUrl = normalizeUrlForDedup(target.official_apply_url);
      const eUrl = normalizeUrlForDedup(existing.official_apply_url);
      if (tUrl && eUrl && tUrl === eUrl) {
        signals += 3;
        matchReasons.push('same_apply_url');
      }
    }

    // 3. Title similarity (fuzzy word overlap)
    const existingTitle = normalizeText(existing.normalized_title);
    if (targetTitle && existingTitle && targetTitle.length > 5 && existingTitle.length > 5) {
      const tWords = new Set(targetTitle.split(' ').filter(w => w.length > 2));
      const eWords = new Set(existingTitle.split(' ').filter(w => w.length > 2));
      const intersection = [...tWords].filter(w => eWords.has(w));
      const unionSize = new Set([...tWords, ...eWords]).size;
      const overlap = unionSize > 0 ? intersection.length / unionSize : 0;

      if (overlap >= 0.8) {
        signals += 2;
        matchReasons.push(`title_overlap_${Math.round(overlap * 100)}%`);
      } else if (overlap >= 0.6) {
        signals += 1;
        matchReasons.push(`title_partial_${Math.round(overlap * 100)}%`);
      }
    }

    // 4. Organization match
    const existingOrg = normalizeText(existing.organization_name);
    if (targetOrg && existingOrg && targetOrg.length > 3 && existingOrg.length > 3) {
      if (targetOrg === existingOrg) {
        signals += 2;
        matchReasons.push('same_org');
      } else if (targetOrg.includes(existingOrg) || existingOrg.includes(targetOrg)) {
        signals += 1;
        matchReasons.push('org_partial');
      }
    }

    // 5. Same last date
    if (target.last_date_of_application && existing.last_date_of_application &&
        target.last_date_of_application === existing.last_date_of_application) {
      signals += 1;
      matchReasons.push('same_last_date');
    }

    // 6. Same vacancies
    if (target.total_vacancies && existing.total_vacancies &&
        target.total_vacancies === existing.total_vacancies) {
      signals += 1;
      matchReasons.push('same_vacancies');
    }

    // Determine confidence
    if (signals >= 5) {
      matchedIds.push(existing.id);
      reasons.push(...matchReasons);
      highestConfidence = 'high';
    } else if (signals >= 3) {
      matchedIds.push(existing.id);
      reasons.push(...matchReasons);
      if (highestConfidence !== 'high') highestConfidence = 'medium';
    }
    // signals < 3 = not a match, skip
  }

  return {
    isDuplicate: matchedIds.length > 0,
    confidence: matchedIds.length > 0 ? highestConfidence : 'low',
    matchedIds,
    reason: matchedIds.length > 0
      ? `Matched ${matchedIds.length} existing draft(s): ${[...new Set(reasons)].join(', ')}`
      : 'No duplicates found',
  };
}
