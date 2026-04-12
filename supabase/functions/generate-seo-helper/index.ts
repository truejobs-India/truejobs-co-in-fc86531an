/**
 * generate-seo-helper — Gemini 2.5 Flash via Google Gemini API (Direct)
 * Fast SEO helper for keyword clustering, outlines, meta, FAQs, etc.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { callGeminiDirect } from '../_shared/gemini-direct.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_TIMEOUT_MS = 45_000;

const VALID_ACTIONS = new Set([
  'generate-outline', 'generate-faqs', 'generate-meta',
  'suggest-tags', 'suggest-category', 'suggest-internal-links',
  'cluster-keywords', 'generate-schema-draft', 'rewrite-short-copy',
  'generate-title-variations',
]);

function tryParseJSON(raw: string): Record<string, unknown> {
  try { return JSON.parse(raw); } catch { /* continue */ }
  const cleaned = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
  try { return JSON.parse(cleaned); } catch { /* continue */ }
  const first = cleaned.indexOf('{');
  const last = cleaned.lastIndexOf('}');
  if (first !== -1 && last > first) {
    try { return JSON.parse(cleaned.substring(first, last + 1)); } catch { /* continue */ }
  }
  const firstArr = cleaned.indexOf('[');
  const lastArr = cleaned.lastIndexOf(']');
  if (firstArr !== -1 && lastArr > firstArr) {
    try { return { items: JSON.parse(cleaned.substring(firstArr, lastArr + 1)) }; } catch { /* continue */ }
  }
  throw new Error(`Failed to parse JSON from model response (length=${raw.length})`);
}

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
// PROMPT BUILDERS (unchanged)
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
      return `You are an expert SEO content strategist for Indian government jobs and exams at TrueJobs.co.in.\n\nGenerate a detailed article outline optimized for SEO.\n\n${ctx}\n${contentSnippet}\nTarget word count: ${body.wordCount || 1500}\n\nReturn JSON:\n{\n  "outline": [\n    { "heading": "H2 heading text", "subheadings": ["H3 sub1", "H3 sub2"], "notes": "brief guidance" }\n  ],\n  "estimatedWordCount": number,\n  "targetKeyword": "primary keyword"\n}\n\nMake headings question-based where possible for featured snippet optimization. Include 8-12 sections minimum.`;
    case 'generate-faqs':
      return `You are an expert SEO content strategist for Indian government jobs at TrueJobs.co.in.\n\nGenerate 6-8 high-quality FAQ items that real aspirants search for.\n\n${ctx}\n${contentSnippet}\n\nReturn JSON:\n{\n  "faqs": [\n    { "question": "specific question", "answer": "concise, data-rich answer (2-3 sentences)" }\n  ],\n  "schemaDraft": "<script type=\\"application/ld+json\\">...</script>"\n}\n\nQuestions must be specific, not generic. Answers must contain real data points. Include FAQPage schema.`;
    case 'generate-meta':
      return `You are an SEO specialist for Indian government jobs portal TrueJobs.co.in.\n\nGenerate optimized metadata for the given article/topic.\n\n${ctx}\n${contentSnippet}\n\nReturn JSON:\n{\n  "meta_title": "under 60 chars, primary keyword early",\n  "meta_description": "under 155 chars, compelling, includes CTA",\n  "excerpt": "2-3 sentence excerpt for article cards (under 200 chars)",\n  "title_variations": ["variation 1", "variation 2", "variation 3"]\n}`;
    case 'suggest-tags':
      return `You are an SEO specialist for TrueJobs.co.in — Indian government jobs portal.\n\nSuggest 5-10 relevant blog tags for this article.\n\n${ctx}\n${contentSnippet}\n\nReturn JSON:\n{\n  "suggestedTags": ["tag1", "tag2", ...],\n  "reasoning": "brief explanation of why these tags"\n}\n\nTags should be specific (e.g., "SSC CGL 2026", "Railway Group D"), not generic (e.g., "jobs", "exam").`;
    case 'suggest-category':
      return `You are an editor at TrueJobs.co.in — Indian government jobs portal.\n\nSuggest the best blog category for this article from common Indian govt job categories.\n\n${ctx}\n${contentSnippet}\n\nReturn JSON:\n{\n  "suggestedCategory": "primary category",\n  "alternatives": ["alt1", "alt2"],\n  "reasoning": "why this category fits best"\n}\n\nCommon categories: Banking, SSC, Railway, UPSC, State PSC, Defence, Teaching, Healthcare, Engineering, Police, IT & Tech, Career Tips, Exam Preparation, Results & Cut-offs, Admit Cards`;
    case 'suggest-internal-links':
      return `You are an SEO strategist at TrueJobs.co.in.\n\nSuggest 3-5 internal page slugs that should be linked from this article for topical relevance and SEO.\n\n${ctx}\n${contentSnippet}\n\nReturn JSON:\n{\n  "links": [\n    { "slug": "ssc-cgl-2026-notification", "anchorText": "SSC CGL 2026 notification", "reason": "directly related exam" }\n  ]\n}\n\nSlugs should follow TrueJobs URL patterns (exam-name-year-type).`;
    case 'cluster-keywords':
      return `You are a keyword research specialist for Indian government job content.\n\nCluster the given keywords by search intent and topical relevance.\n\n${ctx}\nKeywords to cluster: ${(body.targetKeywords || []).concat(body.secondaryKeywords || []).join(', ')}\n\nReturn JSON:\n{\n  "clusters": [\n    { "name": "cluster name", "keywords": ["kw1", "kw2"], "intent": "informational|navigational|transactional" }\n  ]\n}`;
    case 'generate-schema-draft':
      return `You are a structured data expert for TrueJobs.co.in.\n\nGenerate appropriate schema.org JSON-LD for this page.\n\n${ctx}\n${contentSnippet}\n\nReturn JSON:\n{\n  "schemaJson": { ... valid schema.org JSON-LD object ... },\n  "schemaType": "Article|FAQPage|JobPosting|etc"\n}\n\nUse schema types appropriate for Indian government job/exam content.`;
    case 'rewrite-short-copy':
      return `You are a senior copywriter at TrueJobs.co.in.\n\nRewrite the following text to be more engaging, SEO-friendly, and concise. Keep the same meaning.\n\n${ctx}\nText to rewrite:\n${body.content || ''}\n\nReturn JSON:\n{\n  "rewrittenCopy": "the improved text",\n  "charCount": number\n}`;
    case 'generate-title-variations':
      return `You are an SEO headline specialist for TrueJobs.co.in.\n\nGenerate 5 compelling title variations optimized for CTR and SEO.\n\n${ctx}\n\nReturn JSON:\n{\n  "variations": [\n    { "title": "variation text", "style": "question|how-to|listicle|data-driven|emotional" }\n  ]\n}\n\nInclude power words. Keep under 60 chars. Include primary keyword.`;
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

    const prompt = buildSeoPrompt(body);
    const rawResponse = await callGeminiDirect(GEMINI_MODEL, prompt, GEMINI_TIMEOUT_MS, {
      temperature: 0.4,
      topP: 0.8,
      maxOutputTokens: 8192,
      responseMimeType: 'application/json',
    });
    const data = tryParseJSON(rawResponse);

    const elapsed = Date.now() - startMs;
    console.log(`[seo-helper] action=${action} completed in ${elapsed}ms`);

    return new Response(JSON.stringify({
      success: true,
      data,
      model: GEMINI_MODEL,
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
      model: GEMINI_MODEL,
      elapsedMs: elapsed,
    }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
