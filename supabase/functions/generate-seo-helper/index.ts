/**
 * generate-seo-helper — Gemini 2.5 Flash via Google Vertex AI
 * Fast SEO helper for keyword clustering, outlines, meta, FAQs, etc.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// ═══════════════════════════════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════════════════════════════

const VERTEX_MODEL = Deno.env.get('VERTEX_FLASH_MODEL') || 'gemini-2.5-flash-preview-05-20';
const VERTEX_TIMEOUT_MS = 45_000;

const VALID_ACTIONS = new Set([
  'generate-outline', 'generate-faqs', 'generate-meta',
  'suggest-tags', 'suggest-category', 'suggest-internal-links',
  'cluster-keywords', 'generate-schema-draft', 'rewrite-short-copy',
  'generate-title-variations',
]);

// ═══════════════════════════════════════════════════════════════
// GOOGLE AUTH — Service Account JWT for Vertex AI
// ═══════════════════════════════════════════════════════════════

function base64url(data: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < data.length; i++) binary += String.fromCharCode(data[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function getVertexAccessToken(): Promise<string> {
  const clientEmail = Deno.env.get('GCP_CLIENT_EMAIL');
  const privateKeyPem = Deno.env.get('GCP_PRIVATE_KEY');
  if (!clientEmail || !privateKeyPem) throw new Error('GCP_CLIENT_EMAIL and GCP_PRIVATE_KEY secrets are required');

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: clientEmail,
    sub: clientEmail,
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
    scope: 'https://www.googleapis.com/auth/cloud-platform',
  };

  const enc = new TextEncoder();
  const headerB64 = base64url(enc.encode(JSON.stringify(header)));
  const payloadB64 = base64url(enc.encode(JSON.stringify(payload)));
  const unsignedToken = `${headerB64}.${payloadB64}`;

  // Parse PEM private key — handle escaped newlines from Supabase secrets
  const keyPem = privateKeyPem.replace(/\\n/g, '\n');
  const pemBody = keyPem
    .replace(/-----BEGIN (RSA )?PRIVATE KEY-----/, '')
    .replace(/-----END (RSA )?PRIVATE KEY-----/, '')
    .replace(/\s/g, '');
  const keyBytes = Uint8Array.from(atob(pemBody), c => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8', keyBytes,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false, ['sign'],
  );

  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', cryptoKey, enc.encode(unsignedToken));
  const jwt = `${unsignedToken}.${base64url(new Uint8Array(signature))}`;

  // Exchange JWT for access token
  const tokenResp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  if (!tokenResp.ok) {
    const errText = await tokenResp.text();
    throw new Error(`Google OAuth failed (${tokenResp.status}): ${errText.substring(0, 300)}`);
  }

  const tokenData = await tokenResp.json();
  return tokenData.access_token;
}

// ═══════════════════════════════════════════════════════════════
// VERTEX AI REQUEST
// ═══════════════════════════════════════════════════════════════

async function callVertexGemini(prompt: string, accessToken: string): Promise<string> {
  const projectId = Deno.env.get('GCP_PROJECT_ID');
  const location = Deno.env.get('GCP_LOCATION') || 'us-central1';
  if (!projectId) throw new Error('GCP_PROJECT_ID secret is required');

  const url = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${VERTEX_MODEL}:generateContent`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), VERTEX_TIMEOUT_MS);

  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.4,
          topP: 0.8,
          maxOutputTokens: 8192,
          responseMimeType: 'application/json',
        },
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`Vertex AI error (${resp.status}): ${errText.substring(0, 500)}`);
    }

    const data = await resp.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  } finally {
    clearTimeout(timer);
  }
}

function tryParseJSON(raw: string): Record<string, unknown> {
  try { return JSON.parse(raw); } catch { /* continue */ }
  const cleaned = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
  try { return JSON.parse(cleaned); } catch { /* continue */ }
  const first = cleaned.indexOf('{');
  const last = cleaned.lastIndexOf('}');
  if (first !== -1 && last > first) {
    try { return JSON.parse(cleaned.substring(first, last + 1)); } catch { /* continue */ }
  }
  // Try array
  const firstArr = cleaned.indexOf('[');
  const lastArr = cleaned.lastIndexOf(']');
  if (firstArr !== -1 && lastArr > firstArr) {
    try { return { items: JSON.parse(cleaned.substring(firstArr, lastArr + 1)) }; } catch { /* continue */ }
  }
  throw new Error(`Failed to parse JSON from model response (length=${raw.length})`);
}

// ═══════════════════════════════════════════════════════════════
// ADMIN AUTH (reuse project pattern)
// ═══════════════════════════════════════════════════════════════

async function verifyAdmin(req: Request): Promise<{ userId: string } | Response> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ success: false, error: 'Unauthorized — missing token' }), {
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
    return new Response(JSON.stringify({ success: false, error: 'Unauthorized — invalid token' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  const userId = data.claims.sub as string;
  const svc = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data: roleRow } = await svc.from('user_roles').select('role').eq('user_id', userId).eq('role', 'admin').maybeSingle();
  if (!roleRow) {
    return new Response(JSON.stringify({ success: false, error: 'Forbidden — admin role required' }), {
      status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  return { userId };
}

// ═══════════════════════════════════════════════════════════════
// PROMPT BUILDERS
// ═══════════════════════════════════════════════════════════════

function buildSeoPrompt(body: any): string {
  const ctx = `
Topic: ${body.topic || body.title || 'N/A'}
Title: ${body.title || 'N/A'}
Category: ${body.category || 'General'}
Tags: ${(body.tags || []).join(', ') || 'N/A'}
Slug: ${body.slug || 'N/A'}
Target Keywords: ${(body.targetKeywords || []).join(', ') || 'N/A'}
Secondary Keywords: ${(body.secondaryKeywords || []).join(', ') || 'N/A'}
Tone: ${body.tone || 'professional, authoritative'}
Locale: ${body.locale || 'en-IN'}
${body.existingMeta ? `Existing Meta Title: ${body.existingMeta.meta_title || ''}\nExisting Meta Desc: ${body.existingMeta.meta_description || ''}\nExisting Excerpt: ${body.existingMeta.excerpt || ''}` : ''}
${body.customInstructions ? `Custom Instructions: ${body.customInstructions}` : ''}`.trim();

  const contentSnippet = body.content ? `\nArticle content (first 2000 chars):\n${body.content.substring(0, 2000)}` : '';

  switch (body.action) {
    case 'generate-outline':
      return `You are an expert SEO content strategist for Indian government jobs and exams at TrueJobs.co.in.

Generate a detailed article outline optimized for SEO.

${ctx}
${contentSnippet}
Target word count: ${body.wordCount || 1500}

Return JSON:
{
  "outline": [
    { "heading": "H2 heading text", "subheadings": ["H3 sub1", "H3 sub2"], "notes": "brief guidance" }
  ],
  "estimatedWordCount": number,
  "targetKeyword": "primary keyword"
}

Make headings question-based where possible for featured snippet optimization. Include 8-12 sections minimum.`;

    case 'generate-faqs':
      return `You are an expert SEO content strategist for Indian government jobs at TrueJobs.co.in.

Generate 6-8 high-quality FAQ items that real aspirants search for.

${ctx}
${contentSnippet}

Return JSON:
{
  "faqs": [
    { "question": "specific question", "answer": "concise, data-rich answer (2-3 sentences)" }
  ],
  "schemaDraft": "<script type=\\"application/ld+json\\">...</script>"
}

Questions must be specific, not generic. Answers must contain real data points. Include FAQPage schema.`;

    case 'generate-meta':
      return `You are an SEO specialist for Indian government jobs portal TrueJobs.co.in.

Generate optimized metadata for the given article/topic.

${ctx}
${contentSnippet}

Return JSON:
{
  "meta_title": "under 60 chars, primary keyword early",
  "meta_description": "under 155 chars, compelling, includes CTA",
  "excerpt": "2-3 sentence excerpt for article cards (under 200 chars)",
  "title_variations": ["variation 1", "variation 2", "variation 3"]
}`;

    case 'suggest-tags':
      return `You are an SEO specialist for TrueJobs.co.in — Indian government jobs portal.

Suggest 5-10 relevant blog tags for this article.

${ctx}
${contentSnippet}

Return JSON:
{
  "suggestedTags": ["tag1", "tag2", ...],
  "reasoning": "brief explanation of why these tags"
}

Tags should be specific (e.g., "SSC CGL 2026", "Railway Group D"), not generic (e.g., "jobs", "exam").`;

    case 'suggest-category':
      return `You are an editor at TrueJobs.co.in — Indian government jobs portal.

Suggest the best blog category for this article from common Indian govt job categories.

${ctx}
${contentSnippet}

Return JSON:
{
  "suggestedCategory": "primary category",
  "alternatives": ["alt1", "alt2"],
  "reasoning": "why this category fits best"
}

Common categories: Banking, SSC, Railway, UPSC, State PSC, Defence, Teaching, Healthcare, Engineering, Police, IT & Tech, Career Tips, Exam Preparation, Results & Cut-offs, Admit Cards`;

    case 'suggest-internal-links':
      return `You are an SEO strategist at TrueJobs.co.in.

Suggest 3-5 internal page slugs that should be linked from this article for topical relevance and SEO.

${ctx}
${contentSnippet}

Return JSON:
{
  "links": [
    { "slug": "ssc-cgl-2026-notification", "anchorText": "SSC CGL 2026 notification", "reason": "directly related exam" }
  ]
}

Slugs should follow TrueJobs URL patterns (exam-name-year-type).`;

    case 'cluster-keywords':
      return `You are a keyword research specialist for Indian government job content.

Cluster the given keywords by search intent and topical relevance.

${ctx}
Keywords to cluster: ${(body.targetKeywords || []).concat(body.secondaryKeywords || []).join(', ')}

Return JSON:
{
  "clusters": [
    { "name": "cluster name", "keywords": ["kw1", "kw2"], "intent": "informational|navigational|transactional" }
  ]
}`;

    case 'generate-schema-draft':
      return `You are a structured data expert for TrueJobs.co.in.

Generate appropriate schema.org JSON-LD for this page.

${ctx}
${contentSnippet}

Return JSON:
{
  "schemaJson": { ... valid schema.org JSON-LD object ... },
  "schemaType": "Article|FAQPage|JobPosting|etc"
}

Use schema types appropriate for Indian government job/exam content.`;

    case 'rewrite-short-copy':
      return `You are a senior copywriter at TrueJobs.co.in.

Rewrite the following text to be more engaging, SEO-friendly, and concise. Keep the same meaning.

${ctx}
Text to rewrite:
${body.content || ''}

Return JSON:
{
  "rewrittenCopy": "the improved text",
  "charCount": number
}`;

    case 'generate-title-variations':
      return `You are an SEO headline specialist for TrueJobs.co.in.

Generate 5 compelling title variations optimized for CTR and SEO.

${ctx}

Return JSON:
{
  "variations": [
    { "title": "variation text", "style": "question|how-to|listicle|data-driven|emotional" }
  ]
}

Include power words. Keep under 60 chars. Include primary keyword.`;

    default:
      throw new Error(`Unknown action: ${body.action}`);
  }
}

// ═══════════════════════════════════════════════════════════════
// HANDLER
// ═══════════════════════════════════════════════════════════════

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const startMs = Date.now();
  try {
    const authResult = await verifyAdmin(req);
    if (authResult instanceof Response) return authResult;

    const body = await req.json();
    const action = body.action;

    if (!action || !VALID_ACTIONS.has(action)) {
      return new Response(JSON.stringify({
        success: false,
        error: `Invalid action. Must be one of: ${[...VALID_ACTIONS].join(', ')}`,
      }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    console.log(`[seo-helper] action=${action} topic="${body.topic || body.title || 'N/A'}"`);

    // Build prompt
    const prompt = buildSeoPrompt(body);

    // Get access token and call Vertex AI
    const accessToken = await getVertexAccessToken();
    const rawResponse = await callVertexGemini(prompt, accessToken);
    const data = tryParseJSON(rawResponse);

    const elapsed = Date.now() - startMs;
    console.log(`[seo-helper] action=${action} completed in ${elapsed}ms`);

    return new Response(JSON.stringify({
      success: true,
      data,
      model: VERTEX_MODEL,
      action,
      elapsedMs: elapsed,
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (err) {
    const elapsed = Date.now() - startMs;
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[seo-helper] error after ${elapsed}ms: ${message}`);
    return new Response(JSON.stringify({
      success: false,
      error: message,
      model: VERTEX_MODEL,
      elapsedMs: elapsed,
    }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
