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

  // Auth-first
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

  // Fetch all pending pages for this issue
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
      JSON.stringify({ message: "No pending pages to process", processed: 0 }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Update issue status to processing
  await serviceClient
    .from("azure_emp_news_issues")
    .update({ ocr_status: "processing" })
    .eq("id", issue_id);

  const azureEndpoint = Deno.env.get("AZURE_DOCINTEL_ENDPOINT");
  const azureKey = Deno.env.get("AZURE_DOCINTEL_KEY");
  if (!azureEndpoint || !azureKey) {
    return new Response(
      JSON.stringify({ error: "Azure credentials not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  let completed = 0;
  let failed = 0;
  const results: Array<{ page_no: number; status: string; error?: string }> = [];

  // Process pages sequentially
  for (const page of pages) {
    try {
      // Fetch full page record
      const { data: fullPage } = await serviceClient
        .from("azure_emp_news_pages")
        .select("*")
        .eq("id", page.id)
        .single();

      if (!fullPage) {
        results.push({ page_no: page.page_no, status: "failed", error: "Page not found" });
        failed++;
        continue;
      }

      // Mark processing
      await serviceClient
        .from("azure_emp_news_pages")
        .update({ ocr_status: "processing", error_message: null })
        .eq("id", page.id);

      // Get image URL
      const { data: urlData } = serviceClient.storage
        .from("employment-news-azure")
        .getPublicUrl(fullPage.storage_path);

      const imgResponse = await fetch(urlData.publicUrl);
      if (!imgResponse.ok) {
        throw new Error(`Image download failed: ${imgResponse.status}`);
      }
      const imageBytes = await imgResponse.arrayBuffer();
      const contentType = fullPage.mime_type || "image/jpeg";

      // Submit to Azure
      const analyzeUrl = `${azureEndpoint.replace(/\/$/, "")}/documentintelligence/documentModels/prebuilt-layout:analyze?api-version=2024-11-30`;

      const submitResp = await fetch(analyzeUrl, {
        method: "POST",
        headers: {
          "Ocp-Apim-Subscription-Key": azureKey,
          "Content-Type": contentType,
        },
        body: imageBytes,
      });

      if (!submitResp.ok) {
        const errText = await submitResp.text();
        throw new Error(`Azure submit (${submitResp.status}): ${errText}`);
      }

      const operationUrl = submitResp.headers.get("Operation-Location");
      if (!operationUrl) throw new Error("No Operation-Location header");

      await serviceClient
        .from("azure_emp_news_pages")
        .update({ azure_operation_url: operationUrl })
        .eq("id", page.id);

      await submitResp.text();

      // Poll
      let result = null;
      let delay = 2000;
      for (let attempt = 0; attempt < 15; attempt++) {
        await new Promise((r) => setTimeout(r, delay));
        const pollResp = await fetch(operationUrl, {
          headers: { "Ocp-Apim-Subscription-Key": azureKey },
        });
        if (!pollResp.ok) {
          const pollErr = await pollResp.text();
          throw new Error(`Poll failed (${pollResp.status}): ${pollErr}`);
        }
        const pollResult = await pollResp.json();
        if (pollResult.status === "succeeded") {
          result = pollResult;
          break;
        } else if (pollResult.status === "failed") {
          throw new Error(pollResult.error?.message || "Azure processing failed");
        }
        delay = Math.min(delay * 1.5, 10000);
      }

      if (!result) throw new Error("Azure processing timed out");

      const extractedContent = result.analyzeResult?.content || "";

      await serviceClient
        .from("azure_emp_news_pages")
        .update({
          ocr_status: "completed",
          azure_result_json: result,
          extracted_content: extractedContent,
          error_message: null,
          processed_at: new Date().toISOString(),
        })
        .eq("id", page.id);

      completed++;
      results.push({ page_no: page.page_no, status: "completed" });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      const { data: currentPage } = await serviceClient
        .from("azure_emp_news_pages")
        .select("retry_count")
        .eq("id", page.id)
        .single();

      await serviceClient
        .from("azure_emp_news_pages")
        .update({
          ocr_status: "failed",
          error_message: errorMsg.substring(0, 2000),
          retry_count: ((currentPage as any)?.retry_count || 0) + 1,
        })
        .eq("id", page.id);

      failed++;
      results.push({ page_no: page.page_no, status: "failed", error: errorMsg });
    }

    // Update issue counters after each page
    const { data: allPages } = await serviceClient
      .from("azure_emp_news_pages")
      .select("ocr_status")
      .eq("issue_id", issue_id);

    if (allPages) {
      const total = allPages.length;
      const comp = allPages.filter((p: any) => p.ocr_status === "completed").length;
      const fail = allPages.filter((p: any) => p.ocr_status === "failed").length;
      const proc = allPages.filter((p: any) => p.ocr_status === "processing").length;
      const pend = allPages.filter((p: any) => p.ocr_status === "pending").length;

      let ocrStatus = "processing";
      if (proc === 0 && pend === 0) {
        if (comp === total) ocrStatus = "completed";
        else if (fail > 0 && comp > 0) ocrStatus = "partially_completed";
        else if (fail === total) ocrStatus = "failed";
        else ocrStatus = "partially_completed";
      }

      await serviceClient
        .from("azure_emp_news_issues")
        .update({ ocr_completed_pages: comp, ocr_failed_pages: fail, ocr_status: ocrStatus })
        .eq("id", issue_id);
    }
  }

  return new Response(
    JSON.stringify({ processed: pages.length, completed, failed, results }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
