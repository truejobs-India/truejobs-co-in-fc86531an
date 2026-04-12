/**
 * rss-firecrawl-enrich — Selective Firecrawl enrichment for RSS items
 * 
 * Actions:
 *   enrich-items: Accept array of rss_item_ids (max 10), scrape each qualifying item
 * 
 * Auth: JWT admin or x-cron-secret (same as rss-ingest)
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { scrapePage } from '../_shared/firecrawl/client.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
};

const MAX_ITEMS_PER_CALL = 10;
const FRESHNESS_HOURS = 24;
const MIN_MARKDOWN_LENGTH = 50;

// ── Decision helper ──

interface EnrichDecision {
  should: boolean;
  reason: string;
}

function shouldEnrich(
  item: Record<string, unknown>,
  manual: boolean
): EnrichDecision {
  if (manual) return { should: true, reason: 'manual' };

  const relevance = item.relevance_level as string;
  if (relevance === 'High' || relevance === 'Medium') {
    return { should: true, reason: 'high_relevance' };
  }

  const summary = (item.item_summary as string) || '';
  if (summary.length < 80) {
    return { should: true, reason: 'weak_summary' };
  }

  if (item.first_pdf_url) {
    return { should: true, reason: 'direct_pdf' };
  }

  const linkedPdfs = (item.linked_pdf_urls as string[]) || [];
  if (linkedPdfs.length > 0) {
    return { should: true, reason: 'linked_pdf' };
  }

  return { should: false, reason: 'low_value' };
}

function isPdfUrl(url: string): boolean {
  try {
    const pathname = new URL(url).pathname.toLowerCase();
    return pathname.endsWith('.pdf');
  } catch {
    return url.toLowerCase().includes('.pdf');
  }
}

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
      return jsonRes({ error: 'Missing action parameter' }, 400);
    }

    // Auth check — same pattern as rss-ingest
    const authOk = await checkAuth(req, supabaseUrl, serviceRoleKey, cronSecret);
    if (!authOk) {
      return jsonRes({ error: 'Unauthorized' }, 401);
    }

    if (action !== 'enrich-items') {
      return jsonRes({ error: `Unknown action: ${action}` }, 400);
    }

    const itemIds = body.item_ids as string[];
    const force = body.force === true;

    if (!Array.isArray(itemIds) || itemIds.length === 0) {
      return jsonRes({ error: 'item_ids array required' }, 400);
    }
    if (itemIds.length > MAX_ITEMS_PER_CALL) {
      return jsonRes({ error: `Max ${MAX_ITEMS_PER_CALL} items per call` }, 400);
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const results = await enrichItems(adminClient, itemIds, force);

    return jsonRes({ success: true, results });
  } catch (e) {
    console.error('rss-firecrawl-enrich error:', e);
    return jsonRes({ error: e instanceof Error ? e.message : 'Internal error' }, 500);
  }
});

// ── Auth ──

async function checkAuth(
  req: Request,
  supabaseUrl: string,
  serviceRoleKey: string,
  cronSecret: string
): Promise<boolean> {
  // Cron secret
  const headerSecret = req.headers.get('x-cron-secret');
  if (headerSecret && cronSecret && headerSecret === cronSecret) return true;

  // JWT admin check
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return false;

  const token = authHeader.replace('Bearer ', '');
  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return false;

  const { data: roleData } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .eq('role', 'admin')
    .maybeSingle();

  return !!roleData;
}

// ── Core enrichment ──

interface EnrichResult {
  itemId: string;
  status: string;
  reason: string;
  error?: string;
}

async function enrichItems(
  client: ReturnType<typeof createClient>,
  itemIds: string[],
  force: boolean
): Promise<EnrichResult[]> {
  const results: EnrichResult[] = [];

  // Load all items
  const { data: items, error } = await client
    .from('rss_items')
    .select('*')
    .in('id', itemIds);

  if (error || !items) {
    return itemIds.map(id => ({ itemId: id, status: 'failed', reason: 'db_error', error: error?.message || 'Items not found' }));
  }

  const itemMap = new Map(items.map((i: any) => [i.id, i]));

  for (const itemId of itemIds) {
    const item = itemMap.get(itemId);
    if (!item) {
      results.push({ itemId, status: 'failed', reason: 'not_found', error: 'Item not found' });
      continue;
    }

    try {
      const result = await enrichSingleItem(client, item, force);
      results.push(result);
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      console.error(`[rss-firecrawl-enrich] Item ${itemId} error:`, errMsg);
      await client.from('rss_items').update({
        firecrawl_status: 'failed',
        firecrawl_error: errMsg.substring(0, 1000),
        firecrawl_last_run_at: new Date().toISOString(),
      }).eq('id', itemId);
      results.push({ itemId, status: 'failed', reason: 'exception', error: errMsg });
    }
  }

  return results;
}

async function enrichSingleItem(
  client: ReturnType<typeof createClient>,
  item: Record<string, unknown>,
  force: boolean
): Promise<EnrichResult> {
  const itemId = item.id as string;

  // Decision check
  const decision = shouldEnrich(item, force);
  if (!decision.should) {
    await client.from('rss_items').update({
      firecrawl_status: 'skipped',
      firecrawl_reason: decision.reason,
    }).eq('id', itemId);
    return { itemId, status: 'skipped', reason: decision.reason };
  }

  // Freshness check: skip if already success and recent (unless forced)
  if (!force && item.firecrawl_status === 'success' && item.firecrawl_last_run_at) {
    const lastRun = new Date(item.firecrawl_last_run_at as string);
    const hoursAgo = (Date.now() - lastRun.getTime()) / (1000 * 60 * 60);
    if (hoursAgo < FRESHNESS_HOURS) {
      return { itemId, status: 'skipped', reason: 'already_fresh' };
    }
  }

  // Mark as running
  await client.from('rss_items').update({
    firecrawl_status: 'running',
    firecrawl_reason: decision.reason,
    firecrawl_error: null,
  }).eq('id', itemId);

  // Determine URL to scrape: prefer PDF URL, fall back to item link
  const pdfUrl = item.first_pdf_url as string | null;
  const itemLink = item.item_link as string | null;
  const scrapeUrl = pdfUrl || itemLink;

  if (!scrapeUrl) {
    await client.from('rss_items').update({
      firecrawl_status: 'failed',
      firecrawl_error: 'No URL available to scrape',
      firecrawl_last_run_at: new Date().toISOString(),
    }).eq('id', itemId);
    return { itemId, status: 'failed', reason: 'no_url', error: 'No URL available' };
  }

  const isPdf = isPdfUrl(scrapeUrl);
  const pdfMode = isPdf ? 'pdf_scrape' : null;

  console.log(`[rss-firecrawl-enrich] Scraping item=${itemId} url=${scrapeUrl} pdf=${isPdf} reason=${decision.reason}`);

  // Call Firecrawl
  const scrapeResult = await scrapePage(scrapeUrl, {
    formats: ['markdown', 'links'],
    onlyMainContent: !isPdf, // for PDFs, get full content
  });

  const now = new Date().toISOString();

  if (!scrapeResult.success) {
    await client.from('rss_items').update({
      firecrawl_status: 'failed',
      firecrawl_reason: decision.reason,
      firecrawl_source_url: scrapeUrl,
      firecrawl_pdf_mode: pdfMode,
      firecrawl_error: scrapeResult.error || 'Scrape failed',
      firecrawl_last_run_at: now,
    }).eq('id', itemId);
    return { itemId, status: 'failed', reason: decision.reason, error: scrapeResult.error };
  }

  const markdown = scrapeResult.markdown || '';
  const isPartial = markdown.length < MIN_MARKDOWN_LENGTH;
  const finalStatus = isPartial ? 'partial' : 'success';

  await client.from('rss_items').update({
    firecrawl_status: finalStatus,
    firecrawl_reason: decision.reason,
    firecrawl_source_url: scrapeUrl,
    firecrawl_content_markdown: markdown.substring(0, 100000), // cap at 100k chars
    firecrawl_content_meta: scrapeResult.metadata || null,
    firecrawl_pdf_mode: pdfMode,
    firecrawl_error: isPartial ? 'Content too short (partial)' : null,
    firecrawl_last_run_at: now,
  }).eq('id', itemId);

  console.log(`[rss-firecrawl-enrich] Item ${itemId}: ${finalStatus}, ${markdown.length} chars`);
  return { itemId, status: finalStatus, reason: decision.reason };
}

// ── Helpers ──

function jsonRes(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
