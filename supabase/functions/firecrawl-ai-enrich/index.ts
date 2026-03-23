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

    if (!action) return json({ error: 'Missing action' }, 400);
    if (!draftId && action !== 'ai-run-all-batch') return json({ error: 'Missing draft_id' }, 400);

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
      case 'ai-cover-image': return await handleAiCoverImage(draftId, client, lovableKey, aiModel);
      case 'ai-run-all': return await handleAiRunAll(draftId, client, lovableKey, aiModel);
      case 'rollback-ai-action': return await handleRollbackAiAction(draftId, client);
      default: return json({ error: `Unknown action: ${action}` }, 400);
    }
  } catch (e) {
    console.error('[firecrawl-ai-enrich] Error:', e);
    return json({ error: e instanceof Error ? e.message : 'Internal error' }, 500);
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
    const { callVertexGemini } = await import('../_shared/vertex-ai.ts');
    const fullPrompt = `${systemPrompt}\n\n${userPrompt}${toolDef ? `\n\nReturn valid JSON matching this schema:\n${JSON.stringify(toolDef.parameters, null, 2)}` : ''}`;
    const text = await callVertexGemini(vertexDef.vertexModel, fullPrompt, vertexDef.timeoutMs);
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

  const resp = await fetch(AI_GATEWAY, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(bodyPayload),
  });

  if (!resp.ok) {
    const errText = await resp.text().catch(() => '');
    if (resp.status === 429) throw new Error('Rate limited — try again shortly');
    if (resp.status === 402) throw new Error('Credits exhausted — add funds in Settings');
    throw new Error(`AI gateway error ${resp.status}: ${errText.substring(0, 300)}`);
  }

  const data = await resp.json();

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
    .single();
  if (error || !data) throw new Error('Draft not found');
  return data;
}

/** Get the set of admin-edited fields that AI should not overwrite */
function getProtectedFields(draft: any): Set<string> {
  return new Set(draft.admin_edited_fields || []);
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
  return [...(existing || []), { action, at: new Date().toISOString(), ...result }];
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

async function handleAiCoverImage(draftId: string, client: any, apiKey: string, aiModel?: string) {
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

  const resp = await fetch(AI_GATEWAY, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-3.1-flash-image-preview',
      messages: [{ role: 'user', content: prompt }],
      modalities: ['image', 'text'],
    }),
  });

  if (!resp.ok) {
    const errText = await resp.text().catch(() => '');
    throw new Error(`Image generation failed ${resp.status}: ${errText.substring(0, 300)}`);
  }

  const imgData = await resp.json();
  const imageUrl = imgData.choices?.[0]?.message?.images?.[0]?.image_url?.url;

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

  const update: Record<string, unknown> = {
    ai_cover_image_at: new Date().toISOString(),
    cover_image_url: publicUrl,
    ai_enrichment_log: appendLog(draft.ai_enrichment_log, 'ai-cover-image', { storage_path: storagePath }),
  };

  await client.from('firecrawl_draft_jobs').update(update).eq('id', draftId);
  return json({ success: true, action: 'ai-cover-image', cover_image_url: publicUrl });
}

// ============ 8. AI Run All ============

async function handleAiRunAll(draftId: string, client: any, apiKey: string, aiModel?: string) {
  const steps = [
    'ai-clean', 'ai-enrich', 'ai-find-links', 'ai-fix-missing', 'ai-seo', 'ai-cover-prompt', 'ai-cover-image',
  ];
  const handlers: Record<string, Function> = {
    'ai-clean': handleAiClean,
    'ai-enrich': handleAiEnrich,
    'ai-find-links': handleAiFindLinks,
    'ai-fix-missing': handleAiFixMissing,
    'ai-seo': handleAiSeo,
    'ai-cover-prompt': handleAiCoverPrompt,
    'ai-cover-image': handleAiCoverImage,
  };

  const results: Array<{ step: string; success: boolean; error?: string }> = [];

  for (const step of steps) {
    try {
      const resp = await handlers[step](draftId, client, apiKey, aiModel);
      const body = await resp.json();
      results.push({ step, success: body.success ?? true, error: body.error });

      await new Promise(r => setTimeout(r, 1500));
    } catch (e) {
      results.push({ step, success: false, error: e instanceof Error ? e.message : String(e) });
    }
  }

  const successCount = results.filter(r => r.success).length;
  return json({
    success: true,
    action: 'ai-run-all',
    total: steps.length,
    succeeded: successCount,
    failed: steps.length - successCount,
    results,
  });
}

// ============ 9. Rollback Last AI Action ============

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

// ============ Helpers ============

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
