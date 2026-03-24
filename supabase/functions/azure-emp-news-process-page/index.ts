import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function processPage(
  supabase: ReturnType<typeof createClient>,
  pageId: string
): Promise<{ success: boolean; error?: string }> {
  const azureEndpoint = Deno.env.get("AZURE_DOCINTEL_ENDPOINT");
  const azureKey = Deno.env.get("AZURE_DOCINTEL_KEY");
  if (!azureEndpoint || !azureKey) {
    return { success: false, error: "Azure Document Intelligence credentials not configured" };
  }

  // Fetch page record
  const { data: page, error: fetchErr } = await supabase
    .from("azure_emp_news_pages")
    .select("*")
    .eq("id", pageId)
    .single();

  if (fetchErr || !page) {
    return { success: false, error: `Page not found: ${fetchErr?.message}` };
  }

  // Mark processing
  await supabase
    .from("azure_emp_news_pages")
    .update({ ocr_status: "processing", error_message: null })
    .eq("id", pageId);

  try {
    // Get public URL for the image
    const { data: urlData } = supabase.storage
      .from("employment-news-azure")
      .getPublicUrl(page.storage_path);

    const imageUrl = urlData?.publicUrl;
    if (!imageUrl) {
      throw new Error("Could not get public URL for image");
    }

    // Download image bytes
    const imgResponse = await fetch(imageUrl);
    if (!imgResponse.ok) {
      throw new Error(`Failed to download image: ${imgResponse.status}`);
    }
    const imageBytes = await imgResponse.arrayBuffer();
    const contentType = page.mime_type || "image/jpeg";

    // Submit to Azure Document Intelligence Layout API
    const analyzeUrl = `${azureEndpoint.replace(/\/$/, "")}/documentintelligence/documentModels/prebuilt-layout:analyze?api-version=2024-11-30`;

    const submitResponse = await fetch(analyzeUrl, {
      method: "POST",
      headers: {
        "Ocp-Apim-Subscription-Key": azureKey,
        "Content-Type": contentType,
      },
      body: imageBytes,
    });

    if (!submitResponse.ok) {
      const errBody = await submitResponse.text();
      throw new Error(`Azure submit failed (${submitResponse.status}): ${errBody}`);
    }

    const operationUrl = submitResponse.headers.get("Operation-Location");
    if (!operationUrl) {
      throw new Error("No Operation-Location header in Azure response");
    }

    // Store operation URL
    await supabase
      .from("azure_emp_news_pages")
      .update({ azure_operation_url: operationUrl })
      .eq("id", pageId);

    // Consume submit response body
    await submitResponse.text();

    // Poll for result with exponential backoff
    let result = null;
    const maxAttempts = 15;
    let delay = 2000;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await new Promise((r) => setTimeout(r, delay));

      const pollResponse = await fetch(operationUrl, {
        headers: { "Ocp-Apim-Subscription-Key": azureKey },
      });

      if (!pollResponse.ok) {
        const pollErr = await pollResponse.text();
        throw new Error(`Azure poll failed (${pollResponse.status}): ${pollErr}`);
      }

      const pollResult = await pollResponse.json();
      const status = pollResult.status;

      if (status === "succeeded") {
        result = pollResult;
        break;
      } else if (status === "failed") {
        const failMsg = pollResult.error?.message || "Azure processing failed";
        throw new Error(failMsg);
      }

      // running/notStarted — continue polling
      delay = Math.min(delay * 1.5, 10000);
    }

    if (!result) {
      throw new Error("Azure processing timed out after polling");
    }

    // Extract text content
    const analyzeResult = result.analyzeResult;
    const extractedContent = analyzeResult?.content || "";

    // Save success
    await supabase
      .from("azure_emp_news_pages")
      .update({
        ocr_status: "completed",
        azure_result_json: result,
        extracted_content: extractedContent,
        error_message: null,
        processed_at: new Date().toISOString(),
      })
      .eq("id", pageId);

    return { success: true };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);

    // Increment retry_count and save error
    await supabase
      .from("azure_emp_news_pages")
      .update({
        ocr_status: "failed",
        error_message: errorMsg.substring(0, 2000),
        retry_count: (page.retry_count || 0) + 1,
      })
      .eq("id", pageId);

    return { success: false, error: errorMsg };
  }
}

async function updateIssueCounters(
  supabase: ReturnType<typeof createClient>,
  issueId: string
) {
  const { data: pages } = await supabase
    .from("azure_emp_news_pages")
    .select("ocr_status")
    .eq("issue_id", issueId);

  if (!pages) return;

  const total = pages.length;
  const completed = pages.filter((p: any) => p.ocr_status === "completed").length;
  const failed = pages.filter((p: any) => p.ocr_status === "failed").length;
  const processing = pages.filter((p: any) => p.ocr_status === "processing").length;
  const pending = pages.filter((p: any) => p.ocr_status === "pending").length;

  let ocrStatus = "pending";
  if (processing > 0) ocrStatus = "processing";
  else if (completed === total) ocrStatus = "completed";
  else if (failed > 0 && pending === 0 && processing === 0) {
    ocrStatus = completed > 0 ? "partially_completed" : "failed";
  } else if (completed > 0) ocrStatus = "partially_completed";

  await supabase
    .from("azure_emp_news_issues")
    .update({
      ocr_completed_pages: completed,
      ocr_failed_pages: failed,
      ocr_status: ocrStatus,
    })
    .eq("id", issueId);
}

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

  // Admin check using service role
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

  // Parse body
  const { page_id } = await req.json();
  if (!page_id) {
    return new Response(JSON.stringify({ error: "page_id required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const result = await processPage(serviceClient, page_id);

  // Get issue_id for counter update
  const { data: pageData } = await serviceClient
    .from("azure_emp_news_pages")
    .select("issue_id")
    .eq("id", page_id)
    .single();

  if (pageData?.issue_id) {
    await updateIssueCounters(serviceClient, pageData.issue_id);
  }

  return new Response(JSON.stringify(result), {
    status: result.success ? 200 : 500,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
