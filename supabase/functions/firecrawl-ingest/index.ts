/**
 * Source 3: Firecrawl Ingest Edge Function
 * Phase 1 — Foundation only. Supports:
 *   - test-source: scrape a single source and return preview (no DB writes to production)
 *   - list-sources: list all registered Firecrawl sources
 * 
 * Completely isolated from Source 1 (rss-ingest) and Source 2 (Employment News).
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { scrapePage, mapUrl, generateContentHash } from '../_shared/firecrawl/client.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action as string;

    if (!action) {
      return jsonResponse({ error: 'Missing action parameter' }, 400);
    }

    // Auth: require admin JWT for all actions
    const authResult = await checkAdmin(req, supabaseUrl, serviceRoleKey);
    if (!authResult.authorized) {
      return jsonResponse({ error: authResult.error }, 401);
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    switch (action) {
      case 'test-source':
        return await handleTestSource(body, adminClient);
      case 'list-sources':
        return await handleListSources(adminClient);
      case 'run-source':
        return await handleRunSource(body, adminClient);
      default:
        return jsonResponse({ error: `Unknown action: ${action}` }, 400);
    }
  } catch (e) {
    console.error('[firecrawl-ingest] Unhandled error:', e);
    return jsonResponse(
      { error: e instanceof Error ? e.message : 'Internal error' },
      500
    );
  }
});

// ============ Auth ============

async function checkAdmin(
  req: Request,
  supabaseUrl: string,
  serviceRoleKey: string
): Promise<{ authorized: boolean; error?: string }> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return { authorized: false, error: 'Missing Authorization header' };

  const token = authHeader.replace('Bearer ', '');
  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const { data: { user }, error } = await supabase.auth.getUser(token);

  if (error || !user) return { authorized: false, error: 'Invalid or expired token' };

  const { data: roleData } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .eq('role', 'admin')
    .maybeSingle();

  if (!roleData) return { authorized: false, error: 'Admin role required' };
  return { authorized: true };
}

// ============ list-sources ============

async function handleListSources(client: ReturnType<typeof createClient>) {
  const { data, error } = await client
    .from('firecrawl_sources')
    .select('id, source_name, seed_url, source_type, is_enabled, priority, crawl_mode, extraction_mode, default_bucket, last_fetched_at, last_error, total_items_found')
    .order('priority', { ascending: true })
    .order('source_name', { ascending: true });

  if (error) return jsonResponse({ error: error.message }, 500);
  return jsonResponse({ success: true, sources: data, count: data?.length || 0 });
}

// ============ test-source ============

async function handleTestSource(
  body: Record<string, unknown>,
  client: ReturnType<typeof createClient>
) {
  let seedUrl = body.seed_url as string | undefined;
  const sourceId = body.source_id as string | undefined;
  let source: any = null;

  // Resolve source config
  if (sourceId) {
    const { data } = await client
      .from('firecrawl_sources')
      .select('*')
      .eq('id', sourceId)
      .single();
    if (!data) return jsonResponse({ error: 'Source not found' }, 404);
    source = data;
    seedUrl = data.seed_url;
  }

  if (!seedUrl) return jsonResponse({ error: 'seed_url or source_id required' }, 400);

  console.log(`[firecrawl-ingest] test-source: ${seedUrl}`);

  const crawlMode = (source?.crawl_mode || body.crawl_mode || 'scrape') as string;

  // Create a test run record
  let runId: string | undefined;
  if (source) {
    const { data: run } = await client
      .from('firecrawl_fetch_runs')
      .insert({
        firecrawl_source_id: source.id,
        run_mode: 'test',
        status: 'running',
      })
      .select('id')
      .single();
    runId = run?.id;
  }

  try {
    if (crawlMode === 'map') {
      // Map mode: discover URLs
      const mapResult = await mapUrl(seedUrl, {
        limit: body.map_limit as number || 50,
      });

      if (!mapResult.success) {
        if (runId) await finalizeRun(client, runId, 'error', 0, 0, 0, 0, mapResult.error || 'Map failed');
        return jsonResponse({ success: false, error: mapResult.error, mode: 'map' });
      }

      const links = mapResult.links || [];

      // Apply URL filters if source has them
      const filteredLinks = source
        ? filterUrls(links, source.allowed_url_patterns, source.blocked_url_patterns)
        : links;

      if (runId) await finalizeRun(client, runId, 'success', links.length, filteredLinks.length, 0, 0, null, { totalDiscovered: links.length, sampleLinks: filteredLinks.slice(0, 10) });

      return jsonResponse({
        success: true,
        mode: 'map',
        totalDiscovered: links.length,
        filteredCount: filteredLinks.length,
        sampleLinks: filteredLinks.slice(0, 20),
      });
    }

    // Default: scrape mode
    const scrapeResult = await scrapePage(seedUrl, {
      formats: ['markdown', 'links'],
      onlyMainContent: true,
    });

    if (!scrapeResult.success) {
      if (runId) await finalizeRun(client, runId, 'error', 0, 0, 0, 0, scrapeResult.error || 'Scrape failed');
      return jsonResponse({ success: false, error: scrapeResult.error, mode: 'scrape' });
    }

    const contentHash = scrapeResult.markdown
      ? await generateContentHash(scrapeResult.markdown)
      : null;

    const linkCount = scrapeResult.links?.length || 0;
    const filteredLinks = source && scrapeResult.links
      ? filterUrls(scrapeResult.links, source.allowed_url_patterns, source.blocked_url_patterns)
      : scrapeResult.links || [];

    if (runId) await finalizeRun(client, runId, 'success', 1, linkCount, 0, 0, null, {
      pageTitle: scrapeResult.metadata?.title,
      contentLength: scrapeResult.markdown?.length,
      linkCount,
    });

    return jsonResponse({
      success: true,
      mode: 'scrape',
      pageTitle: scrapeResult.metadata?.title,
      contentPreview: scrapeResult.markdown?.substring(0, 1000),
      contentLength: scrapeResult.markdown?.length || 0,
      contentHash,
      totalLinks: linkCount,
      filteredLinks: filteredLinks.slice(0, 20),
      metadata: scrapeResult.metadata,
    });
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e);
    if (runId) await finalizeRun(client, runId, 'error', 0, 0, 0, 0, errMsg);
    return jsonResponse({ success: false, error: errMsg }, 500);
  }
}

// ============ run-source (Phase 1: scrape + stage) ============

async function handleRunSource(
  body: Record<string, unknown>,
  client: ReturnType<typeof createClient>
) {
  const sourceId = body.source_id as string;
  if (!sourceId) return jsonResponse({ error: 'source_id required' }, 400);

  const { data: source } = await client
    .from('firecrawl_sources')
    .select('*')
    .eq('id', sourceId)
    .single();

  if (!source) return jsonResponse({ error: 'Source not found' }, 404);

  console.log(`[firecrawl-ingest] run-source: ${source.source_name} (${source.seed_url})`);

  // Create run record
  const { data: run } = await client
    .from('firecrawl_fetch_runs')
    .insert({
      firecrawl_source_id: source.id,
      run_mode: 'manual_admin',
      status: 'running',
    })
    .select('id')
    .single();

  const runId = run?.id;

  try {
    // Step 1: Scrape the seed URL
    const scrapeResult = await scrapePage(source.seed_url, {
      formats: ['markdown', 'links'],
      onlyMainContent: true,
    });

    if (!scrapeResult.success) {
      const errMsg = scrapeResult.error || 'Scrape failed';
      if (runId) await finalizeRun(client, runId, 'error', 0, 0, 0, 0, errMsg);
      await client.from('firecrawl_sources').update({
        last_fetched_at: new Date().toISOString(),
        last_error: errMsg,
      }).eq('id', source.id);
      return jsonResponse({ success: false, error: errMsg });
    }

    // Step 2: Stage the scraped content
    let itemsNew = 0;
    let itemsSkipped = 0;

    if (scrapeResult.markdown) {
      const contentHash = await generateContentHash(scrapeResult.markdown);

      const { error: insertError } = await client
        .from('firecrawl_staged_items')
        .upsert({
          firecrawl_source_id: source.id,
          fetch_run_id: runId,
          page_url: source.seed_url,
          page_title: scrapeResult.metadata?.title || null,
          extracted_markdown: scrapeResult.markdown.substring(0, 100_000),
          extracted_links: scrapeResult.links?.slice(0, 500) || [],
          metadata: scrapeResult.metadata || {},
          content_hash: contentHash,
          status: 'staged',
        }, {
          onConflict: 'firecrawl_source_id,content_hash',
          ignoreDuplicates: true,
        });

      if (insertError) {
        if (insertError.code === '23505') {
          itemsSkipped++;
        } else {
          console.error('[firecrawl-ingest] Stage insert error:', insertError);
        }
      } else {
        itemsNew++;
      }
    }

    // Finalize
    if (runId) await finalizeRun(client, runId, 'success', 1, scrapeResult.links?.length || 0, itemsNew, itemsSkipped, null);

    await client.from('firecrawl_sources').update({
      last_fetched_at: new Date().toISOString(),
      last_success_at: new Date().toISOString(),
      last_error: null,
      total_items_found: (source.total_items_found || 0) + itemsNew,
    }).eq('id', source.id);

    return jsonResponse({
      success: true,
      pageTitle: scrapeResult.metadata?.title,
      contentLength: scrapeResult.markdown?.length || 0,
      linksFound: scrapeResult.links?.length || 0,
      itemsNew,
      itemsSkipped,
    });
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e);
    if (runId) await finalizeRun(client, runId, 'error', 0, 0, 0, 0, errMsg);
    await client.from('firecrawl_sources').update({
      last_fetched_at: new Date().toISOString(),
      last_error: errMsg,
    }).eq('id', source.id);
    return jsonResponse({ success: false, error: errMsg }, 500);
  }
}

// ============ Helpers ============

function filterUrls(
  urls: string[],
  allowedPatterns: string[],
  blockedPatterns: string[]
): string[] {
  let filtered = urls;

  if (allowedPatterns && allowedPatterns.length > 0) {
    filtered = filtered.filter(url =>
      allowedPatterns.some(pattern => {
        try { return new RegExp(pattern).test(url); } catch { return url.includes(pattern); }
      })
    );
  }

  if (blockedPatterns && blockedPatterns.length > 0) {
    filtered = filtered.filter(url =>
      !blockedPatterns.some(pattern => {
        try { return new RegExp(pattern).test(url); } catch { return url.includes(pattern); }
      })
    );
  }

  return filtered;
}

async function finalizeRun(
  client: ReturnType<typeof createClient>,
  runId: string,
  status: string,
  pagesFetched: number,
  itemsFound: number,
  itemsNew: number,
  itemsSkipped: number,
  errorLog: string | null,
  responseSample?: unknown
) {
  await client.from('firecrawl_fetch_runs').update({
    status,
    finished_at: new Date().toISOString(),
    pages_fetched: pagesFetched,
    items_found: itemsFound,
    items_new: itemsNew,
    items_skipped: itemsSkipped,
    error_log: errorLog,
    raw_response_sample: responseSample || null,
  }).eq('id', runId);
}

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
