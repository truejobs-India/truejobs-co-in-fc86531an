import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── Text sanitization ──
function sanitizeText(raw: string): string {
  return raw
    .replace(/[ \t]+/g, ' ')
    .replace(/[_]{4,}/g, '')
    .replace(/[-]{4,}/g, '')
    .replace(/[=]{4,}/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .join('\n')
    .trim();
}

// ── Model resolution ──
interface ResolvedModel {
  provider: 'vertex-ai' | 'lovable-gateway' | 'groq' | 'anthropic' | 'bedrock' | 'azure-openai' | 'azure-gpt41-mini' | 'azure-deepseek' | 'sarvam';
  modelId: string;
  timeout: number;
}

function resolveModel(aiModel: string | undefined): ResolvedModel {
  switch (aiModel) {
    case 'vertex-flash':
      return { provider: 'vertex-ai', modelId: 'gemini-2.5-flash', timeout: 90_000 };
    case 'vertex-pro':
      return { provider: 'vertex-ai', modelId: 'gemini-2.5-pro', timeout: 120_000 };
    case 'vertex-3.1-pro':
      return { provider: 'vertex-ai', modelId: 'gemini-3.1-pro-preview', timeout: 90_000 };
    case 'vertex-3-flash':
      return { provider: 'vertex-ai', modelId: 'gemini-3-flash-preview', timeout: 90_000 };
    case 'vertex-3.1-flash-lite':
      return { provider: 'vertex-ai', modelId: 'gemini-3.1-flash-lite-preview', timeout: 60_000 };
    case 'gemini-flash':
      return { provider: 'lovable-gateway', modelId: 'google/gemini-2.5-flash', timeout: 90_000 };
    case 'gemini-pro':
      return { provider: 'lovable-gateway', modelId: 'google/gemini-2.5-pro', timeout: 120_000 };
    case 'lovable-gemini':
      return { provider: 'lovable-gateway', modelId: 'google/gemini-3-flash-preview', timeout: 90_000 };
    case 'gpt5':
      return { provider: 'lovable-gateway', modelId: 'openai/gpt-5', timeout: 120_000 };
    case 'gpt5-mini':
      return { provider: 'lovable-gateway', modelId: 'openai/gpt-5-mini', timeout: 90_000 };
    case 'nemotron-120b':
      return { provider: 'lovable-gateway', modelId: 'nvidia/llama-3.3-nemotron-super-49b-v1', timeout: 90_000 };
    case 'groq':
      return { provider: 'groq', modelId: 'llama-3.3-70b-versatile', timeout: 60_000 };
    case 'claude-sonnet':
      return { provider: 'anthropic', modelId: 'claude-sonnet-4-20250514', timeout: 120_000 };
    case 'nova-pro':
      return { provider: 'bedrock', modelId: 'us.amazon.nova-pro-v1:0', timeout: 90_000 };
    case 'nova-premier':
      return { provider: 'bedrock', modelId: 'us.amazon.nova-premier-v1:0', timeout: 120_000 };
    case 'mistral':
      return { provider: 'bedrock', modelId: 'eu.mistral.mistral-large-2411-v1:0', timeout: 90_000 };
    case 'azure-gpt4o-mini':
      return { provider: 'azure-openai', modelId: 'gpt-4o-mini', timeout: 90_000 };
    case 'azure-gpt41-mini':
      return { provider: 'azure-gpt41-mini', modelId: 'gpt-4.1-mini', timeout: 90_000 };
    case 'azure-deepseek-v3':
      return { provider: 'azure-deepseek', modelId: 'DeepSeek-V3.1', timeout: 90_000 };
    case 'azure-deepseek-r1':
      return { provider: 'azure-deepseek', modelId: 'DeepSeek-R1', timeout: 120_000 };
    case 'sarvam-30b':
    case 'sarvam-105b':
      return { provider: 'sarvam', modelId: 'sarvam-m', timeout: 90_000 };
    default:
      return { provider: 'vertex-ai', modelId: 'gemini-2.5-flash', timeout: 90_000 };
  }
}

// ══════════════════════════════════════════════════════════════
// CENTRALIZED PARSER PIPELINE
// ══════════════════════════════════════════════════════════════

interface ParseMeta {
  rawLength: number;
  hadCodeFence: boolean;
  hadProse: boolean;
  strictParseOk: boolean;
  repairAttempted: boolean;
  repairSucceeded: boolean;
  retryTriggered: boolean;
  recoveredCount: number;
  rejectedCount: number;
  skipped: boolean;
  reason?: string;
  finishReason?: string;
  provider?: string;
  model?: string;
  chunkIndex?: number;
}

interface ParseResult {
  jobs: any[];
  parseMeta: ParseMeta;
}

const PLACEHOLDER_VALUES = new Set([
  'n/a', 'na', 'unknown', '-', '--', '---', 'nil', 'none',
  'not available', 'tbd', '...', 'not specified', 'not mentioned',
  'not applicable', 'to be announced', 'varies',
]);

function cleanStr(v: any): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  if (t.length === 0 || PLACEHOLDER_VALUES.has(t.toLowerCase())) return null;
  return t;
}

function looksLikeUrl(v: any): boolean {
  if (typeof v !== 'string') return false;
  const t = v.trim();
  return /^https?:\/\/.{4,}/.test(t);
}

function normalizeJobFields(obj: any): void {
  if (typeof obj !== 'object' || obj === null) return;
  if (!obj.post && obj.title) obj.post = obj.title;
  if (!obj.org_name && obj.organization) obj.org_name = obj.organization;
  if (!obj.org_name && obj.organisation) obj.org_name = obj.organisation;
  if (!obj.apply_link && obj.source_url) obj.apply_link = obj.source_url;
  if (!obj.apply_link && obj.url) obj.apply_link = obj.url;
}

function isValidJob(obj: any): boolean {
  if (typeof obj !== 'object' || obj === null) return false;
  normalizeJobFields(obj);
  const post = cleanStr(obj.post);
  if (!post) return false;
  const org = cleanStr(obj.org_name);
  if (org) return true;
  // Accept if has a valid URL even without org_name
  if (looksLikeUrl(obj.apply_link)) return true;
  if (looksLikeUrl(obj.source)) return true;
  return false;
}

// Step 1: Unwrap markdown code fences
function stripCodeFences(raw: string): { text: string; found: boolean } {
  const fenceRegex = /```(?:json|JSON)?\s*\n?([\s\S]*?)```/;
  const match = raw.match(fenceRegex);
  if (match) return { text: match[1].trim(), found: true };
  return { text: raw, found: false };
}

// Step 2: Extract JSON block using prioritized strategies
function extractJsonBlock(raw: string): { text: string; hadProse: boolean } {
  const trimmed = raw.trim();

  // Strategy A: Find {"jobs": [...]} pattern
  const jobsPatternIdx = trimmed.search(/"jobs"\s*:\s*\[/);
  if (jobsPatternIdx >= 0) {
    // Walk backwards to find the opening {
    let openBrace = trimmed.lastIndexOf('{', jobsPatternIdx);
    if (openBrace >= 0) {
      const candidate = extractBalancedBlock(trimmed, openBrace);
      if (candidate) {
        return { text: candidate, hadProse: openBrace > 0 || candidate.length < trimmed.length };
      }
    }
  }

  // Strategy B: Find largest balanced {} block
  let largest = '';
  for (let i = 0; i < trimmed.length; i++) {
    if (trimmed[i] === '{') {
      const block = extractBalancedBlock(trimmed, i);
      if (block && block.length > largest.length) largest = block;
    }
  }
  if (largest.length > 10) {
    return { text: largest, hadProse: largest.length < trimmed.length };
  }

  // Strategy C: Fallback — first { to last }
  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return {
      text: trimmed.slice(firstBrace, lastBrace + 1),
      hadProse: firstBrace > 0 || lastBrace < trimmed.length - 1,
    };
  }

  return { text: trimmed, hadProse: false };
}

function extractBalancedBlock(text: string, start: number): string | null {
  if (text[start] !== '{') return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (escaped) { escaped = false; continue; }
    if (ch === '\\' && inString) { escaped = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null; // unbalanced
}

// Step 3: Repair truncated JSON — recover complete job objects
function repairTruncatedJson(raw: string, requestId: string): { jobs: any[]; repaired: boolean } {
  const text = raw.trim();
  const jobsMatch = text.match(/"jobs"\s*:\s*\[/);
  if (!jobsMatch) {
    // Try to parse as a bare array
    const arrayMatch = text.match(/^\s*\[/);
    if (arrayMatch) {
      const completeObjects = extractCompleteObjects(text.slice(1));
      if (completeObjects.length > 0) {
        console.log(`[${requestId}] Repair: recovered ${completeObjects.length} from bare array`);
        return { jobs: completeObjects, repaired: true };
      }
    }
    console.warn(`[${requestId}] Repair: no jobs array found`);
    return { jobs: [], repaired: true };
  }

  const arrayStart = text.indexOf('[', jobsMatch.index!);
  const afterArray = text.slice(arrayStart + 1);
  const completeObjects = extractCompleteObjects(afterArray);

  if (completeObjects.length === 0) {
    console.warn(`[${requestId}] Repair: no complete objects recovered`);
    return { jobs: [], repaired: true };
  }

  console.log(`[${requestId}] Repair: recovered ${completeObjects.length} complete objects`);
  return { jobs: completeObjects, repaired: true };
}

function extractCompleteObjects(text: string): any[] {
  const results: any[] = [];
  let depth = 0;
  let objStart = -1;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '{' && depth === 0) { objStart = i; depth = 1; }
    else if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0 && objStart >= 0) {
        const candidate = text.slice(objStart, i + 1);
        try { results.push(JSON.parse(candidate)); } catch { /* skip malformed */ }
        objStart = -1;
      }
    }
  }
  return results;
}

// Main centralized parser — NEVER throws
function parseAIResponse(rawText: string, requestId: string): ParseResult {
  const meta: ParseMeta = {
    rawLength: rawText?.length ?? 0,
    hadCodeFence: false,
    hadProse: false,
    strictParseOk: false,
    repairAttempted: false,
    repairSucceeded: false,
    retryTriggered: false,
    recoveredCount: 0,
    rejectedCount: 0,
    skipped: false,
  };

  if (!rawText || rawText.trim().length === 0) {
    meta.skipped = true;
    meta.reason = 'Empty AI response';
    return { jobs: [], parseMeta: meta };
  }

  // Step 1: Unwrap code fences
  const { text: unfenced, found: hadFence } = stripCodeFences(rawText);
  meta.hadCodeFence = hadFence;

  // Step 2: Extract JSON block
  const { text: jsonCandidate, hadProse } = extractJsonBlock(unfenced);
  meta.hadProse = hadProse;

  // Step 3: Strict parse
  let allJobs: any[] = [];
  try {
    const parsed = JSON.parse(jsonCandidate);
    meta.strictParseOk = true;
    allJobs = Array.isArray(parsed?.jobs) ? parsed.jobs
            : Array.isArray(parsed) ? parsed
            : [];
  } catch {
    // Step 4: Repair
    meta.repairAttempted = true;
    const { jobs: repairedJobs, repaired } = repairTruncatedJson(unfenced, requestId);
    meta.repairSucceeded = repaired && repairedJobs.length > 0;
    allJobs = repairedJobs;
  }

  // Step 5: Validate each job
  const validJobs: any[] = [];
  let rejected = 0;
  for (const job of allJobs) {
    if (isValidJob(job)) {
      validJobs.push(job);
    } else {
      rejected++;
    }
  }

  meta.recoveredCount = validJobs.length;
  meta.rejectedCount = rejected;

  if (validJobs.length === 0 && allJobs.length > 0) {
    meta.reason = `All ${allJobs.length} extracted objects failed validation`;
  } else if (validJobs.length === 0) {
    meta.reason = meta.strictParseOk ? 'Parsed successfully but no job objects found' : 'Could not parse AI response';
  }

  return { jobs: validJobs, parseMeta: meta };
}

// ══════════════════════════════════════════════════════════════
// AI CALL — returns raw text only, never parses JSON
// ══════════════════════════════════════════════════════════════

interface AIRawResult {
  rawText: string;
  finishReason: string | null;
}

async function updateBatchProgress(
  serviceClient: ReturnType<typeof createClient>,
  batchId: string,
  currentTotalChunks: number,
  counts: { newCount?: number; updatedCount?: number } = {},
) {
  const { data: currentBatch } = await serviceClient
    .from("upload_batches")
    .select("total_extracted, new_count, updated_count, completed_chunks")
    .eq("id", batchId)
    .single();

  const newCompletedChunks = (currentBatch?.completed_chunks || 0) + 1;
  const isLastChunk = newCompletedChunks >= currentTotalChunks;

  await serviceClient
    .from("upload_batches")
    .update({
      total_extracted: (currentBatch?.total_extracted || 0) + (counts.newCount || 0) + (counts.updatedCount || 0),
      new_count: (currentBatch?.new_count || 0) + (counts.newCount || 0),
      updated_count: (currentBatch?.updated_count || 0) + (counts.updatedCount || 0),
      completed_chunks: newCompletedChunks,
      total_chunks: currentTotalChunks,
      extraction_status: isLastChunk ? 'completed' : 'extracting',
      status: isLastChunk ? 'completed' : 'processing',
    })
    .eq("id", batchId);

  return { newCompletedChunks, isLastChunk };
}

async function callAI(
  resolved: ResolvedModel,
  systemPrompt: string,
  userContent: string,
  requestId: string,
): Promise<AIRawResult> {
  const fullPrompt = `${systemPrompt}\n\n${userContent}`;
  const maxTokens = 8192;
  console.log(`[${requestId}] AI call | provider=${resolved.provider} | model=${resolved.modelId} | prompt_len=${fullPrompt.length} | maxTokens=${maxTokens}`);

  if (resolved.provider === 'vertex-ai') {
    const { callVertexGeminiWithMeta } = await import('../_shared/vertex-ai.ts');
    try {
      const { text: rawText, finishReason } = await callVertexGeminiWithMeta(resolved.modelId, fullPrompt, resolved.timeout, {
        responseMimeType: 'application/json',
        temperature: 0.1,
        maxOutputTokens: maxTokens,
      });
      return { rawText: rawText ?? '', finishReason: finishReason ?? null };
    } catch (err: any) {
      if (err.name === 'AbortError' || err.message?.includes('signal has been aborted') || err.message?.includes('aborted')) {
        throw new Error(`AI model "${resolved.modelId}" timed out after ${Math.round(resolved.timeout / 1000)}s. Try a faster model or reduce document size.`);
      }
      if (err.message?.includes('404') || err.message?.includes('NOT_FOUND')) {
        throw new Error(`Model "${resolved.modelId}" returned 404 from Vertex AI.`);
      }
      // Safety block or other non-infrastructure error → return empty
      if (err.message?.includes('SAFETY') || err.message?.includes('blocked') || err.message?.includes('RECITATION')) {
        console.warn(`[${requestId}] Vertex response blocked: ${err.message?.substring(0, 200)}`);
        return { rawText: '', finishReason: 'blocked' };
      }
      throw err;
    }
  }

  if (resolved.provider === 'lovable-gateway') {
    const apiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!apiKey) throw new Error('LOVABLE_API_KEY not configured');
    const resp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: resolved.modelId,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent },
        ],
        response_format: { type: 'json_object' },
        max_tokens: maxTokens,
        temperature: 0.1,
      }),
    });
    if (!resp.ok) {
      const errText = await resp.text().catch(() => 'unknown');
      throw new Error(`Gateway error (${resp.status}): ${errText}`);
    }
    const json = await resp.json().catch(() => null);
    const content = json?.choices?.[0]?.message?.content ?? '';
    const finish = json?.choices?.[0]?.finish_reason ?? null;
    return { rawText: typeof content === 'string' ? content : '', finishReason: finish };
  }

  if (resolved.provider === 'groq') {
    const apiKey = Deno.env.get('GROQ_API_KEY');
    if (!apiKey) throw new Error('GROQ_API_KEY not configured');
    const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: resolved.modelId,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent },
        ],
        response_format: { type: 'json_object' },
        max_tokens: maxTokens,
        temperature: 0.1,
      }),
    });
    if (!resp.ok) {
      const errText = await resp.text().catch(() => 'unknown');
      throw new Error(`Groq error (${resp.status}): ${errText}`);
    }
    const json = await resp.json().catch(() => null);
    const content = json?.choices?.[0]?.message?.content ?? '';
    const finish = json?.choices?.[0]?.finish_reason ?? null;
    return { rawText: typeof content === 'string' ? content : '', finishReason: finish };
  }

  if (resolved.provider === 'anthropic') {
    const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured');
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: resolved.modelId,
        system: systemPrompt,
        messages: [{ role: 'user', content: userContent }],
        max_tokens: maxTokens,
        temperature: 0.1,
      }),
    });
    if (!resp.ok) {
      const errText = await resp.text().catch(() => 'unknown');
      throw new Error(`Anthropic error (${resp.status}): ${errText}`);
    }
    const json = await resp.json().catch(() => null);
    const text = json?.content?.[0]?.text ?? '';
    const finish = json?.stop_reason ?? null;
    return { rawText: typeof text === 'string' ? text : '', finishReason: finish };
  }

  if (resolved.provider === 'bedrock') {
    const { callVertexGeminiWithMeta } = await import('../_shared/vertex-ai.ts');
    console.warn(`[${requestId}] Bedrock not directly supported, falling back to vertex-flash`);
    const { text: rawText, finishReason } = await callVertexGeminiWithMeta('gemini-2.5-flash', fullPrompt, 90_000, {
      responseMimeType: 'application/json',
      temperature: 0.1,
      maxOutputTokens: maxTokens,
    });
    return { rawText: rawText ?? '', finishReason: finishReason ?? null };
  }

  if (resolved.provider === 'azure-openai') {
    const { callAzureOpenAI } = await import('../_shared/azure-openai.ts');
    const rawText = await callAzureOpenAI(fullPrompt, { maxTokens, temperature: 0.1 });
    return { rawText, finishReason: null };
  }

  if (resolved.provider === 'azure-gpt41-mini') {
    const { callAzureGpt41Mini } = await import('../_shared/azure-gpt41-mini.ts');
    const rawText = await callAzureGpt41Mini(fullPrompt, { maxTokens, temperature: 0.1 });
    return { rawText, finishReason: null };
  }

  if (resolved.provider === 'azure-deepseek') {
    const { callAzureDeepSeek } = await import('../_shared/azure-deepseek.ts');
    const rawText = await callAzureDeepSeek(fullPrompt, { model: resolved.modelId as any, maxTokens, temperature: 0.1 });
    return { rawText, finishReason: null };
  }

  if (resolved.provider === 'sarvam') {
    const { callSarvamChat } = await import('../_shared/sarvam.ts');
    const rawText = await callSarvamChat(fullPrompt, { model: resolved.modelId, maxTokens });
    return { rawText, finishReason: null };
  }

  throw new Error(`Unsupported provider: ${resolved.provider}`);
}

// ══════════════════════════════════════════════════════════════
// MAIN HANDLER
// ══════════════════════════════════════════════════════════════

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  const requestId = crypto.randomUUID().slice(0, 8);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceClient = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer "))
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await serviceClient.auth.getUser(token);
    if (userError || !user)
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    // Admin check
    const { data: roleData } = await serviceClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleData)
      return new Response(JSON.stringify({ error: "Admin only" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    const { text, filename, issueDetails, batchId, aiModel, chunkIndex, totalChunks } = await req.json();
    if (!text || text.trim().length < 50)
      return new Response(
        JSON.stringify({ error: "Text too short to extract jobs from" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );

    const resolved = resolveModel(aiModel);
    const currentChunkIndex = typeof chunkIndex === 'number' ? chunkIndex : 0;
    const currentTotalChunks = typeof totalChunks === 'number' ? totalChunks : 1;
    console.log(`[${requestId}] Model: ${resolved.provider}/${resolved.modelId} | chunk=${currentChunkIndex + 1}/${currentTotalChunks}`);

    // Sanitize text
    const rawLen = text.length;
    const cleaned = sanitizeText(text);
    console.log(`[${requestId}] Text | raw=${rawLen} | cleaned=${cleaned.length} | reduction=${Math.round((1 - cleaned.length / rawLen) * 100)}%`);

    // Create or reuse batch
    let currentBatchId = batchId;
    let batchUploadedAt: string;

    if (!currentBatchId) {
      const { data: batch, error: batchErr } = await serviceClient
        .from("upload_batches")
        .insert({
          filename: filename || "unknown.docx",
          issue_details: issueDetails || "",
          status: "processing",
          total_chunks: totalChunks || 0,
          completed_chunks: 0,
          extraction_status: 'extracting',
          ai_model_used: aiModel || null,
        })
        .select("id, uploaded_at")
        .single();
      if (batchErr) throw batchErr;
      currentBatchId = batch.id;
      batchUploadedAt = batch.uploaded_at;
    } else {
      const { data: existingBatch } = await serviceClient
        .from("upload_batches")
        .select("uploaded_at")
        .eq("id", currentBatchId)
        .single();
      batchUploadedAt = existingBatch?.uploaded_at || new Date().toISOString();
    }

    // ── System prompt ──
    const systemPrompt = `You are an expert at extracting government job notifications from Indian Employment News newspaper issues.

Extract ALL job notifications from the following text. For each unique job advertisement, return a JSON object with these exact fields:

{
  "org_name": string,
  "post": string,
  "vacancies": integer or null,
  "qualification": string,
  "age_limit": string or null,
  "salary": string or null,
  "job_type": "permanent" | "contract" | "deputation" | "fellowship" | "short-term contract" | "direct recruitment",
  "experience_required": string or null,
  "location": string or null,
  "application_mode": "online" | "offline" | "email" | "deputation",
  "apply_link": string or null,
  "application_start_date": string or null,
  "last_date": string or null,
  "last_date_raw": string or null,
  "notification_reference_number": string or null,
  "advertisement_number": string or null,
  "source": "Employment News",
  "description": string (2-3 sentence summary),
  "job_category": "Central Government" | "State Government" | "Defence" | "Railway" | "Banking" | "SSC" | "PSU" | "University/Research" | "Teaching" | "Police" | "Medical/Health" | "Engineering" | "Other",
  "state": string or null
}

Return a JSON object with key "jobs" containing an array of all job objects.
Return null for fields not found. Preserve relative date phrases as-is. Ignore articles, editorials, and non-job content. Clean OCR artifacts.`;

    // ── First AI call ──
    const warnings: string[] = [];
    const { rawText, finishReason } = await callAI(resolved, systemPrompt, cleaned, requestId);

    if (finishReason === 'length' || finishReason === 'MAX_TOKENS') {
      warnings.push('AI response was truncated (hit token limit)');
    }

    let parseResult = parseAIResponse(rawText, requestId);
    parseResult.parseMeta.finishReason = finishReason ?? undefined;
    parseResult.parseMeta.provider = resolved.provider;
    parseResult.parseMeta.model = resolved.modelId;
    parseResult.parseMeta.chunkIndex = currentChunkIndex;

    // ── Single retry if zero valid jobs ──
    if (parseResult.jobs.length === 0 && cleaned.length > 100) {
      console.log(`[${requestId}] Zero valid jobs, retrying with strict prompt`);
      parseResult.parseMeta.retryTriggered = true;
      warnings.push('Initial parse yielded 0 valid jobs, retried with strict prompt');

      const retryPrompt = `Return ONLY a valid JSON object with key "jobs" containing an array of job objects. No markdown fences. No explanation. No prose. Only pure JSON.

Each job must have at minimum: "org_name" (string), "post" (string), "source": "Employment News".

Extract all job notifications from this text:`;

      try {
        const { rawText: retryRaw } = await callAI(resolved, retryPrompt, cleaned, requestId);
        const retryResult = parseAIResponse(retryRaw, requestId);
        if (retryResult.jobs.length > 0) {
          parseResult = retryResult;
          parseResult.parseMeta.retryTriggered = true;
          warnings.push(`Retry recovered ${retryResult.jobs.length} valid jobs`);
        } else {
          warnings.push('Retry also yielded 0 valid jobs');
        }
      } catch (retryErr: any) {
        console.warn(`[${requestId}] Retry failed: ${retryErr.message?.substring(0, 200)}`);
        warnings.push('Retry call failed');
      }
    }

    if (parseResult.parseMeta.rejectedCount > 0) {
      warnings.push(`${parseResult.parseMeta.rejectedCount} job(s) rejected during validation`);
    }
    if (parseResult.parseMeta.repairSucceeded) {
      warnings.push(`JSON repair recovered ${parseResult.parseMeta.recoveredCount} job(s) from truncated output`);
    }

    // ── Structured chunk log ──
    const pm = parseResult.parseMeta;
    console.log(`[${requestId}] CHUNK_RESULT | provider=${pm.provider} | model=${pm.model} | chunk=${currentChunkIndex + 1}/${currentTotalChunks} | rawLen=${pm.rawLength} | finish=${pm.finishReason ?? 'unknown'} | fence=${pm.hadCodeFence} | prose=${pm.hadProse} | strictParse=${pm.strictParseOk} | repair=${pm.repairAttempted} | retry=${pm.retryTriggered} | valid=${pm.recoveredCount} | rejected=${pm.rejectedCount}`);

    const jobs = parseResult.jobs;
    const degraded = parseResult.parseMeta.retryTriggered || parseResult.parseMeta.repairAttempted || jobs.length === 0;

    if (jobs.length === 0) {
      await updateBatchProgress(serviceClient, currentBatchId, currentTotalChunks);

      // No jobs but NOT a crash — return success with degraded flag
      return new Response(
        JSON.stringify({
          ok: true,
          degraded: true,
          batchId: currentBatchId,
          newCount: 0,
          updatedCount: 0,
          totalInChunk: 0,
          warnings,
          parseMeta: parseResult.parseMeta,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Resolve relative dates ──
    const batchDate = new Date(batchUploadedAt);
    const resolveDate = (raw: string | null): string | null => {
      if (!raw) return null;
      const directParse = new Date(raw);
      if (!isNaN(directParse.getTime()) && raw.match(/\d{4}/)) {
        return directParse.toISOString().split("T")[0];
      }
      const daysMatch = raw.match(/within\s+(\d+)\s+days/i);
      if (daysMatch) {
        const days = parseInt(daysMatch[1]);
        const d = new Date(batchDate);
        d.setDate(d.getDate() + days);
        return d.toISOString().split("T")[0];
      }
      const weeksMatch = raw.match(/within\s+(\d+)\s+weeks/i);
      if (weeksMatch) {
        const weeks = parseInt(weeksMatch[1]);
        const d = new Date(batchDate);
        d.setDate(d.getDate() + weeks * 7);
        return d.toISOString().split("T")[0];
      }
      const ddmmyyyy = raw.match(/(\d{1,2})[\/\.\-](\d{1,2})[\/\.\-](\d{4})/);
      if (ddmmyyyy) {
        const d = new Date(`${ddmmyyyy[3]}-${ddmmyyyy[2].padStart(2, '0')}-${ddmmyyyy[1].padStart(2, '0')}`);
        if (!isNaN(d.getTime())) return d.toISOString().split("T")[0];
      }
      const naturalDate = new Date(raw);
      if (!isNaN(naturalDate.getTime())) {
        return naturalDate.toISOString().split("T")[0];
      }
      return null;
    };

    // ── Upsert jobs ──
    let newCount = 0;
    let updatedCount = 0;

    for (const job of jobs) {
      const lastDateText = job.last_date_raw || job.last_date || null;
      const resolvedDt = resolveDate(lastDateText);

      const row = {
        org_name: job.org_name || null,
        post: job.post || null,
        vacancies: job.vacancies || null,
        qualification: job.qualification || null,
        age_limit: job.age_limit || null,
        salary: job.salary || null,
        job_type: job.job_type || null,
        experience_required: job.experience_required || null,
        location: job.location || null,
        application_mode: job.application_mode || null,
        apply_link: job.apply_link || null,
        application_start_date: job.application_start_date || null,
        last_date: job.last_date || null,
        last_date_raw: lastDateText,
        last_date_resolved: resolvedDt,
        notification_reference_number: job.notification_reference_number || null,
        advertisement_number: job.advertisement_number || null,
        source: "Employment News",
        description: job.description || null,
        status: "pending",
        job_category: job.job_category || null,
        state: job.state || null,
        upload_batch_id: currentBatchId,
      };

      const { error: insertErr } = await serviceClient
        .from("employment_news_jobs")
        .insert(row);

      if (insertErr) {
        if (insertErr.code === "23505") {
          const { error: updateErr } = await serviceClient
            .from("employment_news_jobs")
            .update({ ...row, status: "pending" })
            .eq("advertisement_number", row.advertisement_number)
            .eq("org_name", row.org_name);
          if (!updateErr) updatedCount++;
        } else {
          console.error(`[${requestId}] Insert error:`, insertErr);
        }
      } else {
        newCount++;
      }
    }

    // ── Update batch counters ──
    await updateBatchProgress(serviceClient, currentBatchId, currentTotalChunks, {
      newCount,
      updatedCount,
    });

    console.log(`[${requestId}] Done | chunk=${currentChunkIndex + 1}/${currentTotalChunks} | new=${newCount} updated=${updatedCount}`);

    return new Response(
      JSON.stringify({
        ok: true,
        degraded,
        batchId: currentBatchId,
        newCount,
        updatedCount,
        totalInChunk: jobs.length,
        warnings,
        parseMeta: parseResult.parseMeta,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : "Unknown error";
    const isAbort = error?.name === 'AbortError' || /signal has been aborted|aborted|timed out/i.test(errMsg);
    const is429 = /429|RESOURCE_EXHAUSTED|rate.?limit/i.test(errMsg);
    const is402 = /402|Payment Required/i.test(errMsg);

    if (isAbort) {
      console.warn(`[${requestId}] AI timeout / abort`);
      return new Response(
        JSON.stringify({
          error: errMsg || "AI model timed out. Try a faster model or smaller document.",
          code: "VERTEX_TIMEOUT",
        }),
        { status: 504, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (is429) {
      console.warn(`[${requestId}] Rate limited (429)`);
      return new Response(
        JSON.stringify({
          error: "AI service is temporarily overloaded. Please wait a minute and try again.",
          code: "VERTEX_RATE_LIMITED",
        }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (is402) {
      console.warn(`[${requestId}] Payment required (402)`);
      return new Response(
        JSON.stringify({
          error: "AI credits exhausted. Please add funds and try again.",
          code: "GATEWAY_PAYMENT_REQUIRED",
        }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.error(`[${requestId}] Unhandled error:`, error);
    return new Response(
      JSON.stringify({ error: errMsg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
