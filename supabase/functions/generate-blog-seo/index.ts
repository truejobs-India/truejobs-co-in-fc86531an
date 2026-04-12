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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authResult = await verifyAdmin(req);
    if (authResult instanceof Response) return authResult;

    const body = await req.json();

    // ── AI model dispatcher — strict routing, no fallback ──
    const aiModel = body.aiModel;
    async function callSelectedAI(prompt: string): Promise<string> {
      const model = aiModel;
      if (!model) throw new Error('aiModel parameter is required. No fallback allowed.');
      console.log(`[generate-blog-seo] Using model: ${model}`);
      switch (model) {
        case 'sarvam-30b': case 'sarvam-105b': {
          const { callSarvamChat } = await import('../_shared/sarvam.ts');
          return callSarvamChat(prompt, { model: 'sarvam-m', maxTokens: 500, temperature: 0.3 });
        }
        case 'azure-gpt5-mini': {
          const { callAzureGPT5Mini } = await import('../_shared/azure-openai.ts');
          return callAzureGPT5Mini(prompt, { maxTokens: 500, temperature: 0.3 });
        }
        case 'azure-gpt41-mini': {
          const { callAzureGPT41Mini } = await import('../_shared/azure-openai.ts');
          return callAzureGPT41Mini(prompt, { maxTokens: 500, temperature: 0.3 });
        }
        case 'azure-gpt4o-mini': {
          const { callAzureOpenAI } = await import('../_shared/azure-openai.ts');
          return callAzureOpenAI(prompt, { maxTokens: 500, temperature: 0.3 });
        }
        case 'azure-deepseek-v3': {
          const { callAzureDeepSeek } = await import('../_shared/azure-deepseek.ts');
          return callAzureDeepSeek(prompt, { maxTokens: 500, temperature: 0.3 });
        }
        case 'azure-deepseek-r1': {
          const { callAzureDeepSeek } = await import('../_shared/azure-deepseek.ts');
          return callAzureDeepSeek(prompt, { model: 'DeepSeek-R1', maxTokens: 500, temperature: 0.3 });
        }
        case 'vertex-flash': case 'gemini-flash': case 'gemini': {
          const { callVertexGemini } = await import('../_shared/vertex-ai.ts');
          return callVertexGemini('gemini-2.5-flash', prompt, 60_000, { maxOutputTokens: 500, temperature: 0.3 });
        }
        case 'vertex-pro': case 'gemini-pro': {
          const { callVertexGemini } = await import('../_shared/vertex-ai.ts');
          return callVertexGemini('gemini-2.5-pro', prompt, 120_000, { maxOutputTokens: 500, temperature: 0.3 });
        }
        case 'vertex-3.1-pro': {
          const { callVertexGemini } = await import('../_shared/vertex-ai.ts');
          return callVertexGemini('gemini-3.1-pro-preview', prompt, 120_000, { maxOutputTokens: 500, temperature: 0.3 });
        }
        case 'vertex-3-flash': {
          const { callVertexGemini } = await import('../_shared/vertex-ai.ts');
          return callVertexGemini('gemini-3-flash-preview', prompt, 90_000, { maxOutputTokens: 500, temperature: 0.3 });
        }
        case 'vertex-3.1-flash-lite': {
          const { callVertexGemini } = await import('../_shared/vertex-ai.ts');
          return callVertexGemini('gemini-3.1-flash-lite-preview', prompt, 60_000, { maxOutputTokens: 500, temperature: 0.3 });
        }
        case 'lovable-gemini': {
          const apiKey = Deno.env.get('LOVABLE_API_KEY');
          if (!apiKey) throw new Error('LOVABLE_API_KEY not configured');
          const resp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
            method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: 'google/gemini-2.5-flash', messages: [{ role: 'user', content: prompt }], max_tokens: 500, temperature: 0.3 }),
          });
          if (!resp.ok) throw new Error(`Lovable AI error ${resp.status}`);
          return (await resp.json())?.choices?.[0]?.message?.content || '';
        }
        case 'gpt5': case 'gpt5-mini': case 'openai': {
          const apiKey = Deno.env.get('LOVABLE_API_KEY');
          if (!apiKey) throw new Error('LOVABLE_API_KEY not configured');
          const gwModel = model === 'gpt5-mini' ? 'openai/gpt-5-mini' : 'openai/gpt-5';
          const resp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
            method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: gwModel, messages: [{ role: 'user', content: prompt }], max_tokens: 500, temperature: 0.3 }),
          });
          if (!resp.ok) throw new Error(`Lovable AI error ${resp.status}`);
          return (await resp.json())?.choices?.[0]?.message?.content || '';
        }
        case 'groq': {
          const apiKey = Deno.env.get('GROQ_API_KEY');
          if (!apiKey) throw new Error('GROQ_API_KEY not configured');
          const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: 'llama-3.3-70b-versatile', messages: [{ role: 'user', content: prompt }], max_tokens: 500, temperature: 0.3 }),
          });
          if (!resp.ok) throw new Error(`Groq API error ${resp.status}`);
          return (await resp.json())?.choices?.[0]?.message?.content || '';
        }
        case 'claude-sonnet': case 'claude': {
          const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
          if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured');
          const resp = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
            body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 500, messages: [{ role: 'user', content: prompt }] }),
          });
          if (!resp.ok) throw new Error(`Anthropic API error ${resp.status}`);
          return (await resp.json())?.content?.[0]?.text || '';
        }
        case 'nova-pro': case 'nova-premier': case 'nemotron-120b': case 'mistral': {
          const { callBedrockNova } = await import('../_shared/bedrock-nova.ts');
          return callBedrockNova(model === 'mistral' ? 'mistral' : model, prompt, { maxTokens: 500, temperature: 0.3 });
        }
        default:
          throw new Error(`Unsupported AI model: "${model}". No fallback allowed.`);
      }
    }

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
            let result = await callSelectedAI(prompt);
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
      let generated = await callSelectedAI(prompt);
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
