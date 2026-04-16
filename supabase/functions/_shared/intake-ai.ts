/**
 * Shared helpers for intake AI processing.
 * Lifted verbatim from intake-ai-classify/index.ts so the new
 * intake-ai-pipeline function can reuse identical prompts, schema,
 * deterministic extraction and provider routing without changing
 * legacy behavior.
 */

const AI_GATEWAY = 'https://ai.gateway.lovable.dev/v1/chat/completions';
const DEFAULT_MODEL = 'google/gemini-3-flash-preview';
const MAX_RETRIES = 4;

export const GATEWAY_MODEL_MAP: Record<string, string> = {
  'gemini-flash': 'google/gemini-2.5-flash',
  'gemini-pro': 'google/gemini-2.5-pro',
  'gpt5': 'openai/gpt-5',
  'gpt5-mini': 'openai/gpt-5-mini',
  'lovable-gemini': 'google/gemini-3-flash-preview',
};

export const GEMINI_DIRECT_MODEL_MAP: Record<string, { geminiModel: string; timeoutMs: number }> = {
  'vertex-flash': { geminiModel: 'gemini-2.5-flash', timeoutMs: 90_000 },
  'vertex-pro': { geminiModel: 'gemini-2.5-pro', timeoutMs: 120_000 },
  'vertex-3.1-pro': { geminiModel: 'gemini-3.1-pro-preview', timeoutMs: 120_000 },
  'vertex-3-flash': { geminiModel: 'gemini-3-flash-preview', timeoutMs: 90_000 },
  'vertex-3.1-flash-lite': { geminiModel: 'gemini-3.1-flash-lite-preview', timeoutMs: 60_000 },
};

export const BEDROCK_MODELS = new Set(['nova-pro', 'nova-premier', 'nemotron-120b', 'mistral']);
export const AZURE_OPENAI_MODELS = new Set(['azure-gpt4o-mini', 'azure-gpt41-mini', 'azure-gpt5-mini']);
export const AZURE_DEEPSEEK_MODELS = new Set(['azure-deepseek-v3', 'azure-deepseek-r1']);

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }
export { sleep };

// ─── Deterministic Pre-Extraction (verbatim) ────────────────────────────────

export interface PreExtracted {
  advertisement_no?: string;
  reference_no?: string;
  application_mode?: string;
  official_website_link?: string;
  official_notification_link?: string;
  official_apply_link?: string;
  result_link?: string;
  notification_date?: string;
  [key: string]: string | undefined;
}

export function deterministicExtract(draft: any): PreExtracted {
  const result: PreExtracted = {};
  const title = (draft.raw_title || '') as string;
  const rawText = ((draft.raw_text || '') as string).slice(0, 5000);
  const sourceUrl = (draft.source_url || '') as string;
  const sourceDomain = (draft.source_domain || '') as string;
  const combined = `${title}\n${rawText}`;

  const advtPatterns = [
    /Advt\.?\s*No\.?\s*[:.]?\s*([\w\/-]+\d[\w\/-]*)/i,
    /Advertisement\s*No\.?\s*[:.]?\s*([\w\/-]+\d[\w\/-]*)/i,
    /No\.\s*([A-Z][\w.\/-]*\d[\w.\/-]*\/\d{4})/i,
    /Ref\.?\s*[:.]?\s*([\w\/-]+\d[\w\/-]*\/\d{4})/i,
    /Notification\s*No\.?\s*[:.]?\s*([\w\/-]+\d[\w\/-]*)/i,
  ];
  for (const pat of advtPatterns) {
    const m = combined.match(pat);
    if (m && m[1] && m[1].length >= 3 && m[1].length <= 50) {
      result.advertisement_no = m[1].trim();
      break;
    }
  }

  const refPatterns = [
    /Ref(?:erence)?\s*No\.?\s*[:.]?\s*([\w\/-]+\d[\w\/-]*)/i,
    /File\s*No\.?\s*[:.]?\s*([\w.\/-]+\d[\w.\/-]*)/i,
  ];
  if (!result.advertisement_no) {
    for (const pat of refPatterns) {
      const m = combined.match(pat);
      if (m && m[1] && m[1].length >= 3 && m[1].length <= 50) {
        result.reference_no = m[1].trim();
        break;
      }
    }
  }

  const urlDateMatch = sourceUrl.match(/\/(\d{4})\/(\d{1,2})\/(\d{1,2})\//);
  if (urlDateMatch) {
    const [, y, m, d] = urlDateMatch;
    const yr = parseInt(y), mo = parseInt(m), dy = parseInt(d);
    if (yr >= 2020 && yr <= 2030 && mo >= 1 && mo <= 12 && dy >= 1 && dy <= 31) {
      result.notification_date = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
  }

  const modePatterns: [RegExp, string][] = [
    [/\bapply\s+online\b/i, 'online'],
    [/\bonline\s+application\b/i, 'online'],
    [/\bwalk[\s-]?in\b/i, 'walk_in'],
    [/\boffline\s+application\b/i, 'offline'],
    [/\bapply\s+offline\b/i, 'offline'],
    [/\bsend\s+by\s+post\b/i, 'offline'],
    [/\bemail\s+application\b/i, 'email'],
    [/\bapply\s+(?:through|via)\s+email\b/i, 'email'],
  ];
  for (const [pat, mode] of modePatterns) {
    if (pat.test(combined)) {
      result.application_mode = mode;
      break;
    }
  }

  if (sourceDomain) {
    const parts = sourceDomain.split('.');
    const isTrusted = (
      (sourceDomain.endsWith('.gov.in') || sourceDomain.endsWith('.nic.in')) &&
      parts.length <= 3 &&
      !sourceDomain.startsWith('cdn.') &&
      !sourceDomain.startsWith('mail.') &&
      !sourceDomain.startsWith('www.') &&
      !/^\d+\.\d+\.\d+\.\d+$/.test(sourceDomain) &&
      sourceDomain !== 'localhost'
    );
    if (isTrusted) {
      result.official_website_link = `https://${sourceDomain}`;
    }
  }

  let structuredData: any = null;
  if (draft.structured_data_json) {
    try {
      structuredData = typeof draft.structured_data_json === 'string'
        ? JSON.parse(draft.structured_data_json)
        : draft.structured_data_json;
    } catch { /* ignore */ }
  }
  if (structuredData && typeof structuredData === 'object') {
    const linkMap: Record<string, string> = {
      applyLink: 'official_apply_link', apply_link: 'official_apply_link', apply_url: 'official_apply_link',
      notificationLink: 'official_notification_link', notification_link: 'official_notification_link', notification_url: 'official_notification_link',
      resultLink: 'result_link', result_link: 'result_link', result_url: 'result_link',
      websiteLink: 'official_website_link', website_link: 'official_website_link', website_url: 'official_website_link',
      officialLink: 'official_notification_link', official_link: 'official_notification_link',
    };
    for (const [srcKey, dstKey] of Object.entries(linkMap)) {
      const val = structuredData[srcKey];
      if (typeof val === 'string' && val.startsWith('http') && !result[dstKey]) {
        result[dstKey] = val;
      }
    }
  }

  return result;
}

// ─── AI Call (verbatim provider routing) ────────────────────────────────────

export async function callAI(
  apiKey: string,
  systemPrompt: string,
  userPrompt: string,
  toolDef: { name: string; description: string; parameters: Record<string, unknown> },
  aiModel?: string,
): Promise<any> {
  const modelKey = aiModel || '';

  const geminiDef = GEMINI_DIRECT_MODEL_MAP[modelKey];
  if (geminiDef) {
    const { callGeminiDirect } = await import('./gemini-direct.ts');
    const fullPrompt = `${systemPrompt}\n\n${userPrompt}\n\nReturn valid JSON matching this schema:\n${JSON.stringify(toolDef.parameters, null, 2)}`;
    const text = await callGeminiDirect(geminiDef.geminiModel, fullPrompt, geminiDef.timeoutMs);
    const m = text.match(/\{[\s\S]*\}/);
    if (m) return JSON.parse(m[0]);
    throw new Error('Gemini Direct API did not return valid JSON');
  }

  if (BEDROCK_MODELS.has(modelKey)) {
    const fullPrompt = `${systemPrompt}\n\n${userPrompt}\n\nReturn valid JSON matching this schema:\n${JSON.stringify(toolDef.parameters, null, 2)}`;
    if (modelKey === 'mistral') {
      const { awsSigV4Fetch } = await import('./bedrock-nova.ts');
      const region = Deno.env.get('AWS_REGION') || 'us-east-1';
      const host = `bedrock-runtime.${region}.amazonaws.com`;
      const payload = JSON.stringify({
        messages: [{ role: 'user', content: [{ text: fullPrompt }] }],
        inferenceConfig: { maxTokens: 8192, temperature: 0.3 },
      });
      const resp = await awsSigV4Fetch(host, `/model/us.mistral.mistral-large-2407-v1:0/converse`, payload, region, 'bedrock');
      if (!resp.ok) throw new Error(`Mistral error ${resp.status}`);
      const data = await resp.json();
      const resultText = data?.output?.message?.content?.[0]?.text || '';
      const m = resultText.match(/\{[\s\S]*\}/);
      if (m) return JSON.parse(m[0]);
      throw new Error('Mistral did not return valid JSON');
    } else {
      const { callBedrockNova } = await import('./bedrock-nova.ts');
      const text = await callBedrockNova(modelKey, fullPrompt, { maxTokens: 8192, temperature: 0.3 });
      const m = text.match(/\{[\s\S]*\}/);
      if (m) return JSON.parse(m[0]);
      throw new Error('Nova did not return valid JSON');
    }
  }

  if (AZURE_OPENAI_MODELS.has(modelKey)) {
    const fullPrompt = `${systemPrompt}\n\n${userPrompt}\n\nReturn valid JSON matching this schema:\n${JSON.stringify(toolDef.parameters, null, 2)}`;
    if (modelKey === 'azure-gpt41-mini') {
      const { callAzureGPT41Mini } = await import('./azure-openai.ts');
      const text = await callAzureGPT41Mini(fullPrompt, { maxTokens: 8192, temperature: 0.3 });
      const m = text.match(/\{[\s\S]*\}/);
      if (m) return JSON.parse(m[0]);
      throw new Error('Azure GPT-4.1 Mini did not return valid JSON');
    }
    if (modelKey === 'azure-gpt5-mini') {
      const { callAzureGPT5Mini } = await import('./azure-openai.ts');
      const text = await callAzureGPT5Mini(fullPrompt, { maxTokens: 8192, temperature: 0.3 });
      const m = text.match(/\{[\s\S]*\}/);
      if (m) return JSON.parse(m[0]);
      throw new Error('Azure GPT-5 Mini did not return valid JSON');
    }
    const { callAzureOpenAI } = await import('./azure-openai.ts');
    const text = await callAzureOpenAI(fullPrompt, { maxTokens: 8192, temperature: 0.3 });
    const m = text.match(/\{[\s\S]*\}/);
    if (m) return JSON.parse(m[0]);
    throw new Error('Azure OpenAI did not return valid JSON');
  }

  if (AZURE_DEEPSEEK_MODELS.has(modelKey)) {
    const fullPrompt = `${systemPrompt}\n\n${userPrompt}\n\nReturn valid JSON matching this schema:\n${JSON.stringify(toolDef.parameters, null, 2)}`;
    const { callAzureDeepSeek } = await import('./azure-deepseek.ts');
    const dsModel = modelKey === 'azure-deepseek-r1' ? 'DeepSeek-R1' as const : 'DeepSeek-V3.1' as const;
    const text = await callAzureDeepSeek(fullPrompt, { model: dsModel, maxTokens: 8192, temperature: 0.3 });
    const m = text.match(/\{[\s\S]*\}/);
    if (m) return JSON.parse(m[0]);
    throw new Error('Azure DeepSeek did not return valid JSON');
  }

  const gatewayModelId = GATEWAY_MODEL_MAP[modelKey] || DEFAULT_MODEL;
  const bodyPayload: any = {
    model: gatewayModelId,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    tools: [{ type: 'function', function: toolDef }],
    tool_choice: { type: 'function', function: { name: toolDef.name } },
  };

  let data: any = null;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const resp = await fetch(AI_GATEWAY, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(bodyPayload),
    });
    if (resp.ok) { data = await resp.json(); break; }
    const errText = await resp.text().catch(() => '');
    if (resp.status === 429 && attempt < MAX_RETRIES - 1) {
      await sleep(3000 * Math.pow(2, attempt));
      continue;
    }
    if (resp.status === 402) throw new Error('Credits exhausted');
    throw new Error(`AI error ${resp.status}: ${errText.substring(0, 300)}`);
  }
  if (!data) throw new Error('AI returned no data');

  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
  if (toolCall?.function?.arguments) return JSON.parse(toolCall.function.arguments);

  const content = data.choices?.[0]?.message?.content || '';
  const m = content.match(/\{[\s\S]*\}/);
  if (m) return JSON.parse(m[0]);
  throw new Error('AI did not return structured output');
}

// ─── Schemas & Prompts (verbatim) ───────────────────────────────────────────

export const CLASSIFICATION_TOOL = {
  name: 'classify_intake_draft',
  description: 'Classify a scraped record and extract structured fields for the Indian government jobs portal TrueJobs.co.in',
  parameters: {
    type: 'object',
    properties: {
      content_type: { type: 'string', enum: ['job', 'result', 'admit_card', 'answer_key', 'exam', 'notification', 'scholarship', 'certificate', 'marksheet', 'not_publishable'] },
      primary_status: { type: 'string', enum: ['publish_ready', 'manual_check', 'reject'] },
      publish_target: { type: 'string', enum: ['jobs', 'results', 'admit_cards', 'answer_keys', 'exams', 'notifications', 'scholarships', 'certificates', 'marksheets', 'none'] },
      confidence_score: { type: 'number' },
      classification_reason: { type: 'string' },
      secondary_tags: { type: 'array', items: { type: 'string' } },
      publish_blockers: { type: 'array', items: { type: 'string' } },
      normalized_title: { type: 'string' },
      seo_title: { type: 'string', description: 'SEO-optimized title under 60 chars' },
      slug: { type: 'string' },
      meta_description: { type: 'string', description: 'SEO meta description under 160 chars' },
      summary: { type: 'string' },
      organisation_name: { type: 'string' },
      department_name: { type: 'string' },
      ministry_name: { type: 'string' },
      post_name: { type: 'string' },
      exam_name: { type: 'string' },
      advertisement_no: { type: 'string' },
      reference_no: { type: 'string' },
      job_location: { type: 'string' },
      application_mode: { type: 'string', enum: ['online', 'offline', 'walk_in', 'email', 'unknown'] },
      notification_date: { type: 'string' },
      opening_date: { type: 'string' },
      closing_date: { type: 'string' },
      correction_last_date: { type: 'string' },
      exam_date: { type: 'string' },
      result_date: { type: 'string' },
      admit_card_date: { type: 'string' },
      answer_key_date: { type: 'string' },
      vacancy_count: { type: 'number' },
      qualification_text: { type: 'string' },
      age_limit_text: { type: 'string' },
      salary_text: { type: 'string' },
      application_fee_text: { type: 'string' },
      selection_process_text: { type: 'string' },
      how_to_apply_text: { type: 'string' },
      official_notification_link: { type: 'string' },
      official_apply_link: { type: 'string' },
      official_website_link: { type: 'string' },
      result_link: { type: 'string' },
      admit_card_link: { type: 'string' },
      answer_key_link: { type: 'string' },
      key_points: { type: 'array', items: { type: 'string' } },
      draft_content_html: { type: 'string' },
    },
    required: ['content_type', 'primary_status', 'publish_target', 'confidence_score', 'classification_reason', 'secondary_tags', 'publish_blockers'],
  },
};

export const SYSTEM_PROMPT = `You are an expert classifier for TrueJobs.co.in, an Indian government jobs portal.

Your task: Analyze scraped records and classify them accurately. Extract ALL available structured fields.

RULES:
1. NEVER invent facts not present in the evidence
2. If evidence is weak or ambiguous, use primary_status="manual_check"
3. If the record is junk, stale, duplicate-looking, or not useful for Indian job seekers, use primary_status="reject"
4. Only use primary_status="publish_ready" when the type is clear, title is usable, and evidence is reasonably strong
5. Extract all available structured fields from the evidence
6. Generate clean, SEO-friendly titles and slugs
7. Do NOT stuff keywords
8. Generate draft_content_html only from real extracted evidence
9. Add appropriate secondary_tags and publish_blockers

EXTRACTION RULES (CRITICAL):
10. You MUST attempt to fill EVERY field where evidence exists. Leaving a field empty when the evidence contains the answer is a failure.
11. Check the Original Import Payload carefully — it often contains structured fields the scraper already extracted (dates, links, org names, post names, vacancies, etc.)
12. Check Source HTML for links, dates, and structured data the plain text may have lost.
13. Extract dates in YYYY-MM-DD format when possible. If only month/year is available, use YYYY-MM-01.
14. Extract all official links you can find — notification PDF links, apply links, website links, result links.
15. If Pre-extracted Hints are provided, validate them against the evidence and use them if they appear correct.

CLASSIFICATION:
- "job" = recruitment, vacancy, apply online, posts, eligibility, age limit, selection process
- "result" = result, merit list, shortlisted candidates, final result
- "admit_card" = admit card, hall ticket, call letter
- "answer_key" = answer key, provisional/final answer key
- "exam" = exam date, exam schedule, timetable, exam notice (not clearly another type)
- "notification" = meaningful public notice not fitting other types
- "not_publishable" = junk, irrelevant, or insufficient evidence`;

export const RETRY_ENHANCED_PREFIX = `SECOND-PASS EXTRACTION MODE:
This record was already classified once but had insufficient evidence. Try harder with these techniques:
- Extract organisation name from URL patterns (e.g. "upsc.gov.in" → UPSC), domain name, and page title context
- Reconstruct dates from surrounding text, PDF filenames, URL date patterns (e.g. "/2025/03/" → March 2025)
- Infer post names and exam names from title fragments and file naming conventions
- Extract links more aggressively from raw_text and raw_html
- Look for advertisement numbers and reference numbers in any available text

CRITICAL: Do NOT lower your readiness threshold. If evidence remains insufficient after deeper extraction, keep primary_status="manual_check". Only upgrade to "publish_ready" if you found genuinely new evidence this pass.

`;

export const FILL_EMPTY_FIELDS_PROMPT = `You are a grounded evidence extractor for TrueJobs.co.in.

Your task: Fill ONLY the listed empty fields using ONLY grounded evidence from the provided sources.

RULES:
1. NEVER invent, guess, or fabricate any value
2. Only return a value for a field if you found clear evidence for it
3. Return empty string "" for fields where evidence is insufficient
4. Check the Original Import Payload first — it often has structured data
5. Check Source HTML for links and structured data
6. Extract dates in YYYY-MM-DD format
7. Do not change classification or status fields — only fill data fields`;

// Targeted action prompts (verbatim)
export const TARGETED_ACTIONS: Record<string, { prompt: string; fields: string[] }> = {
  seo_fix: {
    prompt: 'Generate SEO-optimized fields for this Indian government recruitment record. seo_title must be under 60 chars, meta_description under 160 chars, slug must be lowercase kebab-case. Do NOT invent facts.',
    fields: ['seo_title', 'slug', 'meta_description', 'summary'],
  },
  improve_title: {
    prompt: 'Improve the title for this Indian government recruitment record. normalized_title should be a clean, accurate title. seo_title must be under 60 chars and SEO-optimized. Do NOT invent facts.',
    fields: ['normalized_title', 'seo_title'],
  },
  improve_summary: {
    prompt: 'Write a concise, accurate summary and meta description for this Indian government recruitment record. meta_description must be under 160 chars. Do NOT invent facts.',
    fields: ['summary', 'meta_description'],
  },
  generate_slug: {
    prompt: 'Generate a clean, SEO-friendly slug for this Indian government recruitment record. Must be lowercase kebab-case, 3-70 chars, no special characters. Do NOT invent facts.',
    fields: ['slug'],
  },
  normalize_fields: {
    prompt: 'Clean and normalize these fields for an Indian government recruitment record. Fix casing, remove extra whitespace, standardize formats. Do NOT invent or change factual content.',
    fields: ['organisation_name', 'post_name', 'exam_name', 'qualification_text', 'age_limit_text', 'salary_text'],
  },
};

export const IMPORTANT_FIELDS = [
  'organisation_name', 'department_name', 'ministry_name',
  'post_name', 'exam_name', 'advertisement_no', 'reference_no',
  'notification_date', 'opening_date', 'closing_date', 'exam_date',
  'result_date', 'admit_card_date', 'answer_key_date', 'correction_last_date',
  'official_notification_link', 'official_apply_link', 'official_website_link',
  'result_link', 'admit_card_link', 'answer_key_link',
  'vacancy_count', 'qualification_text', 'age_limit_text',
  'application_fee_text', 'selection_process_text', 'salary_text',
  'application_mode', 'summary', 'normalized_title', 'seo_title', 'meta_description',
  'how_to_apply_text',
];

export function getEmptyImportantFields(row: any): string[] {
  return IMPORTANT_FIELDS.filter(f => {
    const v = row[f];
    return v === undefined || v === null || v === '' || (typeof v === 'number' && isNaN(v));
  });
}

export function getCriticalBlockers(row: any, contentType: string): string[] {
  const blockers: string[] = [];
  if (!row.organisation_name) blockers.push('missing_organisation');
  const needsPostOrExam = ['job', 'result', 'admit_card', 'answer_key', 'exam'].includes(contentType);
  if (needsPostOrExam && !row.post_name && !row.exam_name) blockers.push('missing_post_or_exam_name');
  if (!row.official_notification_link && !row.official_apply_link) blockers.push('missing_official_link');
  if (contentType === 'job' && !row.closing_date) blockers.push('missing_closing_date');
  return blockers;
}

export function buildFillEmptyToolSchema(emptyFields: string[]): any {
  const props: Record<string, any> = {};
  for (const f of emptyFields) {
    const original = (CLASSIFICATION_TOOL.parameters.properties as any)[f];
    props[f] = original ? { ...original } : { type: 'string' };
  }
  return {
    name: 'fill_empty_fields',
    description: 'Fill empty fields using grounded evidence only',
    parameters: { type: 'object', properties: props, required: emptyFields },
  };
}

// ─── Pipeline-specific helpers ──────────────────────────────────────────────

export const PIPELINE_STEPS = [
  'deterministic',
  'classify',
  'enrich',
  'improve_title',
  'improve_summary',
  'generate_slug',
  'seo_fix',
  'validate',
] as const;
export type PipelineStep = typeof PIPELINE_STEPS[number];

const SLUG_RE = /^[a-z0-9][a-z0-9-]{2,68}[a-z0-9]$/;

export function isValidSlug(s?: string | null): boolean {
  if (!s) return false;
  return SLUG_RE.test(s);
}

export function isStrongTitle(t?: string | null, raw?: string | null): boolean {
  if (!t) return false;
  const len = t.trim().length;
  if (len < 25 || len > 110) return false;
  if (t === t.toUpperCase() && /[A-Z]/.test(t)) return false; // all-caps
  if (raw && t.trim() === (raw || '').trim()) return false;
  return true;
}

export function isStrongSummary(s?: string | null): boolean {
  if (!s) return false;
  const len = s.trim().length;
  return len >= 80 && len <= 400;
}

export function isStrongMetaDesc(m?: string | null): boolean {
  if (!m) return false;
  const len = m.trim().length;
  return len >= 100 && len <= 160;
}

export function isStrongSeoTitle(t?: string | null): boolean {
  if (!t) return false;
  const len = t.trim().length;
  return len >= 30 && len <= 60;
}

export function isClassified(d: any): boolean {
  return d?.processing_status === 'ai_processed'
    && !!d?.content_type
    && (typeof d?.confidence_score === 'number' ? d.confidence_score >= 70 : false)
    && !!d?.organisation_name;
}

export function hasSubstantialEvidence(d: any): boolean {
  return (d?.raw_text && (d.raw_text as string).length > 200)
    || !!d?.structured_data_json
    || !!d?.raw_html;
}

/**
 * Conservative field protection: returns true if newVal should overwrite oldVal.
 * Strong existing values are preserved. Empty newVal never overwrites.
 */
export function shouldOverwrite(field: string, oldVal: any, newVal: any): boolean {
  if (newVal === undefined || newVal === null || newVal === '') return false;
  const isEmptyOld = oldVal === undefined || oldVal === null || oldVal === ''
    || (typeof oldVal === 'number' && isNaN(oldVal));
  if (isEmptyOld) return true;

  switch (field) {
    case 'normalized_title':
      // Replace only if new is strong AND old was weak
      return isStrongTitle(newVal) && !isStrongTitle(oldVal);
    case 'seo_title':
      return isStrongSeoTitle(newVal) && !isStrongSeoTitle(oldVal);
    case 'summary':
      return isStrongSummary(newVal) && !isStrongSummary(oldVal);
    case 'meta_description':
      return isStrongMetaDesc(newVal) && !isStrongMetaDesc(oldVal);
    case 'slug':
      return isValidSlug(newVal) && !isValidSlug(oldVal);
    default:
      // For factual fields with an existing value, do not overwrite
      return false;
  }
}

/** Decide which step to run next. Returns null when pipeline is done. */
export function decideNextStep(d: any): { step: PipelineStep | null; skipReasons: Record<string, string> } {
  const reasons: Record<string, string> = {};
  const last = d.pipeline_current_step as PipelineStep | null;

  // We always run validate at the end. Track which steps to consider in order,
  // and skip ones whose output is already "good enough".
  const after = (s: PipelineStep): PipelineStep[] => {
    const idx = PIPELINE_STEPS.indexOf(s);
    return [...PIPELINE_STEPS].slice(idx + 1);
  };

  const candidates: PipelineStep[] = last ? after(last) : [...PIPELINE_STEPS];

  for (const step of candidates) {
    switch (step) {
      case 'deterministic':
        return { step, skipReasons: reasons };
      case 'classify':
        if (isClassified(d)) { reasons.classify = 'already classified (confidence>=70 + organisation)'; continue; }
        return { step, skipReasons: reasons };
      case 'enrich': {
        const empty = getEmptyImportantFields(d);
        if (empty.length === 0) { reasons.enrich = 'no empty important fields'; continue; }
        if (!hasSubstantialEvidence(d)) { reasons.enrich = 'insufficient evidence'; continue; }
        return { step, skipReasons: reasons };
      }
      case 'improve_title':
        if (isStrongTitle(d.normalized_title, d.raw_title)) { reasons.improve_title = 'normalized_title already strong'; continue; }
        return { step, skipReasons: reasons };
      case 'improve_summary':
        if (isStrongSummary(d.summary) && isStrongMetaDesc(d.meta_description)) { reasons.improve_summary = 'summary + meta already strong'; continue; }
        return { step, skipReasons: reasons };
      case 'generate_slug':
        if (isValidSlug(d.slug)) { reasons.generate_slug = 'slug already valid'; continue; }
        return { step, skipReasons: reasons };
      case 'seo_fix':
        if (isStrongSeoTitle(d.seo_title) && isStrongMetaDesc(d.meta_description)) { reasons.seo_fix = 'seo_title + meta already strong'; continue; }
        return { step, skipReasons: reasons };
      case 'validate':
        return { step, skipReasons: reasons };
    }
  }

  return { step: null, skipReasons: reasons };
}
