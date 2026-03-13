import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

async function callGeminiAI(prompt: string, apiKey: string): Promise<string> {
  const resp = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
    }),
  });

  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(`Gemini API error ${resp.status}: ${t}`);
  }

  const data = await resp.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const geminiApiKey = Deno.env.get("GEMINI_API_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!geminiApiKey) {
      return new Response(JSON.stringify({ error: "GEMINI_API_KEY not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json().catch(() => ({}));
    const batchSize = body.batch_size || 5;
    const dryRun = body.dry_run || false;

    const { data: articles, error: fetchErr } = await supabase
      .from("blog_posts")
      .select("id, title, content, category, excerpt, faq_schema, slug")
      .eq("is_published", true)
      .order("created_at", { ascending: true });

    if (fetchErr) throw fetchErr;

    const thinArticles = (articles || []).filter(a => (a.content?.length || 0) < 4000);
    console.log(`Found ${thinArticles.length} thin articles out of ${articles?.length} total`);

    if (thinArticles.length === 0) {
      return new Response(JSON.stringify({ message: "No thin articles found", total: articles?.length }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const batch = thinArticles.slice(0, batchSize);
    const results: Array<{ id: string; title: string; status: string; oldLength: number; newLength: number }> = [];

    for (const article of batch) {
      console.log(`Processing: "${article.title}" (${article.content?.length} chars)`);

      try {
        const prompt = `You are a career guidance content writer for TrueJobs, an Indian job portal. You must expand the following blog article to be comprehensive, helpful, and at least 1000 words. 

RULES:
- Keep the same topic, tone, and factual accuracy. Do NOT hallucinate or invent statistics.
- Replace any em dashes (—) with a comma and space (, ).
- Use proper markdown formatting with ## for H2 and ### for H3 headings.
- Add practical advice, actionable steps, and real-world examples relevant to Indian job seekers.
- Include 3-5 FAQ items at the end under a ## Frequently Asked Questions heading.
- Each FAQ answer should be 2-3 sentences.
- Keep the writing human-readable, engaging, and well-structured.
- Use bullet points and numbered lists where appropriate.
- Do NOT include the title as H1 at the top (it's rendered separately).
- Output ONLY the expanded article content in markdown. No preamble or explanation.

ALSO return the FAQs separately as a JSON block at the very end, after a line containing only "---FAQ_JSON---", in this format:
[{"question":"...","answer":"..."},...]

CURRENT ARTICLE TITLE: ${article.title}
CATEGORY: ${article.category || "Career Advice"}
CURRENT CONTENT:
${article.content}`;

        const result = await callGeminiAI(prompt, geminiApiKey);

        let expandedContent = result;
        let faqSchema = article.faq_schema;

        const faqSeparator = "---FAQ_JSON---";
        const faqIdx = result.indexOf(faqSeparator);
        if (faqIdx !== -1) {
          expandedContent = result.slice(0, faqIdx).trim();
          const faqJsonStr = result.slice(faqIdx + faqSeparator.length).trim();
          try {
            const jsonMatch = faqJsonStr.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
              const faqs = JSON.parse(jsonMatch[0]);
              if (Array.isArray(faqs) && faqs.length > 0) {
                faqSchema = {
                  "@context": "https://schema.org",
                  "@type": "FAQPage",
                  mainEntity: faqs.map((f: any) => ({
                    "@type": "Question",
                    name: f.question,
                    acceptedAnswer: { "@type": "Answer", text: f.answer },
                  })),
                };
              }
            }
          } catch (e) {
            console.warn(`FAQ JSON parse failed for "${article.title}":`, e);
          }
        }

        const wordCount = expandedContent.trim().split(/\s+/).length;
        const readingTime = Math.max(1, Math.ceil(wordCount / 200));
        const excerpt = article.excerpt || expandedContent.replace(/#{1,6}\s+/g, "").replace(/\*\*([^*]+)\*\*/g, "$1").replace(/\n+/g, " ").trim().slice(0, 155) + "...";

        if (!dryRun) {
          const { error: updateErr } = await supabase
            .from("blog_posts")
            .update({
              content: expandedContent,
              faq_schema: faqSchema,
              reading_time: readingTime,
              word_count: wordCount,
              excerpt,
              updated_at: new Date().toISOString(),
            })
            .eq("id", article.id);

          if (updateErr) throw updateErr;
        }

        results.push({
          id: article.id,
          title: article.title,
          status: dryRun ? "dry_run" : "updated",
          oldLength: article.content?.length || 0,
          newLength: expandedContent.length,
        });

        console.log(`✅ "${article.title}": ${article.content?.length} → ${expandedContent.length} chars (${wordCount} words)`);

        if (batch.indexOf(article) < batch.length - 1) {
          await new Promise(r => setTimeout(r, 2000));
        }
      } catch (e) {
        console.error(`❌ Failed for "${article.title}":`, e);
        results.push({
          id: article.id,
          title: article.title,
          status: `error: ${e instanceof Error ? e.message : "unknown"}`,
          oldLength: article.content?.length || 0,
          newLength: 0,
        });
      }
    }

    return new Response(JSON.stringify({
      processed: results.length,
      remaining: thinArticles.length - batch.length,
      results,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("enrich-blog-articles error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
