import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// ═══════════════════════════════════════════════════════════════════════════════
// ADMIN AUTH
// ═══════════════════════════════════════════════════════════════════════════════

async function verifyAdmin(req: Request): Promise<{ userId: string } | Response> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized — missing token' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const token = authHeader.replace('Bearer ', '');
  const { data, error } = await supabase.auth.getClaims(token);
  if (error || !data?.claims) {
    return new Response(JSON.stringify({ error: 'Unauthorized — invalid token' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  const userId = data.claims.sub as string;
  const svc = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data: roleRow } = await svc.from('user_roles').select('role').eq('user_id', userId).eq('role', 'admin').maybeSingle();
  if (!roleRow) {
    return new Response(JSON.stringify({ error: 'Forbidden — admin role required' }), {
      status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  return { userId };
}

// ═══════════════════════════════════════════════════════════════════════════════
// MASTER AUTHORITY PROMPT (used for ALL models — zero compression)
// ═══════════════════════════════════════════════════════════════════════════════

const MASTER_AUTHORITY_PROMPT = `You are the Chief Content Strategist at TrueJobs.co.in — India's most trusted government job preparation portal. You create definitive, authoritative content pages that serve as the single best resource on the internet for each topic. Your content must satisfy three masters simultaneously: the job seeker who needs accurate, actionable information; Google's ranking algorithm that rewards depth, structure, and E-E-A-T; and Google AdSense policies that require original, high-value content.

Your readers are real people: a 22-year-old graduate in Lucknow preparing for SSC CGL, a working professional in Pune targeting IBPS PO, an Army aspirant in Rajasthan researching NDA, a 12th-pass student in Bihar exploring Railway Group D. Write for THEM.

=== GOOGLE E-E-A-T COMPLIANCE (Experience, Expertise, Authoritativeness, Trustworthiness) ===

Every piece of content must demonstrate:

EXPERIENCE: Write as if authored by someone who has personally navigated the Indian government exam system. Reference real preparation challenges, common mistakes candidates make, and practical tips that only come from experience. Use phrases like "Most candidates make the mistake of..." or "Based on previous year trends..." — NOT generic advice.

EXPERTISE: Include precise technical details — exact pay levels (7th CPC), specific age relaxation rules per category, detailed exam patterns with marks/time/sections, cut-off trends from previous years. Surface-level content fails E-E-A-T.

AUTHORITATIVENESS: Reference official sources by name (ssc.gov.in, upsc.gov.in, ibps.in, rrbcdg.gov.in, indianrailways.gov.in). Mention official notification numbers when relevant. Use exact terminology from official recruitment rules.

TRUSTWORTHINESS: NEVER fabricate data. If you don't have exact figures, state "As per the latest official notification" or "Subject to official confirmation." Include disclaimers where appropriate: "Candidates are advised to verify all details from the official website before applying."

=== GOOGLE ADSENSE COMPLIANCE ===

Content MUST meet AdSense program policies:

1. ORIGINAL VALUE: Every paragraph must provide unique insight, analysis, or structured information not available by simply reading the official notification. Don't just restate the notification — ADD value through structure, comparison, strategy, and context.

2. SUFFICIENT CONTENT DEPTH:
   - Notification pages: minimum 2000 words
   - Syllabus pages: minimum 2500 words
   - Exam Pattern pages: minimum 2000 words
   - Previous Year Paper pages: minimum 1800 words
   - State exam pages: minimum 2500 words
   These are MINIMUMS. Write more if the topic demands it. But never pad — every word must earn its place.

3. NO THIN CONTENT: Google penalizes pages that exist only to show ads. Your content must be the kind a user would bookmark and return to.

4. NO DECEPTIVE CONTENT: Don't promise "guaranteed selection" or "100% success." Use honest, realistic language.

5. NAVIGATIONAL VALUE: Structure content so users can jump to exactly what they need. Use clear heading hierarchy, anchor-friendly section IDs, and a logical flow.

=== SEO DOMINATION STRATEGY ===

TARGET: Every authority page should aim to rank in the top 3 results for its primary keyword cluster.

HEADING STRUCTURE:
- Use proper H2 → H3 → H4 hierarchy (never skip levels)
- H2 headings should be question-based where possible (these win featured snippets)
- Include the primary keyword in at least 3 H2 headings naturally

KEYWORD STRATEGY:
- Use the primary keyword in: first 100 words, 3+ H2 headings, conclusion, meta title, meta description
- Weave 5-8 LSI/long-tail keywords naturally throughout the content
- Include both Hindi and English search terms (users search in both)

FEATURED SNIPPET OPTIMIZATION:
- Answer the most common question about the topic in a clear 40-60 word paragraph within the first 200 words
- Use definition-style answers: "[Exam name] is [clear definition] conducted by [organization] for recruitment to [posts]."
- Include a summary table near the top — Google loves pulling tables into snippets

INTERNAL LINKING:
- Reference related TrueJobs pages naturally within the content
- Suggest 3-5 related page slugs for cross-linking

=== CONTENT STRUCTURE — UNIVERSAL SECTIONS ===

Regardless of page type, ALWAYS include these wrapper sections:

SECTION 1 — Quick Overview Table (ALWAYS FIRST):
<div class="authority-overview-box" style="background:#f0f9ff;border-left:4px solid #0369a1;padding:20px;margin-bottom:24px;border-radius:8px;">
  <h2>📋 [Exam/Job Name] — Quick Overview</h2>
  <table style="width:100%;border-collapse:collapse;">
    <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;"><strong>Conducting Body</strong></td><td style="padding:8px;border-bottom:1px solid #e2e8f0;">[Organization]</td></tr>
    <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;"><strong>Exam/Post Name</strong></td><td style="padding:8px;border-bottom:1px solid #e2e8f0;">[Name]</td></tr>
    <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;"><strong>Vacancies</strong></td><td style="padding:8px;border-bottom:1px solid #e2e8f0;">[Count or Expected]</td></tr>
    <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;"><strong>Eligibility</strong></td><td style="padding:8px;border-bottom:1px solid #e2e8f0;">[Key qualification]</td></tr>
    <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;"><strong>Age Limit</strong></td><td style="padding:8px;border-bottom:1px solid #e2e8f0;">[Range with relaxation]</td></tr>
    <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;"><strong>Salary</strong></td><td style="padding:8px;border-bottom:1px solid #e2e8f0;">[Pay Level + Range]</td></tr>
    <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;"><strong>Application Mode</strong></td><td style="padding:8px;border-bottom:1px solid #e2e8f0;">[Online/Offline]</td></tr>
    <tr><td style="padding:8px;"><strong>Official Website</strong></td><td style="padding:8px;">[URL]</td></tr>
  </table>
</div>

SECTION 2 — Featured Snippet Paragraph: A clear, concise 40-60 word paragraph that directly answers "What is [exam/topic]?" — optimized for Google's featured snippet box.

THEN — Page-Type-Specific Sections (defined in the prompt below).

FINAL SECTION — FAQ (ALWAYS LAST):
<div class="faq-section" itemscope itemtype="https://schema.org/FAQPage">
  <h2>Frequently Asked Questions</h2>
  <div class="faq-item" itemscope itemprop="mainEntity" itemtype="https://schema.org/Question">
    <h3 itemprop="name">[Specific question job seekers actually search for]</h3>
    <div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer">
      <p itemprop="text">[Direct 2-3 sentence answer with specific data]</p>
    </div>
  </div>
</div>

FAQ counts by page type: Notification: 6-8, Syllabus: 5-7, Exam Pattern: 5-7, PYP: 4-6, State: 6-8.
Every FAQ must be a question real people type into Google. Include the exam name in each question.

=== ABSOLUTE CONTENT QUALITY RULES ===

ZERO FILLER — THESE PHRASES ARE BANNED: "In today's competitive world..." | "This is a golden opportunity..." | "As we all know..." | "It is important to note..." | "Interested candidates are advised..." | "Don't miss this opportunity..." | "In this comprehensive guide..." | "Let's dive in..." | "Without further ado..." | "Last but not least..." | "At the end of the day..." | "It goes without saying..." | "Needless to say..." | Any sentence that restates what was already said

SPECIFIC DATA MANDATE:
- BAD: "The salary is attractive" → GOOD: "Pay Level 6: ₹35,400-₹1,12,400 per month + DA (currently 50%) + HRA (city-dependent) ≈ in-hand ₹45,000-₹55,000"
- BAD: "There are many vacancies" → GOOD: "Total 14,582 vacancies: UR (6,520), OBC (3,870), SC (2,187), ST (1,020), EWS (985)"
- If exact data is not available, state "As per official notification" — NEVER make up numbers.

USE TABLES FOR: All vacancy breakdowns, salary comparisons, exam patterns, important dates, cut-off data, eligibility by category, topic weightage, PYP analysis.

FORMATTING:
- Bold: dates, salary figures, age limits, vacancy numbers, deadlines, website URLs
- Bullet points: eligibility criteria, document lists, benefits, step-by-step processes
- Numbered lists: application steps, preparation phases, selection stages
- Paragraphs: maximum 3 sentences each
- Use proper semantic HTML: h2, h3, h4, p, table, ul, ol, strong, em

LANGUAGE:
- Write in English (authority pages targeting English search terms)
- Include Hindi transliterations for key terms in parentheses where it helps SEO: "Staff Selection Commission (कर्मचारी चयन आयोग)"

TRUSTWORTHINESS SIGNALS:
- Reference official websites with full URLs
- Use phrases: "According to the official notification...", "As published on [official website]...", "Based on previous year data..."
- Include disclaimer at the end: "Note: All information is based on the latest available official notification. Candidates are advised to visit the official website for the most current details."

=== OUTPUT JSON FORMAT ===

Return ONLY a valid JSON object matching the existing schema expected by the page type. Additionally, ALWAYS include these fields regardless of page type:

"overview": "string (HTML — featured snippet optimized, 60-80 words)"
"faq": [{"question": "string", "answer": "string"}, ...]
"meta_title": "string (under 60 characters, primary keyword included)"
"meta_description": "string (under 155 characters, with urgency/hook)"
"internal_links": ["slug-1", "slug-2", "slug-3"]
"primary_keyword": "string"
"secondary_keywords": ["array of 5-8 LSI keywords"]

=== FINAL QUALITY CHECKLIST (mental review before submitting) ===
✓ Is every paragraph providing specific, useful data?
✓ Are there zero banned filler phrases?
✓ Would this page be the BEST result on Google for its topic?
✓ Does it have enough depth to justify AdSense ads? (not thin content)
✓ Are all tables properly formatted with real data?
✓ Does the FAQ section contain questions people actually Google?
✓ Are official sources referenced by name and URL?
✓ Is there a trust disclaimer at the end?
✓ Would a student in a small town find this genuinely helpful?
If any check fails, fix it before returning.
`;

// ═══════════════════════════════════════════════════════════════════════════════
// MODEL-SPECIFIC TIMEOUTS
// ═══════════════════════════════════════════════════════════════════════════════

const TIMEOUTS: Record<string, number> = {
  'gemini-flash': 60_000,
  'gemini-pro': 60_000,
  'claude-sonnet': 145_000,
  'claude': 145_000,
  'mistral': 120_000,
  'groq': 30_000,
  'lovable-gemini': 60_000,
  'gpt5': 60_000,
  'gpt5-mini': 60_000,
};

function getTimeout(model: string): number {
  return TIMEOUTS[model] || 60_000;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODEL INTEGRATIONS
// ═══════════════════════════════════════════════════════════════════════════════

// ── Gemini (Direct API) ──
async function fetchGemini(prompt: string, model = 'gemini-2.5-flash', timeoutMs = 60_000): Promise<string> {
  const apiKey = Deno.env.get('GEMINI_API_KEY');
  if (!apiKey) throw new Error('GEMINI_API_KEY not configured — please add it to secrets');

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.5,
          topP: 0.8,
          maxOutputTokens: 16384,
          responseMimeType: 'application/json',
        },
      }),
    });

    if (response.status === 429) {
      console.warn('Gemini 429 — retrying in 5s...');
      await new Promise(r => setTimeout(r, 5000));
      const retry = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.5, topP: 0.8, maxOutputTokens: 16384, responseMimeType: 'application/json' },
        }),
      });
      if (!retry.ok) throw new Error(`Gemini retry failed: ${retry.status}`);
      const d = await retry.json();
      return d.candidates?.[0]?.content?.parts?.[0]?.text || '';
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API error ${response.status}: ${errorText.substring(0, 500)}`);
    }
    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  } finally {
    clearTimeout(timer);
  }
}

// ── Claude Sonnet 4.6 (Direct Anthropic API) ──
async function callClaudeRaw(prompt: string, timeoutMs = 145_000): Promise<string> {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured — please add it to secrets');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 12288,
        temperature: 0.6,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Claude API error ${response.status}: ${errorText.substring(0, 500)}`);
    }
    const data = await response.json();
    return data.content?.[0]?.text || '';
  } finally {
    clearTimeout(timer);
  }
}

// ── Groq (NEW — Llama 3.3 70B) ──
async function callGroqRaw(prompt: string, timeoutMs = 30_000): Promise<string> {
  const apiKey = Deno.env.get('GROQ_API_KEY');
  if (!apiKey) throw new Error('GROQ_API_KEY not configured — please add it to secrets');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.5,
        max_tokens: 16384,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Groq API error ${response.status}: ${errorText.substring(0, 500)}`);
    }
    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
  } finally {
    clearTimeout(timer);
  }
}

// ── AWS SigV4 helpers for Bedrock ──
async function hmacSha256(key: Uint8Array, message: string): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(message));
  return new Uint8Array(sig);
}

async function sha256Hex(data: string): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data));
  return [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, '0')).join('');
}

async function getSigningKey(secretKey: string, dateStamp: string, region: string, service: string): Promise<Uint8Array> {
  let key = await hmacSha256(new TextEncoder().encode('AWS4' + secretKey), dateStamp);
  key = await hmacSha256(key, region);
  key = await hmacSha256(key, service);
  key = await hmacSha256(key, 'aws4_request');
  return key;
}

async function awsSigV4Fetch(url: string, body: string, region: string, service: string, timeoutMs: number): Promise<Response> {
  const accessKey = Deno.env.get('AWS_ACCESS_KEY_ID');
  const secretKey = Deno.env.get('AWS_SECRET_ACCESS_KEY');
  if (!accessKey || !secretKey) throw new Error('AWS credentials not configured — please add AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY secrets');

  const parsedUrl = new URL(url);
  const now = new Date();
  const amzDate = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const dateStamp = amzDate.substring(0, 8);
  const payloadHash = await sha256Hex(body);
  const canonicalPath = parsedUrl.pathname.split('/').map(s => encodeURIComponent(decodeURIComponent(s))).join('/');

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Host': parsedUrl.host,
    'X-Amz-Date': amzDate,
    'X-Amz-Content-Sha256': payloadHash,
  };

  const signedHeaderKeys = Object.keys(headers).sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
  const signedHeaders = signedHeaderKeys.map(k => k.toLowerCase()).join(';');
  const canonicalHeaders = signedHeaderKeys.map(k => `${k.toLowerCase()}:${headers[k].trim()}`).join('\n') + '\n';
  const canonicalRequest = ['POST', canonicalPath, '', canonicalHeaders, signedHeaders, payloadHash].join('\n');

  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, credentialScope, await sha256Hex(canonicalRequest)].join('\n');
  const signingKey = await getSigningKey(secretKey, dateStamp, region, service);
  const signatureBytes = await hmacSha256(signingKey, stringToSign);
  const signature = [...signatureBytes].map(b => b.toString(16).padStart(2, '0')).join('');

  headers['Authorization'] = `AWS4-HMAC-SHA256 Credential=${accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { method: 'POST', headers, body, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// ── Mistral Large (AWS Bedrock — us-east-1) ──
async function callMistralRaw(prompt: string, timeoutMs = 60_000): Promise<string> {
  const region = 'us-west-2';
  const modelId = 'mistral.mistral-large-2407-v1:0';
  const url = `https://bedrock-runtime.${region}.amazonaws.com/model/${modelId}/invoke`;

  const body = JSON.stringify({
    prompt: `<s>[INST] ${prompt} [/INST]`,
    max_tokens: 16384,
    temperature: 0.5,
    top_p: 0.9,
  });

  const response = await awsSigV4Fetch(url, body, region, 'bedrock', timeoutMs);
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Mistral/Bedrock error ${response.status}: ${errorText.substring(0, 500)}`);
  }
  const data = await response.json();
  return data.outputs?.[0]?.text || '';
}

// ── Lovable Gemini (Gateway) ──
async function callLovableGeminiRaw(prompt: string, timeoutMs = 60_000): Promise<string> {
  const apiKey = Deno.env.get('LOVABLE_API_KEY');
  if (!apiKey) throw new Error('LOVABLE_API_KEY not configured — please add it to secrets');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.5,
        max_tokens: 16384,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Lovable Gemini error ${response.status}: ${errorText.substring(0, 500)}`);
    }
    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
  } finally {
    clearTimeout(timer);
  }
}

// ── OpenAI GPT-5 / GPT-5 Mini (via Lovable AI Gateway) ──
async function callOpenAIRaw(prompt: string, model = 'openai/gpt-5', timeoutMs = 60_000): Promise<string> {
  const apiKey = Deno.env.get('LOVABLE_API_KEY');
  if (!apiKey) throw new Error('LOVABLE_API_KEY not configured — please add it to secrets');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.5,
        max_completion_tokens: 16384,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI (${model}) error ${response.status}: ${errorText.substring(0, 500)}`);
    }
    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
  } finally {
    clearTimeout(timer);
  }
}

// ── Smart JSON Recovery (4-stage) ──
function tryParseJSON(raw: string): Record<string, unknown> {
  // Stage 1: direct parse
  try { return JSON.parse(raw); } catch { /* continue */ }

  // Stage 2: strip markdown fences
  let cleaned = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
  try { return JSON.parse(cleaned); } catch { /* continue */ }

  // Stage 3: extract boundaries
  const first = cleaned.indexOf('{');
  const last = cleaned.lastIndexOf('}');
  if (first !== -1 && last > first) {
    const extracted = cleaned.substring(first, last + 1);
    try { return JSON.parse(extracted); } catch { /* continue */ }

    // Stage 4: truncate — find last complete key-value and close
    const lastComma = extracted.lastIndexOf(',');
    const lastColon = extracted.lastIndexOf(':');
    if (lastComma > 0 || lastColon > 0) {
      const cutPoint = Math.max(lastComma, extracted.lastIndexOf('"}'));
      if (cutPoint > 0) {
        const truncated = extracted.substring(0, cutPoint + (extracted[cutPoint] === '"' ? 2 : 1));
        let balanced = truncated;
        const openBrackets = (balanced.match(/\[/g) || []).length - (balanced.match(/\]/g) || []).length;
        const openBraces = (balanced.match(/\{/g) || []).length - (balanced.match(/\}/g) || []).length;
        for (let i = 0; i < openBrackets; i++) balanced += ']';
        for (let i = 0; i < openBraces; i++) balanced += '}';
        try { return JSON.parse(balanced); } catch { /* fall through */ }
      }
    }
  }

  throw new Error(`Failed to parse JSON from AI response (length=${raw.length})`);
}

// ── AI Dispatcher (one slug, one model call) ──
async function callAI(model: string, prompt: string): Promise<Record<string, unknown>> {
  const timeout = getTimeout(model);
  let rawText: string;

  switch (model) {
    case 'gemini-flash':
    case 'gemini':
      rawText = await fetchGemini(prompt, 'gemini-2.5-flash', timeout);
      break;
    case 'gemini-pro':
      rawText = await fetchGemini(prompt, 'gemini-2.5-pro', timeout);
      break;
    case 'claude-sonnet':
    case 'claude':
      rawText = await callClaudeRaw(prompt, timeout);
      break;
    case 'groq':
      rawText = await callGroqRaw(prompt, timeout);
      break;
    case 'mistral':
      rawText = await callMistralRaw(prompt, timeout);
      break;
    case 'lovable-gemini':
      rawText = await callLovableGeminiRaw(prompt, timeout);
      break;
    case 'gpt5':
      rawText = await callOpenAIRaw(prompt, 'openai/gpt-5', timeout);
      break;
    case 'gpt5-mini':
      rawText = await callOpenAIRaw(prompt, 'openai/gpt-5-mini', timeout);
      break;
    default:
      console.warn(`Unknown model "${model}", defaulting to gemini-flash`);
      rawText = await fetchGemini(prompt, 'gemini-2.5-flash', timeout);
  }

  return tryParseJSON(rawText);
}

// ═══════════════════════════════════════════════════════════════════════════════
// PROMPT BUILDERS (page-type-specific JSON field definitions)
// ═══════════════════════════════════════════════════════════════════════════════

interface PageContent {
  slug: string;
  examName?: string;
  conductingBody?: string;
  year?: number;
  existingOverview?: string;
  existingWordCount?: number;
  existingSections?: string[];
}

function buildNotificationPrompt(page: PageContent): string {
  return `
=== PAGE-TYPE: NOTIFICATION ===

Exam: "${page.examName || page.slug}"
Conducting Body: ${page.conductingBody || 'the official recruitment authority'}
Year: ${page.year || 2026}

PAGE-SPECIFIC SECTIONS to include (in addition to universal sections from master prompt):
1. Overview & Latest Update (what's new, when notification was released)
2. Complete Eligibility Criteria (education, age with full category-wise relaxation table, nationality, physical standards if applicable)
3. Vacancy Details (category-wise breakdown table: UR/OBC/SC/ST/EWS/PwD)
4. Exam Pattern & Selection Process (stages, marks, duration, negative marking — use tables)
5. Salary Structure & Benefits (Pay Level, Grade Pay, in-hand estimate, DA/HRA/TA, pension, perks)
6. How to Apply — Step by Step (numbered steps, documents needed, fee breakup by category)
7. Important Dates Table (notification, start, last date, exam, admit card, result)
8. Preparation Tips (subject-wise strategy, time allocation, recommended approach)
9. Previous Year Cut-off Trends (table showing last 2-3 years if available)
10. Important Links (official site, notification PDF, apply link)

MINIMUM: 2000 words. FAQs: 6-8.

Existing overview for reference (enrich, don't duplicate): ${(page.existingOverview || '').substring(0, 500)}

OUTPUT FORMAT — Return valid JSON with these keys:
{
  "overview": "300-450 word HTML overview with Quick Overview Table",
  "eligibility": "250-350 words on eligibility with category-wise table",
  "vacancyDetails": "150-250 words with vacancy breakdown table",
  "examPattern": "200-300 words on exam pattern with table",
  "salary": "200-300 words on salary structure with Pay Levels",
  "applicationProcess": "150-200 words step-by-step how to apply",
  "importantDates": "HTML table of all important dates",
  "preparationTips": "250-350 words with exam-specific strategy",
  "cutoffTrends": "150-250 words with previous year cutoff table",
  "importantLinks": "HTML list of important links",
  "faq": [{"question": "...", "answer": "..."}, ...],
  "meta_title": "under 60 chars",
  "meta_description": "under 155 chars",
  "internal_links": ["slug-1", "slug-2", "slug-3"],
  "primary_keyword": "string",
  "secondary_keywords": ["keyword1", "keyword2", ...]
}

Return ONLY the JSON object.`;
}

function buildSyllabusPrompt(page: PageContent): string {
  return `
=== PAGE-TYPE: SYLLABUS ===

Exam: "${page.examName || page.slug}"
Conducting Body: ${page.conductingBody || 'official authority'}
Year: ${page.year || 2026}

PAGE-SPECIFIC SECTIONS:
1. Syllabus Overview (what the exam tests, total subjects, overall structure)
2. Tier/Stage-wise Detailed Syllabus (every subject, every topic, organized by exam stage — use nested lists)
3. Subject-wise Detailed Breakdown (each subject gets its own H3 with complete topic list)
4. Topic-wise Weightage Analysis (table showing which topics get most questions based on previous years)
5. Important Topics to Focus On (high-yield topics ranked by frequency)
6. Recommended Books & Resources (specific book names with author — for each subject)
7. Subject-wise Preparation Strategy (how to approach each subject, time allocation)
8. Common Mistakes in Preparation (what candidates do wrong, how to avoid it)

MINIMUM: 2500 words. FAQs: 5-7.

OUTPUT FORMAT — Return valid JSON:
{
  "overview": "250-350 word HTML overview with Quick Overview Table",
  "tierWiseSyllabus": "400-500 words with stage-wise breakdown",
  "subjectWiseBreakdown": "400-500 words with detailed topic lists",
  "topicWeightage": "200-300 words with weightage table",
  "importantTopics": "200-300 words on high-yield topics",
  "recommendedBooks": "200-250 words with book recommendations table",
  "preparationStrategy": "250-300 words on subject-wise approach",
  "commonMistakes": "150-200 words on common preparation errors",
  "faq": [{"question": "...", "answer": "..."}, ...],
  "meta_title": "under 60 chars",
  "meta_description": "under 155 chars",
  "internal_links": ["slug-1", "slug-2", "slug-3"],
  "primary_keyword": "string",
  "secondary_keywords": ["keyword1", "keyword2", ...]
}

Return ONLY the JSON object.`;
}

function buildExamPatternPrompt(page: PageContent): string {
  return `
=== PAGE-TYPE: EXAM PATTERN ===

Exam: "${page.examName || page.slug}"
Conducting Body: ${page.conductingBody || 'official authority'}
Year: ${page.year || 2026}

PAGE-SPECIFIC SECTIONS:
1. Exam Pattern Overview (total stages, mode — online/offline, languages)
2. Stage-wise Detailed Pattern (table: sections, questions, marks, time, negative marking for EACH stage)
3. Marking Scheme Explained (positive marks, negative marks, normalization if applicable)
4. Section-wise Time Distribution (recommended time per section)
5. Difficulty Level Analysis (based on previous years — easy/moderate/hard distribution)
6. Normalization Process (if applicable — how raw scores are normalized, with examples)
7. Smart Time Management Strategy (section-wise approach, which to attempt first)
8. Changes from Previous Year (if the pattern changed, highlight what's different)

MINIMUM: 2000 words. FAQs: 5-7.

OUTPUT FORMAT — Return valid JSON:
{
  "overview": "250-350 word HTML overview with Quick Overview Table",
  "stageWisePattern": "350-450 words with detailed pattern tables",
  "markingScheme": "200-300 words on marks and negative marking",
  "timeDistribution": "150-250 words on section-wise time allocation",
  "difficultyInsights": "200-300 words on difficulty trends",
  "normalization": "150-250 words on normalization/scoring methodology",
  "timeManagement": "200-300 words on time management strategy",
  "patternChanges": "100-200 words on changes from previous year",
  "faq": [{"question": "...", "answer": "..."}, ...],
  "meta_title": "under 60 chars",
  "meta_description": "under 155 chars",
  "internal_links": ["slug-1", "slug-2", "slug-3"],
  "primary_keyword": "string",
  "secondary_keywords": ["keyword1", "keyword2", ...]
}

Return ONLY the JSON object.`;
}

function buildPYPPrompt(page: PageContent): string {
  return `
=== PAGE-TYPE: PREVIOUS YEAR PAPERS ===

Exam: "${page.examName || page.slug}"
Year: ${page.year || 2026}

PAGE-SPECIFIC SECTIONS:
1. PYP Overview (how many years analyzed, what insights are covered)
2. Year-wise Topic Distribution (table showing topics asked each year)
3. Subject-wise Trend Analysis (which subjects are getting more questions over time)
4. Difficulty Trend (is the exam getting harder? data-backed analysis)
5. Most Repeated Topics (top 15-20 topics that appear most frequently — ranked list)
6. Subject-wise Weightage Table (percentage of questions from each subject/topic)
7. Preparation Insights from PYP (what the trends tell us about how to prepare)
8. Expected Pattern for Next Exam (prediction based on trends)

MINIMUM: 1800 words. FAQs: 4-6.

OUTPUT FORMAT — Return valid JSON:
{
  "overview": "250-300 word HTML overview",
  "topicTrends": "300-400 words with year-wise topic distribution table",
  "subjectTrends": "200-300 words on subject-wise trends",
  "difficultyAnalysis": "200-300 words comparing difficulty year-wise",
  "repeatedTopics": "200-300 words with ranked list of most repeated topics",
  "subjectWeightage": "200-300 words with weightage table",
  "preparationInsights": "200-300 words on using PYPs effectively",
  "expectedPattern": "150-200 words on predictions for next exam",
  "faq": [{"question": "...", "answer": "..."}, ...],
  "meta_title": "under 60 chars",
  "meta_description": "under 155 chars",
  "internal_links": ["slug-1", "slug-2", "slug-3"],
  "primary_keyword": "string",
  "secondary_keywords": ["keyword1", "keyword2", ...]
}

Return ONLY the JSON object.`;
}

function buildStatePrompt(page: PageContent): string {
  const stateName = page.examName || page.slug.replace('govt-jobs-', '').replace(/-/g, ' ');
  return `
=== PAGE-TYPE: STATE GOVERNMENT JOBS ===

State: "${stateName}"

PAGE-SPECIFIC SECTIONS:
1. State Overview (which state, major recruiting bodies, exam ecosystem)
2. Major Recruiting Organizations (each body gets its own section — PSC, SSB, Police board, etc. Use ACTUAL names for ${stateName})
3. Popular State Exams (list of top 10-15 exams with brief description, eligibility, frequency)
4. Important Government Departments Hiring (department-wise breakdown with typical posts)
5. Eligibility Patterns (common eligibility criteria across state exams)
6. State-specific Application Process (any unique state portal, registration process)
7. Salary Structure in State Government (pay matrix, comparison with central government)
8. Preparation Strategy for State Exams (how it differs from central exams, state-specific topics)

CRITICAL: Content MUST be unique to ${stateName}. Reference the ACTUAL State Public Service Commission name, real state-level recruiting bodies, departments, and boards. Do NOT use generic text that could apply to any state.

MINIMUM: 2500 words. FAQs: 6-8.

OUTPUT FORMAT — Return valid JSON:
{
  "overview": "350-500 word HTML overview unique to ${stateName} with actual PSC name and major bodies",
  "majorRecruitingBodies": "250-350 words with actual names of recruiting organizations",
  "popularStateExams": "300-400 words on popular state-level competitive exams",
  "importantDepartments": "200-300 words on major departments actively recruiting",
  "eligibilityPatterns": "150-250 words on common eligibility across state exams",
  "applicationGuidance": "150-200 words on state-specific application process",
  "salaryStructure": "200-300 words on state pay matrix and comparison",
  "preparationStrategy": "200-300 words on state-specific preparation approach",
  "faq": [{"question": "...", "answer": "..."}, ...],
  "meta_title": "under 60 chars",
  "meta_description": "under 155 chars",
  "internal_links": ["slug-1", "slug-2", "slug-3"],
  "primary_keyword": "string",
  "secondary_keywords": ["keyword1", "keyword2", ...]
}

Return ONLY the JSON object.`;
}

function getPromptForType(pageType: string, page: PageContent): string {
  let typePrompt: string;
  switch (pageType) {
    case 'notification': typePrompt = buildNotificationPrompt(page); break;
    case 'syllabus': typePrompt = buildSyllabusPrompt(page); break;
    case 'exam-pattern': typePrompt = buildExamPatternPrompt(page); break;
    case 'pyp': typePrompt = buildPYPPrompt(page); break;
    case 'state': typePrompt = buildStatePrompt(page); break;
    default: typePrompt = buildNotificationPrompt(page);
  }
  // ALL models get the FULL MASTER_AUTHORITY_PROMPT — zero compression
  return MASTER_AUTHORITY_PROMPT + '\n\n' + typePrompt;
}

// ═══════════════════════════════════════════════════════════════════════════════
// QUALITY CHECKS
// ═══════════════════════════════════════════════════════════════════════════════

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function getMinWordCount(pageType: string): number {
  switch (pageType) {
    case 'notification': return 2000;
    case 'syllabus': return 2500;
    case 'exam-pattern': return 2000;
    case 'pyp': return 1800;
    case 'state': return 2500;
    default: return 2000;
  }
}

function computeQualityScore(enrichmentData: Record<string, unknown>, pageType: string): {
  wordScore: number;
  sectionScore: number;
  uniquenessScore: number;
  internalLinkScore: number;
  totalWords: number;
  sectionCount: number;
} {
  let totalWords = 0;
  let sectionCount = 0;

  for (const [key, value] of Object.entries(enrichmentData)) {
    if (key === 'faq' && Array.isArray(value)) {
      for (const faq of value) {
        totalWords += countWords(faq.question || '') + countWords(faq.answer || '');
      }
      sectionCount += 1;
    } else if (typeof value === 'string') {
      totalWords += countWords(value);
      sectionCount += 1;
    }
  }

  const minWords = getMinWordCount(pageType);
  const wordScore = totalWords >= minWords ? 10 : totalWords >= minWords * 0.7 ? 7 : totalWords >= minWords * 0.4 ? 4 : 2;
  const sectionScore = sectionCount >= 7 ? 10 : sectionCount >= 5 ? 7 : sectionCount >= 3 ? 4 : 2;
  const uniquenessScore = 8;
  const internalLinkScore = Array.isArray(enrichmentData.internal_links) ? Math.min(10, enrichmentData.internal_links.length * 2) : 3;

  return { wordScore, sectionScore, uniquenessScore, internalLinkScore, totalWords, sectionCount };
}

function generateInternalLinks(pageType: string, slug: string): string[] {
  const links: string[] = [];

  if (pageType === 'notification') {
    const base = slug.replace(/-notification$/, '');
    links.push(`/${base}-syllabus`, `/${base}-exam-pattern`, `/${base}-salary`);
    links.push('/govt-job-age-calculator', '/govt-salary-calculator');
  } else if (pageType === 'syllabus') {
    const base = slug.replace(/-syllabus$/, '');
    links.push(`/${base}-notification`, `/${base}-exam-pattern`);
  } else if (pageType === 'exam-pattern') {
    const base = slug.replace(/-exam-pattern$/, '');
    links.push(`/${base}-notification`, `/${base}-syllabus`);
  } else if (pageType === 'pyp') {
    links.push('/sarkari-jobs');
  } else if (pageType === 'state') {
    links.push('/sarkari-jobs', '/ssc-jobs', '/railway-jobs', '/banking-jobs');
  }

  return links.slice(0, 6);
}

// ═══════════════════════════════════════════════════════════════════════════════
// DUPLICATE DETECTION
// ═══════════════════════════════════════════════════════════════════════════════

function simpleHash(text: string): string {
  let hash = 0;
  const str = text.substring(0, 200).toLowerCase().replace(/\s+/g, ' ').trim();
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(36);
}

async function checkDuplicates(
  svc: ReturnType<typeof createClient>,
  enrichmentData: Record<string, unknown>,
  currentSlug: string,
): Promise<string[]> {
  const flags: string[] = [];
  const overview = typeof enrichmentData.overview === 'string' ? enrichmentData.overview : '';
  if (!overview) return flags;

  const newHash = simpleHash(overview);

  const { data: existing } = await svc
    .from('content_enrichments')
    .select('page_slug, enrichment_data')
    .neq('page_slug', currentSlug)
    .limit(100);

  if (existing) {
    for (const row of existing) {
      const existingOverview = (row.enrichment_data as Record<string, unknown>)?.overview;
      if (typeof existingOverview === 'string') {
        const existingHash = simpleHash(existingOverview);
        if (existingHash === newHash) {
          flags.push(`DUPLICATE_RISK: Overview similar to ${row.page_slug}`);
        }
      }
    }
  }

  return flags;
}

// ═══════════════════════════════════════════════════════════════════════════════
// INSERT HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

async function insertVersion(
  svc: ReturnType<typeof createClient>,
  params: {
    slug: string;
    pageType: string;
    enrichmentData: Record<string, unknown>;
    status: string;
    sectionsAdded: string[];
    internalLinks: string[];
    qualityScore: Record<string, number>;
    flags: string[];
    wordCount: number;
    sectionCount: number;
    failureReason?: string | null;
  },
): Promise<{ version: number | null; error: string | null }> {
  const { data, error } = await svc.rpc('insert_enrichment_version', {
    p_page_slug: params.slug,
    p_page_type: params.pageType,
    p_enrichment_data: params.enrichmentData,
    p_status: params.status,
    p_sections_added: params.sectionsAdded,
    p_internal_links_added: params.internalLinks,
    p_quality_score: params.qualityScore,
    p_flags: params.flags,
    p_current_word_count: params.wordCount,
    p_current_section_count: params.sectionCount,
    p_failure_reason: params.failureReason ?? null,
  });

  if (error) return { version: null, error: error.message };
  return { version: data as number, error: null };
}

async function insertFailedRow(
  svc: ReturnType<typeof createClient>,
  slug: string,
  pageType: string,
  failureReason: string,
  wordCount: number,
): Promise<void> {
  try {
    await insertVersion(svc, {
      slug,
      pageType,
      enrichmentData: {},
      status: 'failed',
      sectionsAdded: [],
      internalLinks: [],
      qualityScore: {},
      flags: [],
      wordCount,
      sectionCount: 0,
      failureReason,
    });
  } catch {
    console.error(`Failed to persist failure row for ${slug}`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN HANDLER — ONE SLUG PER INVOCATION
// ═══════════════════════════════════════════════════════════════════════════════

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authResult = await verifyAdmin(req);
    if (authResult instanceof Response) return authResult;

    const body = await req.json();

    // ── Backward compat: accept both { slug } and { slugs: [...] } ──
    let slug: string;
    let pageType: string;
    let currentContent: PageContent | undefined;
    let selectedModel: string;

    if (body.slug && typeof body.slug === 'string') {
      // New format: single slug
      slug = body.slug;
      pageType = body.pageType || 'notification';
      currentContent = body.currentContent || { slug };
      selectedModel = body.aiModel || 'gemini-flash';
    } else if (Array.isArray(body.slugs) && body.slugs.length > 0) {
      // Legacy format: array — process only the first slug
      slug = body.slugs[0];
      pageType = body.pageType || 'notification';
      const contentArr = body.currentContent as PageContent[] | undefined;
      currentContent = contentArr?.find((c: PageContent) => c.slug === slug) || { slug };
      selectedModel = body.aiModel || 'gemini-flash';
    } else {
      return new Response(JSON.stringify({ error: 'slug (string) is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[enrich] Processing single slug: ${slug}, model=${selectedModel}, type=${pageType}`);

    const svc = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const existingWordCount = (currentContent as { existingWordCount?: number })?.existingWordCount || 0;

    // ── Step 1: Call AI ──
    let enrichmentData: Record<string, unknown>;
    try {
      const prompt = getPromptForType(pageType, currentContent!);
      console.log(`[enrich] ${slug}: calling ${selectedModel}, prompt ${prompt.length} chars, timeout ${getTimeout(selectedModel)}ms`);
      enrichmentData = await callAI(selectedModel, prompt);
      console.log(`[enrich] ${slug}: AI returned successfully`);
    } catch (aiErr) {
      const isAbort = aiErr instanceof Error && (
        aiErr.message.toLowerCase().includes('aborted') || aiErr.message.toLowerCase().includes('signal')
      );
      const reason = `AI_ERROR (${selectedModel}): ${isAbort ? `Timeout after ${getTimeout(selectedModel) / 1000}s` : (aiErr instanceof Error ? aiErr.message : 'Unknown')}`;
      console.error(`[enrich] ${slug}: ${reason}`);
      await insertFailedRow(svc, slug, pageType, reason, existingWordCount);

      return new Response(JSON.stringify({
        status: 'failed',
        slug,
        error: reason,
        results: [{
          slug, status: 'failed', sectionsAdded: [], qualityScore: {},
          flags: [], totalWords: 0, failureReason: reason,
        }],
      }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── Step 2: Quality scoring ──
    const quality = computeQualityScore(enrichmentData, pageType);
    const internalLinks = generateInternalLinks(pageType, slug);
    const dupFlags = await checkDuplicates(svc, enrichmentData, slug);
    const allFlags: string[] = [...dupFlags];

    const minWords = getMinWordCount(pageType);
    if (quality.totalWords < minWords * 0.25) {
      allFlags.push(`LOW_WORD_COUNT: Generated content below ${Math.round(minWords * 0.25)} words (minimum ${minWords})`);
    } else if (quality.totalWords < minWords * 0.5) {
      allFlags.push(`MODERATE_WORD_COUNT: Content at ${quality.totalWords} words, well below ${minWords} target`);
    } else if (quality.totalWords < minWords) {
      allFlags.push(`BELOW_TARGET: Content at ${quality.totalWords} words, target is ${minWords}`);
    }

    const sectionsAdded = Object.keys(enrichmentData).filter(k => {
      if (k === 'faq') return Array.isArray(enrichmentData[k]) && (enrichmentData[k] as unknown[]).length > 0;
      if (Array.isArray(enrichmentData[k])) return (enrichmentData[k] as unknown[]).length > 0;
      return typeof enrichmentData[k] === 'string' && (enrichmentData[k] as string).length > 50;
    });

    const qualityScore = {
      wordScore: quality.wordScore,
      sectionScore: quality.sectionScore,
      uniquenessScore: quality.uniquenessScore,
      internalLinkScore: quality.internalLinkScore,
    };

    // ── Step 3: Insert via RPC ──
    const { version, error: insertError } = await insertVersion(svc, {
      slug,
      pageType,
      enrichmentData,
      status: 'draft',
      sectionsAdded,
      internalLinks,
      qualityScore,
      flags: allFlags,
      wordCount: quality.totalWords,
      sectionCount: quality.sectionCount,
    });

    if (insertError) {
      const reason = `DB_ERROR: ${insertError}`;
      await insertFailedRow(svc, slug, pageType, reason, existingWordCount);
      return new Response(JSON.stringify({
        status: 'failed',
        slug,
        error: reason,
        results: [{
          slug, status: 'failed', sectionsAdded, qualityScore,
          flags: [...allFlags, reason], totalWords: quality.totalWords, failureReason: reason,
        }],
      }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const resultStatus = allFlags.length > 0 ? 'flagged' : 'success';
    const result = {
      slug,
      status: resultStatus,
      sectionsAdded,
      qualityScore,
      flags: allFlags,
      totalWords: quality.totalWords,
      version: version ?? undefined,
    };

    return new Response(JSON.stringify({
      status: resultStatus,
      slug,
      model: selectedModel,
      totalWords: quality.totalWords,
      sectionCount: quality.sectionCount,
      version,
      results: [result],
    }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('enrich-authority-pages error:', error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Unknown error',
    }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
