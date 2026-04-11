import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── Model routing (direct API only — NO Lovable Gateway) ──

const VERTEX_MODEL_MAP: Record<string, { vertexModel: string; timeoutMs: number }> = {
  'vertex-flash':         { vertexModel: 'gemini-2.5-flash', timeoutMs: 90_000 },
  'vertex-pro':           { vertexModel: 'gemini-2.5-pro', timeoutMs: 120_000 },
  'vertex-3.1-pro':       { vertexModel: 'gemini-3.1-pro-preview', timeoutMs: 120_000 },
  'vertex-3-flash':       { vertexModel: 'gemini-3-flash-preview', timeoutMs: 90_000 },
  'vertex-3.1-flash-lite': { vertexModel: 'gemini-3.1-flash-lite-preview', timeoutMs: 60_000 },
};

const BEDROCK_MODELS = new Set(['nova-pro', 'nova-premier', 'nemotron-120b', 'mistral']);
const AZURE_OPENAI_MODELS = new Set(['azure-gpt4o-mini', 'azure-gpt41-mini', 'azure-gpt5-mini']);
const AZURE_DEEPSEEK_MODELS = new Set(['azure-deepseek-v3', 'azure-deepseek-r1']);
const SARVAM_MODELS = new Set(['sarvam-30b', 'sarvam-105b']);

const ALL_ALLOWED_MODELS = new Set([
  ...Object.keys(VERTEX_MODEL_MAP),
  ...BEDROCK_MODELS,
  ...SARVAM_MODELS,
  ...AZURE_OPENAI_MODELS,
  ...AZURE_DEEPSEEK_MODELS,
]);

// ── Schema for structured extraction ──

const EXTRACTION_SCHEMA = {
  type: "object",
  properties: {
    employer_name: { type: "string", description: "Full official name of the recruiting organization" },
    post_names: { type: "array", items: { type: "string" }, description: "List of post/position names" },
    total_vacancies: { type: "string", description: "Total vacancies if mentioned, or null" },
    qualification: { type: "string", description: "Required educational qualification(s)" },
    age_limit: { type: "string", description: "Age limit details if mentioned" },
    salary: { type: "string", description: "Salary, pay scale, or pay level if mentioned" },
    application_method: { type: "string", description: "How to apply (online/offline/email/post)" },
    official_website: { type: "string", description: "Official website URL if mentioned" },
    last_date: { type: "string", description: "Last date of application if mentioned" },
    ad_reference: { type: "string", description: "Advertisement or notification number if present" },
    location: { type: "string", description: "Job location if mentioned" },
    notice_type: { type: "string", enum: ["job_notice", "admission", "editorial", "advertisement", "unknown"], description: "Type of notice" },
    summary: { type: "string", description: "One-line summary of the notice" },
  },
  required: ["employer_name", "post_names", "notice_type", "summary"],
  additionalProperties: false,
};

const SYSTEM_PROMPT = `You are an expert at reading Indian government Employment News newspaper notices. Your task is to extract structured job/recruitment details from OCR-processed text.

Rules:
1. Clean OCR artifacts (broken words, extra spaces, misread characters) but NEVER add information not present in the source text.
2. If a field is not mentioned in the text, leave it as null or empty string - do NOT guess.
3. Preserve the original meaning exactly.
4. For dates, try to normalize to a readable format but keep the original if unclear.
5. For websites, clean OCR damage to URLs (e.g., "www .example .com" → "www.example.com").
6. Post names should be extracted as individual items, not combined.
7. If the text appears to be editorial content, an advertisement, or admission notice rather than a job recruitment, set notice_type accordingly and extract whatever fields are applicable.

Return valid JSON matching the provided schema. Do NOT include any text outside the JSON object.`;

// ── Multi-model AI dispatcher (NO Lovable Gateway) ──

async function callAI(
  systemPrompt: string,
  userPrompt: string,
  aiModel: string,
): Promise<Record<string, unknown>> {
  const fullPrompt = `${systemPrompt}\n\n${userPrompt}\n\nReturn valid JSON matching this schema:\n${JSON.stringify(EXTRACTION_SCHEMA, null, 2)}`;

  let rawText: string;

  // ── Route: Vertex AI ──
  const vertexDef = VERTEX_MODEL_MAP[aiModel];
  if (vertexDef) {
    console.log(`[ai-clean-drafts] routing to Vertex AI: ${vertexDef.vertexModel}`);
    const { callVertexGemini } = await import('../_shared/vertex-ai.ts');
    rawText = await callVertexGemini(vertexDef.vertexModel, fullPrompt, vertexDef.timeoutMs, {
      temperature: 0.3,
      maxOutputTokens: 4096,
    });
  }
  // ── Route: Bedrock Nova ──
  else if (aiModel === 'nova-pro' || aiModel === 'nova-premier' || aiModel === 'nemotron-120b') {
    console.log(`[ai-clean-drafts] routing to Bedrock Nova: ${aiModel}`);
    const { callBedrockNova } = await import('../_shared/bedrock-nova.ts');
    // Hindi safeguard fires automatically inside callBedrockNova
    rawText = await callBedrockNova(aiModel, fullPrompt, {
      maxTokens: 4096,
      temperature: 0.3,
      timeoutMs: 120_000,
    });
  }
  // ── Route: Bedrock Mistral ──
  else if (aiModel === 'mistral') {
    console.log(`[ai-clean-drafts] routing to Bedrock Mistral`);
    const { awsSigV4Fetch } = await import('../_shared/bedrock-nova.ts');
    const region = Deno.env.get('AWS_REGION') || 'us-east-1';
    const host = `bedrock-runtime.${region}.amazonaws.com`;
    const mistralModelId = 'us.mistral.mistral-large-2407-v1:0';
    const payload = JSON.stringify({
      messages: [{ role: 'user', content: [{ text: fullPrompt }] }],
      inferenceConfig: { maxTokens: 4096, temperature: 0.3 },
    });
    const resp = await awsSigV4Fetch(host, `/model/${mistralModelId}/converse`, payload, region, 'bedrock');
    if (!resp.ok) {
      const errText = await resp.text().catch(() => 'unknown');
      throw new Error(`Mistral Bedrock error ${resp.status}: ${errText.substring(0, 300)}`);
    }
    const data = await resp.json();
    rawText = data?.output?.message?.content?.[0]?.text || '';
  }
  // ── Route: Azure OpenAI ──
  else if (AZURE_OPENAI_MODELS.has(aiModel)) {
    console.log(`[ai-clean-drafts] routing to Azure OpenAI: ${aiModel}`);
    if (aiModel === 'azure-gpt41-mini') {
      const { callAzureGPT41Mini } = await import('../_shared/azure-openai.ts');
      rawText = await callAzureGPT41Mini(fullPrompt, { maxTokens: 4096, temperature: 0.3, timeoutMs: 120_000 });
    } else if (aiModel === 'azure-gpt5-mini') {
      const { callAzureGPT5Mini } = await import('../_shared/azure-openai.ts');
      rawText = await callAzureGPT5Mini(fullPrompt, { maxTokens: 4096, temperature: 0.3, timeoutMs: 120_000 });
    } else {
      const { callAzureOpenAI } = await import('../_shared/azure-openai.ts');
      rawText = await callAzureOpenAI(fullPrompt, { maxTokens: 4096, temperature: 0.3, timeoutMs: 120_000 });
    }
  }
  // ── Route: Azure DeepSeek ──
  else if (AZURE_DEEPSEEK_MODELS.has(aiModel)) {
    console.log(`[ai-clean-drafts] routing to Azure DeepSeek: ${aiModel}`);
    const { callAzureDeepSeek } = await import('../_shared/azure-deepseek.ts');
    const dsModel = aiModel === 'azure-deepseek-r1' ? 'DeepSeek-R1' as const : 'DeepSeek-V3.1' as const;
    rawText = await callAzureDeepSeek(fullPrompt, { model: dsModel, maxTokens: 4096, temperature: 0.3, timeoutMs: 120_000 });
  }
  // ── Route: Sarvam AI ──
  else if (SARVAM_MODELS.has(aiModel)) {
    console.log(`[ai-clean-drafts] routing to Sarvam: ${aiModel}`);
    const apiKey = Deno.env.get('SARVAM_API_KEY');
    if (!apiKey) throw new Error('SARVAM_API_KEY not configured');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 120_000);
    try {
      const res = await fetch('https://api.sarvam.ai/v1/chat/completions', {
        method: 'POST',
        headers: { 'api-subscription-key': apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: aiModel,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `${userPrompt}\n\nReturn valid JSON matching this schema:\n${JSON.stringify(EXTRACTION_SCHEMA, null, 2)}` },
          ],
          max_tokens: 4096,
          temperature: 0.3,
        }),
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Sarvam API error ${res.status}: ${errText.substring(0, 200)}`);
      }
      const data = await res.json();
      rawText = data?.choices?.[0]?.message?.content || '';
    } catch (e) {
      clearTimeout(timer);
      throw e;
    }
  } else {
    throw new Error(`Model "${aiModel}" is not supported in this workflow`);
  }

  if (!rawText || !rawText.trim()) {
    throw new Error(`${aiModel} returned empty response`);
  }

  // Parse JSON from response text
  const jsonMatch = rawText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error(`${aiModel} did not return valid JSON. Raw: ${rawText.substring(0, 200)}`);
  }
  return JSON.parse(jsonMatch[0]);
}

// ── Helpers ──

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function isJobRelevant(blocks: any[]): boolean {
  if (!blocks || blocks.length === 0) return true;
  const types = blocks.map((b: any) => b.fragment_type);
  const jobCount = types.filter((t: string) => t === 'job_notice' || t === 'unknown').length;
  return jobCount >= types.length / 2;
}

function validateDraft(extracted: any, mergedText: string): { status: string; notes: string[] } {
  const notes: string[] = [];
  let status = "passed";

  if (!extracted.employer_name || extracted.employer_name.trim() === "") {
    notes.push("employer_name is empty");
    status = "review_needed";
  }
  if (!extracted.post_names || extracted.post_names.length === 0) {
    if (extracted.notice_type === "job_notice" || !extracted.notice_type) {
      notes.push("post_names is empty for a job notice");
      status = "review_needed";
    }
  }
  if (extracted.official_website) {
    const w = extracted.official_website.trim();
    if (w && !/^https?:\/\//i.test(w) && !/\.\w{2,}/.test(w)) {
      notes.push(`website may be invalid: ${w}`);
    }
  }
  if (extracted.last_date) {
    const d = extracted.last_date.trim();
    if (d && !/\d/.test(d)) {
      notes.push(`last_date may be unparseable: ${d}`);
    }
  }
  if (mergedText.trim().length < 50) {
    notes.push("source text very short (<50 chars)");
    status = "review_needed";
  }
  return { status, notes };
}

// ── Main handler ──

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: claimsData, error: claimsErr } = await supabase.auth.getClaims(authHeader.replace("Bearer ", ""));
  if (claimsErr || !claimsData?.claims) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
  const userId = claimsData.claims.sub as string;

  const serviceClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: roleData } = await serviceClient.from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle();
  if (!roleData) {
    return new Response(JSON.stringify({ error: "Admin access required" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  try {
    const body = await req.json();
    const { issue_id, notice_id, aiModel } = body;
    if (!issue_id && !notice_id) throw new Error("issue_id or notice_id required");

    // Validate aiModel
    if (!aiModel || !ALL_ALLOWED_MODELS.has(aiModel)) {
      return new Response(JSON.stringify({
        error: `Invalid or missing aiModel. Allowed: ${[...ALL_ALLOWED_MODELS].join(', ')}`,
      }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let query = serviceClient.from("azure_emp_news_reconstructed_notices")
      .select("*")
      .eq("ai_status", "pending")
      .order("start_page", { ascending: true });

    if (notice_id) {
      query = serviceClient.from("azure_emp_news_reconstructed_notices")
        .select("*")
        .eq("id", notice_id);
    } else {
      query = query.eq("issue_id", issue_id);
    }

    const { data: notices, error: noticeErr } = await query;
    if (noticeErr) throw new Error(`Failed to load notices: ${noticeErr.message}`);
    if (!notices || notices.length === 0) {
      throw new Error("No notices found with ai_status=pending");
    }

    const effectiveIssueId = issue_id || notices[0].issue_id;

    await serviceClient.from("azure_emp_news_issues")
      .update({ ai_status: "processing" })
      .eq("id", effectiveIssueId);

    let processed = 0;
    let failed = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const notice of notices) {
      try {
        const blocks = (notice.merged_blocks_json as any[]) || [];
        if (!isJobRelevant(blocks)) {
          await serviceClient.from("azure_emp_news_reconstructed_notices")
            .update({ ai_status: "completed" })
            .eq("id", notice.id);
          skipped++;
          continue;
        }

        await serviceClient.from("azure_emp_news_reconstructed_notices")
          .update({ ai_status: "processing" })
          .eq("id", notice.id);

        const userPrompt = `Extract structured details from this Employment News notice (pages ${notice.start_page}-${notice.end_page}):\n\n${notice.merged_text}`;

        const extracted = await callAI(SYSTEM_PROMPT, userPrompt, aiModel);

        const validation = validateDraft(extracted, notice.merged_text);

        const draftTitle = [
          extracted.employer_name || notice.employer_name || "Unknown Employer",
          (extracted.post_names as string[])?.[0] || "",
        ].filter(Boolean).join(" — ");

        const aiCleanedData = {
          ...extracted,
          source_pages: `${notice.start_page}-${notice.end_page}`,
          notice_key: notice.notice_key,
          ai_model_used: aiModel,
        };

        await serviceClient.from("azure_emp_news_draft_jobs").insert({
          issue_id: notice.issue_id,
          reconstructed_notice_id: notice.id,
          draft_title: (draftTitle as string).substring(0, 500),
          draft_data: extracted,
          ai_cleaned_data: aiCleanedData,
          validation_status: validation.status,
          validation_notes: validation.notes,
          publish_status: "draft",
        });

        await serviceClient.from("azure_emp_news_reconstructed_notices")
          .update({ ai_status: "completed" })
          .eq("id", notice.id);

        processed++;
        console.log(`[ai-clean-drafts] ${aiModel} processed notice ${notice.notice_key}`);

        if (notices.indexOf(notice) < notices.length - 1) {
          await delay(1000);
        }
      } catch (noticeErr: any) {
        console.error(`[ai-clean-drafts] Failed notice ${notice.notice_key}:`, noticeErr);
        failed++;
        const errMsg = noticeErr instanceof Error ? noticeErr.message : "Unknown error";
        errors.push(`${notice.notice_key}: ${errMsg}`);

        // On rate limit, reset to pending and stop
        if (errMsg.includes('429') || errMsg.includes('RESOURCE_EXHAUSTED') || errMsg.includes('rate limit')) {
          await serviceClient.from("azure_emp_news_reconstructed_notices")
            .update({ ai_status: "pending" })
            .eq("id", notice.id);
          errors.push(`Rate limited at notice ${notice.notice_key}. Remaining notices left as pending.`);
          break;
        }

        await serviceClient.from("azure_emp_news_reconstructed_notices")
          .update({ ai_status: "failed" })
          .eq("id", notice.id);
      }
    }

    const totalHandled = processed + skipped + failed;
    const finalStatus = failed === notices.length ? "failed"
      : totalHandled === notices.length ? "completed"
      : "processing";

    await serviceClient.from("azure_emp_news_issues")
      .update({ ai_status: finalStatus, updated_at: new Date().toISOString() })
      .eq("id", effectiveIssueId);

    return new Response(JSON.stringify({
      success: true,
      ai_model: aiModel,
      processed,
      skipped,
      failed,
      total: notices.length,
      errors: errors.length > 0 ? errors : undefined,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e) {
    console.error("[ai-clean-drafts] error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
