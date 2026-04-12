import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { parseFeed, resolveUrl } from '../_shared/rss/feed-parser.ts';
import { classifyItem } from '../_shared/rss/classifier.ts';
import { generateNormalizedHash, extractPdfUrls, getCanonicalLink } from '../_shared/rss/deduper.ts';
import { shouldQueue, upsertReviewEntry } from '../_shared/rss/queue-router.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
};

const FETCH_TIMEOUT = 18000; // 18 seconds
const BATCH_SIZE = 5;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const cronSecret = Deno.env.get('RSS_CRON_SECRET') || '';

  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action as string;

    if (!action) {
      return jsonResponse({ error: 'Missing action parameter' }, 400);
    }

    // Auth check
    const authResult = await checkAuth(req, supabaseUrl, serviceRoleKey, cronSecret, action);
    if (!authResult.authorized) {
      return jsonResponse({ error: authResult.error }, 401);
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    switch (action) {
      case 'test-source':
        return await handleTestSource(body, adminClient, supabaseUrl);
      case 'run-source':
        return await handleRunSource(body, adminClient, supabaseUrl, serviceRoleKey, authResult.triggerSource);
      case 'run-due-sources':
        return await handleRunDueSources(adminClient, supabaseUrl, serviceRoleKey, authResult.triggerSource);
      case 'requeue-item':
        return await handleRequeueItem(body, adminClient, supabaseUrl, serviceRoleKey);
      case 'import-sources':
        return await handleImportSources(body, adminClient);
      default:
        return jsonResponse({ error: `Unknown action: ${action}` }, 400);
    }
  } catch (e) {
    console.error('rss-ingest error:', e);
    return jsonResponse({ error: e instanceof Error ? e.message : 'Internal error' }, 500);
  }
});

// ============ Auth ============

interface AuthResult {
  authorized: boolean;
  error?: string;
  triggerSource: 'manual_admin' | 'cron_secret';
}

async function checkAuth(
  req: Request,
  supabaseUrl: string,
  serviceRoleKey: string,
  cronSecret: string,
  action: string
): Promise<AuthResult> {
  // For run-due-sources, accept cron secret as alternative
  if (action === 'run-due-sources') {
    const headerSecret = req.headers.get('x-cron-secret');
    if (headerSecret && cronSecret && headerSecret === cronSecret) {
      return { authorized: true, triggerSource: 'cron_secret' };
    }
  }

  // JWT-based admin check
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return { authorized: false, error: 'Missing Authorization header', triggerSource: 'manual_admin' };
  }

  const token = authHeader.replace('Bearer ', '');
  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const { data: { user }, error } = await supabase.auth.getUser(token);

  if (error || !user) {
    return { authorized: false, error: 'Invalid or expired token', triggerSource: 'manual_admin' };
  }

  // Check admin role
  const { data: roleData } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .eq('role', 'admin')
    .maybeSingle();

  if (!roleData) {
    return { authorized: false, error: 'Admin role required', triggerSource: 'manual_admin' };
  }

  return { authorized: true, triggerSource: 'manual_admin' };
}

// ============ test-source ============

async function handleTestSource(
  body: Record<string, unknown>,
  adminClient: ReturnType<typeof createClient>,
  supabaseUrl: string
) {
  let feedUrl = body.feed_url as string | undefined;
  const sourceId = body.rss_source_id as string | undefined;

  if (sourceId) {
    const { data } = await adminClient.from('rss_sources').select('feed_url').eq('id', sourceId).single();
    if (!data) return jsonResponse({ error: 'Source not found' }, 404);
    feedUrl = data.feed_url;
  }

  if (!feedUrl) return jsonResponse({ error: 'feed_url or rss_source_id required' }, 400);

  const fetchResult = await fetchFeed(feedUrl);
  if (!fetchResult.ok) {
    return jsonResponse({ error: fetchResult.error, httpStatus: fetchResult.httpStatus });
  }

  const parsed = parseFeed(fetchResult.body!, feedUrl);
  const previewItems = parsed.items.slice(0, 10).map((item) => {
    const classification = classifyItem(item.title, item.summary, item.categories);
    const pdfs = extractPdfUrls(item.enclosureUrls, item.content, item.link);
    return {
      title: item.title,
      link: item.link,
      guid: item.guid,
      publishedAt: item.publishedAt,
      author: item.author,
      categories: item.categories,
      summaryPreview: item.summary?.substring(0, 300),
      itemType: classification.itemType,
      primaryDomain: classification.primaryDomain,
      displayGroup: classification.displayGroup,
      relevanceLevel: classification.relevanceLevel,
      detectionReason: classification.detectionReason,
      firstPdfUrl: pdfs.firstPdfUrl,
      pdfCount: pdfs.linkedPdfUrls.length,
    };
  });

  return jsonResponse({
    success: true,
    feedMeta: parsed.meta,
    totalItems: parsed.items.length,
    previewItems,
    parseErrors: parsed.errors,
    httpStatus: fetchResult.httpStatus,
    contentType: fetchResult.contentType,
  });
}

// ============ run-source ============

async function handleRunSource(
  body: Record<string, unknown>,
  adminClient: ReturnType<typeof createClient>,
  supabaseUrl: string,
  serviceRoleKey: string,
  triggerSource: string
) {
  const sourceId = body.rss_source_id as string;
  if (!sourceId) return jsonResponse({ error: 'rss_source_id required' }, 400);

  const { data: source } = await adminClient.from('rss_sources').select('*').eq('id', sourceId).single();
  if (!source) return jsonResponse({ error: 'Source not found' }, 404);

  const result = await processSource(source, adminClient, supabaseUrl, serviceRoleKey, triggerSource);
  return jsonResponse(result);
}

// ============ run-due-sources ============

async function handleRunDueSources(
  adminClient: ReturnType<typeof createClient>,
  supabaseUrl: string,
  serviceRoleKey: string,
  triggerSource: string
) {
  const now = new Date();

  const { data: sources, error } = await adminClient
    .from('rss_sources')
    .select('*')
    .eq('fetch_enabled', true)
    .not('status', 'in', '("Broken","Paused","Not useful for jobs")');

  if (error) return jsonResponse({ error: error.message }, 500);
  if (!sources || sources.length === 0) return jsonResponse({ success: true, message: 'No due sources', processed: 0 });

  // Filter sources that are due based on check_interval_hours
  const dueSources = sources.filter((s: any) => {
    if (!s.last_fetched_at) return true;
    const lastFetched = new Date(s.last_fetched_at);
    const intervalMs = (s.check_interval_hours || 6) * 60 * 60 * 1000;
    return now.getTime() - lastFetched.getTime() >= intervalMs;
  });

  if (dueSources.length === 0) {
    return jsonResponse({ success: true, message: 'No sources due for fetch', total: sources.length, due: 0 });
  }

  // Process in batches
  const results: any[] = [];
  for (let i = 0; i < dueSources.length; i += BATCH_SIZE) {
    const batch = dueSources.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.allSettled(
      batch.map((s: any) => processSource(s, adminClient, supabaseUrl, serviceRoleKey, triggerSource))
    );
    for (let j = 0; j < batchResults.length; j++) {
      const r = batchResults[j];
      results.push({
        sourceId: batch[j].id,
        sourceName: batch[j].source_name,
        status: r.status === 'fulfilled' ? r.value.status : 'error',
        error: r.status === 'rejected' ? String(r.reason) : undefined,
        ...(r.status === 'fulfilled' ? r.value : {}),
      });
    }
  }

  const successCount = results.filter((r) => r.status === 'success' || r.status === 'partial').length;
  const errorCount = results.filter((r) => r.status === 'error').length;

  return jsonResponse({
    success: true,
    totalDue: dueSources.length,
    processed: results.length,
    successCount,
    errorCount,
    results,
  });
}

// ============ requeue-item ============

async function handleRequeueItem(
  body: Record<string, unknown>,
  adminClient: ReturnType<typeof createClient>,
  supabaseUrl: string,
  serviceRoleKey: string
) {
  const itemId = body.rss_item_id as string;
  if (!itemId) return jsonResponse({ error: 'rss_item_id required' }, 400);

  const { data: item } = await adminClient.from('rss_items').select('*').eq('id', itemId).single();
  if (!item) return jsonResponse({ error: 'Item not found' }, 404);

  const queueResult = await upsertReviewEntry(supabaseUrl, serviceRoleKey, {
    rssItemId: item.id,
    rssSourceId: item.rss_source_id,
    title: item.item_title,
    link: item.item_link,
    pdfUrl: item.first_pdf_url,
    publishedAt: item.published_at,
    itemType: item.item_type,
    primaryDomain: item.primary_domain || 'general_alerts',
    displayGroup: item.display_group || 'General Alerts',
    relevanceLevel: item.relevance_level,
    rawPayload: item.raw_payload || {},
    parsedPayload: {
      summary: item.item_summary,
      categories: item.categories,
      author: item.author,
      detectionReason: item.detection_reason,
    },
  });

  if (queueResult.success) {
    await adminClient.from('rss_items').update({ current_status: 'queued' }).eq('id', itemId);
  }

  return jsonResponse(queueResult);
}

// ============ import-sources ============

async function handleImportSources(
  body: Record<string, unknown>,
  adminClient: ReturnType<typeof createClient>
) {
  const sources = body.sources as any[];
  if (!Array.isArray(sources) || sources.length === 0) {
    return jsonResponse({ error: 'sources array required' }, 400);
  }

  const results = { imported: 0, skipped: 0, invalid: 0, errors: [] as string[] };

  for (const src of sources) {
    if (!src.feed_url || !src.source_name) {
      results.invalid++;
      results.errors.push(`Missing feed_url or source_name: ${JSON.stringify(src).substring(0, 100)}`);
      continue;
    }

    const { error } = await adminClient.from('rss_sources').upsert(
      {
        source_name: src.source_name,
        official_site: src.official_site || null,
        feed_url: src.feed_url,
        source_type: src.source_type || 'rss',
        focus: src.focus || null,
        priority: ['High', 'Medium', 'Low'].includes(src.priority) ? src.priority : 'Medium',
        status: src.status || 'Testing',
        notes: src.notes || null,
      },
      { onConflict: 'feed_url', ignoreDuplicates: true }
    );

    if (error) {
      if (error.message.includes('duplicate') || error.code === '23505') {
        results.skipped++;
      } else {
        results.invalid++;
        results.errors.push(`${src.feed_url}: ${error.message}`);
      }
    } else {
      results.imported++;
    }
  }

  return jsonResponse({ success: true, ...results });
}

// ============ Core Processing ============

async function processSource(
  source: any,
  adminClient: ReturnType<typeof createClient>,
  supabaseUrl: string,
  serviceRoleKey: string,
  triggerSource: string
) {
  const runMode = triggerSource === 'cron_secret' ? 'cron_secret' : 'manual_admin';

  // Create run record
  const { data: run } = await adminClient
    .from('rss_fetch_runs')
    .insert({ rss_source_id: source.id, run_mode: runMode, status: 'running' })
    .select('id')
    .single();

  const runId = run?.id;

  try {
    // Fetch with conditional headers
    const fetchResult = await fetchFeed(source.feed_url, source.etag, source.last_modified);

    // Handle 304 Not Modified
    if (fetchResult.httpStatus === 304) {
      await finalizeRun(adminClient, runId, 'success', 0, 0, 0, 0, null);
      await adminClient.from('rss_sources').update({
        last_fetched_at: new Date().toISOString(),
        last_success_at: new Date().toISOString(),
        last_error: null,
      }).eq('id', source.id);
      return { status: 'success', notModified: true, itemsSeen: 0, itemsNew: 0 };
    }

    if (!fetchResult.ok) {
      const errMsg = fetchResult.error || `HTTP ${fetchResult.httpStatus}`;
      await finalizeRun(adminClient, runId, 'error', 0, 0, 0, 0, errMsg);
      await adminClient.from('rss_sources').update({
        last_fetched_at: new Date().toISOString(),
        last_error: errMsg,
      }).eq('id', source.id);
      return { status: 'error', error: errMsg };
    }

    // Parse
    const parsed = parseFeed(fetchResult.body!, source.feed_url);
    if (parsed.items.length === 0 && parsed.errors.length > 0) {
      const errMsg = parsed.errors.join('; ');
      await finalizeRun(adminClient, runId, 'error', 0, 0, 0, 0, errMsg);
      await adminClient.from('rss_sources').update({
        last_fetched_at: new Date().toISOString(),
        last_error: errMsg,
      }).eq('id', source.id);
      return { status: 'error', error: errMsg };
    }

    // Process items
    let itemsNew = 0;
    let itemsUpdated = 0;
    let itemsSkipped = 0;
    const newItemIds: string[] = []; // Track new items for Firecrawl enrichment

    for (const item of parsed.items) {
      try {
        const classification = classifyItem(item.title, item.summary, item.categories);
        const pdfs = extractPdfUrls(item.enclosureUrls, item.content, item.link);
        const canonicalLink = getCanonicalLink(item.link, item.guid);
        const normalizedHash = await generateNormalizedHash(
          source.id,
          item.title,
          canonicalLink,
          pdfs.firstPdfUrl,
          item.publishedAt
        );

        const itemData = {
          rss_source_id: source.id,
          item_guid: item.guid,
          item_title: item.title,
          item_link: item.link,
          canonical_link: canonicalLink,
          published_at: parseDate(item.publishedAt),
          author: item.author,
          item_summary: item.summary?.substring(0, 5000),
          item_content: item.content?.substring(0, 50000),
          categories: item.categories,
          item_type: classification.itemType,
          primary_domain: classification.primaryDomain,
          display_group: classification.displayGroup,
          relevance_level: classification.relevanceLevel,
          detection_reason: classification.detectionReason,
          first_pdf_url: pdfs.firstPdfUrl,
          linked_pdf_urls: pdfs.linkedPdfUrls,
          normalized_hash: normalizedHash,
          raw_payload: item.rawPayload,
          last_seen_at: new Date().toISOString(),
        };

        // 3-tier upsert
        const upsertResult = await upsertItem(adminClient, itemData);

        if (upsertResult.action === 'inserted') {
          itemsNew++;
          if (upsertResult.itemId) newItemIds.push(upsertResult.itemId);
          // Queue if relevant
          if (shouldQueue(classification.relevanceLevel)) {
            await upsertReviewEntry(supabaseUrl, serviceRoleKey, {
              rssItemId: upsertResult.itemId!,
              rssSourceId: source.id,
              title: item.title,
              link: item.link,
              pdfUrl: pdfs.firstPdfUrl,
              publishedAt: parseDate(item.publishedAt),
              itemType: classification.itemType,
              primaryDomain: classification.primaryDomain,
              displayGroup: classification.displayGroup,
              relevanceLevel: classification.relevanceLevel,
              rawPayload: item.rawPayload,
              parsedPayload: {
                summary: item.summary?.substring(0, 1000),
                categories: item.categories,
                author: item.author,
                detectionReason: classification.detectionReason,
              },
            });
            // Set status to queued
            await adminClient.from('rss_items').update({ current_status: 'queued' }).eq('id', upsertResult.itemId);
          }
        } else if (upsertResult.action === 'updated') {
          itemsUpdated++;
        } else {
          itemsSkipped++;
        }
      } catch (e) {
        itemsSkipped++;
        console.error(`Item processing error: ${e}`);
      }
    }

    const runStatus = parsed.errors.length > 0 ? 'partial' : 'success';
    await finalizeRun(
      adminClient, runId, runStatus,
      parsed.items.length, itemsNew, itemsUpdated, itemsSkipped,
      parsed.errors.length > 0 ? parsed.errors.join('; ') : null
    );

    // Update source metadata
    await adminClient.from('rss_sources').update({
      last_fetched_at: new Date().toISOString(),
      last_success_at: new Date().toISOString(),
      last_error: null,
      etag: fetchResult.etag || source.etag,
      last_modified: fetchResult.lastModified || source.last_modified,
    }).eq('id', source.id);

    // Fire-and-forget Firecrawl enrichment for qualifying new items
    if (itemsNew > 0) {
      try {
        await dispatchFirecrawlEnrichment(newItemIds, supabaseUrl, serviceRoleKey);
      } catch (fcErr) {
        console.warn('[rss-ingest] Firecrawl dispatch failed (non-blocking):', fcErr);
      }
    }

    return {
      status: runStatus,
      itemsSeen: parsed.items.length,
      itemsNew,
      itemsUpdated,
      itemsSkipped,
      parseErrors: parsed.errors,
    };
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e);
    await finalizeRun(adminClient, runId, 'error', 0, 0, 0, 0, errMsg);
    await adminClient.from('rss_sources').update({
      last_fetched_at: new Date().toISOString(),
      last_error: errMsg,
    }).eq('id', source.id);
    return { status: 'error', error: errMsg };
  }
}

// ============ Item Upsert (3-tier dedup) ============

async function upsertItem(
  client: ReturnType<typeof createClient>,
  itemData: any
): Promise<{ action: 'inserted' | 'updated' | 'skipped'; itemId?: string }> {
  // Tier 1: Check by guid
  if (itemData.item_guid) {
    const { data: existing } = await client
      .from('rss_items')
      .select('id, item_summary, item_content')
      .eq('rss_source_id', itemData.rss_source_id)
      .eq('item_guid', itemData.item_guid)
      .maybeSingle();

    if (existing) {
      return handleExistingItem(client, existing, itemData);
    }
  }

  // Tier 2: Check by canonical_link
  if (itemData.canonical_link) {
    const { data: existing } = await client
      .from('rss_items')
      .select('id, item_summary, item_content')
      .eq('rss_source_id', itemData.rss_source_id)
      .eq('canonical_link', itemData.canonical_link)
      .maybeSingle();

    if (existing) {
      return handleExistingItem(client, existing, itemData);
    }
  }

  // Tier 3: Check by normalized_hash
  const { data: existing } = await client
    .from('rss_items')
    .select('id, item_summary, item_content')
    .eq('normalized_hash', itemData.normalized_hash)
    .maybeSingle();

  if (existing) {
    return handleExistingItem(client, existing, itemData);
  }

  // Insert new
  const { data: inserted, error } = await client
    .from('rss_items')
    .insert(itemData)
    .select('id')
    .single();

  if (error) {
    // Handle race condition conflicts
    if (error.code === '23505') return { action: 'skipped' };
    throw error;
  }

  return { action: 'inserted', itemId: inserted.id };
}

async function handleExistingItem(
  client: ReturnType<typeof createClient>,
  existing: any,
  newData: any
): Promise<{ action: 'updated' | 'skipped'; itemId: string }> {
  // Check if content changed
  const contentChanged =
    (newData.item_summary && newData.item_summary !== existing.item_summary) ||
    (newData.item_content && newData.item_content !== existing.item_content);

  if (contentChanged) {
    await client
      .from('rss_items')
      .update({
        item_summary: newData.item_summary,
        item_content: newData.item_content,
        last_seen_at: newData.last_seen_at,
        current_status: 'updated',
        categories: newData.categories,
        item_type: newData.item_type,
        primary_domain: newData.primary_domain,
        display_group: newData.display_group,
        relevance_level: newData.relevance_level,
        detection_reason: newData.detection_reason,
        first_pdf_url: newData.first_pdf_url,
        linked_pdf_urls: newData.linked_pdf_urls,
      })
      .eq('id', existing.id);
    return { action: 'updated', itemId: existing.id };
  }

  // Just update last_seen_at
  await client
    .from('rss_items')
    .update({ last_seen_at: newData.last_seen_at })
    .eq('id', existing.id);

  return { action: 'skipped', itemId: existing.id };
}

// ============ HTTP Fetch ============

interface FetchResult {
  ok: boolean;
  httpStatus: number;
  body: string | null;
  contentType: string;
  error?: string;
  etag?: string;
  lastModified?: string;
}

async function fetchFeed(
  url: string,
  etag?: string,
  lastModified?: string
): Promise<FetchResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

  try {
    const headers: Record<string, string> = {
      'User-Agent': 'TrueJobs-RSS-Bot/1.0 (+https://truejobs.co.in)',
      Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*',
    };
    if (etag) headers['If-None-Match'] = etag;
    if (lastModified) headers['If-Modified-Since'] = lastModified;

    const res = await fetch(url, { headers, signal: controller.signal });
    clearTimeout(timeout);

    if (res.status === 304) {
      return { ok: true, httpStatus: 304, body: null, contentType: '' };
    }

    if (!res.ok) {
      return { ok: false, httpStatus: res.status, body: null, contentType: '', error: `HTTP ${res.status}` };
    }

    const body = await res.text();
    const ct = res.headers.get('content-type') || '';

    return {
      ok: true,
      httpStatus: res.status,
      body,
      contentType: ct,
      etag: res.headers.get('etag') || undefined,
      lastModified: res.headers.get('last-modified') || undefined,
    };
  } catch (e) {
    clearTimeout(timeout);
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, httpStatus: 0, body: null, contentType: '', error: msg.includes('abort') ? 'Fetch timeout (18s)' : msg };
  }
}

// ============ Helpers ============

async function finalizeRun(
  client: ReturnType<typeof createClient>,
  runId: string | undefined,
  status: string,
  seen: number,
  newItems: number,
  updated: number,
  skipped: number,
  errorLog: string | null
) {
  if (!runId) return;
  await client.from('rss_fetch_runs').update({
    status,
    finished_at: new Date().toISOString(),
    items_seen: seen,
    items_new: newItems,
    items_updated: updated,
    items_skipped: skipped,
    error_log: errorLog,
  }).eq('id', runId);
}

function parseDate(dateStr: string | null): string | null {
  if (!dateStr) return null;
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return null;
    return d.toISOString();
  } catch {
    return null;
  }
}

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
