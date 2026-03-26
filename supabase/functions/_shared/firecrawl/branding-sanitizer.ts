/**
 * Third Party Cleaner — Deterministic branding sanitizer.
 * Single source of truth for aggregator domain lists and brand token removal.
 * Used by: firecrawl-ingest, firecrawl-ai-enrich, firecrawl-cleanup-branding.
 */

// ── Master brand token list (case-insensitive matching) ──
export const BRANDING_TOKENS: string[] = [
  // Full names
  'sarkari naukri blog', 'sarkarinaukriblog', 'sarkari exam',
  'sarkariexam', 'ind govt jobs', 'indgovtjobs',
  'all government jobs', 'allgovernmentjobs',
  'my sarkari naukri', 'mysarkarinaukri',
  'govt job guru', 'govtjobguru',
  'freshers now', 'freshersnow',
  'career power', 'careerpower',
  'sharma jobs', 'sharmajobs',
  'sarkari disha', 'sarkaridisha',
  'recruitment guru', 'recruitment.guru',
  'naukri day', 'rojgar result', 'rojgarresult',
  'freejobalert', 'free job alert',
  'sarkari result', 'sarkariresult',
  'jagranjosh', 'jagran josh',
  'adda247', 'bankersadda', 'bankers adda',
  'testbook', 'gradeup', 'prepp.in', 'safalta',
  'embibe', 'byjus', "byju's",
  // Domains as text
  'sarkarinaukri.com', 'sarkariexam.com', 'indgovtjobs.in',
  'allgovernmentjobs.in', 'mysarkarinaukri.com', 'govtjobguru.in',
  'sarkarinaukriblog.com', 'freshersnow.com', 'careerpower.in',
  'sharmajobs.com', 'sarkaridisha.com', 'sarkariresult.com',
  'freejobalert.com', 'jagranjosh.com', 'adda247.com',
  'testbook.com', 'gradeup.co', 'byjus.com', 'embibe.com',
  'prepp.in', 'safalta.com', 'rojgarresult.in', 'recruitment.guru',
  // Shortforms
  'snb', 'gjg', 'agj', 'msn govt jobs', 'sj govt jobs',
  // Common attribution patterns as brand names
  'government jobs india freshersnow',
  'govt jobs alert freshersnow',
];

// ── Master aggregator domain list ──
export const AGGREGATOR_DOMAINS: string[] = [
  'sarkariexam.com', 'sarkarinaukri.com', 'indgovtjobs.in',
  'allgovernmentjobs.in', 'mysarkarinaukri.com', 'govtjobguru.in',
  'sarkarinaukriblog.com', 'freshersnow.com', 'careerpower.in',
  'sharmajobs.com', 'sarkaridisha.com', 'recruitment.guru',
  'sarkariresult.com', 'freejobalert.com', 'jagranjosh.com',
  'adda247.com', 'testbook.com', 'gradeup.co', 'byjus.com',
  'embibe.com', 'prepp.in', 'safalta.com', 'rojgarresult.in',
  'naukri.com', 'naukriday.com',
];

// ── Attribution patterns to strip ──
const ATTRIBUTION_PATTERNS: RegExp[] = [
  /source\s*:\s*[^\n,|]{3,60}/gi,
  /via\s*:\s*[^\n,|]{3,60}/gi,
  /preview\s+on\s+[^\n,|]{3,60}/gi,
  /read\s+more\s+on\s+[^\n,|]{3,60}/gi,
  /posted\s+(by|on|via)\s+[^\n,|]{3,60}/gi,
  /published\s+(by|on|at)\s+[^\n,|]{3,60}/gi,
  /courtesy\s*:\s*[^\n,|]{3,60}/gi,
  /credit\s*:\s*[^\n,|]{3,60}/gi,
  /powered\s+by\s+[^\n,|]{3,60}/gi,
  /brought\s+to\s+you\s+by\s+[^\n,|]{3,60}/gi,
];

// Build pre-compiled regexes for brand tokens (sorted longest-first for greedy matching)
const BRAND_REGEXES: RegExp[] = [...BRANDING_TOKENS]
  .sort((a, b) => b.length - a.length)
  .map(token => new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'));

/**
 * Sanitize a single text field: remove brand tokens, attribution patterns, and aggregator URLs.
 * Returns the cleaned text and list of traces found.
 */
export function sanitizeTextField(text: string | null | undefined): { cleaned: string; tracesFound: string[] } {
  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    return { cleaned: text || '', tracesFound: [] };
  }

  let cleaned = text;
  const tracesFound: string[] = [];

  // 1. Remove brand tokens
  for (let i = 0; i < BRAND_REGEXES.length; i++) {
    const re = BRAND_REGEXES[i];
    const matches = cleaned.match(re);
    if (matches) {
      tracesFound.push(`brand:${BRANDING_TOKENS[i]}(${matches.length}x)`);
      cleaned = cleaned.replace(re, '');
    }
  }

  // 2. Remove attribution patterns (but only if they contain aggregator references)
  for (const pattern of ATTRIBUTION_PATTERNS) {
    const re = new RegExp(pattern.source, pattern.flags);
    const matches = cleaned.match(re);
    if (matches) {
      for (const match of matches) {
        const lower = match.toLowerCase();
        // Only strip if the attribution references a known aggregator
        const isAggregatorAttribution = BRANDING_TOKENS.some(t => lower.includes(t.toLowerCase())) ||
          AGGREGATOR_DOMAINS.some(d => lower.includes(d.toLowerCase()));
        if (isAggregatorAttribution) {
          tracesFound.push(`attribution:${match.trim().substring(0, 50)}`);
          cleaned = cleaned.replace(match, '');
        }
      }
    }
  }

  // 3. Remove inline aggregator URLs
  const urlRe = /https?:\/\/[^\s)>\]"']+/g;
  cleaned = cleaned.replace(urlRe, (url) => {
    if (isAggregatorUrl(url)) {
      tracesFound.push(`url:${url.substring(0, 60)}`);
      return '';
    }
    return url;
  });

  // 4. Clean up artifacts: double spaces, leading/trailing pipes, dashes
  cleaned = cleaned.replace(/\s{2,}/g, ' ').trim();
  cleaned = cleaned.replace(/^[\s|–—-]+|[\s|–—-]+$/g, '').trim();

  return { cleaned, tracesFound };
}

/**
 * Check if a URL belongs to a known aggregator domain.
 */
export function isAggregatorUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return AGGREGATOR_DOMAINS.some(d => hostname === d || hostname.endsWith('.' + d));
  } catch {
    return false;
  }
}

/**
 * Check if an image URL is hosted on an aggregator domain.
 */
export function isAggregatorImageUrl(url: string | null | undefined): boolean {
  return isAggregatorUrl(url);
}

/**
 * Detect branding traces in text without modifying it.
 * Returns list of detected brand names/patterns.
 */
export function detectBrandingTraces(text: string | null | undefined): string[] {
  if (!text) return [];
  const lower = text.toLowerCase();
  const found: string[] = [];

  for (const token of BRANDING_TOKENS) {
    if (lower.includes(token.toLowerCase())) {
      found.push(token);
    }
  }

  // Check for aggregator URLs
  const urlRe = /https?:\/\/[^\s)>\]"']+/g;
  let match;
  while ((match = urlRe.exec(text)) !== null) {
    if (isAggregatorUrl(match[0])) {
      found.push(`url:${match[0].substring(0, 60)}`);
    }
  }

  return found;
}

// ── Fields that are public/publishable and must be sanitized ──
const TEXT_FIELDS_TO_SANITIZE = [
  'title', 'seo_title', 'normalized_title', 'organization_name',
  'post_name', 'description_summary', 'intro_text', 'meta_description',
  'qualification', 'salary', 'selection_process', 'category',
  'department', 'job_role', 'pay_scale', 'age_limit',
  'application_mode', 'application_fee',
] as const;

const URL_FIELDS_TO_VALIDATE = [
  'official_notification_url', 'official_apply_url', 'official_website_url',
] as const;

const IMAGE_FIELDS_TO_VALIDATE = [
  'cover_image_url',
] as const;

export interface SanitizeDraftResult {
  sanitizedFields: Record<string, unknown>;
  totalTraces: number;
  traceDetails: string[];
  fieldsChanged: string[];
}

/**
 * Sanitize all publishable fields on a draft record.
 * Returns the fields that should be updated, plus trace counts.
 */
export function sanitizeDraftFields(draft: Record<string, unknown>): SanitizeDraftResult {
  const sanitizedFields: Record<string, unknown> = {};
  const allTraces: string[] = [];
  const fieldsChanged: string[] = [];

  // 1. Sanitize text fields
  for (const field of TEXT_FIELDS_TO_SANITIZE) {
    const value = draft[field];
    if (typeof value === 'string' && value.trim().length > 0) {
      const { cleaned, tracesFound } = sanitizeTextField(value);
      if (tracesFound.length > 0) {
        allTraces.push(...tracesFound.map(t => `${field}:${t}`));
      }
      if (cleaned !== value) {
        sanitizedFields[field] = cleaned;
        fieldsChanged.push(field);
      }
    }
  }

  // 2. Validate URL fields — null out aggregator URLs
  for (const field of URL_FIELDS_TO_VALIDATE) {
    const value = draft[field];
    if (typeof value === 'string' && isAggregatorUrl(value)) {
      sanitizedFields[field] = null;
      fieldsChanged.push(field);
      allTraces.push(`${field}:aggregator_url_removed`);
    }
  }

  // 3. Validate image fields — null out aggregator-hosted images
  for (const field of IMAGE_FIELDS_TO_VALIDATE) {
    const value = draft[field];
    if (typeof value === 'string' && isAggregatorImageUrl(value)) {
      sanitizedFields[field] = null;
      fieldsChanged.push(field);
      allTraces.push(`${field}:aggregator_image_removed`);
    }
  }

  return {
    sanitizedFields,
    totalTraces: allTraces.length,
    traceDetails: allTraces,
    fieldsChanged,
  };
}
