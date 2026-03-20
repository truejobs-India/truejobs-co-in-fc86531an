// Multi-model blog content improvement — supports Gemini, Mistral, Claude, OpenAI, Groq, Vertex
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

/** Lightweight markdown-to-HTML converter for AI output */
function markdownToHtml(md: string): string {
  let html = md;
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/(?:^|\n)((?:[ \t]*[\*\-] .+\n?)+)/g, (_: string, block: string) => {
    const items = block.trim().split('\n').map((line: string) => {
      const text = line.replace(/^[ \t]*[\*\-] /, '');
      return `<li>${text}</li>`;
    }).join('\n');
    return `\n<ul>\n${items}\n</ul>\n`;
  });
  html = html.replace(/(?:^|\n)((?:\d+\. .+\n?)+)/g, (_: string, block: string) => {
    const items = block.trim().split('\n').map((line: string) => {
      const text = line.replace(/^\d+\.\s*/, '');
      return `<li>${text}</li>`;
    }).join('\n');
    return `\n<ol>\n${items}\n</ol>\n`;
  });
  html = html.split('\n').map((line: string) => {
    const trimmed = line.trim();
    if (!trimmed) return '';
    if (/^<(?:h[1-6]|ul|ol|li|p|table|tr|td|th|div|section|blockquote|\/)/i.test(trimmed)) return line;
    return `<p>${trimmed}</p>`;
  }).join('\n');
  html = html.replace(/\n{3,}/g, '\n\n').trim();
  return html;
}

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
// AI Provider Implementations
// ═══════════════════════════════════════════════════════════════

// ── AWS SigV4 helpers (for Mistral via Bedrock) ──
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
    headers: {
      'Content-Type': 'application/json',
      'X-Amz-Date': amzDate,
      Authorization: `AWS4-HMAC-SHA256 Credential=${ak}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${sig}`,
    },
    body,
  });
}

// ── Gemini (direct API) — NO silent fallback ──
async function callGemini(prompt: string, maxTokens: number, geminiModel = 'gemini-2.5-flash'): Promise<string> {
  const apiKey = Deno.env.get('GEMINI_API_KEY');
  if (!apiKey) throw new Error('GEMINI_API_KEY not configured');

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${apiKey}`;
  const maxRetries = 3;
  let resp: Response | null = null;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: maxTokens, temperature: 0.4 },
      }),
    });
    if (resp.status === 429 && attempt < maxRetries - 1) {
      const backoffMs = (attempt + 1) * 5000;
      console.warn(`[improve-blog-content] Gemini 429, retrying in ${backoffMs}ms (attempt ${attempt + 1}/${maxRetries})`);
      await new Promise(r => setTimeout(r, backoffMs));
      continue;
    }
    break;
  }

  // If still 429 after retries — throw, NO silent fallback to Gateway
  if (resp && resp.status === 429) {
    throw new Error('GEMINI_RATE_LIMITED: Gemini API rate limit exceeded after retries. Please wait a moment and try again.');
  }

  if (!resp || !resp.ok) {
    const status = resp?.status || 500;
    throw new Error(`Gemini API error ${status}`);
  }
  const data = await resp.json();
  const finishReason = data?.candidates?.[0]?.finishReason || '';
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  return JSON.stringify({ __raw: text, __finishReason: finishReason });
}

// ── Mistral Large (AWS Bedrock — us-west-2) ──
async function callMistral(prompt: string, maxTokens: number): Promise<string> {
  const modelId = 'mistral.mistral-large-2407-v1:0';
  const region = 'us-west-2';
  const host = `bedrock-runtime.${region}.amazonaws.com`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 120_000);

  try {
    const body = JSON.stringify({
      messages: [{ role: 'user', content: [{ text: prompt }] }],
      inferenceConfig: { maxTokens: Math.min(maxTokens, 16384), temperature: 0.5 },
    });
    const resp = await awsSigV4Fetch(host, `/model/${modelId}/converse`, body, region, 'bedrock');
    clearTimeout(timeoutId);
    if (!resp.ok) throw new Error(`Mistral Bedrock ${resp.status}: ${await resp.text()}`);
    const data = await resp.json();
    const text = data?.output?.message?.content?.[0]?.text || '';
    return JSON.stringify({ __raw: text, __finishReason: data?.stopReason || 'end_turn' });
  } catch (err) {
    clearTimeout(timeoutId);
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error('Mistral timeout after 120 seconds');
    }
    throw err;
  }
}

// ── Claude Sonnet 4.6 (Anthropic Messages API) ──
async function callClaude(prompt: string, maxTokens: number): Promise<string> {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured');

  // Cap input to keep latency under the platform execution limit (Claude slows down on huge prompts).
  const cappedPrompt = prompt.length > 8_000
    ? prompt.substring(0, 8_000) + '\n\n[Content truncated for processing — work with the above portion.]'
    : prompt;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 120_000); // 120s — safe margin from 150s platform limit

  let resp: Response;
  try {
    resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        // Keep output budget conservative to reduce latency and avoid platform timeouts.
        max_tokens: Math.min(maxTokens, 4096),
        system: 'You are a professional content editor for TrueJobs.co.in, an Indian job portal. Follow the user instructions exactly. Output only what is requested — no preamble, no markdown code blocks. Be concise and avoid unnecessary verbosity.',
        messages: [{ role: 'user', content: cappedPrompt }],
      }),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timeoutId);
    if (err instanceof DOMException && err.name === 'AbortError') throw new Error('Claude API timeout after 120 seconds — try a shorter article, a smaller word target, or a faster model like Gemini Flash');
    throw err;
  }
  clearTimeout(timeoutId);

  if (!resp.ok) {
    const errBody = await resp.text().catch(() => 'unknown');
    if (resp.status === 429) throw new Error('Anthropic rate limit exceeded. Please wait and try again.');
    if (resp.status === 401) throw new Error('Anthropic API key is invalid or expired.');
    throw new Error(`Anthropic API error ${resp.status}: ${errBody.substring(0, 200)}`);
  }

  const data = await resp.json();
  const textBlocks = (data?.content || []).filter((b: any) => b.type === 'text');
  const text = textBlocks.map((b: any) => b.text).join('');
  if (!text.trim()) throw new Error('Anthropic returned empty text output');
  return JSON.stringify({ __raw: text, __finishReason: data?.stop_reason || 'end_turn' });
}

// ── OpenAI ──
async function callOpenAI(prompt: string, maxTokens: number): Promise<string> {
  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) throw new Error('OPENAI_API_KEY not configured');
  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'gpt-4o', messages: [{ role: 'user', content: prompt }], max_tokens: maxTokens, temperature: 0.4 }),
  });
  if (!resp.ok) throw new Error(`OpenAI API error ${resp.status}`);
  const data = await resp.json();
  const text = data?.choices?.[0]?.message?.content || '';
  return JSON.stringify({ __raw: text, __finishReason: data?.choices?.[0]?.finish_reason || 'stop' });
}

// ── Groq ──
async function callGroq(prompt: string, maxTokens: number): Promise<string> {
  const apiKey = Deno.env.get('GROQ_API_KEY');
  if (!apiKey) throw new Error('GROQ_API_KEY not configured');
  const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'llama-3.3-70b-versatile', messages: [{ role: 'user', content: prompt }], max_tokens: maxTokens, temperature: 0.4 }),
  });
  if (!resp.ok) throw new Error(`Groq API error ${resp.status}`);
  const data = await resp.json();
  const text = data?.choices?.[0]?.message?.content || '';
  return JSON.stringify({ __raw: text, __finishReason: data?.choices?.[0]?.finish_reason || 'stop' });
}

// ── Lovable Gemini (gateway) ──
async function callLovableGemini(prompt: string, maxTokens: number): Promise<string> {
  const apiKey = Deno.env.get('LOVABLE_API_KEY');
  if (!apiKey) throw new Error('LOVABLE_API_KEY not configured');
  const resp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'google/gemini-2.5-flash', messages: [{ role: 'user', content: prompt }], max_tokens: maxTokens, temperature: 0.4 }),
  });
  if (!resp.ok) {
    if (resp.status === 429) throw new Error('Rate limit exceeded on Lovable AI. Try again later.');
    if (resp.status === 402) throw new Error('Lovable AI credits exhausted.');
    throw new Error(`Lovable AI error ${resp.status}`);
  }
  const data = await resp.json();
  const text = data?.choices?.[0]?.message?.content || '';
  return JSON.stringify({ __raw: text, __finishReason: data?.choices?.[0]?.finish_reason || 'stop' });
}

// ═══════════════════════════════════════════════════════════════
// Unified dispatcher — NO silent fallback
// ═══════════════════════════════════════════════════════════════

const SUPPORTED_MODELS = ['gemini', 'gemini-flash', 'gemini-pro', 'mistral', 'claude-sonnet', 'claude', 'openai', 'gpt5', 'gpt5-mini', 'groq', 'lovable-gemini', 'vertex-flash', 'vertex-pro', 'nova-pro', 'nova-premier'];

async function callAI(aiModel: string, prompt: string, maxTokens: number): Promise<{ raw: string; finishReason: string; actualProvider: string; actualModelId: string }> {
  const model = aiModel || 'gemini';
  console.log(`[improve-blog-content] dispatcher model_requested="${model}" maxTokens=${maxTokens}`);

  let resultJson: string;
  let actualProvider: string;
  let actualModelId: string;

  switch (model) {
    case 'gemini': case 'gemini-flash':
      resultJson = await callGemini(prompt, maxTokens, 'gemini-2.5-flash');
      actualProvider = 'google-gemini'; actualModelId = 'gemini-2.5-flash'; break;
    case 'gemini-pro':
      resultJson = await callGemini(prompt, maxTokens, 'gemini-2.5-pro');
      actualProvider = 'google-gemini'; actualModelId = 'gemini-2.5-pro'; break;
    case 'mistral':
      resultJson = await callMistral(prompt, maxTokens);
      actualProvider = 'aws-bedrock'; actualModelId = 'mistral.mistral-large-2407-v1:0'; break;
    case 'claude-sonnet': case 'claude':
      resultJson = await callClaude(prompt, maxTokens);
      actualProvider = 'anthropic'; actualModelId = 'claude-sonnet-4-6'; break;
    case 'openai': case 'gpt5': case 'gpt5-mini':
      resultJson = await callOpenAI(prompt, maxTokens);
      actualProvider = 'openai'; actualModelId = 'gpt-4o'; break;
    case 'groq':
      resultJson = await callGroq(prompt, maxTokens);
      actualProvider = 'groq'; actualModelId = 'llama-3.3-70b-versatile'; break;
    case 'lovable-gemini':
      resultJson = await callLovableGemini(prompt, maxTokens);
      actualProvider = 'lovable-gateway'; actualModelId = 'google/gemini-2.5-flash'; break;
    case 'vertex-flash': {
      const { callVertexGemini } = await import('../_shared/vertex-ai.ts');
      const text = await callVertexGemini('gemini-2.5-flash', prompt, 90_000, { maxOutputTokens: maxTokens });
      resultJson = JSON.stringify({ __raw: text, __finishReason: 'stop' });
      actualProvider = 'vertex-ai'; actualModelId = 'gemini-2.5-flash';
      break;
    }
    case 'vertex-pro': {
      const { callVertexGemini } = await import('../_shared/vertex-ai.ts');
      const text = await callVertexGemini('gemini-2.5-pro', prompt, 120_000, { maxOutputTokens: maxTokens });
      resultJson = JSON.stringify({ __raw: text, __finishReason: 'stop' });
      actualProvider = 'vertex-ai'; actualModelId = 'gemini-2.5-pro';
      break;
    }
    case 'nova-pro': case 'nova-premier': {
      const { callBedrockNovaWithMeta } = await import('../_shared/bedrock-nova.ts');
      const { computeMaxTokens: computeNovaBudget } = await import('../_shared/word-count-enforcement.ts');
      const novaBudget = computeNovaBudget(Math.ceil(maxTokens / 2), model); // maxTokens was already computed from target, reverse to get approx target
      const result = await callBedrockNovaWithMeta(model, prompt, { maxTokens: novaBudget, temperature: 0.5 });
      resultJson = JSON.stringify({ __raw: result.text, __finishReason: result.stopReason });
      actualProvider = 'aws-bedrock'; actualModelId = model === 'nova-pro' ? 'amazon.nova-pro-v1:0' : 'amazon.nova-premier-v1:0'; break;
    }
    default:
      throw new Error(`Unsupported AI model: "${model}". Supported models: ${SUPPORTED_MODELS.join(', ')}`);
  }

  const parsed = JSON.parse(resultJson);
  console.log(`[improve-blog-content] dispatcher actual_provider=${actualProvider} actual_model=${actualModelId} finish_reason=${parsed.__finishReason}`);
  return { raw: parsed.__raw, finishReason: parsed.__finishReason, actualProvider, actualModelId };
}

// ── Build criteria-specific enrichment instructions ──
function buildCriteriaInstructions(failingCriteria: string[]): string {
  if (!failingCriteria || failingCriteria.length === 0) return '';

  const instructions: string[] = [];

  for (const criterion of failingCriteria) {
    const lower = criterion.toLowerCase();

    if (lower.includes('conclusion')) {
      instructions.push('- ADD a conclusion section at the end: Use <h2>Conclusion</h2> or <h2>निष्कर्ष</h2> followed by a 2-3 sentence summary paragraph wrapped in <p> tags.');
    }
    if (lower.includes('faq') || lower.includes('no faqs')) {
      instructions.push('- ADD a FAQ section with at least 3 relevant Q&A items. Use this EXACT format:\n  <h2>FAQ</h2>\n  <p><strong>Question here?</strong></p>\n  <p>Answer here.</p>\n  (Repeat for each FAQ item. Questions MUST be wrapped in <strong> tags and end with ?)');
    }
    if (lower.includes('intro')) {
      instructions.push('- ADD an introduction paragraph (2-3 sentences) BEFORE the first H2 heading, wrapped in <p> tags. This should set context for what the reader will learn.');
    }
    if (lower.includes('h2') || lower.includes('heading')) {
      instructions.push('- ENSURE at least 4 H2 headings structuring the article into clear, logical sections. Add new <h2> sections where the content can be meaningfully divided.');
    }
    if (lower.includes('word count') || lower.includes('< 1200')) {
      instructions.push('- EXPAND content to at least 1200 words with substantive depth. Add real explanations, practical tips, examples, eligibility details, or process steps — not filler.');
    }
    if (lower.includes('internal link') || lower.includes('no internal links')) {
      instructions.push('- Where contextually relevant, add 2-3 internal links using <a href="/relevant-path">descriptive anchor text</a>. Use paths like /sarkari-naukri, /results, /admit-cards, /blog/related-topic-slug only where they genuinely fit the content.');
    }
  }

  if (instructions.length === 0) return '';

  return `\n\nSPECIFIC REQUIREMENTS — You MUST address ALL of the following:\n${instructions.join('\n')}\n\nThese are the exact criteria this article is currently FAILING. Your output will be automatically verified against them. If you do not add these elements, the enrichment will be marked as unsuccessful.`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authResult = await verifyAdmin(req);
    if (authResult instanceof Response) return authResult;

    const { title, content, action, selectedHtml, headings, hasIntro, hasConclusion, wordCount, category, tags, targetWordCount, aiModel, failingCriteria, isStubRebuild } = await req.json();
    if (!title || !action) {
      return new Response(JSON.stringify({ error: 'title and action required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const effectiveModel = aiModel || 'gemini';
    console.log(`[improve-blog-content] action=${action} model_requested=${effectiveModel} title="${title.substring(0, 60)}"`);

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
      const plainText = (content || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      const currentWords = plainText.split(/\s+/).filter((w: string) => w.length > 0).length;
      const dynamicTarget = Math.max(Math.ceil(currentWords * 1.3), currentWords + 300);
      const effectiveTarget = Math.min(Math.max(Number(targetWordCount) || dynamicTarget, 800), 5000);

      const criteriaBlock = buildCriteriaInstructions(Array.isArray(failingCriteria) ? failingCriteria : []);

      if (isStubRebuild && currentWords < 500) {
        prompt = `You are a professional content writer for TrueJobs.co.in, an Indian government job portal.

Write a comprehensive, well-structured article on the topic below.
const { buildWordCountInstruction: buildWCI } = await import('../_shared/word-count-enforcement.ts');
STRICT_WC_BLOCK = buildWCI(Math.max(1200, effectiveTarget), effectiveModel);
prompt = `You are a professional content writer for TrueJobs.co.in, an Indian government job portal.

Write a comprehensive, well-structured article on the topic below.
${STRICT_WC_BLOCK}
${effectiveTarget <= 1200 ? 'Keep sections brief (3-5 sentences max) and skip subsections.' : ''}

TOPIC: ${title}
Category: ${category || 'General'}
Tags: ${(tags || []).join(', ') || 'none'}

EXISTING CONTENT (use as context and outline — preserve the topic, angle, and any surviving factual content):
${content}

CRITICAL RULES:
- Preserve the topic intent and angle of the original article — do NOT change the subject
- If the existing content contains specific facts, dates, or details, KEEP them
- Do NOT invent specific statistics, official dates, vacancy counts, or government notification details
- Do NOT hallucinate specific salary figures, exam dates, or application deadlines
- If specific details are unknown, use general guidance language instead
- Write in the same language as the original content (Hindi or English)
- Maintain an informational, non-official tone
- Output MUST use HTML tags: <h2>, <h3>, <p>, <ul>, <li>, <ol>, <strong>, <em>
- Do NOT use markdown syntax. Use ONLY HTML tags
- Include at least 4 H2 sections for proper structure
- Start with an introduction paragraph before the first H2
- End with a conclusion section
${criteriaBlock}

Return ONLY the full article as valid HTML.
No JSON wrappers, no markdown, no code blocks, no explanations.`;

        const { computeMaxTokens: computeMT } = await import('../_shared/word-count-enforcement.ts');
        maxTokens = computeMT(Math.max(1200, effectiveTarget), effectiveModel);

      } else {
        prompt = `You are a professional content editor for TrueJobs.co.in, an Indian government job portal.
Expand and improve the following article.
STRICT Word count target: ${effectiveTarget} words. Do NOT exceed ${Math.round(effectiveTarget * 1.15)} words. Do NOT write fewer than ${Math.round(effectiveTarget * 0.85)} words. Currently ~${currentWords} words.

CRITICAL RULES:
- You MUST return the COMPLETE article — every single section from the original MUST be present in your output
- The output MUST be LONGER than the input, never shorter
- Do NOT truncate, summarize, or abbreviate any part of the original content
- Preserve the original structure, intent, headings, and factual content
- Strengthen depth: add explanations, examples, practical tips, and context
- Do NOT add fluff, repetition, or fabricated claims
- Do NOT add keyword stuffing
- Do NOT invent specific statistics, dates, or official details that were not in the original
- Keep the same language (Hindi/English) as the original
- Maintain an informational, non-official tone
- Output MUST use HTML tags: <h2>, <h3>, <p>, <ul>, <li>, <ol>, <strong>, <em>, <table>, <tr>, <td>, <th>
- Do NOT use markdown syntax (no ##, no **, no *, no - for lists). Use ONLY HTML tags.
- Keep all existing HTML structure (H2, H3, lists, tables)
- Add new subsections (<h3>) under existing <h2>s where appropriate
- Do NOT remove any existing content
- Wrap every paragraph in <p> tags
- Wrap every heading in <h2> or <h3> tags
- Wrap every list in <ul> or <ol> with <li> items
${criteriaBlock}

Article title: ${title}
Category: ${category || 'General'}
Tags: ${(tags || []).join(', ') || 'none'}

Current content:
${content}

Return ONLY the full enriched article as valid HTML.
No JSON wrappers, no markdown, no code blocks, no explanations.
REMINDER: Your output must contain ALL original content plus additions. Do NOT cut short.`;

        const estimatedTokensNeeded = Math.max(8000, Math.ceil(currentWords * 2.5));
        maxTokens = Math.min(estimatedTokensNeeded, 65536);

        // Nova models need a generous token budget — 1 word ≈ 1.5 tokens for HTML content
        if (effectiveModel === 'nova-pro' || effectiveModel === 'nova-premier') {
          maxTokens = Math.max(maxTokens, Math.ceil(effectiveTarget * 2));
        }

        // Claude Sonnet can hit platform timeouts on very large generations — keep output budget tighter.
        if (effectiveModel === 'claude-sonnet' || effectiveModel === 'claude') {
          maxTokens = Math.min(maxTokens, 3500);
        }
      }

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

    // ── Call AI via unified dispatcher ──
    const { raw, finishReason, actualProvider, actualModelId } = await callAI(effectiveModel, prompt, maxTokens);
    const wasTruncated = finishReason === 'MAX_TOKENS' || finishReason === 'LENGTH' || finishReason === 'max_tokens';

    console.log(`[improve-blog-content] AI response received provider=${actualProvider} model=${actualModelId} finishReason=${finishReason} rawLength=${raw.length} wasTruncated=${wasTruncated}`);

    if (action === 'rewrite-section') {
      const cleaned = raw.replace(/```html\n?/g, '').replace(/```\n?/g, '').trim();
      return new Response(JSON.stringify({ result: cleaned, changes: ['Section rewritten for improved clarity'], actualProvider, actualModelId }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'generate-intro') {
      const cleaned = raw.replace(/```html\n?/g, '').replace(/```\n?/g, '').trim();
      return new Response(JSON.stringify({ result: cleaned, applyMode: 'insert_before_first_heading', actualProvider, actualModelId }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'generate-conclusion') {
      const cleaned = raw.replace(/```html\n?/g, '').replace(/```\n?/g, '').trim();
      return new Response(JSON.stringify({ result: cleaned, applyMode: 'append_content', actualProvider, actualModelId }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'enrich-article') {
      let cleaned = raw.trim();
      if (cleaned.startsWith('```')) cleaned = cleaned.replace(/^```(?:json|html)?\s*\n/, '');
      if (cleaned.endsWith('```')) cleaned = cleaned.replace(/\n?```\s*$/, '');
      cleaned = cleaned.trim();

      const extractResultFromPseudoJson = (input: string): string => {
        const resultKeyIndex = input.indexOf('"result"');
        if (resultKeyIndex === -1) return '';
        const colonIndex = input.indexOf(':', resultKeyIndex);
        if (colonIndex === -1) return '';
        let i = colonIndex + 1;
        while (i < input.length && /\s/.test(input[i])) i++;
        if (input[i] !== '"') return '';
        i++;
        let out = '';
        let escaped = false;
        for (; i < input.length; i++) {
          const ch = input[i];
          if (escaped) { out += ch === 'n' ? '\n' : ch; escaped = false; continue; }
          if (ch === '\\') { escaped = true; continue; }
          if (ch === '"') {
            const rest = input.slice(i + 1);
            if (/^\s*,\s*"(wordCount|changes)"/.test(rest) || /^\s*}\s*$/.test(rest)) return out.trim();
            out += ch; continue;
          }
          out += ch;
        }
        return out.trim();
      };

      let resultHtml = '';
      let changes: string[] = [];

      try {
        const parsed = JSON.parse(cleaned);
        resultHtml = typeof parsed?.result === 'string' ? parsed.result : '';
        changes = Array.isArray(parsed?.changes) ? parsed.changes : [];
      } catch {
        const withoutJsonPrefix = cleaned.replace(/^json\s*/i, '').trim();
        const recovered = extractResultFromPseudoJson(withoutJsonPrefix);
        if (recovered) {
          resultHtml = recovered;
          changes = ['Content enriched'];
        } else {
          resultHtml = withoutJsonPrefix;
          changes = ['Content enriched'];
        }
      }

      if (!resultHtml || resultHtml === '{}' || /^\{[\s\S]*\}$/.test(resultHtml)) {
        resultHtml = '';
      }

      if (resultHtml && !resultHtml.includes('<h2') && !resultHtml.includes('<h3') && /^#{2,3}\s/m.test(resultHtml)) {
        resultHtml = markdownToHtml(resultHtml);
      }

      const wordCountComputed = resultHtml.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(w => w.length > 0).length;
      return new Response(JSON.stringify({
        result: resultHtml,
        wordCount: wordCountComputed,
        wasTruncated,
        changes: Array.isArray(changes) ? changes : [],
        actualProvider,
        actualModelId,
      }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // structure action
    let parsed: { result: string; changes: string[]; proposedOutline?: string[]; missingSections?: string[]; suggestedInsertions?: any[] };
    try {
      const cleanedJson = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      parsed = JSON.parse(cleanedJson);
    } catch {
      parsed = { result: raw, changes: [], proposedOutline: [], missingSections: [], suggestedInsertions: [] };
    }

    if (!Array.isArray(parsed.proposedOutline)) parsed.proposedOutline = [];
    if (!Array.isArray(parsed.missingSections)) parsed.missingSections = [];
    if (!Array.isArray(parsed.changes)) parsed.changes = [];
    if (!Array.isArray(parsed.suggestedInsertions)) parsed.suggestedInsertions = [];

    return new Response(JSON.stringify({ ...parsed, actualProvider, actualModelId }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    console.error('improve-blog-content error:', err);
    const msg = err instanceof Error ? err.message : 'Unknown error';
    const status = typeof msg === 'string' && msg.toLowerCase().includes('timeout') ? 504 : 500;
    return new Response(JSON.stringify({ error: msg }), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
