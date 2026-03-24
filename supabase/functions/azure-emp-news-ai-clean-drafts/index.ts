import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TOOL_SCHEMA = {
  type: "function" as const,
  function: {
    name: "extract_job_details",
    description: "Extract structured job/recruitment details from an Employment News notice. Clean OCR artifacts but do NOT hallucinate information that is not in the source text.",
    parameters: {
      type: "object",
      properties: {
        employer_name: { type: "string", description: "Full official name of the recruiting organization" },
        post_names: {
          type: "array",
          items: { type: "string" },
          description: "List of post/position names mentioned in the notice",
        },
        total_vacancies: { type: "string", description: "Total number of vacancies if mentioned, or null" },
        qualification: { type: "string", description: "Required educational qualification(s)" },
        age_limit: { type: "string", description: "Age limit details if mentioned" },
        salary: { type: "string", description: "Salary, pay scale, or pay level if mentioned" },
        application_method: { type: "string", description: "How to apply (online/offline/email/post)" },
        official_website: { type: "string", description: "Official website URL if mentioned" },
        last_date: { type: "string", description: "Last date of application if mentioned" },
        ad_reference: { type: "string", description: "Advertisement or notification number if present" },
        location: { type: "string", description: "Job location if mentioned" },
        notice_type: {
          type: "string",
          enum: ["job_notice", "admission", "editorial", "advertisement", "unknown"],
          description: "Type of notice",
        },
        summary: { type: "string", description: "One-line summary of the notice" },
      },
      required: ["employer_name", "post_names", "notice_type", "summary"],
      additionalProperties: false,
    },
  },
};

const SYSTEM_PROMPT = `You are an expert at reading Indian government Employment News newspaper notices. Your task is to extract structured job/recruitment details from OCR-processed text.

Rules:
1. Clean OCR artifacts (broken words, extra spaces, misread characters) but NEVER add information not present in the source text.
2. If a field is not mentioned in the text, leave it as null or empty string - do NOT guess.
3. Preserve the original meaning exactly.
4. For dates, try to normalize to a readable format but keep the original if unclear.
5. For websites, clean OCR damage to URLs (e.g., "www .example .com" → "www.example.com").
6. Post names should be extracted as individual items, not combined.
7. If the text appears to be editorial content, an advertisement, or admission notice rather than a job recruitment, set notice_type accordingly and extract whatever fields are applicable.`;

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

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: claimsData, error: claimsErr } = await supabase.auth.getClaims(authHeader.replace("Bearer ", ""));
  if (claimsErr || !claimsData?.claims) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
  }
  const userId = claimsData.claims.sub as string;

  const serviceClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: roleData } = await serviceClient.from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle();
  if (!roleData) {
    return new Response(JSON.stringify({ error: "Admin access required" }), { status: 403, headers: corsHeaders });
  }

  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();
    const { issue_id, notice_id } = body;
    if (!issue_id && !notice_id) throw new Error("issue_id or notice_id required");

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

        const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              { role: "system", content: SYSTEM_PROMPT },
              {
                role: "user",
                content: `Extract structured details from this Employment News notice (pages ${notice.start_page}-${notice.end_page}):\n\n${notice.merged_text}`,
              },
            ],
            tools: [TOOL_SCHEMA],
            tool_choice: { type: "function", function: { name: "extract_job_details" } },
          }),
        });

        if (!aiResponse.ok) {
          const status = aiResponse.status;
          const errText = await aiResponse.text();
          if (status === 429) {
            errors.push(`Rate limited at notice ${notice.notice_key}. Try again later.`);
            await serviceClient.from("azure_emp_news_reconstructed_notices")
              .update({ ai_status: "pending" })
              .eq("id", notice.id);
            break;
          }
          if (status === 402) {
            errors.push("Payment required. Add credits to continue.");
            await serviceClient.from("azure_emp_news_reconstructed_notices")
              .update({ ai_status: "pending" })
              .eq("id", notice.id);
            break;
          }
          throw new Error(`AI gateway error ${status}: ${errText}`);
        }

        const aiData = await aiResponse.json();
        const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
        if (!toolCall?.function?.arguments) {
          throw new Error("No tool call in AI response");
        }

        const extracted = JSON.parse(toolCall.function.arguments);
        
        const validation = validateDraft(extracted, notice.merged_text);

        const draftTitle = [
          extracted.employer_name || notice.employer_name || "Unknown Employer",
          extracted.post_names?.[0] || "",
        ].filter(Boolean).join(" — ");

        const aiCleanedData = {
          ...extracted,
          source_pages: `${notice.start_page}-${notice.end_page}`,
          notice_key: notice.notice_key,
        };

        await serviceClient.from("azure_emp_news_draft_jobs").insert({
          issue_id: notice.issue_id,
          reconstructed_notice_id: notice.id,
          draft_title: draftTitle.substring(0, 500),
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

        if (notices.indexOf(notice) < notices.length - 1) {
          await delay(1000);
        }

      } catch (noticeErr) {
        console.error(`Failed notice ${notice.notice_key}:`, noticeErr);
        failed++;
        errors.push(`${notice.notice_key}: ${noticeErr instanceof Error ? noticeErr.message : "Unknown error"}`);
        
        await serviceClient.from("azure_emp_news_reconstructed_notices")
          .update({ ai_status: "failed" })
          .eq("id", notice.id);
      }
    }

    const finalStatus = failed === notices.length ? "failed"
      : (processed + skipped) === notices.length ? "completed"
      : "processing";

    await serviceClient.from("azure_emp_news_issues")
      .update({ ai_status: finalStatus, updated_at: new Date().toISOString() })
      .eq("id", effectiveIssueId);

    return new Response(JSON.stringify({
      success: true,
      processed,
      skipped,
      failed,
      total: notices.length,
      errors: errors.length > 0 ? errors : undefined,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e) {
    console.error("ai-clean-drafts error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
