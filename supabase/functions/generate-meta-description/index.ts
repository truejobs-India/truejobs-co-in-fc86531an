const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

async function callGemini(apiKey: string, prompt: string): Promise<string> {
  const resp = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 200, temperature: 0.3 },
    }),
  });

  if (!resp.ok) {
    const errText = await resp.text().catch(() => "");
    throw new Error(`Gemini API error ${resp.status}: ${errText}`);
  }

  const data = await resp.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const geminiApiKey = Deno.env.get("GEMINI_API_KEY");

    if (!geminiApiKey) {
      return new Response(
        JSON.stringify({ error: "GEMINI_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { articles } = await req.json();

    if (!articles || !Array.isArray(articles) || articles.length === 0) {
      return new Response(
        JSON.stringify({ error: "No articles provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const results: Record<string, string> = {};

    for (const article of articles) {
      const { id, title, content, existingMeta } = article;

      const plainText = (content || "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .substring(0, 500);

      const prompt = `You are an SEO expert for TrueJobs.co.in, an Indian job portal.

Generate a meta description for a blog article. Requirements:
- MUST be between 140 and 155 characters (STRICT LIMIT)
- Include the primary keyword from the title
- Include a call-to-action phrase
- Write in the same language as the title (Hindi transliterated to English or English)
- Make it compelling for Google search results
- Do NOT use quotes in the output

Title: ${title}
${existingMeta ? `Current meta (too long, needs shortening): ${existingMeta}` : ""}
Article excerpt: ${plainText}

Return ONLY the meta description text, nothing else. No quotes, no labels, no explanation.`;

      try {
        let metaDesc = await callGemini(geminiApiKey, prompt);
        metaDesc = metaDesc
          .replace(/^["']|["']$/g, "")
          .replace(/^meta\s*description\s*[:：]\s*/i, "")
          .trim();

        if (metaDesc.length > 155) {
          metaDesc = metaDesc.substring(0, 155);
          const lastSpace = metaDesc.lastIndexOf(" ");
          if (lastSpace > 120) {
            metaDesc = metaDesc.substring(0, lastSpace);
          }
        }

        results[id] = metaDesc;
      } catch (err) {
        console.error(`Failed to generate meta for article ${id}:`, err);
        if (existingMeta) {
          let fallback = existingMeta.substring(0, 152);
          const lastSpace = fallback.lastIndexOf(" ");
          if (lastSpace > 120) fallback = fallback.substring(0, lastSpace);
          results[id] = fallback + "...";
        } else {
          results[id] = `${title.substring(0, 120)} - पूरी जानकारी TrueJobs पर पढ़ें।`;
        }
      }
    }

    return new Response(
      JSON.stringify({ results }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("generate-meta-description error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
