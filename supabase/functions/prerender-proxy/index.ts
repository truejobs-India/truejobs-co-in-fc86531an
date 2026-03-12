/**
 * @deprecated — Emergency fallback only.
 * Primary rendering is now handled by the Cloudflare Worker + serve-public-page edge function.
 * This function remains as a fallback for Rendertron-based bot serving if the Worker layer fails.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BOT_USER_AGENTS = [
  'googlebot', 'adsbot-google', 'mediapartners-google', 'apis-google',
  'bingbot', 'facebookexternalhit', 'twitterbot', 'linkedinbot',
  'slurp', 'duckduckbot', 'baiduspider', 'yandexbot', 'ia_archiver',
  'whatsapp', 'telegrambot',
];

function isBot(userAgent: string): boolean {
  const ua = userAgent.toLowerCase();
  return BOT_USER_AGENTS.some(bot => ua.includes(bot));
}

function extractSlug(url: string): string {
  try {
    const u = new URL(url);
    const slug = u.pathname.replace(/^\//, '').replace(/\/$/, '');
    return slug;
  } catch {
    return url.replace(/^\//, '').replace(/\/$/, '');
  }
}

async function fetchFromRendertron(url: string): Promise<string | null> {
  const rendertronUrl = Deno.env.get('RENDERTRON_URL');
  if (!rendertronUrl) {
    console.error('RENDERTRON_URL secret not set');
    return null;
  }

  const renderEndpoint = `${rendertronUrl.replace(/\/$/, '')}/render/${url}`;
  console.log('Calling Rendertron:', renderEndpoint);

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(renderEndpoint, {
      signal: controller.signal,
      headers: { 'User-Agent': 'TrueJobs-Prerender/1.0' },
    });
    clearTimeout(timeout);

    if (!response.ok) {
      console.error('Rendertron returned status:', response.status);
      return null;
    }

    const html = await response.text();
    if (html.length < 500) {
      console.error('Rendertron returned too-short HTML:', html.length, 'chars');
      return null;
    }

    return html;
  } catch (err) {
    console.error('Rendertron fetch failed:', err.message);
    return null;
  }
}

async function cacheRendertronResult(slug: string, html: string): Promise<void> {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { error } = await supabase
      .from('seo_page_cache')
      .upsert(
        { slug, full_html: html, page_type: 'rendertron', updated_at: new Date().toISOString() },
        { onConflict: 'slug' }
      );

    if (error) {
      console.error('Failed to cache Rendertron result:', error.message);
    } else {
      console.log('Cached Rendertron result for slug:', slug);
    }
  } catch (err) {
    console.error('Cache upsert error:', err.message);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();
    const userAgent = req.headers.get('x-original-user-agent') || req.headers.get('user-agent') || '';

    if (!url) {
      return new Response(JSON.stringify({ error: 'Missing url parameter' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!isBot(userAgent)) {
      return new Response(JSON.stringify({ prerendered: false, reason: 'Not a bot' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Tier 1: Check database cache
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const slug = extractSlug(url);

    const { data, error } = await supabase
      .from('seo_page_cache')
      .select('full_html')
      .eq('slug', slug)
      .maybeSingle();

    if (!error && data) {
      return new Response(data.full_html, {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/html; charset=utf-8',
          'X-Prerendered': 'static-cache',
          'Cache-Control': 'public, max-age=3600',
        },
      });
    }

    // Tier 2: Call Rendertron live
    console.log('Cache miss for slug:', slug, '- calling Rendertron');
    const renderedHtml = await fetchFromRendertron(url);

    if (renderedHtml) {
      // Cache in background (don't block the response)
      EdgeRuntime?.waitUntil?.(cacheRendertronResult(slug, renderedHtml));

      return new Response(renderedHtml, {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/html; charset=utf-8',
          'X-Prerendered': 'rendertron',
          'Cache-Control': 'public, max-age=3600',
        },
      });
    }

    // Both tiers failed
    return new Response(JSON.stringify({
      prerendered: false,
      reason: 'No cached HTML and Rendertron failed',
      slug,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
