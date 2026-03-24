import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Thin orchestrator — validates issue, recovers stale pages, returns pending page IDs.
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

  // Verify Azure credentials exist
  const azureEndpoint = Deno.env.get("AZURE_DOCINTEL_ENDPOINT");
  const azureKey = Deno.env.get("AZURE_DOCINTEL_KEY");
  if (!azureEndpoint || !azureKey) {
    return new Response(
      JSON.stringify({ error: "Azure credentials not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Recover stale pages stuck in 'processing' for >5 minutes
  const staleThreshold = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const { data: stalePages } = await serviceClient
    .from("azure_emp_news_pages")
    .select("id")
    .eq("issue_id", issue_id)
    .eq("ocr_status", "processing")
    .lt("updated_at", staleThreshold);

  let staleRecovered = 0;
  if (stalePages && stalePages.length > 0) {
    const staleIds = stalePages.map((p: any) => p.id);
    await serviceClient
      .from("azure_emp_news_pages")
      .update({ ocr_status: "pending", error_message: "Reset from stale processing state" })
      .in("id", staleIds);
    staleRecovered = staleIds.length;
    console.log(`[start-ocr] Recovered ${staleRecovered} stale pages`);
  }

  // Fetch all pending pages
  const { data: pages, error: pagesErr } = await serviceClient
    .from("azure_emp_news_pages")
    .select("id, page_no")
    .eq("issue_id", issue_id)
    .eq("ocr_status", "pending")
    .order("page_no", { ascending: true });

  if (pagesErr) {
    return new Response(JSON.stringify({ error: pagesErr.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!pages || pages.length === 0) {
    return new Response(
      JSON.stringify({ message: "No pending pages to process", page_ids: [], stale_recovered: staleRecovered }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Set issue status to processing
  await serviceClient
    .from("azure_emp_news_issues")
    .update({ ocr_status: "processing" })
    .eq("id", issue_id);

  const page_ids = pages.map((p: any) => p.id);

  return new Response(
    JSON.stringify({ page_ids, stale_recovered: staleRecovered }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
