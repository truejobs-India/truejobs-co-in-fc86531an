// DIRECT GEMINI API — Does NOT use Lovable AI gateway.
// This edge function calls generativelanguage.googleapis.com directly
// using the project's own GEMINI_API_KEY secret.
// Uses Imagen 3 for image generation (same Google AI API).

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

    // ── Call Google AI API directly ──────────────────────
    const geminiApiKey = Deno.env.get("GEMINI_API_KEY");
    if (!geminiApiKey) {
      return new Response(
        JSON.stringify({ error: "GEMINI_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const keywordList = Array.isArray(keywords) ? keywords.join(", ") : "";
    const imagePrompt = `Create a clean, professional editorial illustration for a blog article titled "${title}" about ${category || "government jobs and exams"}.${keywordList ? ` Related topics: ${keywordList}.` : ""} Style: modern flat illustration, suitable for an Indian government jobs and exam preparation portal. Landscape format 1200x630 pixels. Use warm, professional colors. Do not include any text overlays, official government seals, emblems, or logos. Do not include any misleading official symbols. The image should be abstract and editorial in nature.`;

    let imageBase64 = "";
    let mimeType = "image/png";
    let altText = title;
    let modelUsed = "";

    // ── Strategy 1: Try Imagen 3 (dedicated image generation) ──
    const imagenUrl = `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${geminiApiKey}`;
    console.log("Trying Imagen 3 model...");

    try {
      const imagenResponse = await fetch(imagenUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instances: [{ prompt: imagePrompt }],
          parameters: {
            sampleCount: 1,
            aspectRatio: "16:9",
            safetySetting: "block_medium_and_above",
          },
        }),
      });

      if (imagenResponse.ok) {
        const imagenData = await imagenResponse.json();
        const predictions = imagenData.predictions || [];
        if (predictions.length > 0 && predictions[0].bytesBase64Encoded) {
          imageBase64 = predictions[0].bytesBase64Encoded;
          mimeType = predictions[0].mimeType || "image/png";
          modelUsed = "imagen-3.0-generate-002";
          console.log("Imagen 3 succeeded");
        }
      } else {
        const errText = await imagenResponse.text();
        console.log(`Imagen 3 failed [${imagenResponse.status}]: ${errText.substring(0, 200)}`);
      }
    } catch (imagenErr) {
      console.log("Imagen 3 error:", imagenErr instanceof Error ? imagenErr.message : "unknown");
    }

    // ── Strategy 2: Try Gemini 2.0 Flash (multimodal image output) ──
    if (!imageBase64) {
      const gemini2Url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${geminiApiKey}`;
      console.log("Trying Gemini 2.0 Flash Exp...");

      try {
        const gemini2Response = await fetch(gemini2Url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: imagePrompt }] }],
            generationConfig: { responseModalities: ["TEXT", "IMAGE"] },
          }),
        });

        if (gemini2Response.ok) {
          const gemini2Data = await gemini2Response.json();
          for (const candidate of gemini2Data.candidates || []) {
            for (const part of candidate.content?.parts || []) {
              if (part.inlineData && !imageBase64) {
                imageBase64 = part.inlineData.data;
                mimeType = part.inlineData.mimeType || "image/png";
                modelUsed = "gemini-2.0-flash-exp";
              }
              if (part.text) {
                const text = part.text.trim();
                if (text.length > 10 && text.length < 200) altText = text;
              }
            }
          }
          if (imageBase64) console.log("Gemini 2.0 Flash Exp succeeded");
        } else {
          const errText = await gemini2Response.text();
          console.log(`Gemini 2.0 Flash Exp failed [${gemini2Response.status}]: ${errText.substring(0, 200)}`);
        }
      } catch (g2Err) {
        console.log("Gemini 2.0 error:", g2Err instanceof Error ? g2Err.message : "unknown");
      }
    }

    // ── Strategy 3: Try Gemini 2.5 Flash ──
    if (!imageBase64) {
      const gemini25Url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`;
      console.log("Trying Gemini 2.5 Flash...");

      try {
        const gemini25Response = await fetch(gemini25Url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: imagePrompt }] }],
            generationConfig: { responseModalities: ["TEXT", "IMAGE"] },
          }),
        });

        if (gemini25Response.ok) {
          const gemini25Data = await gemini25Response.json();
          for (const candidate of gemini25Data.candidates || []) {
            for (const part of candidate.content?.parts || []) {
              if (part.inlineData && !imageBase64) {
                imageBase64 = part.inlineData.data;
                mimeType = part.inlineData.mimeType || "image/png";
                modelUsed = "gemini-2.5-flash";
              }
              if (part.text) {
                const text = part.text.trim();
                if (text.length > 10 && text.length < 200) altText = text;
              }
            }
          }
          if (imageBase64) console.log("Gemini 2.5 Flash succeeded");
        } else {
          const errText = await gemini25Response.text();
          console.log(`Gemini 2.5 Flash failed [${gemini25Response.status}]: ${errText.substring(0, 200)}`);
        }
      } catch (g25Err) {
        console.log("Gemini 2.5 error:", g25Err instanceof Error ? g25Err.message : "unknown");
      }
    }

    if (!imageBase64) {
      return new Response(
        JSON.stringify({
          error: "No image generated — all Google AI models failed. This may be a region restriction on image generation APIs.",
          models_tried: ["imagen-3.0-generate-002", "gemini-2.0-flash-exp", "gemini-2.5-flash"],
        }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Generate alt text via Gemini 2.5 Flash if we only have image ──
    if (altText === title && modelUsed.startsWith("imagen")) {
      try {
        const altUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`;
        const altResponse = await fetch(altUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{
              parts: [{
                text: `Write a concise, descriptive alt text (under 150 characters) for a blog cover image about: "${title}" in the ${category || "government jobs"} category. Just return the alt text, nothing else.`,
              }],
            }],
          }),
        });
        if (altResponse.ok) {
          const altData = await altResponse.json();
          const altPart = altData.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
          if (altPart && altPart.length > 5 && altPart.length < 200) {
            altText = altPart;
          }
        } else {
          await altResponse.text(); // consume body
        }
      } catch {
        // Alt text generation is best-effort
      }
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
