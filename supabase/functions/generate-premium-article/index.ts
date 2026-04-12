/**
 * generate-premium-article — Gemini 2.5 Pro via Google Gemini API (Direct)
 * Premium long-form article generation, rewriting, and polishing.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { callGeminiDirect } from '../_shared/gemini-direct.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// ═══════════════════════════════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════════════════════════════

const GEMINI_MODEL = 'gemini-2.5-pro';
const GEMINI_TIMEOUT_MS = 120_000;

const VALID_ACTIONS = new Set([
  'generate-full-article', 'rewrite-article', 'polish-article',
  'expand-article', 'generate-final-seo-package',
]);

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

function tryParseJSON(raw: string): Record<string, unknown> {
  try { return JSON.parse(raw); } catch { /* continue */ }
  const cleaned = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
  try { return JSON.parse(cleaned); } catch { /* continue */ }
  const first = cleaned.indexOf('{');
  const last = cleaned.lastIndexOf('}');
  if (first !== -1 && last > first) {
    try { return JSON.parse(cleaned.substring(first, last + 1)); } catch { /* continue */ }
  }
  throw new Error(`Failed to parse JSON from model response (length=${raw.length})`);
}

// ═══════════════════════════════════════════════════════════════
// ADMIN AUTH
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
// SYSTEM PROMPT
// ═══════════════════════════════════════════════════════════════

const SYSTEM_PROMPT = `You are the Chief Content Strategist and Head Writer at TrueJobs.co.in — India's most trusted government job preparation portal. You have 15+ years covering Indian government recruitment, competitive exams, and career guidance.

=== QUALITY STANDARDS ===
- E-E-A-T: Write with experience, expertise, authoritativeness, trustworthiness
- AdSense compliant: Original value beyond official notifications
- Every paragraph must contain specific, useful data (dates, figures, pay levels, vacancies)
- Use HTML tables for: vacancy breakdowns, salary comparisons, exam patterns, important dates
- Bold important data: dates, salary figures, age limits, vacancy numbers, deadlines
- Paragraphs: max 3 sentences. No filler phrases.
- Include Hindi transliterations for key terms where helpful for SEO
- Reference official websites by name

BANNED PHRASES: "In today's competitive world", "golden opportunity", "As we all know", "Let's dive in", "Without further ado", "Needless to say", any filler or restated content.

=== STRUCTURE ===
- Start with Quick Overview table (Conducting Body, Exam, Vacancies, Eligibility, Age, Salary, Application Mode, Official Website)
- Use question-based H2 headings for featured snippet optimization
- End with FAQ section
- Include schema.org FAQPage markup suggestions

=== SEO ===
- Primary keyword in first 100 words and 3+ H2 headings naturally
- Include clear 40-60 word featured snippet paragraph within first 200 words
- Suggest 3-5 internal linking opportunities

=== OUTPUT FORMAT ===
Always return valid JSON matching the requested schema. Never include markdown fences in the output.`;

// ═══════════════════════════════════════════════════════════════
// PROMPT BUILDERS
// ═══════════════════════════════════════════════════════════════

function buildPrompt(body: any): string {
  const ctx = `
Topic: ${body.topic || body.title || 'N/A'}
Title: ${body.title || 'N/A'}
Category: ${body.category || 'Government Jobs'}
Tags: ${(body.tags || []).join(', ') || 'N/A'}
Slug: ${body.slug || 'N/A'}
Target Keywords: ${(body.targetKeywords || []).join(', ') || 'N/A'}
Secondary Keywords: ${(body.secondaryKeywords || []).join(', ') || 'N/A'}
Search Intent: ${body.searchIntent || 'informational'}
Audience: ${body.audience || 'Indian government job aspirants'}
Tone: ${body.tone || 'authoritative yet approachable'}
Locale: ${body.locale || 'en-IN'}
Desired Word Count: ${body.desiredWordCount || 2000}
${body.notes ? `Notes: ${body.notes}` : ''}
${body.customInstructions ? `Custom Instructions: ${body.customInstructions}` : ''}`.trim();

  const outlineSection = body.outline
    ? `\nArticle Outline:\n${body.outline.map((s: any, i: number) => `${i + 1}. ${s.heading}${s.subheadings ? '\n   - ' + s.subheadings.join('\n   - ') : ''}`).join('\n')}`
    : '';

  const faqSection = body.faqItems
    ? `\nPre-generated FAQ Items:\n${body.faqItems.map((f: any) => `Q: ${f.question}\nA: ${f.answer}`).join('\n\n')}`
    : '';

  const existingContent = body.existingContent
    ? `\nExisting article content:\n${body.existingContent.substring(0, 8000)}`
    : '';

  const existingMeta = body.existingMeta
    ? `\nExisting Meta: title="${body.existingMeta.meta_title || ''}" desc="${body.existingMeta.meta_description || ''}" excerpt="${body.existingMeta.excerpt || ''}"`
    : '';

  const outputSchema = `
Return JSON with these fields:
{
  "title": "SEO-optimized article title",
  "meta_title": "under 60 chars, primary keyword included",
  "meta_description": "under 155 chars, compelling",
  "excerpt": "2-3 sentence excerpt under 200 chars",
  "content_html": "full article in clean HTML with proper h2/h3/table/ul/ol/strong tags",
  "faq_items": [{"question": "...", "answer": "..."}],
  "suggested_tags": ["tag1", "tag2"],
  "suggested_category": "category name",
  "image_prompt": "description for generating a featured image",
  "schema_draft": { ... schema.org JSON-LD ... },
  "word_count": number,
  "notes": "any important notes about the generated content"
}`;

  switch (body.action) {
    case 'generate-full-article':
      return `Generate a complete, publishable, SEO-optimized long-form article.

${ctx}
${outlineSection}
${faqSection}

Requirements:
- Minimum ${body.desiredWordCount || 2000} words
- Comprehensive coverage of all aspects
- Data-dense with specific figures, dates, and facts
- Tables for structured data (exam patterns, vacancies, salary, dates)
- Question-based H2 headings
- Quick Overview table at the start
- FAQ section at the end with 6-8 items
${outputSchema}`;

    case 'rewrite-article':
      return `Completely rewrite this article to be more authoritative, data-rich, and SEO-optimized while maintaining accuracy.

${ctx}
${existingContent}
${existingMeta}

Requirements:
- Improve E-E-A-T signals
- Add specific data where missing
- Better heading structure with question-based H2s
- Add tables for structured data
- Improve readability (shorter paragraphs, scannable)
- Target ${body.desiredWordCount || 2000}+ words
- Remove all filler and generic statements
${outputSchema}`;

    case 'polish-article':
      return `Polish and improve this article for final publishing. Fix grammar, improve clarity, strengthen data points, improve SEO signals. Do not fundamentally change the structure or remove important content.

${ctx}
${existingContent}
${existingMeta}

Requirements:
- Fix grammar and readability issues
- Strengthen weak statements with specific data
- Improve heading SEO
- Ensure proper HTML formatting
- Add missing bold/strong tags for key data
- Verify table formatting
${outputSchema}`;

    case 'expand-article':
      return `Expand this article with additional valuable sections and deeper coverage. Add new sections, more data, additional FAQ items, and more comprehensive coverage.

${ctx}
${existingContent}

Requirements:
- Add 3-5 new valuable sections
- Expand existing thin sections with more data
- Add more FAQ items
- Include additional tables where helpful
- Target ${body.desiredWordCount || 3000}+ words
- Maintain consistent tone and quality
${outputSchema}`;

    case 'generate-final-seo-package':
      return `Generate a complete SEO publishing package for this article. This includes optimized metadata, schema markup, internal linking suggestions, and content improvements.

${ctx}
${existingContent}
${existingMeta}
${faqSection}

Return JSON with ALL fields populated:
{
  "title": "SEO-optimized title",
  "meta_title": "under 60 chars",
  "meta_description": "under 155 chars",
  "excerpt": "compelling excerpt",
  "content_html": "the polished article HTML",
  "faq_items": [{"question": "...", "answer": "..."}],
  "suggested_tags": ["tag1", "tag2"],
  "suggested_category": "category",
  "image_prompt": "featured image description",
  "schema_draft": { ... complete schema.org JSON-LD ... },
  "word_count": number,
  "notes": "SEO notes and recommendations"
}`;

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

    console.log(`[premium-article] action=${action} topic="${body.topic || body.title || 'N/A'}" desiredWords=${body.desiredWordCount || 2000}`);

    const prompt = buildPrompt(body);
    const fullPrompt = `${SYSTEM_PROMPT}\n\n${prompt}`;
    const rawResponse = await callGeminiDirect(GEMINI_MODEL, fullPrompt, GEMINI_TIMEOUT_MS, {
      temperature: 0.6,
      topP: 0.85,
      maxOutputTokens: 32768,
      responseMimeType: 'application/json',
    });
    const data = tryParseJSON(rawResponse);

    if (data.content_html && typeof data.content_html === 'string') {
      const textOnly = (data.content_html as string).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      data.word_count = textOnly.split(/\s+/).length;
    }

    const elapsed = Date.now() - startMs;
    console.log(`[premium-article] action=${action} completed in ${elapsed}ms word_count=${data.word_count || 'N/A'}`);

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
    console.error(`[premium-article] error after ${elapsed}ms: ${message}`);
    return new Response(JSON.stringify({
      success: false,
      error: message,
      model: GEMINI_MODEL,
      elapsedMs: elapsed,
    }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
