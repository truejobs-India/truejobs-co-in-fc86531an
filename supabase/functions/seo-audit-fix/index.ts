import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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

// ── Provider routing ──

type ProviderRoute =
  | { provider: 'lovable-gateway'; gatewayModel: string }
  | { provider: 'bedrock-nova'; modelKey: string }
  | { provider: 'bedrock-mistral' };

function resolveProvider(uiModelKey: string): ProviderRoute {
  switch (uiModelKey) {
    case 'nova-pro':
      return { provider: 'bedrock-nova', modelKey: 'nova-pro' };
    case 'nova-premier':
      return { provider: 'bedrock-nova', modelKey: 'nova-premier' };
    case 'mistral':
      return { provider: 'bedrock-mistral' };
    case 'gemini-pro':
      return { provider: 'lovable-gateway', gatewayModel: 'google/gemini-2.5-pro' };
    case 'gpt5':
      return { provider: 'lovable-gateway', gatewayModel: 'openai/gpt-5' };
    case 'gpt5-mini':
      return { provider: 'lovable-gateway', gatewayModel: 'openai/gpt-5-mini' };
    case 'gemini-flash':
    case 'lovable-gemini':
    default:
      return { provider: 'lovable-gateway', gatewayModel: 'google/gemini-2.5-flash' };
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
    console.log(`[SEO-FIX] Model: "${rawModel}" → provider: ${route.provider}${route.provider === 'lovable-gateway' ? ` (${route.gatewayModel})` : route.provider === 'bedrock-nova' ? ` (${route.modelKey})` : ''}`);

    // Validate provider-specific credentials upfront
    if (route.provider === 'lovable-gateway') {
      const key = Deno.env.get('LOVABLE_API_KEY');
      if (!key) {
        return new Response(JSON.stringify({ error: 'LOVABLE_API_KEY not configured' }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    } else {
      // Bedrock models need AWS credentials
      const ak = Deno.env.get('AWS_ACCESS_KEY_ID');
      const sk = Deno.env.get('AWS_SECRET_ACCESS_KEY');
      if (!ak || !sk) {
        return new Response(JSON.stringify({ error: 'AWS credentials not configured for Bedrock models' }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    const results: any[] = [];

    for (const page of pages) {
      try {
        const fix = await generateFixesForPage(page, route);
        results.push({ recordId: page.recordId, source: page.source, slug: page.slug, ...fix });
      } catch (err) {
        console.error(`[SEO-FIX] Error fixing ${page.slug}:`, err);
        results.push({
          recordId: page.recordId,
          source: page.source,
          slug: page.slug,
          fixes: [],
          error: err instanceof Error ? err.message : 'Unknown error',
        });
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
    `${idx + 1}. [${i.category}] ${i.message}${i.currentValue ? ` | Current: "${i.currentValue.substring(0, 100)}"` : ''}${i.fixHint ? ` | Hint: ${i.fixHint}` : ''}`
  ).join('\n');

  const urlPrefix = page.source === 'blog_posts' ? 'blog' : page.source === 'pdf_resources' ? 'resources' : 'pages';

  const system = 'You are a precise SEO fixing engine. Return only valid JSON arrays. No markdown. No explanations outside the JSON.';

  const user = `You are an SEO expert for truejobs.co.in. Fix the SEO issues for this page.

Page: "${page.title}" (/${page.slug})
Source: ${page.source}
Published: ${page.isPublished}
${page.contentSnippet ? `Content preview: ${page.contentSnippet.substring(0, 1500)}` : ''}

Issues to fix:
${issueList}

Return a JSON array of fix objects. Each fix must have:
- category: exact category from the issue (meta_title, meta_description, canonical_url, excerpt, featured_image_alt, h1, internal_links, faq_opportunity, faq_schema, intro_missing, heading_structure)
- field: the DB field to update (meta_title, meta_description, canonical_url, excerpt, featured_image_alt, content, faq_schema, has_faq_schema)
- action: "set_field" | "append_content" | "set_faq_schema"
- value: the new value to set or HTML to append
- confidence: "high" | "medium" | "low"
- explanation: ≤15 words explaining the fix

Rules:
- meta_title: 30-60 chars, include primary keyword
- meta_description: 130-155 chars strictly, never above 155
- canonical_url: exactly https://truejobs.co.in/${urlPrefix}/${page.slug}
- excerpt: 100-200 chars, compelling summary
- featured_image_alt: descriptive, 10-80 chars
- h1: if missing, generate and use action "append_content" with value "<h1>title</h1>" to prepend
- h1: if multiple, keep best one, provide replacement content section
- internal_links: generate 3-5 relevant links as an HTML block using action "append_content". Use only paths like /blog/*, /resources/*, /govt-jobs/*, /results/*
- faq_opportunity: generate 5 relevant Q&A pairs. Use action "set_faq_schema" with value as JSON array of {question,answer}. Also use a second fix with action "append_content" to add FAQ HTML section
- faq_schema: fix malformed FAQ items
- intro_missing: generate a 2-3 sentence intro paragraph, action "append_content"
- Do NOT fix slug for published pages
- Keep explanations ≤15 words
- Return ONLY the JSON array, no markdown fences`;

  return { system, user };
}

// ── Call the AI based on resolved provider ──

async function callAI(route: ProviderRoute, system: string, user: string): Promise<string> {
  if (route.provider === 'lovable-gateway') {
    return callLovableGateway(route.gatewayModel, system, user);
  } else if (route.provider === 'bedrock-nova') {
    return callBedrockNovaForSeo(route.modelKey, system, user);
  } else {
    return callBedrockMistralForSeo(system, user);
  }
}

async function callLovableGateway(model: string, system: string, user: string): Promise<string> {
  const apiKey = Deno.env.get('LOVABLE_API_KEY')!;
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
      max_tokens: 4096,
    }),
  });

  if (!response.ok) {
    const status = response.status;
    if (status === 429) throw new Error('Rate limited — try again later');
    if (status === 402) throw new Error('Credits exhausted — add funds');
    const text = await response.text();
    throw new Error(`AI gateway error ${status}: ${text.substring(0, 200)}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

async function callBedrockNovaForSeo(modelKey: string, system: string, user: string): Promise<string> {
  const { callBedrockNova } = await import('../_shared/bedrock-nova.ts');
  // Combine system + user into a single prompt for Nova (system goes via systemPrompt option)
  return callBedrockNova(modelKey, user, {
    maxTokens: 4096,
    temperature: 0.3,
    timeoutMs: 120_000,
    systemPrompt: system,
  });
}

async function callBedrockMistralForSeo(system: string, user: string): Promise<string> {
  const { awsSigV4Fetch } = await import('../_shared/bedrock-nova.ts');
  const modelId = 'mistral.mistral-large-2407-v1:0';
  const region = 'us-west-2';
  const host = `bedrock-runtime.${region}.amazonaws.com`;

  const body = JSON.stringify({
    messages: [
      { role: 'user', content: [{ text: `${system}\n\n${user}` }] },
    ],
    inferenceConfig: { maxTokens: 4096, temperature: 0.3 },
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
  return data?.output?.message?.content?.[0]?.text || '';
}

// ── Generate fixes with response parsing ──

async function generateFixesForPage(page: FixRequest, route: ProviderRoute) {
  const { system, user } = buildSeoPrompt(page);

  let raw = await callAI(route, system, user);

  // Strip markdown fences
  raw = raw.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim();

  // Truncation recovery
  let truncated = false;
  let parseError = false;

  if (raw && !raw.endsWith(']')) {
    console.log(`[SEO-FIX] Truncation detected for ${page.slug}`);
    truncated = true;
    const lastComplete = raw.lastIndexOf('},');
    if (lastComplete > 0) {
      raw = raw.substring(0, lastComplete + 1) + ']';
      console.log(`[SEO-FIX] Recovery: salvaged ${raw.length} chars`);
    } else {
      const lastObj = raw.lastIndexOf('}');
      if (lastObj > 0) {
        raw = raw.substring(0, lastObj + 1) + ']';
      } else {
        parseError = true;
      }
    }
  }

  let fixes: any[] = [];
  if (!parseError) {
    try {
      fixes = JSON.parse(raw);
      if (!Array.isArray(fixes)) fixes = [fixes];
    } catch {
      parseError = true;
      console.error(`[SEO-FIX] Parse error for ${page.slug}:`, raw.substring(0, 200));
    }
  }

  const providerLabel = route.provider === 'lovable-gateway'
    ? route.gatewayModel
    : route.provider === 'bedrock-nova'
      ? route.modelKey
      : 'mistral';
  console.log(`[SEO-FIX] ${page.slug}: ${fixes.length} fixes via ${providerLabel}, truncated=${truncated}, parseError=${parseError}`);

  return { fixes, truncated, parseError };
}
