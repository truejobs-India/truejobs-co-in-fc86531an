// Uses Lovable AI gateway with gemini-2.5-flash-image for image generation.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildBlogCoverPrompt } from "../_shared/blog-image-prompt-policy.ts";

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
    // ── Admin Authorization ──────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Validate JWT and get user ID
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const userId = claimsData.claims.sub as string;

    // Check admin role using service-role client
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    const { data: roleData } = await adminClient.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (!roleData) {
      return new Response(
        JSON.stringify({ error: "Admin access required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Parse request ────────────────────────────────────
    const { slug, title, category, keywords } = await req.json();
    if (!slug || !title) {
      return new Response(
        JSON.stringify({ error: "slug and title are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Call Lovable AI Gateway for image generation ────
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableApiKey) {
      return new Response(
        JSON.stringify({ error: "LOVABLE_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const keywordList = Array.isArray(keywords) ? keywords.join(", ") : "";
    const imagePrompt = buildBlogCoverPrompt({
      title,
      category: category || "government jobs and exams",
      tags: keywords,
    });

    const modelUsed = "google/gemini-3.1-flash-image-preview";
    let imageBase64 = "";
    let mimeType = "image/png";
    let altText = title;

    console.log("Calling Lovable AI gateway with gemini-3.1-flash-image-preview...");

    try {
      const gatewayResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${lovableApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: modelUsed,
          messages: [{ role: "user", content: imagePrompt }],
          modalities: ["image", "text"],
        }),
      });

      if (!gatewayResponse.ok) {
        const errText = await gatewayResponse.text();
        console.error(`Gateway error [${gatewayResponse.status}]: ${errText.substring(0, 300)}`);
        if (gatewayResponse.status === 429) {
          return new Response(
            JSON.stringify({ error: "Rate limit exceeded, please try again later.", model: modelUsed }),
            { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        if (gatewayResponse.status === 402) {
          return new Response(
            JSON.stringify({ error: "Payment required, please add funds to your workspace.", model: modelUsed }),
            { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        return new Response(
          JSON.stringify({ error: `AI gateway error: ${errText.substring(0, 200)}`, model: modelUsed }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const rawText = await gatewayResponse.text();
      if (!rawText || rawText.trim().length === 0) {
        console.error("Gateway returned empty response body");
        return new Response(
          JSON.stringify({ error: "AI gateway returned empty response", model: modelUsed }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      let data: any;
      try {
        data = JSON.parse(rawText);
      } catch (parseErr) {
        console.error("Failed to parse gateway response:", rawText.substring(0, 500));
        return new Response(
          JSON.stringify({ error: "AI gateway returned invalid JSON", model: modelUsed }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const choice = data.choices?.[0]?.message;
      console.log("Gateway response keys:", JSON.stringify({
        hasImages: !!choice?.images?.length,
        hasContent: !!choice?.content,
        contentLength: choice?.content?.length,
        imageCount: choice?.images?.length || 0,
      }));

      // Extract image from response
      if (choice?.images?.length > 0) {
        for (const img of choice.images) {
          const imgUrl = img?.image_url?.url || img?.url || "";
          if (imgUrl.startsWith("data:")) {
            const match = imgUrl.match(/^data:(image\/\w+);base64,(.+)$/s);
            if (match) {
              mimeType = match[1];
              imageBase64 = match[2];
              break;
            }
          } else if (imgUrl.startsWith("http")) {
            // Download external URL to base64
            const imgResp = await fetch(imgUrl);
            if (imgResp.ok) {
              const arrBuf = await imgResp.arrayBuffer();
              const bytes = new Uint8Array(arrBuf);
              let binary = "";
              for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
              imageBase64 = btoa(binary);
              mimeType = imgResp.headers.get("content-type") || "image/png";
              break;
            }
          }
        }
      }

      // Extract alt text from text content
      if (choice?.content) {
        const text = typeof choice.content === "string" ? choice.content.trim() : "";
        if (text.length > 10 && text.length < 200) altText = text;
      }
    } catch (fetchErr) {
      console.error("Gateway fetch error:", fetchErr instanceof Error ? fetchErr.message : "unknown");
      return new Response(
        JSON.stringify({ error: fetchErr instanceof Error ? fetchErr.message : "AI gateway request failed", model: modelUsed }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!imageBase64) {
      return new Response(
        JSON.stringify({ error: "Image generation unavailable in this region", code: "IMAGE_GEN_REGION_UNAVAILABLE", model: modelUsed }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Upload to Supabase storage ───────────────────────
    const ext = mimeType.includes("jpeg") ? "jpg" : "png";
    const filePath = `covers/${slug}-generated.${ext}`;

    const imageBytes = Uint8Array.from(atob(imageBase64), (c) => c.charCodeAt(0));
    const blob = new Blob([imageBytes], { type: mimeType });

    const { error: uploadError } = await adminClient.storage
      .from("blog-assets")
      .upload(filePath, blob, { contentType: mimeType, upsert: true });

    if (uploadError) {
      console.error("Storage upload error:", uploadError);
      return new Response(
        JSON.stringify({ error: "Failed to upload image", detail: uploadError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: urlData } = adminClient.storage
      .from("blog-assets")
      .getPublicUrl(filePath);

    return new Response(
      JSON.stringify({
        imageUrl: urlData.publicUrl,
        altText,
        model: modelUsed,
        path: filePath,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("generate-blog-image error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
