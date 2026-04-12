/**
 * Source 3 Phase 4+5: AI enrichment for firecrawl draft jobs.
 * Separate actions: ai-clean, ai-enrich, ai-find-links, ai-fix-missing,
 *                   ai-seo, ai-cover-prompt, ai-cover-image, ai-run-all
 *
 * Hardening:
 * - admin_edited_fields protection: AI skips fields the admin manually edited
 * - Status guards: reviewed/approved drafts block AI Clean and AI Enrich
 * - Aggregator domain blocklist for official link validation
 * - Old-value snapshots in audit log for rollback
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const AI_GATEWAY = 'https://ai.gateway.lovable.dev/v1/chat/completions';
const DEFAULT_MODEL = 'google/gemini-3-flash-preview';
const TEXT_AI_MAX_RETRIES = 4;

// ── Model routing: maps frontend registry keys to gateway model IDs or provider routes ──
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

const BEDROCK_MODELS = new Set(['nova-pro', 'nova-premier', 'mistral']);

// ── Image model routing: maps frontend registry keys to gateway/vertex image models ──
interface ImageModelRoute {
  provider: 'lovable-gateway' | 'vertex-ai';
  apiModel: string;
  vertexEndpoint?: 'gemini' | 'imagen';
}

const IMAGE_MODEL_REGISTRY: Record<string, ImageModelRoute> = {
  'gemini-flash-image':   { provider: 'lovable-gateway', apiModel: 'google/gemini-2.5-flash-image' },
  'gemini-pro-image':     { provider: 'lovable-gateway', apiModel: 'google/gemini-3-pro-image-preview' },
  'gemini-flash-image-2': { provider: 'lovable-gateway', apiModel: 'google/gemini-3.1-flash-image-preview' },
  'vertex-pro':           { provider: 'vertex-ai', apiModel: 'gemini-2.5-flash-image', vertexEndpoint: 'gemini' },
  'vertex-3-pro-image':   { provider: 'vertex-ai', apiModel: 'gemini-3-pro-image-preview', vertexEndpoint: 'gemini' },
  'vertex-imagen':        { provider: 'vertex-ai', apiModel: 'imagen-3.0-generate-002', vertexEndpoint: 'imagen' },
  'vertex-3.1-flash-image': { provider: 'vertex-ai', apiModel: 'gemini-3.1-flash-image-preview', vertexEndpoint: 'gemini' },
};

// Aggregator domains that must NEVER appear as official links
const AGGREGATOR_DOMAINS = [
  'sarkariexam.com', 'sarkarinaukri.com', 'indgovtjobs.in',
  'allgovernmentjobs.in', 'mysarkarinaukri.com', 'govtjobguru.in',
  'sarkarinaukriblog.com', 'freshersnow.com', 'careerpower.in',
  'sharmajobs.com', 'sarkaridisha.com', 'recruitment.guru',
  'sarkariresult.com', 'freejobalert.com', 'jagranjosh.com',
  'adda247.com', 'testbook.com', 'gradeup.co', 'byjus.com',
  'embibe.com', 'prepp.in', 'safalta.com', 'rojgarresult.in',
];

function isAggregatorUrl(url: string): boolean {
  if (!url) return false;
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return AGGREGATOR_DOMAINS.some(d => hostname === d || hostname.endsWith('.' + d));
  } catch {
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const lovableKey = Deno.env.get('LOVABLE_API_KEY');

  if (!lovableKey) return json({ error: 'LOVABLE_API_KEY not configured' }, 500);

  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action as string;
    const draftId = body.draft_id as string;
    const aiModel = (body.aiModel as string) || '';
    const imageModel = (body.imageModel as string) || '';

    if (!action) return json({ error: 'Missing action' }, 400);
    if (!draftId && action !== 'ai-run-all-batch' && action !== 'govt-auto-publish-batch') return json({ error: 'Missing draft_id' }, 400);

    // Auth check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Missing Authorization' }, 401);

    const token = authHeader.replace('Bearer ', '');
    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) return json({ error: 'Invalid token' }, 401);

    const { data: roleData } = await supabase
      .from('user_roles').select('role').eq('user_id', user.id).eq('role', 'admin').maybeSingle();
    if (!roleData) return json({ error: 'Admin required' }, 403);

    const client = createClient(supabaseUrl, serviceRoleKey);

    switch (action) {
      case 'ai-clean': return await handleAiClean(draftId, client, lovableKey, aiModel);
      case 'ai-enrich': return await handleAiEnrich(draftId, client, lovableKey, aiModel);
      case 'ai-find-links': return await handleAiFindLinks(draftId, client, lovableKey, aiModel);
      case 'ai-fix-missing': return await handleAiFixMissing(draftId, client, lovableKey, aiModel);
      case 'ai-seo': return await handleAiSeo(draftId, client, lovableKey, aiModel);
      case 'ai-cover-prompt': return await handleAiCoverPrompt(draftId, client, lovableKey, aiModel);
      case 'ai-cover-image': return await handleAiCoverImage(draftId, client, lovableKey, imageModel);
      case 'ai-run-all': return await handleAiRunAll(draftId, client, lovableKey, aiModel, imageModel);
      case 'ai-fix-fields': return await handleAiFixFields(draftId, client, lovableKey, aiModel);
      case 'ai-govt-extract': return await handleAiGovtExtract(draftId, client, lovableKey, aiModel);
      case 'ai-govt-enrich': return await handleAiGovtEnrich(draftId, client, lovableKey, aiModel);
      case 'ai-govt-retry': return await handleAiGovtRetry(draftId, client, lovableKey, aiModel);
      case 'govt-validate-publish': return await handleGovtValidatePublish(draftId, client);
      case 'govt-auto-publish': return await handleGovtAutoPublish(draftId, client);
      case 'govt-auto-publish-batch': return await handleGovtAutoPublishBatch(client);
      case 'govt-retry-failed': return await handleGovtRetryFailed(draftId, client, lovableKey, aiModel);
      case 'rollback-ai-action': return await handleRollbackAiAction(draftId, client);
      default: return json({ error: `Unknown action: ${action}` }, 400);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Internal error';
    const normalizedMsg = msg.toLowerCase();
    console.error('[firecrawl-ai-enrich] Error:', e);
    // Return appropriate status codes for known business errors
    if (msg.includes('Draft not found')) return json({ error: msg }, 404);
    if (
      msg.includes('429') ||
      msg.includes('RESOURCE_EXHAUSTED') ||
      normalizedMsg.includes('rate limit') ||
      normalizedMsg.includes('rate limited')
    ) {
      return json({ error: msg }, 429);
    }
    return json({ error: msg }, 500);
  }
});

// ============ Multi-model AI dispatcher ============

async function callAI(
  apiKey: string,
  systemPrompt: string,
  userPrompt: string,
  toolDef?: { name: string; description: string; parameters: Record<string, unknown> },
  aiModel?: string,
): Promise<any> {
  const modelKey = aiModel || '';

  // ── Route: Vertex AI (GCP Service Account) ──
  const vertexDef = VERTEX_MODEL_MAP[modelKey];
  if (vertexDef) {
    console.log(`[firecrawl-ai-enrich] routing to Vertex AI: ${vertexDef.vertexModel}`);
    const { callGeminiDirect } = await import('../_shared/gemini-direct.ts');
    const fullPrompt = `${systemPrompt}\n\n${userPrompt}${toolDef ? `\n\nReturn valid JSON matching this schema:\n${JSON.stringify(toolDef.parameters, null, 2)}` : ''}`;
    const text = await callGeminiDirect(vertexDef.vertexModel, fullPrompt, vertexDef.timeoutMs);
    if (toolDef) {
      // Parse JSON from Vertex text response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) return JSON.parse(jsonMatch[0]);
      throw new Error('Vertex AI did not return valid JSON');
    }
    return text;
  }

  // ── Route: AWS Bedrock (Nova / Mistral) ──
  if (BEDROCK_MODELS.has(modelKey)) {
    if (modelKey === 'mistral') {
      console.log(`[firecrawl-ai-enrich] routing to Bedrock Mistral`);
      const { awsSigV4Fetch } = await import('../_shared/bedrock-nova.ts');
      const region = Deno.env.get('AWS_REGION') || 'us-east-1';
      const host = `bedrock-runtime.${region}.amazonaws.com`;
      const mistralModelId = 'us.mistral.mistral-large-2407-v1:0';
      const fullPrompt = `${systemPrompt}\n\n${userPrompt}${toolDef ? `\n\nReturn valid JSON matching this schema:\n${JSON.stringify(toolDef.parameters, null, 2)}` : ''}`;
      const payload = JSON.stringify({
        messages: [{ role: 'user', content: [{ text: fullPrompt }] }],
        inferenceConfig: { maxTokens: 8192, temperature: 0.5 },
      });
      const resp = await awsSigV4Fetch(host, `/model/${mistralModelId}/converse`, payload, region, 'bedrock');
      if (!resp.ok) {
        const errText = await resp.text().catch(() => 'unknown');
        throw new Error(`Mistral Bedrock error ${resp.status}: ${errText.substring(0, 300)}`);
      }
      const data = await resp.json();
      const resultText = data?.output?.message?.content?.[0]?.text || '';
      if (toolDef) {
        const jsonMatch = resultText.match(/\{[\s\S]*\}/);
        if (jsonMatch) return JSON.parse(jsonMatch[0]);
        throw new Error('Mistral did not return valid JSON');
      }
      return resultText;
    } else {
      // nova-pro or nova-premier
      console.log(`[firecrawl-ai-enrich] routing to Bedrock Nova: ${modelKey}`);
      const { callBedrockNova } = await import('../_shared/bedrock-nova.ts');
      const fullPrompt = `${systemPrompt}\n\n${userPrompt}${toolDef ? `\n\nReturn valid JSON matching this schema:\n${JSON.stringify(toolDef.parameters, null, 2)}` : ''}`;
      const text = await callBedrockNova(modelKey, fullPrompt, { maxTokens: 8192, temperature: 0.5 });
      if (toolDef) {
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) return JSON.parse(jsonMatch[0]);
        throw new Error('Nova did not return valid JSON');
      }
      return text;
    }
  }

  // ── Route: Lovable AI Gateway (default) ──
  const gatewayModelId = GATEWAY_MODEL_MAP[modelKey] || DEFAULT_MODEL;
  console.log(`[firecrawl-ai-enrich] routing to AI Gateway: ${gatewayModelId}`);

  const bodyPayload: any = {
    model: gatewayModelId,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
  };

  if (toolDef) {
    bodyPayload.tools = [{ type: 'function', function: toolDef }];
    bodyPayload.tool_choice = { type: 'function', function: { name: toolDef.name } };
  }

  let data: any = null;
  let lastRateLimitError: Error | null = null;

  for (let attempt = 0; attempt < TEXT_AI_MAX_RETRIES; attempt++) {
    const resp = await fetch(AI_GATEWAY, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(bodyPayload),
    });

    if (resp.ok) {
      data = await resp.json();
      lastRateLimitError = null;
      break;
    }

    const errText = await resp.text().catch(() => '');
    if (resp.status === 429) {
      const wait = Math.min(3000 * Math.pow(2, attempt), 30000) + Math.random() * 1000;
      lastRateLimitError = new Error('Rate limited — try again shortly');
      if (attempt < TEXT_AI_MAX_RETRIES - 1) {
        console.log(`[firecrawl-ai-enrich] AI Gateway 429, retry ${attempt + 1}/${TEXT_AI_MAX_RETRIES} after ${Math.round(wait)}ms`);
        await sleep(wait);
        continue;
      }
      break;
    }

    if (resp.status === 402) throw new Error('Credits exhausted — add funds in Settings');
    throw new Error(`AI gateway error ${resp.status}: ${errText.substring(0, 300)}`);
  }

  if (lastRateLimitError) throw lastRateLimitError;
  if (!data) throw new Error('AI gateway returned no data');

  if (toolDef) {
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      return JSON.parse(toolCall.function.arguments);
    }
    throw new Error('AI did not return tool call output');
  }

  return data.choices?.[0]?.message?.content || '';
}

function getDraftContext(draft: any): string {
  const parts: string[] = [];
  if (draft.title) parts.push(`Title: ${draft.title}`);
  if (draft.organization_name) parts.push(`Organization: ${draft.organization_name}`);
  if (draft.post_name) parts.push(`Post: ${draft.post_name}`);
  if (draft.department) parts.push(`Department: ${draft.department}`);
  if (draft.qualification) parts.push(`Qualification: ${draft.qualification}`);
  if (draft.location) parts.push(`Location: ${draft.location}`);
  if (draft.state) parts.push(`State: ${draft.state}`);
  if (draft.total_vacancies) parts.push(`Vacancies: ${draft.total_vacancies}`);
  if (draft.application_mode) parts.push(`Application Mode: ${draft.application_mode}`);
  if (draft.salary) parts.push(`Salary: ${draft.salary}`);
  if (draft.age_limit) parts.push(`Age Limit: ${draft.age_limit}`);
  if (draft.application_fee) parts.push(`Application Fee: ${draft.application_fee}`);
  if (draft.last_date_of_application) parts.push(`Last Date: ${draft.last_date_of_application}`);
  if (draft.selection_process) parts.push(`Selection: ${draft.selection_process}`);
  if (draft.description_summary) parts.push(`Summary: ${draft.description_summary}`);
  if (draft.category) parts.push(`Category: ${draft.category}`);
  return parts.join('\n');
}

async function fetchDraft(draftId: string, client: any) {
  const { data, error } = await client
    .from('firecrawl_draft_jobs')
    .select('*')
    .eq('id', draftId)
    .maybeSingle();
  if (error) throw new Error(`Draft fetch error: ${error.message}`);
  if (!data) throw new Error(`Draft not found (id: ${draftId}) — it may have been deleted`);
  return data;
}

/** Get the set of admin-edited fields that AI should not overwrite */
function getProtectedFields(draft: any): Set<string> {
  return new Set(draft.admin_edited_fields || []);
}

/** All tracked fields from the field extractor — used to recalculate fields_missing/fields_extracted */
const ALL_TRACKED_FIELDS = [
  'title', 'normalized_title', 'organization_name', 'post_name', 'job_role',
  'category', 'department', 'location', 'city', 'state',
  'total_vacancies', 'application_mode', 'qualification', 'age_limit',
  'application_fee', 'salary', 'pay_scale', 'opening_date', 'closing_date',
  'last_date_of_application', 'exam_date', 'selection_process',
  'official_notification_url', 'official_apply_url', 'official_website_url',
  'canonical_url', 'description_summary',
];

const ACTIONABLE_FIX_FIELDS = [
  'title',
  'organization_name',
  'post_name',
  'location',
  'state',
  'city',
  'category',
  'department',
  'qualification',
  'application_mode',
  'official_notification_url',
  'official_apply_url',
] as const;

/** Recalculate fields_extracted and fields_missing based on current draft state and persist */
async function recalculateFieldCounts(draftId: string, client: any): Promise<{ fields_extracted: number; fields_missing: string[] }> {
  const draft = await fetchDraft(draftId, client);
  const missing: string[] = [];
  const extracted: string[] = [];
  for (const f of ALL_TRACKED_FIELDS) {
    const val = draft[f];
    if (val === null || val === undefined || (typeof val === 'string' && val.trim().length === 0)) {
      missing.push(f);
    } else {
      extracted.push(f);
    }
  }
  await client.from('firecrawl_draft_jobs').update({
    fields_extracted: extracted.length,
    fields_missing: missing,
  }).eq('id', draftId);
  return { fields_extracted: extracted.length, fields_missing: missing };
}

/** Check if AI mutation actions are allowed on this draft status */
function checkStatusGuard(draft: any, action: string): string | null {
  const blockedStatuses = ['approved'];
  // reviewed blocks destructive AI but allows safe actions
  const destructiveActions = ['ai-clean', 'ai-enrich'];

  if (blockedStatuses.includes(draft.status)) {
    return `Cannot run ${action} on an approved draft. Change status first.`;
  }
  if (draft.status === 'reviewed' && destructiveActions.includes(action)) {
    return `Cannot run ${action} on a reviewed draft — it may overwrite verified data. Use Fix Missing or SEO instead.`;
  }
  return null;
}

function appendLog(existing: any[], action: string, result: Record<string, unknown>) {
  return [...(existing || []), { action, at: new Date().toISOString(), status: 'success', ...result }];
}

function appendCustomLog(existing: any[], action: string, status: 'success' | 'failed' | 'skipped', result: Record<string, unknown>) {
  return [...(existing || []), { action, at: new Date().toISOString(), status, ...result }];
}

/** Build old_values snapshot for fields that will change */
function snapshotOldValues(draft: any, fieldsToUpdate: Record<string, unknown>): Record<string, unknown> {
  const old: Record<string, unknown> = {};
  for (const key of Object.keys(fieldsToUpdate)) {
    if (key === 'ai_enrichment_log' || key.endsWith('_at')) continue; // skip meta
    if (draft[key] !== undefined) old[key] = draft[key];
  }
  return old;
}

function getOfficialDomainScore(url: string, keywords: string[]): number {
  try {
    const parsed = new URL(url);
    const lowerUrl = url.toLowerCase();
    const hostname = parsed.hostname.toLowerCase();
    const pathname = parsed.pathname.toLowerCase();

    const officialDomain = hostname.includes('.gov.') || hostname.includes('.nic.') || hostname.endsWith('.org.in') || hostname.endsWith('.ac.in');
    if (!officialDomain || isAggregatorUrl(url)) return -1;

    let score = 0;
    if (pathname && pathname !== '/') score += 2;
    if (keywords.some((keyword) => lowerUrl.includes(keyword))) score += 3;
    if (pathname.endsWith('.pdf')) score += 2;
    if (lowerUrl.includes('recruit') || lowerUrl.includes('career') || lowerUrl.includes('apply')) score += 1;
    return score;
  } catch {
    return -1;
  }
}

function findBestOfficialUrlFromRawLinks(rawLinks: string[] | null | undefined, keywords: string[]): string | null {
  const candidates = (rawLinks || [])
    .map((value) => value?.trim())
    .filter((value): value is string => !!value && /^https?:\/\//i.test(value));

  let bestUrl: string | null = null;
  let bestScore = -1;

  for (const url of candidates) {
    const score = getOfficialDomainScore(url, keywords);
    if (score > bestScore) {
      bestScore = score;
      bestUrl = url;
    }
  }

  return bestScore >= 0 ? bestUrl : null;
}

// ============ 1. AI Clean ============

async function handleAiClean(draftId: string, client: any, apiKey: string, aiModel?: string) {
  const draft = await fetchDraft(draftId, client);

  const guard = checkStatusGuard(draft, 'ai-clean');
  if (guard) return json({ error: guard }, 400);

  const protectedFields = getProtectedFields(draft);

  const result = await callAI(
    apiKey,
    'You clean government job listing data. Remove source-site branding, promotional text, source URLs, and CTA text from title and description. Return clean versions. Do NOT invent data.',
    `Clean these fields. Remove any source-site names, URLs, or promotional text:\n\nTitle: ${draft.title || 'N/A'}\nDescription: ${draft.description_summary || 'N/A'}\nOrganization: ${draft.organization_name || 'N/A'}`,
    {
      name: 'clean_fields',
      description: 'Return cleaned title, description_summary, and organization_name',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Cleaned title without source branding' },
          description_summary: { type: 'string', description: 'Cleaned description without source text' },
          organization_name: { type: 'string', description: 'Cleaned organization name' },
          changes_made: { type: 'array', items: { type: 'string' }, description: 'List of changes applied' },
        },
        required: ['title', 'description_summary', 'organization_name', 'changes_made'],
        additionalProperties: false,
      },
    },
    aiModel,
  );

  const update: Record<string, unknown> = { ai_clean_at: new Date().toISOString() };
  const skipped: string[] = [];

  if (result.title && result.title.length > 5 && !protectedFields.has('title')) {
    update.title = result.title;
  } else if (protectedFields.has('title')) skipped.push('title');

  if (result.description_summary && !protectedFields.has('description_summary')) {
    update.description_summary = result.description_summary;
  } else if (protectedFields.has('description_summary')) skipped.push('description_summary');

  if (result.organization_name && !protectedFields.has('organization_name')) {
    update.organization_name = result.organization_name;
  } else if (protectedFields.has('organization_name')) skipped.push('organization_name');

  const oldValues = snapshotOldValues(draft, update);
  update.ai_enrichment_log = appendLog(draft.ai_enrichment_log, 'ai-clean', {
    changes: result.changes_made, skipped_protected: skipped, old_values: oldValues,
  });

  update.tp_clean_status = 'stale';
  await client.from('firecrawl_draft_jobs').update(update).eq('id', draftId);
  return json({ success: true, action: 'ai-clean', changes: result.changes_made, skipped_protected: skipped });
}

// ============ 2. AI Enrich ============

async function handleAiEnrich(draftId: string, client: any, apiKey: string, aiModel?: string) {
  const draft = await fetchDraft(draftId, client);

  const guard = checkStatusGuard(draft, 'ai-enrich');
  if (guard) return json({ error: guard }, 400);

  const protectedFields = getProtectedFields(draft);
  const context = getDraftContext(draft);

  const result = await callAI(
    apiKey,
    'You are an Indian government jobs data specialist. Improve structured fields for a job listing. Fill blanks where you can infer from context. Use null for truly unknown fields. Never invent fake data.',
    `Improve these fields based on context:\n\n${context}\n\nRaw scraped text (first 3000 chars):\n${(draft.raw_scraped_text || '').substring(0, 3000)}`,
    {
      name: 'enrich_fields',
      description: 'Return improved structured job fields',
      parameters: {
        type: 'object',
        properties: {
          organization_name: { type: ['string', 'null'] },
          post_name: { type: ['string', 'null'] },
          job_role: { type: ['string', 'null'] },
          qualification: { type: ['string', 'null'] },
          age_limit: { type: ['string', 'null'] },
          application_fee: { type: ['string', 'null'] },
          selection_process: { type: ['string', 'null'] },
          description_summary: { type: ['string', 'null'] },
          category: { type: ['string', 'null'] },
          department: { type: ['string', 'null'] },
          location: { type: ['string', 'null'] },
          state: { type: ['string', 'null'] },
          city: { type: ['string', 'null'] },
          salary: { type: ['string', 'null'] },
          pay_scale: { type: ['string', 'null'] },
          application_mode: { type: ['string', 'null'] },
          fields_improved: { type: 'array', items: { type: 'string' } },
        },
        required: ['fields_improved'],
        additionalProperties: false,
      },
    },
    aiModel,
  );

  const update: Record<string, unknown> = { ai_enrich_at: new Date().toISOString() };
  const fieldsToCheck = [
    'organization_name', 'post_name', 'job_role', 'qualification', 'age_limit',
    'application_fee', 'selection_process', 'description_summary', 'category',
    'department', 'location', 'state', 'city', 'salary', 'pay_scale', 'application_mode',
  ];

  const improved: string[] = [];
  const skipped: string[] = [];

  for (const f of fieldsToCheck) {
    if (protectedFields.has(f)) { skipped.push(f); continue; }
    const newVal = result[f];
    const oldVal = draft[f];
    if (newVal && (!oldVal || (typeof newVal === 'string' && typeof oldVal === 'string' && newVal.length > oldVal.length * 1.3))) {
      update[f] = newVal;
      improved.push(f);
    }
  }

  const oldValues = snapshotOldValues(draft, update);
  update.ai_enrichment_log = appendLog(draft.ai_enrichment_log, 'ai-enrich', {
    improved, skipped_protected: skipped, old_values: oldValues,
  });

  update.tp_clean_status = 'stale';
  await client.from('firecrawl_draft_jobs').update(update).eq('id', draftId);
  return json({ success: true, action: 'ai-enrich', improved, skipped_protected: skipped });
}

// ============ 3. AI Find Official Links ============

async function handleAiFindLinks(draftId: string, client: any, apiKey: string, aiModel?: string) {
  const draft = await fetchDraft(draftId, client);
  const context = getDraftContext(draft);
  const rawLinks = (draft.raw_links_found || []).slice(0, 100).join('\n');

  const result = await callAI(
    apiKey,
    `You find official government/PSU/board/university URLs for Indian job notifications.
Rules:
- Only return URLs from .gov.in, .nic.in, .org.in, .ac.in, or verified PSU domains
- NEVER return source aggregator site URLs (no sarkari*, allgovernment*, freshersnow, etc.)
- Return null if no official URL is findable
- Provide confidence (high/medium/low) and reason`,
    `Job: ${context}\n\nAvailable links from scraped page:\n${rawLinks}\n\nOrganization: ${draft.organization_name || 'unknown'}`,
    {
      name: 'find_official_links',
      description: 'Return official notification, apply, and website URLs',
      parameters: {
        type: 'object',
        properties: {
          official_notification_url: { type: ['string', 'null'] },
          official_apply_url: { type: ['string', 'null'] },
          official_website_url: { type: ['string', 'null'] },
          confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
          reason: { type: 'string', description: 'Why these links were chosen or why not found' },
        },
        required: ['confidence', 'reason'],
        additionalProperties: false,
      },
    },
    aiModel,
  );

  const update: Record<string, unknown> = {
    ai_links_at: new Date().toISOString(),
    official_link_confidence: result.confidence,
    official_link_reason: result.reason,
  };

  // Code-level aggregator blocklist validation on AI-returned URLs
  const linkValidation: Record<string, string> = {};

  if (result.official_notification_url && !draft.official_notification_url) {
    if (isAggregatorUrl(result.official_notification_url)) {
      linkValidation.notification = 'BLOCKED: aggregator domain';
    } else {
      update.official_notification_url = result.official_notification_url;
      linkValidation.notification = 'accepted';
    }
  }
  if (result.official_apply_url && !draft.official_apply_url) {
    if (isAggregatorUrl(result.official_apply_url)) {
      linkValidation.apply = 'BLOCKED: aggregator domain';
    } else {
      update.official_apply_url = result.official_apply_url;
      linkValidation.apply = 'accepted';
    }
  }
  if (result.official_website_url && !draft.official_website_url) {
    if (isAggregatorUrl(result.official_website_url)) {
      linkValidation.website = 'BLOCKED: aggregator domain';
    } else {
      update.official_website_url = result.official_website_url;
      linkValidation.website = 'accepted';
    }
  }

  update.ai_enrichment_log = appendLog(draft.ai_enrichment_log, 'ai-find-links', {
    confidence: result.confidence,
    reason: result.reason,
    link_validation: linkValidation,
    found: {
      notification: !!result.official_notification_url,
      apply: !!result.official_apply_url,
      website: !!result.official_website_url,
    },
  });

  await client.from('firecrawl_draft_jobs').update(update).eq('id', draftId);
  return json({ success: true, action: 'ai-find-links', link_validation: linkValidation, ...result });
}

// ============ 4. AI Fix Missing ============

async function handleAiFixMissing(draftId: string, client: any, apiKey: string, aiModel?: string) {
  const draft = await fetchDraft(draftId, client);

  const protectedFields = getProtectedFields(draft);

  const weakFields: string[] = [];
  const checkFields = [
    'title', 'organization_name', 'post_name', 'job_role', 'qualification',
    'age_limit', 'application_fee', 'salary', 'selection_process', 'category',
    'department', 'location', 'state', 'application_mode', 'description_summary',
  ];

  for (const f of checkFields) {
    if (protectedFields.has(f)) continue; // skip admin-edited fields
    if (!draft[f] || (typeof draft[f] === 'string' && draft[f].length < 3)) {
      weakFields.push(f);
    }
  }

  if (weakFields.length === 0) {
    return json({ success: true, action: 'ai-fix-missing', message: 'No weak fields found', fixed: [] });
  }

  const context = getDraftContext(draft);
  const result = await callAI(
    apiKey,
    'You fill in missing fields for Indian government job listings. Only provide values for the specifically requested fields. Use null if truly unknowable. Never invent fake data.',
    `These fields are missing or weak: ${weakFields.join(', ')}\n\nExisting data:\n${context}\n\nRaw text (first 3000 chars):\n${(draft.raw_scraped_text || '').substring(0, 3000)}`,
    {
      name: 'fix_missing_fields',
      description: 'Return values for missing/weak fields only',
      parameters: {
        type: 'object',
        properties: Object.fromEntries(
          weakFields.map(f => [f, { type: ['string', 'null'] }])
        ),
        required: [],
        additionalProperties: false,
      },
    },
    aiModel,
  );

  const update: Record<string, unknown> = { ai_fix_missing_at: new Date().toISOString() };
  const fixed: string[] = [];

  for (const f of weakFields) {
    if (result[f] && result[f] !== 'null' && result[f].length > 2) {
      update[f] = result[f];
      fixed.push(f);
    }
  }

  const oldValues = snapshotOldValues(draft, update);
  update.ai_enrichment_log = appendLog(draft.ai_enrichment_log, 'ai-fix-missing', {
    targeted: weakFields, fixed, old_values: oldValues,
  });

  update.tp_clean_status = 'stale';
  await client.from('firecrawl_draft_jobs').update(update).eq('id', draftId);
  return json({ success: true, action: 'ai-fix-missing', targeted: weakFields, fixed });
}

// ============ 5. AI SEO ============

async function handleAiSeo(draftId: string, client: any, apiKey: string, aiModel?: string) {
  const draft = await fetchDraft(draftId, client);
  const protectedFields = getProtectedFields(draft);
  const context = getDraftContext(draft);

  const result = await callAI(
    apiKey,
    `You generate SEO metadata for Indian government job pages.
Rules:
- SEO title: max 60 chars, include org name + post name + year
- Meta description: 130-155 chars, actionable, include key details
- Slug: lowercase, hyphenated, 3-8 words, no source names
- Intro: 2-3 sentence intro paragraph for the page
- FAQs: 3-5 practical questions job seekers would ask`,
    `Generate SEO package for:\n\n${context}`,
    {
      name: 'generate_seo',
      description: 'Return SEO title, meta description, slug, intro, and FAQs',
      parameters: {
        type: 'object',
        properties: {
          seo_title: { type: 'string', description: 'SEO title under 60 chars' },
          meta_description: { type: 'string', description: 'Meta description 130-155 chars' },
          slug_suggestion: { type: 'string', description: 'URL slug suggestion' },
          intro_text: { type: 'string', description: '2-3 sentence intro paragraph' },
          faq_suggestions: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                question: { type: 'string' },
                answer: { type: 'string' },
              },
              required: ['question', 'answer'],
            },
            description: '3-5 FAQ items',
          },
        },
        required: ['seo_title', 'meta_description', 'slug_suggestion', 'intro_text', 'faq_suggestions'],
        additionalProperties: false,
      },
    },
    aiModel,
  );

  const update: Record<string, unknown> = { ai_seo_at: new Date().toISOString() };

  if (!protectedFields.has('seo_title')) update.seo_title = result.seo_title;
  if (!protectedFields.has('meta_description')) update.meta_description = result.meta_description;
  if (!protectedFields.has('slug_suggestion')) update.slug_suggestion = result.slug_suggestion;
  if (!protectedFields.has('intro_text')) update.intro_text = result.intro_text;
  update.faq_suggestions = result.faq_suggestions || [];

  const oldValues = snapshotOldValues(draft, update);
  update.ai_enrichment_log = appendLog(draft.ai_enrichment_log, 'ai-seo', {
    seo_title_len: result.seo_title?.length,
    meta_desc_len: result.meta_description?.length,
    faq_count: result.faq_suggestions?.length,
    old_values: oldValues,
  });

  update.tp_clean_status = 'stale';
  await client.from('firecrawl_draft_jobs').update(update).eq('id', draftId);
  return json({ success: true, action: 'ai-seo', ...result });
}

// ============ 6. AI Cover Prompt ============

async function handleAiCoverPrompt(draftId: string, client: any, apiKey: string, aiModel?: string) {
  const draft = await fetchDraft(draftId, client);
  const context = getDraftContext(draft);

  const result = await callAI(
    apiKey,
    `Generate an image prompt for a cover image of an Indian government job notification page.
Rules:
- Realistic, professional, editorial 16:9 style
- Feature fair young Indian men and women in educational/professional settings
- Include context like government buildings, offices, or exam halls if relevant
- No text overlays in the image
- Safe for all audiences`,
    `Job listing:\n${context}`,
    {
      name: 'generate_cover_prompt',
      description: 'Return a detailed image generation prompt',
      parameters: {
        type: 'object',
        properties: {
          cover_image_prompt: { type: 'string', description: 'Detailed image prompt for cover' },
        },
        required: ['cover_image_prompt'],
        additionalProperties: false,
      },
    },
    aiModel,
  );

  const update: Record<string, unknown> = {
    ai_cover_prompt_at: new Date().toISOString(),
    cover_image_prompt: result.cover_image_prompt,
    ai_enrichment_log: appendLog(draft.ai_enrichment_log, 'ai-cover-prompt', { prompt_len: result.cover_image_prompt?.length }),
  };

  await client.from('firecrawl_draft_jobs').update(update).eq('id', draftId);
  return json({ success: true, action: 'ai-cover-prompt', prompt: result.cover_image_prompt });
}

// ============ 7. AI Cover Image ============

async function handleAiCoverImage(draftId: string, client: any, apiKey: string, imageModel?: string) {
  const draft = await fetchDraft(draftId, client);

  let prompt = draft.cover_image_prompt;
  if (!prompt) {
    const promptResult = await handleAiCoverPrompt(draftId, client, apiKey);
    const promptBody = await promptResult.json();
    if (!promptBody.success) return json(promptBody, 500);
    const updated = await fetchDraft(draftId, client);
    prompt = updated.cover_image_prompt;
  }

  if (!prompt) return json({ error: 'No cover image prompt available' }, 400);

  // Resolve image model route
  const modelKey = imageModel || 'gemini-flash-image-2';
  const route = IMAGE_MODEL_REGISTRY[modelKey] || IMAGE_MODEL_REGISTRY['gemini-flash-image-2'];
  console.log(`[firecrawl-ai-enrich] cover image: model=${modelKey} provider=${route.provider} apiModel=${route.apiModel}`);

  let imageUrl: string | undefined;

  if (route.provider === 'vertex-ai') {
    // ── Vertex AI direct path with retry for 429 ──
    const { getGeminiDirectToken_REMOVED } = await import('../_shared/gemini-direct.ts');
    const accessToken = await getGeminiDirectToken_REMOVED();
    const projectId = Deno.env.get('GCP_PROJECT_ID');
    const location = Deno.env.get('GCP_LOCATION') || 'us-central1';
    const maxImageRetries = 4;

    if (route.vertexEndpoint === 'imagen') {
      // Imagen model
      const imagenUrl = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${route.apiModel}:predict`;
      for (let attempt = 0; attempt <= maxImageRetries; attempt++) {
        const imagenResp = await fetch(imagenUrl, {
          method: 'POST',
          headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            instances: [{ prompt }],
            parameters: { sampleCount: 1, aspectRatio: '16:9', personGeneration: 'allow_adult' },
          }),
        });
        if (imagenResp.status === 429 && attempt < maxImageRetries) {
          const wait = Math.min(3000 * Math.pow(2, attempt), 60000) + Math.random() * 2000;
          console.log(`[firecrawl-ai-enrich] Imagen 429, retry ${attempt + 1}/${maxImageRetries} after ${Math.round(wait)}ms`);
          await new Promise(r => setTimeout(r, wait));
          continue;
        }
        if (!imagenResp.ok) {
          const errText = await imagenResp.text().catch(() => '');
          throw new Error(`Imagen error ${imagenResp.status}: ${errText.substring(0, 300)}`);
        }
        const imagenData = await imagenResp.json();
        const b64 = imagenData.predictions?.[0]?.bytesBase64Encoded;
        if (b64) imageUrl = `data:image/png;base64,${b64}`;
        break;
      }
    } else {
      // Gemini image model via Vertex
      const isGemini3 = route.apiModel.startsWith('gemini-3');
      const apiVersion = isGemini3 ? 'v1beta1' : 'v1';
      const loc = isGemini3 ? 'global' : location;
      const host = isGemini3 ? 'aiplatform.googleapis.com' : `${location}-aiplatform.googleapis.com`;
      const vertexUrl = `https://${host}/${apiVersion}/projects/${projectId}/locations/${loc}/publishers/google/models/${route.apiModel}:generateContent`;

      for (let attempt = 0; attempt <= maxImageRetries; attempt++) {
        const vertexResp = await fetch(vertexUrl, {
          method: 'POST',
          headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: { responseModalities: ['IMAGE', 'TEXT'] },
          }),
        });
        if (vertexResp.status === 429 && attempt < maxImageRetries) {
          const wait = Math.min(3000 * Math.pow(2, attempt), 60000) + Math.random() * 2000;
          console.log(`[firecrawl-ai-enrich] Vertex image 429, retry ${attempt + 1}/${maxImageRetries} after ${Math.round(wait)}ms`);
          await new Promise(r => setTimeout(r, wait));
          continue;
        }
        if (!vertexResp.ok) {
          const errText = await vertexResp.text().catch(() => '');
          throw new Error(`Vertex image error ${vertexResp.status}: ${errText.substring(0, 300)}`);
        }
        const vertexData = await vertexResp.json();
        const parts = vertexData.candidates?.[0]?.content?.parts || [];
        for (const part of parts) {
          if (part.inlineData?.data) {
            const mime = part.inlineData.mimeType || 'image/png';
            imageUrl = `data:${mime};base64,${part.inlineData.data}`;
            break;
          }
        }
        break;
      }
    }
  } else {
    // ── Lovable AI Gateway path ──
    const resp = await fetch(AI_GATEWAY, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: route.apiModel,
        messages: [{ role: 'user', content: prompt }],
        modalities: ['image', 'text'],
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text().catch(() => '');
      if (resp.status === 429) throw new Error('Rate limited — try again shortly');
      if (resp.status === 402) throw new Error('Credits exhausted — add funds in Settings');
      throw new Error(`Image generation failed ${resp.status}: ${errText.substring(0, 300)}`);
    }

    const imgData = await resp.json();
    imageUrl = imgData.choices?.[0]?.message?.images?.[0]?.image_url?.url;
  }

  if (!imageUrl) {
    return json({ error: 'Image generation returned no image' }, 500);
  }

  const base64Data = imageUrl.replace(/^data:image\/\w+;base64,/, '');
  const bytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
  const slug = draft.slug_suggestion || draft.id;
  const storagePath = `firecrawl-covers/${slug}-${Date.now()}.png`;

  const { error: uploadErr } = await client.storage
    .from('blog-assets')
    .upload(storagePath, bytes, { contentType: 'image/png', upsert: true });

  if (uploadErr) {
    console.error('[firecrawl-ai-enrich] Upload error:', uploadErr);
    return json({ error: `Image upload failed: ${uploadErr.message}` }, 500);
  }

  const { data: { publicUrl } } = client.storage.from('blog-assets').getPublicUrl(storagePath);

  // Re-fetch draft for latest log since cover prompt may have been auto-generated
  const latestDraft = await fetchDraft(draftId, client);
  const update: Record<string, unknown> = {
    ai_cover_image_at: new Date().toISOString(),
    cover_image_url: publicUrl,
    ai_enrichment_log: appendLog(latestDraft.ai_enrichment_log, 'ai-cover-image', {
      storage_path: storagePath, model_used: modelKey, provider: route.provider,
    }),
  };

  await client.from('firecrawl_draft_jobs').update(update).eq('id', draftId);
  return json({ success: true, action: 'ai-cover-image', cover_image_url: publicUrl, model_used: modelKey });
}

// ============ 8. AI Run All ============

async function handleAiRunAll(draftId: string, client: any, apiKey: string, aiModel?: string, imageModel?: string) {
  // Check if this is a government draft — route to govt-specific pipeline
  const draft = await fetchDraft(draftId, client);
  const isGovt = draft.source_type_tag === 'government';

  const steps = isGovt
    ? ['ai-govt-extract', 'ai-find-links', 'ai-fix-missing', 'ai-govt-enrich', 'ai-cover-prompt']
    : ['ai-clean', 'ai-enrich', 'ai-find-links', 'ai-fix-missing', 'ai-seo'];

  const handlers: Record<string, Function> = {
    'ai-clean': handleAiClean,
    'ai-enrich': handleAiEnrich,
    'ai-find-links': handleAiFindLinks,
    'ai-fix-missing': handleAiFixMissing,
    'ai-seo': handleAiSeo,
    'ai-govt-extract': handleAiGovtExtract,
    'ai-govt-enrich': handleAiGovtEnrich,
  };

  const results: Array<{ step: string; success: boolean; error?: string }> = [];

  for (const step of steps) {
    try {
      const modelArg = step === 'ai-cover-image' ? imageModel : aiModel;
      const resp = await handlers[step](draftId, client, apiKey, modelArg);
      const body = await resp.json();
      results.push({ step, success: body.success ?? true, error: body.error });

      await new Promise(r => setTimeout(r, 1500));
    } catch (e) {
      results.push({ step, success: false, error: e instanceof Error ? e.message : String(e) });
    }
  }

  // Persist failed/skipped step entries into ai_enrichment_log
  const failedSteps = results.filter(r => !r.success);
  if (failedSteps.length > 0) {
    const { data: latestDraft } = await client.from('firecrawl_draft_jobs').select('ai_enrichment_log').eq('id', draftId).maybeSingle();
    if (latestDraft) {
      let log = latestDraft.ai_enrichment_log || [];
      for (const r of failedSteps) {
        const isGuard = r.error?.includes('Cannot run') || r.error?.includes('reviewed') || r.error?.includes('approved');
        log = [...log, {
          action: r.step,
          at: new Date().toISOString(),
          status: isGuard ? 'skipped' : 'failed',
          ...(isGuard ? { reason: r.error } : { error: r.error }),
        }];
      }
      await client.from('firecrawl_draft_jobs').update({ ai_enrichment_log: log }).eq('id', draftId);
    }
  }

  // Recalculate fields
  let fieldCounts = { fields_extracted: 0, fields_missing: [] as string[] };
  try { fieldCounts = await recalculateFieldCounts(draftId, client); } catch { /* draft gone */ }

  const successCount = results.filter(r => r.success).length;

  // Update status to 'enriched' + calculate publish_readiness for govt
  if (successCount > 0) {
    try {
      const updatePayload: Record<string, unknown> = {
        status: 'enriched',
        updated_at: new Date().toISOString(),
      };
      if (isGovt) {
        const readiness = await calculatePublishReadiness(draftId, client);
        updatePayload.publish_readiness = readiness;
        updatePayload.auto_publish_eligible = (readiness === 'ready_to_publish' || readiness === 'ready');
      }
      await client.from('firecrawl_draft_jobs').update(updatePayload).eq('id', draftId).eq('status', 'draft');
    } catch { /* draft gone */ }
  }
  return json({
    success: true,
    action: 'ai-run-all',
    total: steps.length,
    succeeded: successCount,
    failed: steps.length - successCount,
    results,
    fields_extracted: fieldCounts.fields_extracted,
    fields_missing: fieldCounts.fields_missing,
  });
}

// ============ GOVT: AI Deep Extract ============

async function handleAiGovtExtract(draftId: string, client: any, apiKey: string, aiModel?: string) {
  const draft = await fetchDraft(draftId, client);
  const guard = checkStatusGuard(draft, 'ai-govt-extract');
  if (guard) return json({ error: guard }, 400);

  const protectedFields = getProtectedFields(draft);
  const rawText = (draft.raw_scraped_text || '').substring(0, 12000);
  const context = getDraftContext(draft);

  const result = await callAI(
    apiKey,
    `You are a meticulous Indian government job data extractor. Extract ONLY what is explicitly stated in the source text. NEVER invent dates, links, vacancies, or eligibility criteria. Use null for anything not clearly mentioned.

CRITICAL RULES:
- Dates MUST match patterns like DD/MM/YYYY, DD.MM.YYYY, DD-MM-YYYY, or human-readable "15 July 2026". Reject freeform date text.
- URLs MUST start with http:// or https://. Never return aggregator site URLs.
- Vacancies MUST be numeric integers.
- For each critical field (dates, vacancies, links), provide an evidence_snippet — the exact text from the source that supports the value.
- If no evidence exists, set field to null and confidence to "low".
- Return field_confidence as an object mapping field names to "high"/"medium"/"low".`,
    `Extract all government job fields from this content.

Existing data:\n${context}

Source URL: ${draft.source_page_url || draft.source_url || 'unknown'}

Raw scraped text:\n${rawText}`,
    {
      name: 'govt_extract_fields',
      description: 'Extract comprehensive government job fields with confidence and evidence',
      parameters: {
        type: 'object',
        properties: {
          title: { type: ['string', 'null'] },
          organization_name: { type: ['string', 'null'] },
          post_name: { type: ['string', 'null'] },
          department: { type: ['string', 'null'] },
          advertisement_number: { type: ['string', 'null'] },
          total_vacancies: { type: ['number', 'null'] },
          vacancy_details: { type: ['string', 'null'] },
          state: { type: ['string', 'null'] },
          city: { type: ['string', 'null'] },
          location: { type: ['string', 'null'] },
          category: { type: ['string', 'null'] },
          application_mode: { type: ['string', 'null'] },
          qualification: { type: ['string', 'null'] },
          eligibility_summary: { type: ['string', 'null'] },
          age_limit: { type: ['string', 'null'] },
          age_relaxation: { type: ['string', 'null'] },
          salary: { type: ['string', 'null'] },
          pay_scale: { type: ['string', 'null'] },
          application_fee: { type: ['string', 'null'] },
          application_fee_details: { type: ['string', 'null'] },
          opening_date: { type: ['string', 'null'] },
          closing_date: { type: ['string', 'null'] },
          last_date_of_application: { type: ['string', 'null'] },
          last_date_for_fee: { type: ['string', 'null'] },
          correction_window: { type: ['string', 'null'] },
          exam_date: { type: ['string', 'null'] },
          admit_card_date: { type: ['string', 'null'] },
          result_date: { type: ['string', 'null'] },
          selection_process: { type: ['string', 'null'] },
          selection_process_details: { type: ['string', 'null'] },
          how_to_apply: { type: ['string', 'null'] },
          important_instructions: { type: ['string', 'null'] },
          official_notification_url: { type: ['string', 'null'] },
          official_apply_url: { type: ['string', 'null'] },
          official_website_url: { type: ['string', 'null'] },
          field_confidence: {
            type: 'object',
            description: 'Map of field name to confidence level (high/medium/low)',
          },
          field_evidence: {
            type: 'object',
            description: 'Map of critical field name to exact evidence snippet from source text',
          },
        },
        required: ['field_confidence', 'field_evidence'],
        additionalProperties: false,
      },
    },
    aiModel,
  );

  // Build update, respecting admin-protected fields
  const govtFields = [
    'title', 'organization_name', 'post_name', 'department', 'advertisement_number',
    'vacancy_details', 'state', 'city', 'location', 'category', 'application_mode',
    'qualification', 'eligibility_summary', 'age_limit', 'age_relaxation',
    'salary', 'pay_scale', 'application_fee', 'application_fee_details',
    'opening_date', 'closing_date', 'last_date_of_application', 'last_date_for_fee',
    'correction_window', 'exam_date', 'admit_card_date', 'result_date',
    'selection_process', 'selection_process_details', 'how_to_apply', 'important_instructions',
  ];

  const update: Record<string, unknown> = {
    ai_govt_extract_at: new Date().toISOString(),
    source_type_tag: 'government',
  };
  const improved: string[] = [];
  const skipped: string[] = [];

  for (const f of govtFields) {
    if (protectedFields.has(f)) { skipped.push(f); continue; }
    const newVal = result[f];
    if (newVal !== null && newVal !== undefined && newVal !== 'null') {
      // Validate URLs
      if (f.includes('url') && typeof newVal === 'string') {
        if (!/^https?:\/\//i.test(newVal) || isAggregatorUrl(newVal)) continue;
      }
      // Validate vacancies
      if (f === 'total_vacancies' && typeof newVal === 'number' && newVal > 0) {
        update.total_vacancies = newVal;
        improved.push(f);
        continue;
      }
      if (typeof newVal === 'string' && newVal.trim().length > 0) {
        update[f] = newVal.trim();
        improved.push(f);
      }
    }
  }

  // URL fields
  for (const urlField of ['official_notification_url', 'official_apply_url', 'official_website_url']) {
    if (protectedFields.has(urlField)) continue;
    const val = result[urlField];
    if (val && typeof val === 'string' && /^https?:\/\//i.test(val) && !isAggregatorUrl(val)) {
      if (!draft[urlField]) { // Only fill if empty
        update[urlField] = val;
        improved.push(urlField);
      }
    }
  }

  // Store confidence and evidence
  update.field_confidence = result.field_confidence || {};
  update.field_evidence = result.field_evidence || {};

  // Build important_dates_json from extracted date fields
  const datesJson: Record<string, string> = {};
  const dateFields = ['opening_date', 'closing_date', 'last_date_of_application', 'last_date_for_fee', 'correction_window', 'exam_date', 'admit_card_date', 'result_date'];
  for (const df of dateFields) {
    const val = update[df] || draft[df];
    if (val && typeof val === 'string') datesJson[df] = val;
  }
  update.important_dates_json = datesJson;

  // Build official_links_json
  const linksJson: Record<string, string> = {};
  for (const lf of ['official_notification_url', 'official_apply_url', 'official_website_url']) {
    const val = update[lf] || draft[lf];
    if (val && typeof val === 'string') linksJson[lf] = val;
  }
  update.official_links_json = linksJson;

  const oldValues = snapshotOldValues(draft, update);
  update.ai_enrichment_log = appendLog(draft.ai_enrichment_log, 'ai-govt-extract', {
    improved, skipped_protected: skipped, old_values: oldValues,
    confidence_summary: result.field_confidence,
  });
  update.tp_clean_status = 'stale';

  await client.from('firecrawl_draft_jobs').update(update).eq('id', draftId);
  await recalculateFieldCounts(draftId, client);

  // Calculate publish readiness
  const readiness = await calculatePublishReadiness(draftId, client);
  await client.from('firecrawl_draft_jobs').update({ publish_readiness: readiness }).eq('id', draftId);

  return json({ success: true, action: 'ai-govt-extract', improved, skipped_protected: skipped, publish_readiness: readiness });
}

// ============ GOVT: AI SEO Enrich ============

async function handleAiGovtEnrich(draftId: string, client: any, apiKey: string, aiModel?: string) {
  const draft = await fetchDraft(draftId, client);
  const protectedFields = getProtectedFields(draft);
  const context = getDraftContext(draft);

  // Build dates and links context from stored JSON
  const datesCtx = draft.important_dates_json ? JSON.stringify(draft.important_dates_json) : 'No dates available';
  const linksCtx = draft.official_links_json ? JSON.stringify(draft.official_links_json) : 'No links available';

  const result = await callAI(
    apiKey,
    `You generate SEO metadata and structured content sections for Indian government job notification pages.

ANTI-HALLUCINATION RULES:
- Only include dates/links/numbers that appear in the provided source data
- If a section has no data, OMIT it entirely — do not generate placeholder content
- Never fabricate FAQ answers — use only verified extracted information
- Never invent application fees, eligibility criteria, or selection process details
- Keep content factual, useful, concise, and not stuffed with spammy SEO`,
    `Generate a comprehensive SEO package for this government job notification:

${context}

Advertisement Number: ${draft.advertisement_number || 'N/A'}
Eligibility: ${draft.eligibility_summary || draft.qualification || 'N/A'}
Age Limit: ${draft.age_limit || 'N/A'}
Age Relaxation: ${draft.age_relaxation || 'N/A'}
Application Fee: ${draft.application_fee_details || draft.application_fee || 'N/A'}
Selection Process: ${draft.selection_process_details || draft.selection_process || 'N/A'}
How to Apply: ${draft.how_to_apply || 'N/A'}
Important Dates: ${datesCtx}
Official Links: ${linksCtx}
Vacancy Details: ${draft.vacancy_details || 'N/A'}`,
    {
      name: 'govt_seo_enrich',
      description: 'Return SEO title, meta, slug, intro, structured sections, and FAQs for govt job page',
      parameters: {
        type: 'object',
        properties: {
          seo_title: { type: 'string', description: 'SEO title under 60 chars' },
          meta_description: { type: 'string', description: 'Meta description 130-155 chars' },
          slug_suggestion: { type: 'string', description: 'URL slug suggestion' },
          intro_text: { type: 'string', description: '2-3 sentence intro paragraph grounded in source data' },
          description_summary: { type: 'string', description: 'Comprehensive job description summary (3-5 paragraphs) covering key details' },
          faq_suggestions: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                question: { type: 'string' },
                answer: { type: 'string' },
              },
              required: ['question', 'answer'],
            },
            description: '4-6 FAQ items grounded in extracted data only',
          },
        },
        required: ['seo_title', 'meta_description', 'slug_suggestion', 'intro_text', 'faq_suggestions'],
        additionalProperties: false,
      },
    },
    aiModel,
  );

  const update: Record<string, unknown> = { ai_govt_enrich_at: new Date().toISOString() };

  if (!protectedFields.has('seo_title')) update.seo_title = result.seo_title;
  if (!protectedFields.has('meta_description')) update.meta_description = result.meta_description;
  if (!protectedFields.has('slug_suggestion')) update.slug_suggestion = result.slug_suggestion;
  if (!protectedFields.has('intro_text')) update.intro_text = result.intro_text;
  if (result.description_summary && !protectedFields.has('description_summary')) {
    update.description_summary = result.description_summary;
  }
  update.faq_suggestions = result.faq_suggestions || [];

  const oldValues = snapshotOldValues(draft, update);
  update.ai_enrichment_log = appendLog(draft.ai_enrichment_log, 'ai-govt-enrich', {
    seo_title_len: result.seo_title?.length,
    meta_desc_len: result.meta_description?.length,
    faq_count: result.faq_suggestions?.length,
    old_values: oldValues,
  });
  update.tp_clean_status = 'stale';

  await client.from('firecrawl_draft_jobs').update(update).eq('id', draftId);

  // Recalculate publish readiness
  const readiness = await calculatePublishReadiness(draftId, client);
  await client.from('firecrawl_draft_jobs').update({ publish_readiness: readiness }).eq('id', draftId);

  return json({ success: true, action: 'ai-govt-enrich', ...result, publish_readiness: readiness });
}

// ============ GOVT: AI Retry Low-Confidence ============

async function handleAiGovtRetry(draftId: string, client: any, apiKey: string, aiModel?: string) {
  const draft = await fetchDraft(draftId, client);
  if (draft.source_type_tag !== 'government') {
    return json({ error: 'ai-govt-retry is only for government drafts' }, 400);
  }

  const confidence = (draft.field_confidence || {}) as Record<string, string>;
  const criticalFields = ['title', 'organization_name', 'closing_date', 'official_apply_url', 'official_notification_url', 'total_vacancies'];
  const lowFields = criticalFields.filter(f => !confidence[f] || confidence[f] === 'low' || !draft[f]);

  if (lowFields.length === 0) {
    return json({ success: true, action: 'ai-govt-retry', message: 'No low-confidence critical fields to retry', retried: [] });
  }

  const rawText = (draft.raw_scraped_text || '').substring(0, 20000);
  const context = getDraftContext(draft);

  const result = await callAI(
    apiKey,
    `You are retrying extraction for specific low-confidence fields in an Indian government job listing. Focus ONLY on the requested fields. Use the extended raw text to find values missed in the first pass. Return null if still not findable. Provide evidence snippets.`,
    `Retry extraction for these low-confidence fields: ${lowFields.join(', ')}

Existing data:\n${context}

Extended raw text (up to 20K chars):\n${rawText}`,
    {
      name: 'govt_retry_extract',
      description: 'Return improved values for low-confidence fields',
      parameters: {
        type: 'object',
        properties: Object.fromEntries(
          lowFields.map(f => [f, f === 'total_vacancies' ? { type: ['number', 'null'] } : { type: ['string', 'null'] }])
        ),
        required: [],
        additionalProperties: false,
      },
    },
    aiModel,
  );

  const update: Record<string, unknown> = {};
  const retried: string[] = [];

  for (const f of lowFields) {
    const newVal = result[f];
    if (newVal !== null && newVal !== undefined && newVal !== 'null') {
      if (f === 'total_vacancies' && typeof newVal === 'number' && newVal > 0) {
        update[f] = newVal;
        retried.push(f);
      } else if (typeof newVal === 'string' && newVal.trim().length > 0) {
        if (f.includes('url')) {
          if (/^https?:\/\//i.test(newVal) && !isAggregatorUrl(newVal)) {
            update[f] = newVal.trim();
            retried.push(f);
          }
        } else {
          update[f] = newVal.trim();
          retried.push(f);
        }
      }
    }
  }

  // Update confidence for retried fields
  const newConfidence = { ...confidence };
  for (const f of retried) {
    newConfidence[f] = 'medium'; // Upgraded from low
  }
  update.field_confidence = newConfidence;

  update.ai_enrichment_log = appendLog(draft.ai_enrichment_log, 'ai-govt-retry', {
    targeted: lowFields, retried, upgraded_confidence: retried,
  });

  if (Object.keys(update).length > 2) { // more than just log + confidence
    update.tp_clean_status = 'stale';
  }

  await client.from('firecrawl_draft_jobs').update(update).eq('id', draftId);
  await recalculateFieldCounts(draftId, client);

  const readiness = await calculatePublishReadiness(draftId, client);
  await client.from('firecrawl_draft_jobs').update({ publish_readiness: readiness }).eq('id', draftId);

  return json({ success: true, action: 'ai-govt-retry', targeted: lowFields, retried, publish_readiness: readiness });
}

// ============ GOVT: Publish Readiness Calculator ============

async function calculatePublishReadiness(draftId: string, client: any): Promise<string> {
  const draft = await fetchDraft(draftId, client);

  // Already promoted
  if (draft.status === 'promoted') return 'published';

  const confidence = (draft.field_confidence || {}) as Record<string, string>;
  const hasTitle = !!(draft.title && draft.title.trim().length > 10);
  const hasOrg = !!(draft.organization_name && draft.organization_name.trim().length > 2);
  const hasClosingDate = !!(draft.closing_date || draft.last_date_of_application);
  const hasLink = !!(draft.official_apply_url || draft.official_notification_url);
  const hasSeo = !!(draft.seo_title && draft.meta_description && draft.slug_suggestion);
  const hasContent = !!(draft.description_summary || draft.intro_text);
  const isCleaned = draft.tp_clean_status === 'cleaned';
  const noDup = draft.dedup_status !== 'duplicate';
  const aiDone = !!(draft.ai_govt_extract_at || draft.ai_enrich_at);

  if (!hasTitle || !hasOrg) return 'incomplete';

  // Check for retry exhaustion
  const retryCount = draft.retry_count || 0;
  const criticalLow = ['title', 'organization_name', 'closing_date'].some(f => confidence[f] === 'low');

  if (criticalLow && retryCount >= 3) return 'failed';
  if (criticalLow) return 'retry_needed';

  // Full gates for auto-publish
  if (hasTitle && hasOrg && hasLink && hasSeo && hasContent && isCleaned && noDup && aiDone) {
    if (hasClosingDate) return 'ready_to_publish';
    // Exception path: notification exists but dates pending
    if (draft.official_notification_url) return 'review_needed';
  }

  if (hasClosingDate && hasLink) {
    const allMediumOrHigh = ['title', 'organization_name'].every(f => !confidence[f] || confidence[f] !== 'low');
    if (allMediumOrHigh) return 'ready';
  }

  return 'review_needed';
}

// ============ 9b. AI Fix Fields (comprehensive field fill + recalculate) ============

async function handleAiFixFields(draftId: string, client: any, apiKey: string, aiModel?: string) {
  const draft = await fetchDraft(draftId, client);
  const protectedFields = getProtectedFields(draft);

  // Only target actionable required fields; optional gaps like exam_date should not trigger bulk field fixing.
  const missingFields: string[] = [];
  for (const f of ACTIONABLE_FIX_FIELDS) {
    if (protectedFields.has(f)) continue;
    const val = draft[f];
    if (val === null || val === undefined || (typeof val === 'string' && val.trim().length === 0)) {
      missingFields.push(f);
    }
  }

  if (missingFields.length === 0) {
    const fieldCounts = await recalculateFieldCounts(draftId, client);
    return json({ success: true, action: 'ai-fix-fields', message: 'No actionable missing fields', fixed: [], no_changes: true, fields_extracted: fieldCounts.fields_extracted, fields_missing: fieldCounts.fields_missing });
  }

  const fallbackValues: Record<string, unknown> = {};
  if (missingFields.includes('official_notification_url')) {
    const notificationUrl = findBestOfficialUrlFromRawLinks(draft.raw_links_found, ['notification', 'advt', 'advertisement', 'pdf']);
    if (notificationUrl) fallbackValues.official_notification_url = notificationUrl;
  }
  if (missingFields.includes('official_apply_url')) {
    const applyUrl = findBestOfficialUrlFromRawLinks(draft.raw_links_found, ['apply', 'registration', 'application', 'recruit']);
    if (applyUrl) fallbackValues.official_apply_url = applyUrl;
  }
  if (missingFields.includes('official_website_url')) {
    const websiteUrl = findBestOfficialUrlFromRawLinks(draft.raw_links_found, ['official', 'website', 'home']);
    if (websiteUrl) fallbackValues.official_website_url = websiteUrl;
  }

  const context = getDraftContext(draft);
  const result = await callAI(
    apiKey,
    `You are an Indian government jobs data specialist. Fill in missing fields for a job listing based on available context, raw scraped text, and known raw links.
CRITICAL RULES:
- Return the BEST possible value for each field. Infer from context when not explicitly stated.
- For 'state': Infer from organization name, location, or source URL (e.g. "UPPSC" → "Uttar Pradesh", "MPSC" → "Maharashtra", "BPSC" → "Bihar"). Return full state name.
- For 'city': Infer from location field or organization headquarters if known.
- For 'category': Use standard categories like "Central Govt", "State Govt", "Banking", "Railway", "Defence", "Teaching", "Police", "PSU", "SSC", "UPSC" based on the organization.
- For 'department': Infer from organization name (e.g. "Ministry of Defence" → "Defence").
- For 'application_mode': Default to "Online" if an apply link or website exists.
- For 'total_vacancies': Return integer only when explicitly stated in source text.
- For date fields: Return the exact human-readable date text found in source.
- For URL fields: Only return real official organization/government URLs (.gov.in, .nic.in, .ac.in), never aggregator URLs.
- Use null ONLY if absolutely unknowable even by inference.
- Never invent fake data, but DO use reasonable inference from org names, URLs, and context.`,
    `These fields are missing: ${missingFields.join(', ')}\n\nExisting data:\n${context}\n\nKnown raw links:\n${(draft.raw_links_found || []).slice(0, 80).join('\n') || 'None'}\n\nDeterministic link candidates already found:\n${JSON.stringify(fallbackValues, null, 2)}\n\nRaw text (first 12000 chars):\n${(draft.raw_scraped_text || '').substring(0, 12000)}`,
    {
      name: 'fix_all_fields',
      description: 'Return values for all missing fields',
      parameters: {
        type: 'object',
        properties: Object.fromEntries(
          missingFields.map((f) => [
            f,
            f === 'total_vacancies'
              ? { type: ['number', 'string', 'null'] }
              : { type: ['string', 'null'] },
          ])
        ),
        required: [],
        additionalProperties: false,
      },
    },
    aiModel,
  );

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  const fixed: string[] = [];

  // Fields where even a single character is a valid value (e.g. state abbreviations)
  const shortAllowedFields = new Set(['state', 'city', 'category', 'department', 'application_mode', 'location']);

  for (const f of missingFields) {
    const val = result[f] ?? fallbackValues[f];
    const minLen = shortAllowedFields.has(f) ? 1 : 2;
    if (val && val !== 'null' && val !== 'N/A' && val !== 'NA' && val !== 'Unknown' && val !== 'Not Available' && (typeof val === 'string' ? val.trim().length >= minLen : true)) {
      // For numeric fields like total_vacancies
      if (f === 'total_vacancies') {
        const num = typeof val === 'number' ? val : parseInt(String(val), 10);
        if (!isNaN(num) && num > 0) { update[f] = num; fixed.push(f); }
      } else if ((f === 'official_notification_url' || f === 'official_apply_url' || f === 'official_website_url') && typeof val === 'string') {
        // Accept any valid URL that is NOT an aggregator domain
        // Previously this required .gov.in/.nic.in/.org.in/.ac.in which rejected legitimate org sites like sbi.co.in
        const trimmedUrl = val.trim();
        if (trimmedUrl && /^https?:\/\//i.test(trimmedUrl) && !isAggregatorUrl(trimmedUrl)) {
          update[f] = trimmedUrl;
          fixed.push(f);
        }
      } else {
        update[f] = typeof val === 'string' ? val.trim() : val;
        fixed.push(f);
      }
    }
  }

  const oldValues = snapshotOldValues(draft, update);
  const noChanges = fixed.length === 0;

  // ALWAYS set ai_fix_missing_at to prevent endless re-processing
  update.ai_fix_missing_at = new Date().toISOString();

  if (noChanges) {
    update.ai_enrichment_log = appendCustomLog(draft.ai_enrichment_log, 'ai-fix-fields', 'skipped', {
      targeted: missingFields,
      fixed,
      reason: 'No new values could be derived from raw text or raw links',
      fallback_candidates: fallbackValues,
      old_values: oldValues,
    });
  } else {
    update.ai_enrichment_log = appendCustomLog(draft.ai_enrichment_log, 'ai-fix-fields', 'success', {
      targeted: missingFields,
      fixed,
      fallback_candidates: fallbackValues,
      old_values: oldValues,
    });
  }

  await client.from('firecrawl_draft_jobs').update(update).eq('id', draftId);

  // Recalculate field counts
  const fieldCounts = await recalculateFieldCounts(draftId, client);

  return json({
    success: true,
    action: 'ai-fix-fields',
    targeted: missingFields,
    fixed,
    no_changes: noChanges,
    message: noChanges ? 'No fixable values found from current source data' : `Fixed ${fixed.length} field(s)`,
    fields_extracted: fieldCounts.fields_extracted,
    fields_missing: fieldCounts.fields_missing,
  });
}

// ============ 10. Rollback Last AI Action ============

async function handleRollbackAiAction(draftId: string, client: any) {
  const draft = await fetchDraft(draftId, client);
  const log = draft.ai_enrichment_log as any[] | null;

  if (!log || log.length === 0) {
    return json({ error: 'No AI actions to rollback' }, 400);
  }

  // Find the last log entry that has old_values
  let lastWithOldValues: any = null;
  let lastIndex = -1;
  for (let i = log.length - 1; i >= 0; i--) {
    if (log[i].old_values && Object.keys(log[i].old_values).length > 0) {
      lastWithOldValues = log[i];
      lastIndex = i;
      break;
    }
  }

  if (!lastWithOldValues) {
    return json({ error: 'No rollback data found — last action had no field changes' }, 400);
  }

  const restoredFields = Object.keys(lastWithOldValues.old_values);
  const update: Record<string, unknown> = { ...lastWithOldValues.old_values };

  // Append rollback log entry
  update.ai_enrichment_log = appendLog(log, 'rollback', {
    rolled_back_action: lastWithOldValues.action,
    rolled_back_at: lastWithOldValues.at,
    restored_fields: restoredFields,
  });

  await client.from('firecrawl_draft_jobs').update(update).eq('id', draftId);

  return json({
    success: true,
    action: 'rollback',
    rolled_back: lastWithOldValues.action,
    restored_fields: restoredFields,
  });
}

// ============ GOVT: Validate for Auto-Publish ============

async function handleGovtValidatePublish(draftId: string, client: any) {
  const draft = await fetchDraft(draftId, client);
  const errors: string[] = [];
  const warnings: string[] = [];

  // Gate 1: Title
  if (!draft.title || draft.title.trim().length <= 10) errors.push('Title missing or too short (>10 chars)');
  // Gate 2: Organization
  if (!draft.organization_name || draft.organization_name.trim().length <= 2) errors.push('Organization name missing');
  // Gate 3: Official source URL
  const hasOfficialLink = !!(draft.official_notification_url || draft.official_apply_url);
  if (!hasOfficialLink) errors.push('No official notification or apply link');
  else {
    const link = draft.official_apply_url || draft.official_notification_url;
    if (link && isAggregatorUrl(link)) errors.push('Official link points to aggregator domain');
  }
  // Gate 4: No low-confidence critical fields
  const confidence = (draft.field_confidence || {}) as Record<string, string>;
  const lowCritical = ['title', 'organization_name', 'closing_date'].filter(f => confidence[f] === 'low');
  if (lowCritical.length > 0) errors.push(`Low confidence on: ${lowCritical.join(', ')}`);
  // Gate 5: TP cleaned
  if (draft.tp_clean_status !== 'cleaned') errors.push('Third-party cleaner not run');
  // Gate 6: No unresolved duplicate
  if (draft.dedup_status === 'duplicate') errors.push('Unresolved duplicate');
  // Gate 7: Content above minimum
  if (!draft.description_summary && !draft.intro_text) errors.push('No description or intro text');
  // Gate 8: SEO metadata
  if (!draft.seo_title) errors.push('SEO title not generated');
  if (!draft.meta_description) errors.push('Meta description not generated');
  if (!draft.slug_suggestion) errors.push('URL slug not generated');
  // Gate 9: AI enrichment completed
  if (!draft.ai_govt_extract_at && !draft.ai_enrich_at) errors.push('AI enrichment not completed');

  // Exception path: dates pending but notification is valid
  if (!draft.closing_date && !draft.last_date_of_application && hasOfficialLink) {
    warnings.push('dates_pending');
  }
  if (!draft.cover_image_url) warnings.push('No cover image');

  const eligible = errors.length === 0;
  const readiness = eligible
    ? (warnings.length === 0 ? 'ready_to_publish' : 'review_needed')
    : (!draft.title || !draft.organization_name ? 'incomplete' : 'review_needed');

  await client.from('firecrawl_draft_jobs').update({
    auto_publish_eligible: eligible,
    publish_rejection_reasons: errors.length > 0 ? errors : null,
    publish_readiness: readiness,
    updated_at: new Date().toISOString(),
  }).eq('id', draftId);

  return json({ success: true, action: 'govt-validate-publish', eligible, errors, warnings, publish_readiness: readiness });
}

// ============ GOVT: Auto-Publish Single ============

async function handleGovtAutoPublish(draftId: string, client: any) {
  const draft = await fetchDraft(draftId, client);

  // Run validation inline
  const valResp = await handleGovtValidatePublish(draftId, client);
  const valBody = await valResp.clone().json();

  if (!valBody.eligible) {
    return json({
      success: false, action: 'govt-auto-publish',
      errors: valBody.errors,
      publish_readiness: valBody.publish_readiness,
      message: `Not eligible: ${valBody.errors?.join('; ')}`,
    });
  }

  // Build slug
  const slug = draft.slug_suggestion ||
    draft.normalized_title ||
    draft.title?.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') ||
    `job-${draft.id.slice(0, 8)}`;

  // Build rich description from govt fields
  const descParts: string[] = [];
  if (draft.intro_text) descParts.push(draft.intro_text);
  if (draft.description_summary) descParts.push(draft.description_summary);
  if (draft.eligibility_summary) descParts.push(`<h3>Eligibility</h3><p>${draft.eligibility_summary}</p>`);
  if (draft.how_to_apply) descParts.push(`<h3>How to Apply</h3><p>${draft.how_to_apply}</p>`);
  if (draft.important_instructions) descParts.push(`<h3>Important Instructions</h3><p>${draft.important_instructions}</p>`);
  const richDescription = descParts.join('\n\n');

  // Build FAQ HTML
  let faqHtml: string | null = null;
  if (draft.faq_suggestions && Array.isArray(draft.faq_suggestions) && draft.faq_suggestions.length > 0) {
    faqHtml = draft.faq_suggestions.map((f: any) =>
      `<div><h3>${f.question || f.q || ''}</h3><p>${f.answer || f.a || ''}</p></div>`
    ).join('');
  }

  const jobData = {
    org_name: draft.organization_name,
    post: draft.post_name || draft.title,
    enriched_title: draft.seo_title || draft.title,
    enriched_description: richDescription,
    description: draft.description_summary || draft.intro_text || '',
    meta_title: draft.seo_title,
    meta_description: draft.meta_description,
    slug,
    state: draft.state,
    location: draft.location || draft.city,
    salary: draft.salary || draft.pay_scale,
    qualification: draft.qualification,
    age_limit: draft.age_limit,
    application_mode: draft.application_mode,
    last_date: draft.last_date_of_application || draft.closing_date,
    total_vacancies: draft.total_vacancies,
    apply_link: draft.official_apply_url || draft.official_notification_url,
    faq_html: faqHtml,
    keywords: draft.category ? [draft.category] : null,
    job_category: draft.category,
    advertisement_number: draft.advertisement_number,
    source: 'TrueJobs',
    status: 'published',
    published_at: new Date().toISOString(),
  };

  let promotedJobId = draft.promoted_job_id;
  let action_type = 'inserted';

  try {
    if (promotedJobId) {
      // Update existing
      const { error } = await client.from('employment_news_jobs').update(jobData).eq('id', promotedJobId);
      if (error) throw new Error(error.message);
      action_type = 'updated_existing';
    } else {
      // Check for slug match
      const { data: existing } = await client.from('employment_news_jobs').select('id').eq('slug', slug).maybeSingle();
      if (existing) {
        const { error } = await client.from('employment_news_jobs').update(jobData).eq('id', existing.id);
        if (error) throw new Error(error.message);
        promotedJobId = existing.id;
        action_type = 'updated_by_slug';
      } else {
        const { data: inserted, error } = await client.from('employment_news_jobs').insert(jobData).select('id').single();
        if (error) throw new Error(error.message);
        promotedJobId = inserted.id;
        action_type = 'inserted';
      }
    }

    // Update draft
    await client.from('firecrawl_draft_jobs').update({
      status: 'promoted',
      promoted_job_id: promotedJobId,
      auto_published_at: new Date().toISOString(),
      publish_readiness: 'published',
      auto_publish_eligible: false,
      ai_enrichment_log: appendLog(draft.ai_enrichment_log, 'govt-auto-publish', {
        promoted_job_id: promotedJobId,
        action_type,
        slug,
      }),
      updated_at: new Date().toISOString(),
    }).eq('id', draftId);

    return json({ success: true, action: 'govt-auto-publish', promoted_job_id: promotedJobId, action_type, slug });
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e);
    await client.from('firecrawl_draft_jobs').update({
      publish_readiness: 'review_needed',
      ai_enrichment_log: appendCustomLog(draft.ai_enrichment_log, 'govt-auto-publish', 'failed', { error: errMsg }),
      updated_at: new Date().toISOString(),
    }).eq('id', draftId);
    return json({ success: false, action: 'govt-auto-publish', error: errMsg });
  }
}

// ============ GOVT: Auto-Publish Batch ============

async function handleGovtAutoPublishBatch(client: any) {
  const { data: eligibleDrafts, error } = await client
    .from('firecrawl_draft_jobs')
    .select('id, title')
    .eq('source_type_tag', 'government')
    .eq('tp_clean_status', 'cleaned')
    .neq('status', 'promoted')
    .in('publish_readiness', ['ready', 'ready_to_publish'])
    .order('created_at', { ascending: true })
    .limit(50);

  if (error) return json({ error: error.message }, 500);
  if (!eligibleDrafts || eligibleDrafts.length === 0) {
    return json({ success: true, action: 'govt-auto-publish-batch', published: 0, failed: 0, skipped: 0, message: 'No eligible drafts' });
  }

  let published = 0, failed = 0;
  const results: any[] = [];

  for (const draft of eligibleDrafts) {
    try {
      const resp = await handleGovtAutoPublish(draft.id, client);
      const body = await resp.clone().json();
      if (body.success) {
        published++;
        results.push({ id: draft.id, title: draft.title, success: true, action_type: body.action_type });
      } else {
        failed++;
        results.push({ id: draft.id, title: draft.title, success: false, error: body.error || body.message });
      }
    } catch (e) {
      failed++;
      results.push({ id: draft.id, title: draft.title, success: false, error: e instanceof Error ? e.message : String(e) });
    }
    // Rate limit
    await sleep(1000);
  }

  return json({ success: true, action: 'govt-auto-publish-batch', published, failed, total: eligibleDrafts.length, results });
}

// ============ GOVT: Retry Failed ============

async function handleGovtRetryFailed(draftId: string, client: any, apiKey: string, aiModel?: string) {
  const draft = await fetchDraft(draftId, client);
  const retryCount = draft.retry_count || 0;

  if (retryCount >= 3) {
    await client.from('firecrawl_draft_jobs').update({
      publish_readiness: 'failed',
      updated_at: new Date().toISOString(),
    }).eq('id', draftId);
    return json({ success: false, action: 'govt-retry-failed', error: 'Max retries (3) exceeded', retry_count: retryCount });
  }

  // Re-run govt extract with expanded context
  try {
    const extractResp = await handleAiGovtExtract(draftId, client, apiKey, aiModel);
    await sleep(2000);

    // Re-run fix missing
    await handleAiFixMissing(draftId, client, apiKey, aiModel);
  } catch (e) {
    // Log but continue
    console.error(`[govt-retry-failed] Error during re-extraction: ${e}`);
  }

  // Increment retry count
  const readiness = await calculatePublishReadiness(draftId, client);
  await client.from('firecrawl_draft_jobs').update({
    retry_count: retryCount + 1,
    last_retry_at: new Date().toISOString(),
    publish_readiness: readiness,
    ai_enrichment_log: appendLog(draft.ai_enrichment_log, 'govt-retry-failed', {
      retry_attempt: retryCount + 1,
      new_readiness: readiness,
    }),
    updated_at: new Date().toISOString(),
  }).eq('id', draftId);

  return json({ success: true, action: 'govt-retry-failed', retry_count: retryCount + 1, publish_readiness: readiness });
}

// ============ Helpers ============

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
