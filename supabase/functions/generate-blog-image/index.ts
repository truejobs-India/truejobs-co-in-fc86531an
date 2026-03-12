// DIRECT GEMINI API — Does NOT use Lovable AI gateway.
// This edge function calls generativelanguage.googleapis.com directly
// using the project's own GEMINI_API_KEY secret.

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

    // ── Call Gemini 2.5 Flash directly ───────────────────
    const geminiApiKey = Deno.env.get("GEMINI_API_KEY");
    if (!geminiApiKey) {
      return new Response(
        JSON.stringify({ error: "GEMINI_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const keywordList = Array.isArray(keywords) ? keywords.join(", ") : "";
    const imagePrompt = `Create a clean, professional editorial illustration for a blog article titled "${title}" about ${category || "government jobs and exams"}.${keywordList ? ` Related topics: ${keywordList}.` : ""} Style: modern flat illustration, suitable for an Indian government jobs and exam preparation portal. Landscape format 1200x630 pixels. Use warm, professional colors. Do not include any text overlays, official government seals, emblems, or logos. Do not include any misleading official symbols. The image should be abstract and editorial in nature.`;

    // DIRECT GEMINI 2.5 FLASH API CALL — NOT using any Lovable AI gateway
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`;

    const geminiResponse = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: imagePrompt }],
          },
        ],
        generationConfig: {
          responseModalities: ["TEXT", "IMAGE"],
        },
      }),
    });

    if (!geminiResponse.ok) {
      const errText = await geminiResponse.text();
      console.error(`Gemini API error [${geminiResponse.status}]:`, errText);
      return new Response(
        JSON.stringify({
          error: `Gemini API error: ${geminiResponse.status}`,
          detail: errText.substring(0, 200),
        }),
        { status: geminiResponse.status === 429 ? 429 : 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const geminiData = await geminiResponse.json();

    // Extract image and text from response
    let imageBase64 = "";
    let mimeType = "image/png";
    let altText = title;

    const candidates = geminiData.candidates || [];
    for (const candidate of candidates) {
      const parts = candidate.content?.parts || [];
      for (const part of parts) {
        if (part.inlineData) {
          imageBase64 = part.inlineData.data;
          mimeType = part.inlineData.mimeType || "image/png";
        }
        if (part.text) {
          // Use Gemini's text response as alt text if it's descriptive enough
          const text = part.text.trim();
          if (text.length > 10 && text.length < 200) {
            altText = text;
          }
        }
      }
    }

    if (!imageBase64) {
      return new Response(
        JSON.stringify({ error: "No image generated by Gemini", model: "gemini-2.5-flash" }),
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
        model: "gemini-2.5-flash",
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
