/**
 * ChatGPT Agent Excel Parser — Pure utility, no DB operations.
 * Parses uploaded Excel workbook and returns normalized rows with section routing.
 *
 * Two parsers live here:
 *   1. parseExcelWorkbook            — legacy/old-format master_list workbook (untouched)
 *   2. parseProductionExcelWorkbook  — NEW production workbook, sheet "master_publish_ready_verified"
 *      with the strict 16-column header signature documented below.
 */
import * as XLSX from 'xlsx';

// ── Section bucket definitions ──
export type SectionBucket =
  | 'job_postings'
  | 'admit_cards'
  | 'results'
  | 'answer_keys'
  | 'exam_dates'
  | 'admissions'
  | 'scholarships'
  | 'other_updates';

export const SECTION_BUCKET_LABELS: Record<SectionBucket, string> = {
  job_postings: 'Job Postings',
  admit_cards: 'Admit Cards',
  results: 'Results',
  answer_keys: 'Answer Keys',
  exam_dates: 'Exam Dates',
  admissions: 'Admissions',
  scholarships: 'Scholarships',
  other_updates: 'Other Updates',
};

export const SECTION_CONTENT_TYPE: Record<SectionBucket, string> = {
  job_postings: 'job',
  admit_cards: 'admit_card',
  results: 'result',
  answer_keys: 'answer_key',
  exam_dates: 'exam',
  admissions: 'notification',
  scholarships: 'scholarship',
  other_updates: 'notification',
};

export const SECTION_PUBLISH_TARGET: Record<SectionBucket, string> = {
  job_postings: 'jobs',
  admit_cards: 'admit_cards',
  results: 'results',
  answer_keys: 'answer_keys',
  exam_dates: 'exams',
  admissions: 'notifications',
  scholarships: 'scholarships',
  other_updates: 'notifications',
};

export interface ParsedRow {
  raw_title: string;
  normalized_title: string;
  organisation_name: string | null;
  post_name: string | null;
  exam_name: string | null;
  official_notification_link: string | null;
  closing_date: string | null;
  opening_date: string | null;
  exam_date: string | null;
  result_date: string | null;
  admit_card_date: string | null;
  vacancy_count: number | null;
  qualification_text: string | null;
  age_limit_text: string | null;
  application_mode: string | null;
  review_notes: string | null;
  structured_data_json: Record<string, any>;
  section_bucket: SectionBucket;
  content_type: string;
  publish_target: string;
  primary_status: string;
  import_source_sheet: string;
  import_row_number: number;
  needs_review_reasons: string[];
}

export interface ParseSummary {
  total: number;
  imported: number;
  skipped: number;
  needsReview: number;
  duplicateSkipped: number;
  missingLinkCount: number;
  perSection: Record<string, number>;
  sheetsDetected: string[];
  sheetsUsed: string[];
  sheetsSkipped: string[];
}

export interface ParseResult {
  rows: ParsedRow[];
  summary: ParseSummary;
}

const SKIP_SHEETS = ['summary', 'readme'];
const CATEGORY_SHEETS = ['jobs', 'admit_cards', 'results', 'other_findings', 'needs_verification'];

// ── Helpers ──
function isBlank(v: any): boolean {
  if (v == null) return true;
  const s = String(v).trim().toLowerCase();
  return s === '' || s === 'not applicable' || s === '-' || s === 'n/a' || s === 'na' || s === 'none';
}

function clean(v: any): string | null {
  if (isBlank(v)) return null;
  return String(v).trim();
}

function cleanNum(v: any): number | null {
  if (isBlank(v)) return null;
  const n = parseInt(String(v).replace(/[^\d]/g, ''), 10);
  return isNaN(n) ? null : n;
}

function normalizeTitle(t: string): string {
  return t.trim().toLowerCase().replace(/\s+/g, ' ');
}

function findHeader(headers: string[], ...candidates: string[]): number {
  const normalized = headers.map(h => h.toLowerCase().trim());
  for (const c of candidates) {
    const idx = normalized.indexOf(c.toLowerCase());
    if (idx >= 0) return idx;
  }
  // Partial match
  for (const c of candidates) {
    const cl = c.toLowerCase();
    const idx = normalized.findIndex(h => h.includes(cl));
    if (idx >= 0) return idx;
  }
  return -1;
}

function mapApplicationMode(raw: string | null): string | null {
  if (!raw) return null;
  const l = raw.toLowerCase().trim();
  if (l.includes('online')) return 'online';
  if (l.includes('offline')) return 'offline';
  if (l.includes('walk')) return 'walk_in';
  if (l.includes('email')) return 'email';
  return 'unknown';
}

// ── Routing logic ──
function routeToSection(category: string | null, subcategory: string | null, suggestedType: string | null): SectionBucket {
  const cat = (category || '').toLowerCase();
  const sub = (subcategory || '').toLowerCase();
  const sug = (suggestedType || '').toLowerCase();

  // Primary: category
  if (cat.includes('jobs') || cat.includes('recruitment')) return 'job_postings';
  if (cat.includes('admit card')) return 'admit_cards';
  if (cat.includes('result')) return 'results';

  // Subcategory routing for "Other Important Candidate Updates"
  if (sub.includes('answer key')) return 'answer_keys';
  if (sub.includes('exam date') || sub.includes('exam schedule')) return 'exam_dates';
  if (sub.includes('admission')) return 'admissions';
  if (sub.includes('scholarship') || sub.includes('certificate') || sub.includes('fellowship')) return 'scholarships';

  // Suggested content type fallback
  if (sug.includes('job') || sug.includes('recruitment')) return 'job_postings';
  if (sug.includes('admit')) return 'admit_cards';
  if (sug.includes('result')) return 'results';
  if (sug.includes('answer')) return 'answer_keys';
  if (sug.includes('exam')) return 'exam_dates';
  if (sug.includes('admission')) return 'admissions';
  if (sug.includes('scholarship') || sug.includes('certificate')) return 'scholarships';

  return 'other_updates';
}

function routeFromSheetName(sheetName: string): SectionBucket {
  const s = sheetName.toLowerCase();
  if (s.includes('job')) return 'job_postings';
  if (s.includes('admit')) return 'admit_cards';
  if (s.includes('result')) return 'results';
  return 'other_updates';
}

// ── Main parse function ──
export function parseExcelWorkbook(buffer: ArrayBuffer): ParseResult {
  const wb = XLSX.read(buffer, { type: 'array' });
  const allSheets = wb.SheetNames;
  const sheetsSkipped: string[] = [];
  const sheetsUsed: string[] = [];

  // Determine source sheet
  const masterSheet = allSheets.find(s => s.toLowerCase().replace(/\s+/g, '_') === 'master_list');
  let sourceSheets: { name: string; isFallback: boolean }[] = [];

  if (masterSheet) {
    const ws = wb.Sheets[masterSheet];
    const data = XLSX.utils.sheet_to_json<any>(ws, { defval: '' });
    if (data.length > 0) {
      sourceSheets = [{ name: masterSheet, isFallback: false }];
    }
  }

  if (sourceSheets.length === 0) {
    // Fallback to category sheets
    for (const s of allSheets) {
      const sn = s.toLowerCase().replace(/\s+/g, '_');
      if (SKIP_SHEETS.includes(sn)) {
        sheetsSkipped.push(s);
        continue;
      }
      if (CATEGORY_SHEETS.includes(sn) || sn === 'master_list') {
        sourceSheets.push({ name: s, isFallback: true });
      } else {
        sheetsSkipped.push(s);
      }
    }
  } else {
    allSheets.forEach(s => {
      if (s !== masterSheet) sheetsSkipped.push(s);
    });
  }

  const rows: ParsedRow[] = [];
  const seenKeys = new Set<string>();
  let skipped = 0;
  let duplicateSkipped = 0;

  for (const { name: sheetName, isFallback } of sourceSheets) {
    const ws = wb.Sheets[sheetName];
    const rawData = XLSX.utils.sheet_to_json<any>(ws, { defval: '' });
    if (rawData.length === 0) continue;
    sheetsUsed.push(sheetName);

    // Build header map from first row keys
    const headers = Object.keys(rawData[0]);

    const colTitle = findHeader(headers, 'title', 'post title', 'job title');
    const colOrg = findHeader(headers, 'organization', 'organisation', 'authority', 'org name');
    const colPost = findHeader(headers, 'post name', 'post / exam name', 'post/exam name', 'exam name');
    const colLink = findHeader(headers, 'official link', 'official notification link', 'link');
    const colLastDate = findHeader(headers, 'last date', 'closing date', 'last date of application');
    const colStartDate = findHeader(headers, 'application start date', 'start date', 'opening date');
    const colExamDate = findHeader(headers, 'exam date', 'exam / interview date');
    const colResultDate = findHeader(headers, 'result date');
    const colAdmitDate = findHeader(headers, 'admit card date');
    const colVacancies = findHeader(headers, 'vacancies', 'total vacancies', 'vacancy');
    const colQualification = findHeader(headers, 'qualification', 'eligibility');
    const colAgeLimit = findHeader(headers, 'age limit');
    const colApplyMode = findHeader(headers, 'apply mode', 'application mode');
    const colNotes = findHeader(headers, 'notes', 'remarks');
    const colCategory = findHeader(headers, 'content category', 'category');
    const colSubcategory = findHeader(headers, 'subcategory', 'sub category', 'sub-category');
    const colSuggestedType = findHeader(headers, 'suggested content type', 'content type');

    // Extra metadata columns
    const metaCols = ['priority', 'seo intent', 'editorial status', 'source basis',
      'official link type', 'official link verification', 'status', 'discovery url'];

    const isNeedsVerification = sheetName.toLowerCase().includes('needs_verification') ||
      sheetName.toLowerCase().includes('needs verification');

    for (let rowIdx = 0; rowIdx < rawData.length; rowIdx++) {
      const row = rawData[rowIdx];
      const vals = Object.values(row) as any[];

      const title = colTitle >= 0 ? clean(vals[colTitle]) : null;
      if (!title || title.length < 3) { skipped++; continue; }

      const org = colOrg >= 0 ? clean(vals[colOrg]) : null;
      const postName = colPost >= 0 ? clean(vals[colPost]) : null;
      const officialLink = colLink >= 0 ? clean(vals[colLink]) : null;
      const lastDate = colLastDate >= 0 ? clean(vals[colLastDate]) : null;
      const startDate = colStartDate >= 0 ? clean(vals[colStartDate]) : null;
      const examDate = colExamDate >= 0 ? clean(vals[colExamDate]) : null;
      const resultDate = colResultDate >= 0 ? clean(vals[colResultDate]) : null;
      const admitDate = colAdmitDate >= 0 ? clean(vals[colAdmitDate]) : null;
      const vacancies = colVacancies >= 0 ? cleanNum(vals[colVacancies]) : null;
      const qualification = colQualification >= 0 ? clean(vals[colQualification]) : null;
      const ageLimit = colAgeLimit >= 0 ? clean(vals[colAgeLimit]) : null;
      const applyMode = colApplyMode >= 0 ? clean(vals[colApplyMode]) : null;
      const notes = colNotes >= 0 ? clean(vals[colNotes]) : null;
      const category = colCategory >= 0 ? clean(vals[colCategory]) : null;
      const subcategory = colSubcategory >= 0 ? clean(vals[colSubcategory]) : null;
      const suggestedType = colSuggestedType >= 0 ? clean(vals[colSuggestedType]) : null;

      // Within-batch dedup
      const dedupKey = `${normalizeTitle(title)}::${(org || '').toLowerCase().trim()}`;
      if (seenKeys.has(dedupKey)) { duplicateSkipped++; continue; }
      seenKeys.add(dedupKey);

      // Route
      const sectionBucket = isFallback && !category
        ? routeFromSheetName(sheetName)
        : routeToSection(category, subcategory, suggestedType);

      // Build structured_data_json for extra metadata
      const structuredData: Record<string, any> = {};
      for (const mc of metaCols) {
        const idx = findHeader(headers, mc);
        if (idx >= 0 && !isBlank(vals[idx])) {
          structuredData[mc.replace(/\s+/g, '_')] = String(vals[idx]).trim();
        }
      }
      if (subcategory) structuredData.subcategory = subcategory;
      if (category) structuredData.content_category = category;
      if (suggestedType) structuredData.suggested_content_type = suggestedType;

      // Needs review logic
      const needsReviewReasons: string[] = [];
      if (title.length < 10) needsReviewReasons.push('Title too short');
      if (!officialLink) needsReviewReasons.push('Missing official link');
      if (isNeedsVerification) needsReviewReasons.push('From Needs_Verification sheet');
      if (!category && !suggestedType && isFallback) needsReviewReasons.push('Uncertain routing');

      const primaryStatus = needsReviewReasons.length > 0 ? 'manual_check' : 'publish_ready';

      rows.push({
        raw_title: title,
        normalized_title: title,
        organisation_name: org,
        post_name: postName,
        exam_name: sectionBucket === 'exam_dates' ? (postName || title) : null,
        official_notification_link: officialLink,
        closing_date: lastDate,
        opening_date: startDate,
        exam_date: examDate,
        result_date: resultDate,
        admit_card_date: admitDate,
        vacancy_count: vacancies,
        qualification_text: qualification,
        age_limit_text: ageLimit,
        application_mode: mapApplicationMode(applyMode),
        review_notes: notes,
        structured_data_json: structuredData,
        section_bucket: sectionBucket,
        content_type: SECTION_CONTENT_TYPE[sectionBucket],
        publish_target: SECTION_PUBLISH_TARGET[sectionBucket],
        primary_status: primaryStatus,
        import_source_sheet: sheetName,
        import_row_number: rowIdx + 2, // 1-indexed header + data
        needs_review_reasons: needsReviewReasons,
      });
    }
  }

  const perSection: Record<string, number> = {};
  let needsReview = 0;
  let missingLinkCount = 0;
  for (const r of rows) {
    perSection[r.section_bucket] = (perSection[r.section_bucket] || 0) + 1;
    if (r.primary_status === 'manual_check') needsReview++;
    if (!r.official_notification_link) missingLinkCount++;
  }

  return {
    rows,
    summary: {
      total: rows.length + skipped + duplicateSkipped,
      imported: rows.length,
      skipped,
      needsReview,
      duplicateSkipped,
      missingLinkCount,
      perSection,
      sheetsDetected: allSheets,
      sheetsUsed,
      sheetsSkipped,
    },
  };
}

// ════════════════════════════════════════════════════════════════════════════
// NEW PRODUCTION FORMAT PARSER — 16-column workbook
// ════════════════════════════════════════════════════════════════════════════

/**
 * Exact 16 expected production headers. Order is the canonical column order
 * but matching is by normalized header string, not position.
 */
export const PRODUCTION_HEADERS = [
  'Record ID',
  'Publish Status',
  'Category Family',
  'Update Type',
  'Organization / Board / Authority',
  'Publish Title',
  'Official Website URL',
  'Official Reference URL',
  'Primary CTA Label',
  'Primary CTA URL',
  'Secondary Official URL',
  'Verification Status',
  'Verification Confidence',
  'Official Source Used',
  'Source Verified On',
  'Production Notes',
] as const;

const PREFERRED_PRODUCTION_SHEET = 'master_publish_ready_verified';

export interface ProductionParsedRow {
  // ── 16 production fields (raw, post-clean) ──
  record_id: string | null;
  publish_status: string | null;
  category_family: string | null;
  update_type: string | null;
  organization_authority: string | null;
  publish_title: string | null;
  official_website_url: string | null;
  official_reference_url: string | null;
  primary_cta_label: string | null;
  primary_cta_url: string | null;
  secondary_official_url: string | null;
  verification_status: string | null;
  verification_confidence: string | null;
  official_source_used: string | null;
  source_verified_on: string | null;        // original text preserved verbatim
  source_verified_on_date: string | null;   // YYYY-MM-DD if Excel serial parsed cleanly
  production_notes: string | null;

  // ── lossless backup ──
  source_row_json: Record<string, any>;

  // ── unified import identity (record_id OR fb:hash) ──
  import_identity: string;

  // ── legacy mirror fields (populated in parallel for downstream compat) ──
  raw_title: string;
  normalized_title: string;
  organisation_name: string | null;
  official_notification_link: string | null;
  structured_data_json: Record<string, any>;
  section_bucket: SectionBucket;
  content_type: string | null;
  publish_target: string;
  primary_status: string;             // publish_ready | reject | manual_check
  import_source_sheet: string;
  import_row_number: number;
}

export interface ProductionParseResult {
  ok: true;
  rows: ProductionParsedRow[];
  sheetUsed: string;
  summary: {
    total: number;             // total non-header rows scanned in sheet
    parsed: number;            // rows in `rows`
    skipped_empty: number;     // rows treated as fully empty
  };
}

export interface ProductionParseFailure {
  ok: false;
  reason: string;
  detected: string[];
  missing: string[];
  sheetUsed: string | null;
}

/** Normalize header for matching: trim, collapse whitespace, lowercase. */
function normHeader(h: string): string {
  return String(h ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

const NORMALIZED_PRODUCTION_HEADERS = PRODUCTION_HEADERS.map(normHeader);

/** Returns true iff every expected production header is present in the sheet's first row. */
function sheetHasProductionSignature(ws: XLSX.WorkSheet): boolean {
  const headerRow = XLSX.utils.sheet_to_json<any>(ws, { header: 1, defval: '', range: 0 })[0] as any[] | undefined;
  if (!headerRow || headerRow.length === 0) return false;
  const present = new Set(headerRow.map(h => normHeader(String(h))));
  return NORMALIZED_PRODUCTION_HEADERS.every(h => present.has(h));
}

/** Detect whether an arbitrary workbook looks like the production format. */
export function detectProductionFormat(buffer: ArrayBuffer): boolean {
  try {
    const wb = XLSX.read(buffer, { type: 'array' });
    for (const sheetName of wb.SheetNames) {
      if (sheetHasProductionSignature(wb.Sheets[sheetName])) return true;
    }
    return false;
  } catch {
    return false;
  }
}

/** URL sanitiser: trims and treats placeholders as null. Never rewrites valid URLs. */
function cleanUrl(v: any): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s) return null;
  if (/^(n\/?a|na|none|-|--)$/i.test(s)) return null;
  return s;
}

/** Generic text cleaner: trim, treat empty/placeholder as null. */
function cleanText(v: any): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s) return null;
  if (/^(n\/?a|na|none|-|--)$/i.test(s)) return null;
  return s;
}

function normForIdentity(v: string | null | undefined): string {
  return String(v ?? '').toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

/** sha256 → hex (browser SubtleCrypto if available, otherwise simple FNV-1a fallback). */
async function sha256HexAsync(input: string): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const enc = new TextEncoder().encode(input);
    const buf = await crypto.subtle.digest('SHA-256', enc);
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  }
  // FNV-1a fallback (deterministic; collision-resistant enough as a fallback only)
  let h = 0xcbf29ce484222325n;
  const FNV = 0x100000001b3n;
  for (let i = 0; i < input.length; i++) {
    h ^= BigInt(input.charCodeAt(i));
    h = (h * FNV) & 0xffffffffffffffffn;
  }
  return h.toString(16).padStart(16, '0').repeat(4).slice(0, 64);
}

/**
 * Word-boundary classifier with fixed priority order.
 *
 * Priority (first match wins, so generic notification/notice never beats specifics):
 *   1. answer        → answer_keys
 *   2. admit         → admit_cards
 *   3. result        → results
 *   4. scholarship/fellowship/certificate → scholarships
 *   5. job/recruit/recruitment/vacancy/hiring → job_postings
 *   6. exam/schedule/calendar/datesheet OR pair (date+sheet | exam+date | exam+schedule)
 *      → exam_dates  (standalone `date` token alone does NOT trigger)
 *   7. admission     → admissions
 *   8. notification/notice → other_updates (mapped to notification/notifications enums)
 *   9. else          → null bucket (caller falls back to category_family, then other_updates)
 *
 * Returns null when no family matches, so the caller can retry with the fallback string.
 */
function classifyOne(src: string | null): SectionBucket | null {
  if (!src) return null;
  const tokens: string[] = (src.toLowerCase().match(/[a-z0-9]+/g) || []);
  if (tokens.length === 0) return null;
  const has = (t: string): boolean => tokens.indexOf(t) >= 0;
  const hasAny = (...ts: string[]): boolean => ts.some(t => tokens.indexOf(t) >= 0);
  const adjacentPair = (a: string, b: string): boolean => {
    for (let i = 0; i < tokens.length - 1; i++) {
      if (tokens[i] === a && tokens[i + 1] === b) return true;
    }
    return false;
  };

  if (has('answer')) return 'answer_keys';
  if (has('admit')) return 'admit_cards';
  if (has('result')) return 'results';
  if (hasAny('scholarship', 'fellowship', 'certificate')) return 'scholarships';
  if (hasAny('job', 'jobs', 'recruit', 'recruitment', 'vacancy', 'vacancies', 'hiring')) return 'job_postings';
  // Exam family — direct signals OR explicit exam-context pairs only. Standalone `date` is excluded.
  if (hasAny('exam', 'schedule', 'calendar', 'datesheet')) return 'exam_dates';
  if (adjacentPair('date', 'sheet') || adjacentPair('exam', 'date') || adjacentPair('exam', 'schedule')) {
    return 'exam_dates';
  }
  if (has('admission')) return 'admissions';
  if (hasAny('notification', 'notice')) return 'other_updates';
  return null;
}

/** Section bucket from update_type first, then category_family fallback, else other_updates. */
function deriveSectionBucket(updateType: string | null, categoryFamily: string | null): SectionBucket {
  return classifyOne(updateType) ?? classifyOne(categoryFamily) ?? 'other_updates';
}

/**
 * Excel date serial → YYYY-MM-DD (or null if not a clean serial).
 * Inline conversion (no XLSX.SSF dependency).
 * Excel epoch is 1899-12-30 to account for the Lotus 1900 leap-year bug.
 * Valid serial range: 1 (1899-12-31) .. 2958465 (9999-12-31).
 */
function excelSerialToISO(n: number): string | null {
  if (!Number.isFinite(n) || n < 1 || n > 2958465) return null;
  const ms = Math.round((n - 25569) * 86400 * 1000);
  const d = new Date(ms);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

/** Parse a textual date string into YYYY-MM-DD. Accepts common formats; returns null if unparseable. */
function parseTextDateToISO(s: string): string | null {
  const t = s.trim();
  if (!t) return null;
  // Already ISO YYYY-MM-DD
  let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) {
    const iso = `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
    return isNaN(new Date(iso).getTime()) ? null : iso;
  }
  // DD-MMM-YYYY or DD MMM YYYY  (e.g. 15-Mar-2023)
  m = t.match(/^(\d{1,2})[-\s]([A-Za-z]{3,})[-\s](\d{4})$/);
  if (m) {
    const months: Record<string, number> = { jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,sept:9,oct:10,nov:11,dec:12 };
    const mo = months[m[2].slice(0,3).toLowerCase()];
    if (mo) {
      const iso = `${m[3]}-${String(mo).padStart(2,'0')}-${m[1].padStart(2,'0')}`;
      return isNaN(new Date(iso).getTime()) ? null : iso;
    }
  }
  // DD/MM/YYYY or DD-MM-YYYY
  m = t.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (m) {
    const iso = `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;
    return isNaN(new Date(iso).getTime()) ? null : iso;
  }
  // YYYY/MM/DD
  m = t.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  if (m) {
    const iso = `${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`;
    return isNaN(new Date(iso).getTime()) ? null : iso;
  }
  return null;
}

/**
 * Resolve the date column. Returns:
 *   - source_verified_on: original raw text preserved verbatim (number → string of number)
 *   - source_verified_on_date: ISO YYYY-MM-DD if serial- or text-parseable, else null
 */
function resolveSourceVerifiedOn(rawDate: any): { text: string | null; iso: string | null } {
  if (rawDate == null) return { text: null, iso: null };
  if (typeof rawDate === 'number') {
    return { text: String(rawDate), iso: excelSerialToISO(rawDate) };
  }
  const s = String(rawDate).trim();
  if (!s) return { text: null, iso: null };
  // Try numeric-string-as-serial (e.g. "45000")
  if (/^\d+(\.\d+)?$/.test(s)) {
    const n = Number(s);
    const iso = excelSerialToISO(n);
    if (iso) return { text: s, iso };
  }
  return { text: s, iso: parseTextDateToISO(s) };
}

// Back-compat shim — kept for any external import; routes to the new resolver.
function excelSerialToDate(v: any): string | null {
  return resolveSourceVerifiedOn(v).iso;
}

/**
 * MAIN PRODUCTION PARSER.
 *
 * Sheet detection (3-step):
 *   1. exact preferred sheet name `master_publish_ready_verified`
 *   2. scan all sheets for the full 16-header signature
 *   3. fallback to first non-empty sheet
 *
 * Status mapping (verified against `validate_intake_drafts_fields` trigger):
 *   - source_type='manual', raw_file_type='unknown', processing_status='imported',
 *     review_status='pending'
 *   - primary_status: 'publish_ready' if (verified AND ready) else 'reject' if reject/discard else 'manual_check'
 *   - content_type derived from update_type first, fallback to category_family; null if no clean match
 *   - publish_target derived same way; defaults to 'none'
 */
export async function parseProductionExcelWorkbook(
  buffer: ArrayBuffer,
): Promise<ProductionParseResult | ProductionParseFailure> {
  const wb = XLSX.read(buffer, { type: 'array', cellDates: false });
  const allSheets = wb.SheetNames;

  // ── Sheet detection (3-step) ──
  let sheetUsed: string | null = null;
  if (allSheets.includes(PREFERRED_PRODUCTION_SHEET) &&
      sheetHasProductionSignature(wb.Sheets[PREFERRED_PRODUCTION_SHEET])) {
    sheetUsed = PREFERRED_PRODUCTION_SHEET;
  } else {
    for (const name of allSheets) {
      if (sheetHasProductionSignature(wb.Sheets[name])) {
        sheetUsed = name;
        break;
      }
    }
  }
  if (!sheetUsed) {
    // Final fallback: first non-empty sheet — but still validate headers to surface a clean failure.
    for (const name of allSheets) {
      const data = XLSX.utils.sheet_to_json<any>(wb.Sheets[name], { defval: '' });
      if (data.length > 0) { sheetUsed = name; break; }
    }
  }
  if (!sheetUsed) {
    return { ok: false, reason: 'No non-empty sheet found in workbook.', detected: [], missing: [...PRODUCTION_HEADERS], sheetUsed: null };
  }

  const ws = wb.Sheets[sheetUsed];
  const rows = XLSX.utils.sheet_to_json<any>(ws, { defval: null, raw: true });
  if (rows.length === 0) {
    return { ok: false, reason: `Sheet "${sheetUsed}" is empty.`, detected: [], missing: [...PRODUCTION_HEADERS], sheetUsed };
  }

  // Validate all 16 headers are present
  const detected = Object.keys(rows[0]).map(String);
  const detectedNorm = new Set(detected.map(normHeader));
  const missing = PRODUCTION_HEADERS.filter(h => !detectedNorm.has(normHeader(h)));
  if (missing.length > 0) {
    return { ok: false, reason: `Sheet "${sheetUsed}" is missing required headers.`, detected, missing, sheetUsed };
  }

  // Build header-name → exact original key map (case-insensitive)
  const keyByNorm: Record<string, string> = {};
  for (const k of detected) keyByNorm[normHeader(k)] = k;
  const get = (row: any, header: string) => row[keyByNorm[normHeader(header)]];

  const out: ProductionParsedRow[] = [];
  let skippedEmpty = 0;

  for (let i = 0; i < rows.length; i++) {
    const raw = rows[i];

    // 16 fields
    const record_id = cleanText(get(raw, 'Record ID'));
    const publish_status = cleanText(get(raw, 'Publish Status'));
    const category_family = cleanText(get(raw, 'Category Family'));
    const update_type = cleanText(get(raw, 'Update Type'));
    const organization_authority = cleanText(get(raw, 'Organization / Board / Authority'));
    const publish_title = cleanText(get(raw, 'Publish Title'));
    const official_website_url = cleanUrl(get(raw, 'Official Website URL'));
    const official_reference_url = cleanUrl(get(raw, 'Official Reference URL'));
    const primary_cta_label = cleanText(get(raw, 'Primary CTA Label'));
    const primary_cta_url = cleanUrl(get(raw, 'Primary CTA URL'));
    const secondary_official_url = cleanUrl(get(raw, 'Secondary Official URL'));
    const verification_status = cleanText(get(raw, 'Verification Status'));
    const verification_confidence = cleanText(get(raw, 'Verification Confidence'));
    const official_source_used = cleanText(get(raw, 'Official Source Used'));
    const production_notes = cleanText(get(raw, 'Production Notes'));

    // Date: preserve original text, also try parse Excel serial → YYYY-MM-DD
    const rawDate = get(raw, 'Source Verified On');
    const source_verified_on = rawDate == null ? null : (typeof rawDate === 'number' ? String(rawDate) : String(rawDate).trim() || null);
    const source_verified_on_date = excelSerialToDate(rawDate);

    // Empty-row skip
    const allBlank = !publish_title && !organization_authority && !category_family && !update_type
      && !official_website_url && !official_reference_url && !primary_cta_url && !secondary_official_url;
    if (allBlank) { skippedEmpty++; continue; }

    // Identity (record_id wins; else URL-prefixed hash)
    let import_identity: string;
    if (record_id) {
      import_identity = record_id;
    } else {
      const url = official_reference_url ?? primary_cta_url ?? official_website_url ?? '';
      const seed = [
        url,
        normForIdentity(publish_title),
        normForIdentity(organization_authority),
        normForIdentity(update_type),
        normForIdentity(category_family),
      ].join('|');
      const hex = await sha256HexAsync(seed);
      import_identity = 'fb:' + hex.slice(0, 32);
    }

    // Section + content_type/publish_target derivation (with category_family fallback)
    const section_bucket = deriveSectionBucket(update_type, category_family);
    const content_type = SECTION_CONTENT_TYPE[section_bucket] ?? null;
    const publish_target = SECTION_PUBLISH_TARGET[section_bucket] ?? 'none';

    // Primary status mapping
    const verLower = (verification_status ?? '').toLowerCase();
    const pubLower = (publish_status ?? '').toLowerCase();
    let primary_status: string;
    if (pubLower.includes('reject') || pubLower.includes('discard')) {
      primary_status = 'reject';
    } else if (verLower.includes('verified') && (pubLower.includes('ready') || pubLower.includes('publish'))) {
      primary_status = 'publish_ready';
    } else {
      primary_status = 'manual_check';
    }

    // Legacy mirror
    const title = publish_title ?? '';
    const official_notification_link = official_reference_url ?? primary_cta_url ?? official_website_url ?? null;

    // source_row_json — preserve original raw row exactly (best-effort key normalisation kept verbatim)
    const source_row_json: Record<string, any> = { ...raw };
    const structured_data_json: Record<string, any> = { ...source_row_json, _format: 'production_v1' };

    out.push({
      record_id, publish_status, category_family, update_type, organization_authority, publish_title,
      official_website_url, official_reference_url, primary_cta_label, primary_cta_url,
      secondary_official_url, verification_status, verification_confidence, official_source_used,
      source_verified_on, source_verified_on_date, production_notes,
      source_row_json,
      import_identity,
      raw_title: title,
      normalized_title: title,
      organisation_name: organization_authority,
      official_notification_link,
      structured_data_json,
      section_bucket,
      content_type,
      publish_target,
      primary_status,
      import_source_sheet: sheetUsed,
      import_row_number: i + 2, // header row + 1-indexed data
    });
  }

  return {
    ok: true,
    rows: out,
    sheetUsed,
    summary: { total: rows.length, parsed: out.length, skipped_empty: skippedEmpty },
  };
}
