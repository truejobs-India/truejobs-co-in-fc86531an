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

// Model mapping
const MODEL_MAP: Record<string, string> = {
  'gemini-flash': 'gemini-2.5-flash',
  'gemini-pro': 'gemini-2.5-pro',
  'gemini-flash-api': 'gemini-2.5-flash',
  'gemini-pro-api': 'gemini-2.5-pro',
};

interface ArticleDigest {
  slug: string;
  title: string;
  headings: { level: number; text: string }[];
  meta_summary: {
    has_meta_title: boolean;
    has_meta_description: boolean;
    has_excerpt: boolean;
    has_cover_image: boolean;
    has_image_alt: boolean;
    has_canonical_url: boolean;
  };
  intro_excerpt: string;
  middle_excerpt: string;
  ending_excerpt: string;
  full_plain_text?: string;
  faq_summary: string[];
  internal_links: string[];
  heuristic_scores: {
    quality_score: number;
    seo_score: number;
    compliance_fail_count: number;
    compliance_warn_count: number;
  };
  is_published: boolean;
  word_count: number;
}

interface ClassificationVerdict {
  slug: string;
  verdict: 'needs_action' | 'skip' | 'manual_review';
  confidence: number;
  reasons: string[];
  severity: 'minor' | 'moderate' | 'major';
  action_type: 'minimal_safe_edit' | 'targeted_fix' | 'full_enrich' | 'skip';
  safe_to_bulk_edit: boolean;
  requires_manual_review: boolean;
  preserve_elements: string[];
  missing_elements: string[];
  ranking_risk: 'low' | 'medium' | 'high';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const authResult = await verifyAdmin(req);
  if (authResult instanceof Response) return authResult;

  try {
    const { articles, workflow_type, ai_model } = await req.json() as {
      articles: ArticleDigest[];
      workflow_type: 'fix' | 'enrich' | 'publish';
      ai_model?: string;
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

    const modelKey = ai_model || 'gemini-flash';
    const geminiModel = MODEL_MAP[modelKey] || 'gemini-2.5-flash';
    const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${GEMINI_API_KEY}`;

    let systemPrompt: string;
    if (workflow_type === 'publish') {
      systemPrompt = buildPublishClassificationPrompt();
    } else if (workflow_type === 'fix') {
      systemPrompt = buildFixClassificationPrompt();
    } else {
      systemPrompt = buildEnrichClassificationPrompt();
    }

    const articlesSummary = articles.map((a, i) => {
      const contentSection = a.full_plain_text
        ? `FULL_TEXT:\n${a.full_plain_text.substring(0, 8000)}`
        : `INTRO:\n${a.intro_excerpt}\n\nMIDDLE:\n${a.middle_excerpt}\n\nENDING:\n${a.ending_excerpt}`;

      return `--- ARTICLE ${i + 1}: "${a.title}" (slug: ${a.slug}) ---
WORD_COUNT: ${a.word_count}
IS_PUBLISHED: ${a.is_published}
HEADINGS: ${a.headings.map(h => `H${h.level}: ${h.text}`).join(' | ')}
META: title=${a.meta_summary.has_meta_title}, desc=${a.meta_summary.has_meta_description}, excerpt=${a.meta_summary.has_excerpt}, cover=${a.meta_summary.has_cover_image}, alt=${a.meta_summary.has_image_alt}, canonical=${a.meta_summary.has_canonical_url}
HEURISTIC_SCORES: quality=${a.heuristic_scores.quality_score}, seo=${a.heuristic_scores.seo_score}, compliance_fails=${a.heuristic_scores.compliance_fail_count}, compliance_warns=${a.heuristic_scores.compliance_warn_count}
FAQ_QUESTIONS: ${a.faq_summary.length > 0 ? a.faq_summary.join(' | ') : 'NONE'}
INTERNAL_LINKS: ${a.internal_links.length > 0 ? a.internal_links.join(', ') : 'NONE'}
${contentSection}
--- END ARTICLE ${i + 1} ---`;
    }).join('\n\n');

    const userPrompt = `Classify these ${articles.length} articles for the "${workflow_type}" workflow.\n\n${articlesSummary}\n\nReturn a JSON array of ${articles.length} verdict objects. ONLY output valid JSON, no markdown.`;

    // Retry with exponential backoff for 429 rate limits
    let geminiRes: Response | null = null;
    const maxRetries = 3;
    const fullPrompt = systemPrompt + '\n\n' + userPrompt;
    const requestBody = JSON.stringify({
      contents: [
        { role: 'user', parts: [{ text: fullPrompt }] }
      ],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 16384,
        responseMimeType: 'application/json',
      },
    });

    let usedFallback = false;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      geminiRes = await fetch(GEMINI_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: requestBody,
      });
      if (geminiRes.status === 429 && attempt < maxRetries - 1) {
        const backoffMs = (attempt + 1) * 5000;
        console.warn(`[classify-blog-articles] 429 rate limit, retrying in ${backoffMs}ms (attempt ${attempt + 1}/${maxRetries})`);
        await geminiRes.text();
        await new Promise(r => setTimeout(r, backoffMs));
        continue;
      }
      break;
    }

    // Fallback to Lovable AI gateway if Gemini quota is exhausted
    if (geminiRes?.status === 429) {
      const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
      if (LOVABLE_API_KEY) {
        console.log('[classify-blog-articles] Gemini quota exhausted, falling back to Lovable AI gateway');
        await geminiRes.text(); // consume body
        try {
          const fallbackRes = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${LOVABLE_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'google/gemini-2.5-flash',
              messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt },
              ],
              temperature: 0.1,
              max_tokens: 16384,
            }),
          });

          if (fallbackRes.ok) {
            const fallbackData = await fallbackRes.json();
            const fallbackText = fallbackData?.choices?.[0]?.message?.content || '[]';
            // Synthesize a gemini-compatible response structure for downstream parsing
            geminiRes = new Response(JSON.stringify({
              candidates: [{ content: { parts: [{ text: fallbackText }] } }]
            }), { status: 200 });
            usedFallback = true;
          } else {
            console.error('[classify-blog-articles] Lovable AI fallback also failed:', fallbackRes.status);
          }
        } catch (fallbackErr) {
          console.error('[classify-blog-articles] Lovable AI fallback error:', fallbackErr);
        }
      }
    }

    if (!geminiRes || !geminiRes.ok) {
      const errText = geminiRes ? await geminiRes.text() : 'No response';
      console.error('Gemini API error:', errText);
      if (geminiRes?.status === 429) {
        return new Response(JSON.stringify({ error: 'AI rate limit exceeded on all providers. Please wait a few minutes and try again.' }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      return new Response(JSON.stringify({ error: 'AI classification failed', detail: errText.substring(0, 200) }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const geminiData = await geminiRes.json();
    const rawText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || '[]';

    let verdicts: ClassificationVerdict[];
    try {
      const cleaned = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      verdicts = JSON.parse(cleaned);
    } catch {
      console.error('Failed to parse AI response:', rawText.substring(0, 500));
      return new Response(JSON.stringify({ error: 'Failed to parse AI classification response' }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Post-process: enforce safety rules
    const processed = verdicts.map((v, i) => {
      const article = articles[i];
      const result = { ...v, slug: article?.slug || v.slug };

      // Enforce: confidence < 0.7 → manual_review
      if (result.confidence < 0.7) {
        result.verdict = 'manual_review';
        result.requires_manual_review = true;
        result.safe_to_bulk_edit = false;
        if (!result.reasons.includes('Low AI confidence')) {
          result.reasons.push('Low AI confidence');
        }
      }

      // Enforce: ranking_risk 'high' → manual_review
      if (result.ranking_risk === 'high') {
        result.verdict = 'manual_review';
        result.requires_manual_review = true;
        result.safe_to_bulk_edit = false;
        if (!result.reasons.includes('High ranking risk')) {
          result.reasons.push('High ranking risk');
        }
      }

      // For fix/enrich: published + strong scores → skip or manual_review
      if (workflow_type !== 'publish' && article && article.is_published &&
          article.heuristic_scores.quality_score >= 75 &&
          article.heuristic_scores.seo_score >= 75) {
        if (result.verdict === 'needs_action' && result.action_type !== 'minimal_safe_edit') {
          result.verdict = 'manual_review';
          result.requires_manual_review = true;
          result.safe_to_bulk_edit = false;
          result.ranking_risk = 'medium';
          if (!result.reasons.includes('Published strong post — requires manual review')) {
            result.reasons.push('Published strong post — requires manual review');
          }
        }
      }

      // Ensure boolean fields are correct
      result.safe_to_bulk_edit = result.verdict === 'needs_action' && !result.requires_manual_review;
      result.requires_manual_review = result.verdict === 'manual_review';

      return result;
    });

    return new Response(JSON.stringify({ verdicts: processed }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('classify-blog-articles error:', err);
    return new Response(JSON.stringify({ error: err.message || 'Internal error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});

function buildFixClassificationPrompt(): string {
  return `You are an expert blog content auditor. Your job is to classify articles that may need compliance/SEO/quality fixes.

For each article, determine:
1. Does it genuinely need fixes, or is it already acceptable?
2. What severity of fixes are needed?
3. What should be preserved vs changed?

RULES:
- Published posts with quality >= 75 and SEO >= 75: default to "skip" unless there are clear, objective issues (missing canonical, empty meta fields).
- For "minimal_safe_edit": only recommend filling EMPTY metadata fields. Never overwrite existing good values.
- For "targeted_fix": recommend specific compliance fixes for clearly failed checks only.
- Prefer "skip" over weak/uncertain fixes.
- If you're not confident (< 70% sure), set verdict to "manual_review".

Return JSON array where each element has:
{
  "slug": "article-slug",
  "verdict": "needs_action" | "skip" | "manual_review",
  "confidence": 0.0-1.0,
  "reasons": ["reason1", "reason2"],
  "severity": "minor" | "moderate" | "major",
  "action_type": "minimal_safe_edit" | "targeted_fix" | "full_enrich" | "skip",
  "safe_to_bulk_edit": true/false,
  "requires_manual_review": true/false,
  "preserve_elements": ["title", "content", "existing-meta"],
  "missing_elements": ["meta_description", "canonical_url"],
  "ranking_risk": "low" | "medium" | "high"
}`;
}

function buildEnrichClassificationPrompt(): string {
  return `You are an expert blog content auditor. Your job is to classify articles that may need content enrichment (more sections, FAQs, internal links, better structure).

For each article, determine:
1. Would enrichment meaningfully improve this article?
2. What specific content additions would help?
3. What existing content must be preserved?

RULES:
- Published posts with quality >= 75 and SEO >= 75: default to "skip". Only recommend enrichment if there's a clear, significant gap (e.g. no FAQ at all, no internal links, word count below 800).
- "full_enrich": for articles that genuinely need substantial content additions.
- "targeted_fix": for articles that just need a FAQ section or internal links.
- "minimal_safe_edit": for articles that just need metadata improvements.
- NEVER recommend rewriting existing good content. Only ADD missing elements.
- Prefer "skip" over weak enrichment that might dilute existing quality.
- If unsure whether enrichment would help, set verdict to "manual_review".

Return JSON array where each element has:
{
  "slug": "article-slug",
  "verdict": "needs_action" | "skip" | "manual_review",
  "confidence": 0.0-1.0,
  "reasons": ["reason1", "reason2"],
  "severity": "minor" | "moderate" | "major",
  "action_type": "minimal_safe_edit" | "targeted_fix" | "full_enrich" | "skip",
  "safe_to_bulk_edit": true/false,
  "requires_manual_review": true/false,
  "preserve_elements": ["title", "intro", "existing-sections"],
  "missing_elements": ["faq_section", "internal_links", "conclusion"],
  "ranking_risk": "low" | "medium" | "high"
}`;
}

function buildPublishClassificationPrompt(): string {
  return `You are an expert blog content quality evaluator. These articles have passed basic structural and compliance checks but are BORDERLINE candidates for bulk publishing. Your job is to determine whether each article is genuinely ready to be published on a live website.

For each article, evaluate:
1. Is the content meaningfully complete and useful for readers? Does it provide genuine value?
2. Does it read like real, helpful content — or is it AI-generated padding, fluff, or filler?
3. Is the content safe and appropriate for a public-facing website?
4. Would publishing this article reflect well on the website's quality and credibility?

IMPORTANT RULES:
- Be CONSERVATIVE. When in doubt, set verdict to "manual_review". Under-publishing is better than publishing weak content.
- "needs_action" means the article IS genuinely ready to publish. Only use this for articles you're confident about (>= 70%).
- "manual_review" means you're uncertain or the article has quality concerns that need human judgment.
- "skip" means the article is clearly NOT ready for publishing.
- Look for signs of low-quality AI content: repetitive phrasing, generic statements, lack of specific details, padding words.
- A publish-ready article should have a clear topic, useful information, proper structure, and read naturally.
- Do NOT recommend content changes — only evaluate publish readiness. The action_type for publish-ready articles should be "skip" (no content changes needed).

Return JSON array where each element has:
{
  "slug": "article-slug",
  "verdict": "needs_action" | "skip" | "manual_review",
  "confidence": 0.0-1.0,
  "reasons": ["reason1", "reason2"],
  "severity": "minor" | "moderate" | "major",
  "action_type": "skip",
  "safe_to_bulk_edit": true/false,
  "requires_manual_review": true/false,
  "preserve_elements": [],
  "missing_elements": [],
  "ranking_risk": "low" | "medium" | "high"
}`;
}
