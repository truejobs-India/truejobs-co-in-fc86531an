import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Thin orchestrator — resets failed pages to pending and returns their IDs.
 * Does NOT process any pages. The frontend loops over azure-emp-news-process-page.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const token = authHeader.replace("Bearer ", "");
  const { data: claimsData, error: claimsErr } = await supabase.auth.getClaims(token);
  if (claimsErr || !claimsData?.claims) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const userId = claimsData.claims.sub as string;
  const serviceClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { data: roleData } = await serviceClient
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

  const { issue_id } = await req.json();
  if (!issue_id) {
    return new Response(JSON.stringify({ error: "issue_id required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Find all failed pages
  const { data: failedPages, error: fetchErr } = await serviceClient
    .from("azure_emp_news_pages")
    .select("id, page_no")
    .eq("issue_id", issue_id)
    .eq("ocr_status", "failed")
    .order("page_no", { ascending: true });

  if (fetchErr) {
    return new Response(JSON.stringify({ error: fetchErr.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!failedPages || failedPages.length === 0) {
    return new Response(
      JSON.stringify({ message: "No failed pages to retry", page_ids: [] }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Reset all failed pages to pending
  const failedIds = failedPages.map((p: any) => p.id);
  await serviceClient
    .from("azure_emp_news_pages")
    .update({ ocr_status: "pending", error_message: null })
    .in("id", failedIds);

  // Set issue status to processing
  await serviceClient
    .from("azure_emp_news_issues")
    .update({ ocr_status: "processing" })
    .eq("id", issue_id);

  return new Response(
    JSON.stringify({ page_ids: failedIds, retried: failedIds.length }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
