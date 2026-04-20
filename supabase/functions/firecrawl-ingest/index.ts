/**
 * Source 3: Firecrawl Ingest Edge Function
 * Phases 1-5 — Discovery + Bucketing + Field Extraction + Dedup + Validation.
 * Supports:
 *   - test-source, list-sources, run-source, discover-source, source-stats
 *   - extract-item, extract-batch
 *   - scrape-pending
 *   - dedup-drafts (cross-source: firecrawl + rss_items + employment_news_jobs + jobs)
 *   - purge-high-duplicates
 *   - validate-for-approval
 *   - discover-govt, govt-scrape-extract, govt-run-all
 *   - recovery-pass (multi-pass extraction for weak drafts)
 *
 * Completely isolated from Source 1 (rss-ingest) and Source 2 (Employment News).
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { scrapePage, mapUrl, generateContentHash } from '../_shared/firecrawl/client.ts';
import { normalizeUrl, filterAndClassifyUrls, isDomainAllowed, type UrlFilterConfig } from '../_shared/firecrawl/url-filter.ts';
import { classifyPage, scoreGovtPage, type PageBucket } from '../_shared/firecrawl/page-classifier.ts';
import { cleanScrapedContent } from '../_shared/firecrawl/content-cleaner.ts';
import { extractFields } from '../_shared/firecrawl/field-extractor.ts';
import { checkDuplicate, type DedupCandidate } from '../_shared/firecrawl/dedup.ts';
import { sanitizeDraftFields } from '../_shared/firecrawl/branding-sanitizer.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============ Source-type-aware limits ============
const LIMITS = {
  private: { maxDetailScrapes: 10, discoverMaxUrls: 300, extractBatchMax: 30 },
  government: { maxDetailScrapes: 15, discoverMaxUrls: 500, extractBatchMax: 30 },
  sitemap: { maxDetailScrapes: 8, discoverMaxUrls: 400, extractBatchMax: 30 },
  // Peak (5x): aggressive but capped. Used only when source_type endswith _peak.
  government_peak: { maxDetailScrapes: 75, discoverMaxUrls: 2500, extractBatchMax: 100 },
  sitemap_peak: { maxDetailScrapes: 40, discoverMaxUrls: 2000, extractBatchMax: 100 },
};

/** Hard cap: never scrape more than this many detail pages in one discover run */
const HARD_SCRAPE_CAP = 25;
/** Peak hard cap: 5x the normal cap, still non-negotiable per invocation */
const HARD_SCRAPE_CAP_PEAK = 125;
/** Peak concurrency: parallel scrape worker pool size (only when isPeak) */
const PEAK_CONCURRENCY = 5;

/** Recovery pass: max drafts to attempt per invocation */
const RECOVERY_MAX_PER_RUN = 10;

// ============ Domain Throttling ============
const domainLastFetch = new Map<string, number>();
const domainFailCount = new Map<string, number>();
const DOMAIN_MIN_INTERVAL_MS = 2000;
const DOMAIN_COOLDOWN_THRESHOLD = 3;
const DOMAIN_COOLDOWN_MS = 30_000;
// Peak overrides (only consulted when isPeak === true)
const DOMAIN_MIN_INTERVAL_MS_PEAK = 750;
const DOMAIN_COOLDOWN_THRESHOLD_PEAK = 5;
const DOMAIN_COOLDOWN_MS_PEAK = 20_000;

/** Returns true if this source is a Peak (aggressive) variant. */
function isPeak(sourceType: string | null | undefined): boolean {
  return sourceType === 'firecrawl_sitemap_peak' || sourceType === 'government_peak';
}

function getCooldownThreshold(peak: boolean): number {
  return peak ? DOMAIN_COOLDOWN_THRESHOLD_PEAK : DOMAIN_COOLDOWN_THRESHOLD;
}

function getHardScrapeCap(peak: boolean): number {
  return peak ? HARD_SCRAPE_CAP_PEAK : HARD_SCRAPE_CAP;
}

function extractDomainFromUrl(url: string): string {
  try { return new URL(url).hostname; } catch { return 'unknown'; }
}

function getDomainThrottleDelay(url: string, peak = false): number {
  const domain = extractDomainFromUrl(url);
  const now = Date.now();
  const minInterval = peak ? DOMAIN_MIN_INTERVAL_MS_PEAK : DOMAIN_MIN_INTERVAL_MS;
  const cooldownThreshold = peak ? DOMAIN_COOLDOWN_THRESHOLD_PEAK : DOMAIN_COOLDOWN_THRESHOLD;
  const cooldownMs = peak ? DOMAIN_COOLDOWN_MS_PEAK : DOMAIN_COOLDOWN_MS;

  // Check cooldown
  const fails = domainFailCount.get(domain) || 0;
  if (fails >= cooldownThreshold) {
    const lastFetch = domainLastFetch.get(domain) || 0;
    const elapsed = now - lastFetch;
    if (elapsed < cooldownMs) {
      return cooldownMs - elapsed;
    }
    // Cooldown expired, reset
    domainFailCount.set(domain, 0);
  }

  // Normal throttle
  const lastFetch = domainLastFetch.get(domain) || 0;
  const elapsed = now - lastFetch;
  if (elapsed < minInterval) {
    return minInterval - elapsed;
  }
  return 0;
}

function recordDomainSuccess(url: string): void {
  const domain = extractDomainFromUrl(url);
  domainLastFetch.set(domain, Date.now());
  domainFailCount.set(domain, 0);
}

function recordDomainFailure(url: string, peak = false): boolean {
  const domain = extractDomainFromUrl(url);
  domainLastFetch.set(domain, Date.now());
  const count = (domainFailCount.get(domain) || 0) + 1;
  domainFailCount.set(domain, count);
  const threshold = peak ? DOMAIN_COOLDOWN_THRESHOLD_PEAK : DOMAIN_COOLDOWN_THRESHOLD;
  if (count >= threshold) {
    console.warn(`[domain-throttle] Domain ${domain} hit cooldown (${count} consecutive failures)`);
    return true; // in cooldown
  }
  return false;
}

async function throttledScrapePage(url: string, options?: Parameters<typeof scrapePage>[1], peak = false) {
  const delay = getDomainThrottleDelay(url, peak);
  if (delay > 0) {
    console.log(`[domain-throttle] Waiting ${delay}ms before scraping ${extractDomainFromUrl(url)}`);
    await new Promise(r => setTimeout(r, delay));
  }
  const result = await scrapePage(url, options);
  if (result.success) {
    recordDomainSuccess(url);
  } else {
    recordDomainFailure(url, peak);
  }
  return result;
}

function getSourceLimits(sourceType: string) {
  if (sourceType === 'government_peak') return LIMITS.government_peak;
  if (sourceType === 'firecrawl_sitemap_peak') return LIMITS.sitemap_peak;
  if (sourceType === 'government') return LIMITS.government;
  if (sourceType === 'firecrawl_sitemap') return LIMITS.sitemap;
  return LIMITS.private;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  try {
    const authResult = await checkAdmin(req, supabaseUrl, serviceRoleKey);
    if (!authResult.authorized) return jsonResponse({ error: authResult.error }, 401);

    const body = await req.json().catch(() => ({}));
    const action = body.action as string;

    if (!action) return jsonResponse({ error: 'Missing action parameter' }, 400);

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
      case 'scrape-pending':
        return await handleScrapePending(body, adminClient);
      case 'dedup-drafts':
        return await handleDedupDrafts(body, adminClient);
      case 'purge-high-duplicates':
        return await handlePurgeHighDuplicates(body, adminClient);
      case 'validate-for-approval':
        return await handleValidateForApproval(body, adminClient);
      case 'discover-govt':
        return await handleDiscoverGovt(body, adminClient);
      case 'govt-scrape-extract':
        return await handleGovtScrapeExtract(body, adminClient);
      case 'govt-run-all':
        return await handleGovtRunAll(body, adminClient);
      case 'recovery-pass':
        return await handleRecoveryPass(body, adminClient);
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

  const scrapeResult = await throttledScrapePage(seedUrl, { formats: ['markdown', 'links'], onlyMainContent: true });

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
    const scrapeResult = await throttledScrapePage(source.seed_url, { formats: ['markdown', 'links'], onlyMainContent: true });

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

  const limits = getSourceLimits(source.source_type);
  const peak = isPeak(source.source_type);
  const hardCap = getHardScrapeCap(peak);
  const maxDetailScrapes = Math.min(
    (body.max_detail_scrapes as number) || limits.maxDetailScrapes,
    source.max_pages_per_run || (peak ? 250 : 15),
    hardCap
  );

  console.log(`[firecrawl-ingest] discover-source: ${source.source_name} (type=${source.source_type}, peak=${peak}, max_detail: ${maxDetailScrapes})`);

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
    domainCooldowns: 0,
    detailPageFollowUps: 0,
    bucketCounts: {} as Record<string, number>,
  };

  try {
    const seedResult = await throttledScrapePage(source.seed_url, { formats: ['markdown', 'links'], onlyMainContent: true });

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
      maxUrls: limits.discoverMaxUrls,
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
      // Hard cap check
      if (stats.pagesScraped >= hardCap) {
        console.log(`[firecrawl-ingest] Hard scrape cap reached (${hardCap}), stopping detail scraping`);
        break;
      }

      // Domain cooldown check
      const domain = extractDomainFromUrl(candidate.normalized);
      const fails = domainFailCount.get(domain) || 0;
      if (fails >= getCooldownThreshold(peak)) {
        stats.domainCooldowns++;
        detailResults.push({ url: candidate.normalized, error: 'Domain in cooldown' });
        continue;
      }

      try {
        const detailResult = await throttledScrapePage(candidate.normalized, {
          formats: ['markdown', 'links'],
          onlyMainContent: true,
        }, peak);

        stats.pagesScraped++;
        stats.detailPageFollowUps++;

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

// ============ source-stats (enhanced) ============

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

  const { data: stagedData } = await client
    .from('firecrawl_staged_items')
    .select('bucket, status, extraction_status, extracted_markdown')
    .eq('firecrawl_source_id', sourceId);

  const items = stagedData || [];
  const totalStaged = items.length;

  const bucketCounts: Record<string, number> = {};
  const statusCounts: Record<string, number> = {};
  let pendingUrlOnly = 0;
  let scraped = 0;
  let extracted = 0;
  let extractionFailed = 0;
  let rejectedBucket = 0;
  let duplicateStaged = 0;

  for (const item of items) {
    bucketCounts[item.bucket] = (bucketCounts[item.bucket] || 0) + 1;
    statusCounts[item.status] = (statusCounts[item.status] || 0) + 1;

    if (!item.extracted_markdown && item.bucket === 'single_recruitment') pendingUrlOnly++;
    if (item.extracted_markdown && item.extraction_status === 'pending') scraped++;
    if (item.extraction_status === 'extracted') extracted++;
    if (item.extraction_status === 'failed') extractionFailed++;
    if (item.bucket === 'rejected') rejectedBucket++;
    if (item.status === 'duplicate') duplicateStaged++;
  }

  const { data: drafts } = await client
    .from('firecrawl_draft_jobs')
    .select('id, extraction_confidence, status, dedup_status')
    .eq('firecrawl_source_id', sourceId);

  const draftItems = drafts || [];
  const draftCounts = {
    total: draftItems.length,
    high: draftItems.filter((d: any) => d.extraction_confidence === 'high').length,
    medium: draftItems.filter((d: any) => d.extraction_confidence === 'medium').length,
    low: draftItems.filter((d: any) => d.extraction_confidence === 'low').length,
    draft: draftItems.filter((d: any) => d.status === 'draft').length,
    reviewed: draftItems.filter((d: any) => d.status === 'reviewed').length,
    approved: draftItems.filter((d: any) => d.status === 'approved').length,
    duplicate: draftItems.filter((d: any) => d.dedup_status === 'duplicate').length,
  };

  const { data: recentRuns } = await client
    .from('firecrawl_fetch_runs')
    .select('id, run_mode, status, started_at, finished_at, pages_fetched, items_found, items_new, items_skipped, pages_accepted, pages_rejected, bucket_counts, error_log')
    .eq('firecrawl_source_id', sourceId)
    .order('started_at', { ascending: false })
    .limit(5);

  const { data: lastScrapeRun } = await client
    .from('firecrawl_fetch_runs')
    .select('finished_at')
    .eq('firecrawl_source_id', sourceId)
    .in('status', ['success', 'partial'])
    .order('finished_at', { ascending: false })
    .limit(1);

  const { data: lastDraft } = await client
    .from('firecrawl_draft_jobs')
    .select('created_at')
    .eq('firecrawl_source_id', sourceId)
    .order('created_at', { ascending: false })
    .limit(1);

  return jsonResponse({
    success: true,
    source,
    totalStaged,
    pendingUrlOnly,
    scraped,
    extracted,
    extractionFailed,
    rejectedBucket,
    duplicateStaged,
    bucketCounts,
    statusCounts,
    draftCounts,
    lastScrapeAt: lastScrapeRun?.[0]?.finished_at || null,
    lastExtractAt: lastDraft?.[0]?.created_at || null,
    recentRuns: recentRuns || [],
  });
}

// ============ scrape-pending ============

async function handleScrapePending(
  body: Record<string, unknown>,
  client: ReturnType<typeof createClient>
) {
  const sourceId = body.source_id as string;
  if (!sourceId) return jsonResponse({ error: 'source_id required' }, 400);

  const maxItems = Math.min(Math.max((body.max_items as number) || 20, 1), 50);

  const { data: source } = await client.from('firecrawl_sources').select('id, source_name, source_type').eq('id', sourceId).single();
  if (!source) return jsonResponse({ error: 'Source not found' }, 404);
  const peak = isPeak(source.source_type);

  const { data: items, error } = await client
    .from('firecrawl_staged_items')
    .select('id, page_url, url_normalized, content_hash')
    .eq('firecrawl_source_id', sourceId)
    .eq('bucket', 'single_recruitment')
    .eq('status', 'staged')
    .eq('extraction_status', 'pending')
    .is('extracted_markdown', null)
    .order('created_at', { ascending: true })
    .limit(maxItems);

  if (error) return jsonResponse({ error: error.message }, 500);
  if (!items || items.length === 0) {
    return jsonResponse({ success: true, message: 'No pending items to scrape', scraped: 0, failed: 0, total: 0 });
  }

  console.log(`[firecrawl-ingest] scrape-pending: ${items.length} items for ${source.source_name}`);

  const { data: run } = await client
    .from('firecrawl_fetch_runs')
    .insert({ firecrawl_source_id: sourceId, run_mode: 'manual_admin', status: 'running' })
    .select('id').single();
  const runId = run?.id;

  let scrapedCount = 0;
  let failedCount = 0;
  let skippedCount = 0;
  let unchangedSkips = 0;
  let domainCooldowns = 0;
  const results: { url: string; status: string; title?: string; contentLength?: number; error?: string }[] = [];

  for (const item of items) {
    // Domain cooldown check
    const domain = extractDomainFromUrl(item.page_url);
    const fails = domainFailCount.get(domain) || 0;
    if (fails >= getCooldownThreshold(peak)) {
      domainCooldowns++;
      results.push({ url: item.page_url, status: 'domain_cooldown' });
      continue;
    }

    try {
      const scrapeResult = await throttledScrapePage(item.page_url, {
        formats: ['markdown', 'links'],
        onlyMainContent: true,
      }, peak);

      if (!scrapeResult.success || !scrapeResult.markdown) {
        failedCount++;
        results.push({ url: item.page_url, status: 'failed', error: scrapeResult.error || 'No content returned' });
        continue;
      }

      const contentHash = await generateContentHash(scrapeResult.markdown);

      // Content-hash skip: if unchanged, skip re-extraction
      if (item.content_hash && item.content_hash === contentHash) {
        unchangedSkips++;
        skippedCount++;
        results.push({ url: item.page_url, status: 'unchanged_skip' });
        continue;
      }

      const refined = classifyPage(item.page_url, scrapeResult.metadata?.title);

      await client
        .from('firecrawl_staged_items')
        .update({
          page_title: scrapeResult.metadata?.title || null,
          extracted_markdown: scrapeResult.markdown.substring(0, 100_000),
          extracted_links: scrapeResult.links?.slice(0, 200) || [],
          content_hash: contentHash,
          metadata: scrapeResult.metadata || {},
          bucket: refined.bucket,
          classification_reason: refined.reason + ' (scrape-pending refined)',
          classification_signals: refined.signals,
        })
        .eq('id', item.id);

      scrapedCount++;
      results.push({
        url: item.page_url,
        status: 'scraped',
        title: scrapeResult.metadata?.title,
        contentLength: scrapeResult.markdown.length,
      });
    } catch (e) {
      failedCount++;
      results.push({ url: item.page_url, status: 'failed', error: e instanceof Error ? e.message : String(e) });
    }
  }

  const runStatus = failedCount > 0 && scrapedCount > 0 ? 'partial' : failedCount > 0 ? 'error' : 'success';
  if (runId) await finalizeRun(client, runId, runStatus, {
    pagesFetched: scrapedCount + failedCount,
    itemsFound: items.length,
    itemsNew: scrapedCount,
    itemsSkipped: skippedCount,
    errorLog: failedCount > 0 ? `${failedCount} scrape failures` : null,
  });

  return jsonResponse({
    success: true,
    total: items.length,
    scraped: scrapedCount,
    failed: failedCount,
    skipped: skippedCount,
    unchangedSkips,
    domainCooldowns,
    results,
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

    const resolvedSourceType = source?.source_type;
    if (!resolvedSourceType) {
      console.warn(`[firecrawl-ingest] Missing source_type for source ${item.firecrawl_source_id} during single extract — defaulting to government`);
    }
    const rawDraftData: Record<string, unknown> = {
      staged_item_id: stagedItemId,
      firecrawl_source_id: item.firecrawl_source_id,
      source_name: source?.source_name || null,
      source_url: item.page_url,
      source_seed_url: source?.seed_url || null,
      source_page_url: item.discovered_from_url,
      source_bucket: item.bucket,
      source_type_tag: resolvedSourceType || 'government',
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

    const sanitizeResult = sanitizeDraftFields(rawDraftData);
    const draftData = {
      ...rawDraftData,
      ...sanitizeResult.sanitizedFields,
      tp_clean_status: sanitizeResult.totalTraces > 0 ? 'pending' : 'cleaned',
      tp_cleaned_at: sanitizeResult.totalTraces === 0 ? new Date().toISOString() : null,
      tp_contamination_count: sanitizeResult.totalTraces,
      tp_clean_log: sanitizeResult.totalTraces > 0 ? [{ action: 'auto-ingest', traces: sanitizeResult.traceDetails.slice(0, 30) }] : [],
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

  const { data: source } = await client.from('firecrawl_sources').select('source_type').eq('id', sourceId).single();
  const limits = getSourceLimits(source?.source_type || 'government');
  const maxItems = Math.min((body.max_items as number) || 10, limits.extractBatchMax);

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

    const resolvedBatchSourceType = source?.source_type;
    if (!resolvedBatchSourceType) {
      console.warn(`[firecrawl-ingest] Missing source_type for source ${item.firecrawl_source_id} during batch extract — defaulting to government`);
    }
    const rawBatchData: Record<string, unknown> = {
        staged_item_id: stagedItemId,
        firecrawl_source_id: item.firecrawl_source_id,
        source_name: source?.source_name || null,
        source_url: item.page_url,
        source_seed_url: source?.seed_url || null,
        source_page_url: item.discovered_from_url,
        source_bucket: item.bucket,
        source_type_tag: resolvedBatchSourceType || 'government',
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

    const batchSanitize = sanitizeDraftFields(rawBatchData);
    const batchDraftData = {
      ...rawBatchData,
      ...batchSanitize.sanitizedFields,
      tp_clean_status: batchSanitize.totalTraces > 0 ? 'pending' : 'cleaned',
      tp_cleaned_at: batchSanitize.totalTraces === 0 ? new Date().toISOString() : null,
      tp_contamination_count: batchSanitize.totalTraces,
      tp_clean_log: batchSanitize.totalTraces > 0 ? [{ action: 'auto-ingest-batch', traces: batchSanitize.traceDetails.slice(0, 30) }] : [],
    };

    const { data: draft, error: draftError } = await client
      .from('firecrawl_draft_jobs')
      .upsert(batchDraftData, { onConflict: 'staged_item_id' })
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

// ============ purge-high-duplicates ============

async function handlePurgeHighDuplicates(
  body: Record<string, unknown>,
  client: ReturnType<typeof createClient>
) {
  console.log('[firecrawl-ingest] purge-high-duplicates: starting');

  const { data: allDrafts, error } = await client
    .from('firecrawl_draft_jobs')
    .select('id, normalized_title, organization_name, official_notification_url, official_apply_url, last_date_of_application, total_vacancies, created_at')
    .in('status', ['draft', 'reviewed'])
    .order('created_at', { ascending: true });

  if (error) return jsonResponse({ error: error.message }, 500);
  if (!allDrafts || allDrafts.length === 0) {
    return jsonResponse({ success: true, checked: 0, deleted: 0, message: 'No drafts to check' });
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

  const idsToDelete = new Set<string>();
  const idsToKeep = new Set<string>();

  for (const draft of allDrafts) {
    if (idsToDelete.has(draft.id)) continue;

    const target: DedupCandidate = {
      id: draft.id,
      normalized_title: (draft as any).normalized_title,
      organization_name: (draft as any).organization_name,
      official_notification_url: (draft as any).official_notification_url,
      official_apply_url: (draft as any).official_apply_url,
      last_date_of_application: (draft as any).last_date_of_application,
      total_vacancies: (draft as any).total_vacancies,
    };

    const result = checkDuplicate(target, candidates);

    if (result.isDuplicate && result.confidence === 'high') {
      idsToKeep.add(draft.id);
      for (const matchId of result.matchedIds) {
        if (!matchId.startsWith('rss:') && !matchId.startsWith('en:') && !idsToKeep.has(matchId)) {
          idsToDelete.add(matchId);
        }
      }
    }
  }

  let deleted = 0;
  if (idsToDelete.size > 0) {
    const deleteArr = Array.from(idsToDelete);
    for (let i = 0; i < deleteArr.length; i += 50) {
      const batch = deleteArr.slice(i, i + 50);
      const { error: delErr } = await client
        .from('firecrawl_draft_jobs')
        .delete()
        .in('id', batch);
      if (!delErr) deleted += batch.length;
      else console.error('[purge-high-duplicates] delete error:', delErr.message);
    }
  }

  console.log(`[purge-high-duplicates] checked=${allDrafts.length}, deleted=${deleted}, kept=${idsToKeep.size}`);

  return jsonResponse({
    success: true,
    checked: allDrafts.length,
    deleted,
    kept: idsToKeep.size,
    message: `Purged ${deleted} high-confidence duplicate(s), kept ${idsToKeep.size} original(s).`,
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

  if (!draft.title || draft.title.length < 10) errors.push('Title missing or too short (<10 chars)');
  if (!draft.organization_name) errors.push('Organization name is missing');
  if (!draft.post_name && !draft.total_vacancies) errors.push('Either post_name or total_vacancies must exist');
  if (!draft.last_date_of_application) warnings.push('Last date of application is missing');
  if (draft.extraction_confidence === 'none') errors.push('Extraction confidence is "none" — unreliable data');
  if (draft.extraction_confidence === 'low') warnings.push('Extraction confidence is "low" — review carefully');
  if (draft.dedup_status === 'duplicate') errors.push('Draft is flagged as duplicate — resolve before approving');

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

// ============ discover-govt ============

async function handleDiscoverGovt(
  body: Record<string, unknown>,
  client: ReturnType<typeof createClient>
) {
  const sourceId = body.source_id as string;
  if (!sourceId) return jsonResponse({ error: 'source_id required' }, 400);

  const { data: source } = await client.from('firecrawl_sources').select('*').eq('id', sourceId).single();
  if (!source) return jsonResponse({ error: 'Source not found' }, 404);

  const peak = isPeak(source.source_type);
  const maxPages = source.max_pages_per_run || (peak ? 250 : 50);
  console.log(`[firecrawl-ingest] discover-govt: ${source.source_name} (peak=${peak}, max: ${maxPages})`);

  const { data: run } = await client
    .from('firecrawl_fetch_runs')
    .insert({ firecrawl_source_id: source.id, run_mode: 'manual_admin', status: 'running' })
    .select('id').single();
  const runId = run?.id;

  const stats = { linksDiscovered: 0, scored: 0, staged: 0, duplicateUrls: 0, pdfLinks: 0, errors: 0, bucketCounts: {} as Record<string, number> };

  try {
    let discoveredLinks: string[] = [];
    if (source.crawl_mode === 'map') {
      // Aggressive: peak uses *20 cap 10000, normal uses *10 cap 2000
      const mapLimit = peak ? Math.min(maxPages * 20, 10_000) : Math.min(maxPages * 10, 2000);
      const mapResult = await mapUrl(source.seed_url, { limit: mapLimit, includeSubdomains: false });
      if (!mapResult.success) {
        const errMsg = mapResult.error || 'Map failed';
        if (runId) await finalizeRun(client, runId, 'error', { errorLog: errMsg });
        await updateSourceAfterFetch(client, source.id, errMsg);
        return jsonResponse({ success: false, error: errMsg });
      }
      discoveredLinks = mapResult.links || [];
    } else {
      const scrapeResult = await throttledScrapePage(source.seed_url, { formats: ['markdown', 'links'], onlyMainContent: true });
      if (!scrapeResult.success) {
        const errMsg = scrapeResult.error || 'Scrape failed';
        if (runId) await finalizeRun(client, runId, 'error', { errorLog: errMsg });
        await updateSourceAfterFetch(client, source.id, errMsg);
        return jsonResponse({ success: false, error: errMsg });
      }
      discoveredLinks = scrapeResult.links || [];
    }

    stats.linksDiscovered = discoveredLinks.length;

    const { data: existingItems } = await client
      .from('firecrawl_staged_items')
      .select('url_normalized')
      .eq('firecrawl_source_id', source.id)
      .not('url_normalized', 'is', null);
    const existingNormalized = new Set<string>((existingItems || []).map((i: any) => i.url_normalized).filter(Boolean));

    const allowedDomains = source.allowed_domains || [];

    const scored: { url: string; normalized: string; score: number; isPdf: boolean }[] = [];
    for (const link of discoveredLinks) {
      const norm = normalizeUrl(link);
      if (!norm) continue;
      if (existingNormalized.has(norm)) { stats.duplicateUrls++; continue; }
      if (!isDomainAllowed(norm, allowedDomains)) continue;

      const isPdf = norm.toLowerCase().endsWith('.pdf');
      const score = scoreGovtPage(norm);
      if (score > 0 || isPdf) {
        scored.push({ url: link, normalized: norm, score, isPdf });
        if (isPdf) stats.pdfLinks++;
      }
    }

    stats.scored = scored.length;

    scored.sort((a, b) => b.score - a.score);
    const candidates = scored.slice(0, maxPages);

    for (const candidate of candidates) {
      const classification = classifyPage(candidate.normalized, null);
      const bucket = candidate.isPdf ? 'single_recruitment' : classification.bucket;
      stats.bucketCounts[bucket] = (stats.bucketCounts[bucket] || 0) + 1;

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
            metadata: { govt_score: candidate.score },
            content_hash: null,
            status: 'staged',
            bucket,
            classification_reason: candidate.isPdf ? 'PDF notice link' : classification.reason,
            classification_signals: candidate.isPdf ? ['pdf'] : classification.signals,
            discovered_from_url: source.seed_url,
            govt_discovery_meta: { is_pdf: candidate.isPdf, govt_score: candidate.score },
          });

        if (insertError) {
          if (insertError.code === '23505') stats.duplicateUrls++;
          else { console.error('[discover-govt] Insert error:', insertError.message); stats.errors++; }
        } else {
          stats.staged++;
          existingNormalized.add(candidate.normalized);
        }
      } catch (e) {
        stats.errors++;
      }
    }

    const runStatus = stats.errors > 0 ? 'partial' : 'success';
    if (runId) await finalizeRun(client, runId, runStatus, {
      pagesFetched: 1, itemsFound: stats.linksDiscovered, itemsNew: stats.staged,
      itemsSkipped: stats.duplicateUrls, bucketCounts: stats.bucketCounts,
      errorLog: stats.errors > 0 ? `${stats.errors} errors` : null,
    });
    await updateSourceAfterFetch(client, source.id, null, stats.staged);

    return jsonResponse({ success: true, stats });
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e);
    if (runId) await finalizeRun(client, runId, 'error', { errorLog: errMsg });
    await updateSourceAfterFetch(client, source.id, errMsg);
    return jsonResponse({ success: false, error: errMsg }, 500);
  }
}

// ============ govt-scrape-extract ============

async function handleGovtScrapeExtract(
  body: Record<string, unknown>,
  client: ReturnType<typeof createClient>
) {
  const sourceId = body.source_id as string;
  if (!sourceId) return jsonResponse({ error: 'source_id required' }, 400);

  const maxItems = Math.min(Math.max((body.max_items as number) || 20, 1), 50);

  const { data: source } = await client.from('firecrawl_sources').select('*').eq('id', sourceId).single();
  if (!source) return jsonResponse({ error: 'Source not found' }, 404);

  const { data: items, error } = await client
    .from('firecrawl_staged_items')
    .select('id, page_url, url_normalized, govt_discovery_meta, content_hash')
    .eq('firecrawl_source_id', sourceId)
    .eq('bucket', 'single_recruitment')
    .eq('status', 'staged')
    .eq('extraction_status', 'pending')
    .is('extracted_markdown', null)
    .order('created_at', { ascending: true })
    .limit(maxItems);

  if (error) return jsonResponse({ error: error.message }, 500);
  if (!items || items.length === 0) {
    return jsonResponse({ success: true, message: 'No pending items', scraped: 0, extracted: 0 });
  }

  console.log(`[firecrawl-ingest] govt-scrape-extract: ${items.length} items for ${source.source_name}`);

  let scraped = 0, extracted = 0, failed = 0;
  let pdfFollowUps = 0, unchangedSkips = 0, weakExtractions = 0, strongExtractions = 0, domainCooldowns = 0;
  const results: any[] = [];

  for (const item of items) {
    // Domain cooldown check
    const domain = extractDomainFromUrl(item.page_url);
    const fails = domainFailCount.get(domain) || 0;
    if (fails >= DOMAIN_COOLDOWN_THRESHOLD) {
      domainCooldowns++;
      results.push({ url: item.page_url, status: 'domain_cooldown' });
      continue;
    }

    try {
      const scrapeResult = await throttledScrapePage(item.page_url, {
        formats: ['markdown', 'links'],
        onlyMainContent: true,
      });

      if (!scrapeResult.success || !scrapeResult.markdown) {
        failed++;
        results.push({ url: item.page_url, status: 'scrape_failed', error: scrapeResult.error });
        continue;
      }

      scraped++;
      const contentHash = await generateContentHash(scrapeResult.markdown);

      // Content-hash skip
      if (item.content_hash && item.content_hash === contentHash) {
        unchangedSkips++;
        results.push({ url: item.page_url, status: 'unchanged_skip' });
        continue;
      }

      await client.from('firecrawl_staged_items').update({
        page_title: scrapeResult.metadata?.title || null,
        extracted_markdown: scrapeResult.markdown.substring(0, 100_000),
        extracted_links: scrapeResult.links?.slice(0, 200) || [],
        content_hash: contentHash,
        metadata: scrapeResult.metadata || {},
      }).eq('id', item.id);

      // Extract fields
      let markdown = scrapeResult.markdown;
      let links = scrapeResult.links || [];
      const cleanResult = cleanScrapedContent(markdown);
      const linkInfos = cleanResult.extractedLinks.map(l => ({ text: l.text, url: l.url, context: l.context }));
      let extraction = extractFields(cleanResult.cleanedText, linkInfos, scrapeResult.metadata?.title, item.page_url);

      // PDF follow-up: if extraction is weak and links contain PDFs from same domain
      if (extraction.confidence === 'low' && links.length > 0) {
        const sourceDomain = extractDomainFromUrl(item.page_url);
        const pdfLinks = links.filter(l => {
          const lLower = l.toLowerCase();
          return lLower.endsWith('.pdf') && extractDomainFromUrl(l) === sourceDomain;
        });

        if (pdfLinks.length > 0) {
          // Score PDFs and pick the best one
          const bestPdf = pdfLinks
            .map(l => ({ url: l, score: scoreGovtPage(l) }))
            .sort((a, b) => b.score - a.score)[0];

          console.log(`[govt-scrape-extract] PDF follow-up for ${item.page_url}: trying ${bestPdf.url}`);

          const pdfResult = await throttledScrapePage(bestPdf.url, { formats: ['markdown'], onlyMainContent: true });
          if (pdfResult.success && pdfResult.markdown) {
            pdfFollowUps++;
            const mergedText = markdown + '\n\n--- PDF CONTENT ---\n\n' + pdfResult.markdown;
            const mergedClean = cleanScrapedContent(mergedText);
            const mergedLinkInfos = mergedClean.extractedLinks.map(l => ({ text: l.text, url: l.url, context: l.context }));
            const mergedExtraction = extractFields(mergedClean.cleanedText, mergedLinkInfos, scrapeResult.metadata?.title, item.page_url);

            // Use merged extraction only if it improved
            if (mergedExtraction.fields_extracted > extraction.fields_extracted) {
              extraction = mergedExtraction;
              markdown = mergedText;
              console.log(`[govt-scrape-extract] PDF follow-up improved extraction: ${extraction.fields_extracted} fields (was ${extraction.fields_extracted})`);
            }
          }
        }
      }

      // Track extraction quality
      if (extraction.confidence === 'high' || extraction.confidence === 'medium') strongExtractions++;
      else weakExtractions++;

      // Check if extraction produced a valid job
      if (!extraction.fields.title && !extraction.fields.organization_name && !extraction.fields.post_name) {
        await client.from('firecrawl_staged_items').update({ extraction_status: 'skipped' }).eq('id', item.id);
        results.push({ url: item.page_url, status: 'skipped', reason: 'No job data extracted' });
        continue;
      }

      const rawDraft: Record<string, unknown> = {
        staged_item_id: item.id,
        firecrawl_source_id: source.id,
        source_name: (source.govt_meta as any)?.domain_label || source.source_name || null,
        source_url: item.page_url,
        source_seed_url: source.seed_url,
        source_page_url: source.seed_url,
        source_bucket: 'single_recruitment',
        source_type_tag: 'government',
        ...extraction.fields,
        extraction_confidence: extraction.confidence,
        fields_extracted: extraction.fields_extracted,
        fields_missing: extraction.fields_missing,
        extraction_warnings: extraction.warnings,
        raw_scraped_text: markdown.substring(0, 200_000),
        raw_links_found: (scrapeResult.links || []).slice(0, 500),
        extracted_raw_fields: extraction.raw_fields,
        cleaning_log: cleanResult.cleaningLog,
        status: 'draft',
      };

      const sanitizeResult = sanitizeDraftFields(rawDraft);
      const draftData = {
        ...rawDraft,
        ...sanitizeResult.sanitizedFields,
        tp_clean_status: sanitizeResult.totalTraces > 0 ? 'pending' : 'cleaned',
        tp_cleaned_at: sanitizeResult.totalTraces === 0 ? new Date().toISOString() : null,
        tp_contamination_count: sanitizeResult.totalTraces,
        tp_clean_log: sanitizeResult.totalTraces > 0 ? [{ action: 'govt-auto', traces: sanitizeResult.traceDetails.slice(0, 30) }] : [],
      };

      const { data: draft, error: draftError } = await client
        .from('firecrawl_draft_jobs')
        .upsert(draftData, { onConflict: 'staged_item_id' })
        .select('id')
        .single();

      if (draftError) {
        await client.from('firecrawl_staged_items').update({ extraction_status: 'failed' }).eq('id', item.id);
        failed++;
        results.push({ url: item.page_url, status: 'extract_failed', error: draftError.message });
      } else {
        await client.from('firecrawl_staged_items').update({ extraction_status: 'extracted' }).eq('id', item.id);
        extracted++;
        results.push({ url: item.page_url, status: 'extracted', draft_id: draft.id, confidence: extraction.confidence });
      }

      // Rate limit: 1 second between govt scrapes (reduced from 2s for faster batch processing)
      await new Promise(r => setTimeout(r, 1000));
    } catch (e) {
      failed++;
      results.push({ url: item.page_url, status: 'error', error: e instanceof Error ? e.message : String(e) });
    }
  }

  return jsonResponse({
    success: true,
    total: items.length,
    scraped,
    extracted,
    failed,
    pdfFollowUps,
    unchangedSkips,
    weakExtractions,
    strongExtractions,
    domainCooldowns,
    results,
  });
}

// ============ govt-run-all ============

async function handleGovtRunAll(
  body: Record<string, unknown>,
  client: ReturnType<typeof createClient>
) {
  const phase = (body.phase as string) || 'full';
  const sourceIds = body.source_ids as string[] | undefined;

  let query = client.from('firecrawl_sources').select('id, source_name').eq('source_type', 'government').eq('is_enabled', true);
  if (sourceIds && sourceIds.length > 0) {
    query = client.from('firecrawl_sources').select('id, source_name').eq('source_type', 'government').in('id', sourceIds);
  }
  const { data: sources, error } = await query;
  if (error) return jsonResponse({ error: error.message }, 500);
  if (!sources || sources.length === 0) {
    return jsonResponse({ success: true, message: 'No enabled government sources found', results: [] });
  }

  console.log(`[firecrawl-ingest] govt-run-all: ${sources.length} sources, phase=${phase}`);

  const perSourceResults: any[] = [];

  for (const src of sources) {
    const srcResult: any = { source_id: src.id, source_name: src.source_name };

    try {
      if (phase === 'discover' || phase === 'full') {
        const discoverResp = await handleDiscoverGovt({ source_id: src.id }, client);
        const discoverData = await discoverResp.json();
        srcResult.discover = { success: discoverData.success, stats: discoverData.stats, error: discoverData.error };
      }

      if (phase === 'scrape-extract' || phase === 'full') {
        const seResp = await handleGovtScrapeExtract({ source_id: src.id, max_items: 20 }, client);
        const seData = await seResp.json();
        srcResult.scrape_extract = {
          success: seData.success, scraped: seData.scraped, extracted: seData.extracted, failed: seData.failed,
          pdfFollowUps: seData.pdfFollowUps, unchangedSkips: seData.unchangedSkips,
          weakExtractions: seData.weakExtractions, strongExtractions: seData.strongExtractions,
          domainCooldowns: seData.domainCooldowns,
          error: seData.error,
        };
      }
    } catch (e) {
      srcResult.error = e instanceof Error ? e.message : String(e);
    }

    perSourceResults.push(srcResult);

    // 3-second delay between govt sources
    await new Promise(r => setTimeout(r, 3000));
  }

  return jsonResponse({
    success: true,
    phase,
    total_sources: sources.length,
    results: perSourceResults,
  });
}

// ============ recovery-pass ============

async function handleRecoveryPass(
  body: Record<string, unknown>,
  client: ReturnType<typeof createClient>
) {
  const sourceTypeTag = (body.source_type_tag as string) || null;
  const maxAttempts = Math.min((body.max_items as number) || RECOVERY_MAX_PER_RUN, RECOVERY_MAX_PER_RUN);

  console.log(`[firecrawl-ingest] recovery-pass: max=${maxAttempts}, source_type_tag=${sourceTypeTag || 'all'}`);

  // Find weak drafts that haven't been recovery-attempted
  let query = client
    .from('firecrawl_draft_jobs')
    .select('id, raw_scraped_text, raw_links_found, source_url, extraction_confidence, fields_extracted, firecrawl_source_id')
    .in('extraction_confidence', ['low', 'none'])
    .lt('fields_extracted', 8)
    .is('recovery_attempted_at', null)
    .in('status', ['draft', 'reviewed'])
    .order('created_at', { ascending: true })
    .limit(maxAttempts);

  if (sourceTypeTag) {
    query = query.eq('source_type_tag', sourceTypeTag);
  }

  const { data: weakDrafts, error } = await query;
  if (error) return jsonResponse({ error: error.message }, 500);
  if (!weakDrafts || weakDrafts.length === 0) {
    return jsonResponse({ success: true, message: 'No weak drafts to recover', attempted: 0, improved: 0 });
  }

  let attempted = 0;
  let improved = 0;
  let pdfFollowUps = 0;
  let detailFollowUps = 0;
  const results: any[] = [];

  for (const draft of weakDrafts) {
    attempted++;
    const links = (draft.raw_links_found as string[]) || [];

    // Find best recovery candidate from links
    const recruitmentPatterns = ['/notification/', '/pdf/', '/detail/', '/recruitment/', '/vacancy/', '/career/', '/circular/', '/notice/'];
    const sourceDomain = extractDomainFromUrl(draft.source_url || '');

    const recoveryLinks = links
      .filter(l => {
        const lLower = l.toLowerCase();
        const linkDomain = extractDomainFromUrl(l);
        // Same domain or PDF from any domain
        return (linkDomain === sourceDomain || lLower.endsWith('.pdf')) &&
          (recruitmentPatterns.some(p => lLower.includes(p)) || lLower.endsWith('.pdf'));
      })
      .map(l => ({ url: l, score: scoreGovtPage(l), isPdf: l.toLowerCase().endsWith('.pdf') }))
      .sort((a, b) => b.score - a.score);

    if (recoveryLinks.length === 0) {
      // Mark as attempted so we don't retry
      await client.from('firecrawl_draft_jobs').update({ recovery_attempted_at: new Date().toISOString() }).eq('id', draft.id);
      results.push({ draft_id: draft.id, status: 'no_recovery_links' });
      continue;
    }

    const bestLink = recoveryLinks[0];
    const isPdf = bestLink.isPdf;

    try {
      const scrapeResult = await throttledScrapePage(bestLink.url, { formats: ['markdown'], onlyMainContent: true });
      if (!scrapeResult.success || !scrapeResult.markdown) {
        await client.from('firecrawl_draft_jobs').update({ recovery_attempted_at: new Date().toISOString() }).eq('id', draft.id);
        results.push({ draft_id: draft.id, status: 'scrape_failed', url: bestLink.url });
        continue;
      }

      if (isPdf) pdfFollowUps++;
      else detailFollowUps++;

      // Merge original text with recovery content
      const originalText = (draft.raw_scraped_text as string) || '';
      const mergedText = originalText + '\n\n--- RECOVERY CONTENT ---\n\n' + scrapeResult.markdown;

      const mergedClean = cleanScrapedContent(mergedText);
      const mergedLinkInfos = mergedClean.extractedLinks.map(l => ({ text: l.text, url: l.url, context: l.context }));
      const newExtraction = extractFields(mergedClean.cleanedText, mergedLinkInfos, null, draft.source_url || '');

      // Only update if improvement
      if (newExtraction.fields_extracted > (draft.fields_extracted || 0)) {
        improved++;
        await client.from('firecrawl_draft_jobs').update({
          ...newExtraction.fields,
          extraction_confidence: newExtraction.confidence,
          fields_extracted: newExtraction.fields_extracted,
          fields_missing: newExtraction.fields_missing,
          extraction_warnings: [...(newExtraction.warnings || []), `Recovery improved from ${draft.fields_extracted} to ${newExtraction.fields_extracted} fields via ${isPdf ? 'PDF' : 'detail page'}`],
          raw_scraped_text: mergedText.substring(0, 200_000),
          recovery_attempted_at: new Date().toISOString(),
        }).eq('id', draft.id);

        results.push({
          draft_id: draft.id, status: 'improved',
          from_fields: draft.fields_extracted, to_fields: newExtraction.fields_extracted,
          recovery_url: bestLink.url, type: isPdf ? 'pdf' : 'detail',
        });
      } else {
        await client.from('firecrawl_draft_jobs').update({ recovery_attempted_at: new Date().toISOString() }).eq('id', draft.id);
        results.push({ draft_id: draft.id, status: 'no_improvement', url: bestLink.url });
      }
    } catch (e) {
      await client.from('firecrawl_draft_jobs').update({ recovery_attempted_at: new Date().toISOString() }).eq('id', draft.id);
      results.push({ draft_id: draft.id, status: 'error', error: e instanceof Error ? e.message : String(e) });
    }
  }

  return jsonResponse({
    success: true,
    attempted,
    improved,
    pdfFollowUps,
    detailFollowUps,
    results,
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
