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

    const { topic, category, tags, targetWordCount } = await req.json();
    if (!topic || typeof topic !== 'string') {
      return new Response(JSON.stringify({ error: 'topic is required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const wordTarget = Math.min(Math.max(Number(targetWordCount) || 1500, 800), 3000);
    const tagsList = Array.isArray(tags) && tags.length > 0 ? tags.join(', ') : '';

    const prompt = `You are a professional content writer for TrueJobs.co.in, an Indian government job portal and career advice website.

Write a complete, SEO-optimized blog article on the following topic:
Topic: ${topic}
${category ? `Category: ${category}` : ''}
${tagsList ? `Tags: ${tagsList}` : ''}
Target word count: ~${wordTarget} words

REQUIREMENTS:
1. Write in Hindi or English — match the language of the topic
2. Use proper HTML structure: H1 for title, H2/H3 for sections, <p> for paragraphs, <ul>/<ol> for lists, <table> for tabular data
3. Include 5-8 H2 sections covering the topic comprehensively
4. Include an introduction paragraph before the first H2
5. Include a conclusion section at the end
6. Include 3-5 FAQ items at the end as an H2 "Frequently Asked Questions" section with proper Q&A format
7. Maintain an informational, non-official tone — TrueJobs is NOT a government body
8. Do NOT make fabricated claims about specific dates, vacancies, or results unless the topic explicitly provides them
9. Do NOT include keyword stuffing or spammy content
10. Do NOT include affiliate links or promotional content
11. Use factual, helpful, actionable information
12. Include relevant internal link placeholders like [Link: /sarkari-result] or [Link: /admit-card] where appropriate

Return a JSON object with these fields:
- title: article H1 title (compelling, SEO-friendly, under 80 chars)
- slug: URL-friendly slug (lowercase, hyphens, no trailing hyphens)
- content: the full article HTML (do NOT include the H1 title in content — it's stored separately)
- metaTitle: SEO meta title under 60 characters
- metaDescription: SEO meta description, 140-155 characters
- excerpt: 1-2 sentence summary for listings
- category: suggested category (use provided category if given, or suggest one from: Career Advice, Government Jobs, Exam Preparation, Results & Cutoffs, Admit Cards, Syllabus, Current Affairs)
- tags: array of 3-6 relevant tags

Format: {"title": "...", "slug": "...", "content": "...", "metaTitle": "...", "metaDescription": "...", "excerpt": "...", "category": "...", "tags": [...]}
No markdown code blocks. Return ONLY the JSON object.`;

    const resp = await fetch(`${GEMINI_URL}?key=${geminiApiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 16000, temperature: 0.5 },
      }),
    });
    if (!resp.ok) throw new Error(`Gemini API error ${resp.status}`);
    const data = await resp.json();
    const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    let parsed: any;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      return new Response(JSON.stringify({ error: 'Failed to parse AI response', raw: cleaned.substring(0, 500) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Validate required fields
    if (!parsed.title || !parsed.content) {
      return new Response(JSON.stringify({ error: 'AI response missing title or content' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Normalize slug
    const slug = (parsed.slug || parsed.title)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      .substring(0, 120);

    return new Response(JSON.stringify({
      title: parsed.title,
      slug,
      content: parsed.content,
      metaTitle: parsed.metaTitle || parsed.title.substring(0, 60),
      metaDescription: parsed.metaDescription || '',
      excerpt: parsed.excerpt || '',
      category: parsed.category || category || 'Career Advice',
      tags: Array.isArray(parsed.tags) ? parsed.tags : [],
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    console.error('generate-blog-article error:', err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
