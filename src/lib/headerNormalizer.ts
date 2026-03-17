/**
 * Header normalization and alias resolution for Excel/CSV uploads.
 * Reusable across any upload flow that needs flexible header matching.
 */

/** Normalize a raw header string: trim, lowercase, collapse separators. */
export function normalizeHeader(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[_\-\/]/g, ' ')   // treat _ - / as spaces
    .replace(/\s+/g, ' ')       // collapse whitespace
    .replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, ''); // strip surrounding punctuation
}

/** Canonical field names used internally. */
export type CanonicalField =
  | 'state_ut'
  | 'board_name'
  | 'result_url'
  | 'official_board_url'
  | 'seo_intro_text';

const REQUIRED_FIELDS: CanonicalField[] = [
  'state_ut',
  'board_name',
  'result_url',
  'official_board_url',
];

/** Map of normalized alias → canonical field name. Order matters: first match wins. */
const ALIAS_MAP: [string, CanonicalField][] = [
  // state_ut
  ['state ut', 'state_ut'],
  ['state', 'state_ut'],

  // board_name
  ['board name', 'board_name'],

  // result_url — longer aliases first to avoid partial matches
  ['official result url', 'result_url'],
  ['result url', 'result_url'],
  ['result link', 'result_url'],

  // official_board_url — longer aliases first
  ['official board website', 'official_board_url'],
  ['official board url', 'official_board_url'],
  ['board official url', 'official_board_url'],
  ['official website', 'official_board_url'],

  // seo_intro_text — longer aliases first
  ['seo intro text', 'seo_intro_text'],
  ['seo intro', 'seo_intro_text'],
  ['intro text', 'seo_intro_text'],
  ['intro', 'seo_intro_text'],
];

export interface ResolvedHeaders {
  /** Map from original raw header → canonical field name (only for matched headers). */
  headerMap: Map<string, CanonicalField>;
  /** Canonical fields that were successfully matched. */
  matched: CanonicalField[];
  /** Required canonical fields that could NOT be matched. */
  missing: CanonicalField[];
  /** All normalized header strings (for diagnostics). */
  normalizedHeaders: string[];
}

/**
 * Resolve raw Excel/CSV headers to canonical field names.
 * Uses normalization + alias matching.
 */
export function resolveHeaders(rawHeaders: string[]): ResolvedHeaders {
  const headerMap = new Map<string, CanonicalField>();
  const matchedSet = new Set<CanonicalField>();
  const normalizedHeaders: string[] = [];

  for (const raw of rawHeaders) {
    const norm = normalizeHeader(raw);
    normalizedHeaders.push(norm);

    // Skip if already matched to avoid double-mapping
    if (headerMap.has(raw)) continue;

    for (const [alias, canonical] of ALIAS_MAP) {
      if (norm === alias && !matchedSet.has(canonical)) {
        headerMap.set(raw, canonical);
        matchedSet.add(canonical);
        break;
      }
    }
  }

  const matched = Array.from(matchedSet);
  const missing = REQUIRED_FIELDS.filter(f => !matchedSet.has(f));

  return { headerMap, matched, missing, normalizedHeaders };
}

/**
 * Given a raw row object and a headerMap, extract values by canonical field name.
 */
export function extractCanonicalValues(
  raw: Record<string, unknown>,
  headerMap: Map<string, CanonicalField>,
): Record<CanonicalField, string> {
  const result: Record<string, string> = {
    state_ut: '',
    board_name: '',
    result_url: '',
    official_board_url: '',
    seo_intro_text: '',
  };

  for (const [originalHeader, canonical] of headerMap) {
    const val = raw[originalHeader];
    if (val !== undefined && val !== null) {
      result[canonical] = String(val).trim();
    }
  }

  return result as Record<CanonicalField, string>;
}
