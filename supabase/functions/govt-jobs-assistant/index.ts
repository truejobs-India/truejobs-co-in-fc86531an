import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// ═══════════════════════════════════════════════════════════════
// AWS SigV4 Helpers (for Mistral via Bedrock)
// ═══════════════════════════════════════════════════════════════
async function hmacSha256B(key: ArrayBuffer | Uint8Array, data: string): Promise<ArrayBuffer> {
  const enc = new TextEncoder();
  const ck = await crypto.subtle.importKey('raw', key instanceof Uint8Array ? key : new Uint8Array(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return crypto.subtle.sign('HMAC', ck, enc.encode(data));
}
async function sha256Hex(data: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}
async function awsSigV4Fetch(host: string, rawPath: string, body: string, region: string, service: string): Promise<Response> {
  const ak = Deno.env.get('AWS_ACCESS_KEY_ID');
  const sk = Deno.env.get('AWS_SECRET_ACCESS_KEY');
  if (!ak || !sk) throw new Error('AWS credentials not configured');

  const encodedUri = '/' + rawPath.split('/').filter(Boolean).map(s => encodeURIComponent(s)).join('/');
  const canonicalUri = '/' + rawPath.split('/').filter(Boolean).map(s => encodeURIComponent(encodeURIComponent(s))).join('/');

  const now = new Date();
  const dateStamp = now.toISOString().replace(/[:-]|\.\d{3}/g, '').slice(0, 8);
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '').slice(0, 15) + 'Z';
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const payloadHash = await sha256Hex(body);
  const canonicalHeaders = `content-type:application/json\nhost:${host}\nx-amz-date:${amzDate}\n`;
  const signedHeaders = 'content-type;host;x-amz-date';
  const canonicalRequest = `POST\n${canonicalUri}\n\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;
  const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${credentialScope}\n${await sha256Hex(canonicalRequest)}`;

  const enc = new TextEncoder();
  let sigKey = await hmacSha256B(enc.encode(`AWS4${sk}`), dateStamp);
  sigKey = await hmacSha256B(sigKey, region);
  sigKey = await hmacSha256B(sigKey, service);
  sigKey = await hmacSha256B(sigKey, 'aws4_request');
  const sig = Array.from(new Uint8Array(await hmacSha256B(sigKey, stringToSign))).map(b => b.toString(16).padStart(2, '0')).join('');

  return fetch(`https://${host}${encodedUri}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Amz-Date': amzDate,
      Authorization: `AWS4-HMAC-SHA256 Credential=${ak}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${sig}`,
    },
    body,
  });
}

// ═══════════════════════════════════════════════════════════════
// Rate Limiting (best-effort in-memory — serverless caveat)
// ═══════════════════════════════════════════════════════════════
const sessionMessageCounts = new Map<string, { count: number; timestamps: number[]; refusals: number; cooldownUntil: number }>();
const ipHourCounts = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(sessionId: string, ipHash: string): string | null {
  const now = Date.now();
  // Cleanup old entries every so often
  if (Math.random() < 0.05) {
    for (const [k, v] of sessionMessageCounts) {
      if (v.timestamps.length > 0 && now - v.timestamps[v.timestamps.length - 1] > 3600000) sessionMessageCounts.delete(k);
    }
    for (const [k, v] of ipHourCounts) {
      if (now > v.resetAt) ipHourCounts.delete(k);
    }
  }

  // Session checks
  let session = sessionMessageCounts.get(sessionId);
  if (!session) {
    session = { count: 0, timestamps: [], refusals: 0, cooldownUntil: 0 };
    sessionMessageCounts.set(sessionId, session);
  }
  if (now < session.cooldownUntil) return 'cooldown';
  if (session.count >= 30) return 'session_limit';
  // Per-minute: max 5
  const oneMinAgo = now - 60000;
  session.timestamps = session.timestamps.filter(t => t > oneMinAgo);
  if (session.timestamps.length >= 5) return 'rate_limit';

  // IP check: 60/hour
  let ip = ipHourCounts.get(ipHash);
  if (!ip || now > ip.resetAt) {
    ip = { count: 0, resetAt: now + 3600000 };
    ipHourCounts.set(ipHash, ip);
  }
  if (ip.count >= 60) return 'ip_limit';

  // Record
  session.count++;
  session.timestamps.push(now);
  ip.count++;
  return null;
}

function recordRefusal(sessionId: string) {
  const session = sessionMessageCounts.get(sessionId);
  if (session) {
    session.refusals++;
    if (session.refusals >= 3) {
      session.cooldownUntil = Date.now() + 60000;
      session.refusals = 0;
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// Alias Map & Hindi-English Term Map
// ═══════════════════════════════════════════════════════════════
const EXAM_ALIASES: Record<string, string> = {
  'cgl': 'ssc cgl', 'chsl': 'ssc chsl', 'mts': 'ssc mts', 'gd': 'ssc gd', 'cpo': 'ssc cpo',
  'je': 'ssc je', 'stenographer': 'ssc stenographer',
  'एसएससी': 'ssc', 'एसएससी सीजीएल': 'ssc cgl', 'एसएससी सीएचएसएल': 'ssc chsl',
  'upsc': 'upsc', 'यूपीएससी': 'upsc', 'ias': 'upsc civil services', 'ips': 'upsc civil services',
  'nda': 'upsc nda', 'cds': 'upsc cds', 'capf': 'upsc capf',
  'rrb': 'rrb', 'railway': 'rrb', 'rrb ntpc': 'railway ntpc', 'ntpc': 'railway ntpc',
  'group d': 'rrb group d', 'railway group d': 'rrb group d', 'रेलवे': 'rrb',
  'alp': 'rrb alp', 'rrb alp': 'rrb alp',
  'ibps': 'ibps', 'ibps po': 'ibps po', 'ibps clerk': 'ibps clerk', 'ibps so': 'ibps so',
  'sbi': 'sbi', 'sbi po': 'sbi po', 'sbi clerk': 'sbi clerk',
  'lic': 'lic', 'lic aao': 'lic aao',
  'up police': 'up police', 'up si': 'up police sub inspector', 'यूपी पुलिस': 'up police',
  'bpsc': 'bihar psc', 'बीपीएससी': 'bihar psc', 'bihar psc': 'bihar psc',
  'uppsc': 'up psc', 'mppsc': 'mp psc', 'rpsc': 'rajasthan psc',
  'jpsc': 'jharkhand psc', 'wbpsc': 'west bengal psc', 'hppsc': 'himachal psc',
  'appsc': 'andhra pradesh psc', 'tspsc': 'telangana psc', 'kpsc': 'karnataka psc',
  'mpsc': 'maharashtra psc',
  'cat': 'cat', 'gate': 'gate', 'net': 'ugc net', 'ugc net': 'ugc net',
  'ctet': 'ctet', 'tet': 'tet', 'सीटेट': 'ctet',
  'drdo': 'drdo', 'isro': 'isro', 'barc': 'barc',
  'cisf': 'cisf', 'crpf': 'crpf', 'bsf': 'bsf', 'itbp': 'itbp', 'ssb': 'ssb',
  'fci': 'fci', 'epfo': 'epfo',
  'clat': 'clat', 'aiims': 'aiims', 'neet': 'neet', 'jee': 'jee',
  'defence': 'defence', 'army': 'indian army', 'navy': 'indian navy', 'air force': 'indian air force',
  'सेना': 'indian army', 'नौसेना': 'indian navy', 'वायु सेना': 'indian air force',
};

const HINDI_ENGLISH_TERMS: Record<string, string> = {
  'आयु सीमा': 'age limit', 'आयु': 'age', 'उम्र': 'age',
  'पात्रता': 'eligibility', 'योग्यता': 'qualification',
  'सिलेबस': 'syllabus', 'पाठ्यक्रम': 'syllabus',
  'एडमिट कार्ड': 'admit card', 'प्रवेश पत्र': 'admit card',
  'वेतन': 'salary', 'तनख्वाह': 'salary', 'वेतनमान': 'pay scale',
  'भर्ती': 'recruitment', 'नौकरी': 'job', 'नौकरियां': 'jobs', 'नौकरियाँ': 'jobs',
  'परीक्षा': 'exam', 'रिजल्ट': 'result', 'परिणाम': 'result',
  'तारीख': 'date', 'अंतिम तिथि': 'last date',
  'आवेदन': 'application', 'फॉर्म': 'form',
  'सरकारी': 'government', 'सरकारी नौकरी': 'government job',
  'केंद्र सरकार': 'central government', 'राज्य सरकार': 'state government',
  'चयन प्रक्रिया': 'selection process', 'कटऑफ': 'cutoff',
  'उत्तर कुंजी': 'answer key', 'अधिसूचना': 'notification',
  'रिक्ति': 'vacancy', 'रिक्तियां': 'vacancies', 'पद': 'post',
  'शैक्षिक': 'educational', 'शुल्क': 'fee', 'आवेदन शुल्क': 'application fee',
  'ऑनलाइन आवेदन': 'online application', 'कैसे आवेदन करें': 'how to apply',
  'पिछले वर्ष': 'previous year', 'मॉडल पेपर': 'model paper',
  'सैंपल पेपर': 'sample paper', 'प्रश्न पत्र': 'question paper',
};

const STOP_WORDS = new Set([
  'ka', 'ke', 'ki', 'me', 'hai', 'kya', 'kab', 'kaise', 'kahan', 'kaun', 'kitna', 'kitne',
  'the', 'in', 'for', 'of', 'is', 'a', 'an', 'and', 'or', 'to', 'with', 'on', 'at', 'by',
  'se', 'ko', 'ne', 'ye', 'wo', 'yeh', 'woh', 'aur', 'ya',
  'mein', 'par', 'tak', 'bhi', 'ho', 'hain', 'tha', 'thi', 'the',
]);

// ═══════════════════════════════════════════════════════════════
// Keyword Normalization & Intent Detection
// ═══════════════════════════════════════════════════════════════
function normalizeQuery(raw: string): { keywords: string[]; intent: string; language: string } {
  let text = raw.toLowerCase().trim();
  
  // Detect language
  const hindiChars = (text.match(/[\u0900-\u097F]/g) || []).length;
  const englishChars = (text.match(/[a-zA-Z]/g) || []).length;
  let language = 'en';
  if (hindiChars > 0 && englishChars > 0) language = 'hinglish';
  else if (hindiChars > englishChars) language = 'hi';

  // Replace Hindi terms with English equivalents
  for (const [hindi, english] of Object.entries(HINDI_ENGLISH_TERMS)) {
    text = text.replace(new RegExp(hindi, 'gi'), english);
  }

  // Strip diacritics for romanized text
  text = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  // Tokenize
  let tokens = text.split(/[\s,\.\?!;:]+/).filter(t => t.length > 0);

  // Remove stop words
  tokens = tokens.filter(t => !STOP_WORDS.has(t));

  // Expand aliases — check multi-word first, then single
  const expanded: string[] = [];
  let i = 0;
  while (i < tokens.length) {
    // Try 3-gram, 2-gram, then 1-gram
    let matched = false;
    for (const n of [3, 2]) {
      if (i + n <= tokens.length) {
        const ngram = tokens.slice(i, i + n).join(' ');
        if (EXAM_ALIASES[ngram]) {
          expanded.push(EXAM_ALIASES[ngram]);
          i += n;
          matched = true;
          break;
        }
      }
    }
    if (!matched) {
      const alias = EXAM_ALIASES[tokens[i]];
      expanded.push(alias || tokens[i]);
      i++;
    }
  }

  // Detect intent
  const allText = expanded.join(' ');
  let intent = 'general_info';
  if (/eligib|patrata|yogyata|qualification/.test(allText)) intent = 'eligibility';
  else if (/age.?limit|age|aayu/.test(allText)) intent = 'age_limit';
  else if (/admit.?card|hall.?ticket|pravesh.?patra/.test(allText)) intent = 'admit_card';
  else if (/result|parinam/.test(allText)) intent = 'result';
  else if (/syllabus|pathyakram|exam.?pattern/.test(allText)) intent = 'syllabus';
  else if (/salary|pay.?scale|vetan/.test(allText)) intent = 'salary';
  else if (/date|last.?date|deadline|tarikh/.test(allText)) intent = 'dates';
  else if (/how.?to.?apply|apply|online.?application|avedan/.test(allText)) intent = 'how_to_apply';
  else if (/answer.?key|uttar.?kunji/.test(allText)) intent = 'answer_key';
  else if (/cutoff|cut.?off/.test(allText)) intent = 'cutoff';
  else if (/job|vacancy|recruitment|bharti|naukri|post/.test(allText)) intent = 'job_search';

  // Deduplicate
  const unique = [...new Set(expanded)];

  return { keywords: unique, intent, language };
}

// ═══════════════════════════════════════════════════════════════
// Content Safety
// ═══════════════════════════════════════════════════════════════
const INJECTION_PATTERNS = [
  /ignore\s+(previous|above|all)\s+(instructions?|prompts?)/i,
  /system\s*:/i,
  /<\|/,
  /\[INST\]/i,
  /you\s+are\s+now/i,
  /act\s+as\s+(a\s+)?different/i,
  /override\s+(your|the)\s+(instructions?|rules?)/i,
  /forget\s+(everything|your|all)/i,
];

function sanitizeInput(text: string): string {
  let clean = text.slice(0, 500);
  for (const pattern of INJECTION_PATTERNS) {
    clean = clean.replace(pattern, '');
  }
  return clean.trim();
}

function isBlockedContent(text: string, blockedPhrases: string[]): boolean {
  const lower = text.toLowerCase();
  return blockedPhrases.some(p => lower.includes(p.toLowerCase()));
}

// Strip PII for analytics
function stripPII(text: string): string {
  let clean = text;
  clean = clean.replace(/\b\d{10,12}\b/g, '[PHONE]'); // phone numbers
  clean = clean.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL]'); // emails
  clean = clean.replace(/\b\d{4}\s?\d{4}\s?\d{4}\b/g, '[AADHAAR]'); // Aadhaar-like
  return clean;
}

// ═══════════════════════════════════════════════════════════════
// Retrieval Pipeline
// ═══════════════════════════════════════════════════════════════
interface RetrievedItem {
  title: string;
  slug: string;
  url: string;
  type: string;
  score: number;
  tablePriority: number;
  relevantFields: Record<string, unknown>;
}

async function retrieveContext(
  supabase: ReturnType<typeof createClient>,
  keywords: string[],
  intent: string
): Promise<{ items: RetrievedItem[]; status: string }> {
  if (keywords.length === 0) return { items: [], status: 'no_match' };

  const allItems: RetrievedItem[] = [];

  // Build ilike filters
  const buildFilter = (fields: string[]) => {
    const conditions: string[] = [];
    for (const kw of keywords) {
      for (const f of fields) {
        conditions.push(`${f}.ilike.%${kw}%`);
      }
    }
    return conditions.join(',');
  };

  // Helper to score a result
  const scoreResult = (row: Record<string, unknown>, titleField: string, tagFields: string[]): number => {
    let score = 0;
    const titleVal = String(row[titleField] || '').toLowerCase();
    
    for (const kw of keywords) {
      const kwLower = kw.toLowerCase();
      // Exact name match
      if (titleVal === kwLower || titleVal.includes(kwLower)) {
        score += titleVal === kwLower ? 40 : 25;
      }
      // Tags/keywords match
      for (const tf of tagFields) {
        const tagVal = row[tf];
        if (Array.isArray(tagVal) && tagVal.some((t: string) => String(t).toLowerCase().includes(kwLower))) {
          score += 15;
        } else if (typeof tagVal === 'string' && tagVal.toLowerCase().includes(kwLower)) {
          score += 15;
        }
      }
    }

    // Intent-field alignment bonus
    if (intent === 'age_limit' && row['age_limit']) score += 20;
    if (intent === 'eligibility' && (row['qualification_required'] || row['qualification'])) score += 20;
    if (intent === 'syllabus' && row['syllabus']) score += 20;
    if (intent === 'salary' && (row['salary_range'] || row['pay_scale'] || row['salary'])) score += 20;
    if (intent === 'dates' && (row['application_start'] || row['application_end'] || row['exam_date'] || row['last_date'])) score += 20;
    if (intent === 'admit_card' && row['admit_card_date']) score += 20;
    if (intent === 'result' && row['result_date']) score += 20;
    if (intent === 'how_to_apply' && (row['how_to_apply'] || row['apply_link'])) score += 20;

    return Math.min(score, 100);
  };

  try {
    // 1. govt_exams (priority 0)
    const orFilter = buildFilter(['exam_name', 'conducting_body', 'qualification_required']);
    const { data: exams } = await supabase
      .from('govt_exams')
      .select('id, exam_name, slug, conducting_body, states, qualification_required, age_limit, salary_range, pay_scale, application_start, application_end, exam_date, admit_card_date, result_date, how_to_apply, apply_link, syllabus, seo_keywords, total_vacancies, status')
      .or(orFilter)
      .limit(10);

    if (exams) {
      for (const e of exams) {
        const score = scoreResult(e as Record<string, unknown>, 'exam_name', ['seo_keywords', 'states']);
        if (score > 0) {
          allItems.push({
            title: e.exam_name, slug: e.slug, url: `/sarkari-exam/${e.slug}`,
            type: 'govt_exam', score, tablePriority: 0,
            relevantFields: {
              age_limit: e.age_limit, qualification: e.qualification_required,
              salary_range: e.salary_range, pay_scale: e.pay_scale,
              application_start: e.application_start, application_end: e.application_end,
              exam_date: e.exam_date, admit_card_date: e.admit_card_date,
              result_date: e.result_date, total_vacancies: e.total_vacancies,
              how_to_apply: e.how_to_apply, status: e.status,
              syllabus: e.syllabus ? 'Available' : null,
            }
          });
        }
      }
    }

    // 2. govt_results (priority 1)
    const { data: results } = await supabase
      .from('govt_results')
      .select('id, result_title, exam_id, result_date, result_link, status, govt_exams!inner(slug, exam_name)')
      .or(buildFilter(['result_title']))
      .limit(5);

    if (results) {
      for (const r of results) {
        const examData = (r as any).govt_exams;
        const score = scoreResult(r as Record<string, unknown>, 'result_title', []);
        if (score > 0) {
          allItems.push({
            title: r.result_title, slug: examData?.slug || '', url: `/sarkari-result/${examData?.slug || ''}`,
            type: 'govt_result', score, tablePriority: 1,
            relevantFields: { result_date: r.result_date, status: r.status, exam_name: examData?.exam_name }
          });
        }
      }
    }

    // 3. govt_answer_keys (priority 2)
    const { data: answerKeys } = await supabase
      .from('govt_answer_keys')
      .select('id, title, exam_id, release_date, status, govt_exams!inner(slug, exam_name)')
      .or(buildFilter(['title']))
      .limit(5);

    if (answerKeys) {
      for (const ak of answerKeys) {
        const examData = (ak as any).govt_exams;
        const score = scoreResult(ak as Record<string, unknown>, 'title', []);
        if (score > 0) {
          allItems.push({
            title: ak.title, slug: examData?.slug || '', url: `/answer-key/${examData?.slug || ''}`,
            type: 'govt_answer_key', score, tablePriority: 2,
            relevantFields: { release_date: ak.release_date, status: ak.status, exam_name: examData?.exam_name }
          });
        }
      }
    }

    // 4. employment_news_jobs (priority 3)
    const { data: empJobs } = await supabase
      .from('employment_news_jobs')
      .select('id, org_name, post, qualification, state, keywords, enriched_title, slug, age_limit, salary, last_date, vacancies, application_mode')
      .eq('status', 'published')
      .or(buildFilter(['org_name', 'post', 'qualification', 'enriched_title']))
      .limit(10);

    if (empJobs) {
      for (const ej of empJobs) {
        const score = scoreResult(ej as Record<string, unknown>, 'enriched_title', ['keywords']);
        if (score > 0 && ej.slug) {
          allItems.push({
            title: ej.enriched_title || ej.post || ej.org_name || 'Job', slug: ej.slug,
            url: `/employment-news/${ej.slug}`, type: 'employment_news', score, tablePriority: 3,
            relevantFields: {
              org_name: ej.org_name, post: ej.post, qualification: ej.qualification,
              age_limit: ej.age_limit, salary: ej.salary, last_date: ej.last_date,
              vacancies: ej.vacancies, state: ej.state,
            }
          });
        }
      }
    }

    // 5. blog_posts (priority 4)
    const { data: blogs } = await supabase
      .from('blog_posts')
      .select('id, title, slug, category, tags, excerpt')
      .eq('is_published', true)
      .or(buildFilter(['title', 'category']))
      .limit(5);

    if (blogs) {
      for (const b of blogs) {
        const score = scoreResult(b as Record<string, unknown>, 'title', ['tags', 'category']);
        if (score > 0) {
          allItems.push({
            title: b.title, slug: b.slug, url: `/blog/${b.slug}`,
            type: 'blog_post', score, tablePriority: 4,
            relevantFields: { category: b.category, excerpt: b.excerpt }
          });
        }
      }
    }

    // 6. pdf_resources (priority 5)
    const { data: pdfs } = await supabase
      .from('pdf_resources')
      .select('id, title, slug, exam_name, category, subject, tags, resource_type')
      .eq('is_published', true)
      .or(buildFilter(['title', 'exam_name', 'category', 'subject']))
      .limit(5);

    if (pdfs) {
      for (const p of pdfs) {
        const score = scoreResult(p as Record<string, unknown>, 'title', ['tags', 'category', 'subject']);
        if (score > 0) {
          allItems.push({
            title: p.title, slug: p.slug, url: `/${p.resource_type}/${p.slug}`,
            type: 'pdf_resource', score, tablePriority: 5,
            relevantFields: { exam_name: p.exam_name, category: p.category, resource_type: p.resource_type }
          });
        }
      }
    }
  } catch (err) {
    console.error('Retrieval error:', err);
  }

  // Sort: score desc, then tablePriority asc (tie-break)
  allItems.sort((a, b) => b.score - a.score || a.tablePriority - b.tablePriority);

  const top10 = allItems.slice(0, 10);

  // Determine retrieval status
  if (top10.length === 0) return { items: [], status: 'no_match' };
  if (top10[0].score >= 50) return { items: top10, status: 'strong_match' };
  if (top10[0].score >= 20) return { items: top10, status: 'partial_match' };

  // Fallback: retry with individual keywords
  if (keywords.length > 1) {
    // Already tried combined; the results are what we have
  }

  return { items: top10.length > 0 ? top10 : [], status: top10.length > 0 ? 'partial_match' : 'no_match' };
}

// ═══════════════════════════════════════════════════════════════
// System Prompt Builder
// ═══════════════════════════════════════════════════════════════
function buildSystemPrompt(retrievedItems: RetrievedItem[], retrievalStatus: string, language: string): string {
  const pagesBlock = retrievedItems.length > 0
    ? retrievedItems.map(item => {
        const fields = Object.entries(item.relevantFields)
          .filter(([, v]) => v != null)
          .map(([k, v]) => `  ${k}: ${v}`)
          .join('\n');
        return `- [${item.title}](${item.url}) (type: ${item.type})\n${fields}`;
      }).join('\n\n')
    : 'NO MATCHING TRUEJOBS CONTENT FOUND';

  return `You are the TrueJobs Sarkari Jobs Assistant (सरकारी नौकरी सहायक), a specialized Government Jobs assistant for the TrueJobs platform (truejobs.co.in).

## YOUR ROLE
You ONLY help with government jobs (sarkari naukri), government exams, admit cards, results, syllabus, eligibility, and related topics in India.

## STRICT RULES
1. You are a GOVERNMENT JOBS assistant ONLY. If users ask about private sector jobs, IT companies, corporate hiring, or non-government career queries, politely say: "I specialize in government jobs and sarkari exams. For private job opportunities, you may explore other platforms. Is there anything about government jobs I can help with?"
2. NEVER fabricate URLs, page links, slugs, dates, vacancy counts, eligibility rules, or official processes.
3. You may ONLY reference URLs from the RETRIEVED_PAGES section below. Do NOT create, guess, or modify any URL.
4. Include a MAXIMUM of 3 links per response. Choose the most relevant ones.
5. If no relevant page exists on TrueJobs, say "This information is not yet available on TrueJobs" instead of inventing a link.

## SOURCE PRIORITY
1. If retrieved data matches the query well → answer from that data. Prefix with "Based on TrueJobs exam pages..." or "TrueJobs पर उपलब्ध जानकारी के अनुसार..."
2. If retrieved data partially matches → answer ONLY what is actually known from TrueJobs. Explicitly state what is missing: "TrueJobs has information about [X], but specific [Y] details are not yet available on the site." Do NOT fill gaps with invented specifics.
3. If no matching data found → clearly say: "I could not find specific information about this on TrueJobs." You may give cautious general guidance but NEVER invent specifics. Always add: "Please verify from the official notification."
4. If query is completely out of scope → politely redirect.

## RESPONSE FORMAT
For informational answers, use this structure:
**[Short Answer]** — 1-2 sentence direct answer

**Details:**
- Relevant bullet points from site data

**TrueJobs Resources:** (only from RETRIEVED_PAGES, max 3 links)
- [Page Title](url)

For greetings, navigation, or simple queries, respond naturally without this rigid structure.

## DISCLAIMER RULES
- Add disclaimer for: eligibility, age limits, dates, admit cards, results, application process, cutoff, vacancy counts.
- Match user's language: Hindi query → Hindi disclaimer, English → English.
- Hindi: "⚠️ कृपया आवेदन से पहले आधिकारिक अधिसूचना से पुष्टि करें।"
- English: "⚠️ Please verify from the official notification before applying."
- Skip disclaimers for greetings, navigation help, thank-you messages.

## LANGUAGE
Respond in the same language the user writes in (Hindi/English/Hinglish). If the user writes in Hindi, respond in Hindi.

## RETRIEVED_PAGES (retrieval status: ${retrievalStatus})
${pagesBlock}
`;
}

// ═══════════════════════════════════════════════════════════════
// Admin Config Cache
// ═══════════════════════════════════════════════════════════════
let cachedConfig: { enabled: boolean; blockedPhrases: string[]; fallbackMessage: Record<string, string> } | null = null;
let configCachedAt = 0;

async function getAdminConfig(supabase: ReturnType<typeof createClient>): Promise<typeof cachedConfig> {
  const now = Date.now();
  if (cachedConfig && now - configCachedAt < 60000) return cachedConfig;

  try {
    const { data } = await supabase
      .from('app_settings')
      .select('key, value')
      .in('key', ['chatbot_enabled', 'chatbot_blocked_phrases', 'chatbot_fallback_message']);

    const settings: Record<string, any> = {};
    if (data) {
      for (const row of data) {
        settings[row.key] = row.value;
      }
    }

    cachedConfig = {
      enabled: settings['chatbot_enabled']?.enabled !== false,
      blockedPhrases: settings['chatbot_blocked_phrases']?.phrases || [],
      fallbackMessage: settings['chatbot_fallback_message'] || { en: 'Sorry, I am unable to process your request right now.', hi: 'क्षमा करें, अभी आपका अनुरोध संसाधित नहीं हो पा रहा।' },
    };
    configCachedAt = now;
  } catch {
    if (!cachedConfig) {
      cachedConfig = {
        enabled: true,
        blockedPhrases: ['hack', 'cheat', 'bypass', 'inject', 'exploit'],
        fallbackMessage: { en: 'Sorry, I am unable to process your request right now.', hi: 'क्षमा करें, अभी आपका अनुरोध संसाधित नहीं हो पा रहा।' },
      };
    }
  }
  return cachedConfig;
}

// ═══════════════════════════════════════════════════════════════
// Main Handler
// ═══════════════════════════════════════════════════════════════
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  const headers = { ...corsHeaders, 'Content-Type': 'application/json' };

  try {
    const { message, sessionId, conversationHistory } = await req.json();

    if (!message || typeof message !== 'string') {
      return new Response(JSON.stringify({ error: 'Message is required' }), { status: 400, headers });
    }

    const sid = sessionId || 'anonymous';
    
    // IP hash for rate limiting
    const forwarded = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
    const ipRaw = forwarded.split(',')[0].trim();
    const ipHash = await sha256Hex(ipRaw);

    // Create service role client for retrieval
    const supabaseService = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Load admin config
    const config = await getAdminConfig(supabaseService);
    if (!config?.enabled) {
      return new Response(JSON.stringify({ response: config?.fallbackMessage?.en || 'Chatbot is currently disabled.' }), { headers });
    }

    // Rate limit check
    const rateLimitResult = checkRateLimit(sid, ipHash);
    if (rateLimitResult) {
      recordRefusal(sid);
      // Log refusal
      try {
        await supabaseService.rpc('log_chatbot_event', {
          p_session_id: sid, p_query_text: stripPII(message.slice(0, 200)),
          p_query_language: 'unknown', p_intent: 'unknown',
          p_retrieval_status: 'skipped', p_retrieval_count: 0,
          p_was_refused: true, p_refusal_reason: rateLimitResult,
          p_response_time_ms: Date.now() - startTime, p_ip_hash: ipHash,
        });
      } catch { /* best effort */ }

      const msg = rateLimitResult === 'session_limit'
        ? 'You have reached the maximum number of messages for this session. Please start a new session.'
        : 'Please wait a moment before sending another message.';
      return new Response(JSON.stringify({ response: msg }), { headers });
    }

    // Sanitize input
    const cleanMessage = sanitizeInput(message);
    if (!cleanMessage) {
      return new Response(JSON.stringify({ response: 'Please enter a valid question about government jobs.' }), { headers });
    }

    // Blocked content check
    if (isBlockedContent(cleanMessage, config.blockedPhrases)) {
      recordRefusal(sid);
      try {
        await supabaseService.rpc('log_chatbot_event', {
          p_session_id: sid, p_query_text: stripPII(cleanMessage.slice(0, 200)),
          p_query_language: 'unknown', p_intent: 'unknown',
          p_retrieval_status: 'skipped', p_retrieval_count: 0,
          p_was_refused: true, p_refusal_reason: 'blocked_content',
          p_response_time_ms: Date.now() - startTime, p_ip_hash: ipHash,
        });
      } catch { /* best effort */ }
      return new Response(JSON.stringify({ response: 'I cannot process that request. Please ask about government jobs, exams, or related topics.' }), { headers });
    }

    // Normalize and extract keywords
    const { keywords, intent, language } = normalizeQuery(cleanMessage);

    // Retrieval
    const { items: retrievedItems, status: retrievalStatus } = await retrieveContext(supabaseService, keywords, intent);

    // Build system prompt
    const systemPrompt = buildSystemPrompt(retrievedItems, retrievalStatus, language);

    // Build conversation messages for Bedrock Converse API
    // CRITICAL: Bedrock Mistral requires the conversation to START with a 'user' message
    // and alternate user/assistant roles. System prompt must be embedded in the first user message.
    const messages: Array<{ role: string; content: Array<{ text: string }> }> = [];

    // Add conversation history (last 6 messages max)
    if (Array.isArray(conversationHistory) && conversationHistory.length > 0) {
      const recentHistory = conversationHistory.slice(-6);
      for (const m of recentHistory) {
        const role = m.role === 'assistant' ? 'assistant' : 'user';
        messages.push({ role, content: [{ text: m.content.slice(0, 500) }] });
      }
    }

    // Ensure conversation starts with a user message — drop leading assistant messages
    while (messages.length > 0 && messages[0].role === 'assistant') {
      messages.shift();
    }

    // Ensure no consecutive same-role messages (Bedrock requires alternating roles)
    const cleaned: typeof messages = [];
    for (const msg of messages) {
      if (cleaned.length > 0 && cleaned[cleaned.length - 1].role === msg.role) {
        // Merge consecutive same-role messages
        cleaned[cleaned.length - 1].content[0].text += '\n' + msg.content[0].text;
      } else {
        cleaned.push(msg);
      }
    }

    // Add the current user message with system prompt embedded
    const currentUserMsg = systemPrompt + '\n\nUser question: ' + cleanMessage;
    if (cleaned.length > 0 && cleaned[cleaned.length - 1].role === 'user') {
      // Last message is user, we need to add assistant placeholder then our user message
      // Or just append to avoid consecutive user messages issue
      cleaned.push({ role: 'assistant', content: [{ text: 'I understand. Let me help you with your question.' }] });
    }
    cleaned.push({ role: 'user', content: [{ text: currentUserMsg }] });

    // Final safety: ensure first message is user
    if (cleaned.length > 0 && cleaned[0].role !== 'user') {
      cleaned.unshift({ role: 'user', content: [{ text: 'Hello' }] });
    }

    const finalMessages = cleaned;

    // Call Mistral Large via Bedrock (us-west-2 hardcoded — matching other edge functions)
    const region = 'us-west-2';
    const modelId = 'mistral.mistral-large-2407-v1:0';
    const bedrockHost = `bedrock-runtime.${region}.amazonaws.com`;
    const bedrockPath = `model/${modelId}/converse`;

    const bedrockBody = JSON.stringify({
      messages: finalMessages,
      inferenceConfig: {
        maxTokens: 1024,
        temperature: 0.3,
        topP: 0.9,
      },
    });

    let responseText = '';
    let retries = 0;
    const maxRetries = 1;

    while (retries <= maxRetries) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 60000);

        const bedrockResponse = await awsSigV4Fetch(bedrockHost, bedrockPath, bedrockBody, region, 'bedrock');
        clearTimeout(timeout);

        if (!bedrockResponse.ok) {
          const errText = await bedrockResponse.text();
          console.error(`Bedrock error (${bedrockResponse.status}):`, errText);
          if ((bedrockResponse.status === 429 || bedrockResponse.status >= 500) && retries < maxRetries) {
            retries++;
            await new Promise(r => setTimeout(r, 2000));
            continue;
          }
          throw new Error(`Bedrock API error: ${bedrockResponse.status}`);
        }

        const result = await bedrockResponse.json();
        responseText = result?.output?.message?.content?.[0]?.text || '';
        break;
      } catch (err) {
        if (retries < maxRetries) {
          retries++;
          await new Promise(r => setTimeout(r, 2000));
          continue;
        }
        throw err;
      }
    }

    if (!responseText) {
      const fallback = language === 'hi' ? config.fallbackMessage.hi : config.fallbackMessage.en;
      responseText = fallback || 'Sorry, I could not generate a response. Please try again.';
    }

    // Log analytics
    try {
      await supabaseService.rpc('log_chatbot_event', {
        p_session_id: sid, p_query_text: stripPII(cleanMessage.slice(0, 200)),
        p_query_language: language, p_intent: intent,
        p_retrieval_status: retrievalStatus, p_retrieval_count: retrievedItems.length,
        p_was_refused: false, p_refusal_reason: null,
        p_response_time_ms: Date.now() - startTime, p_ip_hash: ipHash,
      });
    } catch { /* best effort */ }

    return new Response(JSON.stringify({ response: responseText }), { headers });

  } catch (error) {
    console.error('Govt Jobs Assistant error:', error);
    return new Response(
      JSON.stringify({ response: 'Sorry, I encountered an error. Please try again in a moment.' }),
      { headers }
    );
  }
});
