import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

async function verifyAdmin(req: Request): Promise<{ userId: string } | Response> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized — missing token' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } });
  const token = authHeader.replace('Bearer ', '');
  const { data, error } = await supabase.auth.getClaims(token);
  if (error || !data?.claims) {
    return new Response(JSON.stringify({ error: 'Unauthorized — invalid token' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
  const userId = data.claims.sub as string;
  const svc = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data: roleRow } = await svc.from('user_roles').select('role').eq('user_id', userId).eq('role', 'admin').maybeSingle();
  if (!roleRow) {
    return new Response(JSON.stringify({ error: 'Forbidden — admin role required' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
  return { userId };
}

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

interface ArticleDigest {
  slug: string;
  title: string;
  headings: { level: number; text: string }[];
  meta_summary: {
    has_meta_title: boolean;
    has_meta_description: boolean;
    has_excerpt: boolean;
    has_cover_image: boolean;
    has_image_alt: boolean;
    has_canonical_url: boolean;
  };
  intro_excerpt: string;
  middle_excerpt: string;
  ending_excerpt: string;
  full_plain_text?: string;
  faq_summary: string[];
  internal_links: string[];
  heuristic_scores: {
    quality_score: number;
    seo_score: number;
    compliance_fail_count: number;
    compliance_warn_count: number;
  };
  is_published: boolean;
  word_count: number;
}

interface ClassificationVerdict {
  slug: string;
  verdict: 'needs_action' | 'skip' | 'manual_review';
  confidence: number;
  reasons: string[];
  severity: 'minor' | 'moderate' | 'major';
  action_type: 'minimal_safe_edit' | 'targeted_fix' | 'full_enrich' | 'skip';
  safe_to_bulk_edit: boolean;
  requires_manual_review: boolean;
  preserve_elements: string[];
  missing_elements: string[];
  ranking_risk: 'low' | 'medium' | 'high';
}

// ═══════════════════════════════════════════════════════════════
// AI Provider Implementations
// ═══════════════════════════════════════════════════════════════

// ── AWS SigV4 helpers (for Mistral via Bedrock) ──
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
  if (!ak || !sk) throw new Error('AWS credentials not configured (AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY)');

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

// Removed: callGeminiClassifier using GEMINI_API_KEY + generativelanguage.googleapis.com
// Now handled inline in callClassifierAI dispatcher via callVertexGemini

// ── Claude Sonnet 4.6 (Anthropic Messages API) ──
async function callClaudeClassifier(systemPrompt: string, userPrompt: string, maxTokens: number): Promise<string> {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured. Please add it in your secrets.');

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 140_000);

  const systemWithJson = systemPrompt + '\n\nIMPORTANT: Return ONLY a valid JSON array. No markdown fences, no preamble, no explanation — just the raw JSON array.';

  let resp: Response;
  try {
    resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: Math.min(maxTokens, 16384),
        system: systemWithJson,
        messages: [{ role: 'user', content: userPrompt }],
      }),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timeoutId);
    if (err instanceof DOMException && err.name === 'AbortError') throw new Error('Claude API timeout after 140 seconds');
    throw err;
  }
  clearTimeout(timeoutId);

  if (!resp.ok) {
    const errBody = await resp.text().catch(() => 'unknown');
    if (resp.status === 429) throw new Error('Anthropic rate limit exceeded. Please wait and try again.');
    if (resp.status === 401) throw new Error('Anthropic API key is invalid or expired.');
    throw new Error(`Anthropic API error ${resp.status}: ${errBody.substring(0, 200)}`);
  }

  const data = await resp.json();
  const textBlocks = (data?.content || []).filter((b: any) => b.type === 'text');
  const text = textBlocks.map((b: any) => b.text).join('');
  if (!text.trim()) throw new Error('Anthropic returned empty text output');
  return text;
}

// ── Mistral Large (AWS Bedrock — us-west-2) ──
async function callMistralClassifier(systemPrompt: string, userPrompt: string, maxTokens: number): Promise<string> {
  const modelId = 'mistral.mistral-large-2407-v1:0';
  const region = 'us-west-2';
  const host = `bedrock-runtime.${region}.amazonaws.com`;
  const fullPrompt = systemPrompt + '\n\nIMPORTANT: Return ONLY a valid JSON array. No markdown.\n\n' + userPrompt;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 120_000);

  try {
    const body = JSON.stringify({
      messages: [{ role: 'user', content: [{ text: fullPrompt }] }],
      inferenceConfig: { maxTokens: Math.min(maxTokens, 16384), temperature: 0.1 },
    });
    const resp = await awsSigV4Fetch(host, `/model/${modelId}/converse`, body, region, 'bedrock');
    clearTimeout(timeoutId);
    if (!resp.ok) throw new Error(`Mistral Bedrock ${resp.status}: ${await resp.text()}`);
    const data = await resp.json();
    return data?.output?.message?.content?.[0]?.text || '[]';
  } catch (err) {
    clearTimeout(timeoutId);
    if (err instanceof DOMException && err.name === 'AbortError') throw new Error('Mistral timeout after 120 seconds');
    throw err;
  }
}

// ── OpenAI ──
async function callOpenAIClassifier(systemPrompt: string, userPrompt: string, maxTokens: number): Promise<string> {
  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) throw new Error('OPENAI_API_KEY not configured');

  const systemWithJson = systemPrompt + '\n\nIMPORTANT: Return ONLY a valid JSON array. No markdown fences.';
  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemWithJson },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: maxTokens,
      temperature: 0.1,
    }),
  });
  if (!resp.ok) throw new Error(`OpenAI API error ${resp.status}`);
  const data = await resp.json();
  return data?.choices?.[0]?.message?.content || '[]';
}

// ── Groq ──
async function callGroqClassifier(systemPrompt: string, userPrompt: string, maxTokens: number): Promise<string> {
  const apiKey = Deno.env.get('GROQ_API_KEY');
  if (!apiKey) throw new Error('GROQ_API_KEY not configured');

  const systemWithJson = systemPrompt + '\n\nIMPORTANT: Return ONLY a valid JSON array. No markdown fences.';
  const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: systemWithJson },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: maxTokens,
      temperature: 0.1,
    }),
  });
  if (!resp.ok) throw new Error(`Groq API error ${resp.status}`);
  const data = await resp.json();
  return data?.choices?.[0]?.message?.content || '[]';
}

// ── Lovable Gemini (gateway) ──
async function callLovableGeminiClassifier(systemPrompt: string, userPrompt: string, maxTokens: number): Promise<string> {
  const apiKey = Deno.env.get('LOVABLE_API_KEY');
  if (!apiKey) throw new Error('LOVABLE_API_KEY not configured');

  const systemWithJson = systemPrompt + '\n\nIMPORTANT: Return ONLY a valid JSON array. No markdown fences.';
  const resp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: [
        { role: 'system', content: systemWithJson },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: maxTokens,
      temperature: 0.1,
    }),
  });
  if (!resp.ok) {
    if (resp.status === 429) throw new Error('Rate limit exceeded on Lovable AI. Try again later.');
    if (resp.status === 402) throw new Error('Lovable AI credits exhausted.');
    throw new Error(`Lovable AI error ${resp.status}`);
  }
  const data = await resp.json();
  return data?.choices?.[0]?.message?.content || '[]';
}

// ═══════════════════════════════════════════════════════════════
// Unified Classifier Dispatcher — NO silent fallback
// ═══════════════════════════════════════════════════════════════

const SUPPORTED_MODELS = ['gemini', 'gemini-flash', 'gemini-pro', 'mistral', 'claude-sonnet', 'claude', 'openai', 'gpt5', 'gpt5-mini', 'groq', 'lovable-gemini', 'vertex-flash', 'vertex-pro', 'vertex-3.1-pro', 'vertex-3-flash', 'vertex-3.1-flash-lite'];

async function callClassifierAI(
  aiModel: string,
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number,
): Promise<{ rawText: string; actualProvider: string; actualModelId: string }> {
  const model = aiModel || 'gemini-flash';
  console.log(`[classify] DISPATCH model_requested="${model}" maxTokens=${maxTokens}`);

  let rawText: string;
  let actualProvider: string;
  let actualModelId: string;

  switch (model) {
    case 'gemini': case 'gemini-flash': {
      const { callVertexGemini } = await import('../_shared/vertex-ai.ts');
      const fullPrompt = systemPrompt + '\n\n' + userPrompt;
      rawText = await callVertexGemini('gemini-2.5-flash', fullPrompt, 90_000, { temperature: 0.1, maxOutputTokens: maxTokens, responseMimeType: 'application/json' });
      actualProvider = 'vertex-ai'; actualModelId = 'gemini-2.5-flash'; break;
    }
    case 'gemini-pro': {
      const { callVertexGemini } = await import('../_shared/vertex-ai.ts');
      const fullPrompt = systemPrompt + '\n\n' + userPrompt;
      rawText = await callVertexGemini('gemini-2.5-pro', fullPrompt, 120_000, { temperature: 0.1, maxOutputTokens: maxTokens, responseMimeType: 'application/json' });
      actualProvider = 'vertex-ai'; actualModelId = 'gemini-2.5-pro'; break;
    }
    case 'mistral':
      rawText = await callMistralClassifier(systemPrompt, userPrompt, maxTokens);
      actualProvider = 'aws-bedrock'; actualModelId = 'mistral.mistral-large-2407-v1:0'; break;
    case 'claude-sonnet': case 'claude':
      rawText = await callClaudeClassifier(systemPrompt, userPrompt, maxTokens);
      actualProvider = 'anthropic'; actualModelId = 'claude-sonnet-4-6'; break;
    case 'openai': case 'gpt5': case 'gpt5-mini':
      rawText = await callOpenAIClassifier(systemPrompt, userPrompt, maxTokens);
      actualProvider = 'openai'; actualModelId = 'gpt-4o'; break;
    case 'groq':
      rawText = await callGroqClassifier(systemPrompt, userPrompt, maxTokens);
      actualProvider = 'groq'; actualModelId = 'llama-3.3-70b-versatile'; break;
    case 'lovable-gemini':
      rawText = await callLovableGeminiClassifier(systemPrompt, userPrompt, maxTokens);
      actualProvider = 'lovable-gateway'; actualModelId = 'google/gemini-2.5-flash'; break;
    case 'vertex-flash': {
      const { callVertexGemini } = await import('../_shared/vertex-ai.ts');
      const fullPrompt = systemPrompt + '\n\n' + userPrompt;
      rawText = await callVertexGemini('gemini-2.5-flash', fullPrompt, 90_000, { temperature: 0.1, maxOutputTokens: maxTokens, responseMimeType: 'application/json' });
      actualProvider = 'vertex-ai'; actualModelId = 'gemini-2.5-flash'; break;
    }
    case 'vertex-pro': {
      const { callVertexGemini } = await import('../_shared/vertex-ai.ts');
      const fullPrompt = systemPrompt + '\n\n' + userPrompt;
      rawText = await callVertexGemini('gemini-2.5-pro', fullPrompt, 120_000, { temperature: 0.1, maxOutputTokens: maxTokens, responseMimeType: 'application/json' });
      actualProvider = 'vertex-ai'; actualModelId = 'gemini-2.5-pro'; break;
    }
    case 'vertex-3.1-pro': {
      const { callVertexGemini } = await import('../_shared/vertex-ai.ts');
      const fullPrompt = systemPrompt + '\n\n' + userPrompt;
      rawText = await callVertexGemini('gemini-3.1-pro-preview', fullPrompt, 120_000, { temperature: 0.1, maxOutputTokens: maxTokens, responseMimeType: 'application/json' });
      actualProvider = 'vertex-ai'; actualModelId = 'gemini-3.1-pro-preview'; break;
    }
    case 'vertex-3-flash': {
      const { callVertexGemini } = await import('../_shared/vertex-ai.ts');
      const fullPrompt = systemPrompt + '\n\n' + userPrompt;
      rawText = await callVertexGemini('gemini-3-flash-preview', fullPrompt, 90_000, { temperature: 0.1, maxOutputTokens: maxTokens, responseMimeType: 'application/json' });
      actualProvider = 'vertex-ai'; actualModelId = 'gemini-3-flash-preview'; break;
    }
    case 'vertex-3.1-flash-lite': {
      const { callVertexGemini } = await import('../_shared/vertex-ai.ts');
      const fullPrompt = systemPrompt + '\n\n' + userPrompt;
      rawText = await callVertexGemini('gemini-3.1-flash-lite-preview', fullPrompt, 60_000, { temperature: 0.1, maxOutputTokens: maxTokens, responseMimeType: 'application/json' });
      actualProvider = 'vertex-ai'; actualModelId = 'gemini-3.1-flash-lite-preview'; break;
    }
    default:
      throw new Error(`Unsupported AI model: "${model}". Supported: ${SUPPORTED_MODELS.join(', ')}`);
  }

  console.log(`[classify] DISPATCH_OK actual_provider=${actualProvider} actual_model=${actualModelId} responseLen=${rawText.length}`);
  return { rawText, actualProvider, actualModelId };
}

// ═══════════════════════════════════════════════════════════════
// Robust JSON parsing with one-shot repair
// ═══════════════════════════════════════════════════════════════

function stripMarkdownFences(text: string): string {
  return text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
}

function tryParseVerdicts(rawText: string): ClassificationVerdict[] | null {
  try {
    const cleaned = stripMarkdownFences(rawText);
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed)) return parsed;
    // Some models wrap in { verdicts: [...] }
    if (parsed && Array.isArray(parsed.verdicts)) return parsed.verdicts;
    return null;
  } catch {
    return null;
  }
}

async function parseWithRepair(
  rawText: string,
  aiModel: string,
  systemPrompt: string,
): Promise<ClassificationVerdict[]> {
  // Attempt 1: direct parse
  const direct = tryParseVerdicts(rawText);
  if (direct) return direct;

  // Attempt 2: one repair call — send only first 2000 chars of malformed output
  console.warn(`[classify] JSON_PARSE_FAILED, attempting one repair call. Snippet: ${rawText.substring(0, 200)}`);
  const snippet = rawText.substring(0, 2000);
  const repairPrompt = `The following output was supposed to be a valid JSON array of classification verdict objects but is malformed. Fix it and return ONLY the valid JSON array — nothing else:\n\n${snippet}`;

  try {
    const { rawText: repairedText } = await callClassifierAI(aiModel, 'You are a JSON repair assistant. Return only valid JSON.', repairPrompt, 8192);
    const repaired = tryParseVerdicts(repairedText);
    if (repaired) {
      console.log(`[classify] JSON_REPAIR_OK count=${repaired.length}`);
      return repaired;
    }
  } catch (repairErr) {
    console.error(`[classify] JSON_REPAIR_FAILED:`, repairErr);
  }

  throw new Error('Failed to parse AI classification response after repair attempt');
}

// ═══════════════════════════════════════════════════════════════
// Batch resilience: full → halves → individual
// ═══════════════════════════════════════════════════════════════

function buildUserPrompt(articles: ArticleDigest[], workflowType: string): string {
  const articlesSummary = articles.map((a, i) => {
    const contentSection = a.full_plain_text
      ? `FULL_TEXT:\n${a.full_plain_text.substring(0, 8000)}`
      : `INTRO:\n${a.intro_excerpt}\n\nMIDDLE:\n${a.middle_excerpt}\n\nENDING:\n${a.ending_excerpt}`;

    return `--- ARTICLE ${i + 1}: "${a.title}" (slug: ${a.slug}) ---
WORD_COUNT: ${a.word_count}
IS_PUBLISHED: ${a.is_published}
HEADINGS: ${a.headings.map(h => `H${h.level}: ${h.text}`).join(' | ')}
META: title=${a.meta_summary.has_meta_title}, desc=${a.meta_summary.has_meta_description}, excerpt=${a.meta_summary.has_excerpt}, cover=${a.meta_summary.has_cover_image}, alt=${a.meta_summary.has_image_alt}, canonical=${a.meta_summary.has_canonical_url}
HEURISTIC_SCORES: quality=${a.heuristic_scores.quality_score}, seo=${a.heuristic_scores.seo_score}, compliance_fails=${a.heuristic_scores.compliance_fail_count}, compliance_warns=${a.heuristic_scores.compliance_warn_count}
FAQ_QUESTIONS: ${a.faq_summary.length > 0 ? a.faq_summary.join(' | ') : 'NONE'}
INTERNAL_LINKS: ${a.internal_links.length > 0 ? a.internal_links.join(', ') : 'NONE'}
${contentSection}
--- END ARTICLE ${i + 1} ---`;
  }).join('\n\n');

  return `Classify these ${articles.length} articles for the "${workflowType}" workflow.\n\n${articlesSummary}\n\nReturn a JSON array of ${articles.length} verdict objects. ONLY output valid JSON, no markdown.`;
}

function makeDefaultVerdict(slug: string, reason: string): ClassificationVerdict {
  return {
    slug,
    verdict: 'manual_review',
    confidence: 0,
    reasons: [reason],
    severity: 'moderate',
    action_type: 'skip',
    safe_to_bulk_edit: false,
    requires_manual_review: true,
    preserve_elements: [],
    missing_elements: [],
    ranking_risk: 'medium',
  };
}

function matchVerdictsBySlug(
  verdicts: ClassificationVerdict[],
  articles: ArticleDigest[],
): Map<string, ClassificationVerdict> {
  const result = new Map<string, ClassificationVerdict>();
  const verdictMap = new Map<string, ClassificationVerdict>();
  for (const v of verdicts) {
    if (v.slug) verdictMap.set(v.slug, v);
  }
  for (const a of articles) {
    const matched = verdictMap.get(a.slug);
    if (matched) {
      result.set(a.slug, { ...matched, slug: a.slug });
    } else {
      result.set(a.slug, makeDefaultVerdict(a.slug, 'No AI verdict returned for this article'));
    }
  }
  return result;
}

interface BatchMeta {
  total: number;
  classified_ok: number;
  fallback_half_batch: number;
  fallback_individual: number;
  failed_to_manual_review: number;
}

async function classifyWithResilience(
  articles: ArticleDigest[],
  workflowType: string,
  aiModel: string,
  systemPrompt: string,
): Promise<{ verdicts: Map<string, ClassificationVerdict>; meta: BatchMeta }> {
  const meta: BatchMeta = { total: articles.length, classified_ok: 0, fallback_half_batch: 0, fallback_individual: 0, failed_to_manual_review: 0 };
  const results = new Map<string, ClassificationVerdict>();

  let fullBatchError = '';

  // Try full batch
  try {
    const userPrompt = buildUserPrompt(articles, workflowType);
    console.log(`[classify] FULL_BATCH batch_size=${articles.length} model=${aiModel}`);
    const { rawText } = await callClassifierAI(aiModel, systemPrompt, userPrompt, 16384);
    const verdicts = await parseWithRepair(rawText, aiModel, systemPrompt);
    const matched = matchVerdictsBySlug(verdicts, articles);
    for (const [slug, v] of matched) results.set(slug, v);
    meta.classified_ok = articles.length;
    console.log(`[classify] FULL_BATCH_OK parsed=${verdicts.length} matched=${results.size}`);
    return { verdicts: results, meta };
  } catch (fullErr: any) {
    fullBatchError = fullErr.message?.substring(0, 150) || 'unknown';
    console.error(`[classify] FULL_BATCH_FAILED count=${articles.length} error="${fullBatchError}"`);
  }

  // If only 1 article, no point splitting
  if (articles.length === 1) {
    const slug = articles[0].slug;
    results.set(slug, makeDefaultVerdict(slug, `AI classification failed: ${fullBatchError}`));
    meta.failed_to_manual_review = 1;
    console.log(`[classify] SINGLE_ARTICLE_FAILED slug=${slug}`);
    return { verdicts: results, meta };
  }

  // Split into halves
  const mid = Math.ceil(articles.length / 2);
  const halves = [articles.slice(0, mid), articles.slice(mid)];

  for (let hi = 0; hi < halves.length; hi++) {
    const half = halves[hi];
    if (half.length === 0) continue;

    try {
      const userPrompt = buildUserPrompt(half, workflowType);
      console.log(`[classify] HALF_BATCH half=${hi + 1} size=${half.length}`);
      const { rawText } = await callClassifierAI(aiModel, systemPrompt, userPrompt, 16384);
      const verdicts = await parseWithRepair(rawText, aiModel, systemPrompt);
      const matched = matchVerdictsBySlug(verdicts, half);
      for (const [slug, v] of matched) results.set(slug, v);
      meta.classified_ok += half.length;
      meta.fallback_half_batch += half.length;
      console.log(`[classify] HALF_BATCH_OK half=${hi + 1} parsed=${verdicts.length}`);
    } catch (halfErr: any) {
      console.error(`[classify] HALF_BATCH_FAILED half=${hi + 1} error="${halfErr.message?.substring(0, 150)}"`);

      // Fall back to individual items
      for (const article of half) {
        try {
          const userPrompt = buildUserPrompt([article], workflowType);
          console.log(`[classify] INDIVIDUAL_ATTEMPT slug=${article.slug}`);
          const { rawText } = await callClassifierAI(aiModel, systemPrompt, userPrompt, 4096);
          const verdicts = await parseWithRepair(rawText, aiModel, systemPrompt);
          const matched = matchVerdictsBySlug(verdicts, [article]);
          for (const [slug, v] of matched) results.set(slug, v);
          meta.classified_ok++;
          meta.fallback_individual++;
          console.log(`[classify] INDIVIDUAL_OK slug=${article.slug}`);
        } catch (indErr: any) {
          console.error(`[classify] INDIVIDUAL_FAILED slug=${article.slug} error="${indErr.message?.substring(0, 100)}"`);
          results.set(article.slug, makeDefaultVerdict(article.slug, `AI classification failed: ${indErr.message?.substring(0, 100)}`));
          meta.failed_to_manual_review++;
        }
      }
    }
  }

  console.log(`[classify] DONE classified_ok=${meta.classified_ok} half_batch=${meta.fallback_half_batch} individual=${meta.fallback_individual} failed=${meta.failed_to_manual_review}`);
  return { verdicts: results, meta };
}

// ═══════════════════════════════════════════════════════════════
// Main handler
// ═══════════════════════════════════════════════════════════════

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const authResult = await verifyAdmin(req);
  if (authResult instanceof Response) return authResult;

  try {
    const body = await req.json().catch(() => null);
    if (!body) {
      return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { articles, workflow_type, ai_model } = body as {
      articles: ArticleDigest[];
      workflow_type: 'fix' | 'enrich' | 'publish';
      ai_model?: string;
    };

    if (!articles || !Array.isArray(articles) || articles.length === 0) {
      return new Response(JSON.stringify({ error: 'No articles provided' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (articles.length > 10) {
      return new Response(JSON.stringify({ error: 'Max 10 articles per batch' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const modelKey = ai_model || 'gemini-flash';

    // Validate model is supported before doing anything
    if (!SUPPORTED_MODELS.includes(modelKey)) {
      return new Response(JSON.stringify({ error: `Unsupported AI model: "${modelKey}". Supported: ${SUPPORTED_MODELS.join(', ')}` }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    console.log(`[classify] START model_requested=${modelKey} batch_size=${articles.length} workflow=${workflow_type}`);

    let systemPrompt: string;
    if (workflow_type === 'publish') {
      systemPrompt = buildPublishClassificationPrompt();
    } else if (workflow_type === 'fix') {
      systemPrompt = buildFixClassificationPrompt();
    } else {
      systemPrompt = buildEnrichClassificationPrompt();
    }

    // Classify with batch resilience
    const { verdicts: verdictMap, meta } = await classifyWithResilience(articles, workflow_type, modelKey, systemPrompt);

    // Post-process: enforce safety rules, collect into ordered array
    const processed: ClassificationVerdict[] = [];
    for (const article of articles) {
      const v = verdictMap.get(article.slug) || makeDefaultVerdict(article.slug, 'Verdict not found');
      const result = { ...v, slug: article.slug };

      // Enforce: confidence < 0.7 → manual_review
      if (result.confidence < 0.7) {
        result.verdict = 'manual_review';
        result.requires_manual_review = true;
        result.safe_to_bulk_edit = false;
        if (!result.reasons.includes('Low AI confidence')) {
          result.reasons.push('Low AI confidence');
        }
      }

      // Enforce: ranking_risk 'high' → manual_review
      if (result.ranking_risk === 'high') {
        result.verdict = 'manual_review';
        result.requires_manual_review = true;
        result.safe_to_bulk_edit = false;
        if (!result.reasons.includes('High ranking risk')) {
          result.reasons.push('High ranking risk');
        }
      }

      // For fix/enrich: published + strong scores → skip or manual_review
      if (workflow_type !== 'publish' && article.is_published &&
          article.heuristic_scores.quality_score >= 75 &&
          article.heuristic_scores.seo_score >= 75) {
        if (result.verdict === 'needs_action' && result.action_type !== 'minimal_safe_edit') {
          result.verdict = 'manual_review';
          result.requires_manual_review = true;
          result.safe_to_bulk_edit = false;
          result.ranking_risk = 'medium';
          if (!result.reasons.includes('Published strong post — requires manual review')) {
            result.reasons.push('Published strong post — requires manual review');
          }
        }
      }

      // Ensure boolean fields are correct
      result.safe_to_bulk_edit = result.verdict === 'needs_action' && !result.requires_manual_review;
      result.requires_manual_review = result.verdict === 'manual_review';

      processed.push(result);
    }

    return new Response(JSON.stringify({ verdicts: processed, _meta: meta }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('[classify] UNHANDLED_ERROR:', err);
    return new Response(JSON.stringify({ error: err.message || 'Internal error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});

// ═══════════════════════════════════════════════════════════════
// Prompt builders (unchanged)
// ═══════════════════════════════════════════════════════════════

function buildFixClassificationPrompt(): string {
  return `You are an expert blog content auditor. Your job is to classify articles that may need compliance/SEO/quality fixes.

For each article, determine:
1. Does it genuinely need fixes, or is it already acceptable?
2. What severity of fixes are needed?
3. What should be preserved vs changed?

RULES:
- Published posts with quality >= 75 and SEO >= 75: default to "skip" unless there are clear, objective issues (missing canonical, empty meta fields).
- For "minimal_safe_edit": only recommend filling EMPTY metadata fields. Never overwrite existing good values.
- For "targeted_fix": recommend specific compliance fixes for clearly failed checks only.
- Prefer "skip" over weak/uncertain fixes.
- If you're not confident (< 70% sure), set verdict to "manual_review".

Return JSON array where each element has:
{
  "slug": "article-slug",
  "verdict": "needs_action" | "skip" | "manual_review",
  "confidence": 0.0-1.0,
  "reasons": ["reason1", "reason2"],
  "severity": "minor" | "moderate" | "major",
  "action_type": "minimal_safe_edit" | "targeted_fix" | "full_enrich" | "skip",
  "safe_to_bulk_edit": true/false,
  "requires_manual_review": true/false,
  "preserve_elements": ["title", "content", "existing-meta"],
  "missing_elements": ["meta_description", "canonical_url"],
  "ranking_risk": "low" | "medium" | "high"
}`;
}

function buildEnrichClassificationPrompt(): string {
  return `You are an expert blog content auditor. Your job is to classify articles that may need content enrichment (more sections, FAQs, internal links, better structure).

For each article, determine:
1. Would enrichment meaningfully improve this article?
2. What specific content additions would help?
3. What existing content must be preserved?

RULES:
- Published posts with quality >= 75 and SEO >= 75: default to "skip". Only recommend enrichment if there's a clear, significant gap (e.g. no FAQ at all, no internal links, word count below 800).
- "full_enrich": for articles that genuinely need substantial content additions.
- "targeted_fix": for articles that just need a FAQ section or internal links.
- "minimal_safe_edit": for articles that just need metadata improvements.
- NEVER recommend rewriting existing good content. Only ADD missing elements.
- Prefer "skip" over weak enrichment that might dilute existing quality.
- If unsure whether enrichment would help, set verdict to "manual_review".

Return JSON array where each element has:
{
  "slug": "article-slug",
  "verdict": "needs_action" | "skip" | "manual_review",
  "confidence": 0.0-1.0,
  "reasons": ["reason1", "reason2"],
  "severity": "minor" | "moderate" | "major",
  "action_type": "minimal_safe_edit" | "targeted_fix" | "full_enrich" | "skip",
  "safe_to_bulk_edit": true/false,
  "requires_manual_review": true/false,
  "preserve_elements": ["title", "intro", "existing-sections"],
  "missing_elements": ["faq_section", "internal_links", "conclusion"],
  "ranking_risk": "low" | "medium" | "high"
}`;
}

function buildPublishClassificationPrompt(): string {
  return `You are an expert blog content quality evaluator. These articles have passed basic structural and compliance checks but are BORDERLINE candidates for bulk publishing. Your job is to determine whether each article is genuinely ready to be published on a live website.

For each article, evaluate:
1. Is the content meaningfully complete and useful for readers? Does it provide genuine value?
2. Does it read like real, helpful content — or is it AI-generated padding, fluff, or filler?
3. Is the content safe and appropriate for a public-facing website?
4. Would publishing this article reflect well on the website's quality and credibility?

IMPORTANT RULES:
- Be CONSERVATIVE. When in doubt, set verdict to "manual_review". Under-publishing is better than publishing weak content.
- "needs_action" means the article IS genuinely ready to publish. Only use this for articles you're confident about (>= 70%).
- "manual_review" means you're uncertain or the article has quality concerns that need human judgment.
- "skip" means the article is clearly NOT ready for publishing.
- Look for signs of low-quality AI content: repetitive phrasing, generic statements, lack of specific details, padding words.
- A publish-ready article should have a clear topic, useful information, proper structure, and read naturally.
- Do NOT recommend content changes — only evaluate publish readiness. The action_type for publish-ready articles should be "skip" (no content changes needed).

Return JSON array where each element has:
{
  "slug": "article-slug",
  "verdict": "needs_action" | "skip" | "manual_review",
  "confidence": 0.0-1.0,
  "reasons": ["reason1", "reason2"],
  "severity": "minor" | "moderate" | "major",
  "action_type": "skip",
  "safe_to_bulk_edit": true/false,
  "requires_manual_review": true/false,
  "preserve_elements": [],
  "missing_elements": [],
  "ranking_risk": "low" | "medium" | "high"
}`;
}
