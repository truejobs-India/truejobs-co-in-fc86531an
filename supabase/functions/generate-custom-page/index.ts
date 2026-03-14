/**
 * generate-custom-page — AI-powered custom SEO page generation.
 * Supports: generate (full page from topic), improve (fix/optimize existing), bulk (multiple topics).
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// ═══════════════════════════════════════════════════════════════
// AI MODEL DISPATCHER
// ═══════════════════════════════════════════════════════════════

async function callGemini(prompt: string, timeout = 60_000): Promise<string> {
  const apiKey = Deno.env.get('GEMINI_API_KEY');
  if (!apiKey) throw new Error('GEMINI_API_KEY not configured');
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.6, maxOutputTokens: 8192 },
      }),
      signal: controller.signal,
    });
    if (!resp.ok) throw new Error(`Gemini error: ${resp.status}`);
    const data = await resp.json();
    return data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  } finally { clearTimeout(timer); }
}

async function callGroq(prompt: string): Promise<string> {
  const apiKey = Deno.env.get('GROQ_API_KEY');
  if (!apiKey) throw new Error('GROQ_API_KEY not configured');
  const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'llama-3.3-70b-versatile', messages: [{ role: 'user', content: prompt }], temperature: 0.6, max_tokens: 8192 }),
  });
  if (!resp.ok) throw new Error(`Groq error: ${resp.status}`);
  const data = await resp.json();
  return data?.choices?.[0]?.message?.content || '';
}

async function callMistral(prompt: string): Promise<string> {
  const region = Deno.env.get('AWS_REGION') || 'us-west-2';
  const accessKey = Deno.env.get('AWS_ACCESS_KEY_ID');
  const secretKey = Deno.env.get('AWS_SECRET_ACCESS_KEY');
  if (!accessKey || !secretKey) throw new Error('AWS credentials not configured');
  // Use Lovable Gemini as fallback for simplicity
  return callLovableGemini(prompt);
}

async function callClaude(prompt: string): Promise<string> {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured');
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 8192, messages: [{ role: 'user', content: prompt }] }),
  });
  if (!resp.ok) throw new Error(`Claude error: ${resp.status}`);
  const data = await resp.json();
  return data?.content?.[0]?.text || '';
}

async function callLovableGemini(prompt: string): Promise<string> {
  const apiKey = Deno.env.get('LOVABLE_API_KEY');
  if (!apiKey) throw new Error('LOVABLE_API_KEY not configured');
  const resp = await fetch('https://api.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'google/gemini-2.5-flash', messages: [{ role: 'user', content: prompt }], temperature: 0.6, max_tokens: 8192 }),
  });
  if (!resp.ok) throw new Error(`Lovable Gemini error: ${resp.status}`);
  const data = await resp.json();
  return data?.choices?.[0]?.message?.content || '';
}

async function callOpenAI(prompt: string): Promise<string> {
  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) throw new Error('OPENAI_API_KEY not configured');
  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'gpt-4o', messages: [{ role: 'user', content: prompt }], temperature: 0.6, max_tokens: 8192 }),
  });
  if (!resp.ok) throw new Error(`OpenAI error: ${resp.status}`);
  const data = await resp.json();
  return data?.choices?.[0]?.message?.content || '';
}

async function callVertexFlash(prompt: string): Promise<string> {
  const { callVertexGemini } = await import('../_shared/vertex-ai.ts');
  return callVertexGemini('gemini-2.5-flash', prompt, 60_000);
}

async function callVertexPro(prompt: string): Promise<string> {
  const { callVertexGemini } = await import('../_shared/vertex-ai.ts');
  return callVertexGemini('gemini-2.5-pro', prompt, 120_000);
}

async function callAI(model: string, prompt: string): Promise<string> {
  switch (model) {
    case 'gemini': case 'gemini-flash': return callGemini(prompt);
    case 'groq': return callGroq(prompt);
    case 'claude': case 'claude-sonnet': return callClaude(prompt);
    case 'mistral': return callMistral(prompt);
    case 'lovable-gemini': return callLovableGemini(prompt);
    case 'openai': case 'gpt5': return callOpenAI(prompt);
    case 'vertex-flash': return callVertexFlash(prompt);
    case 'vertex-pro': return callVertexPro(prompt);
    default: return callGemini(prompt);
  }
}

// ═══════════════════════════════════════════════════════════════
// PROMPTS
// ═══════════════════════════════════════════════════════════════

function generatePagePrompt(topic: string, pageType: string, category: string, tags: string[]): string {
  return `You are an expert SEO content writer for TrueJobs.co.in, a leading Indian government job portal.

Generate a complete, SEO-optimized ${pageType} page about: "${topic}"
${category ? `Category: ${category}` : ''}
${tags.length > 0 ? `Tags: ${tags.join(', ')}` : ''}

Return a JSON object with these exact fields:
{
  "title": "SEO-friendly title (50-60 chars)",
  "slug": "url-friendly-slug-with-hyphens",
  "meta_title": "Meta title with primary keyword (≤60 chars)",
  "meta_description": "Compelling meta description with CTA (≤160 chars)",
  "excerpt": "2-3 sentence summary for cards/previews",
  "content": "Full HTML content (1500-2500 words). Use <h2>, <h3>, <p>, <ul>, <ol>, <table> tags. Include practical information, eligibility, process steps, tips. Make it comprehensive and E-E-A-T compliant.",
  "faq_items": [{"question": "...", "answer": "..."}, ...] (5-8 FAQ items for rich snippets),
  "suggested_tags": ["tag1", "tag2", ...],
  "suggested_category": "Best fitting category",
  "word_count": estimated word count (number)
}

Rules:
- Content must be original, factual, and useful for Indian job seekers
- Use proper HTML structure with headers, lists, and tables where appropriate
- Include internal linking opportunities (mention related exams/jobs)
- Write in a professional but accessible tone
- Optimize for featured snippets and People Also Ask
- Do NOT use markdown in content field — use HTML only
- Return ONLY valid JSON, no markdown fences`;
}

function improvePagePrompt(title: string, content: string, metaTitle: string, metaDesc: string): string {
  return `You are an expert SEO auditor for TrueJobs.co.in, an Indian government job portal.

Review and improve this page:

Title: ${title}
Meta Title: ${metaTitle || 'NOT SET'}
Meta Description: ${metaDesc || 'NOT SET'}

Current Content (first 3000 chars):
${content.substring(0, 3000)}

Return a JSON object with improvements:
{
  "meta_title": "Improved meta title (≤60 chars)",
  "meta_description": "Improved meta description (≤160 chars)",
  "excerpt": "Improved excerpt",
  "content_suggestions": ["suggestion 1", "suggestion 2", ...],
  "missing_sections": ["section that should be added", ...],
  "seo_score": 1-100 (estimated SEO quality),
  "issues": ["issue 1", "issue 2", ...],
  "improved_faq_items": [{"question": "...", "answer": "..."}, ...],
  "suggested_tags": ["tag1", ...],
  "suggested_category": "category"
}

Return ONLY valid JSON, no markdown fences.`;
}

// ═══════════════════════════════════════════════════════════════
// AUTH
// ═══════════════════════════════════════════════════════════════

async function verifyAdmin(req: Request) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return new Response(JSON.stringify({ error: 'Missing auth' }), { status: 401, headers: corsHeaders });

  const supabase = createClient(supabaseUrl, serviceKey);
  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return new Response(JSON.stringify({ error: 'Invalid token' }), { status: 401, headers: corsHeaders });

  const { data: roles } = await supabase.from('user_roles').select('role').eq('user_id', user.id);
  if (!roles?.some(r => r.role === 'admin')) {
    return new Response(JSON.stringify({ error: 'Admin only' }), { status: 403, headers: corsHeaders });
  }
  return user;
}

// ═══════════════════════════════════════════════════════════════
// HANDLER
// ═══════════════════════════════════════════════════════════════

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authResult = await verifyAdmin(req);
    if (authResult instanceof Response) return authResult;

    const { action, topic, pageType, category, tags, title, content, metaTitle, metaDescription, aiModel, topics } = await req.json();
    const model = aiModel || 'gemini-flash';

    if (action === 'generate') {
      if (!topic) return new Response(JSON.stringify({ error: 'topic required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

      const prompt = generatePagePrompt(topic, pageType || 'landing', category || '', tags || []);
      const raw = await callAI(model, prompt);
      const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      
      let parsed;
      try { parsed = JSON.parse(cleaned); } catch { 
        // Try to extract JSON from response
        const match = cleaned.match(/\{[\s\S]*\}/);
        if (match) parsed = JSON.parse(match[0]);
        else throw new Error('Failed to parse AI response as JSON');
      }

      return new Response(JSON.stringify({ success: true, data: parsed, model, action }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'improve') {
      if (!title || !content) return new Response(JSON.stringify({ error: 'title and content required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

      const prompt = improvePagePrompt(title, content, metaTitle || '', metaDescription || '');
      const raw = await callAI(model, prompt);
      const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      
      let parsed;
      try { parsed = JSON.parse(cleaned); } catch {
        const match = cleaned.match(/\{[\s\S]*\}/);
        if (match) parsed = JSON.parse(match[0]);
        else throw new Error('Failed to parse AI response');
      }

      return new Response(JSON.stringify({ success: true, data: parsed, model, action }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Bulk just returns topics parsed — actual generation is done client-side per topic
    if (action === 'validate-bulk') {
      const topicList = (topics || '').split('\n').map((t: string) => t.trim()).filter(Boolean);
      return new Response(JSON.stringify({ success: true, data: { topics: topicList, count: topicList.length } }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e: any) {
    console.error('[generate-custom-page]', e);
    return new Response(JSON.stringify({ success: false, error: e.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
