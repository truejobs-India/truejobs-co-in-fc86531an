import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Recursively remove keys where value is null, "null", or "" */
function deepCleanNulls(obj: any): any {
  if (Array.isArray(obj)) {
    return obj
      .map(deepCleanNulls)
      .filter((v: any) => v !== null && v !== "null" && v !== "");
  }
  if (obj !== null && typeof obj === "object") {
    const cleaned: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value === null || value === "null" || value === "") continue;
      const cleanedValue = deepCleanNulls(value);
      if (cleanedValue !== null && cleanedValue !== "null" && cleanedValue !== "") {
        cleaned[key] = cleanedValue;
      }
    }
    return Object.keys(cleaned).length > 0 ? cleaned : null;
  }
  return obj;
}

// ═══════════════════════════════════════════════════════════════
// MASTER ENRICHMENT PROMPT — Universal across ALL AI models
// ═══════════════════════════════════════════════════════════════

const MASTER_ENRICH_PROMPT = `You are the senior job content editor at TrueJobs.co.in — India's trusted government job portal. You transform raw Employment News job listings into comprehensive, SEO-optimized, reader-friendly job pages that rank on Google and genuinely help Indian job seekers apply correctly.

You have deep expertise in Indian government recruitment — UPSC, SSC, Railway, Banking, Defence, State PSC, PSU, Teaching, and Healthcare jobs. You understand pay scales, age relaxation rules, reservation policies, and application procedures.

=== LANGUAGE DETECTION — CRITICAL ===

DETECT the language of the input data:
- If the majority of input fields are in Hindi (Devanagari script) → write the ENTIRE enriched output in Hindi
- If the majority of input fields are in English → write the ENTIRE enriched output in English
- Exception: Technical terms commonly used in both languages are acceptable (e.g., SSC, UPSC, Pay Level, DA, HRA, Online Apply, PDF, etc.)
- NEVER write Hinglish (random mixing). Commit to ONE language based on input.

=== ENRICHED TITLE (enriched_title) ===

Create a compelling, search-optimized title:
- Include: Organization name + Post name + Year (2026)
- Include vacancy count if available
- Keep under 80 characters
- Make it click-worthy but accurate

GOOD: "UPSC Civil Services 2026 Recruitment — 1,000+ Vacancies, Apply Before 15 April"
GOOD: "रेलवे NTPC भर्ती 2026 — 50,000+ पदों पर आवेदन शुरू, पूरी जानकारी यहाँ"
BAD: "Government Job Vacancy 2026" (too generic)
BAD: "Employment News Job Update" (no specifics)

=== META TITLE (meta_title) ===

- Under 60 characters strictly
- Primary keyword + Organization + Year
- Must be different from enriched_title (not a copy-paste)
- Example: "UPSC CSE 2026: Vacancies, Eligibility & Apply Link"
- Example: "RRB NTPC 2026 भर्ती — योग्यता, सैलरी और आवेदन"

=== META DESCRIPTION (meta_description) ===

- Under 155 characters strictly
- Include: post name, vacancy count, last date, one benefit/hook
- Create urgency to click
- Example: "UPSC CSE 2026 — 1,000+ vacancies, age 21-32, salary ₹56,100+. Last date 15 April. Full eligibility, syllabus & apply link inside."
- Example: "SSC CGL 2026 में 15,000+ वैकेंसी। आयु 18-27, सैलरी ₹25,500-₹1,51,100। आवेदन की अंतिम तिथि और पूरी जानकारी।"

=== SLUG (slug) ===

- URL-friendly, lowercase, hyphens only
- Include: organization + post + year
- Keep short but descriptive
- Example: "upsc-civil-services-2026-recruitment"
- Example: "rrb-ntpc-2026-bharti"

=== ENRICHED DESCRIPTION (enriched_description) — THIS IS THE MAIN CONTENT ===

Structure the description as clean, semantic HTML with this EXACT section order:

SECTION 1 — Quick Overview Box:
Start with a highlight box containing the most important facts in a table:
<div class="quick-overview" style="background:#f0f9ff;border:2px solid #0284c7;border-radius:8px;padding:20px;margin-bottom:24px;">
<h3 style="margin-top:0;color:#0369a1;">📋 Quick Overview</h3>
<table style="width:100%;border-collapse:collapse;">
<tr><td style="padding:8px;border-bottom:1px solid #e0e7ff;font-weight:600;">Organisation</td><td style="padding:8px;border-bottom:1px solid #e0e7ff;">[org_name]</td></tr>
<tr><td style="padding:8px;border-bottom:1px solid #e0e7ff;font-weight:600;">Post</td><td style="padding:8px;border-bottom:1px solid #e0e7ff;">[post name]</td></tr>
<tr><td style="padding:8px;border-bottom:1px solid #e0e7ff;font-weight:600;">Qualification</td><td style="padding:8px;border-bottom:1px solid #e0e7ff;">[qualification]</td></tr>
<tr><td style="padding:8px;border-bottom:1px solid #e0e7ff;font-weight:600;">Age Limit</td><td style="padding:8px;border-bottom:1px solid #e0e7ff;">[age with relaxation]</td></tr>
<tr><td style="padding:8px;border-bottom:1px solid #e0e7ff;font-weight:600;">Salary</td><td style="padding:8px;border-bottom:1px solid #e0e7ff;">[pay level + range]</td></tr>
<tr><td style="padding:8px;border-bottom:1px solid #e0e7ff;font-weight:600;">Last Date</td><td style="padding:8px;border-bottom:1px solid #e0e7ff;">[last_date]</td></tr>
<tr><td style="padding:8px;font-weight:600;">Apply Mode</td><td style="padding:8px;">[Online/Offline]</td></tr>
</table>
</div>
Use Hindi labels if output is Hindi, English if output is English.

SECTION 2 — Introduction (2-3 sentences):
- State the most important fact first (organization + post + vacancies)
- Include primary keyword naturally
- Create relevance — who should apply and why this matters
- NO filler phrases. Start with the fact, not "In today's world..."

SECTION 3 — Vacancy Details:
- Use <h3> heading: "पद और वैकेंसी विवरण" or "Vacancy & Post Details"
- Break down vacancies by post/category/reservation if available
- Use a table if multiple posts exist
- Include pay level and grade pay for each post

SECTION 4 — Eligibility Criteria:
- Use <h3> heading: "योग्यता / पात्रता" or "Eligibility Criteria"
- Education qualification — be specific (degree name, percentage if applicable)
- Age limit with full relaxation details (OBC, SC/ST, PwD, Ex-servicemen)
- Age calculation date if available
- Experience requirement if any
- Use bullet points for clarity

SECTION 5 — Salary & Benefits:
- Use <h3> heading: "वेतन और भत्ते" or "Salary & Benefits"
- Pay Level and pay range (7th Pay Commission)
- List benefits: DA, HRA, TA, Medical, Pension (NPS/OPS), Leave benefits
- Calculate approximate in-hand salary if possible
- Use a table format for multiple posts with different pay levels

SECTION 6 — Selection Process:
- Use <h3> heading: "चयन प्रक्रिया" or "Selection Process"
- List each stage (Written Exam → Interview → Document Verification → Medical)
- Include exam pattern if known (number of questions, marks, duration, negative marking)
- Use numbered list for stages

SECTION 7 — How to Apply (Step by Step):
- Use <h3> heading: "आवेदन कैसे करें" or "How to Apply — Step by Step"
- Numbered steps (1, 2, 3...) with clear instructions
- Include the official website URL if available
- List required documents for application
- Mention application fee with payment methods
- Application fee breakup by category (General/OBC vs SC/ST/PwD/Female)

SECTION 8 — Important Dates:
- Use <h3> heading: "महत्वपूर्ण तिथियाँ" or "Important Dates"
- Use a clean table format with notification date, application start, last date, exam date, admit card date
- Bold the last date

SECTION 9 — Important Links:
- Use <h3> heading: "महत्वपूर्ण लिंक" or "Important Links"
- Official notification PDF link (if known)
- Apply online link (if known)
- Official website link
- If links are not available, write "आधिकारिक वेबसाइट पर जाएं" or "Visit the official website"

=== CONTENT QUALITY RULES — APPLY TO ALL SECTIONS ===

NEVER use these filler phrases:
- "In today's competitive world..."
- "This is a great opportunity for..."
- "Interested candidates are advised to..."
- "It is important to note that..."
- "As we all know..."
- "Don't miss this golden opportunity..."
- Any sentence that adds no new information

Every sentence must contain specific, useful information. If you don't have data for a field, write "विज्ञापन में उल्लेख नहीं" or "Not mentioned in notification" — do NOT make up data.
Use <strong> for: dates, salary figures, age limits, vacancy numbers, website URLs, deadlines.
Use tables for: vacancy breakdowns, salary comparisons, important dates, eligibility by category.
Keep paragraphs to 2-3 sentences maximum.
Target word count: 800-1500 words depending on available data. More data = longer content. Less data = don't pad.

=== FAQ (faq_html) ===

Generate 5-6 FAQs that real job seekers would actually search for. Each FAQ must:
- Be a specific question (not generic)
- Have a 2-3 sentence direct answer
- Include at least one specific data point in the answer

Format as proper FAQ schema-compatible HTML:
<div class="faq-item"><p><strong>Q: [Question in the same language as content]</strong></p><p>A: [Direct answer with specific data]</p></div>

GOOD FAQ: "UPSC CSE 2026 के लिए आयु सीमा क्या है?" → "सामान्य वर्ग के लिए 21-32 वर्ष, OBC के लिए 35 वर्ष, SC/ST के लिए 37 वर्ष।"
BAD FAQ: "What is this job about?" → Too generic, no search value

=== SCHEMA MARKUP (schema_markup) ===

Return a complete, valid Google JobPosting JSON-LD schema:
{
  "@context": "https://schema.org/",
  "@type": "JobPosting",
  "title": "[Post name]",
  "description": "[2-3 sentence summary]",
  "hiringOrganization": {
    "@type": "Organization",
    "name": "[org_name]",
    "sameAs": "[official website if known]"
  },
  "jobLocation": {
    "@type": "Place",
    "address": {
      "@type": "PostalAddress",
      "addressLocality": "[location]",
      "addressRegion": "[state]",
      "addressCountry": "IN"
    }
  },
  "employmentType": "[FULL_TIME/CONTRACT/TEMPORARY]",
  "baseSalary": {
    "@type": "MonetaryAmount",
    "currency": "INR",
    "value": {
      "@type": "QuantitativeValue",
      "minValue": null,
      "maxValue": null,
      "unitText": "MONTH"
    }
  },
  "qualifications": "[qualification]",
  "experienceRequirements": "[experience or Entry Level]",
  "industry": "Government",
  "jobBenefits": "Pension, Medical, DA, HRA, TA"
}

Only include fields where you have real data. Do NOT include fields with null or made-up values.

=== KEYWORDS (keywords) ===

Return 15-20 keywords as a JSON array:
- Mix of Hindi and English keywords (job seekers search in both)
- Include: organization name, post name, year, exam name, "bharti", "vacancy", "recruitment", "sarkari naukri", state name
- Include long-tail keywords people actually search: "[org] [post] salary", "[org] [post] eligibility", "[org] [post] last date"

=== JOB CATEGORY (job_category) ===

Assign ONE category from this list:
Central Government, State Government, Railway, Banking, Defence, Teaching, Healthcare, Police, PSU, Engineering, Research, Judicial, Agriculture, Other

=== ABSOLUTE RULES ===

1. NEVER fabricate data. If a field is not in the input, say it's not available.
2. NEVER use filler phrases. Every sentence must contain specific information.
3. ALWAYS detect input language and write output in the same language.
4. ALWAYS include the Quick Overview box at the top.
5. ALWAYS use tables for structured data (dates, vacancies, salary breakdowns).
6. ALWAYS bold critical info: dates, salary, age limits, deadlines.
7. ALWAYS generate FAQ schema-compatible HTML.
8. ALWAYS generate valid JobPosting JSON-LD schema.
9. Target 800-1500 words based on available data. Don't pad.
10. Make the content genuinely useful — would a job seeker in a small town find this helpful enough to apply correctly?

=== JSON OUTPUT FORMAT ===

Return ONLY a valid JSON object with these exact keys:
{
  "enriched_title": "string",
  "meta_title": "string (under 60 chars)",
  "meta_description": "string (under 155 chars)",
  "slug": "string (url-friendly)",
  "enriched_description": "string (full HTML content)",
  "faq_html": "string (schema-compatible FAQ HTML)",
  "schema_markup": { JobPosting JSON-LD object },
  "keywords": ["array", "of", "15-20", "keywords"],
  "job_category": "string (from allowed categories)"
}

IMPORTANT: Return ONLY the JSON object. No markdown formatting, no code blocks, no explanation.`;

// ═══════════════════════════════════════════════════════════════
// Language Detection Helper
// ═══════════════════════════════════════════════════════════════

function detectLanguage(fields: Record<string, string | null | undefined>): string {
  const allText = Object.values(fields).filter(Boolean).join(' ');
  if (!allText) return 'English';
  const devanagariChars = (allText.match(/[\u0900-\u097F]/g) || []).length;
  const totalAlphaChars = (allText.match(/[a-zA-Z\u0900-\u097F]/g) || []).length;
  if (totalAlphaChars === 0) return 'English';
  const ratio = devanagariChars / totalAlphaChars;
  return ratio > 0.3 ? 'Hindi (Devanagari script)' : 'English';
}

// ═══════════════════════════════════════════════════════════════

function tryParseJSON(text: string): any {
  // Attempt 1: direct parse
  try {
    return JSON.parse(text);
  } catch { /* fall through */ }

  // Attempt 2: strip markdown fences
  let cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch { /* fall through */ }

  // Attempt 3: extract JSON between first { and last }
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    const extracted = cleaned.substring(firstBrace, lastBrace + 1);
    try {
      return JSON.parse(extracted);
    } catch { /* fall through */ }
  }

  // Attempt 4: truncate at last valid }
  if (cleaned.trimStart().startsWith("{") && cleaned.length >= 200) {
    const lb = cleaned.lastIndexOf("}");
    if (lb > 0) {
      try {
        return JSON.parse(cleaned.substring(0, lb + 1));
      } catch { /* fall through */ }
    }
  }

  throw new Error(`JSON parse failed after all recovery attempts (response length: ${text.length} chars)`);
}

// Smart field auto-generation for missing non-critical fields
function autoFillMissingFields(enriched: any, job: any): string[] {
  const autoFilled: string[] = [];

  if (!enriched.slug && enriched.enriched_title) {
    enriched.slug = enriched.enriched_title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/(^-|-$)/g, '')
      .substring(0, 80);
    if (!enriched.slug) enriched.slug = `job-${Date.now()}`;
    autoFilled.push('slug (auto-generated from title)');
  }

  if (!enriched.meta_title && enriched.enriched_title) {
    enriched.meta_title = enriched.enriched_title.substring(0, 60);
    autoFilled.push('meta_title (first 60 chars of title)');
  }

  if (!enriched.meta_description && enriched.enriched_description) {
    const stripped = enriched.enriched_description.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
    enriched.meta_description = stripped.substring(0, 155);
    autoFilled.push('meta_description (first 155 chars of description)');
  }

  if (!enriched.job_category) {
    enriched.job_category = 'Other';
    autoFilled.push('job_category (defaulted to Other)');
  }

  if (!Array.isArray(enriched.keywords) || enriched.keywords.length === 0) {
    const parts = [job.org_name, job.post, 'sarkari naukri', 'govt job', '2026', job.state].filter(Boolean);
    enriched.keywords = parts;
    autoFilled.push('keywords (auto-generated from job fields)');
  }

  return autoFilled;
}

// ═══════════════════════════════════════════════════════════════
// AI Model Providers
// ═══════════════════════════════════════════════════════════════

const AI_TIMEOUT_MS = 60000; // 60 seconds timeout for all AI calls

async function fetchGemini(apiKey: string, prompt: string): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
  const body = {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: { responseMimeType: "application/json", temperature: 0.5 },
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timeoutId);
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error("AI model timeout after 60 seconds");
    }
    throw err;
  }

  if (response.status === 429) {
    console.log("Rate limited, retrying in 5s...");
    await delay(5000);
    const c2 = new AbortController();
    const t2 = setTimeout(() => c2.abort(), AI_TIMEOUT_MS);
    try {
      response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: c2.signal,
      });
    } catch (err) {
      clearTimeout(t2);
      if (err instanceof DOMException && err.name === "AbortError") {
        throw new Error("AI model timeout after 60 seconds (retry)");
      }
      throw err;
    }
    clearTimeout(t2);
  }

  clearTimeout(timeoutId);

  if (!response.ok) {
    const errText = await response.text();
    console.error("Gemini error:", response.status, errText);
    throw new Error(`Gemini API error: ${response.status}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("No content in Gemini response");
  return text;
}

// ── AWS Sig V4 helpers (for Bedrock models) ──
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
  if (!ak || !sk) throw new Error('AWS credentials not configured');

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

async function callMistralRaw(prompt: string): Promise<string> {
  const modelId = 'mistral.mistral-large-2407-v1:0';
  const region = 'us-west-2';
  const host = `bedrock-runtime.${region}.amazonaws.com`;
  const body = JSON.stringify({
    messages: [{ role: 'user', content: [{ text: prompt }] }],
    inferenceConfig: { maxTokens: 16384, temperature: 0.5 },
  });
  const resp = await Promise.race([
    awsSigV4Fetch(host, `/model/${modelId}/converse`, body, region, 'bedrock'),
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Mistral timeout after 120 seconds')), 120_000)),
  ]);
  if (!resp.ok) throw new Error(`Mistral Bedrock ${resp.status}: ${await resp.text()}`);
  const data = await resp.json();
  return data?.output?.message?.content?.[0]?.text || '';
}

async function callClaudeRaw(prompt: string): Promise<string> {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured');
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);
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
        max_tokens: 8192,
        system: 'You are an expert employment news content writer for an Indian job portal. Write structured, SEO-optimized, factual content about government job notifications. Return valid JSON only.',
        messages: [{ role: 'user', content: prompt }],
      }),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timeoutId);
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error('Claude API timeout after 60 seconds');
    }
    throw err;
  }
  clearTimeout(timeoutId);
  if (!resp.ok) throw new Error(`Anthropic API error ${resp.status}: ${await resp.text()}`);
  const data = await resp.json();
  const textBlocks = (data?.content || []).filter((b: any) => b.type === 'text');
  return textBlocks.map((b: any) => b.text).join('') || '';
}

async function callLovableGeminiRaw(prompt: string): Promise<string> {
  const apiKey = Deno.env.get('LOVABLE_API_KEY');
  if (!apiKey) throw new Error('LOVABLE_API_KEY not configured');
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);
  let resp: Response;
  try {
    resp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 8192,
        temperature: 0.5,
      }),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timeoutId);
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error('AI model timeout after 60 seconds');
    }
    throw err;
  }
  clearTimeout(timeoutId);
  if (!resp.ok) {
    if (resp.status === 429) throw new Error('Rate limit exceeded on Lovable AI.');
    if (resp.status === 402) throw new Error('Lovable AI credits exhausted.');
    throw new Error(`Lovable AI error ${resp.status}`);
  }
  const data = await resp.json();
  return data?.choices?.[0]?.message?.content || '';
}

// Unified AI call: returns parsed JSON
async function callAI(model: string, prompt: string): Promise<any> {
  let rawText: string;

  switch (model) {
    case 'mistral': {
      rawText = await callMistralRaw(prompt);
      break;
    }
    case 'claude-sonnet':
    case 'claude': {
      rawText = await callClaudeRaw(prompt);
      break;
    }
    case 'lovable-gemini': {
      rawText = await callLovableGeminiRaw(prompt);
      break;
    }
    case 'vertex-flash': {
      const { callVertexGemini } = await import('../_shared/vertex-ai.ts');
      rawText = await callVertexGemini('gemini-2.5-flash', prompt, 60_000);
      break;
    }
    case 'vertex-pro': {
      const { callVertexGemini } = await import('../_shared/vertex-ai.ts');
      rawText = await callVertexGemini('gemini-2.5-pro', prompt, 120_000);
      break;
    }
    case 'gemini':
    default: {
      // Gemini has its own retry + JSON parse logic
      const apiKey = Deno.env.get("GEMINI_API_KEY");
      if (!apiKey) throw new Error("GEMINI_API_KEY not configured");
      const text = await fetchGemini(apiKey, prompt);
      try {
        return tryParseJSON(text);
      } catch (e1) {
        console.warn("Gemini JSON parse failed, retrying...", (e1 as Error).message);
        await delay(2000);
        const text2 = await fetchGemini(apiKey, prompt);
        return tryParseJSON(text2);
      }
    }
  }

  // For non-Gemini models, strip markdown fences and parse
  rawText = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  try {
    return tryParseJSON(rawText);
  } catch (e1) {
    console.warn(`${model} JSON parse failed, retrying...`, (e1 as Error).message);
    await delay(2000);
    // Retry the call
    let retryText: string;
    if (model === 'mistral') retryText = await callMistralRaw(prompt);
    else if (model === 'claude' || model === 'claude-sonnet') retryText = await callClaudeRaw(prompt);
    else if (model === 'vertex-flash') {
      const { callVertexGemini } = await import('../_shared/vertex-ai.ts');
      retryText = await callVertexGemini('gemini-2.5-flash', prompt, 60_000);
    } else if (model === 'vertex-pro') {
      const { callVertexGemini } = await import('../_shared/vertex-ai.ts');
      retryText = await callVertexGemini('gemini-2.5-pro', prompt, 120_000);
    }
    else retryText = await callLovableGeminiRaw(prompt);
    retryText = retryText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return tryParseJSON(retryText);
  }
}

// ═══════════════════════════════════════════════════════════════

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceClient = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Auth: verify JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer "))
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await serviceClient.auth.getUser(token);
    if (userError || !user)
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    // Admin check
    const { data: roleData } = await serviceClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleData)
      return new Response(JSON.stringify({ error: "Admin only" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    const { jobIds, aiModel } = await req.json();
    if (!jobIds || !Array.isArray(jobIds) || jobIds.length === 0)
      return new Response(
        JSON.stringify({ error: "jobIds array required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );

    const useModel = aiModel || 'gemini';
    console.log(`[enrich-employment-news] Using model: ${useModel}, jobs: ${jobIds.length}`);

    const results: Array<{ id: string; success: boolean; error?: string }> = [];

    for (let i = 0; i < jobIds.length; i += 1) {
      const batch = jobIds.slice(i, i + 1);

      const batchPromises = batch.map(async (jobId: string) => {
        try {
          const { data: job, error: fetchErr } = await serviceClient
            .from("employment_news_jobs")
            .select("*")
            .eq("id", jobId)
            .single();

          if (fetchErr || !job) {
            return { id: jobId, success: false, error: "Job not found" };
          }

          // Increment enrichment_attempts
          const currentAttempts = (job.enrichment_attempts || 0) + 1;
          await serviceClient
            .from("employment_news_jobs")
            .update({ enrichment_attempts: currentAttempts })
            .eq("id", jobId);

          let batchUploadedAt: string | null = null;
          if (job.upload_batch_id) {
            const { data: batchData } = await serviceClient
              .from("upload_batches")
              .select("uploaded_at")
              .eq("id", job.upload_batch_id)
              .single();
            batchUploadedAt = batchData?.uploaded_at || null;
          }

          // Detect language from input fields
          const inputFields: Record<string, string | null | undefined> = {
            org_name: job.org_name,
            post: job.post,
            qualification: job.qualification,
            salary: job.salary,
            age_limit: job.age_limit,
            location: job.location,
            state: job.state,
            description: job.description,
            job_type: job.job_type,
            application_mode: job.application_mode,
            experience_required: job.experience_required,
          };
          const detectedLang = detectLanguage(inputFields);

          // Build user data prompt with raw input fields
          const userDataPrompt = `INPUT DATA:
Organisation: ${job.org_name || "N/A"}
Post: ${job.post || "N/A"}
Qualification: ${job.qualification || "N/A"}
Salary: ${job.salary || "N/A"}
Age Limit: ${job.age_limit || "N/A"}
Location: ${job.location || "N/A"}
State: ${job.state || "N/A"}
Last Date: ${job.last_date || "N/A"}
Job Type: ${job.job_type || "N/A"}
Application Mode: ${job.application_mode || "N/A"}
Experience: ${job.experience_required || "N/A"}
Advertisement No: ${job.advertisement_number || "N/A"}
Description: ${job.description || "N/A"}
Vacancies: ${job.vacancies || "N/A"}
Application Start Date: ${job.application_start_date || "N/A"}
Apply Link: ${job.apply_link || "N/A"}

OUTPUT LANGUAGE: ${detectedLang}`;

          // Combine master prompt with user data
          const combinedPrompt = MASTER_ENRICH_PROMPT + "\n\n" + userDataPrompt;

          const enriched = await callAI(useModel, combinedPrompt);

          // Check required fields and try auto-fill for missing ones
          const criticalFields = ['enriched_title', 'enriched_description'] as const;
          const missingCritical: string[] = [];
          for (const field of criticalFields) {
            if (!enriched[field] || typeof enriched[field] !== 'string' || enriched[field].trim() === '') {
              missingCritical.push(field);
            }
          }

          // If critical fields (title + description) are missing, fail hard
          if (missingCritical.length > 0) {
            throw new Error(`AI returned incomplete data — missing critical fields: ${missingCritical.join(', ')}`);
          }

          // Auto-fill non-critical missing fields
          const autoFilled = autoFillMissingFields(enriched, job);
          if (autoFilled.length > 0) {
            console.log(`[enrich] Auto-filled for ${jobId}: ${autoFilled.join(', ')}`);
          }

          // Post-processing: slug conflict check
          let slug = enriched.slug || `${(job.post || "job").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}-${Date.now()}`;
          const { data: existingSlug } = await serviceClient
            .from("employment_news_jobs")
            .select("id")
            .eq("slug", slug)
            .neq("id", jobId)
            .maybeSingle();
          if (existingSlug) {
            const suffix = (job.advertisement_number || jobId.slice(0, 8)).replace(/[^a-z0-9]/gi, "-").toLowerCase();
            slug = `${slug}-${suffix}`;
          }

          // Schema date overrides
          let schemaMarkup = enriched.schema_markup || {};
          if (batchUploadedAt) {
            schemaMarkup.datePosted = batchUploadedAt;
          }
          if (job.last_date_resolved) {
            schemaMarkup.validThrough = job.last_date_resolved;
          } else {
            delete schemaMarkup.validThrough;
          }
          schemaMarkup = deepCleanNulls(schemaMarkup) || {};

          const keywords = Array.isArray(enriched.keywords) ? enriched.keywords : [];

          const { error: updateErr } = await serviceClient
            .from("employment_news_jobs")
            .update({
              enriched_title: enriched.enriched_title || null,
              enriched_description: enriched.enriched_description || null,
              meta_title: enriched.meta_title || null,
              meta_description: enriched.meta_description || null,
              slug,
              schema_markup: schemaMarkup,
              faq_html: enriched.faq_html || null,
              keywords,
              job_category: enriched.job_category || job.job_category,
              status: "enriched",
              enrichment_error: null, // Clear previous errors on success
            })
            .eq("id", jobId);

          if (updateErr) {
            return { id: jobId, success: false, error: updateErr.message };
          }

          return { id: jobId, success: true };
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : "Unknown error";
          console.error(`Enrich error for ${jobId}:`, errorMsg);

          // Update failure status in database
          try {
            // Read current attempts count
            const { data: currentJob } = await serviceClient
              .from("employment_news_jobs")
              .select("enrichment_attempts")
              .eq("id", jobId)
              .single();

            const attempts = currentJob?.enrichment_attempts || 1;
            const maxRetries = 3;

            // If attempts >= max, mark as enrichment_failed; otherwise keep pending for retry
            const newStatus = attempts >= maxRetries ? 'enrichment_failed' : 'pending';

            await serviceClient
              .from("employment_news_jobs")
              .update({
                enrichment_error: errorMsg,
                status: newStatus,
              })
              .eq("id", jobId);

            console.log(`[enrich] Job ${jobId}: attempt ${attempts}/${maxRetries}, status → ${newStatus}`);
          } catch (dbErr) {
            console.error(`Failed to update failure status for ${jobId}:`, dbErr);
          }

          return {
            id: jobId,
            success: false,
            error: errorMsg,
          };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      if (i + 1 < jobIds.length) {
        await delay(500);
      }
    }

    const successCount = results.filter((r) => r.success).length;
    const failCount = results.filter((r) => !r.success).length;

    return new Response(
      JSON.stringify({ results, successCount, failCount }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("enrich-employment-news error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
