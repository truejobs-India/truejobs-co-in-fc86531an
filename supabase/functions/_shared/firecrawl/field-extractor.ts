/**
 * Source 3: Field extractor for single_recruitment pages.
 * Extracts structured job fields from cleaned markdown using regex patterns.
 * Purely rule-based — no AI, no guessing. Returns null for unknown fields.
 */

export interface ExtractedJobFields {
  title: string | null;
  normalized_title: string | null;
  organization_name: string | null;
  post_name: string | null;
  job_role: string | null;
  category: string | null;
  department: string | null;
  location: string | null;
  city: string | null;
  state: string | null;
  total_vacancies: number | null;
  application_mode: string | null;
  qualification: string | null;
  age_limit: string | null;
  application_fee: string | null;
  salary: string | null;
  pay_scale: string | null;
  opening_date: string | null;
  closing_date: string | null;
  last_date_of_application: string | null;
  exam_date: string | null;
  selection_process: string | null;
  official_notification_url: string | null;
  official_apply_url: string | null;
  official_website_url: string | null;
  canonical_url: string | null;
  description_summary: string | null;
}

export interface ExtractionResult {
  fields: ExtractedJobFields;
  raw_fields: Record<string, string>;
  confidence: 'high' | 'medium' | 'low' | 'none';
  fields_extracted: number;
  fields_missing: string[];
  warnings: string[];
}

// ============ Indian states for location extraction ============

const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand',
  'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur',
  'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab',
  'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura',
  'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Delhi', 'Chandigarh', 'Jammu and Kashmir', 'Ladakh',
  'Puducherry', 'Lakshadweep', 'Andaman and Nicobar',
];

const INDIAN_CITIES = [
  'New Delhi', 'Mumbai', 'Kolkata', 'Chennai', 'Bengaluru', 'Bangalore',
  'Hyderabad', 'Ahmedabad', 'Pune', 'Jaipur', 'Lucknow', 'Kanpur',
  'Nagpur', 'Indore', 'Thane', 'Bhopal', 'Patna', 'Vadodara',
  'Ghaziabad', 'Ludhiana', 'Agra', 'Nashik', 'Ranchi', 'Faridabad',
  'Meerut', 'Rajkot', 'Varanasi', 'Srinagar', 'Chandigarh',
  'Thiruvananthapuram', 'Coimbatore', 'Visakhapatnam', 'Bhubaneswar',
  'Dehradun', 'Shimla', 'Raipur', 'Guwahati', 'Noida', 'Gurugram',
];

// ============ Field extraction patterns ============

/** Values that are table artifacts / noise, never valid field values */
const GARBAGE_VALUES = new Set([
  'total', 'na', 'n/a', 'nil', 'details', 'see below', 'check below',
  'various', 'mentioned below', 'as per rules', 'click here', 'view',
  'download', 'apply now', 'apply online', 'register',
]);

/** Values that are table column headers, never valid extracted values */
const TABLE_HEADER_NOISE = new Set([
  'pay level', 'distance required', 'relaxation (years)', 'age relaxation',
  'application fee', 'category', 'general', 'obc', 'sc', 'st', 'ews',
  'sl no', 'sr no', 'serial number', 's.no',
]);

function isGarbageValue(val: string): boolean {
  const lower = val.toLowerCase().trim();
  if (GARBAGE_VALUES.has(lower)) return true;
  if (TABLE_HEADER_NOISE.has(lower)) return true;
  // Pure numbers without context
  if (/^\d{1,2}$/.test(lower)) return true;
  return false;
}

/**
 * Clean extracted value — strip markdown artifacts, pipe chars, and validate.
 */
function cleanExtractedValue(val: string): string | null {
  let cleaned = val
    .replace(/^\|+\s*/, '')      // leading pipe chars from table
    .replace(/\s*\|+$/, '')      // trailing pipe chars
    .replace(/\*+/g, '')         // bold markers
    .replace(/<br\s*\/?>/gi, ', ') // HTML breaks
    .trim();
  
  if (!cleaned || cleaned.length <= 1 || cleaned.length >= 500) return null;
  if (isGarbageValue(cleaned)) return null;
  return cleaned;
}

/**
 * Extract a field value using multiple label patterns.
 * Looks for "Label: Value" or "Label – Value" patterns on a single line.
 */
function extractLabeled(text: string, labels: string[]): string | null {
  for (const label of labels) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // Pattern 1: "Label" followed by : or – or - or | then value (rest of line)
    const re = new RegExp(`(?:^|\\n)\\s*\\**${escaped}\\**\\s*[:–\\-|]\\s*(.+?)\\s*$`, 'im');
    const match = text.match(re);
    if (match && match[1]) {
      const val = cleanExtractedValue(match[1]);
      if (val) return val;
    }

    // Pattern 2: Markdown table row "| Label | Value |"
    const tableRe = new RegExp(`\\|\\s*\\**${escaped}\\**\\s*\\|\\s*(.+?)\\s*\\|`, 'im');
    const tableMatch = text.match(tableRe);
    if (tableMatch && tableMatch[1]) {
      const val = cleanExtractedValue(tableMatch[1]);
      if (val) return val;
    }
  }
  return null;
}

/**
 * Extract a number (total vacancies, posts) from labeled field
 */
function extractNumber(text: string, labels: string[]): number | null {
  const raw = extractLabeled(text, labels);
  if (!raw) return null;
  // Find first number in the value
  const numMatch = raw.match(/(\d[\d,]*)/);
  if (numMatch) {
    const num = parseInt(numMatch[1].replace(/,/g, ''), 10);
    if (!isNaN(num) && num > 0 && num < 1_000_000) return num;
  }
  return null;
}

/**
 * Extract a date string from labeled field
 */
function extractDate(text: string, labels: string[]): string | null {
  const raw = extractLabeled(text, labels);
  if (!raw) return null;
  // Return as-is (don't try to parse, keep human-readable format)
  // But validate it looks date-like
  if (/\d{1,4}/.test(raw) && raw.length < 100) return raw;
  return null;
}

// ============ Title extraction ============

function extractTitle(text: string, pageTitle?: string | null): string | null {
  // Try first heading in markdown
  const h1Match = text.match(/^#\s+(.+?)$/m);
  if (h1Match) {
    const title = h1Match[1].replace(/\*+/g, '').trim();
    if (title.length > 10 && title.length < 300) return title;
  }

  // Try h2
  const h2Match = text.match(/^##\s+(.+?)$/m);
  if (h2Match) {
    const title = h2Match[1].replace(/\*+/g, '').trim();
    if (title.length > 10 && title.length < 300) return title;
  }

  // Fall back to page title
  if (pageTitle && pageTitle.length > 5) {
    // Remove common suffixes like " - SiteName"
    return pageTitle.replace(/\s*[-|–]\s*[^-|–]+$/, '').trim() || pageTitle;
  }

  return null;
}

function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/\b(recruitment|notification|advt|advertisement|bharti)\b/g, '')
    .replace(/\b\d{4}\b/g, '') // remove years
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ============ Organization extraction ============

function extractOrganization(text: string): string | null {
  const labels = [
    'Organization', 'Organisation', 'Org Name', 'Department',
    'Ministry', 'Board', 'Commission', 'Corporation',
    'Recruitment Board', 'Employer', 'Company',
    'Name of Organization', 'Name of Organisation',
    'Name of the Organization', 'Name of the Organisation',
    'Recruiting Organization', 'Recruiting Body',
  ];
  return extractLabeled(text, labels);
}

// ============ Location extraction ============

function extractState(text: string): string | null {
  // Try labeled extraction first
  const labeled = extractLabeled(text, ['State', 'State/UT', 'Location State']);
  if (labeled) {
    const found = INDIAN_STATES.find(s => labeled.toLowerCase().includes(s.toLowerCase()));
    if (found) return found;
    return labeled;
  }

  // Limit scan to first 40% of text to avoid sidebar/nav contamination
  const scanLength = Math.min(text.length, Math.max(2000, Math.floor(text.length * 0.4)));
  const scanText = text.substring(0, scanLength);
  
  // Scan limited text for state names, prefer word-boundary matches
  for (const state of INDIAN_STATES) {
    const stateRe = new RegExp(`\\b${state}\\b`, 'i');
    if (stateRe.test(scanText)) return state;
  }
  return null;
}

function extractCity(text: string): string | null {
  const labeled = extractLabeled(text, ['City', 'Location', 'Place', 'Job Location', 'Posting Place']);
  if (labeled) {
    const found = INDIAN_CITIES.find(c => labeled.toLowerCase().includes(c.toLowerCase()));
    if (found) return found;
    if (labeled.length < 50) return labeled;
  }

  // Scan text for city names
  for (const city of INDIAN_CITIES) {
    if (text.includes(city)) return city;
  }
  return null;
}

// ============ URL extraction from links ============

interface LinkInfo { text: string; url: string; context: string }

/** Aggregator domains that must NEVER appear as official links */
const AGGREGATOR_DOMAINS = [
  'sarkariexam.com', 'sarkarinaukri.com', 'indgovtjobs.in',
  'allgovernmentjobs.in', 'mysarkarinaukri.com', 'govtjobguru.in',
  'sarkarinaukriblog.com', 'freshersnow.com', 'careerpower.in',
  'sharmajobs.com', 'sarkaridisha.com', 'recruitment.guru',
  'sarkariresult.com', 'freejobalert.com', 'jagranjosh.com',
  'adda247.com', 'testbook.com', 'gradeup.co', 'byjus.com',
  'embibe.com', 'prepp.in', 'safalta.com', 'rojgarresult.in',
  'naukri.com', 'naukriday.com',
];

function isAggregatorDomain(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return AGGREGATOR_DOMAINS.some(d => hostname === d || hostname.endsWith('.' + d));
  } catch { return false; }
}

/** Deep-path indicators that score higher (exact page vs homepage) */
const DEEP_PATH_KEYWORDS = [
  '/recruitment', '/notification', '/advt', '/advertisement',
  '/career', '/vacancy', '/pdf', '/circular', '/apply',
  '/registration', '/application', '/admit', '/result',
];

/**
 * Score and rank official URL candidates, return the best match.
 * Scoring: +3 deep path, +2 keyword match in text, +1 keyword in URL,
 *          -10 aggregator domain, -2 root/homepage-only URL
 */
function findBestOfficialUrl(links: LinkInfo[], keywords: string[]): string | null {
  const scored: { url: string; score: number }[] = [];

  for (const link of links) {
    const lower = link.url.toLowerCase();
    const textLower = link.text.toLowerCase();

    // Must be an official-looking domain
    const isOfficial = lower.includes('.gov.') || lower.includes('.nic.') ||
      lower.includes('.org.in') || lower.includes('.ac.in');
    if (!isOfficial) continue;

    // Block aggregator domains at rule-based layer
    if (isAggregatorDomain(link.url)) continue;

    let score = 0;

    // Keyword match in link text
    if (keywords.some(k => textLower.includes(k))) score += 2;
    // Keyword match in URL path
    if (keywords.some(k => lower.includes(k))) score += 1;

    // Deep path bonus (not just a homepage)
    const hasDeepPath = DEEP_PATH_KEYWORDS.some(p => lower.includes(p));
    if (hasDeepPath) score += 3;

    // Penalize root/homepage-only URLs
    try {
      const parsed = new URL(link.url);
      if (parsed.pathname === '/' || parsed.pathname === '') score -= 2;
    } catch { /* ignore */ }

    // Only include if there's at least some relevance
    if (score > 0 || keywords.length === 0) {
      scored.push({ url: link.url, score });
    }
  }

  if (scored.length === 0) return null;

  // Sort descending by score, return best
  scored.sort((a, b) => b.score - a.score);
  return scored[0].url;
}

// ============ Description summary reconstruction ============

function buildDescriptionSummary(fields: Partial<ExtractedJobFields>): string | null {
  const parts: string[] = [];

  if (fields.organization_name) {
    parts.push(`${fields.organization_name} has released a recruitment notification`);
    if (fields.post_name) parts[parts.length - 1] += ` for the post of ${fields.post_name}`;
    parts[parts.length - 1] += '.';
  } else if (fields.post_name) {
    parts.push(`Recruitment notification for ${fields.post_name}.`);
  } else if (fields.title) {
    parts.push(`${fields.title}.`);
  } else {
    return null;
  }

  if (fields.total_vacancies) {
    parts.push(`Total vacancies: ${fields.total_vacancies}.`);
  }

  if (fields.qualification) {
    parts.push(`Qualification: ${fields.qualification}.`);
  }

  if (fields.last_date_of_application || fields.closing_date) {
    parts.push(`Last date to apply: ${fields.last_date_of_application || fields.closing_date}.`);
  }

  if (fields.application_mode) {
    parts.push(`Application mode: ${fields.application_mode}.`);
  }

  return parts.join(' ');
}

// ============ Main extraction function ============

const IMPORTANT_FIELDS: (keyof ExtractedJobFields)[] = [
  'title', 'organization_name', 'post_name', 'total_vacancies',
  'qualification', 'last_date_of_application', 'application_mode',
];

/**
 * Extract structured fields from cleaned markdown text.
 * Returns extracted fields, confidence score, and missing fields list.
 */
export function extractFields(
  cleanedText: string,
  links: LinkInfo[],
  pageTitle?: string | null,
  sourceUrl?: string | null
): ExtractionResult {
  const warnings: string[] = [];
  const raw_fields: Record<string, string> = {};

  // Extract each field
  const title = extractTitle(cleanedText, pageTitle);
  if (title) raw_fields['title'] = title;

  const organization_name = extractOrganization(cleanedText);
  if (organization_name) raw_fields['organization_name'] = organization_name;

  const post_name = extractLabeled(cleanedText, [
    'Post Name', 'Post', 'Name of Post', 'Name of the Post',
    'Designation', 'Job Title', 'Job Role', 'Position',
  ]);
  if (post_name) raw_fields['post_name'] = post_name;

  const job_role = extractLabeled(cleanedText, ['Job Role', 'Role', 'Position']);
  if (job_role) raw_fields['job_role'] = job_role;

  const category = extractLabeled(cleanedText, [
    'Category', 'Job Category', 'Job Type', 'Type',
  ]);

  const department = extractLabeled(cleanedText, [
    'Department', 'Dept', 'Ministry', 'Division',
  ]);
  if (department) raw_fields['department'] = department;

  const state = extractState(cleanedText);
  const city = extractCity(cleanedText);
  const location = extractLabeled(cleanedText, [
    'Location', 'Job Location', 'Place of Posting', 'Place',
  ]) || (city && state ? `${city}, ${state}` : city || state);

  const total_vacancies = extractNumber(cleanedText, [
    'Total Vacancies', 'Total Posts', 'Total Post', 'No. of Posts',
    'No. of Vacancies', 'Number of Vacancies', 'Number of Posts',
    'Vacancies', 'Posts', 'Total Seats', 'No of Vacancy',
  ]);
  if (total_vacancies) raw_fields['total_vacancies'] = String(total_vacancies);

  const application_mode = extractLabeled(cleanedText, [
    'Application Mode', 'Mode of Application', 'How to Apply',
    'Apply Mode', 'Apply Through',
  ]);

  const qualification = extractLabeled(cleanedText, [
    'Qualification', 'Educational Qualification', 'Education',
    'Eligibility', 'Required Qualification', 'Minimum Qualification',
    'Academic Qualification', 'Qualification Required',
  ]);
  if (qualification) raw_fields['qualification'] = qualification;

  const age_limit = extractLabeled(cleanedText, [
    'Age Limit', 'Age', 'Maximum Age', 'Min Age', 'Age Criteria',
    'Age Requirement', 'Upper Age Limit',
  ]);

  const application_fee = extractLabeled(cleanedText, [
    'Application Fee', 'Fee', 'Exam Fee', 'Registration Fee',
    'Application Fees', 'Fee Details',
  ]);

  const salary = extractLabeled(cleanedText, [
    'Salary', 'Pay', 'Remuneration', 'Stipend', 'CTC',
    'Monthly Salary', 'Salary Range',
  ]);

  const pay_scale = extractLabeled(cleanedText, [
    'Pay Scale', 'Pay Band', 'Pay Level', 'Pay Matrix',
    'Grade Pay', 'Level',
  ]);

  const opening_date = extractDate(cleanedText, [
    'Starting Date', 'Start Date', 'Opening Date',
    'Application Start Date', 'Registration Start',
    'Apply Start Date',
  ]);

  const closing_date = extractDate(cleanedText, [
    'Closing Date', 'End Date', 'Application End Date',
    'Registration End', 'Apply End Date',
  ]);

  const last_date = extractDate(cleanedText, [
    'Last Date', 'Last Date to Apply', 'Last Date of Application',
    'Last Date for Apply', 'Last Date of Apply',
    'Last Date of Submission', 'Deadline',
  ]);

  const exam_date = extractDate(cleanedText, [
    'Exam Date', 'Date of Exam', 'Examination Date',
    'Written Exam Date', 'Test Date',
  ]);

  const selection_process = extractLabeled(cleanedText, [
    'Selection Process', 'Selection Procedure', 'Selection Criteria',
    'Selection Method', 'Mode of Selection',
  ]);

  // URL extraction from links
  const official_notification_url = findBestOfficialUrl(links, ['notification', 'advt', 'advertisement', 'pdf']);
  const official_apply_url = findBestOfficialUrl(links, ['apply', 'registration', 'application', 'recruit']);
  const official_website_url = findBestOfficialUrl(links, ['official', 'website', 'home']);

  const fields: ExtractedJobFields = {
    title,
    normalized_title: title ? normalizeTitle(title) : null,
    organization_name,
    post_name,
    job_role: job_role || post_name, // fallback
    category,
    department,
    location,
    city,
    state,
    total_vacancies,
    application_mode,
    qualification,
    age_limit,
    application_fee,
    salary,
    pay_scale,
    opening_date,
    closing_date,
    last_date_of_application: last_date || closing_date,
    exam_date,
    selection_process,
    official_notification_url,
    official_apply_url,
    official_website_url,
    canonical_url: sourceUrl || null,
    description_summary: null, // set below
  };

  // Build summary from fields (field-first, not from prose)
  fields.description_summary = buildDescriptionSummary(fields);

  // Calculate extraction quality
  const allFieldKeys = Object.keys(fields) as (keyof ExtractedJobFields)[];
  const extracted = allFieldKeys.filter(k => fields[k] !== null && fields[k] !== undefined);
  const missing = allFieldKeys.filter(k => fields[k] === null || fields[k] === undefined);

  const importantExtracted = IMPORTANT_FIELDS.filter(k => fields[k] !== null && fields[k] !== undefined);
  const importantMissing = IMPORTANT_FIELDS.filter(k => fields[k] === null || fields[k] === undefined);

  let confidence: ExtractionResult['confidence'];
  if (importantExtracted.length >= 5) confidence = 'high';
  else if (importantExtracted.length >= 3) confidence = 'medium';
  else if (importantExtracted.length >= 1) confidence = 'low';
  else confidence = 'none';

  if (importantMissing.length > 0) {
    warnings.push(`Missing important fields: ${importantMissing.join(', ')}`);
  }

  if (!title) warnings.push('Could not extract page title');
  if (!organization_name && !department) warnings.push('No organization or department identified');

  return {
    fields,
    raw_fields,
    confidence,
    fields_extracted: extracted.length,
    fields_missing: missing,
    warnings,
  };
}
