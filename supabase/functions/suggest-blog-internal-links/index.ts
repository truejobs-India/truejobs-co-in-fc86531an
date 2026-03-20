// Direct Gemini 2.5 API only for non-image AI features — does NOT use Lovable AI gateway
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

// ── Known safe paths — validated TrueJobs routes ──
const KNOWN_SAFE_PATHS: { path: string; topic: string; keywords: string[] }[] = [
  { path: '/ssc-cgl-2026-notification', topic: 'SSC CGL exam notification', keywords: ['ssc', 'cgl', 'combined graduate level'] },
  { path: '/ssc-chsl-2026-notification', topic: 'SSC CHSL exam notification', keywords: ['ssc', 'chsl', '12th pass', 'higher secondary'] },
  { path: '/upsc-cse-2026-notification', topic: 'UPSC Civil Services notification', keywords: ['upsc', 'civil services', 'ias', 'ips'] },
  { path: '/railway-jobs', topic: 'Railway jobs category', keywords: ['railway', 'rrb', 'rail', 'train'] },
  { path: '/banking-jobs', topic: 'Banking jobs category', keywords: ['bank', 'banking', 'ibps', 'sbi', 'rbi'] },
  { path: '/12th-pass-govt-jobs', topic: '12th pass government jobs', keywords: ['12th', 'intermediate', 'higher secondary', '10+2'] },
  { path: '/graduate-govt-jobs', topic: 'Graduate government jobs', keywords: ['graduate', 'degree', 'bachelor'] },
  { path: '/sarkari-result', topic: 'Government exam results', keywords: ['result', 'sarkari', 'merit', 'cutoff'] },
  { path: '/admit-card', topic: 'Admit card downloads', keywords: ['admit card', 'hall ticket', 'exam date'] },
  { path: '/answer-key', topic: 'Answer key releases', keywords: ['answer key', 'objection', 'response sheet'] },
  { path: '/govt-salary-calculator', topic: 'Government salary calculator tool', keywords: ['salary', 'pay scale', '7th pay', 'grade pay'] },
  { path: '/govt-job-age-calculator', topic: 'Age eligibility calculator', keywords: ['age', 'eligibility', 'age limit', 'relaxation'] },
  { path: '/10th-pass-govt-jobs', topic: '10th pass government jobs', keywords: ['10th', 'matric', 'ssc', 'high school'] },
  { path: '/defence-jobs', topic: 'Defence sector jobs', keywords: ['defence', 'army', 'navy', 'air force', 'military'] },
  { path: '/police-jobs', topic: 'Police recruitment jobs', keywords: ['police', 'constable', 'si', 'sub inspector'] },
  { path: '/teaching-jobs', topic: 'Teaching and education jobs', keywords: ['teacher', 'teaching', 'education', 'tet', 'ctet'] },
  { path: '/state-govt-jobs', topic: 'State government jobs', keywords: ['state', 'state govt', 'psc'] },
  { path: '/central-govt-jobs', topic: 'Central government jobs', keywords: ['central', 'central govt', 'upsc', 'ssc'] },
  { path: '/engineering-jobs', topic: 'Engineering sector jobs', keywords: ['engineering', 'engineer', 'technical'] },
  { path: '/medical-jobs', topic: 'Medical and health jobs', keywords: ['medical', 'health', 'doctor', 'nurse', 'aiims'] },
  { path: '/blog', topic: 'TrueJobs career blog', keywords: ['blog', 'article', 'guide', 'tips'] },
  { path: '/employment-news', topic: 'Employment news updates', keywords: ['employment news', 'rozgar', 'vacancy'] },
  { path: '/about', topic: 'About TrueJobs', keywords: ['about', 'truejobs'] },
];

// ── Path validation (server-side safety net) ──
const BLOCKED_EXTENSIONS = /\.(png|jpg|jpeg|webp|gif|svg|pdf|css|js|json|xml|mp4|mp3|zip|doc|docx|xls|xlsx)$/i;
const BLOCKED_SEGMENTS = ['/storage/', '/blog-assets/', '/covers/', '/api/', '/auth/', 'supabase.co', 'supabase.in'];
const BLOCKED_PREFIXES = ['http:', 'https:', '//', 'data:', 'javascript:', 'mailto:', 'tel:'];

function isValidPagePath(path: unknown): path is string {
  if (typeof path !== 'string') return false;
  const t = path.trim();
  if (!t || t.length < 2 || !t.startsWith('/') || t.startsWith('//')) return false;
  const lower = t.toLowerCase();
  for (const p of BLOCKED_PREFIXES) { if (lower.startsWith(p)) return false; }
  for (const s of BLOCKED_SEGMENTS) { if (lower.includes(s)) return false; }
  if (BLOCKED_EXTENSIONS.test(t)) return false;
  return true;
}

// ── Keyword fallback — picks from KNOWN_SAFE_PATHS only ──
function keywordFallback(title: string, content: string, slug: string, existingPaths: Set<string>): { path: string; anchorText: string; reason: string; sentenceTemplate: string; suggestedPlacement: string }[] {
  const text = `${title} ${content} ${slug}`.toLowerCase();
  const scored: { entry: typeof KNOWN_SAFE_PATHS[0]; score: number }[] = [];

  for (const entry of KNOWN_SAFE_PATHS) {
    if (existingPaths.has(entry.path)) continue;
    // Don't link article to its own blog page
    if (entry.path === `/blog/${slug}` || entry.path === `/${slug}`) continue;
    let score = 0;
    for (const kw of entry.keywords) {
      if (text.includes(kw)) score += 1;
    }
    if (score > 0) scored.push({ entry, score });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 4).map(({ entry }) => ({
    path: entry.path,
    anchorText: entry.topic.toLowerCase(),
    reason: `Keyword match: article content relates to ${entry.topic}`,
    sentenceTemplate: `For more details, check out our <a href="${entry.path}">${entry.topic.toLowerCase()}</a> page.`,
    suggestedPlacement: 'Near relevant section or at the end of the article',
  }));
}

// Vertex AI Gemini via shared helper

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authResult = await verifyAdmin(req);
    if (authResult instanceof Response) return authResult;

    const { title, content, category, tags, slug } = await req.json();
    if (!title) {
      return new Response(JSON.stringify({ error: 'title required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const plainText = (content || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 2000);
    const safePathList = KNOWN_SAFE_PATHS.map(p => `  - ${p.path} → ${p.topic}`).join('\n');

    const prompt = `You are an SEO internal linking expert for TrueJobs.co.in, an Indian government job portal.

Suggest 5-8 internal links for this blog article. You MUST choose from these validated site pages:

${safePathList}

You may also suggest /blog/[slug] paths if they are clearly relevant blog articles (e.g., /blog/ssc-cgl-preparation-tips).

CRITICAL RULES for path values:
- ONLY use paths from the list above, or /blog/[reasonable-slug] patterns
- Do NOT invent paths that are not in the list
- Do NOT return full URLs (no http: or https:)
- Do NOT return storage, asset, image, or API paths
- Every path must start with /

For each suggestion, provide:
- path: the relative URL path
- anchorText: natural anchor text (2-5 words)
- reason: why this link is relevant (1 sentence)
- sentenceTemplate: a complete sentence that naturally embeds the link, with the anchor text marked like: <a href="/path">anchor text</a>
- suggestedPlacement: where in the article this link fits best (e.g., "After the eligibility section", "In the introduction", "Near the conclusion")

Title: ${title}
Slug: ${slug || 'unknown'}
Category: ${category || 'General'}
Tags: ${(tags || []).join(', ') || 'none'}
Article excerpt: ${plainText}

Return ONLY a JSON array: [{"path": "...", "anchorText": "...", "reason": "...", "sentenceTemplate": "...", "suggestedPlacement": "..."}]
No markdown, no code blocks.`;

    const { callVertexGemini } = await import('../_shared/vertex-ai.ts');
    let raw = await callVertexGemini('gemini-2.5-flash', prompt, 60_000, {
      maxOutputTokens: 2000,
      temperature: 0.3,
    });
    raw = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    let parsed: any[];
    try {
      parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) parsed = [];
    } catch {
      parsed = [];
    }

    // Server-side validation: filter out any invalid paths
    const seen = new Set<string>();
    const suggestions: { path: string; anchorText: string; reason: string; sentenceTemplate: string; suggestedPlacement: string }[] = [];
    for (const s of parsed) {
      if (!s || typeof s !== 'object') continue;
      const path = typeof s.path === 'string' ? s.path.trim() : '';
      const anchorText = typeof s.anchorText === 'string' ? s.anchorText.trim() : '';
      if (!path || !anchorText) continue;
      if (!isValidPagePath(path)) continue;
      if (seen.has(path)) continue;
      seen.add(path);
      suggestions.push({
        path,
        anchorText,
        reason: typeof s.reason === 'string' ? s.reason.trim() : '',
        sentenceTemplate: typeof s.sentenceTemplate === 'string' ? s.sentenceTemplate.trim() : `Learn more about <a href="${path}">${anchorText}</a>.`,
        suggestedPlacement: typeof s.suggestedPlacement === 'string' ? s.suggestedPlacement.trim() : 'In a relevant section',
      });
    }

    // Fallback: if fewer than 2 valid suggestions, add keyword-based picks from KNOWN_SAFE_PATHS
    if (suggestions.length < 2) {
      const fallbacks = keywordFallback(title, plainText, slug || '', seen);
      for (const fb of fallbacks) {
        if (suggestions.length >= 6) break;
        if (seen.has(fb.path)) continue;
        seen.add(fb.path);
        suggestions.push(fb);
      }
    }

    return new Response(JSON.stringify({ suggestions: suggestions.slice(0, 8) }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    console.error('suggest-blog-internal-links error:', err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
