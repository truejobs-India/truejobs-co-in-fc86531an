import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import Anthropic from 'npm:@anthropic-ai/sdk@0.39.0';
import { computeMaxTokens, countWordsFromHtml, validateWordCount, buildWordCountInstruction } from '../_shared/word-count-enforcement.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// ═══════════════════════════════════════════════════════════════════════════════
// ADMIN AUTH
// ═══════════════════════════════════════════════════════════════════════════════

async function verifyAdmin(req: Request): Promise<{ userId: string } | Response> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized — missing token' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const token = authHeader.replace('Bearer ', '');
  const { data, error } = await supabase.auth.getClaims(token);
  if (error || !data?.claims) {
    return new Response(JSON.stringify({ error: 'Unauthorized — invalid token' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  const userId = data.claims.sub as string;
  const svc = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data: roleRow } = await svc.from('user_roles').select('role').eq('user_id', userId).eq('role', 'admin').maybeSingle();
  if (!roleRow) {
    return new Response(JSON.stringify({ error: 'Forbidden — admin role required' }), {
      status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  return { userId };
}

// ═══════════════════════════════════════════════════════════════════════════════
// MASTER AUTHORITY PROMPT
// ═══════════════════════════════════════════════════════════════════════════════

const MASTER_AUTHORITY_PROMPT = `You are the Chief Content Strategist at TrueJobs.co.in — India's most trusted government job preparation portal.

Create authoritative, data-dense content for Indian government exam/job pages. Your readers are real aspirants preparing for competitive exams.

=== QUALITY STANDARDS ===
- E-E-A-T: Write with experience (reference real preparation challenges), expertise (exact pay levels, age relaxation rules, exam patterns), authoritativeness (cite official sources like ssc.gov.in, upsc.gov.in), trustworthiness (never fabricate data).
- AdSense compliant: Original value beyond official notifications. No thin content.
- If exact data unavailable, state "As per official notification" — never invent numbers.

=== CONTENT RULES ===
- Every paragraph must contain specific, useful data (dates, figures, pay levels, vacancies).
- Use HTML tables for: vacancy breakdowns, salary comparisons, exam patterns, important dates, cut-offs.
- Bold: dates, salary figures, age limits, vacancy numbers, deadlines.
- Paragraphs: max 3 sentences each. No filler phrases.
- Include Hindi transliterations for key terms where helpful for SEO.
- Reference official websites by name and URL.

BANNED PHRASES: "In today's competitive world", "golden opportunity", "As we all know", "Let's dive in", "Without further ado", "Needless to say", any sentence that restates what was already said.

=== STRUCTURE ===
SECTION 1 — Quick Overview Table (always first):
Use an HTML table with key facts: Conducting Body, Exam Name, Vacancies, Eligibility, Age Limit, Salary, Application Mode, Official Website.

FINAL SECTION — FAQ with schema.org markup (FAQPage, Question, Answer itemtypes).

=== SEO ===
- Primary keyword in first 100 words and 3+ H2 headings naturally.
- H2 headings should be question-based where possible (featured snippet optimization).
- Include a clear 40-60 word featured snippet paragraph answering "What is [exam]?" within the first 200 words.
- Suggest 3-5 related page slugs for internal linking.`;

// ═══════════════════════════════════════════════════════════════════════════════
// MODEL CONFIG & CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

const ANTHROPIC_MODEL = Deno.env.get('ANTHROPIC_MODEL') || 'claude-sonnet-4-6';
const ANTHROPIC_DEFAULT_MAX_TOKENS = 4096;
const ANTHROPIC_RETRY_MAX_TOKENS = 6144;
// Hard timeout per Claude SDK request.
const CLAUDE_SDK_TIMEOUT_MS = parseInt(Deno.env.get('CLAUDE_SDK_TIMEOUT_MS') || '50000', 10);
// Total budget for one invocation AI path so edge requests do not die before response.
const AI_TOTAL_BUDGET_MS = parseInt(Deno.env.get('ENRICH_AI_TOTAL_BUDGET_MS') || '110000', 10);
const GEMINI_FALLBACK_RESERVED_MS = 30000;
const CLAUDE_RETRY_MIN_REMAINING_MS = 55000;

const TIMEOUTS: Record<string, number> = {
  'gemini-flash': 60_000,
  'gemini-pro': 60_000,
  'vertex-flash': 90_000,
  'vertex-pro': 120_000,
  'claude-sonnet': 140_000,
  'claude': 140_000,
  'mistral': 120_000,
  'groq': 30_000,
  'lovable-gemini': 60_000,
  'gpt5': 60_000,
  'gpt5-mini': 60_000,
};

function getTimeout(model: string): number {
  return TIMEOUTS[model] || 60_000;
}

function getRemainingBudgetMs(startedAtMs: number): number {
  return AI_TOTAL_BUDGET_MS - (Date.now() - startedAtMs);
}

function computeFallbackTimeoutMs(startedAtMs: number): number {
  const remaining = getRemainingBudgetMs(startedAtMs) - 2000;
  return Math.max(12_000, Math.min(60_000, remaining));
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  return await new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timeout after ${timeoutMs}ms`)), timeoutMs);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// CLAUDE: SIMPLIFIED TOOL SCHEMA FOR STRUCTURED OUTPUT
// ═══════════════════════════════════════════════════════════════════════════════
// Minimal schema — only fields the DB save pipeline and page renderer need.
// All HTML content fields are optional strings. The tool_use pattern guarantees
// Claude returns valid JSON matching this schema.

const ENRICHMENT_TOOL_SCHEMA: Anthropic.Tool = {
  name: 'save_enrichment',
  description: 'Save the generated enrichment content for this government exam/job page.',
  input_schema: {
    type: 'object' as const,
    properties: {
      // Keep required fields first so they are emitted before optional fields if output gets truncated.
      overview: { type: 'string', description: 'HTML overview with Quick Overview Table, 200-400 words' },
      faq: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            question: { type: 'string' },
            answer: { type: 'string' },
          },
          required: ['question', 'answer'],
        },
        description: '5-8 FAQ items',
      },
      meta_title: { type: 'string', description: 'Under 60 chars, primary keyword included' },
      meta_description: { type: 'string', description: 'Under 155 chars' },

      eligibility: { type: 'string', description: 'HTML eligibility section' },
      vacancyDetails: { type: 'string', description: 'HTML vacancy breakdown with table' },
      examPattern: { type: 'string', description: 'HTML exam pattern with table' },
      salary: { type: 'string', description: 'HTML salary structure' },
      applicationProcess: { type: 'string', description: 'HTML step-by-step how to apply' },
      importantDates: { type: 'string', description: 'HTML table of important dates' },
      preparationTips: { type: 'string', description: 'HTML preparation strategy' },
      cutoffTrends: { type: 'string', description: 'HTML previous year cutoff analysis' },
      importantLinks: { type: 'string', description: 'HTML list of important links' },
      internal_links: {
        type: 'array',
        items: { type: 'string' },
        description: '3-5 related page slugs',
      },
    },
    required: ['overview', 'faq', 'meta_title', 'meta_description'],
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// CLAUDE: SDK-BASED STRUCTURED OUTPUT WITH TOOL_USE
// ═══════════════════════════════════════════════════════════════════════════════

interface ClaudeDiagnostics {
  slug: string;
  model: string;
  anthropicVersion: string;
  maxTokens: number;
  structuredOutput: boolean;
  promptChars: number;
  elapsedMs: number;
  requestId: string;
  stopReason: string;
  sdkParseSuccess: boolean;
  validationError: string | null;
  fallbackTriggered: boolean;
  fallbackModel: string | null;
  attempt: number;
  retried: boolean;
  retryReason: string | null;
}

function createDiagnostics(slug: string, promptChars: number): ClaudeDiagnostics {
  return {
    slug,
    model: ANTHROPIC_MODEL,
    anthropicVersion: '2023-06-01',
    maxTokens: ANTHROPIC_DEFAULT_MAX_TOKENS,
    structuredOutput: true,
    promptChars,
    elapsedMs: 0,
    requestId: 'n/a',
    stopReason: 'unknown',
    sdkParseSuccess: false,
    validationError: null,
    fallbackTriggered: false,
    fallbackModel: null,
    attempt: 1,
    retried: false,
    retryReason: null,
  };
}

function logClaudeRequest(diag: ClaudeDiagnostics, phase: string, requestTimeoutMs: number) {
  console.log(`[claude-${phase}] slug=${diag.slug} model=${diag.model} anthropic-version=${diag.anthropicVersion} max_tokens=${diag.maxTokens} structured=${diag.structuredOutput} prompt_chars=${diag.promptChars} attempt=${diag.attempt} sdk_timeout_ms=${requestTimeoutMs}`);
}

async function callClaudeSDK(
  prompt: string,
  slug: string,
  maxTokens: number,
  requestTimeoutMs = CLAUDE_SDK_TIMEOUT_MS,
): Promise<{ data: Record<string, unknown>; diagnostics: ClaudeDiagnostics }> {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured — please add it to secrets');

  const client = new Anthropic({ apiKey, timeout: requestTimeoutMs, maxRetries: 0 });
  const diag = createDiagnostics(slug, prompt.length);
  diag.maxTokens = maxTokens;

  logClaudeRequest(diag, 'pre-request', requestTimeoutMs);
  const startMs = Date.now();

  try {
    const response = await withTimeout(
      client.messages.create({
        model: ANTHROPIC_MODEL,
        max_tokens: maxTokens,
        temperature: 0.5,
        tools: [ENRICHMENT_TOOL_SCHEMA],
        tool_choice: { type: 'tool' as const, name: 'save_enrichment' },
        messages: [{ role: 'user', content: prompt }],
      }),
      requestTimeoutMs,
      'Claude SDK request',
    );

    diag.elapsedMs = Date.now() - startMs;
    diag.requestId = (response as any).id || 'n/a';
    diag.stopReason = response.stop_reason || 'unknown';

    console.log(`[claude-response] slug=${slug} elapsed=${diag.elapsedMs}ms stop_reason=${diag.stopReason} request_id=${diag.requestId} content_blocks=${response.content.length}`);

    // Extract tool_use block
    const toolBlock = response.content.find((block) => block.type === 'tool_use' && block.name === 'save_enrichment');

    if (!toolBlock || toolBlock.type !== 'tool_use') {
      diag.sdkParseSuccess = false;
      diag.validationError = `No tool_use block found. Content types: ${response.content.map(b => b.type).join(',')}`;
      console.error(`[claude-parse] ${slug}: ${diag.validationError}`);
      throw new Error(diag.validationError);
    }

    const data = toolBlock.input as Record<string, unknown>;

    // Validate required fields
    if (!data.overview || !data.faq || !data.meta_title || !data.meta_description) {
      diag.sdkParseSuccess = false;
      diag.validationError = `Missing required fields: ${['overview', 'faq', 'meta_title', 'meta_description'].filter(f => !data[f]).join(', ')}`;
      console.error(`[claude-validate] ${slug}: ${diag.validationError}`);
      throw new Error(diag.validationError);
    }

    diag.sdkParseSuccess = true;
    console.log(`[claude-parse] ${slug}: SDK tool_use parse OK, fields=${Object.keys(data).length}, faq_count=${Array.isArray(data.faq) ? data.faq.length : 0}`);
    return { data, diagnostics: diag };

  } catch (err) {
    diag.elapsedMs = Date.now() - startMs;

    // If it's already our validation error, re-throw with diagnostics
    if (err instanceof Error && (err.message.includes('Missing required fields') || err.message.includes('No tool_use block'))) {
      (err as any).diagnostics = diag;
      throw err;
    }

    // SDK/API errors
    const errMsg = err instanceof Error ? err.message : String(err);
    diag.validationError = errMsg;
    diag.sdkParseSuccess = false;

    // Log full error for API errors
    if (err instanceof Anthropic.APIError) {
      console.error(`[claude-api-error] ${slug}: status=${err.status} message=${err.message} request_id=${(err as any).request_id || 'n/a'}`);
      diag.requestId = (err as any).request_id || 'n/a';
    } else {
      console.error(`[claude-error] ${slug}: ${errMsg}`);
    }

    const wrappedErr = new Error(`Claude SDK error: ${errMsg}`);
    (wrappedErr as any).diagnostics = diag;
    throw wrappedErr;
  }
}

function buildClaudeRecoveryPrompt(originalPrompt: string): string {
  return `${originalPrompt}

=== RETRY MODE: COMPLETE REQUIRED FIELDS FIRST ===
You must prioritize required fields before any optional fields.
1) Fill overview completely (with quick overview table)
2) Fill faq with at least 6 items
3) Fill meta_title and meta_description
4) Then fill optional sections only if tokens remain
Keep content compact and data-dense. Avoid long prose.`;
}

/**
 * Full Claude call: attempt → targeted retry when needed.
 * Does NOT handle Gemini fallback (that's in callAI).
 */
async function callClaudeWithRetry(
  prompt: string,
  slug: string,
  startedAtMs: number,
): Promise<{ data: Record<string, unknown>; diagnostics: ClaudeDiagnostics }> {
  const firstAttemptTimeout = Math.min(
    CLAUDE_SDK_TIMEOUT_MS,
    Math.max(15_000, getRemainingBudgetMs(startedAtMs) - 5000),
  );

  try {
    const result = await callClaudeSDK(prompt, slug, ANTHROPIC_DEFAULT_MAX_TOKENS, firstAttemptTimeout);

    // If we already parsed valid structured output, do NOT retry even if stop_reason=max_tokens.
    if (result.diagnostics.stopReason === 'max_tokens') {
      console.warn(`[claude-truncated-valid] ${slug}: stop_reason=max_tokens but required schema parsed successfully; using attempt 1 output.`);
    }

    return result;
  } catch (firstErr) {
    const errMsg = firstErr instanceof Error ? firstErr.message : String(firstErr);
    const diag = (firstErr as any)?.diagnostics as ClaudeDiagnostics | undefined;

    // Circuit breaker: don't retry on 4xx errors (bad request, auth, etc.)
    if (errMsg.includes('400') || errMsg.includes('401') || errMsg.includes('403') || errMsg.includes('404')) {
      console.error(`[claude-circuit-breaker] ${slug}: 4xx error, no retry. Error: ${errMsg}`);
      throw firstErr;
    }

    const remainingBudget = getRemainingBudgetMs(startedAtMs);

    // If truncation caused missing required fields, retry once with compact recovery instructions.
    const isTruncationMissingRequired =
      diag?.stopReason === 'max_tokens' &&
      (errMsg.includes('Missing required fields') || errMsg.includes('No tool_use block'));

    if (isTruncationMissingRequired) {
      if (remainingBudget < CLAUDE_RETRY_MIN_REMAINING_MS) {
        console.warn(`[claude-circuit-breaker] ${slug}: skip retry due low remaining budget (${remainingBudget}ms). Giving up.`);
        throw firstErr;
      }

      console.warn(`[claude-retry] ${slug}: max_tokens truncation with incomplete required fields. Retrying once with compact recovery prompt at ${ANTHROPIC_RETRY_MAX_TOKENS} tokens...`);
      const compactPrompt = buildClaudeRecoveryPrompt(prompt);
      const retryTimeout = Math.min(
        CLAUDE_SDK_TIMEOUT_MS,
        Math.max(15_000, getRemainingBudgetMs(startedAtMs) - 5000),
      );

      try {
        const retryResult = await callClaudeSDK(compactPrompt, slug, ANTHROPIC_RETRY_MAX_TOKENS, retryTimeout);
        retryResult.diagnostics.attempt = 2;
        retryResult.diagnostics.retried = true;
        retryResult.diagnostics.retryReason = 'max_tokens_missing_required_compact_prompt';
        return retryResult;
      } catch (retryErr) {
        const retryDiag = (retryErr as any)?.diagnostics as ClaudeDiagnostics | undefined;
        if (retryDiag) {
          retryDiag.attempt = 2;
          retryDiag.retried = true;
          retryDiag.retryReason = 'max_tokens_missing_required_compact_prompt';
        }
        throw retryErr;
      }
    }

    // No transient retry: only truncation-based retry is allowed.
    console.warn(`[claude-no-retry] ${slug}: error=${errMsg}. No fallback. remaining_budget_ms=${remainingBudget}`);
    throw firstErr;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODEL INTEGRATIONS (non-Claude)
// ═══════════════════════════════════════════════════════════════════════════════

// ── Gemini (Direct API) ──
async function fetchGemini(prompt: string, model = 'gemini-2.5-flash', timeoutMs = 60_000, maxOutputTokens = 16384): Promise<string> {
  const apiKey = Deno.env.get('GEMINI_API_KEY');
  if (!apiKey) throw new Error('GEMINI_API_KEY not configured — please add it to secrets');

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.5,
          topP: 0.8,
          maxOutputTokens,
          responseMimeType: 'application/json',
        },
      }),
    });

    if (response.status === 429) {
      console.warn('Gemini 429 — retrying in 5s...');
      await new Promise(r => setTimeout(r, 5000));
      const retry = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.5, topP: 0.8, maxOutputTokens, responseMimeType: 'application/json' },
        }),
      });
      if (!retry.ok) throw new Error(`Gemini retry failed: ${retry.status}`);
      const d = await retry.json();
      return d.candidates?.[0]?.content?.parts?.[0]?.text || '';
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API error ${response.status}: ${errorText.substring(0, 500)}`);
    }
    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  } finally {
    clearTimeout(timer);
  }
}

// ── Groq (Llama 3.3 70B) ──
async function callGroqRaw(prompt: string, timeoutMs = 30_000, maxTokens = 16384): Promise<string> {
  const apiKey = Deno.env.get('GROQ_API_KEY');
  if (!apiKey) throw new Error('GROQ_API_KEY not configured — please add it to secrets');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.5,
        max_tokens: maxTokens,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Groq API error ${response.status}: ${errorText.substring(0, 500)}`);
    }
    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
  } finally {
    clearTimeout(timer);
  }
}

// ── AWS SigV4 helpers for Bedrock ──
async function hmacSha256(key: Uint8Array, message: string): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(message));
  return new Uint8Array(sig);
}

async function sha256Hex(data: string): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data));
  return [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, '0')).join('');
}

async function getSigningKey(secretKey: string, dateStamp: string, region: string, service: string): Promise<Uint8Array> {
  let key = await hmacSha256(new TextEncoder().encode('AWS4' + secretKey), dateStamp);
  key = await hmacSha256(key, region);
  key = await hmacSha256(key, service);
  key = await hmacSha256(key, 'aws4_request');
  return key;
}

async function awsSigV4Fetch(url: string, body: string, region: string, service: string, timeoutMs: number): Promise<Response> {
  const accessKey = Deno.env.get('AWS_ACCESS_KEY_ID');
  const secretKey = Deno.env.get('AWS_SECRET_ACCESS_KEY');
  if (!accessKey || !secretKey) throw new Error('AWS credentials not configured — please add AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY secrets');

  const parsedUrl = new URL(url);
  const now = new Date();
  const amzDate = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const dateStamp = amzDate.substring(0, 8);
  const payloadHash = await sha256Hex(body);
  const canonicalPath = parsedUrl.pathname.split('/').map(s => encodeURIComponent(decodeURIComponent(s))).join('/');

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Host': parsedUrl.host,
    'X-Amz-Date': amzDate,
    'X-Amz-Content-Sha256': payloadHash,
  };

  const signedHeaderKeys = Object.keys(headers).sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
  const signedHeaders = signedHeaderKeys.map(k => k.toLowerCase()).join(';');
  const canonicalHeaders = signedHeaderKeys.map(k => `${k.toLowerCase()}:${headers[k].trim()}`).join('\n') + '\n';
  const canonicalRequest = ['POST', canonicalPath, '', canonicalHeaders, signedHeaders, payloadHash].join('\n');

  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, credentialScope, await sha256Hex(canonicalRequest)].join('\n');
  const signingKey = await getSigningKey(secretKey, dateStamp, region, service);
  const signatureBytes = await hmacSha256(signingKey, stringToSign);
  const signature = [...signatureBytes].map(b => b.toString(16).padStart(2, '0')).join('');

  headers['Authorization'] = `AWS4-HMAC-SHA256 Credential=${accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { method: 'POST', headers, body, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// ── Mistral Large (AWS Bedrock — us-west-2) ──
async function callMistralRaw(prompt: string, timeoutMs = 60_000, maxTokens = 16384): Promise<string> {
  const region = 'us-west-2';
  const modelId = 'mistral.mistral-large-2407-v1:0';
  const url = `https://bedrock-runtime.${region}.amazonaws.com/model/${modelId}/invoke`;

  const body = JSON.stringify({
    prompt: `<s>[INST] ${prompt} [/INST]`,
    max_tokens: maxTokens,
    temperature: 0.5,
    top_p: 0.9,
  });

  const response = await awsSigV4Fetch(url, body, region, 'bedrock', timeoutMs);
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Mistral/Bedrock error ${response.status}: ${errorText.substring(0, 500)}`);
  }
  const data = await response.json();
  return data.outputs?.[0]?.text || '';
}

// ── Lovable Gemini (Gateway) ──
async function callLovableGeminiRaw(prompt: string, timeoutMs = 60_000, maxTokens = 16384): Promise<string> {
  const apiKey = Deno.env.get('LOVABLE_API_KEY');
  if (!apiKey) throw new Error('LOVABLE_API_KEY not configured — please add it to secrets');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.5,
        max_tokens: maxTokens,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Lovable Gemini error ${response.status}: ${errorText.substring(0, 500)}`);
    }
    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
  } finally {
    clearTimeout(timer);
  }
}

// ── OpenAI GPT-5 / GPT-5 Mini (via Lovable AI Gateway) ──
async function callOpenAIRaw(prompt: string, model = 'openai/gpt-5', timeoutMs = 60_000, maxTokens = 16384): Promise<string> {
  const apiKey = Deno.env.get('LOVABLE_API_KEY');
  if (!apiKey) throw new Error('LOVABLE_API_KEY not configured — please add it to secrets');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.5,
        max_completion_tokens: maxTokens,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI (${model}) error ${response.status}: ${errorText.substring(0, 500)}`);
    }
    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
  } finally {
    clearTimeout(timer);
  }
}

// ── Smart JSON Recovery (4-stage) — backup for non-Claude models ──
function tryParseJSON(raw: string): Record<string, unknown> {
  // Stage 1: direct parse
  try { return JSON.parse(raw); } catch { /* continue */ }

  // Stage 2: strip markdown fences
  let cleaned = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
  try { return JSON.parse(cleaned); } catch { /* continue */ }

  // Stage 3: extract boundaries
  const first = cleaned.indexOf('{');
  const last = cleaned.lastIndexOf('}');
  if (first !== -1 && last > first) {
    const extracted = cleaned.substring(first, last + 1);
    try { return JSON.parse(extracted); } catch { /* continue */ }

    // Stage 4: truncate — find last complete key-value and close
    const lastComma = extracted.lastIndexOf(',');
    const lastColon = extracted.lastIndexOf(':');
    if (lastComma > 0 || lastColon > 0) {
      const cutPoint = Math.max(lastComma, extracted.lastIndexOf('"}'));
      if (cutPoint > 0) {
        const truncated = extracted.substring(0, cutPoint + (extracted[cutPoint] === '"' ? 2 : 1));
        let balanced = truncated;
        const openBrackets = (balanced.match(/\[/g) || []).length - (balanced.match(/\]/g) || []).length;
        const openBraces = (balanced.match(/\{/g) || []).length - (balanced.match(/\}/g) || []).length;
        for (let i = 0; i < openBrackets; i++) balanced += ']';
        for (let i = 0; i < openBraces; i++) balanced += '}';
        try { return JSON.parse(balanced); } catch { /* fall through */ }
      }
    }
  }

  throw new Error(`Failed to parse JSON from AI response (length=${raw.length})`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// AI DISPATCHER — no automatic fallback between models
// ═══════════════════════════════════════════════════════════════════════════════

function resolveProviderInfo(model: string): { provider: string; apiModel: string } {
  switch (model) {
    case 'gemini-flash': case 'gemini': return { provider: 'google-ai-studio', apiModel: 'gemini-2.5-flash' };
    case 'gemini-pro': return { provider: 'google-ai-studio', apiModel: 'gemini-2.5-pro' };
    case 'vertex-flash': return { provider: 'vertex-ai', apiModel: 'gemini-2.5-flash' };
    case 'vertex-pro': return { provider: 'vertex-ai', apiModel: 'gemini-2.5-pro' };
    case 'claude-sonnet': case 'claude': return { provider: 'anthropic', apiModel: 'claude-sonnet-4-6' };
    case 'groq': return { provider: 'groq', apiModel: 'llama-3.3-70b-versatile' };
    case 'mistral': return { provider: 'bedrock', apiModel: 'mistral.mistral-large-2407-v1:0' };
    case 'lovable-gemini': return { provider: 'lovable-gateway', apiModel: 'google/gemini-2.5-flash' };
    case 'gpt5': return { provider: 'lovable-gateway', apiModel: 'openai/gpt-5' };
    case 'gpt5-mini': return { provider: 'lovable-gateway', apiModel: 'openai/gpt-5-mini' };
    case 'nova-pro': return { provider: 'bedrock', apiModel: 'us.amazon.nova-pro-v1:0' };
    case 'nova-premier': return { provider: 'bedrock', apiModel: 'us.amazon.nova-premier-v1:0' };
    default: return { provider: model, apiModel: model };
  }
}

async function callAI(
  model: string,
  prompt: string,
  slug: string,
  startedAtMs: number,
  maxTokens?: number,
): Promise<{ data: Record<string, unknown>; diagnostics?: Record<string, unknown> }> {
  const timeout = getTimeout(model);
  let rawText: string;

  switch (model) {
    case 'gemini-flash':
    case 'gemini':
      rawText = await fetchGemini(prompt, 'gemini-2.5-flash', timeout, maxTokens || 16384);
      return { data: tryParseJSON(rawText) };
    case 'gemini-pro':
      rawText = await fetchGemini(prompt, 'gemini-2.5-pro', timeout, maxTokens || 16384);
      return { data: tryParseJSON(rawText) };

    case 'vertex-flash': {
      const { callVertexGemini } = await import('../_shared/vertex-ai.ts');
      console.log(`[enrich-vertex] slug=${slug} model=vertex-flash timeout=${timeout}ms`);
      rawText = await callVertexGemini('gemini-2.5-flash', prompt, timeout, {
        maxOutputTokens: maxTokens || 16384,
        responseMimeType: 'application/json',
        temperature: 0.5,
        topP: 0.8,
      });
      return { data: tryParseJSON(rawText) };
    }
    case 'vertex-pro': {
      const { callVertexGemini } = await import('../_shared/vertex-ai.ts');
      console.log(`[enrich-vertex] slug=${slug} model=vertex-pro timeout=${timeout}ms`);
      rawText = await callVertexGemini('gemini-2.5-pro', prompt, timeout, {
        maxOutputTokens: maxTokens || 16384,
        responseMimeType: 'application/json',
        temperature: 0.5,
        topP: 0.8,
      });
      return { data: tryParseJSON(rawText) };
    }

    case 'claude-sonnet':
    case 'claude': {
      // ── Claude only — no automatic fallback ──
      const result = await callClaudeWithRetry(prompt, slug, startedAtMs);
      return { data: result.data, diagnostics: result.diagnostics as unknown as Record<string, unknown> };
    }

    case 'groq':
      rawText = await callGroqRaw(prompt, timeout, maxTokens || 16384);
      return { data: tryParseJSON(rawText) };
    case 'mistral':
      rawText = await callMistralRaw(prompt, timeout, maxTokens || 16384);
      return { data: tryParseJSON(rawText) };
    case 'lovable-gemini':
      rawText = await callLovableGeminiRaw(prompt, timeout);
      return { data: tryParseJSON(rawText) };
    case 'gpt5':
      rawText = await callOpenAIRaw(prompt, 'openai/gpt-5', timeout);
      return { data: tryParseJSON(rawText) };
    case 'gpt5-mini':
      rawText = await callOpenAIRaw(prompt, 'openai/gpt-5-mini', timeout);
      return { data: tryParseJSON(rawText) };
    case 'nova-pro':
    case 'nova-premier': {
      const { callBedrockNova } = await import('../_shared/bedrock-nova.ts');
      rawText = await callBedrockNova(model, prompt, { maxTokens: 16384, temperature: 0.5, timeoutMs: timeout });
      return { data: tryParseJSON(rawText) };
    }
    default:
      console.warn(`Unknown model "${model}", defaulting to gemini-flash`);
      rawText = await fetchGemini(prompt, 'gemini-2.5-flash', timeout);
      return { data: tryParseJSON(rawText) };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// PROMPT BUILDERS
// ═══════════════════════════════════════════════════════════════════════════════

interface PageContent {
  slug: string;
  examName?: string;
  conductingBody?: string;
  year?: number;
  existingOverview?: string;
  existingWordCount?: number;
  existingSections?: string[];
}

function buildNotificationPrompt(page: PageContent): string {
  return `
=== PAGE-TYPE: NOTIFICATION ===

Exam: "${page.examName || page.slug}"
Conducting Body: ${page.conductingBody || 'the official recruitment authority'}
Year: ${page.year || 2026}

Generate content for these sections (concise, data-dense, no filler):
1. Overview & Latest Update
2. Eligibility Criteria (education, age with category-wise relaxation table)
3. Vacancy Details (category-wise breakdown table: UR/OBC/SC/ST/EWS/PwD)
4. Exam Pattern & Selection Process (stages, marks, duration, negative marking — tables)
5. Salary Structure (Pay Level, Grade Pay, in-hand estimate)
6. How to Apply — Step by Step (numbered steps, documents, fee breakup)
7. Important Dates Table
8. Preparation Tips (subject-wise strategy)
9. Previous Year Cut-off Trends (table if available)
10. Important Links

Existing overview for reference (enrich, don't duplicate): ${(page.existingOverview || '').substring(0, 300)}

FAQs: 6-8 questions real aspirants search for.`;
}

function buildSyllabusPrompt(page: PageContent): string {
  return `
=== PAGE-TYPE: SYLLABUS ===

Exam: "${page.examName || page.slug}"
Conducting Body: ${page.conductingBody || 'official authority'}
Year: ${page.year || 2026}

Generate content for these sections:
1. Syllabus Overview
2. Tier/Stage-wise Detailed Syllabus (nested lists per stage)
3. Subject-wise Detailed Breakdown (each subject with complete topics)
4. Topic-wise Weightage Analysis (table)
5. Important Topics to Focus On (ranked by frequency)
6. Recommended Books & Resources (specific names with authors)
7. Subject-wise Preparation Strategy
8. Common Mistakes in Preparation

FAQs: 5-7 questions.`;
}

function buildExamPatternPrompt(page: PageContent): string {
  return `
=== PAGE-TYPE: EXAM PATTERN ===

Exam: "${page.examName || page.slug}"
Conducting Body: ${page.conductingBody || 'official authority'}
Year: ${page.year || 2026}

Generate content for these sections:
1. Exam Pattern Overview
2. Stage-wise Detailed Pattern (table: sections, questions, marks, time, negative marking)
3. Marking Scheme Explained
4. Section-wise Time Distribution
5. Difficulty Level Analysis (based on previous years)
6. Normalization Process (if applicable)
7. Smart Time Management Strategy
8. Changes from Previous Year

FAQs: 5-7 questions.`;
}

function buildPYPPrompt(page: PageContent): string {
  return `
=== PAGE-TYPE: PREVIOUS YEAR PAPERS ===

Exam: "${page.examName || page.slug}"
Year: ${page.year || 2026}

Generate content for these sections:
1. PYP Overview
2. Year-wise Topic Distribution (table)
3. Subject-wise Trend Analysis
4. Difficulty Trend
5. Most Repeated Topics (ranked list)
6. Subject-wise Weightage Table
7. Preparation Insights from PYP
8. Expected Pattern for Next Exam

FAQs: 4-6 questions.`;
}

function buildStatePrompt(page: PageContent): string {
  const stateName = page.examName || page.slug.replace('govt-jobs-', '').replace(/-/g, ' ');
  return `
=== PAGE-TYPE: STATE GOVERNMENT JOBS ===

State: "${stateName}"

Generate content for these sections (MUST be specific to ${stateName}, reference actual PSC name and recruiting bodies):
1. State Overview (major recruiting bodies, exam ecosystem)
2. Major Recruiting Organizations (actual names for ${stateName})
3. Popular State Exams (top 10-15 with brief description)
4. Important Government Departments Hiring
5. Eligibility Patterns
6. State-specific Application Process
7. Salary Structure in State Government
8. Preparation Strategy for State Exams

FAQs: 6-8 questions.`;
}

// The JSON schema that non-Claude models must follow.
// Claude gets this via tool_use; other models need it explicitly in the prompt.
const JSON_OUTPUT_SCHEMA = `
{
  "overview": "<string> HTML overview with Quick Overview Table. 200-400 words. MUST include an HTML <table> with key facts.",
  "eligibility": "<string> HTML eligibility section with category-wise age relaxation table. 150-300 words.",
  "vacancyDetails": "<string> HTML vacancy breakdown with category-wise table (UR/OBC/SC/ST/EWS/PwD). 100-250 words.",
  "examPattern": "<string> HTML exam pattern with table (sections, questions, marks, time, negative marking). 150-300 words.",
  "salary": "<string> HTML salary structure with Pay Level, Grade Pay, in-hand estimate. 100-200 words.",
  "applicationProcess": "<string> HTML step-by-step how to apply with numbered steps, documents, fee breakup. 150-250 words.",
  "importantDates": "<string> HTML table of important dates (notification, apply start/end, exam, admit card, result). 50-150 words.",
  "preparationTips": "<string> HTML preparation strategy, subject-wise. 150-300 words.",
  "cutoffTrends": "<string> HTML previous year cutoff analysis with table if available. 100-250 words.",
  "importantLinks": "<string> HTML list of important links (official website, notification PDF, apply link). 50-100 words.",
  "faq": [
    { "question": "<string> A real question aspirants search for", "answer": "<string> Concise, factual answer" }
  ],
  "meta_title": "<string> Under 60 chars, primary keyword included",
  "meta_description": "<string> Under 155 chars, action-oriented",
  "internal_links": ["<string> 3-5 related page slugs for internal linking"]
}`;

function getPromptForType(pageType: string, page: PageContent, model?: string): string {
  let typePrompt: string;
  switch (pageType) {
    case 'notification': typePrompt = buildNotificationPrompt(page); break;
    case 'syllabus': typePrompt = buildSyllabusPrompt(page); break;
    case 'exam-pattern': typePrompt = buildExamPatternPrompt(page); break;
    case 'pyp': typePrompt = buildPYPPrompt(page); break;
    case 'state': typePrompt = buildStatePrompt(page); break;
    default: typePrompt = buildNotificationPrompt(page);
  }

  const fullPrompt = MASTER_AUTHORITY_PROMPT + '\n\n' + typePrompt;

  // For Claude: add concise output constraint (tool_use handles schema)
  if (model === 'claude-sonnet' || model === 'claude') {
    return fullPrompt + `

=== CRITICAL OUTPUT CONSTRAINTS ===
- Be concise inside each field. Prioritize data density over prose length.
- Fill REQUIRED fields first in this order: overview → faq → meta_title → meta_description.
- In overview, include the Quick Overview HTML table before narrative text.
- Keep FAQ compact: 6-8 high-intent questions with direct answers.
- Avoid repetition across sections. Each section must contain unique information.
- Every word must add value. Remove filler.
- Include HTML tables where specified. Use semantic HTML (h2, h3, table, ul, ol, strong).
- Use the save_enrichment tool to return your response.`;
  }

  // For all other models: include the JSON schema explicitly in the prompt
  return fullPrompt + `

=== REQUIRED JSON OUTPUT SCHEMA ===
You MUST return a JSON object with ALL of the following fields populated with rich, detailed HTML content.
Each HTML field must contain substantial content (100-400 words each) with proper HTML tags (h2, h3, table, ul, ol, strong, p).
Do NOT return placeholder text. Every field must have real, specific, data-dense content.

MINIMUM REQUIREMENTS:
- Total content across all fields: at least 1800 words
- FAQ array: at least 5 items
- All HTML fields must contain actual HTML with tables where specified
- overview field is MANDATORY and must include a Quick Overview HTML table

JSON Schema:
${JSON_OUTPUT_SCHEMA}

CRITICAL: Return ONLY the raw JSON object. No markdown fences, no backticks, no commentary, no text before or after the JSON. The response must start with { and end with }.`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// QUALITY CHECKS
// ═══════════════════════════════════════════════════════════════════════════════

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function getMinWordCount(pageType: string): number {
  switch (pageType) {
    case 'notification': return 2000;
    case 'syllabus': return 2500;
    case 'exam-pattern': return 2000;
    case 'pyp': return 1800;
    case 'state': return 2500;
    default: return 2000;
  }
}

function computeQualityScore(enrichmentData: Record<string, unknown>, pageType: string): {
  wordScore: number;
  sectionScore: number;
  uniquenessScore: number;
  internalLinkScore: number;
  totalWords: number;
  sectionCount: number;
} {
  let totalWords = 0;
  let sectionCount = 0;

  for (const [key, value] of Object.entries(enrichmentData)) {
    if (key === 'faq' && Array.isArray(value)) {
      for (const faq of value) {
        totalWords += countWords(faq.question || '') + countWords(faq.answer || '');
      }
      sectionCount += 1;
    } else if (typeof value === 'string') {
      totalWords += countWords(value);
      sectionCount += 1;
    }
  }

  const minWords = getMinWordCount(pageType);
  const wordScore = totalWords >= minWords ? 10 : totalWords >= minWords * 0.7 ? 7 : totalWords >= minWords * 0.4 ? 4 : 2;
  const sectionScore = sectionCount >= 7 ? 10 : sectionCount >= 5 ? 7 : sectionCount >= 3 ? 4 : 2;
  const uniquenessScore = 8;
  const internalLinkScore = Array.isArray(enrichmentData.internal_links) ? Math.min(10, enrichmentData.internal_links.length * 2) : 3;

  return { wordScore, sectionScore, uniquenessScore, internalLinkScore, totalWords, sectionCount };
}

function generateInternalLinks(pageType: string, slug: string): string[] {
  const links: string[] = [];

  if (pageType === 'notification') {
    const base = slug.replace(/-notification$/, '');
    links.push(`/${base}-syllabus`, `/${base}-exam-pattern`, `/${base}-salary`);
    links.push('/govt-job-age-calculator', '/govt-salary-calculator');
  } else if (pageType === 'syllabus') {
    const base = slug.replace(/-syllabus$/, '');
    links.push(`/${base}-notification`, `/${base}-exam-pattern`);
  } else if (pageType === 'exam-pattern') {
    const base = slug.replace(/-exam-pattern$/, '');
    links.push(`/${base}-notification`, `/${base}-syllabus`);
  } else if (pageType === 'pyp') {
    links.push('/sarkari-jobs');
  } else if (pageType === 'state') {
    links.push('/sarkari-jobs', '/ssc-jobs', '/railway-jobs', '/banking-jobs');
  }

  return links.slice(0, 6);
}

// ═══════════════════════════════════════════════════════════════════════════════
// DUPLICATE DETECTION
// ═══════════════════════════════════════════════════════════════════════════════

function simpleHash(text: string): string {
  let hash = 0;
  const str = text.substring(0, 200).toLowerCase().replace(/\s+/g, ' ').trim();
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(36);
}

async function checkDuplicates(
  svc: ReturnType<typeof createClient>,
  enrichmentData: Record<string, unknown>,
  currentSlug: string,
): Promise<string[]> {
  const flags: string[] = [];
  const overview = typeof enrichmentData.overview === 'string' ? enrichmentData.overview : '';
  if (!overview) return flags;

  const newHash = simpleHash(overview);

  const { data: existing } = await svc
    .from('content_enrichments')
    .select('page_slug, enrichment_data')
    .neq('page_slug', currentSlug)
    .limit(100);

  if (existing) {
    for (const row of existing) {
      const existingOverview = (row.enrichment_data as Record<string, unknown>)?.overview;
      if (typeof existingOverview === 'string') {
        const existingHash = simpleHash(existingOverview);
        if (existingHash === newHash) {
          flags.push(`DUPLICATE_RISK: Overview similar to ${row.page_slug}`);
        }
      }
    }
  }

  return flags;
}

// ═══════════════════════════════════════════════════════════════════════════════
// INSERT HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

async function insertVersion(
  svc: ReturnType<typeof createClient>,
  params: {
    slug: string;
    pageType: string;
    enrichmentData: Record<string, unknown>;
    status: string;
    sectionsAdded: string[];
    internalLinks: string[];
    qualityScore: Record<string, number>;
    flags: string[];
    wordCount: number;
    sectionCount: number;
    failureReason?: string | null;
  },
): Promise<{ version: number | null; error: string | null }> {
  const { data, error } = await svc.rpc('insert_enrichment_version', {
    p_page_slug: params.slug,
    p_page_type: params.pageType,
    p_enrichment_data: params.enrichmentData,
    p_status: params.status,
    p_sections_added: params.sectionsAdded,
    p_internal_links_added: params.internalLinks,
    p_quality_score: params.qualityScore,
    p_flags: params.flags,
    p_current_word_count: params.wordCount,
    p_current_section_count: params.sectionCount,
    p_failure_reason: params.failureReason ?? null,
  });

  if (error) return { version: null, error: error.message };
  return { version: data as number, error: null };
}

async function insertFailedRow(
  svc: ReturnType<typeof createClient>,
  slug: string,
  pageType: string,
  failureReason: string,
  wordCount: number,
): Promise<void> {
  try {
    await insertVersion(svc, {
      slug,
      pageType,
      enrichmentData: {},
      status: 'failed',
      sectionsAdded: [],
      internalLinks: [],
      qualityScore: {},
      flags: [],
      wordCount,
      sectionCount: 0,
      failureReason,
    });
  } catch {
    console.error(`Failed to persist failure row for ${slug}`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN HANDLER — ONE SLUG PER INVOCATION
// ═══════════════════════════════════════════════════════════════════════════════

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authResult = await verifyAdmin(req);
    if (authResult instanceof Response) return authResult;

    const body = await req.json();

    // ── Backward compat: accept both { slug } and { slugs: [...] } ──
    let slug: string;
    let pageType: string;
    let currentContent: PageContent | undefined;
    let selectedModel: string;

    if (body.slug && typeof body.slug === 'string') {
      slug = body.slug;
      pageType = body.pageType || 'notification';
      currentContent = body.currentContent || { slug };
      selectedModel = body.aiModel || 'gemini-flash';
    } else if (Array.isArray(body.slugs) && body.slugs.length > 0) {
      slug = body.slugs[0];
      pageType = body.pageType || 'notification';
      const contentArr = body.currentContent as PageContent[] | undefined;
      currentContent = contentArr?.find((c: PageContent) => c.slug === slug) || { slug };
      selectedModel = body.aiModel || 'gemini-flash';
    } else {
      return new Response(JSON.stringify({ error: 'slug (string) is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[enrich] Processing single slug: ${slug}, model=${selectedModel}, type=${pageType}`);

    const svc = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const existingWordCount = (currentContent as { existingWordCount?: number })?.existingWordCount || 0;

    // ── Step 1: Call AI ──
    let enrichmentData: Record<string, unknown>;
    let aiDiagnostics: Record<string, unknown> | undefined;
    try {
      const prompt = getPromptForType(pageType, currentContent!, selectedModel);
      const hasSchema = prompt.includes('JSON Schema:');
      const aiStartedAtMs = Date.now();
      console.log(`[enrich] ${slug}: calling ${selectedModel}, prompt ${prompt.length} chars, timeout ${getTimeout(selectedModel)}ms, schema_in_prompt=${hasSchema}, ai_budget_ms=${AI_TOTAL_BUDGET_MS}`);
      const result = await callAI(selectedModel, prompt, slug, aiStartedAtMs);
      enrichmentData = result.data;
      aiDiagnostics = result.diagnostics;

      const fallbackInfo = aiDiagnostics?.fallbackTriggered ? ` (FALLBACK: Claude→Gemini)` : '';
      console.log(`[enrich] ${slug}: AI returned successfully${fallbackInfo}${aiDiagnostics?.stopReason ? ` stop_reason=${aiDiagnostics.stopReason}` : ''}`);
    } catch (aiErr) {
      const errDiagnostics = (aiErr as any)?.diagnostics;
      const reason = `AI_ERROR (${selectedModel}): ${aiErr instanceof Error ? aiErr.message : 'Unknown'}`;
      console.error(`[enrich] ${slug}: ${reason}`);
      if (errDiagnostics) {
        console.error(`[enrich] ${slug}: diagnostics=${JSON.stringify(errDiagnostics)}`);
      }
      await insertFailedRow(svc, slug, pageType, reason, existingWordCount);

      return new Response(JSON.stringify({
        status: 'failed',
        slug,
        error: reason,
        diagnostics: errDiagnostics || null,
        results: [{
          slug, status: 'failed', sectionsAdded: [], qualityScore: {},
          flags: [], totalWords: 0, failureReason: reason,
        }],
      }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── Step 2: Quality scoring ──
    const quality = computeQualityScore(enrichmentData, pageType);
    const internalLinks = generateInternalLinks(pageType, slug);
    const dupFlags = await checkDuplicates(svc, enrichmentData, slug);
    const allFlags: string[] = [...dupFlags];

    const minWords = getMinWordCount(pageType);
    if (quality.totalWords < minWords * 0.25) {
      allFlags.push(`LOW_WORD_COUNT: Generated content below ${Math.round(minWords * 0.25)} words (minimum ${minWords})`);
    } else if (quality.totalWords < minWords * 0.5) {
      allFlags.push(`MODERATE_WORD_COUNT: Content at ${quality.totalWords} words, well below ${minWords} target`);
    } else if (quality.totalWords < minWords) {
      allFlags.push(`BELOW_TARGET: Content at ${quality.totalWords} words, target is ${minWords}`);
    }

    if (aiDiagnostics?.fallbackTriggered) {
      allFlags.push(`CLAUDE_FALLBACK: Claude failed, content generated by Gemini 2.5 Flash`);
    }

    const sectionsAdded = Object.keys(enrichmentData).filter(k => {
      if (k === 'faq') return Array.isArray(enrichmentData[k]) && (enrichmentData[k] as unknown[]).length > 0;
      if (Array.isArray(enrichmentData[k])) return (enrichmentData[k] as unknown[]).length > 0;
      return typeof enrichmentData[k] === 'string' && (enrichmentData[k] as string).length > 50;
    });

    const qualityScore = {
      wordScore: quality.wordScore,
      sectionScore: quality.sectionScore,
      uniquenessScore: quality.uniquenessScore,
      internalLinkScore: quality.internalLinkScore,
    };

    // ── Step 3: Insert via RPC ──
    const { version, error: insertError } = await insertVersion(svc, {
      slug,
      pageType,
      enrichmentData,
      status: 'draft',
      sectionsAdded,
      internalLinks,
      qualityScore,
      flags: allFlags,
      wordCount: quality.totalWords,
      sectionCount: quality.sectionCount,
    });

    if (insertError) {
      const reason = `DB_ERROR: ${insertError}`;
      await insertFailedRow(svc, slug, pageType, reason, existingWordCount);
      return new Response(JSON.stringify({
        status: 'failed',
        slug,
        error: reason,
        results: [{
          slug, status: 'failed', sectionsAdded, qualityScore,
          flags: [...allFlags, reason], totalWords: quality.totalWords, failureReason: reason,
        }],
      }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const resultStatus = allFlags.length > 0 ? 'flagged' : 'success';
    const result = {
      slug,
      status: resultStatus,
      sectionsAdded,
      qualityScore,
      flags: allFlags,
      totalWords: quality.totalWords,
      version: version ?? undefined,
    };

    return new Response(JSON.stringify({
      status: resultStatus,
      slug,
      model: aiDiagnostics?.fallbackTriggered ? `${selectedModel}→gemini-fallback` : selectedModel,
      totalWords: quality.totalWords,
      sectionCount: quality.sectionCount,
      version,
      diagnostics: aiDiagnostics || null,
      results: [result],
    }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('enrich-authority-pages error:', error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Unknown error',
    }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
