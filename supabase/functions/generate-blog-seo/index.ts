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

async function callGemini(apiKey: string, prompt: string): Promise<string> {
  const resp = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 500, temperature: 0.3 },
    }),
  });
  if (!resp.ok) {
    const errText = await resp.text().catch(() => '');
    throw new Error(`Gemini API error ${resp.status}: ${errText}`);
  }
  const data = await resp.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authResult = await verifyAdmin(req);
    if (authResult instanceof Response) return authResult;

    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiApiKey) {
      return new Response(JSON.stringify({ error: 'GEMINI_API_KEY not configured' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const body = await req.json();

    // Bulk mode: { articles: [...], fields: [...] }
    if (body.articles && Array.isArray(body.articles)) {
      const fields = body.fields || ['metaDescription'];
      const results: Record<string, Record<string, string>> = {};

      for (const article of body.articles) {
        const { id, title, content } = article;
        const plainText = (content || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 500);
        results[id] = {};

        for (const field of fields) {
          try {
            const prompt = buildPrompt(field, title, plainText);
            let result = await callGemini(geminiApiKey, prompt);
            result = cleanResult(field, result);
            results[id][field] = result;
          } catch (err) {
            console.error(`Failed ${field} for ${id}:`, err);
          }
        }
      }

      return new Response(JSON.stringify({ results }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Single mode: { title, content, fields: [...], slug?, category?, tags? }
    const { title, content, fields, slug, category, tags } = body;
    if (!title || !fields || !Array.isArray(fields)) {
      return new Response(JSON.stringify({ error: 'title and fields[] required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const plainText = (content || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 1500);
    const result: Record<string, string> = {};
    const extraContext = [
      slug ? `Slug: ${slug}` : '',
      category ? `Category: ${category}` : '',
      tags?.length ? `Tags: ${tags.join(', ')}` : '',
    ].filter(Boolean).join('\n');

    for (const field of fields) {
      const prompt = buildPrompt(field, title, plainText, extraContext);
      let generated = await callGemini(geminiApiKey, prompt);
      generated = cleanResult(field, generated);
      result[field] = generated;
    }

    return new Response(JSON.stringify(result), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    console.error('generate-blog-seo error:', err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});

function buildPrompt(field: string, title: string, plainText: string, extraContext = ''): string {
  const contextBlock = extraContext ? `\n${extraContext}` : '';

  if (field === 'metaTitle') {
    return `You are an SEO expert for TrueJobs.co.in, an Indian government job portal.
Generate a meta title for this blog article. Requirements:
- MUST be under 60 characters (STRICT)
- Include the primary keyword from the title
- Write in the same language as the title
- Do NOT use quotes
- Optimize for Indian job seeker search intent
Title: ${title}${contextBlock}
Article excerpt: ${plainText}
Return ONLY the meta title text, nothing else.`;
  }
  if (field === 'metaDescription') {
    return `You are an SEO expert for TrueJobs.co.in, an Indian government job portal.
Generate a meta description for this blog article. Requirements:
- MUST be between 140 and 155 characters (STRICT LIMIT)
- Include the primary keyword from the title
- Include a call-to-action phrase relevant to job seekers
- Write in the same language as the title
- Do NOT use quotes
- Focus on what the reader will learn or gain
Title: ${title}${contextBlock}
Article excerpt: ${plainText}
Return ONLY the meta description text, nothing else.`;
  }
  if (field === 'excerpt') {
    return `You are a content editor for TrueJobs.co.in, an Indian government job portal.
Write a brief excerpt/summary (2-3 sentences, under 200 characters) for this blog article.
- Capture the main value proposition for job seekers
- Write in the same language as the title
- Do NOT use quotes
Title: ${title}${contextBlock}
Article excerpt: ${plainText}
Return ONLY the excerpt text, nothing else.`;
  }
  return `Summarize this article titled "${title}" in one paragraph. Content: ${plainText}`;
}

function cleanResult(field: string, raw: string): string {
  let result = raw.replace(/^["']|["']$/g, '').trim();
  if (field === 'metaTitle' && result.length > 60) {
    result = result.substring(0, 57) + '...';
  }
  if (field === 'metaDescription') {
    result = result.replace(/^meta\s*description\s*[:：]\s*/i, '').trim();
    if (result.length > 155) {
      result = result.substring(0, 155);
      const lastSpace = result.lastIndexOf(' ');
      if (lastSpace > 120) result = result.substring(0, lastSpace);
    }
  }
  if (field === 'excerpt' && result.length > 200) {
    result = result.substring(0, 197) + '...';
  }
  return result;
}
