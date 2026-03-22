/**
 * Source 3: Firecrawl Ingest Edge Function
 * Phase 3 — Discovery + Bucketing + Field Extraction. Supports:
 *   - test-source: scrape a single source and return preview
 *   - list-sources: list all registered Firecrawl sources
 *   - run-source: scrape + stage seed page content
 *   - discover-source: scrape seed → extract links → filter → classify → stage candidates
 *   - source-stats: get discovery statistics for a source
 *   - extract-item: clean + extract fields from a single staged recruitment item → draft job
 *   - extract-batch: extract fields from multiple staged recruitment items for a source
 *
 * Completely isolated from Source 1 (rss-ingest) and Source 2 (Employment News).
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { scrapePage, mapUrl, generateContentHash } from '../_shared/firecrawl/client.ts';
import { normalizeUrl, filterAndClassifyUrls, type UrlFilterConfig } from '../_shared/firecrawl/url-filter.ts';
import { classifyPage, type PageBucket } from '../_shared/firecrawl/page-classifier.ts';
import { cleanScrapedContent } from '../_shared/firecrawl/content-cleaner.ts';
import { extractFields } from '../_shared/firecrawl/field-extractor.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/** Max detail pages to scrape per discover run (cost control) */
const MAX_DETAIL_SCRAPES_PER_RUN = 5;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action as string;

    if (!action) return jsonResponse({ error: 'Missing action parameter' }, 400);

    const authResult = await checkAdmin(req, supabaseUrl, serviceRoleKey);
    if (!authResult.authorized) return jsonResponse({ error: authResult.error }, 401);

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    switch (action) {
      case 'test-source':
        return await handleTestSource(body, adminClient);
      case 'list-sources':
        return await handleListSources(adminClient);
      case 'run-source':
        return await handleRunSource(body, adminClient);
      case 'discover-source':
        return await handleDiscoverSource(body, adminClient);
      case 'source-stats':
        return await handleSourceStats(body, adminClient);
      case 'extract-item':
        return await handleExtractItem(body, adminClient);
      case 'extract-batch':
        return await handleExtractBatch(body, adminClient);
      default:
        return jsonResponse({ error: `Unknown action: ${action}` }, 400);
    }
  } catch (e) {
    console.error('[firecrawl-ingest] Unhandled error:', e);
    return jsonResponse({ error: e instanceof Error ? e.message : 'Internal error' }, 500);
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

  if (sourceId) {
    const { data } = await client.from('firecrawl_sources').select('*').eq('id', sourceId).single();
    if (!data) return jsonResponse({ error: 'Source not found' }, 404);
    source = data;
    seedUrl = data.seed_url;
  }

  if (!seedUrl) return jsonResponse({ error: 'seed_url or source_id required' }, 400);

  console.log(`[firecrawl-ingest] test-source: ${seedUrl}`);

  const scrapeResult = await scrapePage(seedUrl, { formats: ['markdown', 'links'], onlyMainContent: true });

  if (!scrapeResult.success) {
    return jsonResponse({ success: false, error: scrapeResult.error, mode: 'scrape' });
  }

  // Apply discovery pipeline preview (no DB writes)
  const filterConfig: UrlFilterConfig = {
    allowedDomains: source?.allowed_domains || [],
    allowedUrlPatterns: source?.allowed_url_patterns || [],
    blockedUrlPatterns: source?.blocked_url_patterns || [],
    maxUrls: 100,
  };

  const discoveredLinks = scrapeResult.links || [];
  const filtered = filterAndClassifyUrls(discoveredLinks, filterConfig);
  const accepted = filtered.filter(f => f.accepted);
  const rejected = filtered.filter(f => !f.accepted);

  // Classify accepted URLs into buckets
  const classified = accepted.map(f => {
    const classification = classifyPage(f.normalized, null);
    return { url: f.url, normalized: f.normalized, ...classification };
  });

  const bucketCounts: Record<string, number> = {};
  for (const c of classified) {
    bucketCounts[c.bucket] = (bucketCounts[c.bucket] || 0) + 1;
  }

  return jsonResponse({
    success: true,
    mode: 'test-discovery',
    seedUrl,
    pageTitle: scrapeResult.metadata?.title,
    totalLinksFound: discoveredLinks.length,
    accepted: accepted.length,
    rejected: rejected.length,
    bucketCounts,
    classifiedSample: classified.slice(0, 15),
    rejectedSample: rejected.slice(0, 10).map(r => ({
      url: r.url, reason: r.rejectReason, rejectSignals: r.rejectSignals,
    })),
  });
}

// ============ run-source (Phase 1: simple scrape + stage) ============

async function handleRunSource(
  body: Record<string, unknown>,
  client: ReturnType<typeof createClient>
) {
  const sourceId = body.source_id as string;
  if (!sourceId) return jsonResponse({ error: 'source_id required' }, 400);

  const { data: source } = await client.from('firecrawl_sources').select('*').eq('id', sourceId).single();
  if (!source) return jsonResponse({ error: 'Source not found' }, 404);

  console.log(`[firecrawl-ingest] run-source: ${source.source_name} (${source.seed_url})`);

  const { data: run } = await client
    .from('firecrawl_fetch_runs')
    .insert({ firecrawl_source_id: source.id, run_mode: 'manual_admin', status: 'running' })
    .select('id').single();
  const runId = run?.id;

  try {
    const scrapeResult = await scrapePage(source.seed_url, { formats: ['markdown', 'links'], onlyMainContent: true });

    if (!scrapeResult.success) {
      const errMsg = scrapeResult.error || 'Scrape failed';
      if (runId) await finalizeRun(client, runId, 'error', { errorLog: errMsg });
      await updateSourceAfterFetch(client, source.id, errMsg);
      return jsonResponse({ success: false, error: errMsg });
    }

    let itemsNew = 0, itemsSkipped = 0;

    if (scrapeResult.markdown) {
      const contentHash = await generateContentHash(scrapeResult.markdown);
      const norm = normalizeUrl(source.seed_url);
      const classification = classifyPage(source.seed_url, scrapeResult.metadata?.title);

      const { error: insertError } = await client
        .from('firecrawl_staged_items')
        .upsert({
          firecrawl_source_id: source.id,
          fetch_run_id: runId,
          page_url: source.seed_url,
          url_normalized: norm,
          page_title: scrapeResult.metadata?.title || null,
          extracted_markdown: scrapeResult.markdown.substring(0, 100_000),
          extracted_links: scrapeResult.links?.slice(0, 500) || [],
          metadata: scrapeResult.metadata || {},
          content_hash: contentHash,
          status: 'staged',
          bucket: classification.bucket,
          classification_reason: classification.reason,
          classification_signals: classification.signals,
          discovered_from_url: source.seed_url,
        }, { onConflict: 'firecrawl_source_id,content_hash', ignoreDuplicates: true });

      if (insertError?.code === '23505') itemsSkipped++;
      else if (insertError) console.error('[firecrawl-ingest] Stage insert error:', insertError);
      else itemsNew++;
    }

    if (runId) await finalizeRun(client, runId, 'success', {
      pagesFetched: 1, itemsFound: scrapeResult.links?.length || 0, itemsNew, itemsSkipped,
    });
    await updateSourceAfterFetch(client, source.id, null, itemsNew);

    return jsonResponse({ success: true, itemsNew, itemsSkipped });
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e);
    if (runId) await finalizeRun(client, runId, 'error', { errorLog: errMsg });
    await updateSourceAfterFetch(client, source.id, errMsg);
    return jsonResponse({ success: false, error: errMsg }, 500);
  }
}

// ============ discover-source (Phase 2: full discovery pipeline) ============

async function handleDiscoverSource(
  body: Record<string, unknown>,
  client: ReturnType<typeof createClient>
) {
  const sourceId = body.source_id as string;
  if (!sourceId) return jsonResponse({ error: 'source_id required' }, 400);

  const { data: source } = await client.from('firecrawl_sources').select('*').eq('id', sourceId).single();
  if (!source) return jsonResponse({ error: 'Source not found' }, 404);

  const maxDetailScrapes = Math.min(
    (body.max_detail_scrapes as number) || MAX_DETAIL_SCRAPES_PER_RUN,
    source.max_pages_per_run || 10
  );

  console.log(`[firecrawl-ingest] discover-source: ${source.source_name} (max_detail: ${maxDetailScrapes})`);

  const { data: run } = await client
    .from('firecrawl_fetch_runs')
    .insert({ firecrawl_source_id: source.id, run_mode: 'manual_admin', status: 'running' })
    .select('id').single();
  const runId = run?.id;

  const stats = {
    pagesScraped: 0,
    linksDiscovered: 0,
    accepted: 0,
    rejected: 0,
    staged: 0,
    duplicateUrls: 0,
    errors: 0,
    bucketCounts: {} as Record<string, number>,
  };

  try {
    // Step 1: Scrape the seed/listing page
    const seedResult = await scrapePage(source.seed_url, { formats: ['markdown', 'links'], onlyMainContent: true });

    if (!seedResult.success) {
      const errMsg = seedResult.error || 'Seed page scrape failed';
      if (runId) await finalizeRun(client, runId, 'error', { errorLog: errMsg });
      await updateSourceAfterFetch(client, source.id, errMsg);
      return jsonResponse({ success: false, error: errMsg });
    }

    stats.pagesScraped++;
    const discoveredLinks = seedResult.links || [];
    stats.linksDiscovered = discoveredLinks.length;

    // Step 2: Load existing normalized URLs for this source to skip known duplicates
    const { data: existingItems } = await client
      .from('firecrawl_staged_items')
      .select('url_normalized')
      .eq('firecrawl_source_id', source.id)
      .not('url_normalized', 'is', null);

    const existingNormalized = new Set<string>(
      (existingItems || []).map((i: any) => i.url_normalized).filter(Boolean)
    );

    // Also add the seed URL itself
    const seedNorm = normalizeUrl(source.seed_url);
    if (seedNorm) existingNormalized.add(seedNorm);

    // Step 3: Filter and classify URLs
    const filterConfig: UrlFilterConfig = {
      allowedDomains: source.allowed_domains || [],
      allowedUrlPatterns: source.allowed_url_patterns || [],
      blockedUrlPatterns: source.blocked_url_patterns || [],
      maxUrls: 200,
    };

    const filtered = filterAndClassifyUrls(discoveredLinks, filterConfig, existingNormalized);
    const acceptedUrls = filtered.filter(f => f.accepted);
    const rejectedUrls = filtered.filter(f => !f.accepted);

    stats.accepted = acceptedUrls.length;
    stats.rejected = rejectedUrls.length;

    // Step 4: Classify accepted URLs into buckets
    const classifiedCandidates = acceptedUrls.map(f => ({
      ...f,
      classification: classifyPage(f.normalized, null),
    }));

    // Count buckets
    for (const c of classifiedCandidates) {
      const b = c.classification.bucket;
      stats.bucketCounts[b] = (stats.bucketCounts[b] || 0) + 1;
    }

    // Step 5: Pick top single_recruitment candidates for detail scraping (cost control)
    const recruitmentCandidates = classifiedCandidates
      .filter(c => c.classification.bucket === 'single_recruitment')
      .sort((a, b) => {
        // Prefer high confidence, then more signals
        const confOrder = { high: 3, medium: 2, low: 1 };
        return (confOrder[b.classification.confidence] - confOrder[a.classification.confidence])
          || (b.classification.signals.length - a.classification.signals.length);
      })
      .slice(0, maxDetailScrapes);

    // Step 6: Stage all classified candidates (URL-level, without scraping non-recruitment ones)
    for (const candidate of classifiedCandidates) {
      // Skip rejected bucket items
      if (candidate.classification.bucket === 'rejected') {
        stats.rejected++;
        continue;
      }

      try {
        const { error: insertError } = await client
          .from('firecrawl_staged_items')
          .insert({
            firecrawl_source_id: source.id,
            fetch_run_id: runId,
            page_url: candidate.url,
            url_normalized: candidate.normalized,
            page_title: null, // title not yet known (hasn't been scraped)
            extracted_markdown: null,
            extracted_links: [],
            metadata: {
              accept_signals: candidate.acceptSignals,
              reject_signals: candidate.rejectSignals,
            },
            content_hash: null,
            status: 'staged',
            bucket: candidate.classification.bucket,
            classification_reason: candidate.classification.reason,
            classification_signals: candidate.classification.signals,
            discovered_from_url: source.seed_url,
          });

        if (insertError) {
          if (insertError.code === '23505') stats.duplicateUrls++;
          else { console.error('[firecrawl-ingest] Stage error:', insertError.message); stats.errors++; }
        } else {
          stats.staged++;
        }
      } catch (e) {
        stats.errors++;
        console.error('[firecrawl-ingest] Candidate staging error:', e);
      }
    }

    // Step 7: Scrape top recruitment candidates for detail content
    const detailResults: any[] = [];

    for (const candidate of recruitmentCandidates) {
      try {
        const detailResult = await scrapePage(candidate.normalized, {
          formats: ['markdown', 'links'],
          onlyMainContent: true,
        });

        stats.pagesScraped++;

        if (detailResult.success && detailResult.markdown) {
          const contentHash = await generateContentHash(detailResult.markdown);

          // Update the staged item with scraped content
          await client
            .from('firecrawl_staged_items')
            .update({
              page_title: detailResult.metadata?.title || null,
              extracted_markdown: detailResult.markdown.substring(0, 100_000),
              extracted_links: detailResult.links?.slice(0, 200) || [],
              content_hash: contentHash,
              metadata: {
                ...detailResult.metadata,
                accept_signals: candidate.acceptSignals,
              },
            })
            .eq('firecrawl_source_id', source.id)
            .eq('url_normalized', candidate.normalized);

          // Re-classify with title now available
          const refined = classifyPage(candidate.normalized, detailResult.metadata?.title);
          if (refined.bucket !== candidate.classification.bucket) {
            await client
              .from('firecrawl_staged_items')
              .update({
                bucket: refined.bucket,
                classification_reason: refined.reason + ' (refined with title)',
                classification_signals: refined.signals,
              })
              .eq('firecrawl_source_id', source.id)
              .eq('url_normalized', candidate.normalized);
          }

          detailResults.push({
            url: candidate.normalized,
            title: detailResult.metadata?.title,
            bucket: refined.bucket,
            contentLength: detailResult.markdown.length,
            confidence: refined.confidence,
          });
        } else {
          detailResults.push({
            url: candidate.normalized,
            error: detailResult.error || 'No content',
          });
          stats.errors++;
        }
      } catch (e) {
        stats.errors++;
        console.error(`[firecrawl-ingest] Detail scrape error for ${candidate.normalized}:`, e);
        detailResults.push({ url: candidate.normalized, error: String(e) });
      }
    }

    // Finalize
    const runStatus = stats.errors > 0 ? 'partial' : 'success';
    if (runId) await finalizeRun(client, runId, runStatus, {
      pagesFetched: stats.pagesScraped,
      itemsFound: stats.linksDiscovered,
      itemsNew: stats.staged,
      itemsSkipped: stats.duplicateUrls,
      pagesAccepted: stats.accepted,
      pagesRejected: stats.rejected,
      bucketCounts: stats.bucketCounts,
      errorLog: stats.errors > 0 ? `${stats.errors} errors during discovery` : null,
    });

    await updateSourceAfterFetch(client, source.id, null, stats.staged);

    return jsonResponse({
      success: true,
      stats,
      detailResults,
    });
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e);
    if (runId) await finalizeRun(client, runId, 'error', { errorLog: errMsg });
    await updateSourceAfterFetch(client, source.id, errMsg);
    return jsonResponse({ success: false, error: errMsg }, 500);
  }
}

// ============ source-stats ============

async function handleSourceStats(
  body: Record<string, unknown>,
  client: ReturnType<typeof createClient>
) {
  const sourceId = body.source_id as string;
  if (!sourceId) return jsonResponse({ error: 'source_id required' }, 400);

  const { data: source } = await client
    .from('firecrawl_sources')
    .select('id, source_name, seed_url, last_fetched_at, last_success_at, last_error, total_items_found')
    .eq('id', sourceId)
    .single();

  if (!source) return jsonResponse({ error: 'Source not found' }, 404);

  // Bucket counts
  const { data: bucketData } = await client
    .from('firecrawl_staged_items')
    .select('bucket, status')
    .eq('firecrawl_source_id', sourceId);

  const bucketCounts: Record<string, number> = {};
  const statusCounts: Record<string, number> = {};
  for (const item of (bucketData || [])) {
    bucketCounts[item.bucket] = (bucketCounts[item.bucket] || 0) + 1;
    statusCounts[item.status] = (statusCounts[item.status] || 0) + 1;
  }

  // Recent runs
  const { data: recentRuns } = await client
    .from('firecrawl_fetch_runs')
    .select('id, run_mode, status, started_at, finished_at, pages_fetched, items_found, items_new, items_skipped, pages_accepted, pages_rejected, bucket_counts, error_log')
    .eq('firecrawl_source_id', sourceId)
    .order('started_at', { ascending: false })
    .limit(5);

  return jsonResponse({
    success: true,
    source,
    totalStaged: bucketData?.length || 0,
    bucketCounts,
    statusCounts,
    recentRuns: recentRuns || [],
  });
}

// ============ Helpers ============

async function finalizeRun(
  client: ReturnType<typeof createClient>,
  runId: string,
  status: string,
  data: {
    pagesFetched?: number;
    itemsFound?: number;
    itemsNew?: number;
    itemsSkipped?: number;
    pagesAccepted?: number;
    pagesRejected?: number;
    bucketCounts?: Record<string, number>;
    errorLog?: string | null;
    responseSample?: unknown;
  }
) {
  await client.from('firecrawl_fetch_runs').update({
    status,
    finished_at: new Date().toISOString(),
    pages_fetched: data.pagesFetched || 0,
    items_found: data.itemsFound || 0,
    items_new: data.itemsNew || 0,
    items_skipped: data.itemsSkipped || 0,
    pages_accepted: data.pagesAccepted || 0,
    pages_rejected: data.pagesRejected || 0,
    bucket_counts: data.bucketCounts || {},
    error_log: data.errorLog || null,
    raw_response_sample: data.responseSample || null,
  }).eq('id', runId);
}

async function updateSourceAfterFetch(
  client: ReturnType<typeof createClient>,
  sourceId: string,
  error: string | null,
  newItems?: number
) {
  const update: any = {
    last_fetched_at: new Date().toISOString(),
    last_error: error,
  };
  if (!error) {
    update.last_success_at = new Date().toISOString();
  }
  if (newItems) {
    // Use raw SQL for increment — but simpler to just re-read
    const { data: src } = await client.from('firecrawl_sources').select('total_items_found').eq('id', sourceId).single();
    update.total_items_found = (src?.total_items_found || 0) + newItems;
  }
  await client.from('firecrawl_sources').update(update).eq('id', sourceId);
}

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
