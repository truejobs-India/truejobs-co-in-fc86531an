/**
 * AI Classification Edge Function for Intake Drafts.
 * Supports retry_enhanced mode for second-pass aggressive extraction.
 * v2: Strengthened extraction with deterministic pre-extraction, expanded evidence,
 *     fill-empty-fields second pass, and publish-critical blockers.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const AI_GATEWAY = 'https://ai.gateway.lovable.dev/v1/chat/completions';
const DEFAULT_MODEL = 'google/gemini-3-flash-preview';
const MAX_RETRIES = 4;

const GATEWAY_MODEL_MAP: Record<string, string> = {
  'gemini-flash': 'google/gemini-2.5-flash',
  'gemini-pro': 'google/gemini-2.5-pro',
  'gpt5': 'openai/gpt-5',
  'gpt5-mini': 'openai/gpt-5-mini',
  'lovable-gemini': 'google/gemini-3-flash-preview',
};

const VERTEX_MODEL_MAP: Record<string, { vertexModel: string; timeoutMs: number }> = {
  'vertex-flash': { vertexModel: 'gemini-2.5-flash', timeoutMs: 90_000 },
  'vertex-pro': { vertexModel: 'gemini-2.5-pro', timeoutMs: 120_000 },
  'vertex-3.1-pro': { vertexModel: 'gemini-3.1-pro-preview', timeoutMs: 120_000 },
  'vertex-3-flash': { vertexModel: 'gemini-3-flash-preview', timeoutMs: 90_000 },
  'vertex-3.1-flash-lite': { vertexModel: 'gemini-3.1-flash-lite-preview', timeoutMs: 60_000 },
};

const BEDROCK_MODELS = new Set(['nova-pro', 'nova-premier', 'nemotron-120b', 'mistral']);
const AZURE_OPENAI_MODELS = new Set(['azure-gpt4o-mini', 'azure-gpt41-mini']);
const AZURE_DEEPSEEK_MODELS = new Set(['azure-deepseek-v3']);

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

// ─── Deterministic Pre-Extraction ───────────────────────────────────────────

interface PreExtracted {
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

function deterministicExtract(draft: any): PreExtracted {
  const result: PreExtracted = {};
  const title = (draft.raw_title || '') as string;
  const rawText = ((draft.raw_text || '') as string).slice(0, 5000);
  const sourceUrl = (draft.source_url || '') as string;
  const sourceDomain = (draft.source_domain || '') as string;
  const combined = `${title}\n${rawText}`;

  // 1. Advertisement / Reference number extraction
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

  // Reference number (if different from advt no)
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

  // 2. Dates from URL path segments
  const urlDateMatch = sourceUrl.match(/\/(\d{4})\/(\d{1,2})\/(\d{1,2})\//);
  if (urlDateMatch) {
    const [, y, m, d] = urlDateMatch;
    const yr = parseInt(y), mo = parseInt(m), dy = parseInt(d);
    if (yr >= 2020 && yr <= 2030 && mo >= 1 && mo <= 12 && dy >= 1 && dy <= 31) {
      result.notification_date = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
  }

  // 3. Application mode keyword detection
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

  // 4. Official website from trusted domain (conservative)
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

  // 5. Links from structured_data_json
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
      applyLink: 'official_apply_link',
      apply_link: 'official_apply_link',
      apply_url: 'official_apply_link',
      notificationLink: 'official_notification_link',
      notification_link: 'official_notification_link',
      notification_url: 'official_notification_link',
      resultLink: 'result_link',
      result_link: 'result_link',
      result_url: 'result_link',
      websiteLink: 'official_website_link',
      website_link: 'official_website_link',
      website_url: 'official_website_link',
      officialLink: 'official_notification_link',
      official_link: 'official_notification_link',
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

// ─── AI Call ────────────────────────────────────────────────────────────────

async function callAI(
  apiKey: string,
  systemPrompt: string,
  userPrompt: string,
  toolDef: { name: string; description: string; parameters: Record<string, unknown> },
  aiModel?: string,
): Promise<any> {
  const modelKey = aiModel || '';

  const vertexDef = VERTEX_MODEL_MAP[modelKey];
  if (vertexDef) {
    console.log(`[intake-ai-classify] routing to Vertex AI: ${vertexDef.vertexModel}`);
    const { callVertexGemini } = await import('../_shared/vertex-ai.ts');
    const fullPrompt = `${systemPrompt}\n\n${userPrompt}\n\nReturn valid JSON matching this schema:\n${JSON.stringify(toolDef.parameters, null, 2)}`;
    const text = await callVertexGemini(vertexDef.vertexModel, fullPrompt, vertexDef.timeoutMs);
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
    throw new Error('Vertex AI did not return valid JSON');
  }

  if (BEDROCK_MODELS.has(modelKey)) {
    const fullPrompt = `${systemPrompt}\n\n${userPrompt}\n\nReturn valid JSON matching this schema:\n${JSON.stringify(toolDef.parameters, null, 2)}`;
    if (modelKey === 'mistral') {
      console.log(`[intake-ai-classify] routing to Bedrock Mistral`);
      const { awsSigV4Fetch } = await import('../_shared/bedrock-nova.ts');
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
      console.log(`[intake-ai-classify] routing to Bedrock Nova: ${modelKey}`);
      const { callBedrockNova } = await import('../_shared/bedrock-nova.ts');
      const text = await callBedrockNova(modelKey, fullPrompt, { maxTokens: 8192, temperature: 0.3 });
      const m = text.match(/\{[\s\S]*\}/);
      if (m) return JSON.parse(m[0]);
      throw new Error('Nova did not return valid JSON');
    }
  }

  if (AZURE_OPENAI_MODELS.has(modelKey)) {
    const fullPrompt = `${systemPrompt}\n\n${userPrompt}\n\nReturn valid JSON matching this schema:\n${JSON.stringify(toolDef.parameters, null, 2)}`;
    console.log(`[intake-ai-classify] routing to Azure OpenAI: ${modelKey}`);
    if (modelKey === 'azure-gpt41-mini') {
      const { callAzureGPT41Mini } = await import('../_shared/azure-openai.ts');
      const text = await callAzureGPT41Mini(fullPrompt, { maxTokens: 8192, temperature: 0.3 });
      const m2 = text.match(/\{[\s\S]*\}/);
      if (m2) return JSON.parse(m2[0]);
      throw new Error('Azure GPT-4.1 Mini did not return valid JSON');
    }
    const { callAzureOpenAI } = await import('../_shared/azure-openai.ts');
    const text = await callAzureOpenAI(fullPrompt, { maxTokens: 8192, temperature: 0.3 });
    const m = text.match(/\{[\s\S]*\}/);
    if (m) return JSON.parse(m[0]);
    throw new Error('Azure OpenAI did not return valid JSON');
  }

  if (AZURE_DEEPSEEK_MODELS.has(modelKey)) {
    const fullPrompt = `${systemPrompt}\n\n${userPrompt}\n\nReturn valid JSON matching this schema:\n${JSON.stringify(toolDef.parameters, null, 2)}`;
    console.log(`[intake-ai-classify] routing to Azure DeepSeek: ${modelKey}`);
    const { callAzureDeepSeek } = await import('../_shared/azure-deepseek.ts');
    const text = await callAzureDeepSeek(fullPrompt, { maxTokens: 8192, temperature: 0.3 });
    const m3 = text.match(/\{[\s\S]*\}/);
    if (m3) return JSON.parse(m3[0]);
    throw new Error('Azure DeepSeek did not return valid JSON');
  }

  const gatewayModelId = GATEWAY_MODEL_MAP[modelKey] || DEFAULT_MODEL;
  console.log(`[intake-ai-classify] routing to AI Gateway: ${gatewayModelId}`);

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

// ─── Tool Schema ────────────────────────────────────────────────────────────

const CLASSIFICATION_TOOL = {
  name: 'classify_intake_draft',
  description: 'Classify a scraped record and extract structured fields for the Indian government jobs portal TrueJobs.co.in',
  parameters: {
    type: 'object',
    properties: {
      content_type: {
        type: 'string',
        enum: ['job', 'result', 'admit_card', 'answer_key', 'exam', 'notification', 'scholarship', 'certificate', 'marksheet', 'not_publishable'],
      },
      primary_status: {
        type: 'string',
        enum: ['publish_ready', 'manual_check', 'reject'],
        description: 'publish_ready only when evidence is strong. manual_check when uncertain. reject when junk/stale/unusable.',
      },
      publish_target: {
        type: 'string',
        enum: ['jobs', 'results', 'admit_cards', 'answer_keys', 'exams', 'notifications', 'scholarships', 'certificates', 'marksheets', 'none'],
      },
      confidence_score: { type: 'number', description: '0-100 confidence in classification' },
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
      draft_content_html: { type: 'string', description: 'Structured HTML draft content' },
    },
    required: ['content_type', 'primary_status', 'publish_target', 'confidence_score', 'classification_reason', 'secondary_tags', 'publish_blockers'],
  },
};

// ─── System Prompts ─────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are an expert classifier for TrueJobs.co.in, an Indian government jobs portal.

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

const RETRY_ENHANCED_PREFIX = `SECOND-PASS EXTRACTION MODE:
This record was already classified once but had insufficient evidence. Try harder with these techniques:
- Extract organisation name from URL patterns (e.g. "upsc.gov.in" → UPSC), domain name, and page title context
- Reconstruct dates from surrounding text, PDF filenames, URL date patterns (e.g. "/2025/03/" → March 2025)
- Infer post names and exam names from title fragments and file naming conventions
- Extract links more aggressively from raw_text and raw_html
- Look for advertisement numbers and reference numbers in any available text

CRITICAL: Do NOT lower your readiness threshold. If evidence remains insufficient after deeper extraction, keep primary_status="manual_check". Only upgrade to "publish_ready" if you found genuinely new evidence this pass.

`;

const FILL_EMPTY_FIELDS_PROMPT = `You are a grounded evidence extractor for TrueJobs.co.in.

Your task: Fill ONLY the listed empty fields using ONLY grounded evidence from the provided sources.

RULES:
1. NEVER invent, guess, or fabricate any value
2. Only return a value for a field if you found clear evidence for it
3. Return empty string "" for fields where evidence is insufficient
4. Check the Original Import Payload first — it often has structured data
5. Check Source HTML for links and structured data
6. Extract dates in YYYY-MM-DD format
7. Do not change classification or status fields — only fill data fields`;

// ─── Important Fields for Second Pass ───────────────────────────────────────

const IMPORTANT_FIELDS = [
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

function getEmptyImportantFields(aiResult: any): string[] {
  return IMPORTANT_FIELDS.filter(f => {
    const v = aiResult[f];
    return v === undefined || v === null || v === '' || (typeof v === 'number' && isNaN(v));
  });
}

// ─── Critical Blockers ──────────────────────────────────────────────────────

function getCriticalBlockers(aiResult: any, contentType: string): string[] {
  const blockers: string[] = [];

  if (!aiResult.organisation_name) {
    blockers.push('missing_organisation');
  }

  const needsPostOrExam = ['job', 'result', 'admit_card', 'answer_key', 'exam'].includes(contentType);
  if (needsPostOrExam && !aiResult.post_name && !aiResult.exam_name) {
    blockers.push('missing_post_or_exam_name');
  }

  if (!aiResult.official_notification_link && !aiResult.official_apply_link) {
    blockers.push('missing_official_link');
  }

  if (contentType === 'job' && !aiResult.closing_date) {
    blockers.push('missing_closing_date');
  }

  return blockers;
}

// ─── Build Fill-Empty Tool Schema ───────────────────────────────────────────

function buildFillEmptyToolSchema(emptyFields: string[]): any {
  const props: Record<string, any> = {};
  for (const f of emptyFields) {
    const original = (CLASSIFICATION_TOOL.parameters.properties as any)[f];
    if (original) {
      props[f] = { ...original };
    } else {
      props[f] = { type: 'string' };
    }
  }
  return {
    name: 'fill_empty_fields',
    description: 'Fill empty fields using grounded evidence only',
    parameters: {
      type: 'object',
      properties: props,
      required: emptyFields,
    },
  };
}

// ─── Main Handler ───────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const lovableKey = Deno.env.get('LOVABLE_API_KEY');
  if (!lovableKey) return json({ error: 'LOVABLE_API_KEY not configured' }, 500);

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Missing Authorization' }, 401);

    const token = authHeader.replace('Bearer ', '');
    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) return json({ error: 'Invalid token' }, 401);

    const { data: roleData } = await supabase
      .from('user_roles').select('role').eq('user_id', user.id).eq('role', 'admin').maybeSingle();
    if (!roleData) return json({ error: 'Admin required' }, 403);

    const body = await req.json().catch(() => ({}));
    const draftIds = body.draft_ids as string[];
    const aiModel = (body.aiModel as string) || '';
    const retryEnhanced = body.retry_enhanced === true;
    const fillEmptyOnly = body.fill_empty_only === true;

    if (!draftIds || !Array.isArray(draftIds) || draftIds.length === 0) {
      return json({ error: 'Missing draft_ids array' }, 400);
    }
    if (draftIds.length > 20) {
      return json({ error: 'Max 20 drafts per call' }, 400);
    }

    const client = createClient(supabaseUrl, serviceRoleKey);

    // ─── Fill Empty Only Mode ───────────────────────────────────────────────
    if (fillEmptyOnly) {
      const fillResults: { id: string; status: string; enrichment_result: string; fields_filled?: string[]; error?: string }[] = [];

      for (const draftId of draftIds) {
        try {
          const { data: draft, error: fetchErr } = await client
            .from('intake_drafts').select('*').eq('id', draftId).single();

          if (fetchErr || !draft) {
            await client.from('intake_drafts').update({ enrichment_result: 'not_enriched_tech_error' } as any).eq('id', draftId);
            fillResults.push({ id: draftId, status: 'error', enrichment_result: 'not_enriched_tech_error', error: 'Draft not found' });
            continue;
          }

          // Identify empty fields from current DB row
          const emptyFields: string[] = IMPORTANT_FIELDS.filter(f => {
            const v = (draft as any)[f];
            return v === undefined || v === null || v === '' || (typeof v === 'number' && isNaN(v));
          });

          if (emptyFields.length === 0) {
            await client.from('intake_drafts').update({ enrichment_result: 'not_enriched_no_data' } as any).eq('id', draftId);
            fillResults.push({ id: draftId, status: 'ok', enrichment_result: 'not_enriched_no_data' });
            continue;
          }

          // Deterministic extraction — only for empty fields
          const preExtracted = deterministicExtract(draft);
          const deterministicFills: Record<string, any> = {};
          for (const [key, val] of Object.entries(preExtracted)) {
            if (val && emptyFields.includes(key)) {
              deterministicFills[key] = val;
            }
          }

          // Re-check which fields are still empty after deterministic pass
          const stillEmptyFields = emptyFields.filter(f => !deterministicFills[f]);

          let aiFills: Record<string, any> = {};

          // Only call AI if there are still-empty fields AND substantial evidence exists
          const hasSubstantialEvidence = (draft.raw_text && (draft.raw_text as string).length > 200) ||
            !!draft.structured_data_json || !!draft.raw_html;

          if (stillEmptyFields.length > 0 && hasSubstantialEvidence) {
            try {
              // Build evidence
              let structuredPayload = '';
              if (draft.structured_data_json) {
                try {
                  const sd = typeof draft.structured_data_json === 'string'
                    ? draft.structured_data_json
                    : JSON.stringify(draft.structured_data_json);
                  structuredPayload = sd.slice(0, 3000);
                } catch { /* ignore */ }
              }
              const rawHtml = draft.raw_html ? (draft.raw_html as string).slice(0, 3000) : '';

              const evidence = [
                draft.raw_title ? `Title: ${draft.raw_title}` : '',
                draft.source_url ? `Source URL: ${draft.source_url}` : '',
                draft.source_domain ? `Source Domain: ${draft.source_domain}` : '',
                draft.source_name ? `Source Name: ${draft.source_name}` : '',
                draft.raw_file_url ? `File URL: ${draft.raw_file_url}` : '',
                draft.raw_text ? `Content:\n${(draft.raw_text as string).slice(0, 4000)}` : '',
                structuredPayload ? `Original Import Payload:\n${structuredPayload}` : '',
                rawHtml ? `Source HTML (excerpt):\n${rawHtml}` : '',
              ].filter(Boolean).join('\n\n');

              const fillTool = buildFillEmptyToolSchema(stillEmptyFields);
              const fillPrompt = `These fields are currently empty and need to be filled ONLY if grounded evidence exists:\n${stillEmptyFields.join(', ')}\n\nEvidence:\n${evidence}`;

              const fillResult = await callAI(lovableKey, FILL_EMPTY_FIELDS_PROMPT, fillPrompt, fillTool, aiModel);

              // Only accept fields that were in the still-empty list
              for (const f of stillEmptyFields) {
                const newVal = fillResult[f];
                if (newVal !== undefined && newVal !== null && newVal !== '') {
                  aiFills[f] = newVal;
                }
              }
            } catch (aiErr) {
              console.error(`[intake-ai-classify] Fill AI error for ${draftId}:`, aiErr instanceof Error ? aiErr.message : aiErr);
            }
          }

          // Merge deterministic + AI fills — ONLY for fields that were originally empty
          const allFills: Record<string, any> = { ...deterministicFills, ...aiFills };

          // Safety: double-check that we only include fields that were truly empty in the original row
          const safeFills: Record<string, any> = {};
          for (const [key, val] of Object.entries(allFills)) {
            const originalVal = (draft as any)[key];
            const wasEmpty = originalVal === undefined || originalVal === null || originalVal === '' || (typeof originalVal === 'number' && isNaN(originalVal));
            if (wasEmpty && val !== undefined && val !== null && val !== '') {
              safeFills[key] = val;
            }
          }

          const filledFieldNames = Object.keys(safeFills);
          const enrichmentResult = filledFieldNames.length > 0 ? 'enriched' : 'not_enriched_no_data';

          // Build update — only filled fields + enrichment_result
          const update: Record<string, any> = {
            ...safeFills,
            enrichment_result: enrichmentResult,
          };

          const { error: updateErr } = await client.from('intake_drafts').update(update as any).eq('id', draftId);
          if (updateErr) {
            await client.from('intake_drafts').update({ enrichment_result: 'not_enriched_tech_error' } as any).eq('id', draftId);
            fillResults.push({ id: draftId, status: 'error', enrichment_result: 'not_enriched_tech_error', error: updateErr.message });
          } else {
            fillResults.push({ id: draftId, status: 'ok', enrichment_result: enrichmentResult, fields_filled: filledFieldNames });
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Unknown error';
          console.error(`[intake-ai-classify] Fill error for ${draftId}:`, msg);
          try {
            await client.from('intake_drafts').update({ enrichment_result: 'not_enriched_tech_error' } as any).eq('id', draftId);
          } catch { /* best effort */ }
          fillResults.push({ id: draftId, status: 'error', enrichment_result: 'not_enriched_tech_error', error: msg });
        }

        if (draftIds.indexOf(draftId) < draftIds.length - 1) {
          await sleep(2000);
        }
      }

      return json({ results: fillResults });
    }

    // ─── Normal Classification Mode ─────────────────────────────────────────
    const results: { id: string; status: string; error?: string; secondPass?: boolean }[] = [];

    const systemPrompt = retryEnhanced ? RETRY_ENHANCED_PREFIX + SYSTEM_PROMPT : SYSTEM_PROMPT;

    for (const draftId of draftIds) {
      try {
        const { data: draft, error: fetchErr } = await client
          .from('intake_drafts').select('*').eq('id', draftId).single();

        if (fetchErr || !draft) {
          results.push({ id: draftId, status: 'error', error: 'Draft not found' });
          continue;
        }

        // ── Deterministic pre-extraction ──
        const preExtracted = deterministicExtract(draft);
        const preExtractedHints = Object.entries(preExtracted)
          .filter(([, v]) => v)
          .map(([k, v]) => `  ${k}: ${v}`)
          .join('\n');

        // ── Build evidence with expanded sources ──
        const rawTags = draft.secondary_tags;
        const parsedTags = Array.isArray(rawTags)
          ? rawTags
          : (typeof rawTags === 'string' ? (() => { try { return JSON.parse(rawTags); } catch { return []; } })() : []);

        let structuredPayload = '';
        if (draft.structured_data_json) {
          try {
            const sd = typeof draft.structured_data_json === 'string'
              ? draft.structured_data_json
              : JSON.stringify(draft.structured_data_json);
            structuredPayload = sd.slice(0, 3000);
          } catch { /* ignore */ }
        }

        const rawHtml = draft.raw_html ? (draft.raw_html as string).slice(0, 3000) : '';

        const evidence = [
          draft.raw_title ? `Title: ${draft.raw_title}` : '',
          draft.source_url ? `Source URL: ${draft.source_url}` : '',
          draft.source_domain ? `Source Domain: ${draft.source_domain}` : '',
          draft.source_name ? `Source Name: ${draft.source_name}` : '',
          draft.raw_file_url ? `File URL: ${draft.raw_file_url}` : '',
          draft.raw_text ? `Content:\n${(draft.raw_text as string).slice(0, 4000)}` : '',
          parsedTags.length > 0 ? `Import tags: ${parsedTags.join(', ')}` : '',
          structuredPayload ? `Original Import Payload:\n${structuredPayload}` : '',
          rawHtml ? `Source HTML (excerpt):\n${rawHtml}` : '',
          preExtractedHints ? `Pre-extracted Hints (deterministic):\n${preExtractedHints}` : '',
          retryEnhanced && draft.normalized_title ? `Previous title extraction: ${draft.normalized_title}` : '',
          retryEnhanced && draft.organisation_name ? `Previous org extraction: ${draft.organisation_name}` : '',
          retryEnhanced && draft.classification_reason ? `Previous classification note: ${draft.classification_reason}` : '',
        ].filter(Boolean).join('\n\n');

        const userPrompt = retryEnhanced
          ? `SECOND-PASS: Re-classify this record with deeper extraction:\n\n${evidence}`
          : `Classify this scraped record and extract ALL available fields:\n\n${evidence}`;

        // ── AI Pass 1 ──
        let aiResult = await callAI(lovableKey, systemPrompt, userPrompt, CLASSIFICATION_TOOL, aiModel);

        // ── Fill-Empty-Fields Second Pass ──
        let didSecondPass = false;
        const emptyFields = getEmptyImportantFields(aiResult);
        const hasSubstantialEvidence = (draft.raw_text && (draft.raw_text as string).length > 200) || !!structuredPayload;

        if (emptyFields.length >= 3 && hasSubstantialEvidence) {
          try {
            console.log(`[intake-ai-classify] ${draftId}: ${emptyFields.length} empty fields, running fill pass`);
            const fillTool = buildFillEmptyToolSchema(emptyFields);
            const fillPrompt = `These fields are currently empty and need to be filled if evidence exists:\n${emptyFields.join(', ')}\n\nEvidence:\n${evidence}`;

            const fillResult = await callAI(lovableKey, FILL_EMPTY_FIELDS_PROMPT, fillPrompt, fillTool, aiModel);

            // Merge: only fill fields that were empty
            for (const f of emptyFields) {
              const newVal = fillResult[f];
              if (newVal !== undefined && newVal !== null && newVal !== '') {
                aiResult[f] = newVal;
              }
            }
            didSecondPass = true;
          } catch (fillErr) {
            console.error(`[intake-ai-classify] Fill pass error for ${draftId}:`, fillErr instanceof Error ? fillErr.message : fillErr);
          }
        }

        // ── Apply deterministic fallbacks for still-empty fields ──
        for (const [key, val] of Object.entries(preExtracted)) {
          if (val && (!aiResult[key] || aiResult[key] === '')) {
            aiResult[key] = val;
          }
        }

        // ── Merge tags ──
        const rawExistingTags = draft.secondary_tags;
        const existingTags: string[] = Array.isArray(rawExistingTags)
          ? rawExistingTags
          : (typeof rawExistingTags === 'string' ? (() => { try { const v = JSON.parse(rawExistingTags); return Array.isArray(v) ? v : []; } catch { return []; } })() : []);
        const aiTags = Array.isArray(aiResult.secondary_tags) ? aiResult.secondary_tags : [];
        const mergedTags = [...new Set([...existingTags, ...aiTags])];

        // ── Build critical blockers ──
        const aiBlockers = Array.isArray(aiResult.publish_blockers) ? aiResult.publish_blockers : [];
        const criticalBlockers = getCriticalBlockers(aiResult, aiResult.content_type || '');
        const mergedBlockers = [...new Set([...aiBlockers, ...criticalBlockers])];

        // ── Build update ──
        const update: Record<string, any> = {
          content_type: aiResult.content_type,
          primary_status: aiResult.primary_status,
          publish_target: aiResult.publish_target,
          confidence_score: aiResult.confidence_score,
          classification_reason: aiResult.classification_reason,
          secondary_tags: mergedTags,
          publish_blockers: mergedBlockers,
          processing_status: 'ai_processed',
          ai_model_used: aiModel || 'default',
          ai_processed_at: new Date().toISOString(),
        };

        const optionalFields = [
          'normalized_title', 'seo_title', 'slug', 'meta_description', 'summary',
          'organisation_name', 'department_name', 'ministry_name', 'post_name', 'exam_name',
          'advertisement_no', 'reference_no', 'job_location', 'application_mode',
          'notification_date', 'opening_date', 'closing_date', 'correction_last_date',
          'exam_date', 'result_date', 'admit_card_date', 'answer_key_date',
          'vacancy_count', 'qualification_text', 'age_limit_text', 'salary_text',
          'application_fee_text', 'selection_process_text', 'how_to_apply_text',
          'official_notification_link', 'official_apply_link', 'official_website_link',
          'result_link', 'admit_card_link', 'answer_key_link',
          'draft_content_html',
        ];
        for (const f of optionalFields) {
          if (aiResult[f] !== undefined && aiResult[f] !== null && aiResult[f] !== '') {
            update[f] = aiResult[f];
          }
        }

        if (aiResult.key_points) update.key_points_json = aiResult.key_points;

        const { error: updateErr } = await client.from('intake_drafts').update(update).eq('id', draftId);
        if (updateErr) {
          results.push({ id: draftId, status: 'error', error: updateErr.message });
        } else {
          results.push({ id: draftId, status: 'ok', secondPass: didSecondPass });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        console.error(`[intake-ai-classify] Error for ${draftId}:`, msg);
        results.push({ id: draftId, status: 'error', error: msg });
      }

      if (draftIds.indexOf(draftId) < draftIds.length - 1) {
        await sleep(2000);
      }
    }

    return json({ results });
  } catch (e) {
    console.error('[intake-ai-classify] Error:', e);
    return json({ error: e instanceof Error ? e.message : 'Internal error' }, 500);
  }
});
