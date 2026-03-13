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
      generationConfig: { maxOutputTokens: 2000, temperature: 0.4 },
    }),
  });
  if (!resp.ok) throw new Error(`Gemini API error ${resp.status}`);
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

    const { title, content, existingFaqCount } = await req.json();
    if (!title || !content) {
      return new Response(JSON.stringify({ error: 'title and content required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const plainText = content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 3000);
    const existingNote = existingFaqCount && existingFaqCount > 0
      ? `\nIMPORTANT: The article already has ${existingFaqCount} FAQ items. Generate only NEW, non-duplicate questions that are different from what would logically already exist.`
      : '';

    const prompt = `You are an SEO content expert for TrueJobs.co.in, an Indian job portal.
Generate 5 FAQ items for this blog article that would qualify for Google FAQ rich snippets.${existingNote}

Requirements:
- Each question should be a genuine user query related to the article topic
- Answers should be concise (2-3 sentences each)
- Write in the same language as the title (Hindi transliterated to English or English)
- Questions should cover different aspects of the topic
- Format as JSON array: [{"question": "...", "answer": "..."}]

Title: ${title}
Article excerpt: ${plainText}

Return ONLY the JSON array, no markdown formatting, no code blocks.`;

    let raw = await callGemini(geminiApiKey, prompt);
    raw = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    let faqs: { question: string; answer: string }[];
    try {
      faqs = JSON.parse(raw);
      if (!Array.isArray(faqs)) throw new Error('Not an array');
    } catch {
      faqs = [];
    }

    // Build FAQ HTML
    const faqHtml = faqs.length > 0
      ? `<h2>Frequently Asked Questions (FAQ)</h2>\n${faqs.map(f => `<h3>${f.question}</h3>\n<p>${f.answer}</p>`).join('\n')}`
      : '';

    return new Response(JSON.stringify({ faqs, faqHtml }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    console.error('generate-blog-faq error:', err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
