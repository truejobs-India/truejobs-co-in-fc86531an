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
    // Gate repair: only attempt if response looks like a substantial JSON object
    if (!text.trimStart().startsWith("{") || text.length < 500) {
      throw new Error(`JSON repair skipped — response too short (${text.length} chars) or not a JSON object`);
    }
    const lastBrace = text.lastIndexOf("}");
    if (lastBrace > 0) {
      const trimmed = text.substring(0, lastBrace + 1);
      return JSON.parse(trimmed); // may still throw
    }
    throw new Error("JSON repair failed");
  }
}

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

async function callGemini(apiKey: string, prompt: string) {
  const text = await fetchGemini(apiKey, prompt);
  try {
    return tryParseJSON(text);
  } catch (e1) {
    console.warn("Gemini JSON parse failed, retrying call...", (e1 as Error).message);
    await delay(2000);
    const text2 = await fetchGemini(apiKey, prompt);
    return tryParseJSON(text2);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceClient = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Auth: verify JWT via service client
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

    // Admin check via service client (bypasses RLS)
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

    const { jobIds } = await req.json();
    if (!jobIds || !Array.isArray(jobIds) || jobIds.length === 0)
      return new Response(
        JSON.stringify({ error: "jobIds array required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY not configured");

    const results: Array<{ id: string; success: boolean; error?: string }> = [];

    // Process sequentially (one at a time) to avoid timeouts
    for (let i = 0; i < jobIds.length; i += 1) {
      const batch = jobIds.slice(i, i + 1);

      const batchPromises = batch.map(async (jobId: string) => {
        try {
          // Fetch job + batch uploaded_at
          const { data: job, error: fetchErr } = await serviceClient
            .from("employment_news_jobs")
            .select("*")
            .eq("id", jobId)
            .single();

          if (fetchErr || !job) {
            return { id: jobId, success: false, error: "Job not found" };
          }

          // Fetch batch uploaded_at for schema date override
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

          const enriched = await callGemini(GEMINI_API_KEY, enrichPrompt);

          // --- Strict field validation ---
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
            throw new Error(`Gemini returned incomplete data — missing: ${missingFields.join(', ')}`);
          }

          // --- Post-processing ---

          // 1. Slug conflict check
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

          // 2. Schema date overrides
          let schemaMarkup = enriched.schema_markup || {};
          if (batchUploadedAt) {
            schemaMarkup.datePosted = batchUploadedAt;
          }
          if (job.last_date_resolved) {
            schemaMarkup.validThrough = job.last_date_resolved;
          } else {
            delete schemaMarkup.validThrough;
          }

          // 3. Recursive null cleanup
          schemaMarkup = deepCleanNulls(schemaMarkup) || {};

          // 4. Keywords as native array
          const keywords = Array.isArray(enriched.keywords) ? enriched.keywords : [];

          // Update the job with all SEO fields
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

      // 500ms delay between jobs to avoid rate limits
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
