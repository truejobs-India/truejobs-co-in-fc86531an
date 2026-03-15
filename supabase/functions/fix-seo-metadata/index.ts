// Gemini 2.5 Pro API — SEO metadata generation/fixing for blog articles
// Does NOT use Lovable AI gateway — uses direct Gemini API only
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

const GEMINI_MODEL = 'gemini-2.5-pro';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

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
    const { articles, mode, apply } = await req.json() as {
      articles: ArticleInput[];
      mode: 'scan' | 'fix';
      apply?: boolean; // if true, write to DB
    };

    if (!articles || !Array.isArray(articles) || articles.length === 0) {
      return new Response(JSON.stringify({ error: 'No articles provided' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (articles.length > 10) {
      return new Response(JSON.stringify({ error: 'Max 10 articles per batch' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
    if (!GEMINI_API_KEY) {
      return new Response(JSON.stringify({ error: 'GEMINI_API_KEY not configured' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const results: SeoFixResult[] = [];

    for (const article of articles) {
      try {
        // Build context for the AI
        const plainText = (article.content || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 3000);

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
1. meta_title: MUST be under 60 characters. Include primary keyword. Be search-friendly and relevant. Write in the same language as the title. No quotes.
2. meta_description: MUST be 130-155 characters. Include primary keyword and a call-to-action. Be useful and human-readable. No quotes. No keyword stuffing.
3. slug: lowercase, hyphenated, based on the article's primary topic. Max 70 chars. Remove stop words where possible. Clean and URL-safe.
4. excerpt: 2-3 sentences, under 200 characters, capturing the main value for readers.

SAFETY RULES:
- If the existing value is ALREADY STRONG and aligned with content, set "keep_existing": true for that field
- Do NOT generate clickbait, misleading claims, or keyword-stuffed metadata
- Metadata must accurately reflect the article content
- Prefer the same language as the article title (Hindi/English)
- No misleading government or official claims

Return ONLY valid JSON (no markdown) with this exact structure:
{
  "meta_title": { "value": "generated title", "keep_existing": false, "reason": "why changed" },
  "meta_description": { "value": "generated description", "keep_existing": false, "reason": "why changed" },
  "slug": { "value": "generated-slug", "keep_existing": true, "reason": "existing slug is good" },
  "excerpt": { "value": "generated excerpt", "keep_existing": false, "reason": "was missing" },
  "summary": "Brief summary of what was improved"
}`;

        // Call Gemini 2.5 Pro with retry
        let geminiRes: Response | null = null;
        for (let attempt = 0; attempt < 3; attempt++) {
          geminiRes = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: {
                temperature: 0.2,
                maxOutputTokens: 2048,
                responseMimeType: 'application/json',
              },
            }),
          });
          if (geminiRes.status === 429 && attempt < 2) {
            await geminiRes.text();
            await new Promise(r => setTimeout(r, (attempt + 1) * 5000));
            continue;
          }
          break;
        }

        if (!geminiRes || !geminiRes.ok) {
          const errText = geminiRes ? await geminiRes.text() : 'No response';
          console.error(`Gemini error for ${article.slug}:`, errText);
          results.push({
            id: article.id, slug: article.slug, status: 'failed',
            reason: geminiRes?.status === 429 ? 'Rate limit exceeded' : `Gemini API error ${geminiRes?.status}`,
            changes: {}, ai_summary: '',
          });
          continue;
        }

        const geminiData = await geminiRes.json();
        const rawText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || '';

        let aiResult: any;
        try {
          const cleaned = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
          aiResult = JSON.parse(cleaned);
        } catch {
          console.error(`Parse error for ${article.slug}:`, rawText.substring(0, 300));
          results.push({
            id: article.id, slug: article.slug, status: 'failed',
            reason: 'Failed to parse AI response', changes: {}, ai_summary: '',
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
