// Direct Gemini API only for non-image AI features — does NOT use Lovable AI gateway
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

/** Lightweight markdown-to-HTML converter for AI output that ignores the HTML-only instruction */
function markdownToHtml(md: string): string {
  let html = md;
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/(?:^|\n)((?:[ \t]*[\*\-] .+\n?)+)/g, (_: string, block: string) => {
    const items = block.trim().split('\n').map((line: string) => {
      const text = line.replace(/^[ \t]*[\*\-] /, '');
      return `<li>${text}</li>`;
    }).join('\n');
    return `\n<ul>\n${items}\n</ul>\n`;
  });
  html = html.replace(/(?:^|\n)((?:\d+\. .+\n?)+)/g, (_: string, block: string) => {
    const items = block.trim().split('\n').map((line: string) => {
      const text = line.replace(/^\d+\.\s*/, '');
      return `<li>${text}</li>`;
    }).join('\n');
    return `\n<ol>\n${items}\n</ol>\n`;
  });
  html = html.split('\n').map((line: string) => {
    const trimmed = line.trim();
    if (!trimmed) return '';
    if (/^<(?:h[1-6]|ul|ol|li|p|table|tr|td|th|div|section|blockquote|\/)/i.test(trimmed)) return line;
    return `<p>${trimmed}</p>`;
  }).join('\n');
  html = html.replace(/\n{3,}/g, '\n\n').trim();
  return html;
}

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

const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

const MODEL_MAP: Record<string, string> = {
  'gemini-2.5-flash': 'gemini-2.5-flash',
  'gemini-2.5-pro': 'gemini-2.5-pro',
  'gemini-2.0-flash': 'gemini-2.0-flash',
};

function resolveGeminiUrl(aiModel?: string): string {
  const effectiveModel = (aiModel && MODEL_MAP[aiModel]) || GEMINI_MODEL;
  return `${GEMINI_BASE_URL}/${effectiveModel}:generateContent`;
}

// ── Build criteria-specific enrichment instructions ──
function buildCriteriaInstructions(failingCriteria: string[]): string {
  if (!failingCriteria || failingCriteria.length === 0) return '';

  const instructions: string[] = [];

  for (const criterion of failingCriteria) {
    const lower = criterion.toLowerCase();

    if (lower.includes('conclusion')) {
      instructions.push('- ADD a conclusion section at the end: Use <h2>Conclusion</h2> or <h2>निष्कर्ष</h2> followed by a 2-3 sentence summary paragraph wrapped in <p> tags.');
    }
    if (lower.includes('faq') || lower.includes('no faqs')) {
      instructions.push('- ADD a FAQ section with at least 3 relevant Q&A items. Use this EXACT format:\n  <h2>FAQ</h2>\n  <p><strong>Question here?</strong></p>\n  <p>Answer here.</p>\n  (Repeat for each FAQ item. Questions MUST be wrapped in <strong> tags and end with ?)');
    }
    if (lower.includes('intro')) {
      instructions.push('- ADD an introduction paragraph (2-3 sentences) BEFORE the first H2 heading, wrapped in <p> tags. This should set context for what the reader will learn.');
    }
    if (lower.includes('h2') || lower.includes('heading')) {
      instructions.push('- ENSURE at least 4 H2 headings structuring the article into clear, logical sections. Add new <h2> sections where the content can be meaningfully divided.');
    }
    if (lower.includes('word count') || lower.includes('< 1200')) {
      instructions.push('- EXPAND content to at least 1200 words with substantive depth. Add real explanations, practical tips, examples, eligibility details, or process steps — not filler.');
    }
    if (lower.includes('internal link') || lower.includes('no internal links')) {
      instructions.push('- Where contextually relevant, add 2-3 internal links using <a href="/relevant-path">descriptive anchor text</a>. Use paths like /sarkari-naukri, /results, /admit-cards, /blog/related-topic-slug only where they genuinely fit the content.');
    }
  }

  if (instructions.length === 0) return '';

  return `\n\nSPECIFIC REQUIREMENTS — You MUST address ALL of the following:\n${instructions.join('\n')}\n\nThese are the exact criteria this article is currently FAILING. Your output will be automatically verified against them. If you do not add these elements, the enrichment will be marked as unsuccessful.`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authResult = await verifyAdmin(req);
    if (authResult instanceof Response) return authResult;

    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiApiKey) {
      return new Response(JSON.stringify({ error: 'GEMINI_API_KEY not configured' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { title, content, action, selectedHtml, headings, hasIntro, hasConclusion, wordCount, category, tags, targetWordCount, aiModel, failingCriteria, isStubRebuild } = await req.json();
    if (!title || !action) {
      return new Response(JSON.stringify({ error: 'title and action required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const geminiUrl = resolveGeminiUrl(aiModel);

    let prompt: string;
    let maxTokens = 2000;

    if (action === 'rewrite-section') {
      if (!selectedHtml) {
        return new Response(JSON.stringify({ error: 'selectedHtml required for rewrite-section' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      prompt = `You are a professional content editor for TrueJobs.co.in, an Indian job portal.
Rewrite the following HTML section to improve clarity, readability, and SEO quality.
Keep the same HTML structure (headings, paragraphs, lists). Preserve all factual content.
Write in the same language as the original.
Maintain an informational, non-official tone appropriate for a job portal.

Article title: ${title}
Category: ${category || 'General'}
Section to rewrite:
${selectedHtml}

Return ONLY the rewritten HTML, nothing else. No markdown code blocks.`;
      maxTokens = 3000;

    } else if (action === 'generate-intro') {
      const plainText = (content || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 2000);
      prompt = `You are a professional content editor for TrueJobs.co.in, an Indian government job portal.
Generate a short introductory paragraph (2-3 sentences) for this article.
Do NOT repeat the H1 title. Provide context about what the reader will learn.
Write in the same language as the article content.
Maintain an informational, non-official tone.

Article title: ${title}
Category: ${category || 'General'}
Tags: ${(tags || []).join(', ') || 'none'}
Content excerpt: ${plainText}

Return ONLY the HTML paragraph, e.g. <p>Your intro text here.</p>
No markdown code blocks.`;
      maxTokens = 500;

    } else if (action === 'generate-conclusion') {
      const plainText = (content || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 2000);
      prompt = `You are a professional content editor for TrueJobs.co.in, an Indian government job portal.
Generate a short conclusion section for this article with an H2 heading and 2-3 sentence paragraph.
Summarize the key takeaways. Write in the same language as the article content.
Maintain an informational, non-official tone.

Article title: ${title}
Category: ${category || 'General'}
Tags: ${(tags || []).join(', ') || 'none'}
Content excerpt: ${plainText}

Return ONLY the HTML, e.g.:
<h2>Conclusion</h2><p>Your conclusion text here.</p>
No markdown code blocks.`;
      maxTokens = 500;

    } else if (action === 'enrich-article') {
      const plainText = (content || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      const currentWords = plainText.split(/\s+/).filter((w: string) => w.length > 0).length;
      const dynamicTarget = Math.max(Math.ceil(currentWords * 1.3), currentWords + 300);
      const effectiveTarget = Math.min(Math.max(Number(targetWordCount) || dynamicTarget, 800), 5000);

      // Build criteria-specific instructions
      const criteriaBlock = buildCriteriaInstructions(Array.isArray(failingCriteria) ? failingCriteria : []);

      if (isStubRebuild && currentWords < 500) {
        // ── FULL REBUILD MODE for stub articles (<500 words) ──
        prompt = `You are a professional content writer for TrueJobs.co.in, an Indian government job portal.

Write a comprehensive, well-structured article on the topic below. Target approximately ${Math.max(1200, effectiveTarget)} words.

TOPIC: ${title}
Category: ${category || 'General'}
Tags: ${(tags || []).join(', ') || 'none'}

EXISTING CONTENT (use as context and outline — preserve the topic, angle, and any surviving factual content):
${content}

CRITICAL RULES:
- Preserve the topic intent and angle of the original article — do NOT change the subject
- If the existing content contains specific facts, dates, or details, KEEP them
- Do NOT invent specific statistics, official dates, vacancy counts, or government notification details
- Do NOT hallucinate specific salary figures, exam dates, or application deadlines
- If specific details are unknown, use general guidance language instead
- Write in the same language as the original content (Hindi or English)
- Maintain an informational, non-official tone
- Output MUST use HTML tags: <h2>, <h3>, <p>, <ul>, <li>, <ol>, <strong>, <em>
- Do NOT use markdown syntax. Use ONLY HTML tags
- Include at least 4 H2 sections for proper structure
- Start with an introduction paragraph before the first H2
- End with a conclusion section
${criteriaBlock}

Return ONLY the full article as valid HTML.
No JSON wrappers, no markdown, no code blocks, no explanations.`;

        const estimatedTokens = Math.max(8000, Math.ceil(effectiveTarget * 2.5));
        maxTokens = Math.min(estimatedTokens, 65536);

      } else {
        // ── STANDARD ENRICHMENT MODE ──
        prompt = `You are a professional content editor for TrueJobs.co.in, an Indian government job portal.
Expand and improve the following article to approximately ${effectiveTarget} words (currently ~${currentWords} words).

CRITICAL RULES:
- You MUST return the COMPLETE article — every single section from the original MUST be present in your output
- The output MUST be LONGER than the input, never shorter
- Do NOT truncate, summarize, or abbreviate any part of the original content
- Preserve the original structure, intent, headings, and factual content
- Strengthen depth: add explanations, examples, practical tips, and context
- Do NOT add fluff, repetition, or fabricated claims
- Do NOT add keyword stuffing
- Do NOT invent specific statistics, dates, or official details that were not in the original
- Keep the same language (Hindi/English) as the original
- Maintain an informational, non-official tone
- Output MUST use HTML tags: <h2>, <h3>, <p>, <ul>, <li>, <ol>, <strong>, <em>, <table>, <tr>, <td>, <th>
- Do NOT use markdown syntax (no ##, no **, no *, no - for lists). Use ONLY HTML tags.
- Keep all existing HTML structure (H2, H3, lists, tables)
- Add new subsections (<h3>) under existing <h2>s where appropriate
- Do NOT remove any existing content
- Wrap every paragraph in <p> tags
- Wrap every heading in <h2> or <h3> tags
- Wrap every list in <ul> or <ol> with <li> items
${criteriaBlock}

Article title: ${title}
Category: ${category || 'General'}
Tags: ${(tags || []).join(', ') || 'none'}

Current content:
${content}

Return ONLY the full enriched article as valid HTML.
No JSON wrappers, no markdown, no code blocks, no explanations.
REMINDER: Your output must contain ALL original content plus additions. Do NOT cut short.`;

        const estimatedTokensNeeded = Math.max(8000, Math.ceil(currentWords * 2.5));
        maxTokens = Math.min(estimatedTokensNeeded, 65536);
      }

    } else if (action === 'structure') {
      const plainText = (content || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 3000);
      const headingsList = Array.isArray(headings) ? headings.map((h: any) => `${'  '.repeat((h.level || 2) - 1)}H${h.level}: ${h.text}`).join('\n') : '(no headings detected)';

      prompt = `You are a content structure expert for TrueJobs.co.in, an Indian government job portal.
Analyze this article and suggest structural improvements.

Title: ${title}
Category: ${category || 'General'}
Tags: ${(tags || []).join(', ') || 'none'}
Word count: ${wordCount || 'unknown'}
Has introduction: ${hasIntro ? 'yes' : 'no'}
Has conclusion: ${hasConclusion ? 'yes' : 'no'}

Current headings:
${headingsList}

Content excerpt: ${plainText}

Return a JSON object with:
- result: a brief summary of structural suggestions (2-3 sentences)
- changes: array of specific actionable suggestions (strings)
- proposedOutline: array of suggested H2 heading strings for the article (ordered, 5-8 items). Include existing good headings and add missing ones.
- missingSections: array of section names that should be added (e.g., "Eligibility Criteria", "How to Apply", "Important Dates", "FAQ")
- suggestedInsertions: array of objects, each with:
  - label: short name (e.g., "Introduction", "Conclusion", "Bridge paragraph")
  - content: the actual HTML content to insert
  - suggestedPlacement: where it should go (e.g., "before first heading", "after last paragraph", "between section X and Y")
  - applyMode: one of "insert_before_first_heading", "append_content", "prepend_content"

Consider typical sections for Indian government job/exam articles:
- Overview/Introduction
- Important Dates
- Eligibility Criteria (age, qualification)
- Application Process / How to Apply
- Selection Process
- Exam Pattern
- Salary & Pay Scale
- FAQ
- Conclusion

Format: {"result": "...", "changes": [...], "proposedOutline": [...], "missingSections": [...], "suggestedInsertions": [...]}
No markdown code blocks.`;
      maxTokens = 3000;
    } else {
      return new Response(JSON.stringify({ error: 'Invalid action. Use "structure", "rewrite-section", "generate-intro", "generate-conclusion", or "enrich-article"' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Retry with exponential backoff for 429 rate limits (up to 3 attempts)
    let resp: Response | null = null;
    const maxRetries = 3;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      resp = await fetch(`${geminiUrl}?key=${geminiApiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: maxTokens, temperature: 0.4 },
        }),
      });
      if (resp.status === 429 && attempt < maxRetries - 1) {
        const backoffMs = (attempt + 1) * 5000; // 5s, 10s
        console.warn(`[improve-blog-content] 429 rate limit, retrying in ${backoffMs}ms (attempt ${attempt + 1}/${maxRetries})`);
        await new Promise(r => setTimeout(r, backoffMs));
        continue;
      }
      break;
    }
    if (!resp || !resp.ok) {
      const status = resp?.status || 500;
      if (status === 429) {
        return new Response(
          JSON.stringify({ error: 'Gemini API rate limit exceeded. Please wait a moment and try again.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw new Error(`Gemini API error ${status}`);
    }
    const data = await resp.json();
    const finishReason = data?.candidates?.[0]?.finishReason || '';
    const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const wasTruncated = finishReason === 'MAX_TOKENS' || finishReason === 'LENGTH';

    if (action === 'rewrite-section') {
      const cleaned = raw.replace(/```html\n?/g, '').replace(/```\n?/g, '').trim();
      return new Response(JSON.stringify({ result: cleaned, changes: ['Section rewritten for improved clarity'] }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'generate-intro') {
      const cleaned = raw.replace(/```html\n?/g, '').replace(/```\n?/g, '').trim();
      return new Response(JSON.stringify({ result: cleaned, applyMode: 'insert_before_first_heading' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'generate-conclusion') {
      const cleaned = raw.replace(/```html\n?/g, '').replace(/```\n?/g, '').trim();
      return new Response(JSON.stringify({ result: cleaned, applyMode: 'append_content' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'enrich-article') {
      let cleaned = raw.trim();
      if (cleaned.startsWith('```')) cleaned = cleaned.replace(/^```(?:json|html)?\s*\n/, '');
      if (cleaned.endsWith('```')) cleaned = cleaned.replace(/\n?```\s*$/, '');
      cleaned = cleaned.trim();

      const extractResultFromPseudoJson = (input: string): string => {
        const resultKeyIndex = input.indexOf('"result"');
        if (resultKeyIndex === -1) return '';
        const colonIndex = input.indexOf(':', resultKeyIndex);
        if (colonIndex === -1) return '';
        let i = colonIndex + 1;
        while (i < input.length && /\s/.test(input[i])) i++;
        if (input[i] !== '"') return '';
        i++;
        let out = '';
        let escaped = false;
        for (; i < input.length; i++) {
          const ch = input[i];
          if (escaped) { out += ch === 'n' ? '\n' : ch; escaped = false; continue; }
          if (ch === '\\') { escaped = true; continue; }
          if (ch === '"') {
            const rest = input.slice(i + 1);
            if (/^\s*,\s*"(wordCount|changes)"/.test(rest) || /^\s*}\s*$/.test(rest)) return out.trim();
            out += ch; continue;
          }
          out += ch;
        }
        return out.trim();
      };

      let resultHtml = '';
      let changes: string[] = [];

      try {
        const parsed = JSON.parse(cleaned);
        resultHtml = typeof parsed?.result === 'string' ? parsed.result : '';
        changes = Array.isArray(parsed?.changes) ? parsed.changes : [];
      } catch {
        const withoutJsonPrefix = cleaned.replace(/^json\s*/i, '').trim();
        const recovered = extractResultFromPseudoJson(withoutJsonPrefix);
        if (recovered) {
          resultHtml = recovered;
          changes = ['Content enriched'];
        } else {
          resultHtml = withoutJsonPrefix;
          changes = ['Content enriched'];
        }
      }

      if (!resultHtml || resultHtml === '{}' || /^\{[\s\S]*\}$/.test(resultHtml)) {
        resultHtml = '';
      }

      if (resultHtml && !resultHtml.includes('<h2') && !resultHtml.includes('<h3') && /^#{2,3}\s/m.test(resultHtml)) {
        resultHtml = markdownToHtml(resultHtml);
      }

      const wordCountComputed = resultHtml.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(w => w.length > 0).length;
      return new Response(JSON.stringify({
        result: resultHtml,
        wordCount: wordCountComputed,
        wasTruncated,
        changes: Array.isArray(changes) ? changes : [],
      }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // structure action
    let parsed: { result: string; changes: string[]; proposedOutline?: string[]; missingSections?: string[]; suggestedInsertions?: any[] };
    try {
      const cleanedJson = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      parsed = JSON.parse(cleanedJson);
    } catch {
      parsed = { result: raw, changes: [], proposedOutline: [], missingSections: [], suggestedInsertions: [] };
    }

    if (!Array.isArray(parsed.proposedOutline)) parsed.proposedOutline = [];
    if (!Array.isArray(parsed.missingSections)) parsed.missingSections = [];
    if (!Array.isArray(parsed.changes)) parsed.changes = [];
    if (!Array.isArray(parsed.suggestedInsertions)) parsed.suggestedInsertions = [];

    return new Response(JSON.stringify(parsed), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    console.error('improve-blog-content error:', err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
