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

// ═══════════════════════════════════════════════════════════════
// AI Model Providers (same as generate-blog-article)
// ═══════════════════════════════════════════════════════════════

// Removed: local callGemini using GEMINI_API_KEY + generativelanguage.googleapis.com
// Now handled inline in callAI dispatcher via callVertexGemini

async function callLovableGemini(prompt: string): Promise<string> {
  const apiKey = Deno.env.get('LOVABLE_API_KEY');
  if (!apiKey) throw new Error('LOVABLE_API_KEY not configured');
  const resp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 4000,
      temperature: 0.4,
    }),
  });
  if (!resp.ok) {
    if (resp.status === 429) throw new Error('Rate limit exceeded on Lovable AI.');
    if (resp.status === 402) throw new Error('Lovable AI credits exhausted.');
    throw new Error(`Lovable AI error ${resp.status}`);
  }
  const data = await resp.json();
  return data?.choices?.[0]?.message?.content || '';
}

async function callOpenAI(prompt: string): Promise<string> {
  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) throw new Error('OPENAI_API_KEY not configured');
  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 4000,
      temperature: 0.4,
    }),
  });
  if (!resp.ok) throw new Error(`OpenAI API error ${resp.status}`);
  const data = await resp.json();
  return data?.choices?.[0]?.message?.content || '';
}

async function callGroq(prompt: string): Promise<string> {
  const apiKey = Deno.env.get('GROQ_API_KEY');
  if (!apiKey) throw new Error('GROQ_API_KEY not configured');
  const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 4000,
      temperature: 0.4,
    }),
  });
  if (!resp.ok) throw new Error(`Groq API error ${resp.status}`);
  const data = await resp.json();
  return data?.choices?.[0]?.message?.content || '';
}

// ── AWS Sig V4 helpers ──
async function hmacSha256B(key: ArrayBuffer | Uint8Array, data: string): Promise<ArrayBuffer> {
  const enc = new TextEncoder();
  const ck = await crypto.subtle.importKey('raw', key instanceof Uint8Array ? key : new Uint8Array(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return crypto.subtle.sign('HMAC', ck, enc.encode(data));
}
async function sha256Hex(data: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}
async function awsSigV4Fetch(host: string, rawPath: string, body: string, region: string, service: string): Promise<Response> {
  const ak = Deno.env.get('AWS_ACCESS_KEY_ID');
  const sk = Deno.env.get('AWS_SECRET_ACCESS_KEY');
  if (!ak || !sk) throw new Error('AWS credentials not configured (AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY)');
  const encodedUri = '/' + rawPath.split('/').filter(Boolean).map(s => encodeURIComponent(s)).join('/');
  const canonicalUri = '/' + rawPath.split('/').filter(Boolean).map(s => encodeURIComponent(encodeURIComponent(s))).join('/');
  const now = new Date();
  const dateStamp = now.toISOString().replace(/[:-]|\.\d{3}/g, '').slice(0, 8);
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '').slice(0, 15) + 'Z';
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const payloadHash = await sha256Hex(body);
  const canonicalHeaders = `content-type:application/json\nhost:${host}\nx-amz-date:${amzDate}\n`;
  const signedHeaders = 'content-type;host;x-amz-date';
  const canonicalRequest = `POST\n${canonicalUri}\n\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;
  const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${credentialScope}\n${await sha256Hex(canonicalRequest)}`;
  const enc = new TextEncoder();
  let sigKey = await hmacSha256B(enc.encode(`AWS4${sk}`), dateStamp);
  sigKey = await hmacSha256B(sigKey, region);
  sigKey = await hmacSha256B(sigKey, service);
  sigKey = await hmacSha256B(sigKey, 'aws4_request');
  const sig = Array.from(new Uint8Array(await hmacSha256B(sigKey, stringToSign))).map(b => b.toString(16).padStart(2, '0')).join('');
  return fetch(`https://${host}${encodedUri}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Amz-Date': amzDate, Authorization: `AWS4-HMAC-SHA256 Credential=${ak}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${sig}` },
    body,
  });
}

async function callClaude(prompt: string): Promise<string> {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured');
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      temperature: 0.4,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!resp.ok) throw new Error(`Anthropic API error ${resp.status}: ${await resp.text()}`);
  const data = await resp.json();
  return data?.content?.[0]?.text || '';
}

async function callMistral(prompt: string): Promise<string> {
  const modelId = 'mistral.mistral-large-2407-v1:0';
  const region = 'us-west-2';
  const host = `bedrock-runtime.${region}.amazonaws.com`;
  const body = JSON.stringify({ messages: [{ role: 'user', content: [{ text: prompt }] }], inferenceConfig: { maxTokens: 8192, temperature: 0.4 } });
  const resp = await awsSigV4Fetch(host, `/model/${modelId}/converse`, body, region, 'bedrock');
  if (!resp.ok) throw new Error(`Mistral Bedrock ${resp.status}: ${await resp.text()}`);
  const data = await resp.json();
  return data?.output?.message?.content?.[0]?.text || '';
}

async function callAI(model: string, prompt: string): Promise<string> {
  console.log(`[generate-blog-faq] model_requested=${model}`);
  switch (model) {
    case 'gemini': case 'gemini-flash': {
      const { callVertexGemini } = await import('../_shared/vertex-ai.ts');
      return callVertexGemini('gemini-2.5-flash', prompt, 60_000, { maxOutputTokens: 4000, temperature: 0.4 });
    }
    case 'lovable-gemini': return callLovableGemini(prompt);
    case 'openai': case 'gpt5': case 'gpt5-mini': return callOpenAI(prompt);
    case 'groq': return callGroq(prompt);
    case 'claude-sonnet': case 'claude': return callClaude(prompt);
    case 'mistral': return callMistral(prompt);
    case 'vertex-flash':
      return import('../_shared/vertex-ai.ts').then(m => m.callVertexGemini('gemini-2.5-flash', prompt, 60_000));
    case 'vertex-pro':
      return import('../_shared/vertex-ai.ts').then(m => m.callVertexGemini('gemini-2.5-pro', prompt, 120_000));
    case 'vertex-3.1-pro':
      return import('../_shared/vertex-ai.ts').then(m => m.callVertexGemini('gemini-3.1-pro-preview', prompt, 120_000));
    case 'vertex-3-flash':
      return import('../_shared/vertex-ai.ts').then(m => m.callVertexGemini('gemini-3-flash-preview', prompt, 90_000));
    case 'vertex-3.1-flash-lite':
      return import('../_shared/vertex-ai.ts').then(m => m.callVertexGemini('gemini-3.1-flash-lite-preview', prompt, 60_000));
    case 'nova-pro': case 'nova-premier': case 'nemotron-120b':
      return import('../_shared/bedrock-nova.ts').then(m => m.callBedrockNova(model, prompt, { maxTokens: 8192, temperature: 0.4 }));
    case 'azure-gpt4o-mini':
      return import('../_shared/azure-openai.ts').then(m => m.callAzureOpenAI(prompt, { maxTokens: 4096, temperature: 0.4 }));
    case 'azure-gpt41-mini':
      return import('../_shared/azure-openai.ts').then(m => m.callAzureGPT41Mini(prompt, { maxTokens: 4096, temperature: 0.4 }));
    case 'azure-gpt5-mini':
      return import('../_shared/azure-openai.ts').then(m => m.callAzureGPT5Mini(prompt, { maxTokens: 4096, temperature: 0.4 }));
    case 'azure-deepseek-v3':
      return import('../_shared/azure-deepseek.ts').then(m => m.callAzureDeepSeek(prompt, { maxTokens: 4096, temperature: 0.4 }));
    case 'azure-deepseek-r1':
      return import('../_shared/azure-deepseek.ts').then(m => m.callAzureDeepSeek(prompt, { model: 'DeepSeek-R1', maxTokens: 4096, temperature: 0.4 }));
    case 'sarvam-30b': {
      const { callSarvamChat } = await import('../_shared/sarvam.ts');
      return callSarvamChat(prompt, { model: 'sarvam-30b', maxTokens: 4000, temperature: 0.4 });
    }
    case 'sarvam-105b': {
      const { callSarvamChat } = await import('../_shared/sarvam.ts');
      return callSarvamChat(prompt, { model: 'sarvam-105b', maxTokens: 4000, temperature: 0.4 });
    }
    default:
      throw new Error(`Unsupported AI model: "${model}". No fallback allowed.`);
  }
}

// ═══════════════════════════════════════════════════════════════

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authResult = await verifyAdmin(req);
    if (authResult instanceof Response) return authResult;

    const { title, content, existingFaqCount, category, tags, slug, aiModel } = await req.json();
    if (!title || !content) {
      return new Response(JSON.stringify({ error: 'title and content required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const plainText = content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 3000);
    const existingNote = existingFaqCount && existingFaqCount > 0
      ? `\nIMPORTANT: The article already has ${existingFaqCount} FAQ items. Generate only NEW, non-duplicate questions that are different from what would logically already exist.`
      : '';

    const prompt = `You are an SEO content expert for TrueJobs.co.in, an Indian government job portal.
Generate 5 FAQ items for this blog article that would qualify for Google FAQ rich snippets.${existingNote}

Requirements:
- Each question should be a genuine user query related to the article topic
- Answers should be concise (2-3 sentences each)
- Write in the same language as the title (Hindi transliterated to English or English)
- Questions should cover different aspects of the topic
- Focus on practical information seekers need: eligibility, dates, process, documents
- Maintain informational, non-official tone
- Format as JSON array: [{"question": "...", "answer": "..."}]

Title: ${title}
Slug: ${slug || 'unknown'}
Category: ${category || 'General'}
Tags: ${(tags || []).join(', ') || 'none'}
Article excerpt: ${plainText}

Return ONLY the JSON array, no markdown formatting, no code blocks.`;

    const useModel = aiModel || 'gemini';
    console.log(`[generate-blog-faq] Using model: ${useModel}`);
    let raw = await callAI(useModel, prompt);
    raw = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    let faqs: { question: string; answer: string }[];
    try {
      faqs = JSON.parse(raw);
      if (!Array.isArray(faqs)) throw new Error('Not an array');
    } catch {
      faqs = [];
    }

    const faqHtml = faqs.length > 0
      ? `<h2>Frequently Asked Questions (FAQ)</h2>\n${faqs.map(f => `<h3>${f.question}</h3>\n<p>${f.answer}</p>`).join('\n')}`
      : '';

    return new Response(JSON.stringify({ faqs, faqHtml }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    console.error('generate-blog-faq error:', err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
