import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json().catch(() => ({}));
    const batchSize = body.batch_size || 5;
    const dryRun = body.dry_run || false;
    const aiModel = body.aiModel;

    if (!aiModel) {
      return new Response(JSON.stringify({ error: 'aiModel parameter is required. No fallback allowed.' }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
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

        // AI dispatcher — strict routing, no Vertex fallback
        async function callEnrichAI(p: string): Promise<string> {
          switch (aiModel) {
            case 'sarvam-30b': case 'sarvam-105b': {
              const { callSarvamChat } = await import('../_shared/sarvam.ts');
              return callSarvamChat(p, { model: selectedModel === 'sarvam-105b' ? 'sarvam-105b' : 'sarvam-30b', maxTokens: 8192, temperature: 0.5 });
            }
            case 'azure-gpt5-mini': {
              const { callAzureGPT5Mini } = await import('../_shared/azure-openai.ts');
              return callAzureGPT5Mini(p, { maxTokens: 8192, temperature: 0.5 });
            }
            case 'azure-gpt41-mini': {
              const { callAzureGPT41Mini } = await import('../_shared/azure-openai.ts');
              return callAzureGPT41Mini(p, { maxTokens: 8192, temperature: 0.5 });
            }
            case 'azure-gpt4o-mini': {
              const { callAzureOpenAI } = await import('../_shared/azure-openai.ts');
              return callAzureOpenAI(p, { maxTokens: 8192, temperature: 0.5 });
            }
            case 'azure-deepseek-v3': {
              const { callAzureDeepSeek } = await import('../_shared/azure-deepseek.ts');
              return callAzureDeepSeek(p, { maxTokens: 8192, temperature: 0.5 });
            }
            case 'azure-deepseek-r1': {
              const { callAzureDeepSeek } = await import('../_shared/azure-deepseek.ts');
              return callAzureDeepSeek(p, { model: 'DeepSeek-R1', maxTokens: 8192, temperature: 0.5 });
            }
            case 'vertex-flash': case 'gemini-flash': case 'gemini': {
              const { callVertexGemini } = await import('../_shared/vertex-ai.ts');
              return callVertexGemini('gemini-2.5-flash', p, 90_000);
            }
            case 'vertex-pro': case 'gemini-pro': {
              const { callVertexGemini } = await import('../_shared/vertex-ai.ts');
              return callVertexGemini('gemini-2.5-pro', p, 120_000);
            }
            case 'vertex-3.1-pro': {
              const { callVertexGemini } = await import('../_shared/vertex-ai.ts');
              return callVertexGemini('gemini-3.1-pro-preview', p, 120_000);
            }
            case 'vertex-3-flash': {
              const { callVertexGemini } = await import('../_shared/vertex-ai.ts');
              return callVertexGemini('gemini-3-flash-preview', p, 90_000);
            }
            case 'vertex-3.1-flash-lite': {
              const { callVertexGemini } = await import('../_shared/vertex-ai.ts');
              return callVertexGemini('gemini-3.1-flash-lite-preview', p, 60_000);
            }
            case 'lovable-gemini': {
              const apiKey = Deno.env.get('LOVABLE_API_KEY');
              if (!apiKey) throw new Error('LOVABLE_API_KEY not configured');
              const resp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
                method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ model: 'google/gemini-2.5-flash', messages: [{ role: 'user', content: p }], max_tokens: 8192, temperature: 0.5 }),
              });
              if (!resp.ok) throw new Error(`Lovable AI error ${resp.status}`);
              return (await resp.json())?.choices?.[0]?.message?.content || '';
            }
            case 'gpt5': case 'gpt5-mini': case 'openai': {
              const apiKey = Deno.env.get('LOVABLE_API_KEY');
              if (!apiKey) throw new Error('LOVABLE_API_KEY not configured');
              const gwModel = aiModel === 'gpt5-mini' ? 'openai/gpt-5-mini' : 'openai/gpt-5';
              const resp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
                method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ model: gwModel, messages: [{ role: 'user', content: p }], max_tokens: 8192, temperature: 0.5 }),
              });
              if (!resp.ok) throw new Error(`Lovable AI error ${resp.status}`);
              return (await resp.json())?.choices?.[0]?.message?.content || '';
            }
            case 'groq': {
              const apiKey = Deno.env.get('GROQ_API_KEY');
              if (!apiKey) throw new Error('GROQ_API_KEY not configured');
              const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ model: 'llama-3.3-70b-versatile', messages: [{ role: 'user', content: p }], max_tokens: 8192, temperature: 0.5 }),
              });
              if (!resp.ok) throw new Error(`Groq API error ${resp.status}`);
              return (await resp.json())?.choices?.[0]?.message?.content || '';
            }
            case 'claude-sonnet': case 'claude': {
              const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
              if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured');
              const resp = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
                body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 8192, messages: [{ role: 'user', content: p }] }),
              });
              if (!resp.ok) throw new Error(`Anthropic API error ${resp.status}`);
              return (await resp.json())?.content?.[0]?.text || '';
            }
            case 'nova-pro': case 'nova-premier': case 'nemotron-120b': case 'mistral': {
              const { callBedrockNova } = await import('../_shared/bedrock-nova.ts');
              return callBedrockNova(aiModel === 'mistral' ? 'mistral' : aiModel, p, { maxTokens: 8192, temperature: 0.5 });
            }
            default:
              throw new Error(`Unsupported AI model: "${aiModel}". No fallback allowed.`);
          }
        }
        const result = await callEnrichAI(prompt);

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
