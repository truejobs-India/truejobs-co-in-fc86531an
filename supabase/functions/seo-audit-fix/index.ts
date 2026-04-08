import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getSeoFixModelPolicy, getSeoFixRetryDelayMs, isRetryableSeoFixStatus, sleep } from '../_shared/seo-fix-runtime.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

/**
 * seo-audit-fix: Takes a page's SEO issues and generates fixes using AI.
 * Routes to the correct provider:
 *   - nova-pro / nova-premier → AWS Bedrock (Nova Converse API)
 *   - mistral → AWS Bedrock (Mistral Converse API)
 *   - gemini-flash / gemini-pro / gpt5 / gpt5-mini / lovable-gemini → Lovable AI Gateway
 */

interface IssueInput {
  category: string;
  message: string;
  currentValue: string;
  fixHint?: string;
}

interface FixRequest {
  source: string;
  recordId: string;
  slug: string;
  title: string;
  isPublished: boolean;
  issues: IssueInput[];
  contentSnippet?: string;
  aiModel?: string;
}

interface AiCallResult {
  text: string;
  attemptsMade: number;
  retryEvents: string[];
}

// ── Provider routing ──

type ProviderRoute =
  | { provider: 'lovable-gateway'; gatewayModel: string }
  | { provider: 'vertex-ai'; vertexModel: string }
  | { provider: 'bedrock-nova'; modelKey: string }
  | { provider: 'bedrock-mistral' }
  | { provider: 'azure-openai' };

function resolveProvider(uiModelKey: string): ProviderRoute {
  switch (uiModelKey) {
    case 'nova-pro':
      return { provider: 'bedrock-nova', modelKey: 'nova-pro' };
    case 'nova-premier':
      return { provider: 'bedrock-nova', modelKey: 'nova-premier' };
    case 'nemotron-120b':
      return { provider: 'bedrock-nova', modelKey: 'nemotron-120b' };
    case 'azure-gpt4o-mini':
      return { provider: 'azure-openai' };
    case 'mistral':
      return { provider: 'bedrock-mistral' };
    case 'gemini-pro':
      return { provider: 'vertex-ai', vertexModel: 'gemini-2.5-pro' };
    case 'vertex-3.1-pro':
      return { provider: 'vertex-ai', vertexModel: 'gemini-3.1-pro-preview' };
    case 'vertex-3-flash':
      return { provider: 'vertex-ai', vertexModel: 'gemini-3-flash-preview' };
    case 'vertex-3.1-flash-lite':
      return { provider: 'vertex-ai', vertexModel: 'gemini-3.1-flash-lite-preview' };
    case 'gpt5':
      return { provider: 'lovable-gateway', gatewayModel: 'openai/gpt-5' };
    case 'gpt5-mini':
      return { provider: 'lovable-gateway', gatewayModel: 'openai/gpt-5-mini' };
    case 'gemini-flash':
    case 'lovable-gemini':
    default:
      return { provider: 'vertex-ai', vertexModel: 'gemini-2.5-flash' };
  }
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { pages, aiModel } = await req.json() as { pages: FixRequest[]; aiModel?: string };

    if (!pages || !Array.isArray(pages) || pages.length === 0) {
      return new Response(JSON.stringify({ error: 'No pages provided' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const rawModel = aiModel || 'gemini-flash';
    const route = resolveProvider(rawModel);
    const modelPolicy = getSeoFixModelPolicy(rawModel);
    console.log(`[SEO-FIX] Model: "${rawModel}" → provider: ${route.provider}${route.provider === 'lovable-gateway' ? ` (${(route as any).gatewayModel})` : route.provider === 'vertex-ai' ? ` (${(route as any).vertexModel})` : route.provider === 'bedrock-nova' ? ` (${(route as any).modelKey})` : ''}`);
    console.log(`[SEO-FIX] Policy for ${rawModel}: retries=${modelPolicy.retryCount}, baseDelay=${modelPolicy.baseRetryDelayMs}ms, throttle=${modelPolicy.throttleMs}ms, maxTokens=${modelPolicy.maxOutputTokens}`);

    // Validate provider-specific credentials upfront
    if (route.provider === 'lovable-gateway') {
      const key = Deno.env.get('LOVABLE_API_KEY');
      if (!key) {
        return new Response(JSON.stringify({ error: 'LOVABLE_API_KEY not configured' }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    } else if (route.provider === 'vertex-ai') {
      const clientEmail = Deno.env.get('GCP_CLIENT_EMAIL');
      const privateKey = Deno.env.get('GCP_PRIVATE_KEY');
      const projectId = Deno.env.get('GCP_PROJECT_ID');
      if (!clientEmail || !privateKey || !projectId) {
        return new Response(JSON.stringify({ error: 'Vertex AI credentials not configured' }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    } else if (route.provider === 'azure-openai') {
      const ep = Deno.env.get('AZURE_OPENAI_ENDPOINT');
      const ak = Deno.env.get('AZURE_OPENAI_API_KEY');
      if (!ep || !ak) {
        return new Response(JSON.stringify({ error: 'Azure OpenAI credentials not configured' }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    } else {
      const ak = Deno.env.get('AWS_ACCESS_KEY_ID');
      const sk = Deno.env.get('AWS_SECRET_ACCESS_KEY');
      if (!ak || !sk) {
        return new Response(JSON.stringify({ error: 'AWS credentials not configured for Bedrock models' }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    const results: any[] = [];

    for (let pageIndex = 0; pageIndex < pages.length; pageIndex++) {
      const page = pages[pageIndex];
      try {
        const fix = await generateFixesForPage(page, route, rawModel, modelPolicy);
        results.push({ recordId: page.recordId, source: page.source, slug: page.slug, ...fix });
      } catch (err) {
        console.error(`[SEO-FIX] Error fixing ${page.slug}:`, err);
        results.push({
          recordId: page.recordId,
          source: page.source,
          slug: page.slug,
          fixes: [],
          error: err instanceof Error ? err.message : 'Unknown error',
          failureReason: `Exception during AI call: ${err instanceof Error ? err.message : 'unknown'}`,
        });
      }

      if (pageIndex < pages.length - 1 && modelPolicy.throttleMs > 0) {
        await sleep(modelPolicy.throttleMs);
      }
    }

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[SEO-FIX] Fatal error:', err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// ── Build the SEO prompt (shared across all providers) ──

function buildSeoPrompt(page: FixRequest): { system: string; user: string } {
  const issueList = page.issues.map((i, idx) =>
    `${idx + 1}. [${i.category}] ${i.message}${i.currentValue ? ` | Current: "${i.currentValue.substring(0, 80)}"` : ''}${i.fixHint ? ` | Hint: ${i.fixHint}` : ''}`
  ).join('\n');

  const urlPrefix = page.source === 'blog_posts' ? 'blog' : page.source === 'pdf_resources' ? 'resources' : 'pages';

  // Limit content snippet to prevent token overflow
  const snippet = page.contentSnippet ? page.contentSnippet.substring(0, 800) : '';

  const system = 'You are a precise SEO fixing engine. Return only valid JSON arrays. No markdown. No explanations outside the JSON. Keep responses compact.';

  const user = `Fix SEO issues for this page on truejobs.co.in.

Page: "${page.title}" (/${page.slug})
Source: ${page.source}
Published: ${page.isPublished}
${snippet ? `Content preview: ${snippet}` : ''}

Issues to fix:
${issueList}

Return a JSON array of fix objects. Each fix must have:
- category: exact category from the issue
- field: the DB field to update (meta_title, meta_description, canonical_url, excerpt, featured_image_alt, content, faq_schema, has_faq_schema)
- action: "set_field" | "append_content" | "set_faq_schema"
- value: the new value
- confidence: "high" | "medium" | "low"
- explanation: ≤15 words

Rules:
- meta_title: 30-60 chars, include primary keyword
- meta_description: 130-155 chars strictly, never above 155
- canonical_url: exactly https://truejobs.co.in/${urlPrefix}/${page.slug}
- excerpt: 100-200 chars
- featured_image_alt: 10-80 chars
- h1: if missing, use action "append_content" with "<h1>title</h1>"
- internal_links: generate 3-5 links as HTML, action "append_content", paths like /blog/*, /resources/*
- faq_opportunity: use action "set_faq_schema" with JSON array of {question,answer}
- Do NOT fix slug for published pages
- Return ONLY the JSON array, no markdown fences, no extra text`;

  return { system, user };
}

// ── Call the AI based on resolved provider ──

async function callAI(route: ProviderRoute, system: string, user: string, rawModel: string, modelPolicy: ReturnType<typeof getSeoFixModelPolicy>): Promise<AiCallResult> {
  if (route.provider === 'lovable-gateway') {
    return callLovableGateway(route.gatewayModel, system, user, modelPolicy);
  } else if (route.provider === 'vertex-ai') {
    return callVertexForSeo(route.vertexModel, system, user, modelPolicy.maxOutputTokens);
  } else if (route.provider === 'bedrock-nova') {
    return callBedrockNovaForSeo(route.modelKey, system, user, modelPolicy.maxOutputTokens);
  } else if (route.provider === 'azure-openai') {
    return callAzureOpenAIForSeo(system, user, modelPolicy.maxOutputTokens);
  } else {
    return callBedrockMistralForSeo(system, user, modelPolicy.maxOutputTokens);
  }
}

async function callVertexForSeo(model: string, system: string, user: string, maxOutputTokens: number): Promise<AiCallResult> {
  const { callVertexGemini } = await import('../_shared/vertex-ai.ts');
  const text = await callVertexGemini(
    model,
    `${system}\n\n${user}`,
    120_000,
    {
      maxOutputTokens,
      temperature: 0.3,
      responseMimeType: 'application/json',
    },
  );

  return {
    text,
    attemptsMade: 1,
    retryEvents: [],
  };
}

async function callLovableGateway(model: string, system: string, user: string, modelPolicy: ReturnType<typeof getSeoFixModelPolicy>): Promise<AiCallResult> {
  const apiKey = Deno.env.get('LOVABLE_API_KEY')!;
  const retryEvents: string[] = [];

  for (let attempt = 0; attempt <= modelPolicy.retryCount; attempt++) {
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        temperature: 0.3,
        max_tokens: modelPolicy.maxOutputTokens,
      }),
    });

    if (response.ok) {
      const data = await response.json();
      return {
        text: data.choices?.[0]?.message?.content || '',
        attemptsMade: attempt + 1,
        retryEvents,
      };
    }

    const status = response.status;
    const text = await response.text().catch(() => '');

    if (isRetryableSeoFixStatus(status) && attempt < modelPolicy.retryCount) {
      const backoffMs = getSeoFixRetryDelayMs(modelPolicy.baseRetryDelayMs, attempt);
      const retryEvent = `429 on attempt ${attempt + 1}/${modelPolicy.retryCount + 1}; delaying ${backoffMs}ms`;
      retryEvents.push(retryEvent);
      console.log(`[SEO-FIX] ${retryEvent}`);
      await sleep(backoffMs);
      continue;
    }

    if (status === 429) {
      const error = new Error('Rate limited after retries — try again later') as Error & {
        retryable?: boolean;
        code?: string;
        retryEvents?: string[];
        attemptsMade?: number;
      };
      error.retryable = true;
      error.code = 'GATEWAY_RATE_LIMITED';
      error.retryEvents = retryEvents;
      error.attemptsMade = attempt + 1;
      throw error;
    }
    if (status === 402) throw new Error('Credits exhausted — add funds');
    throw new Error(`AI gateway error ${status}: ${text.substring(0, 200)}`);
  }

  throw new Error('Unexpected: exhausted retries without result');
}

async function callBedrockNovaForSeo(modelKey: string, system: string, user: string, maxTokens: number): Promise<AiCallResult> {
  const { callBedrockNova } = await import('../_shared/bedrock-nova.ts');
  const text = await callBedrockNova(modelKey, user, {
    maxTokens,
    temperature: 0.3,
    timeoutMs: 120_000,
    systemPrompt: system,
  });
  return { text, attemptsMade: 1, retryEvents: [] };
}

async function callBedrockMistralForSeo(system: string, user: string, maxTokens: number): Promise<AiCallResult> {
  const { awsSigV4Fetch } = await import('../_shared/bedrock-nova.ts');
  const modelId = 'mistral.mistral-large-2407-v1:0';
  const region = 'us-west-2';
  const host = `bedrock-runtime.${region}.amazonaws.com`;

  const body = JSON.stringify({
    messages: [
      { role: 'user', content: [{ text: `${system}\n\n${user}` }] },
    ],
    inferenceConfig: { maxTokens, temperature: 0.3 },
  });

  const resp = await Promise.race([
    awsSigV4Fetch(host, `/model/${modelId}/converse`, body, region, 'bedrock'),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Mistral timeout after 120s')), 120_000),
    ),
  ]);

  if (!resp.ok) {
    const status = resp.status;
    const errText = await resp.text().catch(() => 'unknown');
    if (status === 429) throw new Error('Bedrock rate limited — try again later');
    throw new Error(`Mistral Bedrock error ${status}: ${errText.substring(0, 300)}`);
  }

  const data = await resp.json();
  return {
    text: data?.output?.message?.content?.[0]?.text || '',
    attemptsMade: 1,
    retryEvents: [],
  };
}

// ── Generate fixes with robust response parsing ──

function extractJsonArray(raw: string): { parsed: any[] | null; truncated: boolean } {
  // Step 1: Strip markdown fences
  let cleaned = raw.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim();

  // Step 2: Try direct parse
  try {
    const result = JSON.parse(cleaned);
    return { parsed: Array.isArray(result) ? result : [result], truncated: false };
  } catch { /* continue */ }

  // Step 3: Find the first [ and try to extract array
  const arrayStart = cleaned.indexOf('[');
  if (arrayStart === -1) {
    return { parsed: null, truncated: false };
  }
  cleaned = cleaned.substring(arrayStart);

  // Step 4: Try parsing from the array start
  try {
    const result = JSON.parse(cleaned);
    return { parsed: Array.isArray(result) ? result : [result], truncated: false };
  } catch { /* continue */ }

  // Step 5: Truncation recovery — find last complete object
  let truncated = true;

  // Try: cut at last "},\n" or "}," and close array
  const lastComplete = cleaned.lastIndexOf('},');
  if (lastComplete > 0) {
    const attempt = cleaned.substring(0, lastComplete + 1) + ']';
    try {
      const result = JSON.parse(attempt);
      return { parsed: Array.isArray(result) ? result : [result], truncated };
    } catch { /* continue */ }
  }

  // Try: cut at last "}" and close array
  const lastObj = cleaned.lastIndexOf('}');
  if (lastObj > 0) {
    const attempt = cleaned.substring(0, lastObj + 1) + ']';
    try {
      const result = JSON.parse(attempt);
      return { parsed: Array.isArray(result) ? result : [result], truncated };
    } catch { /* continue */ }
  }

  return { parsed: null, truncated };
}

async function generateFixesForPage(page: FixRequest, route: ProviderRoute, rawModel: string, modelPolicy: ReturnType<typeof getSeoFixModelPolicy>) {
  const { system, user } = buildSeoPrompt(page);

  let aiResult: AiCallResult;
  try {
    aiResult = await callAI(route, system, user, rawModel, modelPolicy);
  } catch (err) {
    const typedErr = err as Error & {
      retryable?: boolean;
      code?: string;
      retryEvents?: string[];
      attemptsMade?: number;
    };
    const msg = typedErr instanceof Error ? typedErr.message : 'Unknown AI call error';
    console.error(`[SEO-FIX] AI call failed for ${page.slug}: ${msg}`);
    return {
      fixes: [],
      truncated: false,
      parseError: true,
      failureReason: `AI call failed: ${msg}`,
      retryable: !!typedErr?.retryable,
      errorCode: typedErr?.code || null,
      retryEvents: typedErr?.retryEvents || [],
      attemptsMade: typedErr?.attemptsMade || 1,
    };
  }

  const raw = aiResult.text;

  if (!raw || raw.trim().length === 0) {
    console.error(`[SEO-FIX] Empty AI response for ${page.slug}`);
    return {
      fixes: [],
      truncated: false,
      parseError: true,
      failureReason: 'AI returned empty response',
      retryable: false,
      errorCode: null,
      retryEvents: aiResult.retryEvents,
      attemptsMade: aiResult.attemptsMade,
    };
  }

  const { parsed, truncated } = extractJsonArray(raw);

  if (!parsed) {
    console.error(`[SEO-FIX] Parse failed for ${page.slug}. Raw (first 300 chars):`, raw.substring(0, 300));
    return {
      fixes: [],
      truncated,
      parseError: true,
      failureReason: `Could not extract JSON array from AI response (${raw.length} chars). First 100: ${raw.substring(0, 100)}`,
      retryable: false,
      errorCode: null,
      retryEvents: aiResult.retryEvents,
      attemptsMade: aiResult.attemptsMade,
    };
  }

  const providerLabel = route.provider === 'lovable-gateway'
    ? (route as any).gatewayModel
    : route.provider === 'vertex-ai'
      ? (route as any).vertexModel
    : route.provider === 'bedrock-nova'
      ? (route as any).modelKey
      : 'mistral';
  console.log(`[SEO-FIX] ${page.slug}: ${parsed.length} fixes via ${providerLabel}, truncated=${truncated}`);

  return {
    fixes: parsed,
    truncated,
    parseError: false,
    failureReason: null,
    retryable: false,
    errorCode: null,
    retryEvents: aiResult.retryEvents,
    attemptsMade: aiResult.attemptsMade,
    recoveredAfterRetry: aiResult.retryEvents.length > 0,
  };
}
