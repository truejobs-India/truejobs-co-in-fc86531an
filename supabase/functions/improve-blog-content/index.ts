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

    const { title, content, action, selectedHtml, headings, hasIntro, hasConclusion, wordCount, category, tags } = await req.json();
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

Format: {"result": "...", "changes": ["...", "..."], "proposedOutline": ["...", "..."], "missingSections": ["...", "..."]}
No markdown code blocks.`;
      maxTokens = 2500;
    } else {
      return new Response(JSON.stringify({ error: 'Invalid action. Use "structure" or "rewrite-section"' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
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

    // structure action
    let parsed: { result: string; changes: string[]; proposedOutline?: string[]; missingSections?: string[] };
    try {
      const cleanedJson = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      parsed = JSON.parse(cleanedJson);
    } catch {
      parsed = { result: raw, changes: [], proposedOutline: [], missingSections: [] };
    }

    // Ensure arrays
    if (!Array.isArray(parsed.proposedOutline)) parsed.proposedOutline = [];
    if (!Array.isArray(parsed.missingSections)) parsed.missingSections = [];
    if (!Array.isArray(parsed.changes)) parsed.changes = [];

    return new Response(JSON.stringify(parsed), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    console.error('improve-blog-content error:', err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
