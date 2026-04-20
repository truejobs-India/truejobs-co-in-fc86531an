/**
 * ChatGPT Agent Excel Parser — Master-File workbook (V1).
 *
 * Single-sheet, fixed-header parser for the TrueJobs Master-File.xlsx schema:
 *   sheet name: "Master-File" (case-insensitive; falls back to first sheet)
 *
 * Pure function, no DB operations. Returns rows ready for upsert into
 * intake_drafts and a truthful import summary.
 */
import * as XLSX from 'xlsx';

// ── Section bucket definitions (kept stable; still used by Manager tabs) ──
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

const SECTION_CONTENT_TYPE: Record<SectionBucket, string> = {
  job_postings: 'job',
  admit_cards: 'admit_card',
  results: 'result',
  answer_keys: 'answer_key',
  exam_dates: 'exam',
  admissions: 'notification',
  scholarships: 'scholarship',
  other_updates: 'notification',
};

const SECTION_PUBLISH_TARGET: Record<SectionBucket, string> = {
  job_postings: 'jobs',
  admit_cards: 'admit_cards',
  results: 'results',
  answer_keys: 'answer_keys',
  exam_dates: 'exams',
  admissions: 'notifications',
  scholarships: 'scholarships',
  other_updates: 'notifications',
};

// ────────────────────────────────────────────────────────────────────────
// Header alias map (Master-File → canonical internal field)
// ────────────────────────────────────────────────────────────────────────
//
// The Excel column on the LEFT is mapped to the internal field on the RIGHT.
// CTA columns are renamed at this single boundary; everywhere else in the
// codebase uses the internal names (cta_label / cta_color / cta_url).
//
const HEADER_MAP: Record<string, string> = {
  record_id: 'record_id',
  category_family: 'category_family',
  update_type: 'update_type',
  row_type: 'row_type',
  company_department_psu_bank_name: 'organization_authority',
  publish_title: 'publish_title',
  slug: 'slug',
  meta_title: 'seo_title',
  meta_description: 'meta_description',
  short_summary: 'summary',
  content_status: 'content_status',
  reference_no: 'reference_no',
  post_name: 'post_name',
  no_of_posts: 'vacancy_count',
  required_qualification: 'qualification_text',
  application_mode: 'application_mode',
  start_date_to_apply: 'opening_date',
  last_date_to_apply: 'closing_date',
  notification_date: 'notification_date',
  examination_date: 'exam_date',
  official_apply_link: 'official_apply_link',
  official_website_link: 'official_website_link',
  official_notice_link: 'official_notification_link',
  official_reference_url: 'official_reference_url',
  publish_priority: 'publish_priority_raw',          // raw-only
  publish_ready_status: 'publish_status',
  final_confidence: 'verification_confidence',
  seo_primary_keyword: 'seo_primary_keyword',
  seo_secondary_keywords: 'seo_secondary_keywords',
  verification_notes: 'verification_notes',
  prompt: 'row_prompt',
  draft_heading_h1: 'draft_heading_h1',
  image_prompt: 'image_prompt',
  image_alt_text: 'image_alt_text',
  // CTA boundary rename (single source of truth — never named cta_button_* anywhere else)
  cta_button_label: 'cta_label',
  cta_button_color: 'cta_color',
  cta_button_url: 'cta_url',
};

const PREFERRED_SHEET = 'master-file';

// ── Public types ────────────────────────────────────────────────────────

export interface MasterFileParsedRow {
  // typed canonical fields (post-clean)
  record_id: string | null;
  category_family: string | null;
  update_type: string | null;
  row_type: string | null;
  organization_authority: string | null;
  publish_title: string | null;
  slug: string | null;
  seo_title: string | null;
  meta_description: string | null;
  summary: string | null;
  content_status: string | null;
  reference_no: string | null;
  post_name: string | null;
  vacancy_count: number | null;
  qualification_text: string | null;
  application_mode: string | null;
  opening_date: string | null;
  closing_date: string | null;
  notification_date: string | null;
  exam_date: string | null;
  official_apply_link: string | null;
  official_website_link: string | null;
  official_notification_link: string | null;
  official_reference_url: string | null;
  publish_status: string | null;
  verification_confidence: string | null;
  seo_primary_keyword: string | null;
  seo_secondary_keywords: string | null;
  verification_notes: string | null;
  row_prompt: string | null;
  draft_heading_h1: string | null;
  image_prompt: string | null;
  image_alt_text: string | null;
  cta_label: string | null;
  cta_color: string | null;
  cta_url: string | null;

  // lossless backup of EVERY original cell (immutable after import)
  source_row_json: Record<string, any>;

  // routing + identity
  section_bucket: SectionBucket;
  content_type: string;
  publish_target: string;
  primary_status: string;            // 'publish_ready' | 'manual_check' | 'reject'
  import_identity: string;
  import_source_sheet: string;
  import_row_number: number;

  // legacy mirrors (downstream code reads these)
  raw_title: string;
  normalized_title: string;
  organisation_name: string | null;
}

export interface MasterFileParseSummary {
  total_rows_found: number;
  imported: number;
  skipped_empty: number;
  failed: { row: number; reason: string }[];
  sheet_used: string;
  headers_detected: number;
  headers_mapped: number;
  headers_preserved_raw_only: string[];
}

export type MasterFileParseResult =
  | { ok: true; rows: MasterFileParsedRow[]; summary: MasterFileParseSummary }
  | { ok: false; reason: string; sheet_used: string | null };

// ── Helpers ──

function normHeader(h: string): string {
  return String(h ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\/\-]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

function isBlankCell(v: any): boolean {
  if (v == null) return true;
  if (typeof v === 'string') return v.trim() === '';
  return false;
}

function clean(v: any, preserveLines = false): string | null {
  if (isBlankCell(v)) return null;
  const s = String(v);
  return (preserveLines ? s.replace(/^[ \t]+|[ \t]+$/g, '') : s.trim()) || null;
}

function cleanInt(v: any): number | null {
  if (isBlankCell(v)) return null;
  const n = parseInt(String(v).replace(/[^\d-]/g, ''), 10);
  return isNaN(n) ? null : n;
}

const LONG_TEXT_FIELDS = new Set([
  'row_prompt', 'image_prompt', 'meta_description', 'summary',
  'qualification_text', 'verification_notes', 'seo_secondary_keywords',
]);

// row_type → section bucket mapping (V1: simple, fall back to other_updates)
function rowTypeToBucket(rowType: string | null, updateType: string | null, categoryFamily: string | null): SectionBucket {
  const tokens = `${rowType ?? ''} ${updateType ?? ''} ${categoryFamily ?? ''}`.toLowerCase();
  if (/answer.?key/.test(tokens)) return 'answer_keys';
  if (/admit.?card/.test(tokens)) return 'admit_cards';
  if (/result/.test(tokens)) return 'results';
  if (/scholar|fellowship|certificate/.test(tokens)) return 'scholarships';
  if (/admission/.test(tokens)) return 'admissions';
  if (/exam.?date|exam.?schedule|date.?sheet|datesheet|calendar/.test(tokens)) return 'exam_dates';
  if (/job|recruit|vacanc|hiring|online.?form/.test(tokens)) return 'job_postings';
  if (/notification|notice/.test(tokens)) return 'other_updates';
  return 'other_updates';
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

function normForIdentity(v: string | null | undefined): string {
  return String(v ?? '').toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

function normalizeUrl(u: string | null | undefined): string {
  if (!u) return '';
  return String(u).trim().toLowerCase()
    .replace(/^https?:\/\/(www\.)?/, '')
    .replace(/[?#].*$/, '')
    .replace(/\/+$/, '');
}

async function sha256Hex(input: string): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const enc = new TextEncoder().encode(input);
    const buf = await crypto.subtle.digest('SHA-256', enc);
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  }
  // FNV-1a fallback
  let h = 0xcbf29ce484222325n;
  const FNV = 0x100000001b3n;
  for (let i = 0; i < input.length; i++) {
    h ^= BigInt(input.charCodeAt(i));
    h = (h * FNV) & 0xffffffffffffffffn;
  }
  return h.toString(16).padStart(16, '0').repeat(4).slice(0, 64);
}

async function buildIdentity(typed: Partial<MasterFileParsedRow>): Promise<string> {
  // Priority: slug → official_notice_link → official_apply_link → hash(update_type|publish_title|organization|reference_no|notification_date)
  if (typed.slug && typed.slug.trim()) return typed.slug.trim().toLowerCase();
  const notice = normalizeUrl(typed.official_notification_link);
  if (notice) return 'url:' + notice;
  const apply = normalizeUrl(typed.official_apply_link);
  if (apply) return 'url:' + apply;
  const seed = [
    typed.update_type ?? '',
    normForIdentity(typed.publish_title),
    normForIdentity(typed.organization_authority),
    typed.reference_no ?? '',
    typed.notification_date ?? '',
  ].join('|');
  const hex = await sha256Hex(seed);
  return 'hash:' + hex.slice(0, 32);
}

// ── Main parser ──

export async function parseMasterFileWorkbook(buffer: ArrayBuffer): Promise<MasterFileParseResult> {
  const wb = XLSX.read(buffer, { type: 'array', cellDates: false });
  const sheetNames = wb.SheetNames;
  if (sheetNames.length === 0) {
    return { ok: false, reason: 'Workbook has no sheets', sheet_used: null };
  }
  // Pick "Master-File" sheet (case-insensitive); fallback to first sheet
  const targetSheet =
    sheetNames.find(s => normHeader(s) === PREFERRED_SHEET) ??
    sheetNames.find(s => normHeader(s).startsWith('master_file')) ??
    sheetNames[0];

  const ws = wb.Sheets[targetSheet];
  const rawRows = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: null, raw: true });
  if (rawRows.length === 0) {
    return { ok: false, reason: `Sheet "${targetSheet}" is empty`, sheet_used: targetSheet };
  }

  // Build header → internal-field map from the first row's keys
  const detectedHeaders = Object.keys(rawRows[0]);
  const headerToField = new Map<string, string>();      // detected raw key → canonical internal field
  const unmappedHeaders: string[] = [];
  for (const raw of detectedHeaders) {
    const norm = normHeader(raw);
    if (HEADER_MAP[norm]) headerToField.set(raw, HEADER_MAP[norm]);
    else unmappedHeaders.push(raw);
  }

  const rows: MasterFileParsedRow[] = [];
  const failed: { row: number; reason: string }[] = [];
  let skippedEmpty = 0;

  for (let i = 0; i < rawRows.length; i++) {
    const raw = rawRows[i];
    const rowNum = i + 2; // 1-indexed header + 1
    try {
      // Build typed object from header map
      const typed: Record<string, any> = {};
      for (const [rawKey, field] of headerToField) {
        const cell = raw[rawKey];
        if (field === 'vacancy_count') {
          typed[field] = cleanInt(cell);
        } else if (field === 'application_mode') {
          typed[field] = mapApplicationMode(clean(cell));
        } else {
          typed[field] = clean(cell, LONG_TEXT_FIELDS.has(field));
        }
      }

      // Skip fully empty rows
      const allBlank = !typed.publish_title && !typed.organization_authority && !typed.row_prompt
        && !typed.official_apply_link && !typed.official_notification_link && !typed.official_reference_url;
      if (allBlank) { skippedEmpty++; continue; }

      // Lossless source_row_json — every original column, verbatim
      const source_row_json: Record<string, any> = {};
      for (const k of detectedHeaders) source_row_json[k] = raw[k] ?? null;

      // Identity
      const import_identity = await buildIdentity(typed);

      // Routing
      const section_bucket = rowTypeToBucket(typed.row_type ?? null, typed.update_type ?? null, typed.category_family ?? null);
      const content_type = SECTION_CONTENT_TYPE[section_bucket];
      const publish_target = SECTION_PUBLISH_TARGET[section_bucket];

      // Primary status
      const cs = (typed.content_status ?? '').toLowerCase();
      const ps = (typed.publish_status ?? '').toLowerCase();
      let primary_status: string;
      if (ps.includes('reject') || ps.includes('discard') || cs.includes('reject')) primary_status = 'reject';
      else if (ps.includes('publish') || cs.includes('ready') || cs.includes('publish')) primary_status = 'publish_ready';
      else primary_status = 'manual_check';

      const title = typed.publish_title ?? '';

      const out: MasterFileParsedRow = {
        // typed
        record_id: typed.record_id ?? null,
        category_family: typed.category_family ?? null,
        update_type: typed.update_type ?? null,
        row_type: typed.row_type ?? null,
        organization_authority: typed.organization_authority ?? null,
        publish_title: typed.publish_title ?? null,
        slug: typed.slug ?? null,
        seo_title: typed.seo_title ?? null,
        meta_description: typed.meta_description ?? null,
        summary: typed.summary ?? null,
        content_status: typed.content_status ?? null,
        reference_no: typed.reference_no ?? null,
        post_name: typed.post_name ?? null,
        vacancy_count: typed.vacancy_count ?? null,
        qualification_text: typed.qualification_text ?? null,
        application_mode: typed.application_mode ?? null,
        opening_date: typed.opening_date ?? null,
        closing_date: typed.closing_date ?? null,
        notification_date: typed.notification_date ?? null,
        exam_date: typed.exam_date ?? null,
        official_apply_link: typed.official_apply_link ?? null,
        official_website_link: typed.official_website_link ?? null,
        official_notification_link: typed.official_notification_link ?? null,
        official_reference_url: typed.official_reference_url ?? null,
        publish_status: typed.publish_status ?? null,
        verification_confidence: typed.verification_confidence ?? null,
        seo_primary_keyword: typed.seo_primary_keyword ?? null,
        seo_secondary_keywords: typed.seo_secondary_keywords ?? null,
        verification_notes: typed.verification_notes ?? null,
        row_prompt: typed.row_prompt ?? null,
        draft_heading_h1: typed.draft_heading_h1 ?? null,
        image_prompt: typed.image_prompt ?? null,
        image_alt_text: typed.image_alt_text ?? null,
        cta_label: typed.cta_label ?? null,
        cta_color: typed.cta_color ?? null,
        cta_url: typed.cta_url ?? null,

        source_row_json,

        section_bucket,
        content_type,
        publish_target,
        primary_status,
        import_identity,
        import_source_sheet: targetSheet,
        import_row_number: rowNum,

        // legacy mirrors
        raw_title: title,
        normalized_title: title,
        organisation_name: typed.organization_authority ?? null,
      };

      rows.push(out);
    } catch (err) {
      failed.push({ row: rowNum, reason: err instanceof Error ? err.message : String(err) });
    }
  }

  return {
    ok: true,
    rows,
    summary: {
      total_rows_found: rawRows.length,
      imported: rows.length,
      skipped_empty: skippedEmpty,
      failed,
      sheet_used: targetSheet,
      headers_detected: detectedHeaders.length,
      headers_mapped: headerToField.size,
      headers_preserved_raw_only: unmappedHeaders,
    },
  };
}

// ───────────────────────────────────────────────────────────────────────
// Back-compat shims — keep the existing Manager UI building while the
// new Master-File flow is wired in. These wrap parseMasterFileWorkbook
// and present the legacy ParseResult / ProductionParseResult shapes.
// TODO: remove once the Manager is migrated to MasterFileParseResult.
// ───────────────────────────────────────────────────────────────────────

export interface ParsedRow extends MasterFileParsedRow {
  structured_data_json: Record<string, any>;
  needs_review_reasons: string[];
  // legacy field shims used by the existing Manager UI; map from new fields where applicable
  exam_name?: string | null;
  result_date?: string | null;
  admit_card_date?: string | null;
  age_limit_text?: string | null;
  review_notes?: string | null;
}
export interface ParseResult {
  rows: ParsedRow[];
  summary: {
    total: number; imported: number; skipped: number; needsReview: number;
    duplicateSkipped: number; missingLinkCount: number;
    perSection: Record<string, number>;
    sheetsDetected: string[]; sheetsUsed: string[]; sheetsSkipped: string[];
  };
}
export interface ProductionParsedRow extends MasterFileParsedRow {
  structured_data_json: Record<string, any>;
  // legacy field shims for ChatGptAgentManager rendering
  official_website_url?: string | null;
  primary_cta_label?: string | null;
  primary_cta_url?: string | null;
  secondary_official_url?: string | null;
  verification_status?: string | null;
  official_source_used?: string | null;
  source_verified_on?: string | null;
  source_verified_on_date?: string | null;
  production_notes?: string | null;
}
export interface ProductionParseResult {
  ok: true;
  rows: ProductionParsedRow[];
  sheetUsed: string;
  summary: { total: number; parsed: number; skipped_empty: number };
}

function masterToProductionShape(r: MasterFileParsedRow): ProductionParsedRow {
  return {
    ...r,
    structured_data_json: { ...r.source_row_json, _format: 'master_file_v1' },
    official_website_url: r.official_website_link,
    primary_cta_label: r.cta_label,
    primary_cta_url: r.cta_url,
    secondary_official_url: r.official_reference_url,
    verification_status: null,
    official_source_used: null,
    source_verified_on: null,
    source_verified_on_date: null,
    production_notes: null,
  };
}

/** Shim: always treat any workbook as Master-File format. */
export function detectProductionFormat(_buffer: ArrayBuffer): boolean { return true; }

/** Shim: return Master-File parse in the legacy ProductionParseResult shape. */
export async function parseProductionExcelWorkbook(
  buffer: ArrayBuffer,
): Promise<ProductionParseResult | { ok: false; reason: string; detected: string[]; missing: string[]; sheetUsed: string | null }> {
  const r = await parseMasterFileWorkbook(buffer);
  if (r.ok !== true) {
    return { ok: false, reason: r.reason, detected: [], missing: [], sheetUsed: r.sheet_used };
  }
  return {
    ok: true,
    rows: r.rows.map(masterToProductionShape),
    sheetUsed: r.summary.sheet_used,
    summary: {
      total: r.summary.total_rows_found,
      parsed: r.summary.imported,
      skipped_empty: r.summary.skipped_empty,
    },
  };
}

/** Shim: legacy ParseResult — never used now (Master-File always detected). */
export function parseExcelWorkbook(_buffer: ArrayBuffer): ParseResult {
  return {
    rows: [],
    summary: {
      total: 0, imported: 0, skipped: 0, needsReview: 0,
      duplicateSkipped: 0, missingLinkCount: 0,
      perSection: {}, sheetsDetected: [], sheetsUsed: [], sheetsSkipped: [],
    },
  };
}
