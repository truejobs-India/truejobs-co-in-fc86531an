// Blog compliance analysis — Vertex AI Gemini
// Uses shared Vertex AI helper
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

// ── Server-side normalization whitelists ──
const VALID_FIX_TYPES = new Set([
  'metadata', 'content-block', 'rewrite', 'advisory',
  'canonical_url', 'slug', 'meta_description', 'image_alt',
  'faq', 'intro', 'conclusion', 'trust_signal',
  'affiliate_links', 'internal_links', 'content_rewrite',
  'h1', 'heading_structure', 'excerpt', 'readability',
]);

const VALID_APPLY_MODES = new Set([
  'apply_field', 'append_content', 'prepend_content',
  'insert_before_first_heading', 'replace_section',
  'review_replacement', 'advisory',
]);

const EDITABLE_FIELDS = new Set([
  'meta_title', 'meta_description', 'excerpt',
  'featured_image_alt', 'author_name',
  'canonical_url', 'slug',
]);

// Legacy applyMode normalization map
const APPLY_MODE_LEGACY_MAP: Record<string, string> = {
  'field': 'apply_field',
  'append': 'append_content',
  'review-and-replace': 'review_replacement',
  'manual': 'advisory',
};

function normalizeFix(raw: any): {
  issueKey: string; issueLabel: string; priority: string; fixType: string;
  field: string; suggestedValue: string; explanation: string; applyMode: string;
  targetSnippet?: string; confidence: string;
  faqSchemaEligible?: boolean; faqSchema?: Array<{ question: string; answer: string }>;
} {
  const issueKey = typeof raw.issueKey === 'string' ? raw.issueKey : 'unknown';
  const issueLabel = typeof raw.issueLabel === 'string' ? raw.issueLabel : (typeof raw.issue === 'string' ? raw.issue : 'Unknown issue');
  const priority = ['high', 'medium', 'low'].includes(raw.priority) ? raw.priority : 'medium';
  let fixType = typeof raw.fixType === 'string' ? raw.fixType : 'advisory';
  let applyMode = typeof raw.applyMode === 'string' ? raw.applyMode : 'advisory';
  let field = typeof raw.field === 'string' ? raw.field : '';
  const suggestedValue = typeof raw.suggestedValue === 'string' ? raw.suggestedValue : '';
  const explanation = typeof raw.explanation === 'string' ? raw.explanation : (typeof raw.suggestion === 'string' ? raw.suggestion : '');
  const targetSnippet = typeof raw.targetSnippet === 'string' ? raw.targetSnippet : undefined;
  const confidence = ['high', 'medium', 'low'].includes(raw.confidence) ? raw.confidence : 'medium';

  // Normalize legacy applyMode names BEFORE whitelist checks
  if (APPLY_MODE_LEGACY_MAP[applyMode]) {
    applyMode = APPLY_MODE_LEGACY_MAP[applyMode];
  }

  // Whitelist enforcement — unknown values downgrade to advisory
  if (!VALID_FIX_TYPES.has(fixType)) fixType = 'advisory';
  if (!VALID_APPLY_MODES.has(applyMode)) applyMode = 'advisory';

  // Rescue: AI returned real content with wrong fixType — infer from issueKey
  if (fixType === 'advisory' && suggestedValue.length > 20) {
    if (issueKey === 'missing-intro') { fixType = 'intro'; applyMode = 'insert_before_first_heading'; }
    else if (issueKey === 'missing-conclusion') { fixType = 'conclusion'; applyMode = 'append_content'; }
    else if (issueKey === 'faq-schema') { fixType = 'faq'; applyMode = 'append_content'; }
    else if (issueKey === 'seo-internal-links') { fixType = 'internal_links'; applyMode = 'append_content'; }
    else if (issueKey === 'missing-lists') { fixType = 'readability'; applyMode = 'append_content'; }
    else if (issueKey === 'low-heading-count') { fixType = 'heading_structure'; applyMode = 'append_content'; }
    else if (issueKey === 'h1-present') { fixType = 'h1'; applyMode = 'insert_before_first_heading'; }
  }

  // Rescue: correct applyMode for known fixTypes
  if (fixType === 'intro' && applyMode !== 'insert_before_first_heading') applyMode = 'insert_before_first_heading';
  if (fixType === 'conclusion' && applyMode !== 'append_content') applyMode = 'append_content';
  if (fixType === 'readability' && applyMode !== 'append_content') applyMode = 'append_content';
  if (fixType === 'h1' && applyMode !== 'insert_before_first_heading') applyMode = 'insert_before_first_heading';

  // Safety net: internal_links must NEVER use destructive modes
  if (fixType === 'internal_links' && (applyMode === 'replace_section' || applyMode === 'review_replacement')) {
    applyMode = 'append_content';
  }

  if (fixType === 'metadata' && field && !EDITABLE_FIELDS.has(field)) {
    applyMode = 'advisory';
  }

  // Slug safety: only auto-apply if confidence is high
  if (field === 'slug' && confidence !== 'high') {
    applyMode = 'advisory';
  }

  // FAQ schema fields — pass through if valid
  let faqSchemaEligible: boolean | undefined;
  let faqSchema: Array<{ question: string; answer: string }> | undefined;

  if (fixType === 'faq') {
    faqSchemaEligible = typeof raw.faqSchemaEligible === 'boolean' ? raw.faqSchemaEligible : undefined;
    if (raw.faqSchemaEligible === true && Array.isArray(raw.faqSchema)) {
      const validated = raw.faqSchema.filter(
        (item: any) => typeof item?.question === 'string' && item.question.length > 0
          && typeof item?.answer === 'string' && item.answer.length > 0
      );
      if (validated.length > 0) {
        faqSchema = validated;
      }
    }
  }

  return { issueKey, issueLabel, priority, fixType, field, suggestedValue, explanation, applyMode, targetSnippet, confidence, faqSchemaEligible, faqSchema };
}

// ── Truncation recovery ──
function attemptTruncationRecovery(raw: string): { recovered: string | null; itemCount: number } {
  // Find the last complete JSON object boundary
  const lastClose = raw.lastIndexOf('},');
  if (lastClose === -1) {
    // Try single-object case: lastIndexOf('}')
    const lastBrace = raw.lastIndexOf('}');
    if (lastBrace > 0) {
      const attempt = raw.substring(0, lastBrace + 1) + ']';
      return { recovered: attempt, itemCount: 1 };
    }
    return { recovered: null, itemCount: 0 };
  }
  const attempt = raw.substring(0, lastClose + 1) + ']';
  // Rough count of complete objects
  const count = (attempt.match(/\}/g) || []).length;
  return { recovered: attempt, itemCount: count };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authResult = await verifyAdmin(req);
    if (authResult instanceof Response) return authResult;

    const { title, content, issues, slug, existingMeta, aiModel, availableSlugs } = await req.json();
    if (!title || !issues || !Array.isArray(issues)) {
      return new Response(JSON.stringify({ error: 'title and issues[] required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const plainText = (content || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 2000);
    const issueList = issues.map((i: any) => `- ${i.label}: ${i.detail}${i.recommendation ? ` (${i.recommendation})` : ''}`).join('\n');

    // Build existing metadata context
    const meta = existingMeta || {};
    const headingsList = Array.isArray(meta.headings)
      ? meta.headings.map((h: any) => `  H${h.level}: ${h.text}`).join('\n')
      : '(none)';

    const metaContext = [
      `meta_title: ${meta.meta_title || '(empty)'}`,
      `meta_description: ${meta.meta_description || '(empty)'}`,
      `excerpt: ${meta.excerpt || '(empty)'}`,
      `featured_image_alt: ${meta.featured_image_alt || '(empty)'}`,
      `canonical_url: ${meta.canonical_url || '(empty)'}`,
      `cover_image: ${meta.hasCoverImage ? 'yes' : 'no'}`,
      `has_intro: ${meta.hasIntro ? 'yes' : 'no'}`,
      `has_conclusion: ${meta.hasConclusion ? 'yes' : 'no'}`,
      `words: ${meta.wordCount ?? '?'}, FAQs: ${meta.faqCount ?? 0}, internal_links: ${meta.internalLinkCount ?? 0}`,
      `headings:\n${headingsList}`,
    ].join('\n');

    const prompt = `You are an SEO compliance expert for TrueJobs.co.in (Indian govt job portal).
For each issue below, return a specific fix object. Keep explanation ≤15 words. Be concise.

Article: "${title}" | slug: ${slug || '?'}
Excerpt (first 2000 chars): ${plainText}

Current metadata:
${metaContext}

Issues:
${issueList}

Each fix object fields:
issueKey (machine key), issueLabel (human name), priority (high/medium/low), fixType, field, suggestedValue, explanation (≤15 words), applyMode, confidence (high/medium/low), targetSnippet (optional for rewrites).

fixType: metadata | content-block | rewrite | advisory | canonical_url | slug | meta_description | image_alt | faq | intro | conclusion | trust_signal | affiliate_links | internal_links | content_rewrite | h1 | heading_structure | excerpt | readability
applyMode: apply_field | append_content | prepend_content | insert_before_first_heading | replace_section | review_replacement | advisory
field (for metadata): meta_title | meta_description | excerpt | featured_image_alt | author_name | canonical_url | slug

RULES:
- meta_description: target 130-155 chars strictly. Never above 155. applyMode=apply_field, field=meta_description
- meta_title: under 60 chars. applyMode=apply_field, field=meta_title
- canonical_url: must be exactly https://truejobs.co.in/blog/${slug || '{slug}'}. applyMode=apply_field, field=canonical_url
- slug: lowercase, hyphens only, no trailing hyphens. applyMode=apply_field, field=slug
- H1 missing: fixType=intro, applyMode=insert_before_first_heading. Include <h1> tag + intro paragraph.
- missing-intro: fixType=intro, applyMode=insert_before_first_heading. Write 2-3 context-setting sentences as <p> tags. No heading tag.
- missing-conclusion: fixType=conclusion, applyMode=append_content. Write <h2>Conclusion</h2> + 2-3 sentence wrap-up as <p> tags.
- missing-lists (readability): fixType=readability, applyMode=append_content. Convert one key topic into a <ul> or <ol> with 4-6 items. Include a short <h3> context heading. Must contain <ul>, <ol>, <table>, or <dl> tags.
- low-heading-count: fixType=heading_structure, applyMode=append_content. Add 1-2 new <h2> sections with 2-3 paragraphs each, relevant to article topic.
- FAQ: fixType=faq, applyMode=append_content. Include faqSchemaEligible (boolean). If true, include faqSchema as [{question,answer},...]. ALWAYS include faqSchemaEligible=true and faqSchema array when generating FAQ content. If not eligible, explain why. Article eligible if >300 words, informational/how-to, has user questions.
- internal_links: fixType=internal_links, applyMode=append_content. Pick 3-6 links from the AVAILABLE SLUGS list below. Return as: <h3>Related Resources</h3><ul><li><a href="/blog/{slug}">anchor text</a> — short description</li></ul>. ONLY use slugs from the provided list. Never invent URLs. Never use replace_section.
- trust_signal: applyMode=review_replacement
- affiliate_links: applyMode=advisory
- Provide COMPLETE ready-to-use values. No placeholders.

Return ONLY a JSON array: [{...}]
No markdown code blocks.`;

    // ── AI model dispatcher — respects user's model selection, NO fallback ──
    const selectedModel = aiModel;
    if (!selectedModel) {
      return new Response(JSON.stringify({ error: 'aiModel parameter is required. No fallback allowed.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    console.log(`[COMPLIANCE] Using model: ${selectedModel} for "${title}"`);

    let raw: string;
    let timedOut = false;

    async function callSelectedModel(p: string): Promise<string> {
      switch (selectedModel) {
        case 'azure-gpt5-mini': {
          const { callAzureGPT5Mini } = await import('../_shared/azure-openai.ts');
          return callAzureGPT5Mini(p, { maxTokens: 8192, temperature: 0.3 });
        }
        case 'azure-gpt41-mini': {
          const { callAzureGPT41Mini } = await import('../_shared/azure-openai.ts');
          return callAzureGPT41Mini(p, { maxTokens: 8192, temperature: 0.3 });
        }
        case 'azure-gpt4o-mini': {
          const { callAzureOpenAI } = await import('../_shared/azure-openai.ts');
          return callAzureOpenAI(p, { maxTokens: 8192, temperature: 0.3 });
        }
        case 'azure-deepseek-v3': {
          const { callAzureDeepSeek } = await import('../_shared/azure-deepseek.ts');
          return callAzureDeepSeek(p, { maxTokens: 8192, temperature: 0.3 });
        }
        case 'azure-deepseek-r1': {
          const { callAzureDeepSeek } = await import('../_shared/azure-deepseek.ts');
          return callAzureDeepSeek(p, { model: 'DeepSeek-R1', maxTokens: 8192, temperature: 0.3 });
        }
        case 'sarvam-30b': {
          const { callSarvamChat } = await import('../_shared/sarvam.ts');
          return callSarvamChat(p, { model: 'sarvam-30b', maxTokens: 8192, temperature: 0.3 });
        }
        case 'sarvam-105b': {
          const { callSarvamChat } = await import('../_shared/sarvam.ts');
          return callSarvamChat(p, { model: 'sarvam-105b', maxTokens: 8192, temperature: 0.3 });
        }
        case 'groq': {
          const groqKey = Deno.env.get('GROQ_API_KEY');
          if (!groqKey) throw new Error('GROQ_API_KEY not configured');
          const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: { Authorization: `Bearer ${groqKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: 'llama-3.3-70b-versatile', messages: [{ role: 'user', content: p }], max_tokens: 8192, temperature: 0.3 }),
          });
          if (!resp.ok) throw new Error(`Groq API error ${resp.status}`);
          const data = await resp.json();
          return data?.choices?.[0]?.message?.content || '';
        }
        case 'vertex-3.1-pro': {
          const { callGeminiDirect } = await import('../_shared/gemini-direct.ts');
          return callGeminiDirect('gemini-3.1-pro-preview', p, 120_000, { maxOutputTokens: 8192, temperature: 0.3 });
        }
        case 'vertex-3-flash': {
          const { callGeminiDirect } = await import('../_shared/gemini-direct.ts');
          return callGeminiDirect('gemini-3-flash-preview', p, 90_000, { maxOutputTokens: 8192, temperature: 0.3 });
        }
        case 'vertex-3.1-flash-lite': {
          const { callGeminiDirect } = await import('../_shared/gemini-direct.ts');
          return callGeminiDirect('gemini-3.1-flash-lite-preview', p, 60_000, { maxOutputTokens: 8192, temperature: 0.3 });
        }
        case 'gemini-flash': case 'gemini': case 'vertex-flash': {
          const { callGeminiDirect } = await import('../_shared/gemini-direct.ts');
          return callGeminiDirect('gemini-2.5-flash', p, 90_000, { maxOutputTokens: 8192, temperature: 0.3 });
        }
        case 'gemini-pro': case 'vertex-pro': {
          const { callGeminiDirect } = await import('../_shared/gemini-direct.ts');
          return callGeminiDirect('gemini-2.5-pro', p, 90_000, { maxOutputTokens: 8192, temperature: 0.3 });
        }
        case 'nova-pro': case 'nova-premier': case 'nemotron-120b': {
          const { callBedrockNova } = await import('../_shared/bedrock-nova.ts');
          return callBedrockNova(selectedModel, p, { maxTokens: 8192, temperature: 0.3 });
        }
        case 'mistral': {
          const { callBedrockNova } = await import('../_shared/bedrock-nova.ts');
          return callBedrockNova('mistral', p, { maxTokens: 8192, temperature: 0.3 });
        }
        case 'claude-sonnet': case 'claude': {
          const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
          if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured');
          const resp = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
            body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 8192, messages: [{ role: 'user', content: p }] }),
          });
          if (!resp.ok) throw new Error(`Anthropic API error ${resp.status}`);
          const data = await resp.json();
          return data?.content?.[0]?.text || '';
        }
        case 'lovable-gemini': {
          const apiKey = Deno.env.get('LOVABLE_API_KEY');
          if (!apiKey) throw new Error('LOVABLE_API_KEY not configured');
          const resp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
            method: 'POST',
            headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: 'google/gemini-2.5-flash', messages: [{ role: 'user', content: p }], max_tokens: 8192, temperature: 0.3 }),
          });
          if (!resp.ok) throw new Error(`Lovable AI error ${resp.status}`);
          const data = await resp.json();
          return data?.choices?.[0]?.message?.content || '';
        }
        case 'gpt5': case 'gpt5-mini': case 'openai': {
          const apiKey = Deno.env.get('LOVABLE_API_KEY');
          if (!apiKey) throw new Error('LOVABLE_API_KEY not configured');
          const gwModel = selectedModel === 'gpt5-mini' ? 'openai/gpt-5-mini' : 'openai/gpt-5';
          const resp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
            method: 'POST',
            headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: gwModel, messages: [{ role: 'user', content: p }], max_tokens: 8192, temperature: 0.3 }),
          });
          if (!resp.ok) throw new Error(`Lovable AI error ${resp.status}`);
          const data = await resp.json();
          return data?.choices?.[0]?.message?.content || '';
        }
        default:
          throw new Error(`Unsupported AI model: "${selectedModel}". No fallback allowed. Select a supported model from the dropdown.`);
      }
    }

    try {
      raw = await callSelectedModel(prompt);
    } catch (aiErr) {
      const msg = aiErr instanceof Error ? aiErr.message : String(aiErr);
      if (msg.startsWith('VERTEX_TIMEOUT') || /timeout/i.test(msg)) {
        console.warn(`[COMPLIANCE] AI timed out (${selectedModel}) for "${title}"`);
        return new Response(JSON.stringify({ fixes: [], truncated: false, parseError: false, recoveryAttempted: false, timedOut: true }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      throw aiErr;
    }

    console.log(`[COMPLIANCE] Raw response length: ${raw.length} chars`);

    // Strip markdown fences
    raw = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    // Strip leading non-JSON text (some models prepend explanatory text)
    const arrayStart = raw.indexOf('[');
    if (arrayStart > 0 && arrayStart < 100) {
      raw = raw.substring(arrayStart);
    }

    // Strip trailing non-JSON text after the closing bracket
    const arrayEnd = raw.lastIndexOf(']');
    if (arrayEnd > 0 && arrayEnd < raw.length - 1) {
      raw = raw.substring(0, arrayEnd + 1);
    }

    let truncated = false;
    let parseError = false;
    let recoveryAttempted = false;

    // Truncation detection: valid JSON array must end with ]
    const trimmed = raw.trimEnd();
    if (!trimmed.endsWith(']')) {
      console.log(`[COMPLIANCE] Truncation detected — response does not end with ']'`);
      truncated = true;

      const recovery = attemptTruncationRecovery(raw);
      if (recovery.recovered) {
        console.log(`[COMPLIANCE] Recovery attempted — salvaged ~${recovery.itemCount} objects`);
        raw = recovery.recovered;
        recoveryAttempted = true;
      } else {
        console.log(`[COMPLIANCE] Recovery failed — no complete objects found`);
        parseError = true;
      }
    }

    let parsed: any[] = [];
    if (!parseError) {
      try {
        parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) {
          console.log(`[COMPLIANCE] Parse produced non-array type: ${typeof parsed}`);
          parsed = [];
          parseError = true;
        }
      } catch (e) {
        console.log(`[COMPLIANCE] JSON.parse failed: ${(e as Error).message}`);
        parseError = true;
        parsed = [];
      }
    }

    // Normalize each fix with whitelist enforcement
    const fixes = parsed.map(normalizeFix).filter(f => f.issueLabel !== 'Unknown issue' || f.explanation);

    console.log(`[COMPLIANCE] Result: ${fixes.length} fixes, truncated=${truncated}, parseError=${parseError}, recoveryAttempted=${recoveryAttempted}`);

    return new Response(JSON.stringify({ fixes, truncated, parseError, recoveryAttempted, timedOut }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('analyze-blog-compliance-fixes error:', err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
