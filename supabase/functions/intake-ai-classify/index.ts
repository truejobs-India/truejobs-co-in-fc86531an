/**
 * AI Classification Edge Function for Intake Drafts.
 * Supports retry_enhanced mode for second-pass aggressive extraction.
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

const BEDROCK_MODELS = new Set(['nova-pro', 'nova-premier', 'mistral']);

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

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
      post_name: { type: 'string' },
      exam_name: { type: 'string' },
      advertisement_no: { type: 'string' },
      job_location: { type: 'string' },
      application_mode: { type: 'string', enum: ['online', 'offline', 'walk_in', 'email', 'unknown'] },
      notification_date: { type: 'string' },
      opening_date: { type: 'string' },
      closing_date: { type: 'string' },
      exam_date: { type: 'string' },
      result_date: { type: 'string' },
      admit_card_date: { type: 'string' },
      answer_key_date: { type: 'string' },
      vacancy_count: { type: 'number' },
      qualification_text: { type: 'string' },
      age_limit_text: { type: 'string' },
      salary_text: { type: 'string' },
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

const SYSTEM_PROMPT = `You are an expert classifier for TrueJobs.co.in, an Indian government jobs portal.

Your task: Analyze scraped records and classify them accurately.

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

    if (!draftIds || !Array.isArray(draftIds) || draftIds.length === 0) {
      return json({ error: 'Missing draft_ids array' }, 400);
    }
    if (draftIds.length > 20) {
      return json({ error: 'Max 20 drafts per call' }, 400);
    }

    const client = createClient(supabaseUrl, serviceRoleKey);
    const results: { id: string; status: string; error?: string }[] = [];

    // Build system prompt based on mode
    const systemPrompt = retryEnhanced ? RETRY_ENHANCED_PREFIX + SYSTEM_PROMPT : SYSTEM_PROMPT;

    for (const draftId of draftIds) {
      try {
        const { data: draft, error: fetchErr } = await client
          .from('intake_drafts').select('*').eq('id', draftId).single();

        if (fetchErr || !draft) {
          results.push({ id: draftId, status: 'error', error: 'Draft not found' });
          continue;
        }

        const evidence = [
          draft.raw_title ? `Title: ${draft.raw_title}` : '',
          draft.source_url ? `Source URL: ${draft.source_url}` : '',
          draft.source_domain ? `Source Domain: ${draft.source_domain}` : '',
          draft.raw_file_url ? `File URL: ${draft.raw_file_url}` : '',
          draft.raw_text ? `Content:\n${(draft.raw_text as string).slice(0, 4000)}` : '',
          draft.secondary_tags && (draft.secondary_tags as any[]).length > 0
            ? `Import tags: ${(draft.secondary_tags as string[]).join(', ')}` : '',
          // For retry, include previously extracted fields as additional context
          retryEnhanced && draft.normalized_title ? `Previous title extraction: ${draft.normalized_title}` : '',
          retryEnhanced && draft.organisation_name ? `Previous org extraction: ${draft.organisation_name}` : '',
          retryEnhanced && draft.classification_reason ? `Previous classification note: ${draft.classification_reason}` : '',
        ].filter(Boolean).join('\n\n');

        const userPrompt = retryEnhanced
          ? `SECOND-PASS: Re-classify this record with deeper extraction:\n\n${evidence}`
          : `Classify this scraped record:\n\n${evidence}`;

        const aiResult = await callAI(lovableKey, systemPrompt, userPrompt, CLASSIFICATION_TOOL, aiModel);

        const existingTags = Array.isArray(draft.secondary_tags) ? draft.secondary_tags as string[] : [];
        const aiTags = Array.isArray(aiResult.secondary_tags) ? aiResult.secondary_tags : [];
        const mergedTags = [...new Set([...existingTags, ...aiTags])];

        const update: Record<string, any> = {
          content_type: aiResult.content_type,
          primary_status: aiResult.primary_status,
          publish_target: aiResult.publish_target,
          confidence_score: aiResult.confidence_score,
          classification_reason: aiResult.classification_reason,
          secondary_tags: mergedTags,
          publish_blockers: aiResult.publish_blockers || [],
          processing_status: 'ai_processed',
          ai_model_used: aiModel || 'default',
          ai_processed_at: new Date().toISOString(),
        };

        const optionalFields = [
          'normalized_title', 'seo_title', 'slug', 'meta_description', 'summary',
          'organisation_name', 'department_name', 'post_name', 'exam_name',
          'advertisement_no', 'job_location', 'application_mode',
          'notification_date', 'opening_date', 'closing_date', 'exam_date',
          'result_date', 'admit_card_date', 'answer_key_date',
          'vacancy_count', 'qualification_text', 'age_limit_text', 'salary_text',
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
          results.push({ id: draftId, status: 'ok' });
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
