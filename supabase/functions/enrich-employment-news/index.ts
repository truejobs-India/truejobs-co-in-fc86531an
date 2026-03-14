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

function tryParseJSON(text: string): any {
  try {
    return JSON.parse(text);
  } catch {
    if (!text.trimStart().startsWith("{") || text.length < 500) {
      throw new Error(`JSON repair skipped — response too short (${text.length} chars) or not a JSON object`);
    }
    const lastBrace = text.lastIndexOf("}");
    if (lastBrace > 0) {
      const trimmed = text.substring(0, lastBrace + 1);
      return JSON.parse(trimmed);
    }
    throw new Error("JSON repair failed");
  }
}

// ═══════════════════════════════════════════════════════════════
// AI Model Providers
// ═══════════════════════════════════════════════════════════════

async function fetchGemini(apiKey: string, prompt: string): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
  const body = {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: { responseMimeType: "application/json", temperature: 0.1 },
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 50000);

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
      throw new Error("Gemini API timed out after 50s");
    }
    throw err;
  }

  if (response.status === 429) {
    console.log("Rate limited, retrying in 5s...");
    await delay(5000);
    const c2 = new AbortController();
    const t2 = setTimeout(() => c2.abort(), 50000);
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
        throw new Error("Gemini API timed out after 50s (retry)");
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
  const modelId = 'mistral.mistral-7b-instruct-v0:2';
  const region = Deno.env.get('AWS_REGION') || 'ap-south-1';
  const host = `bedrock-runtime.${region}.amazonaws.com`;
  const body = JSON.stringify({
    messages: [{ role: 'user', content: [{ text: prompt }] }],
    inferenceConfig: { maxTokens: 8192, temperature: 0.1 },
  });
  const resp = await awsSigV4Fetch(host, `/model/${modelId}/converse`, body, region, 'bedrock');
  if (!resp.ok) throw new Error(`Mistral Bedrock ${resp.status}: ${await resp.text()}`);
  const data = await resp.json();
  return data?.output?.message?.content?.[0]?.text || '';
}

async function callClaudeRaw(prompt: string): Promise<string> {
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
      max_tokens: 8192,
      temperature: 0.1,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!resp.ok) throw new Error(`Anthropic API error ${resp.status}: ${await resp.text()}`);
  const data = await resp.json();
  return data?.content?.[0]?.text || '';
}

async function callLovableGeminiRaw(prompt: string): Promise<string> {
  const apiKey = Deno.env.get('LOVABLE_API_KEY');
  if (!apiKey) throw new Error('LOVABLE_API_KEY not configured');
  const resp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 8192,
      temperature: 0.1,
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

// Unified AI call: returns parsed JSON
async function callAI(model: string, prompt: string): Promise<any> {
  let rawText: string;

  switch (model) {
    case 'mistral': {
      rawText = await callMistralRaw(prompt);
      break;
    }
    case 'claude': {
      rawText = await callClaudeRaw(prompt);
      break;
    }
    case 'lovable-gemini': {
      rawText = await callLovableGeminiRaw(prompt);
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
    else if (model === 'claude') retryText = await callClaudeRaw(prompt);
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

          let batchUploadedAt: string | null = null;
          if (job.upload_batch_id) {
            const { data: batchData } = await serviceClient
              .from("upload_batches")
              .select("uploaded_at")
              .eq("id", job.upload_batch_id)
              .single();
            batchUploadedAt = batchData?.uploaded_at || null;
          }

          const enrichPrompt = `You are an SEO specialist for TrueJobs, India's government job portal.

Given this raw job notification data, create fully optimized SEO content. Return a JSON object with these exact keys:

{
  "enriched_title": "SEO-optimized job title (60 chars max), include org name and year",
  "meta_title": "Page title tag (55-60 chars), keyword-rich, include 2026",
  "meta_description": "Meta description (150-160 chars), include org name, post, last date, call to action",
  "slug": "url-friendly-slug-with-keywords (e.g. director-agriculture-icar-2026)",
  "enriched_description": "Structured HTML with sections: <h3>About the Organisation</h3>, <h3>Role & Responsibilities</h3>, <h3>Eligibility Criteria</h3>, <h3>Selection Process</h3>, <h3>Salary & Benefits</h3>, <h3>How to Apply</h3>, <h3>Important Dates</h3>. Use <p>, <ul>, <li> tags. Minimum 400 words. Informative and detailed.",
  "faq_html": "5 FAQs as: <div class='faq-item'><p><strong>Q: question?</strong></p><p>A: answer</p></div> repeated. Cover eligibility, salary, last date, selection, how to apply.",
  "schema_markup": {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    "title": "job title",
    "description": "plain text summary",
    "hiringOrganization": { "@type": "Organization", "name": "org name", "sameAs": "official website or null" },
    "jobLocation": { "@type": "Place", "address": { "@type": "PostalAddress", "addressLocality": "city", "addressRegion": "state", "addressCountry": "IN" } },
    "employmentType": "FULL_TIME or CONTRACT etc",
    "baseSalary": { "@type": "MonetaryAmount", "currency": "INR", "value": { "@type": "QuantitativeValue", "minValue": number or null, "maxValue": number or null, "unitText": "MONTH" } },
    "qualifications": "qualification text",
    "datePosted": "will be overridden",
    "validThrough": "will be overridden"
  },
  "keywords": ["15-20 search keywords as array"],
  "job_category": "One of: Central Government, State Government, Defence, Railway, Banking, SSC, PSU, University/Research, Teaching, Police, Medical/Health, Engineering, Other"
}

IMPORTANT: Return ONLY the JSON object. No markdown formatting, no code blocks.

Input data:
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
Description: ${job.description || "N/A"}`;

          const enriched = await callAI(useModel, enrichPrompt);

          // Strict field validation
          const requiredStringFields = ['enriched_title', 'enriched_description', 'slug', 'meta_title', 'meta_description'] as const;
          const missingFields: string[] = [];
          for (const field of requiredStringFields) {
            if (!enriched[field] || typeof enriched[field] !== 'string' || enriched[field].trim() === '') {
              missingFields.push(field);
            }
          }
          if (!Array.isArray(enriched.keywords) || enriched.keywords.length === 0) {
            missingFields.push('keywords');
          }
          if (missingFields.length > 0) {
            throw new Error(`AI returned incomplete data — missing: ${missingFields.join(', ')}`);
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
            })
            .eq("id", jobId);

          if (updateErr) {
            return { id: jobId, success: false, error: updateErr.message };
          }

          return { id: jobId, success: true };
        } catch (err) {
          console.error(`Enrich error for ${jobId}:`, err);
          return {
            id: jobId,
            success: false,
            error: err instanceof Error ? err.message : "Unknown error",
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
