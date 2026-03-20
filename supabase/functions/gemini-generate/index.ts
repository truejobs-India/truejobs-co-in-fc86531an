import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { prompt, useCase } = await req.json();
    if (!prompt || typeof prompt !== "string") {
      return new Response(
        JSON.stringify({ error: "Missing or invalid 'prompt' field" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build system context based on use case
    const systemPrefixes: Record<string, string> = {
      "seo-article":
        "You are an expert SEO content writer for an Indian job portal. Write detailed, original, keyword-rich articles in clear English. Include H2/H3 headings, bullet points, and a FAQ section.",
      "interview-questions":
        "You are an experienced HR professional. Generate realistic, role-specific interview questions with brief model answers.",
      "exam-explanation":
        "You are a government exam preparation expert in India. Explain the answer clearly, step-by-step, suitable for competitive exam aspirants.",
      "ai-interview":
        "You are a friendly AI interviewer conducting a mock interview. Ask one question at a time, give brief feedback, then ask the next question.",
    };

    const systemPrefix = systemPrefixes[useCase] || "";
    const fullPrompt = systemPrefix ? `${systemPrefix}\n\n${prompt}` : prompt;

    const { callVertexGemini } = await import('../_shared/vertex-ai.ts');
    const model = 'gemini-2.5-flash';
    const text = await callVertexGemini(model, fullPrompt, 60_000);

    return new Response(
      JSON.stringify({ text, model }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("gemini-generate error:", err);

    if (err instanceof Error && err.message.includes('429')) {
      return new Response(
        JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
