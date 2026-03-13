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

const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authResult = await verifyAdmin(req);
    if (authResult instanceof Response) return authResult;

    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiApiKey) {
      return new Response(JSON.stringify({ error: 'GEMINI_API_KEY not configured' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { title, content, category, tags } = await req.json();
    if (!title) {
      return new Response(JSON.stringify({ error: 'title required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const plainText = (content || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 2000);

    const prompt = `You are an SEO internal linking expert for TrueJobs.co.in, an Indian government job portal.

Suggest 5-8 internal links that should be added to this blog article. The site has pages like:
- /ssc-cgl-2026-notification, /ssc-chsl-2026-notification, /upsc-cse-2026-notification
- /railway-jobs, /banking-jobs, /12th-pass-govt-jobs, /graduate-govt-jobs
- /govt-salary-calculator, /govt-job-age-calculator
- /blog/[various-slugs]
- /sarkari-result, /admit-card, /answer-key

CRITICAL RULES for path values:
- Return ONLY relative page paths starting with / (e.g., /ssc-cgl-2026-notification)
- Do NOT return full URLs (no http: or https:)
- Do NOT return Supabase storage URLs or any storage paths
- Do NOT return image URLs, asset URLs, or media file paths
- Do NOT return paths ending in file extensions like .png, .jpg, .pdf, .svg, etc.
- Do NOT return /storage/, /blog-assets/, /covers/, /api/, or /auth/ paths
- Every path must be a navigable page on TrueJobs.co.in
- If you are not confident a path exists as a real page, omit it

For each suggestion, provide:
- path: the relative URL path (e.g., /ssc-cgl-2026-notification)
- anchorText: natural anchor text to use in the article
- reason: why this link is relevant

Title: ${title}
Category: ${category || 'General'}
Tags: ${(tags || []).join(', ')}
Article excerpt: ${plainText}

Return ONLY a JSON array: [{"path": "...", "anchorText": "...", "reason": "..."}]
No markdown, no code blocks.`;

    const resp = await fetch(`${GEMINI_URL}?key=${geminiApiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 1500, temperature: 0.3 },
      }),
    });
    if (!resp.ok) throw new Error(`Gemini API error ${resp.status}`);
    const data = await resp.json();
    let raw = data?.candidates?.[0]?.content?.parts?.[0]?.text || '[]';
    raw = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    let parsed: { path: string; anchorText: string; reason: string }[];
    try {
      parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) parsed = [];
    } catch {
      parsed = [];
    }

    // Server-side validation: filter out any invalid paths
    const seen = new Set<string>();
    const suggestions: { path: string; anchorText: string; reason: string }[] = [];
    for (const s of parsed) {
      if (!s || typeof s !== 'object') continue;
      const path = typeof s.path === 'string' ? s.path.trim() : '';
      const anchorText = typeof s.anchorText === 'string' ? s.anchorText.trim() : '';
      if (!path || !anchorText) continue;
      if (!isValidPagePath(path)) continue;
      if (seen.has(path)) continue;
      seen.add(path);
      suggestions.push({ path, anchorText, reason: typeof s.reason === 'string' ? s.reason.trim() : '' });
    }

    return new Response(JSON.stringify({ suggestions: suggestions.slice(0, 8) }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    console.error('suggest-blog-internal-links error:', err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
