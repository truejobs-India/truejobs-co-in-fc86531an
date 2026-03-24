import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth-first
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } =
      await userClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub as string;

    // Admin check
    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: roleData } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Admin role required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { draft_ids } = await req.json();
    if (!Array.isArray(draft_ids) || draft_ids.length === 0) {
      return new Response(
        JSON.stringify({ error: "draft_ids array required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    let published = 0;
    let skipped = 0;
    let failed = 0;
    const errors: string[] = [];
    let issueId: string | null = null;

    for (const draftId of draft_ids) {
      try {
        // Fetch draft
        const { data: draft, error: fetchErr } = await adminClient
          .from("azure_emp_news_draft_jobs")
          .select("*")
          .eq("id", draftId)
          .maybeSingle();

        if (fetchErr || !draft) {
          errors.push(`Draft ${draftId}: not found`);
          failed++;
          continue;
        }

        issueId = draft.issue_id;

        // Skip already published
        if (draft.publish_status === "published") {
          skipped++;
          continue;
        }

        const cleaned = (draft.ai_cleaned_data || draft.draft_data) as Record<
          string,
          unknown
        >;

        // Map fields to employment_news_jobs
        const postNames = Array.isArray(cleaned.post_names)
          ? (cleaned.post_names as string[]).join(", ")
          : (cleaned.post_names as string) || null;

        const totalVacancies = cleaned.total_vacancies
          ? parseInt(String(cleaned.total_vacancies), 10) || null
          : null;

        const jobRecord = {
          org_name: (cleaned.employer_name as string) || draft.draft_title,
          post: postNames,
          vacancies: totalVacancies,
          qualification: (cleaned.qualification as string) || null,
          age_limit: (cleaned.age_limit as string) || null,
          salary: (cleaned.salary as string) || null,
          location: (cleaned.location as string) || null,
          application_mode: (cleaned.application_method as string) || null,
          apply_link: (cleaned.official_website as string) || null,
          last_date: (cleaned.last_date as string) || null,
          advertisement_number: (cleaned.ad_reference as string) || null,
          description: (cleaned.summary as string) || null,
          source: "Employment News (Azure)",
          status: "pending",
        };

        // Insert into employment_news_jobs
        const { data: inserted, error: insertErr } = await adminClient
          .from("employment_news_jobs")
          .insert(jobRecord)
          .select("id")
          .single();

        if (insertErr || !inserted) {
          const msg = insertErr?.message || "Insert failed";
          errors.push(`Draft ${draftId}: ${msg}`);

          // Log failure
          await adminClient.from("azure_emp_news_publish_logs").insert({
            issue_id: draft.issue_id,
            draft_job_id: draftId,
            action: "publish",
            status: "failed",
            message: msg,
          });

          // Update draft status
          await adminClient
            .from("azure_emp_news_draft_jobs")
            .update({ publish_status: "failed" })
            .eq("id", draftId);

          failed++;
          continue;
        }

        // Update draft with success
        await adminClient
          .from("azure_emp_news_draft_jobs")
          .update({
            publish_status: "published",
            linked_live_job_id: inserted.id,
          })
          .eq("id", draftId);

        // Log success
        await adminClient.from("azure_emp_news_publish_logs").insert({
          issue_id: draft.issue_id,
          draft_job_id: draftId,
          action: "publish",
          status: "success",
          message: `Published as job ${inserted.id}`,
        });

        published++;
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        errors.push(`Draft ${draftId}: ${msg}`);
        failed++;
      }
    }

    // Update issue publish_status if we have an issue
    if (issueId) {
      const { data: allDrafts } = await adminClient
        .from("azure_emp_news_draft_jobs")
        .select("publish_status")
        .eq("issue_id", issueId);

      if (allDrafts && allDrafts.length > 0) {
        const publishedCount = allDrafts.filter(
          (d) => d.publish_status === "published"
        ).length;
        let issuePublishStatus = "pending";
        if (publishedCount === allDrafts.length) {
          issuePublishStatus = "published";
        } else if (publishedCount > 0) {
          issuePublishStatus = "partially_published";
        }

        await adminClient
          .from("azure_emp_news_issues")
          .update({ publish_status: issuePublishStatus })
          .eq("id", issueId);
      }
    }

    return new Response(
      JSON.stringify({ published, skipped, failed, errors }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
