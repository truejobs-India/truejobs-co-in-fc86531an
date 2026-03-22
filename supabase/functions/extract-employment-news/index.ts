import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── Text sanitization ──
function sanitizeText(raw: string): string {
  return raw
    // Collapse runs of spaces/tabs to single space
    .replace(/[ \t]+/g, ' ')
    // Remove runs of underscores, dashes, equals used as separators
    .replace(/[_]{4,}/g, '')
    .replace(/[-]{4,}/g, '')
    .replace(/[=]{4,}/g, '')
    // Collapse 3+ newlines to 2
    .replace(/\n{3,}/g, '\n\n')
    // Trim each line
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .join('\n')
    .trim();
}

async function callGemini(systemPrompt: string, userContent: string, requestId: string) {
  const { callVertexGemini } = await import('../_shared/vertex-ai.ts');
  const fullPrompt = `${systemPrompt}\n\n${userContent}`;
  console.log(`[${requestId}] Calling Vertex AI | prompt_length=${fullPrompt.length}`);
  const rawText = await callVertexGemini('gemini-2.5-flash', fullPrompt, 90_000, {
    responseMimeType: 'application/json',
    temperature: 0.1,
    maxOutputTokens: 4096,
  });
  return JSON.parse(rawText);
}

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  const requestId = crypto.randomUUID().slice(0, 8);

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

    const { text, filename, issueDetails, batchId } = await req.json();
    if (!text || text.trim().length < 50)
      return new Response(
        JSON.stringify({ error: "Text too short to extract jobs from" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );

    // Sanitize text before processing
    const rawLen = text.length;
    const cleaned = sanitizeText(text);
    const cleanedLen = cleaned.length;
    console.log(`[${requestId}] Received chunk | filename=${filename || 'unknown'} | raw_len=${rawLen} | cleaned_len=${cleanedLen} | reduction=${Math.round((1 - cleanedLen / rawLen) * 100)}%`);

    // Create or reuse batch
    let currentBatchId = batchId;
    let batchUploadedAt: string;

    if (!currentBatchId) {
      const { data: batch, error: batchErr } = await serviceClient
        .from("upload_batches")
        .insert({
          filename: filename || "unknown.docx",
          issue_details: issueDetails || "",
          status: "processing",
        })
        .select("id, uploaded_at")
        .single();
      if (batchErr) throw batchErr;
      currentBatchId = batch.id;
      batchUploadedAt = batch.uploaded_at;
    } else {
      const { data: existingBatch } = await serviceClient
        .from("upload_batches")
        .select("uploaded_at")
        .eq("id", currentBatchId)
        .single();
      batchUploadedAt = existingBatch?.uploaded_at || new Date().toISOString();
    }

    const systemPrompt = `You are an expert at extracting government job notifications from Indian Employment News newspaper issues.

Extract ALL job notifications from the following text. For each unique job advertisement, return a JSON object with these exact fields:

{
  "org_name": string,
  "post": string,
  "vacancies": integer or null,
  "qualification": string,
  "age_limit": string or null,
  "salary": string or null,
  "job_type": "permanent" | "contract" | "deputation" | "fellowship" | "short-term contract" | "direct recruitment",
  "experience_required": string or null,
  "location": string or null,
  "application_mode": "online" | "offline" | "email" | "deputation",
  "apply_link": string or null,
  "application_start_date": string or null,
  "last_date": string or null,
  "last_date_raw": string or null,
  "notification_reference_number": string or null,
  "advertisement_number": string or null,
  "source": "Employment News",
  "description": string (2-3 sentence summary),
  "job_category": "Central Government" | "State Government" | "Defence" | "Railway" | "Banking" | "SSC" | "PSU" | "University/Research" | "Teaching" | "Police" | "Medical/Health" | "Engineering" | "Other",
  "state": string or null
}

Return a JSON object with key "jobs" containing an array of all job objects.
Return null for fields not found. Preserve relative date phrases as-is. Ignore articles, editorials, and non-job content. Clean OCR artifacts.`;

    const parsed = await callGemini(systemPrompt, cleaned, requestId);

    const jobs = parsed.jobs || [];
    console.log(`[${requestId}] AI returned ${jobs.length} jobs`);

    if (jobs.length === 0) {
      return new Response(
        JSON.stringify({
          batchId: currentBatchId,
          newCount: 0,
          updatedCount: 0,
          message: "No jobs found in this chunk",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Resolve relative dates
    const batchDate = new Date(batchUploadedAt);
    const resolveDate = (raw: string | null): string | null => {
      if (!raw) return null;
      const directParse = new Date(raw);
      if (!isNaN(directParse.getTime()) && raw.match(/\d{4}/)) {
        return directParse.toISOString().split("T")[0];
      }
      const daysMatch = raw.match(/within\s+(\d+)\s+days/i);
      if (daysMatch) {
        const days = parseInt(daysMatch[1]);
        const resolved = new Date(batchDate);
        resolved.setDate(resolved.getDate() + days);
        return resolved.toISOString().split("T")[0];
      }
      const weeksMatch = raw.match(/within\s+(\d+)\s+weeks/i);
      if (weeksMatch) {
        const weeks = parseInt(weeksMatch[1]);
        const resolved = new Date(batchDate);
        resolved.setDate(resolved.getDate() + weeks * 7);
        return resolved.toISOString().split("T")[0];
      }
      const ddmmyyyy = raw.match(/(\d{1,2})[\/\.\-](\d{1,2})[\/\.\-](\d{4})/);
      if (ddmmyyyy) {
        const d = new Date(`${ddmmyyyy[3]}-${ddmmyyyy[2].padStart(2, '0')}-${ddmmyyyy[1].padStart(2, '0')}`);
        if (!isNaN(d.getTime())) return d.toISOString().split("T")[0];
      }
      const naturalDate = new Date(raw);
      if (!isNaN(naturalDate.getTime())) {
        return naturalDate.toISOString().split("T")[0];
      }
      return null;
    };

    // Upsert jobs
    let newCount = 0;
    let updatedCount = 0;

    for (const job of jobs) {
      const lastDateText = job.last_date_raw || job.last_date || null;
      const resolved = resolveDate(lastDateText);

      const row = {
        org_name: job.org_name || null,
        post: job.post || null,
        vacancies: job.vacancies || null,
        qualification: job.qualification || null,
        age_limit: job.age_limit || null,
        salary: job.salary || null,
        job_type: job.job_type || null,
        experience_required: job.experience_required || null,
        location: job.location || null,
        application_mode: job.application_mode || null,
        apply_link: job.apply_link || null,
        application_start_date: job.application_start_date || null,
        last_date: job.last_date || null,
        last_date_raw: lastDateText,
        last_date_resolved: resolved,
        notification_reference_number: job.notification_reference_number || null,
        advertisement_number: job.advertisement_number || null,
        source: "Employment News",
        description: job.description || null,
        status: "pending",
        job_category: job.job_category || null,
        state: job.state || null,
        upload_batch_id: currentBatchId,
      };

      const { error: insertErr } = await serviceClient
        .from("employment_news_jobs")
        .insert(row);

      if (insertErr) {
        if (insertErr.code === "23505") {
          const { error: updateErr } = await serviceClient
            .from("employment_news_jobs")
            .update({
              ...row,
              status: "pending",
            })
            .eq("advertisement_number", row.advertisement_number)
            .eq("org_name", row.org_name);
          if (!updateErr) updatedCount++;
        } else {
          console.error(`[${requestId}] Insert error:`, insertErr);
        }
      } else {
        newCount++;
      }
    }

    // Accumulate batch counts
    const { data: currentBatch } = await serviceClient
      .from("upload_batches")
      .select("total_extracted, new_count, updated_count")
      .eq("id", currentBatchId)
      .single();

    await serviceClient
      .from("upload_batches")
      .update({
        total_extracted: (currentBatch?.total_extracted || 0) + newCount + updatedCount,
        new_count: (currentBatch?.new_count || 0) + newCount,
        updated_count: (currentBatch?.updated_count || 0) + updatedCount,
        status: "completed",
      })
      .eq("id", currentBatchId);

    console.log(`[${requestId}] Done | new=${newCount} updated=${updatedCount}`);

    return new Response(
      JSON.stringify({
        batchId: currentBatchId,
        newCount,
        updatedCount,
        totalInChunk: jobs.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : "Unknown error";
    const is429 = /429|RESOURCE_EXHAUSTED|rate.?limit/i.test(errMsg);

    if (is429) {
      console.warn(`[${requestId}] Vertex AI rate limited (429)`);
      return new Response(
        JSON.stringify({
          error: "AI service is temporarily overloaded. Please wait a minute and try again.",
          code: "VERTEX_RATE_LIMITED",
        }),
        {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.error(`[${requestId}] Unhandled error:`, error);
    return new Response(
      JSON.stringify({ error: errMsg }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
