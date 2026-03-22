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
    .replace(/[ \t]+/g, ' ')
    .replace(/[_]{4,}/g, '')
    .replace(/[-]{4,}/g, '')
    .replace(/[=]{4,}/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .join('\n')
    .trim();
}

// ── Model resolution: UI key → { provider, modelId, timeout } ──
interface ResolvedModel {
  provider: 'vertex-ai' | 'lovable-gateway' | 'groq' | 'anthropic' | 'bedrock';
  modelId: string;
  timeout: number;
}

function resolveModel(aiModel: string | undefined): ResolvedModel {
  switch (aiModel) {
    // Vertex AI direct models
    case 'vertex-flash':
      return { provider: 'vertex-ai', modelId: 'gemini-2.5-flash', timeout: 90_000 };
    case 'vertex-pro':
      return { provider: 'vertex-ai', modelId: 'gemini-2.5-pro', timeout: 120_000 };
    // Gemini 3.x preview models — direct Vertex AI (global endpoint)
    case 'vertex-3.1-pro':
      return { provider: 'vertex-ai', modelId: 'gemini-3.1-pro-preview', timeout: 90_000 };
    case 'vertex-3-flash':
      return { provider: 'vertex-ai', modelId: 'gemini-3-flash-preview', timeout: 90_000 };
    case 'vertex-3.1-flash-lite':
      return { provider: 'vertex-ai', modelId: 'gemini-3.1-flash-lite-preview', timeout: 60_000 };

    // Lovable AI Gateway models
    case 'gemini-flash':
      return { provider: 'lovable-gateway', modelId: 'google/gemini-2.5-flash', timeout: 90_000 };
    case 'gemini-pro':
      return { provider: 'lovable-gateway', modelId: 'google/gemini-2.5-pro', timeout: 120_000 };
    case 'lovable-gemini':
      return { provider: 'lovable-gateway', modelId: 'google/gemini-3-flash-preview', timeout: 90_000 };
    case 'gpt5':
      return { provider: 'lovable-gateway', modelId: 'openai/gpt-5', timeout: 120_000 };
    case 'gpt5-mini':
      return { provider: 'lovable-gateway', modelId: 'openai/gpt-5-mini', timeout: 90_000 };

    // Groq
    case 'groq': {
      return { provider: 'groq', modelId: 'llama-3.3-70b-versatile', timeout: 60_000 };
    }

    // Anthropic
    case 'claude-sonnet':
      return { provider: 'anthropic', modelId: 'claude-sonnet-4-20250514', timeout: 120_000 };

    // Bedrock
    case 'nova-pro':
      return { provider: 'bedrock', modelId: 'us.amazon.nova-pro-v1:0', timeout: 90_000 };
    case 'nova-premier':
      return { provider: 'bedrock', modelId: 'us.amazon.nova-premier-v1:0', timeout: 120_000 };
    case 'mistral':
      return { provider: 'bedrock', modelId: 'eu.mistral.mistral-large-2411-v1:0', timeout: 90_000 };

    // Default: Vertex Flash (safest for structured extraction)
    default:
      return { provider: 'vertex-ai', modelId: 'gemini-2.5-flash', timeout: 90_000 };
  }
}

// ── Truncated JSON repair ──
function repairTruncatedJson(raw: string): any {
  try { return JSON.parse(raw); } catch {}

  const text = raw.trim();
  const jobsMatch = text.match(/"jobs"\s*:\s*\[/);
  if (!jobsMatch) {
    throw new Error('Cannot parse AI response: no jobs array found in truncated output');
  }

  const arrayStart = text.indexOf('[', jobsMatch.index!);
  const afterArray = text.slice(arrayStart + 1);
  const completeObjects: string[] = [];
  let depth = 0;
  let objStart = -1;

  for (let i = 0; i < afterArray.length; i++) {
    const ch = afterArray[i];
    if (ch === '{' && depth === 0) { objStart = i; depth = 1; }
    else if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0 && objStart >= 0) {
        const candidate = afterArray.slice(objStart, i + 1);
        try { JSON.parse(candidate); completeObjects.push(candidate); } catch {}
        objStart = -1;
      }
    }
  }

  if (completeObjects.length === 0) {
    throw new Error('Cannot parse AI response: no complete job objects found in truncated output');
  }

  const repaired = `{"jobs":[${completeObjects.join(',')}]}`;
  return JSON.parse(repaired);
}

// ── AI call dispatcher ──
async function callAI(
  resolved: ResolvedModel,
  systemPrompt: string,
  userContent: string,
  requestId: string,
): Promise<{ jobs: any[] }> {
  const fullPrompt = `${systemPrompt}\n\n${userContent}`;
  const maxTokens = 8192;
  console.log(`[${requestId}] AI call | provider=${resolved.provider} | model=${resolved.modelId} | prompt_len=${fullPrompt.length} | maxTokens=${maxTokens}`);

  if (resolved.provider === 'vertex-ai') {
    const { callVertexGeminiWithMeta } = await import('../_shared/vertex-ai.ts');
    try {
      const { text: rawText, finishReason } = await callVertexGeminiWithMeta(resolved.modelId, fullPrompt, resolved.timeout, {
        responseMimeType: 'application/json',
        temperature: 0.1,
        maxOutputTokens: maxTokens,
      });
      if (finishReason === 'length' || finishReason === 'MAX_TOKENS') {
        console.warn(`[${requestId}] Vertex response truncated (finishReason=${finishReason}, len=${rawText.length}), attempting JSON repair`);
        const repaired = repairTruncatedJson(rawText);
        console.log(`[${requestId}] JSON repair succeeded, recovered ${repaired.jobs?.length || 0} jobs`);
        return repaired;
      }
      return JSON.parse(rawText);
    } catch (err: any) {
      if (err.message?.includes('404') || err.message?.includes('NOT_FOUND')) {
        console.error(`[${requestId}] Vertex 404 for model=${resolved.modelId}: ${err.message?.substring(0, 300)}`);
        throw new Error(`Model "${resolved.modelId}" returned 404 from Vertex AI. Ensure the model is enabled in your GCP project's Model Garden and the service account has Vertex AI User role.`);
      }
      throw err;
    }
  }

  if (resolved.provider === 'lovable-gateway') {
    const apiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!apiKey) throw new Error('LOVABLE_API_KEY not configured');
    const resp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: resolved.modelId,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent },
        ],
        response_format: { type: 'json_object' },
        max_tokens: maxTokens,
        temperature: 0.1,
      }),
    });
    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`Gateway error (${resp.status}): ${errText}`);
    }
    const json = await resp.json();
    const content = json.choices?.[0]?.message?.content;
    const finish = json.choices?.[0]?.finish_reason;
    if (!content) throw new Error('No content in gateway response');
    if (finish === 'length') {
      console.warn(`[${requestId}] Gateway response truncated, attempting JSON repair`);
      return repairTruncatedJson(content);
    }
    return JSON.parse(content);
  }

  if (resolved.provider === 'groq') {
    const apiKey = Deno.env.get('GROQ_API_KEY');
    if (!apiKey) throw new Error('GROQ_API_KEY not configured');
    const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: resolved.modelId,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent },
        ],
        response_format: { type: 'json_object' },
        max_tokens: maxTokens,
        temperature: 0.1,
      }),
    });
    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`Groq error (${resp.status}): ${errText}`);
    }
    const json = await resp.json();
    const content = json.choices?.[0]?.message?.content || '{"jobs":[]}';
    const finish = json.choices?.[0]?.finish_reason;
    if (finish === 'length') {
      console.warn(`[${requestId}] Groq response truncated, attempting JSON repair`);
      return repairTruncatedJson(content);
    }
    return JSON.parse(content);
  }

  if (resolved.provider === 'anthropic') {
    const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured');
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: resolved.modelId,
        system: systemPrompt,
        messages: [{ role: 'user', content: userContent }],
        max_tokens: maxTokens,
        temperature: 0.1,
      }),
    });
    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`Anthropic error (${resp.status}): ${errText}`);
    }
    const json = await resp.json();
    const text = json.content?.[0]?.text || '{"jobs":[]}';
    if (json.stop_reason === 'max_tokens') {
      console.warn(`[${requestId}] Anthropic response truncated, attempting JSON repair`);
      return repairTruncatedJson(text);
    }
    return JSON.parse(text);
  }

  if (resolved.provider === 'bedrock') {
    const { callVertexGeminiWithMeta } = await import('../_shared/vertex-ai.ts');
    console.warn(`[${requestId}] Bedrock not directly supported, falling back to vertex-flash`);
    const { text: rawText, finishReason } = await callVertexGeminiWithMeta('gemini-2.5-flash', `${systemPrompt}\n\n${userContent}`, 90_000, {
      responseMimeType: 'application/json',
      temperature: 0.1,
      maxOutputTokens: maxTokens,
    });
    if (finishReason === 'length' || finishReason === 'MAX_TOKENS') {
      console.warn(`[${requestId}] Bedrock fallback truncated, attempting JSON repair`);
      return repairTruncatedJson(rawText);
    }
    return JSON.parse(rawText);
  }

  throw new Error(`Unsupported provider: ${resolved.provider}`);
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

    // Auth
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

    const { text, filename, issueDetails, batchId, aiModel } = await req.json();
    if (!text || text.trim().length < 50)
      return new Response(
        JSON.stringify({ error: "Text too short to extract jobs from" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );

    // Resolve model from UI key
    const resolved = resolveModel(aiModel);
    console.log(`[${requestId}] Model selection | ui_key=${aiModel || '(default)'} | provider=${resolved.provider} | final_model=${resolved.modelId}`);

    // Sanitize text
    const rawLen = text.length;
    const cleaned = sanitizeText(text);
    const cleanedLen = cleaned.length;
    console.log(`[${requestId}] Text | filename=${filename || 'unknown'} | raw=${rawLen} | cleaned=${cleanedLen} | reduction=${Math.round((1 - cleanedLen / rawLen) * 100)}%`);

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

    const parsed = await callAI(resolved, systemPrompt, cleaned, requestId);

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
      const resolvedDt = resolveDate(lastDateText);

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
        last_date_resolved: resolvedDt,
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
            .update({ ...row, status: "pending" })
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
    const is402 = /402|Payment Required/i.test(errMsg);

    if (is429) {
      console.warn(`[${requestId}] Rate limited (429)`);
      return new Response(
        JSON.stringify({
          error: "AI service is temporarily overloaded. Please wait a minute and try again.",
          code: "VERTEX_RATE_LIMITED",
        }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (is402) {
      console.warn(`[${requestId}] Payment required (402)`);
      return new Response(
        JSON.stringify({
          error: "AI credits exhausted. Please add funds and try again.",
          code: "GATEWAY_PAYMENT_REQUIRED",
        }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.error(`[${requestId}] Unhandled error:`, error);
    return new Response(
      JSON.stringify({ error: errMsg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
