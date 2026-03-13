// Direct Gemini 2.5 API only for non-image AI features — does NOT use Lovable AI gateway
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

const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authResult = await verifyAdmin(req);
    if (authResult instanceof Response) return authResult;

    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiApiKey) {
      return new Response(JSON.stringify({ error: 'GEMINI_API_KEY not configured' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { title, content, action, selectedHtml, headings, hasIntro, hasConclusion, wordCount, category, tags, targetWordCount } = await req.json();
    if (!title || !action) {
      return new Response(JSON.stringify({ error: 'title and action required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    let prompt: string;
    let maxTokens = 2000;

    if (action === 'rewrite-section') {
      if (!selectedHtml) {
        return new Response(JSON.stringify({ error: 'selectedHtml required for rewrite-section' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      prompt = `You are a professional content editor for TrueJobs.co.in, an Indian job portal.
Rewrite the following HTML section to improve clarity, readability, and SEO quality.
Keep the same HTML structure (headings, paragraphs, lists). Preserve all factual content.
Write in the same language as the original.
Maintain an informational, non-official tone appropriate for a job portal.

Article title: ${title}
Category: ${category || 'General'}
Section to rewrite:
${selectedHtml}

Return ONLY the rewritten HTML, nothing else. No markdown code blocks.`;
      maxTokens = 3000;

    } else if (action === 'generate-intro') {
      const plainText = (content || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 2000);
      prompt = `You are a professional content editor for TrueJobs.co.in, an Indian government job portal.
Generate a short introductory paragraph (2-3 sentences) for this article.
Do NOT repeat the H1 title. Provide context about what the reader will learn.
Write in the same language as the article content.
Maintain an informational, non-official tone.

Article title: ${title}
Category: ${category || 'General'}
Tags: ${(tags || []).join(', ') || 'none'}
Content excerpt: ${plainText}

Return ONLY the HTML paragraph, e.g. <p>Your intro text here.</p>
No markdown code blocks.`;
      maxTokens = 500;

    } else if (action === 'generate-conclusion') {
      const plainText = (content || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 2000);
      prompt = `You are a professional content editor for TrueJobs.co.in, an Indian government job portal.
Generate a short conclusion section for this article with an H2 heading and 2-3 sentence paragraph.
Summarize the key takeaways. Write in the same language as the article content.
Maintain an informational, non-official tone.

Article title: ${title}
Category: ${category || 'General'}
Tags: ${(tags || []).join(', ') || 'none'}
Content excerpt: ${plainText}

Return ONLY the HTML, e.g.:
<h2>Conclusion</h2><p>Your conclusion text here.</p>
No markdown code blocks.`;
      maxTokens = 500;

    } else if (action === 'enrich-article') {
      const effectiveTarget = Math.min(Math.max(Number(targetWordCount) || 1500, 800), 3000);
      const plainText = (content || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      const currentWords = plainText.split(/\s+/).filter((w: string) => w.length > 0).length;

      prompt = `You are a professional content editor for TrueJobs.co.in, an Indian government job portal.
Expand and improve the following article to approximately ${effectiveTarget} words (currently ~${currentWords} words).

RULES:
- Preserve the original structure, intent, headings, and factual content
- Strengthen depth: add explanations, examples, practical tips, and context
- Do NOT add fluff, repetition, or fabricated claims
- Do NOT add keyword stuffing
- Keep the same language (Hindi/English) as the original
- Maintain an informational, non-official tone
- Keep all existing HTML structure (H2, H3, lists, tables)
- Add new subsections (H3) under existing H2s where appropriate
- If the article has FAQs, you may add 1-2 more relevant FAQs
- Do NOT remove any existing content

Article title: ${title}
Category: ${category || 'General'}
Tags: ${(tags || []).join(', ') || 'none'}

Current content:
${content}

Return a JSON object:
- result: the full enriched article HTML
- wordCount: approximate word count of the enriched version
- changes: array of strings describing what was added/improved

Format: {"result": "...", "wordCount": ..., "changes": [...]}
No markdown code blocks.`;
      maxTokens = 8000;

    } else if (action === 'structure') {
      const plainText = (content || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 3000);
      const headingsList = Array.isArray(headings) ? headings.map((h: any) => `${'  '.repeat((h.level || 2) - 1)}H${h.level}: ${h.text}`).join('\n') : '(no headings detected)';

      prompt = `You are a content structure expert for TrueJobs.co.in, an Indian government job portal.
Analyze this article and suggest structural improvements.

Title: ${title}
Category: ${category || 'General'}
Tags: ${(tags || []).join(', ') || 'none'}
Word count: ${wordCount || 'unknown'}
Has introduction: ${hasIntro ? 'yes' : 'no'}
Has conclusion: ${hasConclusion ? 'yes' : 'no'}

Current headings:
${headingsList}

Content excerpt: ${plainText}

Return a JSON object with:
- result: a brief summary of structural suggestions (2-3 sentences)
- changes: array of specific actionable suggestions (strings)
- proposedOutline: array of suggested H2 heading strings for the article (ordered, 5-8 items). Include existing good headings and add missing ones.
- missingSections: array of section names that should be added (e.g., "Eligibility Criteria", "How to Apply", "Important Dates", "FAQ")
- suggestedInsertions: array of objects, each with:
  - label: short name (e.g., "Introduction", "Conclusion", "Bridge paragraph")
  - content: the actual HTML content to insert
  - suggestedPlacement: where it should go (e.g., "before first heading", "after last paragraph", "between section X and Y")
  - applyMode: one of "insert_before_first_heading", "append_content", "prepend_content"

Consider typical sections for Indian government job/exam articles:
- Overview/Introduction
- Important Dates
- Eligibility Criteria (age, qualification)
- Application Process / How to Apply
- Selection Process
- Exam Pattern
- Salary & Pay Scale
- FAQ
- Conclusion

Format: {"result": "...", "changes": [...], "proposedOutline": [...], "missingSections": [...], "suggestedInsertions": [...]}
No markdown code blocks.`;
      maxTokens = 3000;
    } else {
      return new Response(JSON.stringify({ error: 'Invalid action. Use "structure", "rewrite-section", "generate-intro", "generate-conclusion", or "enrich-article"' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const resp = await fetch(`${GEMINI_URL}?key=${geminiApiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: maxTokens, temperature: 0.4 },
      }),
    });
    if (!resp.ok) throw new Error(`Gemini API error ${resp.status}`);
    const data = await resp.json();
    const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';

    if (action === 'rewrite-section') {
      const cleaned = raw.replace(/```html\n?/g, '').replace(/```\n?/g, '').trim();
      return new Response(JSON.stringify({ result: cleaned, changes: ['Section rewritten for improved clarity'] }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'generate-intro') {
      const cleaned = raw.replace(/```html\n?/g, '').replace(/```\n?/g, '').trim();
      return new Response(JSON.stringify({ result: cleaned, applyMode: 'insert_before_first_heading' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'generate-conclusion') {
      const cleaned = raw.replace(/```html\n?/g, '').replace(/```\n?/g, '').trim();
      return new Response(JSON.stringify({ result: cleaned, applyMode: 'append_content' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'enrich-article') {
      const cleanedJson = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      let enrichParsed: { result: string; wordCount: number; changes: string[] };
      try {
        enrichParsed = JSON.parse(cleanedJson);
      } catch {
        // Fallback: treat raw as HTML content
        const cleanedHtml = raw.replace(/```html\n?/g, '').replace(/```\n?/g, '').trim();
        enrichParsed = { result: cleanedHtml, wordCount: 0, changes: ['Content enriched'] };
      }
      if (!enrichParsed.result) enrichParsed.result = '';
      if (!Array.isArray(enrichParsed.changes)) enrichParsed.changes = [];
      // Calculate word count if not provided
      if (!enrichParsed.wordCount) {
        enrichParsed.wordCount = enrichParsed.result.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(w => w.length > 0).length;
      }
      return new Response(JSON.stringify(enrichParsed), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // structure action
    let parsed: { result: string; changes: string[]; proposedOutline?: string[]; missingSections?: string[]; suggestedInsertions?: any[] };
    try {
      const cleanedJson = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      parsed = JSON.parse(cleanedJson);
    } catch {
      parsed = { result: raw, changes: [], proposedOutline: [], missingSections: [], suggestedInsertions: [] };
    }

    // Ensure arrays
    if (!Array.isArray(parsed.proposedOutline)) parsed.proposedOutline = [];
    if (!Array.isArray(parsed.missingSections)) parsed.missingSections = [];
    if (!Array.isArray(parsed.changes)) parsed.changes = [];
    if (!Array.isArray(parsed.suggestedInsertions)) parsed.suggestedInsertions = [];

    return new Response(JSON.stringify(parsed), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    console.error('improve-blog-content error:', err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
