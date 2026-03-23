/**
 * Source 3: Firecrawl Ingest Edge Function
 * Phases 1-5 — Discovery + Bucketing + Field Extraction + Dedup + Validation.
 * Supports:
 *   - test-source, list-sources, run-source, discover-source, source-stats
 *   - extract-item, extract-batch
 *   - dedup-drafts (cross-source: firecrawl + rss_items + employment_news_jobs + jobs)
 *   - validate-for-approval
 *
 * Completely isolated from Source 1 (rss-ingest) and Source 2 (Employment News).
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { scrapePage, mapUrl, generateContentHash } from '../_shared/firecrawl/client.ts';
import { normalizeUrl, filterAndClassifyUrls, type UrlFilterConfig } from '../_shared/firecrawl/url-filter.ts';
import { classifyPage, type PageBucket } from '../_shared/firecrawl/page-classifier.ts';
import { cleanScrapedContent } from '../_shared/firecrawl/content-cleaner.ts';
import { extractFields } from '../_shared/firecrawl/field-extractor.ts';
import { checkDuplicate, type DedupCandidate } from '../_shared/firecrawl/dedup.ts';

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
      case 'dedup-drafts':
        return await handleDedupDrafts(body, adminClient);
      case 'validate-for-approval':
        return await handleValidateForApproval(body, adminClient);
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

// ============ run-source ============

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

// ============ discover-source ============

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

    const { data: existingItems } = await client
      .from('firecrawl_staged_items')
      .select('url_normalized')
      .eq('firecrawl_source_id', source.id)
      .not('url_normalized', 'is', null);

    const existingNormalized = new Set<string>(
      (existingItems || []).map((i: any) => i.url_normalized).filter(Boolean)
    );

    const seedNorm = normalizeUrl(source.seed_url);
    if (seedNorm) existingNormalized.add(seedNorm);

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

    const classifiedCandidates = acceptedUrls.map(f => ({
      ...f,
      classification: classifyPage(f.normalized, null),
    }));

    for (const c of classifiedCandidates) {
      const b = c.classification.bucket;
      stats.bucketCounts[b] = (stats.bucketCounts[b] || 0) + 1;
    }

    const recruitmentCandidates = classifiedCandidates
      .filter(c => c.classification.bucket === 'single_recruitment')
      .sort((a, b) => {
        const confOrder = { high: 3, medium: 2, low: 1 };
        return (confOrder[b.classification.confidence] - confOrder[a.classification.confidence])
          || (b.classification.signals.length - a.classification.signals.length);
      })
      .slice(0, maxDetailScrapes);

    for (const candidate of classifiedCandidates) {
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
            page_title: null,
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

// ============ extract-item ============

async function handleExtractItem(
  body: Record<string, unknown>,
  client: ReturnType<typeof createClient>
) {
  const stagedItemId = body.staged_item_id as string;
  if (!stagedItemId) return jsonResponse({ error: 'staged_item_id required' }, 400);

  const { data: item } = await client
    .from('firecrawl_staged_items')
    .select('*, firecrawl_sources(*)')
    .eq('id', stagedItemId)
    .single();

  if (!item) return jsonResponse({ error: 'Staged item not found' }, 404);

  if (item.bucket !== 'single_recruitment') {
    return jsonResponse({ error: `Only single_recruitment items can be extracted. This item is bucket: ${item.bucket}` }, 400);
  }

  if (!item.extracted_markdown) {
    return jsonResponse({ error: 'Staged item has no scraped content. Run discover-source first to scrape detail pages.' }, 400);
  }

  console.log(`[firecrawl-ingest] extract-item: ${item.page_url}`);

  await client.from('firecrawl_staged_items').update({ extraction_status: 'extracting' }).eq('id', stagedItemId);

  try {
    const source = item.firecrawl_sources as any;

    const cleanResult = cleanScrapedContent(item.extracted_markdown);

    const linkInfos = cleanResult.extractedLinks.map(l => ({
      text: l.text, url: l.url, context: l.context,
    }));
    const extraction = extractFields(
      cleanResult.cleanedText,
      linkInfos,
      item.page_title,
      item.page_url
    );

    const draftData = {
      staged_item_id: stagedItemId,
      firecrawl_source_id: item.firecrawl_source_id,
      source_name: source?.source_name || null,
      source_url: item.page_url,
      source_seed_url: source?.seed_url || null,
      source_page_url: item.discovered_from_url,
      source_bucket: item.bucket,
      ...extraction.fields,
      extraction_confidence: extraction.confidence,
      fields_extracted: extraction.fields_extracted,
      fields_missing: extraction.fields_missing,
      extraction_warnings: extraction.warnings,
      raw_scraped_text: item.extracted_markdown.substring(0, 200_000),
      raw_links_found: (item.extracted_links || []).slice(0, 500),
      extracted_raw_fields: extraction.raw_fields,
      cleaning_log: cleanResult.cleaningLog,
      status: 'draft',
    };

    const { data: draft, error: draftError } = await client
      .from('firecrawl_draft_jobs')
      .upsert(draftData, { onConflict: 'staged_item_id' })
      .select('id, extraction_confidence, fields_extracted')
      .single();

    if (draftError) {
      await client.from('firecrawl_staged_items').update({ extraction_status: 'failed' }).eq('id', stagedItemId);
      console.error('[firecrawl-ingest] Draft insert error:', draftError);
      return jsonResponse({ success: false, error: draftError.message }, 500);
    }

    await client.from('firecrawl_staged_items').update({ extraction_status: 'extracted' }).eq('id', stagedItemId);

    return jsonResponse({
      success: true,
      draft_id: draft.id,
      extraction_confidence: extraction.confidence,
      fields_extracted: extraction.fields_extracted,
      fields_missing: extraction.fields_missing,
      warnings: extraction.warnings,
      cleaning_log: cleanResult.cleaningLog,
      extracted_fields: extraction.fields,
    });
  } catch (e) {
    await client.from('firecrawl_staged_items').update({ extraction_status: 'failed' }).eq('id', stagedItemId);
    const errMsg = e instanceof Error ? e.message : String(e);
    console.error('[firecrawl-ingest] extract-item error:', errMsg);
    return jsonResponse({ success: false, error: errMsg }, 500);
  }
}

// ============ extract-batch ============

async function handleExtractBatch(
  body: Record<string, unknown>,
  client: ReturnType<typeof createClient>
) {
  const sourceId = body.source_id as string;
  if (!sourceId) return jsonResponse({ error: 'source_id required' }, 400);

  const maxItems = Math.min((body.max_items as number) || 10, 20);

  const { data: items, error } = await client
    .from('firecrawl_staged_items')
    .select('id')
    .eq('firecrawl_source_id', sourceId)
    .eq('bucket', 'single_recruitment')
    .eq('extraction_status', 'pending')
    .not('extracted_markdown', 'is', null)
    .order('created_at', { ascending: true })
    .limit(maxItems);

  if (error) return jsonResponse({ error: error.message }, 500);
  if (!items || items.length === 0) {
    return jsonResponse({ success: true, message: 'No extractable items found', extracted: 0 });
  }

  console.log(`[firecrawl-ingest] extract-batch: ${items.length} items for source ${sourceId}`);

  const results: any[] = [];
  let successCount = 0;
  let failCount = 0;

  for (const item of items) {
    try {
      const result = await handleExtractItemInternal(item.id, client);
      results.push({ staged_item_id: item.id, ...result });
      if (result.success) successCount++;
      else failCount++;
    } catch (e) {
      failCount++;
      results.push({ staged_item_id: item.id, success: false, error: String(e) });
    }
  }

  return jsonResponse({
    success: true,
    total: items.length,
    extracted: successCount,
    failed: failCount,
    results,
  });
}

/** Internal extraction for a single item */
async function handleExtractItemInternal(
  stagedItemId: string,
  client: ReturnType<typeof createClient>
): Promise<{ success: boolean; draft_id?: string; confidence?: string; fields_extracted?: number; error?: string }> {
  const { data: item } = await client
    .from('firecrawl_staged_items')
    .select('*, firecrawl_sources(*)')
    .eq('id', stagedItemId)
    .single();

  if (!item) return { success: false, error: 'Item not found' };
  if (item.bucket !== 'single_recruitment') return { success: false, error: `Wrong bucket: ${item.bucket}` };
  if (!item.extracted_markdown) return { success: false, error: 'No scraped content' };

  await client.from('firecrawl_staged_items').update({ extraction_status: 'extracting' }).eq('id', stagedItemId);

  try {
    const source = item.firecrawl_sources as any;
    const cleanResult = cleanScrapedContent(item.extracted_markdown);
    const linkInfos = cleanResult.extractedLinks.map(l => ({ text: l.text, url: l.url, context: l.context }));
    const extraction = extractFields(cleanResult.cleanedText, linkInfos, item.page_title, item.page_url);

    const { data: draft, error: draftError } = await client
      .from('firecrawl_draft_jobs')
      .upsert({
        staged_item_id: stagedItemId,
        firecrawl_source_id: item.firecrawl_source_id,
        source_name: source?.source_name || null,
        source_url: item.page_url,
        source_seed_url: source?.seed_url || null,
        source_page_url: item.discovered_from_url,
        source_bucket: item.bucket,
        ...extraction.fields,
        extraction_confidence: extraction.confidence,
        fields_extracted: extraction.fields_extracted,
        fields_missing: extraction.fields_missing,
        extraction_warnings: extraction.warnings,
        raw_scraped_text: item.extracted_markdown.substring(0, 200_000),
        raw_links_found: (item.extracted_links || []).slice(0, 500),
        extracted_raw_fields: extraction.raw_fields,
        cleaning_log: cleanResult.cleaningLog,
        status: 'draft',
      }, { onConflict: 'staged_item_id' })
      .select('id')
      .single();

    if (draftError) {
      await client.from('firecrawl_staged_items').update({ extraction_status: 'failed' }).eq('id', stagedItemId);
      return { success: false, error: draftError.message };
    }

    await client.from('firecrawl_staged_items').update({ extraction_status: 'extracted' }).eq('id', stagedItemId);
    return { success: true, draft_id: draft.id, confidence: extraction.confidence, fields_extracted: extraction.fields_extracted };
  } catch (e) {
    await client.from('firecrawl_staged_items').update({ extraction_status: 'failed' }).eq('id', stagedItemId);
    return { success: false, error: e instanceof Error ? e.message : String(e) };
  }
}

// ============ dedup-drafts (CROSS-SOURCE) ============

function normalizeTextForDedup(s: string | null): string {
  if (!s) return '';
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
}

async function handleDedupDrafts(
  body: Record<string, unknown>,
  client: ReturnType<typeof createClient>
) {
  console.log('[firecrawl-ingest] dedup-drafts: running cross-source dedup');

  // 1. Fetch all firecrawl draft candidates
  const { data: allDrafts, error } = await client
    .from('firecrawl_draft_jobs')
    .select('id, normalized_title, organization_name, official_notification_url, official_apply_url, last_date_of_application, total_vacancies, dedup_status')
    .in('status', ['draft', 'reviewed'])
    .order('created_at', { ascending: true });

  if (error) return jsonResponse({ error: error.message }, 500);
  if (!allDrafts || allDrafts.length === 0) {
    return jsonResponse({ success: true, checked: 0, duplicatesFound: 0 });
  }

  const candidates: DedupCandidate[] = allDrafts.map((d: any) => ({
    id: d.id,
    normalized_title: d.normalized_title,
    organization_name: d.organization_name,
    official_notification_url: d.official_notification_url,
    official_apply_url: d.official_apply_url,
    last_date_of_application: d.last_date_of_application,
    total_vacancies: d.total_vacancies,
  }));

  // 2. Build cross-source candidates from rss_items (Source 1)
  const { data: rssItems } = await client
    .from('rss_items')
    .select('id, item_title, canonical_link')
    .in('current_status', ['new', 'updated', 'queued', 'reviewed'])
    .limit(500);

  const crossSourceCandidates: DedupCandidate[] = [];

  for (const rss of (rssItems || [])) {
    crossSourceCandidates.push({
      id: `rss:${rss.id}`,
      normalized_title: normalizeTextForDedup(rss.item_title),
      organization_name: null,
      official_notification_url: rss.canonical_link || null,
      official_apply_url: null,
      last_date_of_application: null,
      total_vacancies: null,
    });
  }

  // 3. Build cross-source candidates from employment_news_jobs (Source 2)
  const { data: enJobs } = await client
    .from('employment_news_jobs')
    .select('id, org_name, post, last_date, vacancies, apply_link')
    .in('status', ['pending', 'published', 'enriched'])
    .limit(500);

  for (const en of (enJobs || [])) {
    const normTitle = normalizeTextForDedup(
      en.org_name && en.post ? `${en.org_name} ${en.post}` : en.post || en.org_name
    );
    crossSourceCandidates.push({
      id: `en:${en.id}`,
      normalized_title: normTitle,
      organization_name: en.org_name,
      official_notification_url: null,
      official_apply_url: en.apply_link || null,
      last_date_of_application: en.last_date,
      total_vacancies: en.vacancies,
    });
  }

  // 4. Combine all candidates (firecrawl + cross-source)
  const allCandidates = [...candidates, ...crossSourceCandidates];

  let duplicatesFound = 0;
  let checked = 0;

  const unchecked = allDrafts.filter((d: any) => d.dedup_status === 'unchecked');

  for (const draft of unchecked) {
    const target: DedupCandidate = {
      id: draft.id,
      normalized_title: draft.normalized_title,
      organization_name: draft.organization_name,
      official_notification_url: draft.official_notification_url,
      official_apply_url: draft.official_apply_url,
      last_date_of_application: draft.last_date_of_application,
      total_vacancies: draft.total_vacancies,
    };

    const result = checkDuplicate(target, allCandidates);
    checked++;

    // Annotate cross-source matches
    let reason = result.reason;
    const crossMatches = result.matchedIds.filter(id => id.startsWith('rss:') || id.startsWith('en:'));
    if (crossMatches.length > 0) {
      const sources = crossMatches.map(id => id.startsWith('rss:') ? 'RSS/Atom' : 'Employment News');
      reason = `CROSS-SOURCE match (${[...new Set(sources)].join(', ')}): ${reason}`;
    }

    const update: Record<string, unknown> = {
      dedup_status: result.isDuplicate ? 'duplicate' : 'clean',
      dedup_reason: reason,
      dedup_match_ids: result.matchedIds,
      dedup_checked_at: new Date().toISOString(),
    };

    await client.from('firecrawl_draft_jobs').update(update).eq('id', draft.id);

    if (result.isDuplicate) duplicatesFound++;
  }

  return jsonResponse({
    success: true,
    checked,
    duplicatesFound,
    totalDrafts: allDrafts.length,
    crossSourceCandidates: crossSourceCandidates.length,
  });
}

// ============ validate-for-approval (PUBLISH GATING) ============

async function handleValidateForApproval(
  body: Record<string, unknown>,
  client: ReturnType<typeof createClient>
) {
  const draftId = body.draft_id as string;
  if (!draftId) return jsonResponse({ error: 'draft_id required' }, 400);

  const { data: draft, error } = await client
    .from('firecrawl_draft_jobs')
    .select('*')
    .eq('id', draftId)
    .single();

  if (error || !draft) return jsonResponse({ error: 'Draft not found' }, 404);

  const errors: string[] = [];
  const warnings: string[] = [];

  // Mandatory checks
  if (!draft.title || draft.title.length < 10) errors.push('Title missing or too short (<10 chars)');
  if (!draft.organization_name) errors.push('Organization name is missing');
  if (!draft.post_name && !draft.total_vacancies) errors.push('Either post_name or total_vacancies must exist');
  if (!draft.last_date_of_application) warnings.push('Last date of application is missing');
  if (draft.extraction_confidence === 'none') errors.push('Extraction confidence is "none" — unreliable data');
  if (draft.extraction_confidence === 'low') warnings.push('Extraction confidence is "low" — review carefully');
  if (draft.dedup_status === 'duplicate') errors.push('Draft is flagged as duplicate — resolve before approving');

  // Recommended checks
  if (!draft.official_notification_url && !draft.official_apply_url) {
    warnings.push('No official links found — recommended before publishing');
  }
  if (!draft.seo_title) warnings.push('SEO title not generated');
  if (!draft.meta_description) warnings.push('Meta description not generated');
  if (!draft.cover_image_url) warnings.push('Cover image not generated');

  const canApprove = errors.length === 0;

  return jsonResponse({
    success: true,
    draft_id: draftId,
    can_approve: canApprove,
    errors,
    warnings,
    fields_summary: {
      title: !!draft.title,
      organization: !!draft.organization_name,
      post_name: !!draft.post_name,
      vacancies: !!draft.total_vacancies,
      last_date: !!draft.last_date_of_application,
      official_links: !!(draft.official_notification_url || draft.official_apply_url),
      seo: !!(draft.seo_title && draft.meta_description),
      cover_image: !!draft.cover_image_url,
      confidence: draft.extraction_confidence,
      dedup: draft.dedup_status,
    },
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
