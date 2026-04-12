// SEO metadata generation/fixing for blog articles — Vertex AI Gemini 2.5 Pro
// Uses shared Vertex AI helper, NOT Google AI Studio
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

async function verifyAdmin(req: Request): Promise<{ userId: string } | Response> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized — missing token' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } });
  const token = authHeader.replace('Bearer ', '');
  const { data, error } = await supabase.auth.getClaims(token);
  if (error || !data?.claims) {
    return new Response(JSON.stringify({ error: 'Unauthorized — invalid token' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
  const userId = data.claims.sub as string;
  const svc = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data: roleRow } = await svc.from('user_roles').select('role').eq('user_id', userId).eq('role', 'admin').maybeSingle();
  if (!roleRow) {
    return new Response(JSON.stringify({ error: 'Forbidden — admin role required' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
  return { userId };
}

// Vertex AI Gemini via shared helper

interface ArticleInput {
  id: string;
  title: string;
  slug: string;
  content: string;
  meta_title: string | null;
  meta_description: string | null;
  excerpt: string | null;
  category: string | null;
  tags: string[] | null;
  word_count: number | null;
  is_published: boolean;
  issues: string[];
}

interface SeoFixResult {
  id: string;
  slug: string;
  status: 'fixed' | 'skipped' | 'failed';
  reason: string;
  changes: {
    meta_title?: { before: string | null; after: string };
    meta_description?: { before: string | null; after: string };
    slug?: { before: string; after: string };
    excerpt?: { before: string | null; after: string };
  };
  ai_summary: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const authResult = await verifyAdmin(req);
  if (authResult instanceof Response) return authResult;

  try {
    const { articles, mode, apply, aiModel } = await req.json() as {
      articles: ArticleInput[];
      mode: 'scan' | 'fix';
      apply?: boolean;
      aiModel?: string;
    };

    if (!aiModel) {
      return new Response(JSON.stringify({ error: 'aiModel parameter is required. No fallback allowed.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (!articles || !Array.isArray(articles) || articles.length === 0) {
      return new Response(JSON.stringify({ error: 'No articles provided' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (articles.length > 10) {
      return new Response(JSON.stringify({ error: 'Max 10 articles per batch' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // AI dispatcher — strict routing based on aiModel, no Vertex fallback
    async function callFixAI(prompt: string): Promise<string> {
      switch (aiModel) {
        case 'sarvam-30b': case 'sarvam-105b': {
          const { callSarvamChat } = await import('../_shared/sarvam.ts');
          return callSarvamChat(prompt, { model: selectedModel === 'sarvam-105b' ? 'sarvam-105b' : 'sarvam-30b', maxTokens: 8192, temperature: 0.2 });
        }
        case 'azure-gpt5-mini': {
          const { callAzureGPT5Mini } = await import('../_shared/azure-openai.ts');
          return callAzureGPT5Mini(prompt, { maxTokens: 8192, temperature: 0.2 });
        }
        case 'azure-gpt41-mini': {
          const { callAzureGPT41Mini } = await import('../_shared/azure-openai.ts');
          return callAzureGPT41Mini(prompt, { maxTokens: 8192, temperature: 0.2 });
        }
        case 'azure-gpt4o-mini': {
          const { callAzureOpenAI } = await import('../_shared/azure-openai.ts');
          return callAzureOpenAI(prompt, { maxTokens: 8192, temperature: 0.2 });
        }
        case 'azure-deepseek-v3': {
          const { callAzureDeepSeek } = await import('../_shared/azure-deepseek.ts');
          return callAzureDeepSeek(prompt, { maxTokens: 8192, temperature: 0.2 });
        }
        case 'azure-deepseek-r1': {
          const { callAzureDeepSeek } = await import('../_shared/azure-deepseek.ts');
          return callAzureDeepSeek(prompt, { model: 'DeepSeek-R1', maxTokens: 8192, temperature: 0.2 });
        }
        case 'vertex-flash': case 'gemini-flash': case 'gemini': {
          const { callVertexGemini } = await import('../_shared/vertex-ai.ts');
          return callVertexGemini('gemini-2.5-flash', prompt, 60_000, { maxOutputTokens: 8192, temperature: 0.2, responseMimeType: 'application/json' });
        }
        case 'vertex-pro': case 'gemini-pro': {
          const { callVertexGemini } = await import('../_shared/vertex-ai.ts');
          return callVertexGemini('gemini-2.5-pro', prompt, 60_000, { maxOutputTokens: 8192, temperature: 0.2, responseMimeType: 'application/json' });
        }
        case 'vertex-3.1-pro': {
          const { callVertexGemini } = await import('../_shared/vertex-ai.ts');
          return callVertexGemini('gemini-3.1-pro-preview', prompt, 120_000, { maxOutputTokens: 8192, temperature: 0.2, responseMimeType: 'application/json' });
        }
        case 'vertex-3-flash': {
          const { callVertexGemini } = await import('../_shared/vertex-ai.ts');
          return callVertexGemini('gemini-3-flash-preview', prompt, 90_000, { maxOutputTokens: 8192, temperature: 0.2, responseMimeType: 'application/json' });
        }
        case 'vertex-3.1-flash-lite': {
          const { callVertexGemini } = await import('../_shared/vertex-ai.ts');
          return callVertexGemini('gemini-3.1-flash-lite-preview', prompt, 60_000, { maxOutputTokens: 8192, temperature: 0.2, responseMimeType: 'application/json' });
        }
        case 'lovable-gemini': {
          const apiKey = Deno.env.get('LOVABLE_API_KEY');
          if (!apiKey) throw new Error('LOVABLE_API_KEY not configured');
          const resp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
            method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: 'google/gemini-2.5-flash', messages: [{ role: 'user', content: prompt }], max_tokens: 8192, temperature: 0.2 }),
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
            body: JSON.stringify({ model: gwModel, messages: [{ role: 'user', content: prompt }], max_tokens: 8192, temperature: 0.2 }),
          });
          if (!resp.ok) throw new Error(`Lovable AI error ${resp.status}`);
          return (await resp.json())?.choices?.[0]?.message?.content || '';
        }
        case 'groq': {
          const apiKey = Deno.env.get('GROQ_API_KEY');
          if (!apiKey) throw new Error('GROQ_API_KEY not configured');
          const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: 'llama-3.3-70b-versatile', messages: [{ role: 'user', content: prompt }], max_tokens: 8192, temperature: 0.2 }),
          });
          if (!resp.ok) throw new Error(`Groq API error ${resp.status}`);
          return (await resp.json())?.choices?.[0]?.message?.content || '';
        }
        case 'claude-sonnet': case 'claude': {
          const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
          if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured');
          const resp = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
            body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 8192, messages: [{ role: 'user', content: prompt }] }),
          });
          if (!resp.ok) throw new Error(`Anthropic API error ${resp.status}`);
          return (await resp.json())?.content?.[0]?.text || '';
        }
        case 'nova-pro': case 'nova-premier': case 'nemotron-120b': case 'mistral': {
          const { callBedrockNova } = await import('../_shared/bedrock-nova.ts');
          return callBedrockNova(aiModel === 'mistral' ? 'mistral' : aiModel, prompt, { maxTokens: 8192, temperature: 0.2 });
        }
        default:
          throw new Error(`Unsupported AI model: "${aiModel}". No fallback allowed.`);
      }
    }

    const { callVertexGemini: _unused } = { callVertexGemini: null }; // removed hardcoded import

    const results: SeoFixResult[] = [];

    for (const article of articles) {
      try {
        // Build context for the AI
        const plainText = (article.content || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 2000);

        const issueList = article.issues.length > 0
          ? `\nCURRENT ISSUES:\n${article.issues.map((i, idx) => `${idx + 1}. ${i}`).join('\n')}`
          : '';

        const prompt = `You are an SEO expert for TrueJobs.co.in, an Indian government job portal and career guidance website.

Analyze this blog article and generate/fix its SEO metadata. Follow these strict rules:

ARTICLE CONTEXT:
Title: ${article.title}
Current slug: ${article.slug}
Current meta_title: ${article.meta_title || 'MISSING'}
Current meta_description: ${article.meta_description || 'MISSING'}
Current excerpt: ${article.excerpt || 'MISSING'}
Category: ${article.category || 'uncategorized'}
Tags: ${(article.tags || []).join(', ') || 'none'}
Word count: ${article.word_count || 0}
Published: ${article.is_published}
${issueList}

Content excerpt:
${plainText}

RULES:
1. meta_title: under 60 chars, primary keyword, same language as title
2. meta_description: 130-155 chars, keyword + CTA, no stuffing
3. slug: lowercase hyphenated, max 70 chars, URL-safe
4. excerpt: 1-2 sentences, under 200 chars
5. If existing value is already good, set "keep_existing": true
6. Same language as article (Hindi/English). No clickbait.

Return ONLY this compact JSON (keep each "reason" under 15 words):
{"meta_title":{"value":"...","keep_existing":false,"reason":"..."},"meta_description":{"value":"...","keep_existing":false,"reason":"..."},"slug":{"value":"...","keep_existing":true,"reason":"..."},"excerpt":{"value":"...","keep_existing":false,"reason":"..."},"summary":"..."}`;

        // Call Vertex AI Gemini 2.5 Pro — primary call with JSON mode
        let rawText = '';
        let finishReason = '';
        try {
          rawText = await callFixAI(prompt);
        } catch (fixErr: any) {
          if (fixErr.message?.includes('429')) {
            results.push({
              id: article.id, slug: article.slug, status: 'failed',
              reason: 'AI rate limit exceeded', changes: {}, ai_summary: '',
            });
            continue;
          }
          console.error(`AI error for ${article.slug}:`, fixErr.message);
          results.push({
            id: article.id, slug: article.slug, status: 'failed',
            reason: `AI error: ${fixErr.message?.substring(0, 200)}`,
            changes: {}, ai_summary: '',
          });
          continue;
        }

        // Parse JSON from response
        let aiResult: any;
        let parsed = false;

        if (rawText) {
          try {
            const cleaned = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
            aiResult = JSON.parse(cleaned);
            parsed = true;
          } catch {
            const jsonMatch = rawText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              try {
                aiResult = JSON.parse(jsonMatch[0]);
                parsed = true;
              } catch { /* fall through to retry */ }
            }
          }
        }

        // Retry once without responseMimeType if parse failed or empty
        if (!parsed) {
          console.warn(`Parse failed for ${article.slug}, retrying...`);
          await new Promise(r => setTimeout(r, 2000));
          try {
            const retryText = await callFixAI(
              prompt + '\n\nIMPORTANT: Return ONLY the JSON object, no markdown fences, no extra text.');
            if (retryText) {
              try {
                const cleaned = retryText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
                const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
                aiResult = JSON.parse(jsonMatch ? jsonMatch[0] : cleaned);
                parsed = true;
              } catch {
                console.error(`Retry parse also failed for ${article.slug}:`, retryText.substring(0, 300));
              }
            }
          } catch (retryErr: any) {
            console.error(`Retry Vertex call failed for ${article.slug}:`, retryErr.message);
          }
        }

        if (!parsed) {
          results.push({
            id: article.id, slug: article.slug, status: 'failed',
            reason: `Failed to parse AI response (finishReason: ${finishReason})`, changes: {}, ai_summary: '',
          });
          continue;
        }

        // Build changes only for fields that need fixing
        const changes: SeoFixResult['changes'] = {};
        let anyChange = false;

        if (aiResult.meta_title && !aiResult.meta_title.keep_existing) {
          const val = cleanMetaTitle(aiResult.meta_title.value);
          if (val && val !== article.meta_title) {
            changes.meta_title = { before: article.meta_title, after: val };
            anyChange = true;
          }
        }
        if (aiResult.meta_description && !aiResult.meta_description.keep_existing) {
          const val = cleanMetaDescription(aiResult.meta_description.value);
          if (val && val !== article.meta_description) {
            changes.meta_description = { before: article.meta_description, after: val };
            anyChange = true;
          }
        }
        if (aiResult.slug && !aiResult.slug.keep_existing) {
          const val = cleanSlug(aiResult.slug.value);
          if (val && val !== article.slug) {
            changes.slug = { before: article.slug, after: val };
            anyChange = true;
          }
        }
        if (aiResult.excerpt && !aiResult.excerpt.keep_existing) {
          const val = (aiResult.excerpt.value || '').trim();
          if (val && val !== article.excerpt) {
            changes.excerpt = { before: article.excerpt, after: val.substring(0, 300) };
            anyChange = true;
          }
        }

        if (!anyChange) {
          results.push({
            id: article.id, slug: article.slug, status: 'skipped',
            reason: 'All metadata already strong', changes: {},
            ai_summary: aiResult.summary || 'No changes needed',
          });
          continue;
        }

        // Apply to DB if requested
        if (apply) {
          const updateData: Record<string, any> = { updated_at: new Date().toISOString() };
          if (changes.meta_title) updateData.meta_title = changes.meta_title.after;
          if (changes.meta_description) updateData.meta_description = changes.meta_description.after;
          if (changes.slug) updateData.slug = changes.slug.after;
          if (changes.excerpt) updateData.excerpt = changes.excerpt.after;

          const svc = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
          const { error: updateErr } = await svc.from('blog_posts').update(updateData).eq('id', article.id);
          if (updateErr) {
            console.error(`DB update failed for ${article.slug}:`, updateErr);
            results.push({
              id: article.id, slug: article.slug, status: 'failed',
              reason: `DB update failed: ${updateErr.message}`, changes,
              ai_summary: aiResult.summary || '',
            });
            continue;
          }
        }

        results.push({
          id: article.id, slug: article.slug, status: 'fixed',
          reason: Object.keys(changes).join(', ') + ' updated',
          changes, ai_summary: aiResult.summary || 'Metadata improved',
        });

        // Rate-limit between articles
        if (articles.indexOf(article) < articles.length - 1) {
          await new Promise(r => setTimeout(r, 1500));
        }
      } catch (err: any) {
        console.error(`Error processing ${article.slug}:`, err);
        results.push({
          id: article.id, slug: article.slug, status: 'failed',
          reason: err.message?.substring(0, 200) || 'Unknown error',
          changes: {}, ai_summary: '',
        });
      }
    }

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('fix-seo-metadata error:', err);
    return new Response(JSON.stringify({ error: err.message || 'Internal error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function cleanMetaTitle(raw: string): string {
  let result = (raw || '').replace(/^["']|["']$/g, '').trim();
  if (result.length > 60) result = result.substring(0, 57) + '...';
  return result;
}

function cleanMetaDescription(raw: string): string {
  let result = (raw || '').replace(/^["']|["']$/g, '').replace(/^meta\s*description\s*[:：]\s*/i, '').trim();
  if (result.length > 155) {
    result = result.substring(0, 155);
    const lastSpace = result.lastIndexOf(' ');
    if (lastSpace > 120) result = result.substring(0, lastSpace);
  }
  return result;
}

function cleanSlug(raw: string): string {
  return (raw || '')
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 70);
}
