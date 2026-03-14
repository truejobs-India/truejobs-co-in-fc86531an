import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// ═══════════════════════════════════════════════════════════════
// Mistral Specialized System Prompt
// ═══════════════════════════════════════════════════════════════

const MISTRAL_SYSTEM_PROMPT = `You are an expert SEO content writer for TrueJobs.co.in, India's trusted job portal. You write authoritative, well-researched articles that rank on Google and genuinely help Indian job seekers.

WRITING RULES — follow these strictly:

1. STRUCTURE:
   - Start with a compelling introduction (2-3 sentences) that hooks the reader and includes the primary keyword naturally
   - Use a clear H2/H3 heading hierarchy throughout the article
   - Keep paragraphs short — 2-4 sentences maximum, never a wall of text
   - Include a quick summary/key takeaways box near the top for readers who want fast answers
   - End with a clear conclusion and a call-to-action pointing to TrueJobs

2. SEO OPTIMIZATION:
   - Use the primary keyword in the first 100 words, in at least 2 H2 headings, and naturally throughout the content
   - Include 3-5 related LSI keywords/phrases woven naturally into the content
   - Write a compelling meta description (under 155 characters)
   - Use question-based H2 headings where relevant (these target featured snippets)
   - Include internal linking suggestions — mention 2-3 related topics that exist on TrueJobs blog
   - Add a FAQ section at the end with 4-6 questions in schema-friendly Q&A format

3. CONTENT QUALITY:
   - Every sentence must add value — no filler, no fluff, no generic AI padding
   - Do NOT use phrases like: "In today's world", "In this article we will discuss", "It is important to note that", "As we all know", "In conclusion", "Let's dive in"
   - Do NOT repeat the same point in different words across paragraphs
   - Include specific numbers, dates, salary figures, age limits, and exam details wherever applicable — Indian job seekers want exact data
   - Use real examples: name specific exams (SSC CGL, IBPS PO, RRB NTPC), specific organizations (UPSC, SSC, Railway Board), and specific salary ranges (Pay Level 4: ₹25,500-₹81,100)
   - Compare options using tables where relevant (e.g., SSC CGL vs CHSL comparison)
   - Write with authority — the reader should feel this was written by someone who understands Indian government jobs deeply

4. TONE AND READABILITY:
   - Write in a clear, direct, helpful tone — like a knowledgeable senior guiding a younger person
   - Match the language of the topic: if the topic is in Hindi, write the full article in Hindi (Devanagari script). If in English, write in English. Never mix unless it is natural (e.g., "SSC CGL" in an otherwise Hindi article is fine)
   - Use short sentences. Aim for 8th-grade reading level
   - Use bullet points and numbered lists for steps, eligibility criteria, and document lists
   - Bold important information: dates, salary figures, age limits, website URLs

5. WORD COUNT:
   - Write the exact amount the topic demands — no padding to reach a word count
   - Informational topics (guides, strategies): 2000-3500 words
   - News/update topics (results, admit cards, recruitment notifications): 1200-1800 words
   - Comparison topics (X vs Y): 1500-2500 words
   - Use your judgment based on the topic — a thin topic should not be artificially stretched

6. IMPORTANT: Quality over quantity. A 1500-word article with zero fluff beats a 3000-word article with padding. Every paragraph must earn its place.

OUTPUT FORMAT: You MUST return a valid JSON object with these exact fields:
- title: article H1 title (compelling, SEO-friendly, under 80 chars)
- slug: URL-friendly slug (lowercase, hyphens, no trailing hyphens)
- content: the full article as HTML (do NOT include the H1 title in content — it's stored separately). Use H2/H3 for sections, <p> for paragraphs, <ul>/<ol> for lists, <table> for tabular data, <strong> for bold
- metaTitle: SEO meta title under 60 characters
- metaDescription: SEO meta description, 140-155 characters
- excerpt: 1-2 sentence summary for listings
- category: suggested category (Career Advice, Government Jobs, Exam Preparation, Results & Cutoffs, Admit Cards, Syllabus, Current Affairs)
- tags: array of 3-6 relevant tags

Return ONLY the JSON object. No markdown code blocks. No extra text.`;

// ═══════════════════════════════════════════════════════════════
// Auth helper
// ═══════════════════════════════════════════════════════════════

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
// AI Model Providers
// ═══════════════════════════════════════════════════════════════

// ── 1. Gemini (direct API) ──
async function callGemini(prompt: string, maxTokens = 32000): Promise<string> {
  const apiKey = Deno.env.get('GEMINI_API_KEY');
  if (!apiKey) throw new Error('GEMINI_API_KEY not configured');
  const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: maxTokens, temperature: 0.5 },
    }),
  });
  if (!resp.ok) throw new Error(`Gemini API error ${resp.status}`);
  const data = await resp.json();
  const candidate = data?.candidates?.[0];
  if (candidate?.finishReason === 'MAX_TOKENS') throw new Error('AI response truncated (MAX_TOKENS). Try shorter target word count.');
  return candidate?.content?.parts?.[0]?.text || '';
}

// ── 2. Lovable Gemini (gateway) ──
async function callLovableGemini(prompt: string): Promise<string> {
  const apiKey = Deno.env.get('LOVABLE_API_KEY');
  if (!apiKey) throw new Error('LOVABLE_API_KEY not configured');
  const resp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 16000,
      temperature: 0.5,
    }),
  });
  if (!resp.ok) {
    if (resp.status === 429) throw new Error('Rate limit exceeded on Lovable AI. Try again later.');
    if (resp.status === 402) throw new Error('Lovable AI credits exhausted.');
    throw new Error(`Lovable AI error ${resp.status}`);
  }
  const data = await resp.json();
  return data?.choices?.[0]?.message?.content || '';
}

// ── 3. OpenAI ──
async function callOpenAI(prompt: string): Promise<string> {
  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) throw new Error('OPENAI_API_KEY not configured');
  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 16000,
      temperature: 0.5,
    }),
  });
  if (!resp.ok) throw new Error(`OpenAI API error ${resp.status}`);
  const data = await resp.json();
  return data?.choices?.[0]?.message?.content || '';
}

// ── 4. Groq ──
async function callGroq(prompt: string): Promise<string> {
  const apiKey = Deno.env.get('GROQ_API_KEY');
  if (!apiKey) throw new Error('GROQ_API_KEY not configured');
  const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 16000,
      temperature: 0.5,
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
    headers: {
      'Content-Type': 'application/json',
      'X-Amz-Date': amzDate,
      Authorization: `AWS4-HMAC-SHA256 Credential=${ak}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${sig}`,
    },
    body,
  });
}

// ── 5. Claude (Anthropic Direct API) ──
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
      temperature: 0.7,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!resp.ok) throw new Error(`Anthropic API error ${resp.status}: ${await resp.text()}`);
  const data = await resp.json();
  return data?.content?.[0]?.text || '';
}

// ── 6. Mistral (AWS Bedrock Converse) — Enhanced with system prompt ──
async function callMistral(prompt: string, systemPrompt?: string): Promise<string> {
  const modelId = 'mistral.mistral-7b-instruct-v0:2';
  const region = Deno.env.get('AWS_REGION') || 'ap-south-1';
  const host = `bedrock-runtime.${region}.amazonaws.com`;
  const rawPath = `/model/${modelId}/converse`;

  const payload: Record<string, unknown> = {
    messages: [{ role: 'user', content: [{ text: prompt }] }],
    inferenceConfig: { maxTokens: 8192, temperature: 0.6 },
  };

  // Add system prompt if provided
  if (systemPrompt) {
    payload.system = [{ text: systemPrompt }];
  }

  const body = JSON.stringify(payload);
  const resp = await awsSigV4Fetch(host, rawPath, body, region, 'bedrock');
  if (!resp.ok) throw new Error(`Mistral Bedrock ${resp.status}: ${await resp.text()}`);
  const data = await resp.json();
  return data?.output?.message?.content?.[0]?.text || '';
}

// ── Model dispatcher ──
async function callAI(model: string, prompt: string): Promise<string> {
  switch (model) {
    case 'gemini': return callGemini(prompt);
    case 'lovable-gemini': return callLovableGemini(prompt);
    case 'openai': return callOpenAI(prompt);
    case 'groq': return callGroq(prompt);
    case 'claude': return callClaude(prompt);
    case 'mistral': return callMistral(prompt, MISTRAL_SYSTEM_PROMPT);
    default: return callGemini(prompt);
  }
}

// ═══════════════════════════════════════════════════════════════
// Main handler
// ═══════════════════════════════════════════════════════════════

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authResult = await verifyAdmin(req);
    if (authResult instanceof Response) return authResult;

    const { topic, category, tags, targetWordCount, aiModel } = await req.json();
    if (!topic || typeof topic !== 'string') {
      return new Response(JSON.stringify({ error: 'topic is required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const useModel = aiModel || 'gemini';
    console.log(`[generate-blog-article] Using model: ${useModel}`);

    let prompt: string;

    if (useModel === 'mistral') {
      // Mistral uses a simplified user prompt — the system prompt handles all writing rules
      const tagsList = Array.isArray(tags) && tags.length > 0 ? `\nTags: ${tags.join(', ')}` : '';
      prompt = `Write a complete, SEO-optimized blog article on the following topic:

Topic: ${topic}${category ? `\nCategory: ${category}` : ''}${tagsList}

Follow all the writing rules and output format specified in your instructions. Return ONLY the JSON object.`;
    } else {
      // Default prompt for all other models
      const wordTarget = Math.min(Math.max(Number(targetWordCount) || 1500, 800), 3000);
      const tagsList = Array.isArray(tags) && tags.length > 0 ? tags.join(', ') : '';

      prompt = `You are a professional content writer for TrueJobs.co.in, an Indian government job portal and career advice website.

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
    }

    const raw = await callAI(useModel, prompt);
    const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    let parsed: any;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      return new Response(JSON.stringify({ error: 'Failed to parse AI response', raw: cleaned.substring(0, 500) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (!parsed.title || !parsed.content) {
      return new Response(JSON.stringify({ error: 'AI response missing title or content' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

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
