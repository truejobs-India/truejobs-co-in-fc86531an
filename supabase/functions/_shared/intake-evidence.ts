/**
 * intake-evidence.ts — Priority-based grounded evidence bundle builder
 * for ChatGPT-Agent / RSS / Crawler intake drafts.
 *
 * Goals:
 *  • Build the fullest deterministic, provenance-tagged evidence bundle.
 *  • Trust primary official URLs explicitly stored on the draft over domain heuristics.
 *  • Fetch official PDF/HTML on demand (Firecrawl) when the draft is thin,
 *    when freshness-critical fields are missing, when sources conflict, or
 *    when the cached fetch is older than 48h.
 *  • Tier the bundle so high-value structured facts are NEVER dropped under
 *    the size cap — only raw_text and structured_data_json are trimmed first.
 *  • Decide `not_enriched_no_data` ONLY after a 4-step gate, not as an
 *    early exit.
 *
 * This module is additive — the legacy small `buildEvidence` in the pipeline
 * file remains untouched for non-enrich steps. Only the `enrich` step uses
 * `buildEnrichmentEvidence` to avoid regressing classify/seo_fix/etc.
 */
import { scrapePage } from './firecrawl/client.ts';

// ── Constants ───────────────────────────────────────────────────────────
const FRESHNESS_HOURS = 48;
const FRESHNESS_MS = FRESHNESS_HOURS * 60 * 60 * 1000;
const PDF_BODY_CAP = 12_000;
const HTML_BODY_CAP = 8_000;
const STRUCT_BODY_CAP = 6_000;
const RAW_TEXT_CAP = 4_000;
const TOTAL_SOFT_CAP = 32_000;

const CRITICAL_FRESH_FIELDS = [
  'closing_date', 'opening_date', 'notification_date',
  'vacancy_count', 'qualification_text', 'fee_text',
  'application_fee_text', 'application_mode',
];

const STRUCTURED_FIELDS = [
  'organisation_name', 'department_name', 'ministry_name',
  'post_name', 'exam_name', 'job_location',
  'advertisement_no', 'reference_no',
  'notification_date', 'opening_date', 'closing_date', 'correction_last_date',
  'exam_date', 'result_date', 'admit_card_date', 'answer_key_date',
  'vacancy_count', 'qualification_text', 'age_limit_text',
  'salary_text', 'application_fee_text', 'selection_process_text',
  'how_to_apply_text', 'application_mode',
];

// Aggregator domains to NEVER treat as official, even as secondary.
const AGGREGATOR_DOMAINS = [
  'sarkariresult.com', 'freejobalert.com', 'sarkarinaukri.com',
  'jobsarkari.com', 'rojgarresult.com', 'sarkari-result.com',
  'sarkariexam.com', 'sarkariresults.com', 'jagranjosh.com',
  'careerpower.in', 'adda247.com', 'gradeup.co', 'oliveboard.in',
  'testbook.com', 'byjus.com', 'unacademy.com', 'shiksha.com',
  'collegedunia.com', 'careers360.com', 'getmyuni.com',
];

// Officially trusted TLDs/suffixes for India government / institutional sources.
// Trust requires content validation in addition to TLD; TLD alone is never sufficient.
const TRUSTED_TLDS = ['.gov.in', '.nic.in', '.ac.in', '.edu.in', '.res.in', '.gov', '.gov.bd'];

// Institution-style host substrings used as a content-relevance hint when the
// TLD is allowed but generic (e.g. .org.in commissions, courts).
const INSTITUTION_HOST_HINTS = [
  'commission', 'university', 'court', 'judiciary', 'recruitment',
  'service', 'board', 'council', 'institute', 'authority',
  'ministry', 'department', 'sarkari', 'gov',
];

// ── Types ───────────────────────────────────────────────────────────────
export type TrustLevel = 'primary' | 'secondary_domain';

export interface EvidenceCandidate {
  field: string;
  value: string;
  source: string;        // e.g. 'row_field', 'structured_data_json', 'official_pdf', 'official_html', 'raw_text'
  trust: TrustLevel | 'low';
  ageHours?: number;     // for fetched/verified evidence
  fetchedAt?: string;    // ISO
}

export interface OfficialUrl {
  url: string;
  trust: TrustLevel;
  origin: string;        // which field/key this URL came from
}

export interface BuildOptions {
  /** When true, attempt official refresh (HTML + PDF) before building Tier 2. */
  allowOfficialFetch?: boolean;
  /** When true, persist fetched content into the draft row passed in (mutates `draft` in-place). */
  persistFetch?: (patch: Record<string, unknown>) => Promise<void>;
}

export interface DiscoveryResult {
  /** Best candidate URL discovered (may also be rejected). */
  candidateUrl?: string;
  /** strong | medium | weak | rejected | none */
  confidence: 'strong' | 'medium' | 'weak' | 'rejected' | 'none';
  /** none | candidate | validated | promoted | rejected */
  status: 'none' | 'candidate' | 'validated' | 'promoted' | 'rejected';
  /** Tokens, fetched title, signals, error reason */
  evidence: Record<string, unknown>;
}

export interface EnrichmentEvidenceResult {
  bundle: string;
  /** Counts of meaningful structured fields the AI can immediately fill from. */
  groundedFieldCount: number;
  /** True when the staged retrieval (Stages 1–3) found NO trustworthy evidence. */
  noDataDecision: boolean;
  /** Human-readable reason that always travels with the row. */
  reason: string;
  /** Provenance of each official fetch attempt, for auditability. */
  fetchAudit: {
    attempted: boolean;
    pdfUrl?: string;
    htmlUrl?: string;
    pdfStatus?: 'ok' | 'failed' | 'skipped' | 'cached';
    htmlStatus?: 'ok' | 'failed' | 'skipped' | 'cached';
    pdfError?: string;
    htmlError?: string;
    cachedAt?: string;
  };
  /** Stage-3 discovery outcome (always returned, even when no candidates). */
  discovery: DiscoveryResult;
  /**
   * Per-source-trace: which sources are externally grounded + reachable.
   * The pipeline uses this to decide grade/completeness AFTER the AI step.
   */
  groundedSources: {
    rowFields: string[];          // structured row field names with non-empty values
    structuredJsonFields: string[];
    officialPdfFetched: boolean;
    officialHtmlFetched: boolean;
    discoveryPromoted: boolean;
  };
}

// ── Helpers ─────────────────────────────────────────────────────────────
function nonEmpty(v: unknown): boolean {
  if (v === undefined || v === null) return false;
  if (typeof v === 'string') return v.trim().length > 0;
  if (typeof v === 'number') return !isNaN(v);
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === 'object') return Object.keys(v as object).length > 0;
  return true;
}

function safeParseStruct(raw: unknown): Record<string, unknown> | null {
  if (!raw) return null;
  if (typeof raw === 'object') return raw as Record<string, unknown>;
  if (typeof raw === 'string') {
    try { return JSON.parse(raw); } catch { return null; }
  }
  return null;
}

function isAggregatorUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, '');
    return AGGREGATOR_DOMAINS.some(d => host === d || host.endsWith('.' + d));
  } catch { return false; }
}

function isLikelyPdf(url: string): boolean {
  return /\.pdf(\?|#|$)/i.test(url);
}

function ageHours(iso: string | null | undefined): number | undefined {
  if (!iso) return undefined;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return undefined;
  return Math.round((Date.now() - t) / (60 * 60 * 1000));
}

function clipExcerpt(text: string, cap: number): string {
  if (text.length <= cap) return text;
  // Head + middle + tail to preserve facts even after the first dense block.
  const slice = Math.floor(cap / 3);
  const head = text.slice(0, slice);
  const midStart = Math.floor(text.length / 2) - Math.floor(slice / 2);
  const middle = text.slice(midStart, midStart + slice);
  const tail = text.slice(text.length - slice);
  return `${head}\n…[trimmed]…\n${middle}\n…[trimmed]…\n${tail}`;
}

/**
 * Collect all official URL candidates from the draft, with trust labels.
 * Primary trust comes from explicit official_* fields and verified URLs.
 * Secondary trust comes from .gov.in / .nic.in domain heuristics ONLY when
 * no primary URL exists.
 */
export function collectOfficialUrls(draft: Record<string, any>): OfficialUrl[] {
  const seen = new Set<string>();
  const out: OfficialUrl[] = [];
  const push = (url: string | null | undefined, origin: string, trust: TrustLevel) => {
    if (!url || typeof url !== 'string') return;
    const u = url.trim();
    if (!u || !/^https?:\/\//i.test(u)) return;
    if (isAggregatorUrl(u)) return;
    if (seen.has(u)) return;
    seen.add(u);
    out.push({ url: u, origin, trust });
  };

  // --- Primary sources (explicit official columns) ---
  push(draft.official_notification_link, 'official_notification_link', 'primary');
  push(draft.official_apply_link, 'official_apply_link', 'primary');
  push(draft.official_website_link, 'official_website_link', 'primary');
  push(draft.official_website_url, 'official_website_url', 'primary');
  push(draft.official_reference_url, 'official_reference_url', 'primary');
  push(draft.secondary_official_url, 'secondary_official_url', 'primary');
  push(draft.result_link, 'result_link', 'primary');
  push(draft.admit_card_link, 'admit_card_link', 'primary');
  push(draft.answer_key_link, 'answer_key_link', 'primary');

  // verification_status='verified' lifts primary_cta_url to primary trust
  if (draft.verification_status &&
      String(draft.verification_status).toLowerCase().includes('verified')) {
    push(draft.primary_cta_url, 'primary_cta_url(verified)', 'primary');
  }

  // structured_data_json official_* keys
  const sd = safeParseStruct(draft.structured_data_json);
  if (sd) {
    const keys = [
      'Official Reference URL', 'Official Website URL', 'Secondary Official URL',
      'official_reference_url', 'official_website_url', 'secondary_official_url',
      'officialNotificationUrl', 'official_notification_url',
      'notification_url', 'apply_url', 'result_url',
    ];
    for (const k of keys) {
      const v = (sd as Record<string, unknown>)[k];
      if (typeof v === 'string') push(v, `structured_data_json.${k}`, 'primary');
    }
  }

  // --- Secondary sources (domain heuristic — only as last resort) ---
  const hasPrimary = out.length > 0;
  if (!hasPrimary) {
    const tryUrl = (url: string | null | undefined, origin: string) => {
      if (!url) return;
      try {
        const host = new URL(url).hostname.toLowerCase();
        if (TRUSTED_TLDS.some(t => host.endsWith(t))) {
          push(url, origin + '(trusted-tld)', 'secondary_domain');
        }
      } catch { /* ignore */ }
    };
    tryUrl(draft.source_url, 'source_url');
    tryUrl(draft.primary_cta_url, 'primary_cta_url');
  }

  return out;
}

/** Pull all candidate values for each structured field, with provenance. */
function collectFieldCandidates(draft: Record<string, any>): Map<string, EvidenceCandidate[]> {
  const map = new Map<string, EvidenceCandidate[]>();
  const add = (field: string, c: EvidenceCandidate) => {
    if (!nonEmpty(c.value)) return;
    const arr = map.get(field) || [];
    // dedupe by source+value
    if (!arr.some(x => x.source === c.source && x.value === c.value)) arr.push(c);
    map.set(field, arr);
  };

  // 1. Direct row fields
  for (const f of STRUCTURED_FIELDS) {
    const v = draft[f];
    if (nonEmpty(v)) {
      add(f, { field: f, value: String(v), source: 'row_field', trust: 'primary' });
    }
  }

  // 2. structured_data_json — flatten common keys
  const sd = safeParseStruct(draft.structured_data_json);
  if (sd) {
    const verifiedAge = ageHours(
      (sd['Source Verified On'] as string) ||
      (sd['source_verified_on'] as string) ||
      draft.source_verified_on_date ||
      draft.source_verified_on
    );
    const sdMap: Record<string, string> = {
      'Organization / Board / Authority': 'organisation_name',
      'organisation_name': 'organisation_name',
      'organization_name': 'organisation_name',
      'Department': 'department_name',
      'department_name': 'department_name',
      'Post Name': 'post_name',
      'post_name': 'post_name',
      'Exam Name': 'exam_name',
      'exam_name': 'exam_name',
      'Last Date': 'closing_date',
      'closing_date': 'closing_date',
      'Apply Last Date': 'closing_date',
      'Notification Date': 'notification_date',
      'notification_date': 'notification_date',
      'Opening Date': 'opening_date',
      'Exam Date': 'exam_date',
      'Vacancies': 'vacancy_count',
      'vacancy_count': 'vacancy_count',
      'Total Posts': 'vacancy_count',
      'Qualification': 'qualification_text',
      'qualification_text': 'qualification_text',
      'Age Limit': 'age_limit_text',
      'age_limit_text': 'age_limit_text',
      'Salary': 'salary_text',
      'Pay Scale': 'salary_text',
      'salary_text': 'salary_text',
      'Application Fee': 'application_fee_text',
      'application_fee_text': 'application_fee_text',
      'Selection Process': 'selection_process_text',
      'selection_process_text': 'selection_process_text',
      'Application Mode': 'application_mode',
      'application_mode': 'application_mode',
      'Job Location': 'job_location',
      'job_location': 'job_location',
      'Advertisement No': 'advertisement_no',
      'advertisement_no': 'advertisement_no',
      'Reference No': 'reference_no',
      'reference_no': 'reference_no',
    };
    for (const [k, field] of Object.entries(sdMap)) {
      const v = (sd as Record<string, unknown>)[k];
      if (typeof v === 'string' || typeof v === 'number') {
        add(field, {
          field, value: String(v), source: 'structured_data_json',
          trust: 'primary', ageHours: verifiedAge,
        });
      }
    }
  }

  return map;
}

/** Tier 1 facts: structured field map → bundle text with conflict notation. */
function renderTier1(candidates: Map<string, EvidenceCandidate[]>): string {
  const lines: string[] = ['## TIER 1 — Structured grounded facts'];
  if (candidates.size === 0) {
    lines.push('  (no structured facts found in row or structured_data_json)');
    return lines.join('\n');
  }
  for (const field of STRUCTURED_FIELDS) {
    const arr = candidates.get(field);
    if (!arr || arr.length === 0) continue;
    // Pick preferred = first primary with most-recent age, then first.
    const sorted = [...arr].sort((a, b) => {
      const trustRank = (t: string) => t === 'primary' ? 0 : 1;
      const dt = trustRank(a.trust) - trustRank(b.trust);
      if (dt !== 0) return dt;
      return (a.ageHours ?? 99999) - (b.ageHours ?? 99999);
    });
    const preferred = sorted[0];
    const ageNote = preferred.ageHours !== undefined ? `, age=${preferred.ageHours}h` : '';
    lines.push(`  ${field}:`);
    lines.push(`    preferred: ${preferred.value}   [from: ${preferred.source}, trust=${preferred.trust}${ageNote}]`);
    const alternates = sorted.slice(1).filter(c => c.value !== preferred.value);
    for (const alt of alternates) {
      const aAge = alt.ageHours !== undefined ? `, age=${alt.ageHours}h` : '';
      lines.push(`    alternate: ${alt.value}   [from: ${alt.source}, trust=${alt.trust}${aAge}]`);
    }
  }
  return lines.join('\n');
}

function renderOfficialUrls(urls: OfficialUrl[]): string {
  if (urls.length === 0) return '## OFFICIAL URLS\n  (none found)';
  const lines = ['## OFFICIAL URLS'];
  for (const u of urls) {
    lines.push(`  - ${u.url}   [origin: ${u.origin}, trust=${u.trust}${isLikelyPdf(u.url) ? ', type=pdf' : ', type=html'}]`);
  }
  return lines.join('\n');
}

function renderTier2(draft: Record<string, any>): string {
  const lines: string[] = [];
  if (draft.official_fetch_pdf_text) {
    const ts = draft.official_fetch_at || '';
    lines.push(`## TIER 2A — Official PDF (PRIMARY) [fetched_at: ${ts}, url: ${draft.official_fetch_url || ''}]`);
    lines.push(clipExcerpt(String(draft.official_fetch_pdf_text), PDF_BODY_CAP));
  }
  if (draft.official_fetch_html_text) {
    const ts = draft.official_fetch_at || '';
    lines.push(`## TIER 2B — Official HTML (SUPPORTING) [fetched_at: ${ts}]`);
    lines.push(clipExcerpt(String(draft.official_fetch_html_text), HTML_BODY_CAP));
  }
  return lines.join('\n\n');
}

function renderTier3(draft: Record<string, any>): string {
  const sd = safeParseStruct(draft.structured_data_json);
  if (!sd) return '';
  let pretty: string;
  try { pretty = JSON.stringify(sd, null, 2); } catch { return ''; }
  return `## TIER 3 — Original structured payload\n${clipExcerpt(pretty, STRUCT_BODY_CAP)}`;
}

function renderTier4(draft: Record<string, any>): string {
  const rt = (draft.raw_text || '') as string;
  if (!rt || rt.trim().length === 0) return '';
  return `## TIER 4 — Raw text excerpt\n${clipExcerpt(rt, RAW_TEXT_CAP)}`;
}

/**
 * Decide whether to fetch official source(s) right now.
 * Triggers (any-of):
 *  • At least one primary official URL exists AND no fetch in last 48h.
 *  • Any critical freshness field is missing.
 *  • Multiple sources for the same critical field disagree.
 */
function shouldFetchOfficial(
  draft: Record<string, any>,
  candidates: Map<string, EvidenceCandidate[]>,
  urls: OfficialUrl[],
): { fetch: boolean; reason: string } {
  const hasPrimary = urls.some(u => u.trust === 'primary');
  if (!hasPrimary) return { fetch: false, reason: 'no primary official url' };

  const fetchedAt = draft.official_fetch_at as string | null | undefined;
  const cacheFresh = !!fetchedAt && (Date.now() - Date.parse(fetchedAt)) < FRESHNESS_MS;
  const cacheHasContent = !!(draft.official_fetch_pdf_text || draft.official_fetch_html_text);

  if (!cacheFresh || !cacheHasContent) {
    return { fetch: true, reason: cacheFresh ? 'no cached content' : 'cache stale (>48h)' };
  }

  // Cache fresh — fire only on missing critical fields or conflicts.
  const missing = CRITICAL_FRESH_FIELDS.filter(f => {
    const arr = candidates.get(f);
    return !arr || arr.length === 0;
  });
  if (missing.length > 0) {
    return { fetch: true, reason: `cache fresh but missing critical: ${missing.slice(0, 3).join(',')}` };
  }
  for (const f of CRITICAL_FRESH_FIELDS) {
    const arr = candidates.get(f);
    if (arr && arr.length > 1) {
      const distinct = new Set(arr.map(c => c.value));
      if (distinct.size > 1) {
        return { fetch: true, reason: `cache fresh but conflict on ${f}` };
      }
    }
  }
  return { fetch: false, reason: 'cache fresh and no missing/conflict' };
}

/**
 * Fetch official PDF + HTML via Firecrawl. Fail-soft.
 * Updates the draft object in place AND, if persistFetch is provided,
 * persists the patch to the DB so subsequent runs skip the call.
 */
async function performOfficialFetch(
  draft: Record<string, any>,
  urls: OfficialUrl[],
  persistFetch?: (patch: Record<string, unknown>) => Promise<void>,
): Promise<EnrichmentEvidenceResult['fetchAudit']> {
  const audit: EnrichmentEvidenceResult['fetchAudit'] = { attempted: true };
  const primary = urls.filter(u => u.trust === 'primary');
  const pdfUrl = primary.find(u => isLikelyPdf(u.url))?.url;
  const htmlUrl = primary.find(u => !isLikelyPdf(u.url))?.url;

  const patch: Record<string, unknown> = {
    official_fetch_at: new Date().toISOString(),
    official_fetch_url: pdfUrl || htmlUrl || null,
    official_fetch_status: 'pending',
  };

  let anyOk = false;

  if (pdfUrl) {
    audit.pdfUrl = pdfUrl;
    try {
      const r = await scrapePage(pdfUrl, { formats: ['markdown'], onlyMainContent: true });
      if (r.success && r.markdown) {
        const text = String(r.markdown).slice(0, 80_000); // hard cap before storage
        draft.official_fetch_pdf_text = text;
        patch.official_fetch_pdf_text = text;
        audit.pdfStatus = 'ok';
        anyOk = true;
      } else {
        audit.pdfStatus = 'failed';
        audit.pdfError = r.error || 'no markdown';
      }
    } catch (e) {
      audit.pdfStatus = 'failed';
      audit.pdfError = e instanceof Error ? e.message.slice(0, 200) : String(e).slice(0, 200);
    }
  }

  if (htmlUrl) {
    audit.htmlUrl = htmlUrl;
    try {
      const r = await scrapePage(htmlUrl, { formats: ['markdown'], onlyMainContent: true });
      if (r.success && r.markdown) {
        const text = String(r.markdown).slice(0, 80_000);
        draft.official_fetch_html_text = text;
        patch.official_fetch_html_text = text;
        audit.htmlStatus = 'ok';
        anyOk = true;
      } else {
        audit.htmlStatus = 'failed';
        audit.htmlError = r.error || 'no markdown';
      }
    } catch (e) {
      audit.htmlStatus = 'failed';
      audit.htmlError = e instanceof Error ? e.message.slice(0, 200) : String(e).slice(0, 200);
    }
  }

  patch.official_fetch_status = anyOk
    ? 'ok'
    : (audit.pdfError || audit.htmlError ? 'failed' : 'skipped');
  draft.official_fetch_at = patch.official_fetch_at;
  draft.official_fetch_url = patch.official_fetch_url;
  draft.official_fetch_status = patch.official_fetch_status;

  if (persistFetch) {
    try { await persistFetch(patch); }
    catch (e) { console.error('[intake-evidence] persistFetch failed:', e); }
  }
  return audit;
}

// ── Stage-3 discovery helpers ──────────────────────────────────────────
const STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'from', 'into', 'over', 'this', 'that',
  'recruitment', 'notification', 'online', 'form', 'apply', 'admit',
  'card', 'result', 'answer', 'key', 'exam', 'date', 'last', 'post',
  'posts', 'vacancy', 'vacancies', 'a', 'an', 'of', 'in', 'to', 'on',
]);

function tokenize(s: string | null | undefined): Set<string> {
  if (!s) return new Set();
  return new Set(
    String(s).toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .split(/\s+/)
      .filter(t => t.length >= 3 && !STOPWORDS.has(t))
  );
}

function hostMatchesTrustedTld(host: string): boolean {
  return TRUSTED_TLDS.some(t => host.endsWith(t));
}

function hostHasInstitutionHint(host: string): boolean {
  return INSTITUTION_HOST_HINTS.some(h => host.includes(h));
}

function isAggregatorHost(host: string): boolean {
  return AGGREGATOR_DOMAINS.some(d => host === d || host.endsWith('.' + d));
}

/**
 * Validate a discovered URL: domain check + content relevance check.
 * Returns confidence: strong / medium / weak / rejected.
 */
function validateDiscoveryCandidate(
  url: string,
  fetchedTitle: string,
  fetchedText: string,
  rowTokens: Set<string>,
): { confidence: DiscoveryResult['confidence']; reasons: string[]; matchedTokens: string[] } {
  const reasons: string[] = [];
  let host = '';
  try { host = new URL(url).hostname.toLowerCase().replace(/^www\./, ''); }
  catch { return { confidence: 'rejected', reasons: ['invalid url'], matchedTokens: [] }; }

  if (isAggregatorHost(host)) return { confidence: 'rejected', reasons: ['aggregator domain'], matchedTokens: [] };

  const tldOk = hostMatchesTrustedTld(host);
  const hintOk = hostHasInstitutionHint(host);
  if (!tldOk && !hintOk) {
    return { confidence: 'rejected', reasons: ['untrusted domain (no tld + no institution hint)'], matchedTokens: [] };
  }

  // Content relevance: token overlap of fetched title + first 4KB body vs row tokens
  const contentTokens = new Set([...tokenize(fetchedTitle), ...tokenize(fetchedText.slice(0, 4000))]);
  const matched = [...rowTokens].filter(t => contentTokens.has(t));
  if (rowTokens.size === 0) {
    reasons.push('no row tokens to match');
    return { confidence: 'weak', reasons, matchedTokens: matched };
  }

  const overlapRatio = matched.length / Math.max(1, rowTokens.size);
  if (matched.length >= 4 && tldOk) { reasons.push(`token_overlap=${matched.length}`, 'tld_trusted'); return { confidence: 'strong', reasons, matchedTokens: matched }; }
  if (matched.length >= 3) { reasons.push(`token_overlap=${matched.length}`); return { confidence: 'medium', reasons, matchedTokens: matched }; }
  if (overlapRatio >= 0.25) { reasons.push(`overlap_ratio=${overlapRatio.toFixed(2)}`); return { confidence: 'weak', reasons, matchedTokens: matched }; }
  return { confidence: 'rejected', reasons: [`weak content overlap (${matched.length} matched)`], matchedTokens: matched };
}

/**
 * Stage-3 discovery: only fires when no primary URL exists AND the row has
 * a meaningful title/org. Uses existing source_url / primary_cta_url as a
 * candidate (already-known URL the system hasn't promoted as official),
 * fetches it, and validates by domain + content overlap.
 *
 * NEVER auto-promotes to official_notification_link unless validation = strong
 * AND content matches title/org tokens. The pipeline performs the actual write.
 */
async function runStage3Discovery(
  draft: Record<string, any>,
  primaryUrls: OfficialUrl[],
): Promise<DiscoveryResult> {
  // Skip if a primary official URL already exists
  if (primaryUrls.some(u => u.trust === 'primary')) {
    return { confidence: 'none', status: 'none', evidence: { skipped: 'primary official url exists' } };
  }

  // Build row tokens for content matching
  const rowTokens = new Set([
    ...tokenize(draft.publish_title),
    ...tokenize(draft.normalized_title),
    ...tokenize(draft.raw_title),
    ...tokenize(draft.organisation_name),
    ...tokenize(draft.organization_authority),
    ...tokenize(draft.post_name),
    ...tokenize(draft.exam_name),
  ]);
  if (rowTokens.size < 2) {
    return { confidence: 'none', status: 'none', evidence: { skipped: 'row has no meaningful tokens' } };
  }

  // Candidate URLs to validate (already on the row, NOT yet trusted as official)
  const candidates: { url: string; origin: string }[] = [];
  const seen = new Set<string>();
  const tryAdd = (url: string | null | undefined, origin: string) => {
    if (!url || typeof url !== 'string') return;
    const u = url.trim();
    if (!u || !/^https?:\/\//i.test(u)) return;
    if (seen.has(u)) return;
    let host = '';
    try { host = new URL(u).hostname.toLowerCase().replace(/^www\./, ''); } catch { return; }
    if (isAggregatorHost(host)) return;
    seen.add(u);
    candidates.push({ url: u, origin });
  };
  tryAdd(draft.source_url, 'source_url');
  tryAdd(draft.primary_cta_url, 'primary_cta_url');
  tryAdd(draft.official_source_used, 'official_source_used');

  if (candidates.length === 0) {
    return { confidence: 'none', status: 'none', evidence: { skipped: 'no candidate urls on row' } };
  }

  // Fetch + validate the most promising candidate (prefer one with trusted TLD)
  candidates.sort((a, b) => {
    const ah = (() => { try { return new URL(a.url).hostname.toLowerCase(); } catch { return ''; } })();
    const bh = (() => { try { return new URL(b.url).hostname.toLowerCase(); } catch { return ''; } })();
    return (hostMatchesTrustedTld(bh) ? 1 : 0) - (hostMatchesTrustedTld(ah) ? 1 : 0);
  });

  const best = candidates[0];
  try {
    const r = await scrapePage(best.url, { formats: ['markdown'], onlyMainContent: true });
    if (!r.success || !r.markdown) {
      return {
        candidateUrl: best.url,
        confidence: 'rejected',
        status: 'rejected',
        evidence: { origin: best.origin, fetch_error: r.error || 'no markdown' },
      };
    }
    const fetchedTitle = (r.metadata?.title as string | undefined) || '';
    const v = validateDiscoveryCandidate(best.url, fetchedTitle, String(r.markdown), rowTokens);
    const status: DiscoveryResult['status'] =
      v.confidence === 'rejected' ? 'rejected' :
      v.confidence === 'strong' ? 'validated' : 'candidate';
    return {
      candidateUrl: best.url,
      confidence: v.confidence,
      status,
      evidence: {
        origin: best.origin,
        fetched_title: fetchedTitle.slice(0, 200),
        matched_tokens: v.matchedTokens.slice(0, 12),
        row_token_count: rowTokens.size,
        reasons: v.reasons,
      },
    };
  } catch (e) {
    return {
      candidateUrl: best.url,
      confidence: 'rejected',
      status: 'rejected',
      evidence: { origin: best.origin, error: e instanceof Error ? e.message.slice(0, 200) : String(e).slice(0, 200) },
    };
  }
}

/**
 * Build the full enrichment evidence bundle with the staged retrieval gate.
 * Stages: 1 = row evidence, 2 = official refresh (HTML+PDF), 3 = discovery.
 * Returns the bundle plus a no-data decision derived AFTER all stages.
 */
export async function buildEnrichmentEvidence(
  draft: Record<string, any>,
  options: BuildOptions = {},
): Promise<EnrichmentEvidenceResult> {
  const fetchAudit: EnrichmentEvidenceResult['fetchAudit'] = { attempted: false };
  let discovery: DiscoveryResult = { confidence: 'none', status: 'none', evidence: {} };

  // Stage 1 — collect what we already have.
  let candidates = collectFieldCandidates(draft);
  const urls = collectOfficialUrls(draft);

  // Stage 2 — official refresh when triggers fire.
  if (options.allowOfficialFetch) {
    const decision = shouldFetchOfficial(draft, candidates, urls);
    if (decision.fetch) {
      const audit = await performOfficialFetch(draft, urls, options.persistFetch);
      Object.assign(fetchAudit, audit);
      candidates = collectFieldCandidates(draft);
    } else {
      fetchAudit.attempted = false;
      fetchAudit.cachedAt = draft.official_fetch_at;
    }
  }

  // Stage 3 — discovery only when no primary URL and Stage 2 produced nothing.
  const hasPrimary = urls.some(u => u.trust === 'primary');
  const stage2Yielded = !!(draft.official_fetch_pdf_text || draft.official_fetch_html_text);
  if (options.allowOfficialFetch && !hasPrimary && !stage2Yielded) {
    try {
      discovery = await runStage3Discovery(draft, urls);
      // Persist discovery outcome for auditing (does NOT auto-promote).
      if (options.persistFetch && discovery.status !== 'none') {
        try {
          await options.persistFetch({
            discovered_official_url: discovery.candidateUrl ?? null,
            discovery_confidence: discovery.confidence,
            discovery_status: discovery.status,
            discovery_evidence: discovery.evidence as any,
          });
        } catch (e) { console.error('[intake-evidence] persist discovery failed:', e); }
      }
    } catch (e) {
      console.error('[intake-evidence] stage 3 error:', e);
      discovery = { confidence: 'rejected', status: 'rejected', evidence: { error: e instanceof Error ? e.message : String(e) } };
    }
  }

  // Render priority-tiered bundle.
  const tier1 = renderTier1(candidates);
  const officialBlock = renderOfficialUrls(urls);
  const tier2 = renderTier2(draft);
  const tier3 = renderTier3(draft);
  const tier4 = renderTier4(draft);

  // Tier 1 + Tier 2 + official URLs are NEVER trimmed.
  const header = [
    '# ENRICHMENT EVIDENCE BUNDLE',
    draft.raw_title ? `Title: ${draft.raw_title}` : '',
    draft.normalized_title ? `Normalized title: ${draft.normalized_title}` : '',
    draft.source_url ? `Source URL: ${draft.source_url}` : '',
    draft.source_domain ? `Source Domain: ${draft.source_domain}` : '',
    `Verification: ${draft.verification_status || '—'} (${draft.verification_confidence || '—'}, verified_on=${draft.source_verified_on_date || draft.source_verified_on || '—'})`,
    discovery.status !== 'none'
      ? `Stage-3 discovery: candidate=${discovery.candidateUrl || '—'} confidence=${discovery.confidence} status=${discovery.status}`
      : '',
  ].filter(Boolean).join('\n');

  const protectedBlocks = [header, tier1, officialBlock, tier2].filter(Boolean).join('\n\n');
  let bundle = [protectedBlocks, tier3, tier4].filter(Boolean).join('\n\n');
  if (bundle.length > TOTAL_SOFT_CAP) bundle = [protectedBlocks, tier3].filter(Boolean).join('\n\n');
  if (bundle.length > TOTAL_SOFT_CAP) bundle = protectedBlocks;

  // Grounded-source trace (used by pipeline for grade decision).
  const sd = safeParseStruct(draft.structured_data_json) || {};
  const groundedSources = {
    rowFields: STRUCTURED_FIELDS.filter(f => nonEmpty(draft[f])),
    structuredJsonFields: Object.keys(sd).filter(k => nonEmpty((sd as any)[k])),
    officialPdfFetched: !!draft.official_fetch_pdf_text,
    officialHtmlFetched: !!draft.official_fetch_html_text,
    discoveryPromoted: discovery.confidence === 'strong' && discovery.status === 'validated',
  };

  // Final no-data gate (after Stages 1–3).
  const groundedFieldCount = candidates.size;
  const hasFetchedContent = !!(draft.official_fetch_pdf_text || draft.official_fetch_html_text);
  const hasRawText = typeof draft.raw_text === 'string' && draft.raw_text.length > 200;
  const noData =
    groundedFieldCount === 0 &&
    !hasFetchedContent &&
    !hasRawText &&
    !groundedSources.discoveryPromoted;

  let reason: string;
  if (!noData) {
    const parts: string[] = [];
    if (groundedFieldCount > 0) parts.push(`tier1=${groundedFieldCount}`);
    if (hasFetchedContent) {
      const bits: string[] = [];
      if (draft.official_fetch_pdf_text) bits.push('pdf');
      if (draft.official_fetch_html_text) bits.push('html');
      parts.push(`official_fetch=${bits.join('+')}`);
    }
    if (hasRawText) parts.push(`raw_text=${(draft.raw_text as string).length}c`);
    if (groundedSources.discoveryPromoted) parts.push('discovery=validated');
    reason = `evidence_ok: ${parts.join(', ')}`;
  } else {
    const attempted: string[] = [];
    if (urls.length > 0) {
      const tried = urls.filter(u => u.trust === 'primary').map(u => u.url).join(' | ') || '(only secondary urls)';
      attempted.push(`official_urls_tried=[${tried}]`);
      if (fetchAudit.attempted) {
        if (fetchAudit.pdfStatus) attempted.push(`pdf=${fetchAudit.pdfStatus}${fetchAudit.pdfError ? `(${fetchAudit.pdfError})` : ''}`);
        if (fetchAudit.htmlStatus) attempted.push(`html=${fetchAudit.htmlStatus}${fetchAudit.htmlError ? `(${fetchAudit.htmlError})` : ''}`);
      } else {
        attempted.push('fetch_skipped_by_decision');
      }
    } else {
      attempted.push('no_official_urls');
    }
    if (discovery.status !== 'none') {
      attempted.push(`discovery=${discovery.status}(${discovery.confidence})`);
    } else {
      attempted.push('discovery=skipped');
    }
    attempted.push(`structured_data_json_facts=${groundedFieldCount}`);
    attempted.push(`raw_text_len=${(draft.raw_text || '').toString().length}`);
    reason = `no_data: ${attempted.join(' | ')}`;
  }

  return {
    bundle,
    groundedFieldCount,
    noDataDecision: noData,
    reason,
    fetchAudit,
    discovery,
    groundedSources,
  };
}

/**
 * Tolerant JSON extractor: strips DeepSeek-R1 <think>…</think> reasoning,
 * fenced code blocks, and prefix/suffix prose, then parses the first JSON
 * object found. Throws with a short diagnostic on failure.
 */
export function extractJsonObject(text: string): unknown {
  if (!text || typeof text !== 'string') throw new Error('extractJsonObject: empty input');
  let s = text;
  // Strip <think>…</think> blocks (DeepSeek-R1 reasoning).
  s = s.replace(/<think[\s\S]*?<\/think>/gi, '').trim();
  // Strip ```json … ``` fences.
  s = s.replace(/```(?:json)?\s*([\s\S]*?)```/gi, '$1').trim();
  // Find the largest balanced-looking JSON object.
  const first = s.indexOf('{');
  const last = s.lastIndexOf('}');
  if (first === -1 || last === -1 || last <= first) {
    throw new Error(`extractJsonObject: no object delimiters found (sample="${s.slice(0, 120)}…")`);
  }
  const slice = s.slice(first, last + 1);
  try {
    return JSON.parse(slice);
  } catch (e) {
    // Last resort: greedy first-{...}-of-text
    const m = s.match(/\{[\s\S]*\}/);
    if (m) return JSON.parse(m[0]);
    throw new Error(`extractJsonObject: parse failed — ${e instanceof Error ? e.message : String(e)}`);
  }
}
