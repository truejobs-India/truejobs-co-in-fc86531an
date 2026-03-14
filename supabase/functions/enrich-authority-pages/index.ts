import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

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
// MASTER AUTHORITY PROMPT — compact version for all models
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
- Suggest 3-5 related page slugs for internal linking.

=== OUTPUT ===
Return ONLY the JSON object matching the schema. No commentary, no markdown fences, no text outside the JSON.`;

// ═══════════════════════════════════════════════════════════════════════════════
// MODEL-SPECIFIC TIMEOUTS & CLAUDE CONFIG
// ═══════════════════════════════════════════════════════════════════════════════

const ANTHROPIC_MODEL = Deno.env.get('ANTHROPIC_MODEL') || 'claude-sonnet-4-6';
const ANTHROPIC_TIMEOUT_MS = parseInt(Deno.env.get('ANTHROPIC_TIMEOUT_MS') || '140000', 10);
const ANTHROPIC_MAX_TOKENS = parseInt(Deno.env.get('ANTHROPIC_MAX_TOKENS') || '4096', 10);
const ANTHROPIC_RETRY_MAX_TOKENS = 6144;
const ANTHROPIC_API_VERSION = '2023-06-01';

function getClaudeHeaders(apiKey: string) {
  return {
    'Content-Type': 'application/json',
    'x-api-key': apiKey,
    'anthropic-version': ANTHROPIC_API_VERSION,
  };
}

function logClaudePreRequest(label: string, opts: { model: string; maxTokens: number; structured: boolean; promptChars?: number }) {
  console.log(`[claude-${label}] PRE-REQUEST: anthropic-version=${ANTHROPIC_API_VERSION} model=${opts.model} max_tokens=${opts.maxTokens} structured=${opts.structured}${opts.promptChars ? ` prompt_chars=${opts.promptChars}` : ''}`);
}

const TIMEOUTS: Record<string, number> = {
  'gemini-flash': 60_000,
  'gemini-pro': 60_000,
  'claude-sonnet': ANTHROPIC_TIMEOUT_MS,
  'claude': ANTHROPIC_TIMEOUT_MS,
  'mistral': 120_000,
  'groq': 30_000,
  'lovable-gemini': 60_000,
  'gpt5': 60_000,
  'gpt5-mini': 60_000,
};

function getTimeout(model: string): number {
  return TIMEOUTS[model] || 60_000;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CLAUDE STRUCTURED OUTPUT SCHEMA
// ═══════════════════════════════════════════════════════════════════════════════

const ENRICHMENT_JSON_SCHEMA = {
  type: 'object' as const,
  properties: {
    overview: { type: 'string', description: 'HTML overview with Quick Overview Table, 200-400 words' },
    eligibility: { type: 'string', description: 'HTML eligibility section with category-wise table' },
    vacancyDetails: { type: 'string', description: 'HTML vacancy breakdown with table' },
    examPattern: { type: 'string', description: 'HTML exam pattern with table' },
    salary: { type: 'string', description: 'HTML salary structure with Pay Levels' },
    applicationProcess: { type: 'string', description: 'HTML step-by-step how to apply' },
    importantDates: { type: 'string', description: 'HTML table of important dates' },
    preparationTips: { type: 'string', description: 'HTML exam-specific preparation strategy' },
    cutoffTrends: { type: 'string', description: 'HTML previous year cutoff table and analysis' },
    importantLinks: { type: 'string', description: 'HTML list of important official links' },
    tierWiseSyllabus: { type: 'string', description: 'HTML stage-wise syllabus breakdown' },
    subjectWiseBreakdown: { type: 'string', description: 'HTML detailed topic lists per subject' },
    topicWeightage: { type: 'string', description: 'HTML topic weightage analysis table' },
    importantTopics: { type: 'string', description: 'HTML high-yield topics list' },
    recommendedBooks: { type: 'string', description: 'HTML book recommendations table' },
    preparationStrategy: { type: 'string', description: 'HTML subject-wise preparation approach' },
    commonMistakes: { type: 'string', description: 'HTML common preparation errors' },
    stageWisePattern: { type: 'string', description: 'HTML detailed exam pattern tables per stage' },
    markingScheme: { type: 'string', description: 'HTML marking and negative marking details' },
    timeDistribution: { type: 'string', description: 'HTML section-wise time allocation' },
    difficultyInsights: { type: 'string', description: 'HTML difficulty trends analysis' },
    normalization: { type: 'string', description: 'HTML normalization/scoring methodology' },
    timeManagement: { type: 'string', description: 'HTML time management strategy' },
    patternChanges: { type: 'string', description: 'HTML changes from previous year' },
    topicTrends: { type: 'string', description: 'HTML year-wise topic distribution table' },
    subjectTrends: { type: 'string', description: 'HTML subject-wise trend analysis' },
    difficultyAnalysis: { type: 'string', description: 'HTML difficulty comparison across years' },
    repeatedTopics: { type: 'string', description: 'HTML ranked list of most repeated topics' },
    subjectWeightage: { type: 'string', description: 'HTML subject weightage table' },
    expectedPattern: { type: 'string', description: 'HTML predictions for next exam' },
    majorRecruitingBodies: { type: 'string', description: 'HTML recruiting organizations' },
    popularStateExams: { type: 'string', description: 'HTML popular state-level exams' },
    importantDepartments: { type: 'string', description: 'HTML major departments recruiting' },
    eligibilityPatterns: { type: 'string', description: 'HTML common eligibility across state exams' },
    applicationGuidance: { type: 'string', description: 'HTML state-specific application process' },
    salaryStructure: { type: 'string', description: 'HTML state pay matrix and comparison' },
    preparationInsights: { type: 'string', description: 'HTML insights from previous year papers' },
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
      description: 'FAQ items with schema.org markup',
    },
    meta_title: { type: 'string', description: 'Under 60 chars, primary keyword included' },
    meta_description: { type: 'string', description: 'Under 155 chars' },
    internal_links: {
      type: 'array',
      items: { type: 'string' },
      description: '3-5 related page slugs for cross-linking',
    },
    primary_keyword: { type: 'string' },
    secondary_keywords: {
      type: 'array',
      items: { type: 'string' },
      description: '5-8 LSI keywords',
    },
  },
  required: ['overview', 'faq', 'meta_title', 'meta_description'],
};

// ═══════════════════════════════════════════════════════════════════════════════
// MODEL INTEGRATIONS
// ═══════════════════════════════════════════════════════════════════════════════

// ── Gemini (Direct API) ──
async function fetchGemini(prompt: string, model = 'gemini-2.5-flash', timeoutMs = 60_000): Promise<string> {
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
          maxOutputTokens: 16384,
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
          generationConfig: { temperature: 0.5, topP: 0.8, maxOutputTokens: 16384, responseMimeType: 'application/json' },
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

// ── Claude: Connectivity Probe ──
async function claudeProbe(): Promise<void> {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured — please add it to secrets');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  const probeStart = Date.now();

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: 8,
        messages: [{ role: 'user', content: 'Reply with OK' }],
      }),
    });

    const elapsed = Date.now() - probeStart;
    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Claude probe failed HTTP ${response.status} in ${elapsed}ms: ${errText.substring(0, 300)}`);
    }
    console.log(`[claude-probe] OK in ${elapsed}ms, model=${ANTHROPIC_MODEL}, request-id=${response.headers.get('request-id') || 'n/a'}`);
  } catch (err) {
    const elapsed = Date.now() - probeStart;
    const isAbort = err instanceof Error && (err.message.includes('aborted') || err.message.includes('signal'));
    if (isAbort) {
      throw new Error(`Claude probe TIMEOUT after ${elapsed}ms — API unreachable or model "${ANTHROPIC_MODEL}" invalid`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// ── Claude: Streaming SSE call with structured output ──
interface ClaudeStreamResult {
  text: string;
  stopReason: string;
  chunksReceived: number;
  elapsedMs: number;
  requestId: string;
  httpStatus: number;
}

async function callClaudeStreaming(
  prompt: string,
  maxTokens: number,
  timeoutMs: number,
  useStructuredOutput: boolean,
): Promise<ClaudeStreamResult> {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')!;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const reqStart = Date.now();

  console.log(`[claude-stream] START model=${ANTHROPIC_MODEL} max_tokens=${maxTokens} timeout=${timeoutMs}ms prompt_chars=${prompt.length} structured=${useStructuredOutput}`);

  try {
    // deno-lint-ignore no-explicit-any
    const requestBody: any = {
      model: ANTHROPIC_MODEL,
      max_tokens: maxTokens,
      temperature: 0.5,
      stream: true,
      messages: [{ role: 'user', content: prompt }],
    };

    // Add structured output config
    if (useStructuredOutput) {
      requestBody.output_config = {
        format: {
          type: 'json_schema',
          schema: ENRICHMENT_JSON_SCHEMA,
        },
      };
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2025-01-01',
      },
      signal: controller.signal,
      body: JSON.stringify(requestBody),
    });

    const connectMs = Date.now() - reqStart;
    const requestId = response.headers.get('request-id') || 'n/a';
    const httpStatus = response.status;
    console.log(`[claude-stream] CONNECTED in ${connectMs}ms, HTTP ${httpStatus}, request-id=${requestId}`);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Claude API error ${httpStatus}: ${errorText.substring(0, 500)}`);
    }

    if (!response.body) throw new Error('Claude response has no body (streaming expected)');

    // Parse SSE stream
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let accumulated = '';
    let buffer = '';
    let chunksReceived = 0;
    let stopReason = 'unknown';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const jsonStr = line.slice(6).trim();
        if (jsonStr === '[DONE]') continue;

        try {
          const event = JSON.parse(jsonStr);
          chunksReceived++;

          if (event.type === 'content_block_delta' && event.delta?.text) {
            accumulated += event.delta.text;
          } else if (event.type === 'message_delta' && event.delta?.stop_reason) {
            stopReason = event.delta.stop_reason;
          } else if (event.type === 'message_stop') {
            if (stopReason === 'unknown') stopReason = 'end_turn';
          } else if (event.type === 'error') {
            throw new Error(`Claude stream error event: ${JSON.stringify(event.error)}`);
          }
        } catch (parseErr) {
          if (parseErr instanceof Error && parseErr.message.startsWith('Claude stream error')) throw parseErr;
          // skip unparseable SSE lines
        }
      }
    }

    const totalMs = Date.now() - reqStart;
    console.log(`[claude-stream] DONE in ${totalMs}ms, chunks=${chunksReceived}, output_chars=${accumulated.length}, stop_reason=${stopReason}`);

    return { text: accumulated, stopReason, chunksReceived, elapsedMs: totalMs, requestId, httpStatus };
  } catch (err) {
    const elapsed = Date.now() - reqStart;
    const isAbort = err instanceof Error && (err.message.includes('aborted') || err.message.includes('signal'));
    const phase = elapsed < 5000 ? 'initial_connection' : 'stream_read';
    if (isAbort) {
      throw new Error(`Claude streaming TIMEOUT after ${elapsed}ms (phase: ${phase})`);
    }
    throw new Error(`Claude streaming FAILED after ${elapsed}ms (phase: ${phase}): ${err instanceof Error ? err.message : 'Unknown'}`);
  } finally {
    clearTimeout(timer);
  }
}

// ── JSON cleanup fallback ──
function cleanupJsonText(raw: string): string {
  let text = raw.trim();

  // Strip markdown code fences
  text = text.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();

  // Remove leading text before first {
  const firstBrace = text.indexOf('{');
  if (firstBrace > 0) {
    text = text.substring(firstBrace);
  }

  // Remove trailing text after last }
  const lastBrace = text.lastIndexOf('}');
  if (lastBrace !== -1 && lastBrace < text.length - 1) {
    text = text.substring(0, lastBrace + 1);
  }

  return text;
}

// ── Claude: Full call with probe + structured output + retry ──
async function callClaudeRaw(prompt: string, slug: string, timeoutMs = ANTHROPIC_TIMEOUT_MS): Promise<{ data: Record<string, unknown>; diagnostics: Record<string, unknown> }> {
  // Step 1: Connectivity probe
  await claudeProbe();

  const diagnostics: Record<string, unknown> = {
    slug,
    model: ANTHROPIC_MODEL,
    promptChars: prompt.length,
    attempt: 1,
  };

  // Step 2: Main streaming call with structured output
  let result: ClaudeStreamResult;
  try {
    result = await callClaudeStreaming(prompt, ANTHROPIC_MAX_TOKENS, timeoutMs, true);
  } catch (firstErr) {
    const errMsg = firstErr instanceof Error ? firstErr.message : String(firstErr);
    diagnostics.attempt1Error = errMsg;

    // Don't retry on clear 4xx errors
    if (errMsg.includes('API error 4')) {
      diagnostics.retried = false;
      diagnostics.failureType = 'api_4xx';
      throw Object.assign(firstErr as Error, { diagnostics });
    }

    // Retry once with higher tokens
    console.warn(`[claude-retry] First attempt failed: ${errMsg}. Retrying with max_tokens=${ANTHROPIC_RETRY_MAX_TOKENS}...`);
    diagnostics.attempt = 2;
    diagnostics.retryMaxTokens = ANTHROPIC_RETRY_MAX_TOKENS;
    diagnostics.retried = true;

    try {
      result = await callClaudeStreaming(prompt, ANTHROPIC_RETRY_MAX_TOKENS, timeoutMs, true);
    } catch (retryErr) {
      const retryMsg = retryErr instanceof Error ? retryErr.message : String(retryErr);
      diagnostics.attempt2Error = retryMsg;
      diagnostics.failureType = 'retry_failed';
      const err = new Error(`Claude failed after retry: ${retryMsg} (original: ${errMsg})`);
      (err as any).diagnostics = diagnostics;
      throw err;
    }
  }

  diagnostics.maxTokens = result.stopReason === 'max_tokens' && diagnostics.attempt === 1 ? ANTHROPIC_MAX_TOKENS : (diagnostics.retryMaxTokens || ANTHROPIC_MAX_TOKENS);
  diagnostics.outputChars = result.text.length;
  diagnostics.chunks = result.chunksReceived;
  diagnostics.elapsedMs = result.elapsedMs;
  diagnostics.httpStatus = result.httpStatus;
  diagnostics.requestId = result.requestId;
  diagnostics.stopReason = result.stopReason;

  // Check for max_tokens truncation — retry with higher budget
  if (result.stopReason === 'max_tokens' && diagnostics.attempt === 1) {
    console.warn(`[claude-retry] stop_reason=max_tokens with ${ANTHROPIC_MAX_TOKENS} tokens. Retrying with ${ANTHROPIC_RETRY_MAX_TOKENS}...`);
    diagnostics.attempt = 2;
    diagnostics.retried = true;
    diagnostics.retryReason = 'max_tokens_truncation';
    diagnostics.retryMaxTokens = ANTHROPIC_RETRY_MAX_TOKENS;

    try {
      result = await callClaudeStreaming(prompt, ANTHROPIC_RETRY_MAX_TOKENS, timeoutMs, true);
      diagnostics.outputChars = result.text.length;
      diagnostics.chunks = result.chunksReceived;
      diagnostics.elapsedMs = result.elapsedMs;
      diagnostics.stopReason = result.stopReason;
    } catch (retryErr) {
      const retryMsg = retryErr instanceof Error ? retryErr.message : String(retryErr);
      diagnostics.attempt2Error = retryMsg;
      // Fall through and try to parse truncated output from first attempt
      console.warn(`[claude-retry] Retry also failed: ${retryMsg}. Attempting to parse truncated output.`);
    }
  }

  // Step 3: Parse JSON — structured output should give us clean JSON, but apply cleanup as fallback
  const rawText = result!.text;
  let parsePhase = 'direct';

  // Try direct parse first (structured output should produce valid JSON)
  try {
    const parsed = JSON.parse(rawText);
    diagnostics.parsePhase = 'direct';
    diagnostics.failureType = null;
    console.log(`[claude-parse] ${slug}: Direct JSON parse OK (${rawText.length} chars)`);
    return { data: parsed, diagnostics };
  } catch { /* continue to cleanup */ }

  // Cleanup fallback
  parsePhase = 'cleanup';
  const cleaned = cleanupJsonText(rawText);
  try {
    const parsed = JSON.parse(cleaned);
    diagnostics.parsePhase = 'cleanup';
    diagnostics.failureType = 'wrapper_text';
    console.log(`[claude-parse] ${slug}: Cleanup parse OK (cleaned ${rawText.length} → ${cleaned.length} chars)`);
    return { data: parsed, diagnostics };
  } catch { /* continue */ }

  // tryParseJSON recovery stages
  parsePhase = 'recovery';
  try {
    const parsed = tryParseJSON(rawText);
    diagnostics.parsePhase = 'recovery';
    diagnostics.failureType = 'needed_recovery';
    console.log(`[claude-parse] ${slug}: Recovery parse OK`);
    return { data: parsed, diagnostics };
  } catch {
    // Final failure
    diagnostics.parsePhase = parsePhase;
    diagnostics.failureType = result.stopReason === 'max_tokens' ? 'max_tokens_truncation' : rawText.length === 0 ? 'empty_output' : 'invalid_json';
    console.error(`[claude-parse] ${slug}: ALL parse attempts failed. stop_reason=${result.stopReason}, output_chars=${rawText.length}, first100=${rawText.substring(0, 100)}, last100=${rawText.substring(rawText.length - 100)}`);
    const err = new Error(`Failed to parse Claude JSON (stop_reason=${result.stopReason}, output_chars=${rawText.length}, failureType=${diagnostics.failureType})`);
    (err as any).diagnostics = diagnostics;
    throw err;
  }
}

// ── Groq (Llama 3.3 70B) ──
async function callGroqRaw(prompt: string, timeoutMs = 30_000): Promise<string> {
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
        max_tokens: 16384,
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
async function callMistralRaw(prompt: string, timeoutMs = 60_000): Promise<string> {
  const region = 'us-west-2';
  const modelId = 'mistral.mistral-large-2407-v1:0';
  const url = `https://bedrock-runtime.${region}.amazonaws.com/model/${modelId}/invoke`;

  const body = JSON.stringify({
    prompt: `<s>[INST] ${prompt} [/INST]`,
    max_tokens: 16384,
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
async function callLovableGeminiRaw(prompt: string, timeoutMs = 60_000): Promise<string> {
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
        max_tokens: 16384,
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
async function callOpenAIRaw(prompt: string, model = 'openai/gpt-5', timeoutMs = 60_000): Promise<string> {
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
        max_completion_tokens: 16384,
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

// ── Smart JSON Recovery (4-stage) ──
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

// ── AI Dispatcher (one slug, one model call) ──
async function callAI(model: string, prompt: string, slug: string): Promise<{ data: Record<string, unknown>; diagnostics?: Record<string, unknown> }> {
  const timeout = getTimeout(model);
  let rawText: string;

  switch (model) {
    case 'gemini-flash':
    case 'gemini':
      rawText = await fetchGemini(prompt, 'gemini-2.5-flash', timeout);
      return { data: tryParseJSON(rawText) };
    case 'gemini-pro':
      rawText = await fetchGemini(prompt, 'gemini-2.5-pro', timeout);
      return { data: tryParseJSON(rawText) };
    case 'claude-sonnet':
    case 'claude':
      // Claude returns pre-parsed data with diagnostics
      return await callClaudeRaw(prompt, slug, timeout);
    case 'groq':
      rawText = await callGroqRaw(prompt, timeout);
      return { data: tryParseJSON(rawText) };
    case 'mistral':
      rawText = await callMistralRaw(prompt, timeout);
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
    default:
      console.warn(`Unknown model "${model}", defaulting to gemini-flash`);
      rawText = await fetchGemini(prompt, 'gemini-2.5-flash', timeout);
      return { data: tryParseJSON(rawText) };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// PROMPT BUILDERS (page-type-specific JSON field definitions)
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

FAQs: 6-8 questions real aspirants search for.
Return the JSON matching the schema provided. Be concise — each section 100-300 words.`;
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

FAQs: 5-7 questions.
Return the JSON matching the schema provided. Be concise — each section 150-350 words.`;
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

FAQs: 5-7 questions.
Return the JSON matching the schema provided. Be concise — each section 100-300 words.`;
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

FAQs: 4-6 questions.
Return the JSON matching the schema provided. Be concise — each section 100-250 words.`;
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

FAQs: 6-8 questions.
Return the JSON matching the schema provided. Be concise — each section 150-350 words.`;
}

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

  // For Claude with structured outputs: add concise output constraint
  if (model === 'claude-sonnet' || model === 'claude') {
    return fullPrompt + `

=== CRITICAL OUTPUT CONSTRAINTS ===
- Output ONLY the JSON object. No commentary, no markdown fences, no text before or after the JSON.
- Be concise inside each field. Prioritize data density over prose length.
- Avoid repetition across sections. Each section must contain unique information.
- Every word must add value. Remove filler.
- Include HTML tables where specified. Use semantic HTML (h2, h3, table, ul, ol, strong).`;
  }

  return fullPrompt;
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
    let claudeDiagnostics: Record<string, unknown> | undefined;
    try {
      const prompt = getPromptForType(pageType, currentContent!, selectedModel);
      console.log(`[enrich] ${slug}: calling ${selectedModel}, prompt ${prompt.length} chars, timeout ${getTimeout(selectedModel)}ms`);
      const result = await callAI(selectedModel, prompt, slug);
      enrichmentData = result.data;
      claudeDiagnostics = result.diagnostics;
      console.log(`[enrich] ${slug}: AI returned successfully${claudeDiagnostics ? ` (stop_reason=${claudeDiagnostics.stopReason}, parsePhase=${claudeDiagnostics.parsePhase})` : ''}`);
    } catch (aiErr) {
      const isAbort = aiErr instanceof Error && (
        aiErr.message.toLowerCase().includes('aborted') || aiErr.message.toLowerCase().includes('signal')
      );
      const errDiagnostics = (aiErr as any)?.diagnostics;
      const reason = `AI_ERROR (${selectedModel}): ${isAbort ? `Timeout after ${getTimeout(selectedModel) / 1000}s` : (aiErr instanceof Error ? aiErr.message : 'Unknown')}`;
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
      model: selectedModel,
      totalWords: quality.totalWords,
      sectionCount: quality.sectionCount,
      version,
      diagnostics: claudeDiagnostics || null,
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
