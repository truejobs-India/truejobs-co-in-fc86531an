/**
 * generate-resource-content — AI content generation for PDF resources.
 * Supports: sample_paper, book, previous_year_paper
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// ═══════════════════════════════════════════════════════════════
// AI MODEL DISPATCHER (same as generate-custom-page)
// ═══════════════════════════════════════════════════════════════

async function callGemini(prompt: string, timeout = 60_000): Promise<string> {
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
        generationConfig: { temperature: 0.65, maxOutputTokens: 8192 },
      }),
      signal: controller.signal,
    });
    if (!resp.ok) throw new Error(`Gemini error: ${resp.status}`);
    const data = await resp.json();
    return data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  } finally { clearTimeout(timer); }
}

async function callGroq(prompt: string): Promise<string> {
  const apiKey = Deno.env.get('GROQ_API_KEY');
  if (!apiKey) throw new Error('GROQ_API_KEY not configured');
  const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'llama-3.3-70b-versatile', messages: [{ role: 'user', content: prompt }], temperature: 0.65, max_tokens: 8192 }),
  });
  if (!resp.ok) throw new Error(`Groq error: ${resp.status}`);
  const data = await resp.json();
  return data?.choices?.[0]?.message?.content || '';
}

async function callClaude(prompt: string): Promise<string> {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured');
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 8192, messages: [{ role: 'user', content: prompt }] }),
  });
  if (!resp.ok) throw new Error(`Claude error: ${resp.status}`);
  const data = await resp.json();
  return data?.content?.[0]?.text || '';
}

async function callLovableGateway(prompt: string, gatewayModel: string): Promise<string> {
  const apiKey = Deno.env.get('LOVABLE_API_KEY');
  if (!apiKey) throw new Error('LOVABLE_API_KEY not configured');
  const resp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: gatewayModel, messages: [{ role: 'user', content: prompt }], temperature: 0.65, max_tokens: 8192 }),
  });
  if (!resp.ok) {
    const errText = await resp.text();
    if (resp.status === 429) throw new Error('Rate limit exceeded on Lovable AI gateway');
    if (resp.status === 402) throw new Error('Not enough Lovable AI credits — add funds in Settings → Workspace → Usage');
    throw new Error(`Lovable gateway error [${resp.status}]: ${errText.substring(0, 200)}`);
  }
  const data = await resp.json();
  return data?.choices?.[0]?.message?.content || '';
}

/** Model value → Lovable gateway model ID */
const LOVABLE_GATEWAY_MAP: Record<string, string> = {
  'gemini-pro': 'google/gemini-2.5-pro',
  'lovable-gemini': 'google/gemini-2.5-flash',
  'gpt5': 'openai/gpt-5',
  'gpt5-mini': 'openai/gpt-5-mini',
  'nova-pro': 'openai/gpt-5-mini',       // No native Nova on gateway; closest match
  'nova-premier': 'openai/gpt-5',         // No native Nova on gateway; closest match
  'mistral': 'google/gemini-2.5-flash',   // No native Mistral on gateway; closest match
};

async function callAI(model: string, prompt: string): Promise<string> {
  // Direct API models (user's own keys)
  switch (model) {
    case 'gemini': case 'gemini-flash': return callGemini(prompt);
    case 'groq': return callGroq(prompt);
    case 'claude': case 'claude-sonnet': return callClaude(prompt);
    case 'openai': return callOpenAI(prompt);
    case 'vertex-flash': return callVertexFlash(prompt);
    case 'vertex-pro': {
      const { callVertexGemini } = await import('../_shared/vertex-ai.ts');
      return callVertexGemini('gemini-2.5-pro', prompt, 90_000, {
        maxOutputTokens: 16384, temperature: 0.65,
      });
    }
  }
  // Lovable gateway models (built-in, no user key needed)
  const gatewayModel = LOVABLE_GATEWAY_MAP[model];
  if (gatewayModel) return callLovableGateway(prompt, gatewayModel);

  // Fallback
  console.warn(`[generate-resource-content] Unknown model "${model}", falling back to gemini-flash`);
  return callGemini(prompt);
}

// ═══════════════════════════════════════════════════════════════
// PROMPTS
// ═══════════════════════════════════════════════════════════════

function buildPrompt(params: {
  title: string; resourceType: string; category: string; examName: string;
  subject: string; language: string; tags: string[]; year: number | null; slug: string;
}): string {
  const { title, resourceType, category, examName, subject, language, tags, year, slug } = params;

  const typeLabels: Record<string, string> = {
    sample_paper: 'Sample Paper',
    book: 'Book / Study Material',
    previous_year_paper: 'Previous Year Paper',
  };
  const typeLabel = typeLabels[resourceType] || 'Resource';

  const typeGuidance: Record<string, string> = {
    sample_paper: `Focus on: exam pattern overview, benefits of solving sample papers, likely sections covered, time management tips, how to analyze mistakes, who should use this paper, scoring strategy, and practical preparation advice.`,
    book: `Focus on: why this subject matters for the exam, how to study effectively using this book, chapter-wise importance for the exam, who should use this book, study schedule suggestions, key concepts to master, and exam-specific preparation strategy.`,
    previous_year_paper: `Focus on: why previous year papers are essential, trend analysis of repeated topics, how to use PYPs for revision, time-bound practice strategy, common question patterns, year-over-year difficulty comparison, and score improvement tips.`,
  };

  return `You are an expert SEO content writer for TrueJobs.co.in, India's leading government job portal.

Generate comprehensive, unique SEO content for a downloadable PDF ${typeLabel}.

Resource Details:
- Title: "${title}"
- Slug: ${slug}
- Type: ${typeLabel}
- Category/Exam Family: ${category || 'General'}
- Specific Exam: ${examName || 'Not specified'}
- Subject: ${subject || 'General'}
- Language: ${language || 'Hindi'}
- Year: ${year || 'Latest'}
- Tags: ${tags?.join(', ') || 'None'}

${typeGuidance[resourceType] || ''}

IMPORTANT UNIQUENESS REQUIREMENTS:
- Reference the SPECIFIC exam name "${examName || category}" throughout
- Mention the SPECIFIC subject "${subject || 'this subject'}" with concrete examples
- Reference the year ${year || '2026'} and current exam patterns
- Use the slug "${slug}" context to create distinct content
- Do NOT produce generic content that could apply to any exam

Return a JSON object with these exact fields:
{
  "content": "Full HTML content (1000-1200 words). Use <h2>, <h3>, <p>, <ul>, <ol>, <table> tags. Include a 'How to Use This PDF' section, table-of-contents summary, and practical exam tips. HTML only, no markdown.",
  "excerpt": "2-3 sentence compelling summary (80-120 chars)",
  "meta_title": "SEO meta title with primary keyword (≤60 chars)",
  "meta_description": "Compelling meta description with download CTA (120-160 chars)",
  "faq_items": [{"question": "...", "answer": "..."}, ...] (exactly 5 FAQ items),
  "suggested_tags": ["tag1", "tag2", ...] (5-8 tags),
  "word_count": estimated word count (number)
}

Rules:
- Content must be factual, useful for Indian government exam aspirants
- Include structured HTML with proper headings hierarchy
- Write in professional but accessible tone
- Optimize for featured snippets
- Do NOT use markdown — HTML only
- Return ONLY valid JSON, no markdown fences`;
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
  if (!roles?.some((r: any) => r.role === 'admin')) {
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
    const { action, title, resourceType, category, examName, subject, language, tags, year, slug, aiModel, fileName, fileNames } = body;
    const model = aiModel || 'gemini-flash';

    // ── Extract metadata from filename(s) using AI ──────
    if (action === 'extract-metadata') {
      const names = fileNames || (fileName ? [fileName] : []);
      if (!names.length) return new Response(JSON.stringify({ error: 'fileName or fileNames required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

      const rType = resourceType || 'sample_paper';
      const typeLabels: Record<string, string> = { sample_paper: 'Sample Paper', book: 'Book / Study Material', previous_year_paper: 'Previous Year Paper' };
      const typeLabel = typeLabels[rType] || 'Resource';

      const fileListStr = names.map((n: string, i: number) => `${i + 1}. "${n}"`).join('\n');

      const metaPrompt = `You are an expert SEO analyst for TrueJobs.co.in, India's leading government job preparation portal.

Given the following PDF file name(s), extract and generate SEO metadata for each file. The files are ${typeLabel} resources for Indian government exam aspirants.

File names:
${fileListStr}

For EACH file, return a JSON object with these fields:
- "title": Human-readable, SEO-friendly title (60-80 chars). Remove file extensions, decode abbreviations, add context.
- "meta_title": SEO meta title with primary keyword (≤60 chars)
- "slug": URL-safe slug derived from title (lowercase, hyphens, no special chars, max 70 chars)
- "meta_description": Compelling meta description with download CTA (120-160 chars)
- "category": Best-fit category (e.g. SSC, UPSC, Railway, Banking, State PSC, Teaching, Defence, Police, General)
- "excerpt": 2-3 sentence summary (80-120 chars)
- "subject": Subject if detectable (e.g. Reasoning, Math, English, GK, Science, Hindi)
- "language": Detected language (hindi, english, or bilingual)
- "exam_year": Exam year if present in filename (number or null)
- "edition_year": Edition/publication year if present (number or null)
- "tags": Array of 5-8 relevant tags
- "download_filename": Clean human-readable download filename ending in .pdf
- "featured_image_alt": Descriptive alt text for a cover image (50-100 chars)
- "exam_name": Specific exam name if detectable (e.g. SSC CGL, UPSC CSE, RRB NTPC)

Rules:
- Parse intelligently: "SSC-CGL-Tier1-Reasoning-2025.pdf" → title "SSC CGL Tier 1 Reasoning Sample Paper 2025"
- For Hindi/bilingual content, keep title in English but note language as hindi/bilingual
- Return ONLY valid JSON array, no markdown fences
- If only one file, still return an array with one object`;

      const raw = await callAI(model, metaPrompt);
      const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

      let parsed;
      try { parsed = JSON.parse(cleaned); } catch {
        const match = cleaned.match(/\[[\s\S]*\]/);
        if (match) parsed = JSON.parse(match[0]);
        else {
          const objMatch = cleaned.match(/\{[\s\S]*\}/);
          if (objMatch) parsed = [JSON.parse(objMatch[0])];
          else throw new Error('Failed to parse AI metadata response');
        }
      }

      if (!Array.isArray(parsed)) parsed = [parsed];

      return new Response(JSON.stringify({ success: true, data: parsed, model, action }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'generate') {
      if (!title) return new Response(JSON.stringify({ error: 'title required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

      const prompt = buildPrompt({ title, resourceType: resourceType || 'sample_paper', category: category || '', examName: examName || '', subject: subject || '', language: language || 'hindi', tags: tags || [], year: year || null, slug: slug || '' });
      const raw = await callAI(model, prompt);
      const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

      let parsed;
      try { parsed = JSON.parse(cleaned); } catch {
        const match = cleaned.match(/\{[\s\S]*\}/);
        if (match) parsed = JSON.parse(match[0]);
        else throw new Error('Failed to parse AI response as JSON');
      }

      // Compute content hash (first 500 chars normalized + word count bucket)
      const contentPreview = (parsed.content || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim().substring(0, 500).toLowerCase();
      const wc = parsed.word_count || 0;
      const bucket = Math.floor(wc / 100) * 100;
      const encoder = new TextEncoder();
      const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(`${contentPreview}|${bucket}`));
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const contentHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

      return new Response(JSON.stringify({ success: true, data: { ...parsed, content_hash: contentHash }, model, action }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e: any) {
    console.error('[generate-resource-content]', e);
    return new Response(JSON.stringify({ success: false, error: e.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
