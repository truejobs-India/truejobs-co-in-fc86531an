// Blog compliance analysis — Vertex AI Gemini
// Uses shared Vertex AI helper

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

// ── Server-side normalization whitelists ──
const VALID_FIX_TYPES = new Set([
  'metadata', 'content-block', 'rewrite', 'advisory',
  'canonical_url', 'slug', 'meta_description', 'image_alt',
  'faq', 'intro', 'conclusion', 'trust_signal',
  'affiliate_links', 'internal_links', 'content_rewrite',
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
  if (fixType === 'metadata' && field && !EDITABLE_FIELDS.has(field)) {
    // Non-editable field → suggestion only
    applyMode = 'advisory';
  }

  return { issueKey, issueLabel, priority, fixType, field, suggestedValue, explanation, applyMode, targetSnippet, confidence };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authResult = await verifyAdmin(req);
    if (authResult instanceof Response) return authResult;

    // No GEMINI_API_KEY needed — uses Vertex AI via shared helper

    const { title, content, issues, slug, existingMeta } = await req.json();
    if (!title || !issues || !Array.isArray(issues)) {
      return new Response(JSON.stringify({ error: 'title and issues[] required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const plainText = (content || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 2000);
    const issueList = issues.map((i: any) => `- ${i.label}: ${i.detail}${i.recommendation ? ` (${i.recommendation})` : ''}`).join('\n');

    // Build existing metadata context for the AI
    const meta = existingMeta || {};
    const headingsList = Array.isArray(meta.headings)
      ? meta.headings.map((h: any) => `  H${h.level}: ${h.text}`).join('\n')
      : '(no headings data)';

    const metaContext = [
      `Current meta_title: ${meta.meta_title || '(empty)'}`,
      `Current meta_description: ${meta.meta_description || '(empty)'}`,
      `Current excerpt: ${meta.excerpt || '(empty)'}`,
      `Current featured_image_alt: ${meta.featured_image_alt || '(empty)'}`,
      `Current author_name: ${meta.author_name || '(empty)'}`,
      `Current canonical_url: ${meta.canonical_url || '(empty)'}`,
      `Has cover image: ${meta.hasCoverImage ? 'yes' : 'no'}`,
      `Has featured image: ${meta.featured_image ? 'yes' : 'no'}`,
      `Has intro: ${meta.hasIntro ? 'yes' : 'no'}`,
      `Has conclusion: ${meta.hasConclusion ? 'yes' : 'no'}`,
      `Word count: ${meta.wordCount ?? 'unknown'}`,
      `FAQ count: ${meta.faqCount ?? 0}`,
      `Internal link count: ${meta.internalLinkCount ?? 0}`,
      `Headings:\n${headingsList}`,
    ].join('\n');

    const prompt = `You are an editorial compliance expert for TrueJobs.co.in, an Indian government job portal.
The following compliance issues were detected in a blog article. For each issue, provide a SPECIFIC, ACTIONABLE fix with concrete values.

Article title: ${title}
Article slug: ${slug || 'unknown'}
Article excerpt: ${plainText}

Current article metadata:
${metaContext}

Issues detected:
${issueList}

For each issue, return a structured fix object:
- issueKey: short machine key (e.g., "missing-meta-title", "weak-trust-signals")
- issueLabel: human-readable issue name
- priority: "high", "medium", or "low"
- fixType: one of "metadata" (for editable fields), "content-block" (for content to append/prepend), "rewrite" (for content replacement), "advisory" (for manual guidance), "canonical_url", "slug", "meta_description", "image_alt", "faq", "intro", "conclusion", "trust_signal", "affiliate_links", "internal_links", "content_rewrite"
- field: the target field name if fixType is "metadata". Use ONLY these field names: meta_title, meta_description, excerpt, featured_image_alt, author_name, canonical_url, slug. For non-editable fields, use fixType "advisory" instead.
- suggestedValue: the EXACT value to use (complete meta title text, full meta description, HTML block, etc.)
- explanation: why this fix is needed (1 sentence)
- applyMode: one of "apply_field" (for metadata field updates), "append_content" (for content to append at end), "prepend_content" (for content at start), "insert_before_first_heading" (for intro before first H1/H2), "replace_section" (for replacing a section), "review_replacement" (for reviewed replacement), or "advisory" (for manual guidance)
- targetSnippet: (optional, for rewrite/replace types only) the original text snippet to be replaced
- confidence: "high", "medium", or "low"

IMPORTANT RULES:
- For canonical_url fixes: the value should be https://truejobs.co.in/blog/{cleaned-slug} (no double slashes)
- For slug fixes: lowercase, hyphens only, no trailing hyphens
- For meta_description: target 140-155 characters
- For intro fixes: use applyMode "insert_before_first_heading"
- For conclusion fixes: use applyMode "append_content"
- For trust signal fixes: use applyMode "review_replacement"
- For affiliate link fixes: use applyMode "advisory"
- For metadata fixes, provide the COMPLETE ready-to-use value
- For content-block fixes, provide actual HTML to append/prepend
- For rewrite fixes, include both targetSnippet and suggestedValue
- For advisory fixes, provide clear manual instructions
- Meta titles must be under 60 characters
- Maintain informational, non-official tone appropriate for TrueJobs.co.in

Return ONLY a JSON array: [{ ... }]
No markdown code blocks.`;

    const resp = await fetch(`${GEMINI_URL}?key=${geminiApiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 4000, temperature: 0.3 },
      }),
    });
    if (!resp.ok) throw new Error(`Gemini API error ${resp.status}`);
    const data = await resp.json();
    let raw = data?.candidates?.[0]?.content?.parts?.[0]?.text || '[]';
    raw = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    let parsed: any[];
    try {
      parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) parsed = [];
    } catch {
      parsed = [];
    }

    // Normalize each fix with whitelist enforcement
    const fixes = parsed.map(normalizeFix).filter(f => f.issueLabel !== 'Unknown issue' || f.explanation);

    return new Response(JSON.stringify({ fixes }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    console.error('analyze-blog-compliance-fixes error:', err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
