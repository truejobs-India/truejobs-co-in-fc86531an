/**
 * generate-custom-page — AI-powered custom SEO page generation.
 * Supports: generate (full page from topic), improve (fix/optimize existing),
 *           bulk (multiple topics), generate-result (board result pages).
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// ═══════════════════════════════════════════════════════════════
// AI MODEL DISPATCHER
// ═══════════════════════════════════════════════════════════════

async function callGemini(prompt: string, maxTokens = 8192, timeout = 60_000): Promise<string> {
  const apiKey = Deno.env.get('GEMINI_API_KEY');
  if (!apiKey) throw new Error('GEMINI_API_KEY not configured');
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.6, maxOutputTokens: maxTokens },
      }),
      signal: controller.signal,
    });
    if (!resp.ok) throw new Error(`Gemini error: ${resp.status}`);
    const data = await resp.json();
    return data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  } finally { clearTimeout(timer); }
}

async function callGroq(prompt: string, maxTokens = 8192): Promise<string> {
  const apiKey = Deno.env.get('GROQ_API_KEY');
  if (!apiKey) throw new Error('GROQ_API_KEY not configured');
  const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'llama-3.3-70b-versatile', messages: [{ role: 'user', content: prompt }], temperature: 0.6, max_tokens: maxTokens }),
  });
  if (!resp.ok) throw new Error(`Groq error: ${resp.status}`);
  const data = await resp.json();
  return data?.choices?.[0]?.message?.content || '';
}

async function callMistral(prompt: string, maxTokens = 8192): Promise<string> {
  const apiKey = Deno.env.get('LOVABLE_API_KEY');
  if (!apiKey) throw new Error('LOVABLE_API_KEY not configured');
  const resp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'google/gemini-2.5-flash', messages: [{ role: 'user', content: prompt }], temperature: 0.6, max_tokens: maxTokens }),
  });
  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Mistral/Gateway error (${resp.status}): ${errText.substring(0, 300)}`);
  }
  const data = await resp.json();
  return data?.choices?.[0]?.message?.content || '';
}

async function callClaude(prompt: string, maxTokens = 8192): Promise<string> {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured');
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: maxTokens, messages: [{ role: 'user', content: prompt }] }),
  });
  if (!resp.ok) throw new Error(`Claude error: ${resp.status}`);
  const data = await resp.json();
  return data?.content?.[0]?.text || '';
}

async function callLovableGemini(prompt: string, maxTokens = 8192): Promise<string> {
  const apiKey = Deno.env.get('LOVABLE_API_KEY');
  if (!apiKey) throw new Error('LOVABLE_API_KEY not configured');
  const resp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'google/gemini-2.5-flash', messages: [{ role: 'user', content: prompt }], temperature: 0.6, max_tokens: maxTokens }),
  });
  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Lovable Gemini error (${resp.status}): ${errText.substring(0, 300)}`);
  }
  const data = await resp.json();
  return data?.choices?.[0]?.message?.content || '';
}

async function callOpenAI(prompt: string, maxTokens = 8192, model = 'gpt-4o'): Promise<string> {
  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) throw new Error('OPENAI_API_KEY not configured');
  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, messages: [{ role: 'user', content: prompt }], temperature: 0.6, max_tokens: maxTokens }),
  });
  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`OpenAI error (${resp.status}): ${errText.substring(0, 300)}`);
  }
  const data = await resp.json();
  return data?.choices?.[0]?.message?.content || '';
}

async function callGeminiPro(prompt: string, maxTokens = 8192): Promise<string> {
  const apiKey = Deno.env.get('LOVABLE_API_KEY');
  if (!apiKey) throw new Error('LOVABLE_API_KEY not configured');
  const resp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'google/gemini-2.5-pro', messages: [{ role: 'user', content: prompt }], temperature: 0.6, max_tokens: maxTokens }),
  });
  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Gemini Pro/Gateway error (${resp.status}): ${errText.substring(0, 300)}`);
  }
  const data = await resp.json();
  return data?.choices?.[0]?.message?.content || '';
}

async function callGpt5Mini(prompt: string, maxTokens = 8192): Promise<string> {
  const apiKey = Deno.env.get('LOVABLE_API_KEY');
  if (!apiKey) throw new Error('LOVABLE_API_KEY not configured');
  const resp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'openai/gpt-5-mini', messages: [{ role: 'user', content: prompt }], temperature: 0.6, max_tokens: maxTokens }),
  });
  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`GPT-5 Mini/Gateway error (${resp.status}): ${errText.substring(0, 300)}`);
  }
  const data = await resp.json();
  return data?.choices?.[0]?.message?.content || '';
}

async function callVertexFlash(prompt: string, maxTokens = 16384): Promise<string> {
  const { callVertexGemini } = await import('../_shared/vertex-ai.ts');
  return callVertexGemini('gemini-2.5-flash', prompt, 90_000, {
    maxOutputTokens: maxTokens,
    temperature: 0.6,
  });
}

async function callVertexPro(prompt: string, maxTokens = 16384): Promise<string> {
  const { callVertexGemini } = await import('../_shared/vertex-ai.ts');
  return callVertexGemini('gemini-2.5-pro', prompt, 150_000, {
    maxOutputTokens: maxTokens,
    temperature: 0.6,
  });
}

async function callAI(model: string, prompt: string, maxTokens = 8192): Promise<string> {
  switch (model) {
    case 'gemini': case 'gemini-flash': return callGemini(prompt, maxTokens);
    case 'gemini-pro': return callGeminiPro(prompt, maxTokens);
    case 'groq': return callGroq(prompt, maxTokens);
    case 'claude': case 'claude-sonnet': return callClaude(prompt, maxTokens);
    case 'mistral': return callMistral(prompt, maxTokens);
    case 'lovable-gemini': return callLovableGemini(prompt, maxTokens);
    case 'openai': case 'gpt5': return callOpenAI(prompt, maxTokens);
    case 'gpt5-mini': return callGpt5Mini(prompt, maxTokens);
    case 'vertex-flash': return callVertexFlash(prompt, maxTokens);
    case 'vertex-pro': return callVertexPro(prompt, maxTokens);
    case 'nova-pro': case 'nova-premier': {
      const { callBedrockNova } = await import('../_shared/bedrock-nova.ts');
      const { computeMaxTokens } = await import('../_shared/word-count-enforcement.ts');
      const novaBudget = computeMaxTokens(Math.ceil(maxTokens / 2), model);
      return callBedrockNova(model, prompt, { maxTokens: novaBudget, temperature: 0.6 });
    }
    default:
      throw new Error(`Unsupported AI model: "${model}". Select a valid model.`);
  }
}

// ═══════════════════════════════════════════════════════════════
// PROMPTS
// ═══════════════════════════════════════════════════════════════

function generatePagePrompt(topic: string, pageType: string, category: string, tags: string[]): string {
  return `You are an expert SEO content writer for TrueJobs.co.in, a leading Indian government job portal.

Generate a complete, SEO-optimized ${pageType} page about: "${topic}"
${category ? `Category: ${category}` : ''}
${tags.length > 0 ? `Tags: ${tags.join(', ')}` : ''}

Return a JSON object with these exact fields:
{
  "title": "SEO-friendly title (50-60 chars)",
  "slug": "url-friendly-slug-with-hyphens",
  "meta_title": "Meta title with primary keyword (≤60 chars)",
  "meta_description": "Compelling meta description with CTA (≤160 chars)",
  "excerpt": "2-3 sentence summary for cards/previews",
  "content": "Full HTML content (1500-2500 words). Use <h2>, <h3>, <p>, <ul>, <ol>, <table> tags. Include practical information, eligibility, process steps, tips. Make it comprehensive and E-E-A-T compliant.",
  "faq_items": [{"question": "...", "answer": "..."}, ...] (5-8 FAQ items for rich snippets),
  "suggested_tags": ["tag1", "tag2", ...],
  "suggested_category": "Best fitting category",
  "word_count": estimated word count (number)
}

Rules:
- Content must be original, factual, and useful for Indian job seekers
- Use proper HTML structure with headers, lists, and tables where appropriate
- Include internal linking opportunities (mention related exams/jobs)
- Write in a professional but accessible tone
- Optimize for featured snippets and People Also Ask
- Do NOT use markdown in content field — use HTML only
- Return ONLY valid JSON, no markdown fences`;
}

function improvePagePrompt(title: string, content: string, metaTitle: string, metaDesc: string): string {
  return `You are an expert SEO auditor for TrueJobs.co.in, an Indian government job portal.

Review and improve this page:

Title: ${title}
Meta Title: ${metaTitle || 'NOT SET'}
Meta Description: ${metaDesc || 'NOT SET'}

Current Content (first 3000 chars):
${content.substring(0, 3000)}

Return a JSON object with improvements:
{
  "meta_title": "Improved meta title (≤60 chars)",
  "meta_description": "Improved meta description (≤160 chars)",
  "excerpt": "Improved excerpt",
  "content_suggestions": ["suggestion 1", "suggestion 2", ...],
  "missing_sections": ["section that should be added", ...],
  "seo_score": 1-100 (estimated SEO quality),
  "issues": ["issue 1", "issue 2", ...],
  "improved_faq_items": [{"question": "...", "answer": "..."}, ...],
  "suggested_tags": ["tag1", ...],
  "suggested_category": "category"
}

Return ONLY valid JSON, no markdown fences.`;
}

function generateResultPagePrompt(input: {
  state_ut: string;
  board_name: string;
  board_abbr: string;
  result_url: string;
  official_board_url: string;
  seo_intro: string;
  variant: string;
  target_word_count: number;
  sibling_slugs: string[];
}): string {
  const siblingLinks = input.sibling_slugs.length > 0
    ? `Related pages on TrueJobs: ${input.sibling_slugs.map(s => `/${s}`).join(', ')}`
    : '';

  return `You are an expert SEO content writer for TrueJobs.co.in, a leading Indian government job & education portal.

Generate a comprehensive, SEO-optimized BOARD RESULT LANDING PAGE for:

State/UT: ${input.state_ut}
Board Name: ${input.board_name} (Abbreviation: ${input.board_abbr})
Result Variant: ${input.variant}
Official Result URL: ${input.result_url}
Official Board Website: ${input.official_board_url}
${input.seo_intro ? `SEO Intro Context: ${input.seo_intro}` : ''}
${siblingLinks}

STRICT Word count target: ${input.target_word_count} words. Do NOT exceed ${Math.round(input.target_word_count * 1.15)} words. Keep content concise and within this limit. If the target is 1000 words, write approximately 1000 words — not 2000 or 2500.${input.target_word_count <= 1200 ? ' Since the word limit is tight, keep each section brief (3-5 sentences max) and skip subsections.' : ''}

Your content MUST include ALL of these 15 sections (use <h2> for each):
1. Overview / Introduction — what this result is, which board, which year
2. Important Dates — exam date, result declaration date, re-evaluation window
3. How to Check Result — step-by-step with official URL
4. Direct Result Link — CTA paragraph mentioning the official link
5. Result Statistics — pass percentage, toppers (use placeholder data like "Expected" if unknown)
6. Marking Scheme & Grading System — how marks/grades work for this board
7. Toppers List — table placeholder for top performers
8. Compartment / Supplementary Info — when applicable, re-exam details
9. Revaluation / Rechecking Process — how to apply, fees, deadlines
10. What to Do After Result — next steps, admission, counseling
11. Documents Required — for admission/verification after result
12. Helpline & Contact Information — board contact details
13. Previous Year Comparison — trends, pass rate comparison
14. Important Links — table of useful official and related links
15. Disclaimer — standard disclaimer about official sources

Return a JSON object with these exact fields:
{
  "title": "SEO title (50-60 chars) like '${input.board_abbr.toUpperCase()} ${input.variant === 'main' ? '' : input.variant.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) + ' '}Result 2025 - ${input.state_ut}'",
  "meta_title": "Meta title with primary keyword (≤60 chars)",
  "meta_description": "Compelling meta description with CTA (≤160 chars)",
  "excerpt": "2-3 sentence summary for search/social previews",
  "content": "Full HTML content with all 15 sections. Use <h2>, <h3>, <p>, <ul>, <ol>, <table> tags. No markdown.",
  "faq_items": [{"question": "...", "answer": "..."}, ...] (8-12 FAQ items covering common queries about this result),
  "sections_present": ["overview", "important-dates", "how-to-check", ...] (list of section IDs present),
  "has_disclaimer": true,
  "has_cta": true,
  "has_official_urls": true,
  "section_count": number of h2 sections,
  "word_count": estimated word count (number),
  "suggested_tags": ["tag1", "tag2", ...]
}

Rules:
- Content must be factual, helpful for Indian students checking board results
- Use proper HTML: <h2> for sections, <h3> for subsections, <table> for data
- Include ${input.result_url} and ${input.official_board_url} as clickable links in the content
- Write in professional but student-friendly tone (Hindi-belt audience)
- Optimize for featured snippets and "People Also Ask"
- Do NOT use markdown — HTML only
- Return ONLY valid JSON, no markdown fences`;
}

// ═══════════════════════════════════════════════════════════════
// PARSE AI RESPONSE
// ═══════════════════════════════════════════════════════════════

function parseAIResponse(raw: string): any {
  const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

  // Level 1: direct parse
  try { return JSON.parse(cleaned); } catch { /* continue */ }

  // Level 2: extract outermost JSON block
  const blockMatch = cleaned.match(/\{[\s\S]*\}/);
  if (blockMatch) {
    try { return JSON.parse(blockMatch[0]); } catch { /* continue */ }

    // Level 3: repair unescaped quotes inside string values
    // The most common issue: HTML content contains unescaped double quotes
    try {
      const repaired = repairJsonString(blockMatch[0]);
      return JSON.parse(repaired);
    } catch { /* continue */ }
  }

  // Level 4: field-specific extraction as last resort
  try {
    return extractFieldsFromRaw(cleaned);
  } catch {
    console.error('[parseAIResponse] All parse levels failed. Raw length:', raw.length, 'First 500 chars:', raw.substring(0, 500));
    throw new Error('Failed to parse AI response as JSON');
  }
}

/** Attempt to fix unescaped double quotes inside JSON string values */
function repairJsonString(jsonStr: string): string {
  // Strategy: walk through and fix unescaped quotes inside values
  // Replace common HTML attribute quotes that break JSON
  let s = jsonStr;

  // Fix unescaped quotes in HTML attributes like class="..." href="..."
  // by replacing them with single quotes inside content values
  s = s.replace(
    /("content"\s*:\s*")([\s\S]*?)("\s*,\s*"(?:faq_items|suggested_tags|word_count|sections_present))/,
    (_match, prefix, content, suffix) => {
      // Escape unescaped double quotes in the content value
      const fixed = content
        .replace(/\\"/g, '\u0000ESC_QUOTE\u0000') // preserve already-escaped
        .replace(/"/g, '\\"')                       // escape all remaining
        .replace(/\u0000ESC_QUOTE\u0000/g, '\\"');  // restore
      return prefix + fixed + suffix;
    }
  );

  // Also fix excerpt field
  s = s.replace(
    /("excerpt"\s*:\s*")([\s\S]*?)("\s*,\s*"content")/,
    (_match, prefix, content, suffix) => {
      const fixed = content
        .replace(/\\"/g, '\u0000ESC_QUOTE\u0000')
        .replace(/"/g, '\\"')
        .replace(/\u0000ESC_QUOTE\u0000/g, '\\"');
      return prefix + fixed + suffix;
    }
  );

  return s;
}

/** Last-resort: extract individual fields via regex */
function extractFieldsFromRaw(raw: string): Record<string, unknown> {
  const shortField = (name: string): string => {
    const m = raw.match(new RegExp(`"${name}"\\s*:\\s*"([^"]{0,300})"`));
    return m?.[1] || '';
  };

  const title = shortField('title');
  const slug = shortField('slug');
  const meta_title = shortField('meta_title');
  const meta_description = shortField('meta_description');
  const excerpt = shortField('excerpt');

  // For content, grab the longest match (last "content": "..." block)
  const contentMatches = [...raw.matchAll(/"content"\s*:\s*"([\s\S]*?)(?:"\s*[,}])/g)];
  const content = contentMatches.length > 0
    ? contentMatches[contentMatches.length - 1][1].replace(/\\"/g, '"').replace(/\\n/g, '\n')
    : '';

  // Extract FAQ items
  let faq_items: Array<{question: string; answer: string}> = [];
  const faqMatch = raw.match(/"faq_items"\s*:\s*(\[[\s\S]*?\])\s*[,}]/);
  if (faqMatch) {
    try { faq_items = JSON.parse(faqMatch[1]); } catch { /* skip */ }
  }

  // Word count
  const wcMatch = raw.match(/"word_count"\s*:\s*(\d+)/);
  const word_count = wcMatch ? parseInt(wcMatch[1]) : 0;

  if (!title && !content) throw new Error('Could not extract any fields');

  return { title, slug, meta_title, meta_description, excerpt, content, faq_items, word_count, suggested_tags: [], suggested_category: '' };
}

// ═══════════════════════════════════════════════════════════════
// AUTH
// ═══════════════════════════════════════════════════════════════

async function verifyAdmin(req: Request) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return new Response(JSON.stringify({ error: 'Missing auth' }), { status: 401, headers: corsHeaders });

  const supabase = createClient(supabaseUrl, serviceKey);
  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return new Response(JSON.stringify({ error: 'Invalid token' }), { status: 401, headers: corsHeaders });

  const { data: roles } = await supabase.from('user_roles').select('role').eq('user_id', user.id);
  if (!roles?.some(r => r.role === 'admin')) {
    return new Response(JSON.stringify({ error: 'Admin only' }), { status: 403, headers: corsHeaders });
  }
  return user;
}

// ═══════════════════════════════════════════════════════════════
// HANDLER
// ═══════════════════════════════════════════════════════════════

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authResult = await verifyAdmin(req);
    if (authResult instanceof Response) return authResult;

    const body = await req.json();
    const { action, aiModel } = body;
    const model = aiModel || 'gemini-flash';

    // ── Generate generic page ──
    if (action === 'generate') {
      const { topic, pageType, category, tags } = body;
      if (!topic) return new Response(JSON.stringify({ error: 'topic required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

      const prompt = generatePagePrompt(topic, pageType || 'landing', category || '', tags || []);
      const raw = await callAI(model, prompt);
      const parsed = parseAIResponse(raw);

      return new Response(JSON.stringify({ success: true, data: parsed, model, action }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── Improve existing page ──
    if (action === 'improve') {
      const { title, content, metaTitle, metaDescription } = body;
      if (!title || !content) return new Response(JSON.stringify({ error: 'title and content required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

      const prompt = improvePagePrompt(title, content, metaTitle || '', metaDescription || '');
      const raw = await callAI(model, prompt);
      const parsed = parseAIResponse(raw);

      return new Response(JSON.stringify({ success: true, data: parsed, model, action }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── Fix page metadata (SEO fix) ──
    if (action === 'fix') {
      const { title, slug, content, meta_title, meta_description, excerpt, category, tags } = body;
      if (!title) return new Response(JSON.stringify({ error: 'title required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

      const contentSnippet = (content || '').substring(0, 2000);
      const fixPrompt = `You are an expert SEO specialist for TrueJobs.co.in.

Fix the SEO metadata for this page. Only fix what is broken or missing.

Current page:
- Title: ${title}
- Slug: ${slug || 'NOT SET'}
- Meta Title: ${meta_title || 'NOT SET'} (${(meta_title || '').length} chars)
- Meta Description: ${meta_description || 'NOT SET'} (${(meta_description || '').length} chars)
- Excerpt: ${excerpt || 'NOT SET'}
- Category: ${category || 'NOT SET'}
- Tags: ${(tags || []).join(', ') || 'NONE'}

Content preview: ${contentSnippet}

Return a JSON object with ONLY the fields that need fixing:
{
  "meta_title": "Fixed meta title (40-60 chars)" or null if already good,
  "meta_description": "Fixed meta description (120-160 chars)" or null if already good,
  "excerpt": "Fixed excerpt (2-3 sentences)" or null if already good,
  "slug": "fixed-slug" or null if already good,
  "suggested_tags": ["tag1", ...] or null if already good,
  "fix_summary": "Brief summary of what was fixed"
}

Rules:
- Do NOT change fields that are already good
- Meta title: 40-60 chars, include primary keyword
- Meta description: 120-160 chars, compelling with CTA
- Slug: lowercase, hyphens only, 3-70 chars
- Return ONLY valid JSON`;

      console.log(`[generate-custom-page] fix action, model=${model}, slug=${slug}`);
      const raw = await callAI(model, fixPrompt);
      const parsed = parseAIResponse(raw);

      return new Response(JSON.stringify({ success: true, data: parsed, model, action }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── Enrich page content ──
    if (action === 'enrich') {
      const { title, slug, content, meta_title, meta_description, excerpt, category, tags, faq_schema, word_count: currentWc, target_word_count: enrichTarget } = body;
      if (!title) return new Response(JSON.stringify({ error: 'title required for enrich' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

      const { buildWordCountInstruction, computeMaxTokens, validateWordCount, countWordsFromHtml } = await import('../_shared/word-count-enforcement.ts');
      const enrichWordTarget = enrichTarget || 2000;
      const wcInstruction = buildWordCountInstruction(enrichWordTarget, model);
      const enrichMaxTokens = computeMaxTokens(enrichWordTarget, model);

      const enrichPrompt = `You are an expert SEO content writer for TrueJobs.co.in, a leading Indian government job & education portal.

Enrich and improve this existing page. Expand thin content, add missing sections, improve structure.
${wcInstruction}

Current page:
- Title: ${title}
- Slug: ${slug}
- Word count: ~${currentWc || 'unknown'}
- Meta Title: ${meta_title || 'NOT SET'}
- Meta Description: ${meta_description || 'NOT SET'}
- Has FAQ: ${Array.isArray(faq_schema) ? faq_schema.length + ' items' : 'No'}
- Tags: ${(tags || []).join(', ') || 'NONE'}

Current content (may be truncated):
${(content || '').substring(0, 6000)}

Return a JSON object with the enriched version:
{
  "title": "${title}",
  "meta_title": "Improved meta title (40-60 chars)",
  "meta_description": "Improved meta description (120-160 chars)",
  "excerpt": "Improved excerpt",
  "content": "Full enriched HTML content. Keep existing good content, expand thin sections, add missing ones. Use <h2>, <h3>, <p>, <ul>, <ol>, <table>.",
  "faq_items": [{"question": "...", "answer": "..."}, ...] (5-8 FAQ items),
  "suggested_tags": ["tag1", "tag2", ...],
  "word_count": estimated word count,
  "sections_added": ["section names that were added"],
  "enrichment_summary": "Brief summary of enrichments made"
}

Rules:
- Keep existing good content, don't replace it
- Add missing H2 sections, lists, tables where appropriate
- Ensure E-E-A-T compliance
- Add FAQ if missing or thin
- Use HTML only, no markdown
- Return ONLY valid JSON`;

      console.log(`[generate-custom-page] enrich action, model=${model}, slug=${slug}, currentWc=${currentWc}, targetWc=${enrichWordTarget}, maxTokens=${enrichMaxTokens}`);
      const raw = await callAI(model, enrichPrompt, enrichMaxTokens);
      const parsed = parseAIResponse(raw);

      // Add word count validation if content was returned
      let wordCountValidation = null;
      if (parsed?.content) {
        wordCountValidation = validateWordCount(parsed.content, enrichWordTarget, enrichMaxTokens);
        parsed.word_count = countWordsFromHtml(parsed.content);
      }

      return new Response(JSON.stringify({ success: true, data: parsed, model, action, wordCountValidation }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── Generate board result page ──
    if (action === 'generate-result') {
      const { state_ut, board_name, board_abbr, result_url, official_board_url, seo_intro, variant, target_word_count, sibling_slugs } = body;
      if (!state_ut || !board_name) return new Response(JSON.stringify({ error: 'state_ut and board_name required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

      const twc = target_word_count || 2000;
      const { computeMaxTokens: computeMT, validateWordCount: validateWC, countWordsFromHtml: countWC } = await import('../_shared/word-count-enforcement.ts');
      const resultMaxTokens = computeMT(twc, model);

      const prompt = generateResultPagePrompt({
        state_ut,
        board_name,
        board_abbr: board_abbr || board_name,
        result_url: result_url || '',
        official_board_url: official_board_url || '',
        seo_intro: seo_intro || '',
        variant: variant || 'main',
        target_word_count: twc,
        sibling_slugs: sibling_slugs || [],
      });

      console.log(`[generate-custom-page] generate-result action, model=${model}, board=${board_abbr}, variant=${variant}, targetWc=${twc}, maxTokens=${resultMaxTokens}`);
      const raw = await callAI(model, prompt, resultMaxTokens);
      const parsed = parseAIResponse(raw);

      // Add word count validation
      let wordCountValidation = null;
      if (parsed?.content) {
        wordCountValidation = validateWC(parsed.content, twc, resultMaxTokens);
        parsed.word_count = countWC(parsed.content);
      }

      return new Response(JSON.stringify({ success: true, data: parsed, model, action, wordCountValidation }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── Validate bulk topics ──
    if (action === 'validate-bulk') {
      const { topics } = body;
      const topicList = (topics || '').split('\n').map((t: string) => t.trim()).filter(Boolean);
      return new Response(JSON.stringify({ success: true, data: { topics: topicList, count: topicList.length } }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e: any) {
    console.error('[generate-custom-page]', e);
    return new Response(JSON.stringify({ success: false, error: e.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
