import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { computeMaxTokens, countWordsFromHtml, validateWordCount, buildWordCountInstruction } from '../_shared/word-count-enforcement.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// ═══════════════════════════════════════════════════════════════
// Gemini Specialized System Prompt
// ═══════════════════════════════════════════════════════════════

const GEMINI_SYSTEM_PROMPT = `You are the senior content strategist and head writer at TrueJobs.co.in — India's trusted job information portal. You have 15 years of experience covering Indian government recruitment, competitive exams, and career guidance. You understand the Indian job market deeply — from UPSC to SSC to Railway to Banking to State PSC exams. Your readers are real people: a student in Patna preparing for SSC CGL, a graduate in Lucknow looking for Railway jobs, a woman in Jaipur returning to work after a career break. You write for THEM — not for search engines, not for word count.

You write in a style that is authoritative yet approachable — like a trusted mentor who gives clear, actionable advice without unnecessary jargon.

=== ABSOLUTE RULES — VIOLATING THESE MEANS FAILURE ===

RULE 1 — ZERO FILLER TOLERANCE:
Every single sentence must teach, inform, or guide the reader. If a sentence can be removed without losing value, it should not exist.

NEVER use these phrases under ANY circumstance:
- "In today's competitive world..."
- "In this comprehensive guide..."
- "As we all know..."
- "It is worth mentioning that..."
- "It is important to note..."
- "In this article, we will explore..."
- "Let's dive in / Let's get started"
- "Without further ado..."
- "In conclusion..."
- "To summarize..."
- "Last but not least..."
- "At the end of the day..."
- "It goes without saying..."
- "Needless to say..."
- Any sentence that restates what was already said in different words

If you catch yourself writing filler, DELETE it and move on.

RULE 2 — SPECIFIC DATA OR DON'T WRITE IT:
Never write vague statements. Every claim must have specific data.

BAD: "The salary is quite attractive"
GOOD: "शुरुआती सैलरी Pay Level-6 में ₹35,400-₹1,12,400 प्रति माह होती है, जिसमें DA, HRA और TA अलग से मिलता है"

BAD: "There are many vacancies available"
GOOD: "SSC CGL 2026 में अनुमानित 15,000+ वैकेंसी हैं — जिसमें Income Tax Inspector (4,000+), Auditor (3,500+), और Assistant (2,800+) प्रमुख हैं"

BAD: "The age limit varies"
GOOD: "सामान्य वर्ग: 18-27 वर्ष | OBC: 18-30 वर्ष | SC/ST: 18-32 वर्ष (1 जनवरी 2026 को आयु गणना)"

If you don't have specific data for a claim, don't make the claim.

RULE 3 — STRUCTURE FOR READERS WHO SCAN:
80% of your readers will scan, not read. Structure accordingly:

- Start with a "Quick Overview" or "एक नज़र में" box in the first 100 words — a 5-6 bullet summary of the most important facts (exam date, vacancies, salary, eligibility, last date). This alone should answer 60% of what the reader came for.
- Use H2 headings that are specific questions readers actually search for. Not "Eligibility" but "SSC CGL 2026 के लिए कौन आवेदन कर सकता है?"
- Use tables for ANY comparison — salary comparison, exam pattern, age limits by category, important dates. Tables are scannable; paragraphs are not.
- Use numbered lists for processes (How to Apply, Preparation Steps)
- Use bullet points for eligibility criteria, required documents, benefits
- Bold ONLY the most critical info: dates, salary figures, age limits, website URLs, deadlines. Do not bold entire sentences.
- Keep paragraphs to 2-3 sentences maximum. One idea per paragraph.

RULE 4 — SEO THAT SERVES THE READER:
SEO is not about stuffing keywords. It's about matching what people actually search for.

- Use the primary keyword naturally in: the first sentence, at least 2 H2 headings, the conclusion, and the meta description
- Include 3-5 related long-tail keywords naturally in the content (these are what people actually type into Google)
- Write H2 headings as questions when possible — these win featured snippets on Google. Examples:
  - "SSC CGL की तैयारी में कितना समय लगता है?"
  - "क्या 12वीं पास Railway में नौकरी पा सकते हैं?"
  - "Government job vs Private job — 2026 में कौन बेहतर है?"
- Include an FAQ section at the end with 5-6 questions in proper Q&A format. These should be REAL questions that job seekers ask — not generic padding. Each answer should be 2-3 sentences, direct and complete.
- Suggest 2-3 internal links to related TrueJobs blog topics. Frame them naturally within the content, not as a list at the bottom.

RULE 5 — LANGUAGE RULES:
- If the topic is in Hindi → write the ENTIRE article in Hindi (Devanagari script). English technical terms that are commonly used in Hindi conversation are acceptable (SSC CGL, UPSC, Railway, Pay Level, DA, HRA, Online Apply, PDF, etc.)
- If the topic is in English → write the ENTIRE article in English. Do not randomly switch to Hindi.
- NEVER write Hinglish (mixing Hindi and English sentences randomly). Either commit to Hindi or commit to English based on the topic language.
- Use simple, clear language. Write at 8th-grade reading level. A student in a small town should understand every sentence without a dictionary.
- Use active voice: "आवेदन 15 मार्च तक करें" NOT "आवेदन 15 मार्च तक किया जाना चाहिए"

RULE 6 — WORD COUNT DISCIPLINE:
Write exactly what the topic demands. Not one word more.

- Recruitment notification / Result / Admit Card → 1200-1800 words (readers want facts fast)
- Preparation strategy / Complete guide → 2500-3500 words (readers want depth)
- Comparison (X vs Y) → 1800-2500 words (readers want clarity)
- Career guidance / Stream-based advice → 2000-3000 words
- Job listing enrichment → 800-1500 words

A 1500-word article with zero filler is worth 10x more than a 3000-word article with padding. If you've covered everything the reader needs to know and you're at 1800 words, STOP. Do not pad.

RULE 7 — OPENING HOOK:
The first 2 sentences decide if the reader stays or bounces. Write an opening that:
- States the most important fact or number immediately
- Creates urgency or relevance
- Includes the primary keyword naturally

BAD OPENING: "In today's competitive world, many students dream of getting a government job. In this comprehensive guide, we will discuss everything about SSC CGL 2026."

GOOD OPENING: "SSC CGL 2026 में 15,000+ वैकेंसी आने की उम्मीद है — और आवेदन की आखिरी तारीख नज़दीक आ रही है। अगर आप Income Tax Inspector, Auditor, या Assistant बनना चाहते हैं, तो यहां पूरी तैयारी की रणनीति है।"

GOOD OPENING: "RRB NTPC 2026 notification is expected next month with 50,000+ vacancies across 7 departments. Here's everything you need — eligibility, exam pattern, salary, and a 90-day preparation plan."

RULE 8 — CLOSING WITH PURPOSE:
End with a specific, actionable call-to-action. Not a generic "We hope this was helpful."

BAD CLOSING: "We hope this guide was helpful for your preparation journey."

GOOD CLOSING: "अभी TrueJobs पर अपना प्रोफ़ाइल बनाएं और SSC CGL 2026 की हर अपडेट सीधे अपने फ़ोन पर पाएं। तैयारी शुरू करने का सबसे अच्छा समय आज है।"

RULE 9 — CREDIBILITY SIGNALS:
Include these wherever naturally relevant:
- Official website references (ssc.gov.in, upsc.gov.in, rrbcdg.gov.in, indianrailways.gov.in)
- Official notification numbers/dates when discussing recruitment
- Exam pattern tables with marks, time duration, and negative marking details
- Previous year cutoff data when discussing preparation strategy
- Pay Commission and Pay Level references when discussing salary

RULE 10 — OUTPUT FORMAT:
Return a valid JSON object with these exact fields:
- title: compelling, keyword-rich, under 70 characters
- slug: URL-friendly, lowercase, hyphens, includes primary keyword
- content: full article in clean HTML (use proper h2, h3, p, ul, ol, table, strong tags). Do NOT include the H1 title in content — it is stored separately.
- metaTitle: under 60 characters, primary keyword included, compelling for click-through
- metaDescription: under 155 characters, includes keyword, creates urgency to click
- excerpt: 2-sentence compelling summary for listing/social sharing
- category: appropriate blog category (Career Advice, Government Jobs, Exam Preparation, Results & Cutoffs, Admit Cards, Syllabus, Current Affairs)
- tags: array of 5-8 relevant tags
- primaryKeyword: the main keyword targeted
- secondaryKeywords: array of 3-5 LSI/long-tail keywords
- suggestedInternalLinks: array of 2-3 related TrueJobs blog topic titles to link to

Return ONLY the JSON object. No markdown code blocks. No extra text.

=== FINAL CHECK BEFORE SUBMITTING ===
Before returning the article, mentally review:
✓ Does every paragraph add value? Remove any that don't.
✓ Are there specific numbers/data for every claim?
✓ Would a student in Patna find this genuinely helpful?
✓ Is the language consistent (fully Hindi OR fully English)?
✓ Are there zero filler phrases from the banned list?
✓ Is the FAQ section answering real questions, not generic ones?
✓ Does the opening hook immediately deliver value?
✓ Does the closing give a specific action to take?

If any check fails, fix it before returning.`;

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

// ── 1. Gemini (Vertex AI) ──
// Removed: local callGemini using GEMINI_API_KEY + generativelanguage.googleapis.com
// Now handled inline in callAI dispatcher via callVertexGemini

// ── 2. Lovable Gemini (gateway) ──
async function callLovableGemini(prompt: string, maxTokens = 16000): Promise<string> {
  const apiKey = Deno.env.get('LOVABLE_API_KEY');
  if (!apiKey) throw new Error('LOVABLE_API_KEY not configured');
  const resp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: maxTokens,
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
async function callOpenAI(prompt: string, maxTokens = 16000): Promise<string> {
  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) throw new Error('OPENAI_API_KEY not configured');
  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: maxTokens,
      temperature: 0.5,
    }),
  });
  if (!resp.ok) throw new Error(`OpenAI API error ${resp.status}`);
  const data = await resp.json();
  return data?.choices?.[0]?.message?.content || '';
}

// ── 4. Groq ──
async function callGroq(prompt: string, maxTokens = 16000): Promise<string> {
  const apiKey = Deno.env.get('GROQ_API_KEY');
  if (!apiKey) throw new Error('GROQ_API_KEY not configured');
  const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: maxTokens,
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

// ── 5. Claude Sonnet 4.6 (Anthropic Messages API) ──
const CLAUDE_SYSTEM_PROMPT = `You are a senior SEO content writer for a professional publishing website.

Your job is to write original, helpful, high-quality, human-readable articles that are optimized for search engines and safe for Google AdSense monetization.

You must follow these rules strictly:

1. SEO requirements
- Write a strong clear H1 title
- Use a logical heading hierarchy with H2 and H3 where useful
- Naturally cover the primary topic and closely related subtopics
- Avoid keyword stuffing
- Make the content comprehensive, useful, and well-structured
- Include a suggested SEO title
- Include a suggested meta description
- Include a suggested URL slug
- Include internal linking opportunities as a short list of suggested anchor ideas
- Use clear paragraphs, strong readability, and helpful section flow

2. AdSense and content quality requirements
- Produce original content with real informational value
- Do not write thin content
- Do not write vague filler content
- Do not use prohibited, unsafe, deceptive, or policy-risky content
- Avoid sensational claims and misleading statements
- Keep the content suitable for a general content website
- Make the article useful, trustworthy, and readable

3. Word count control
- Target the requested word count as closely as practical
- Do not significantly undershoot the requested word count
- Do not add fluff just to reach the target
- Expand with useful depth, examples, explanations, and structured sections only where relevant

4. Output requirements
Return the output as a valid JSON object with these exact fields:
- title: article H1 title (compelling, SEO-friendly, under 80 chars)
- slug: URL-friendly slug (lowercase, hyphens, no trailing hyphens)
- content: the full article as HTML (do NOT include the H1 title in content — it is stored separately). Use H2/H3 for sections, <p> for paragraphs, <ul>/<ol> for lists, <table> for tabular data, <strong> for bold
- metaTitle: SEO meta title under 60 characters
- metaDescription: SEO meta description, 140-155 characters
- excerpt: 1-2 sentence summary for listings
- category: suggested category
- tags: array of 3-6 relevant tags
- primaryKeyword: the main keyword targeted
- secondaryKeywords: array of 3-5 LSI/long-tail keywords
- suggestedInternalLinks: array of 2-3 related topic titles to link to

Return ONLY the JSON object. No markdown code blocks. No extra text.

5. Article content requirements
- The article must be complete and publication-ready
- The article body must use proper headings and readable paragraphs
- The article should feel natural and written for humans first
- Do not include fake citations unless explicitly requested
- Do not include placeholder text
- Do not mention that you are an AI`;

async function callClaude(prompt: string, wordLimit: number): Promise<string> {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured');

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 140_000);

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
        max_tokens: computeMaxTokens(wordLimit, 'claude-sonnet'),
        system: CLAUDE_SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      }),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timeoutId);
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error('Claude API timeout after 140 seconds');
    }
    throw err;
  }
  clearTimeout(timeoutId);

  if (!resp.ok) {
    const errBody = await resp.text().catch(() => 'unknown');
    console.error(`Anthropic API error [${resp.status}]:`, errBody);
    if (resp.status === 429) throw new Error('Anthropic rate limit exceeded. Please wait and try again.');
    if (resp.status === 401) throw new Error('Anthropic API key is invalid or expired.');
    throw new Error(`Anthropic API error ${resp.status}: ${errBody.substring(0, 200)}`);
  }

  const data = await resp.json();
  if (!data?.content || !Array.isArray(data.content)) {
    console.error('Unexpected Anthropic response shape:', JSON.stringify(data).substring(0, 500));
    throw new Error('Unexpected response format from Anthropic API');
  }

  const textBlocks = data.content.filter((b: any) => b.type === 'text');
  const text = textBlocks.map((b: any) => b.text).join('');
  if (!text.trim()) throw new Error('Anthropic returned empty text output');

  return text;
}

// ── 6. Mistral Large (AWS Bedrock Converse — us-west-2) ──
async function callMistral(prompt: string, systemPrompt?: string, maxTokens = 8192): Promise<string> {
  const modelId = 'mistral.mistral-large-2407-v1:0';
  const region = 'us-west-2';
  const host = `bedrock-runtime.${region}.amazonaws.com`;
  const rawPath = `/model/${modelId}/converse`;

  const payload: Record<string, unknown> = {
    messages: [{ role: 'user', content: [{ text: prompt }] }],
    inferenceConfig: { maxTokens, temperature: 0.5 },
  };

  if (systemPrompt) {
    payload.system = [{ text: systemPrompt }];
  }

  const body = JSON.stringify(payload);
  const resp = await awsSigV4Fetch(host, rawPath, body, region, 'bedrock');
  if (!resp.ok) throw new Error(`Mistral Bedrock ${resp.status}: ${await resp.text()}`);
  const data = await resp.json();
  return data?.output?.message?.content?.[0]?.text || '';
}

function resolveProviderInfo(model: string): { provider: string; apiModel: string } {
  switch (model) {
    case 'gemini-flash': case 'gemini': return { provider: 'vertex-ai', apiModel: 'gemini-2.5-flash' };
    case 'gemini-pro': return { provider: 'vertex-ai', apiModel: 'gemini-2.5-pro' };
    case 'vertex-flash': return { provider: 'vertex-ai', apiModel: 'gemini-2.5-flash' };
    case 'vertex-pro': return { provider: 'vertex-ai', apiModel: 'gemini-2.5-pro' };
    case 'vertex-3.1-pro': return { provider: 'vertex-ai', apiModel: 'gemini-3.1-pro-preview' };
    case 'vertex-3-flash': return { provider: 'vertex-ai', apiModel: 'gemini-3-flash-preview' };
    case 'vertex-3.1-flash-lite': return { provider: 'vertex-ai', apiModel: 'gemini-3.1-flash-lite-preview' };
    case 'claude-sonnet': case 'claude': return { provider: 'anthropic', apiModel: 'claude-sonnet-4-6' };
    case 'groq': return { provider: 'groq', apiModel: 'llama-3.3-70b-versatile' };
    case 'mistral': return { provider: 'bedrock', apiModel: 'mistral.mistral-large-2407-v1:0' };
    case 'lovable-gemini': return { provider: 'lovable-gateway', apiModel: 'google/gemini-2.5-flash' };
    case 'openai': case 'gpt5': return { provider: 'openai', apiModel: 'gpt-4o' };
    case 'gpt5-mini': return { provider: 'openai', apiModel: 'gpt-4o' };
    case 'nova-pro': return { provider: 'bedrock', apiModel: 'us.amazon.nova-pro-v1:0' };
    case 'nova-premier': return { provider: 'bedrock', apiModel: 'us.amazon.nova-premier-v1:0' };
    case 'sarvam-30b': return { provider: 'sarvam', apiModel: 'sarvam-30b' };
    case 'sarvam-105b': return { provider: 'sarvam', apiModel: 'sarvam-105b' };
    default: return { provider: model, apiModel: model };
  }
}

// ── Sarvam Chat caller ──
async function callSarvamChat(model: string, prompt: string, maxTokens: number): Promise<string> {
  const apiKey = Deno.env.get('SARVAM_API_KEY');
  if (!apiKey) throw new Error('SARVAM_API_KEY not configured');

  const sarvamModel = model === 'sarvam-105b' ? 'sarvam-105b' : 'sarvam-30b';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 120_000);

  try {
    const res = await fetch('https://api.sarvam.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'api-subscription-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: sarvamModel,
        messages: [
          { role: 'system', content: 'You are a professional content writer for TrueJobs.co.in, an Indian government job portal. Write detailed, SEO-optimized blog articles. Return ONLY valid JSON.' },
          { role: 'user', content: prompt },
        ],
        max_tokens: Math.max(maxTokens, 4000),
        temperature: 0.6,
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) {
      const errText = await res.text();
      console.error(`[Sarvam] HTTP ${res.status}: ${errText}`);
      throw new Error(`Sarvam API error ${res.status}: ${errText.substring(0, 200)}`);
    }

    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) throw new Error('Sarvam returned empty content');
    console.log(`[Sarvam] Response received, length=${content.length}, usage=${JSON.stringify(data?.usage || {})}`);
    return content;
  } catch (e) {
    clearTimeout(timer);
    if (e.name === 'AbortError') throw new Error('Sarvam request timed out (120s)');
    throw e;
  }
}

// ── Model dispatcher — NO silent fallback ──
async function callAI(model: string, prompt: string, wordLimit = 1500): Promise<string> {
  const mt = computeMaxTokens(wordLimit, model);
  console.log(`[generate-blog-article] model_requested=${model} wordLimit=${wordLimit} maxTokens=${mt}`);
  switch (model) {
    case 'gemini': case 'gemini-flash': {
      const { callVertexGemini } = await import('../_shared/vertex-ai.ts');
      return callVertexGemini('gemini-2.5-flash', GEMINI_SYSTEM_PROMPT + '\n\n' + prompt, 60_000, { maxOutputTokens: mt, temperature: 0.65 });
    }
    case 'gemini-pro': {
      const { callVertexGemini } = await import('../_shared/vertex-ai.ts');
      return callVertexGemini('gemini-2.5-pro', GEMINI_SYSTEM_PROMPT + '\n\n' + prompt, 120_000, { maxOutputTokens: mt, temperature: 0.5 });
    }
    case 'lovable-gemini': return callLovableGemini(prompt, mt);
    case 'openai': case 'gpt5': case 'gpt5-mini': return callOpenAI(prompt, mt);
    case 'groq': return callGroq(prompt, mt);
    case 'claude-sonnet':
    case 'claude': return callClaude(prompt, wordLimit);
    case 'mistral': return callMistral(prompt, MISTRAL_SYSTEM_PROMPT, mt);
    case 'vertex-flash': {
      const { callVertexGemini } = await import('../_shared/vertex-ai.ts');
      return callVertexGemini('gemini-2.5-flash', prompt, 60_000, { maxOutputTokens: mt });
    }
    case 'vertex-pro': {
      const { callVertexGemini } = await import('../_shared/vertex-ai.ts');
      return callVertexGemini('gemini-2.5-pro', prompt, 120_000, { maxOutputTokens: mt });
    }
    case 'vertex-3.1-pro': {
      const { callVertexGemini } = await import('../_shared/vertex-ai.ts');
      return callVertexGemini('gemini-3.1-pro-preview', GEMINI_SYSTEM_PROMPT + '\n\n' + prompt, 120_000, { maxOutputTokens: mt, temperature: 0.5 });
    }
    case 'vertex-3-flash': {
      const { callVertexGemini } = await import('../_shared/vertex-ai.ts');
      return callVertexGemini('gemini-3-flash-preview', GEMINI_SYSTEM_PROMPT + '\n\n' + prompt, 90_000, { maxOutputTokens: mt, temperature: 0.65 });
    }
    case 'vertex-3.1-flash-lite': {
      const { callVertexGemini } = await import('../_shared/vertex-ai.ts');
      return callVertexGemini('gemini-3.1-flash-lite-preview', GEMINI_SYSTEM_PROMPT + '\n\n' + prompt, 60_000, { maxOutputTokens: mt, temperature: 0.65 });
    }
    case 'nova-pro': case 'nova-premier': {
      const { callBedrockNova } = await import('../_shared/bedrock-nova.ts');
      return callBedrockNova(model, prompt, { maxTokens: mt, temperature: 0.5 });
    }
    case 'sarvam-30b': case 'sarvam-105b': {
      return callSarvamChat(model, prompt, mt);
    }
    default:
      throw new Error(`Unsupported AI model: "${model}".`);
  }
}

// ═══════════════════════════════════════════════════════════════
// Robust field extraction from malformed JSON
// Handles HTML content with unescaped quotes that break JSON.parse
// ═══════════════════════════════════════════════════════════════

function extractStringField(json: string, field: string): string {
  // Match "field": "value" — handles unescaped quotes inside HTML content
  const keyPattern = new RegExp(`"${field}"\\s*:\\s*"`);
  const match = keyPattern.exec(json);
  if (!match) return '';

  const valueStart = match.index + match[0].length;
  const sub = json.substring(valueStart);

  // For long fields like "content", find the LAST boundary (greedy).
  // For short fields like "title", "slug", etc., find the FIRST boundary
  // that looks like the end of a JSON string value.
  const isLongField = field === 'content';

  // Pattern: closing quote followed by comma+key, comma+bracket, or closing brace
  // We look for `",` followed by a new key `"`, or `"]`, or `"}`
  const boundaryPattern = /"\s*,\s*"|"\s*,\s*\[|"\s*\}|"\s*\]\s*\}/g;

  if (isLongField) {
    // For content: find the last boundary (content is the longest value)
    let lastIdx = -1;
    let m;
    while ((m = boundaryPattern.exec(sub)) !== null) {
      lastIdx = m.index;
    }
    if (lastIdx === -1) return sub.replace(/["}\]\s]+$/, '');
    return sub.substring(0, lastIdx);
  } else {
    // For short fields: find the FIRST boundary that gives a reasonable-length value
    // For title/slug/excerpt etc., the value should be < 1000 chars
    const MAX_SHORT_FIELD = field === 'excerpt' || field === 'metaDescription' ? 2000 : 500;
    let m;
    while ((m = boundaryPattern.exec(sub)) !== null) {
      if (m.index <= MAX_SHORT_FIELD || m.index < sub.length * 0.5) {
        return sub.substring(0, m.index);
      }
    }
    // Fallback: take up to MAX_SHORT_FIELD chars
    const fallback = sub.substring(0, MAX_SHORT_FIELD);
    const lastQuote = fallback.lastIndexOf('"');
    if (lastQuote > 0) return fallback.substring(0, lastQuote);
    return fallback.replace(/["}\]\s]+$/, '');
  }
}

function extractArrayField(json: string, field: string): string[] {
  const pattern = new RegExp(`"${field}"\\s*:\\s*\\[([^\\]]*?)\\]`);
  const match = pattern.exec(json);
  if (!match) return [];
  try {
    return JSON.parse(`[${match[1]}]`);
  } catch {
    // Extract quoted strings manually
    const items: string[] = [];
    const itemPattern = /"([^"]+)"/g;
    let m;
    while ((m = itemPattern.exec(match[1])) !== null) items.push(m[1]);
    return items;
  }
}

function extractFieldsFromBrokenJson(json: string): Record<string, any> | null {
  const title = extractStringField(json, 'title');
  const content = extractStringField(json, 'content');

  if (!title && !content) return null;

  return {
    title: title || 'Untitled',
    slug: extractStringField(json, 'slug') || '',
    content: content || '',
    metaTitle: extractStringField(json, 'metaTitle') || title?.substring(0, 60) || '',
    metaDescription: extractStringField(json, 'metaDescription') || '',
    excerpt: extractStringField(json, 'excerpt') || '',
    category: extractStringField(json, 'category') || '',
    tags: extractArrayField(json, 'tags'),
    primaryKeyword: extractStringField(json, 'primaryKeyword') || '',
    secondaryKeywords: extractArrayField(json, 'secondaryKeywords'),
    suggestedInternalLinks: extractArrayField(json, 'suggestedInternalLinks'),
  };
}

// ═══════════════════════════════════════════════════════════════
// Main handler
// ═══════════════════════════════════════════════════════════════

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  let useModel = 'unknown';
  try {
    const authResult = await verifyAdmin(req);
    if (authResult instanceof Response) return authResult;

    const { topic, category, tags, targetWordCount, aiModel, outputLanguage: rawOutputLang } = await req.json();
    if (!topic || typeof topic !== 'string') {
      return new Response(JSON.stringify({ error: 'topic is required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    useModel = aiModel || 'gemini';
    const outputLanguage = rawOutputLang || 'auto';
    let resolvedLang: 'english' | 'hindi';
    let autoDetected = false;

    if (outputLanguage === 'english' || outputLanguage === 'hindi') {
      resolvedLang = outputLanguage;
    } else {
      autoDetected = true;
      const devCount = (topic.match(/[\u0900-\u097F]/g) || []).length;
      resolvedLang = devCount >= 3 ? 'hindi' : 'english';
    }

    const langInstruction = resolvedLang === 'english'
      ? 'LANGUAGE RULE: Write the entire output in English only. Do not write in Hindi or Devanagari. Do not switch languages. This applies to ALL fields: title, content, meta description, excerpt, FAQ — everything must be in English.'
      : 'LANGUAGE RULE: पूरी सामग्री हिन्दी (देवनागरी) में लिखें। लेख को अंग्रेज़ी में न लिखें। केवल आवश्यक technical terms जैसे SSC, UPSC, salary, notification आदि स्वाभाविक रूप में रखे जा सकते हैं। यह नियम सभी fields पर लागू है: title, content, meta description, excerpt, FAQ — सब कुछ हिन्दी में होना चाहिए।';

    console.log(`[generate-blog-article] model=${useModel} outputLanguage=${outputLanguage} resolvedLang=${resolvedLang} autoDetected=${autoDetected} topicPreview="${topic.substring(0, 60)}"`);

    const wordTarget = Math.min(Math.max(Number(targetWordCount) || 1500, 800), 3000);
    let prompt: string;

    if (useModel === 'gemini' || useModel === 'mistral') {
      // Gemini and Mistral use simplified user prompts — the system prompt handles all writing rules
      const tagsList = Array.isArray(tags) && tags.length > 0 ? `\nTags: ${tags.join(', ')}` : '';
      prompt = `Write a complete, SEO-optimized blog article on the following topic:

Topic: ${topic}${category ? `\nCategory: ${category}` : ''}${tagsList}

Follow all the writing rules and output format specified in your instructions. Return ONLY the JSON object.`;
    } else if (useModel === 'claude-sonnet' || useModel === 'claude') {
      // Claude uses the system prompt in top-level "system" field (handled by callClaude)
      // The user prompt here only contains the task-specific instructions
      const tagsList = Array.isArray(tags) && tags.length > 0 ? tags.join(', ') : '';
      prompt = `Write a complete article for the following input.

Topic: ${topic}
${category ? `Category: ${category}` : ''}
${tagsList ? `Tags: ${tagsList}` : ''}
Target word count: ${wordTarget} words

Important instructions:
- Follow the system SEO and AdSense rules strictly
- Keep the article close to the target word count of ${wordTarget} words
- Do not significantly exceed or undershoot the target
- Make it original, useful, and publishable
- Use proper heading hierarchy
- Include strong search-friendly structure
- Avoid filler
- Make internal linking suggestions relevant to the topic
- Return ONLY a valid JSON object matching the output format in your system instructions. No markdown code blocks.`;
    } else {
      // Default prompt for all other models (OpenAI, Groq, Lovable, Vertex, etc.)
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
- category: suggested category (use provided category if given, or suggest one from: Career Advice, Job Search, Resume, Interview, HR & Recruitment, Hiring Trends, AI in Recruitment, Results & Admit Cards, Exam Preparation, Sarkari Naukri Basics, Career Guides & Tips, Job Information, Government Jobs, Syllabus, Current Affairs, Admit Cards, Uncategorized)
- tags: array of 3-6 relevant tags

Format: {"title": "...", "slug": "...", "content": "...", "metaTitle": "...", "metaDescription": "...", "excerpt": "...", "category": "...", "tags": [...]}
No markdown code blocks. Return ONLY the JSON object.`;
    }

    prompt += '\n\n' + buildWordCountInstruction(wordTarget, useModel);

    const raw = await callAI(useModel, prompt, wordTarget);
    const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    let parsed: any;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      console.warn('[generate-blog-article] JSON.parse failed, attempting regex extraction...');
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? jsonMatch[0] : cleaned;

      // Try direct parse of extracted block
      try {
        parsed = JSON.parse(jsonStr);
      } catch {
        // Try repair: close open strings/brackets/braces
        let repaired = jsonStr;
        const openBraces = (repaired.match(/\{/g) || []).length - (repaired.match(/\}/g) || []).length;
        const openBrackets = (repaired.match(/\[/g) || []).length - (repaired.match(/\]/g) || []).length;
        const quoteCount = (repaired.match(/(?<!\\)"/g) || []).length;
        if (quoteCount % 2 !== 0) repaired += '"';
        for (let i = 0; i < openBrackets; i++) repaired += ']';
        for (let i = 0; i < openBraces; i++) repaired += '}';
        try {
          parsed = JSON.parse(repaired);
          console.log('[generate-blog-article] Repaired truncated JSON successfully');
        } catch {
          // Last resort: extract fields individually via regex
          console.warn('[generate-blog-article] Repair failed, extracting fields via regex...');
          parsed = extractFieldsFromBrokenJson(jsonStr);
          if (!parsed) {
            return new Response(JSON.stringify({ error: 'Failed to parse AI response', raw: cleaned.substring(0, 500) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
          }
          console.log('[generate-blog-article] Regex field extraction succeeded');
        }
      }
    }

    if (!parsed.title || !parsed.content) {
      return new Response(JSON.stringify({ error: 'AI response missing title or content' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const slug = (parsed.slug || parsed.title)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      .substring(0, 120);

    // Normalize category to match DB constraint
    const VALID_CATEGORIES = [
      'Job Search', 'Career Advice', 'Resume', 'Interview', 'HR & Recruitment',
      'Hiring Trends', 'AI in Recruitment', 'Results & Admit Cards', 'Exam Preparation',
      'Sarkari Naukri Basics', 'Career Guides & Tips', 'Job Information', 'Government Jobs',
      'Syllabus', 'Current Affairs', 'Admit Cards', 'Uncategorized',
    ];
    const rawCategory = parsed.category || category || 'Career Advice';
    const normalizedCategory = VALID_CATEGORIES.find(c => c.toLowerCase() === rawCategory.toLowerCase().trim())
      || VALID_CATEGORIES.find(c => rawCategory.toLowerCase().includes(c.toLowerCase()))
      || 'Career Advice';

    const wcMaxTokens = computeMaxTokens(wordTarget, useModel);
    const wcValidation = parsed.content ? validateWordCount(parsed.content, wordTarget, wcMaxTokens) : null;
    const providerInfo = resolveProviderInfo(useModel);

    return new Response(JSON.stringify({
      title: parsed.title,
      slug,
      content: parsed.content,
      metaTitle: parsed.metaTitle || parsed.title.substring(0, 60),
      metaDescription: parsed.metaDescription || '',
      excerpt: parsed.excerpt || '',
      category: normalizedCategory,
      tags: Array.isArray(parsed.tags) ? parsed.tags : [],
      primaryKeyword: parsed.primaryKeyword || '',
      secondaryKeywords: Array.isArray(parsed.secondaryKeywords) ? parsed.secondaryKeywords : [],
      suggestedInternalLinks: Array.isArray(parsed.suggestedInternalLinks) ? parsed.suggestedInternalLinks : [],
      selectedModelId: useModel,
      actualProviderUsed: providerInfo.provider,
      actualModelUsed: providerInfo.apiModel,
      wordCountValidation: wcValidation,
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    console.error('generate-blog-article error:', err);
    return new Response(JSON.stringify({
      error: err instanceof Error ? err.message : 'Unknown error',
      selectedModelId: useModel || 'unknown',
      actualProviderUsed: 'unknown',
      actualModelUsed: 'unknown',
      wordCountValidation: null,
    }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
