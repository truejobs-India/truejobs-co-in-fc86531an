/**
 * ChatGPT Agent Excel Parser — Pure utility, no DB operations.
 * Parses uploaded Excel workbook and returns normalized rows with section routing.
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
