/**
 * rss-firecrawl-enrich — Selective Firecrawl enrichment + AI decision layer
 * 
 * Actions:
 *   enrich-items: Accept array of rss_item_ids (max 10), scrape each qualifying item
 *   ai-decide:    Run Stage One AI decision only (no Firecrawl), for manual triggers
 * 
 * Auth: JWT admin or x-cron-secret
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { scrapePage } from '../_shared/firecrawl/client.ts';
import {
  computeBand,
  runStageOne,
  runStageTwo,
  hasSubstantiveContent,
  type StageOneOutput,
  type StageTwoOutput,
} from '../_shared/rss/ai-decision.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
};

const MAX_ITEMS_PER_CALL = 10;
const FRESHNESS_HOURS = 24;
const MIN_MARKDOWN_LENGTH = 50;

// Core TrueJobs item types that justify enrichment
const CORE_ENRICH_TYPES = new Set([
  'recruitment', 'vacancy', 'exam', 'admit_card', 'result', 'answer_key',
]);

// Non-core domains — skip enrichment unless item_type is core
const NON_CORE_DOMAINS = new Set([
  'policy_updates', 'public_services', 'general_alerts', 'education_services',
]);

function shouldEnrich(
  item: Record<string, unknown>,
  manual: boolean,
  sourceUsefulnessScore?: number
): EnrichDecision {
  if (manual) return { should: true, reason: 'manual' };

  const relevance = item.relevance_level as string;
  const domain = (item.primary_domain as string) || 'general_alerts';
  const itemType = (item.item_type as string) || 'unknown';
  const skipReason = (item.skip_reason as string) || '';

  // Noise-rejected items: never enrich
  if (skipReason === 'noise_rejected') {
    return { should: false, reason: 'noise_rejected' };
  }

  // Source usefulness gating: skip enrichment for non-core types from chronically noisy sources
  if (sourceUsefulnessScore !== undefined && sourceUsefulnessScore < 15 && !CORE_ENRICH_TYPES.has(itemType) && relevance !== 'High') {
    return { should: false, reason: 'source_low_usefulness' };
  }

  // Non-core domains: only enrich if item_type is core recruitment/exam type
  if (NON_CORE_DOMAINS.has(domain) && !CORE_ENRICH_TYPES.has(itemType)) {
    return { should: false, reason: 'non_core_domain' };
  }

  // Core types always qualify
  if (CORE_ENRICH_TYPES.has(itemType)) {
    return { should: true, reason: 'core_type' };
  }

  if (relevance === 'High') {
    return { should: true, reason: 'high_relevance' };
  }

  // Medium relevance: only if summary is weak or has PDF
  if (relevance === 'Medium') {
    const summary = (item.item_summary as string) || '';
    if (summary.length < 80) return { should: true, reason: 'medium_weak_summary' };
    if (item.first_pdf_url) return { should: true, reason: 'medium_with_pdf' };
    return { should: true, reason: 'medium_relevance' };
  }

  // Low relevance with PDF — only for recruitment/exam context
  if (item.first_pdf_url && (relevance === 'High' || relevance === 'Medium')) {
    return { should: true, reason: 'direct_pdf' };
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

    const authOk = await checkAuth(req, supabaseUrl, serviceRoleKey, cronSecret);
    if (!authOk) {
      return jsonRes({ error: 'Unauthorized' }, 401);
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    if (action === 'enrich-items') {
      const itemIds = body.item_ids as string[];
      const force = body.force === true;

      if (!Array.isArray(itemIds) || itemIds.length === 0) {
        return jsonRes({ error: 'item_ids array required' }, 400);
      }
      if (itemIds.length > MAX_ITEMS_PER_CALL) {
        return jsonRes({ error: `Max ${MAX_ITEMS_PER_CALL} items per call` }, 400);
      }

      const results = await enrichItems(adminClient, itemIds, force);
      return jsonRes({ success: true, results });
    }

    if (action === 'ai-decide') {
      const itemIds = body.item_ids as string[];
      const force = body.force === true;

      if (!Array.isArray(itemIds) || itemIds.length === 0) {
        return jsonRes({ error: 'item_ids array required' }, 400);
      }
      if (itemIds.length > MAX_ITEMS_PER_CALL) {
        return jsonRes({ error: `Max ${MAX_ITEMS_PER_CALL} items per call` }, 400);
      }

      const results = await aiDecideOnly(adminClient, itemIds, force);
      return jsonRes({ success: true, results });
    }

    return jsonRes({ error: `Unknown action: ${action}` }, 400);
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
  const headerSecret = req.headers.get('x-cron-secret');
  if (headerSecret && cronSecret && headerSecret === cronSecret) return true;

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

// ── AI Decide Only (Stage One) ──

interface AiDecideResult {
  itemId: string;
  status: string;
  band?: string;
  decision?: StageOneOutput;
  error?: string;
}

async function aiDecideOnly(
  client: ReturnType<typeof createClient>,
  itemIds: string[],
  force: boolean
): Promise<AiDecideResult[]> {
  const results: AiDecideResult[] = [];

  const { data: items, error } = await client
    .from('rss_items')
    .select('*')
    .in('id', itemIds);

  if (error || !items) {
    return itemIds.map(id => ({ itemId: id, status: 'failed', error: error?.message || 'Items not found' }));
  }

  const itemMap = new Map(items.map((i: any) => [i.id, i]));

  for (const itemId of itemIds) {
    const item = itemMap.get(itemId);
    if (!item) {
      results.push({ itemId, status: 'failed', error: 'Item not found' });
      continue;
    }

    try {
      const bandResult = computeBand(item, force);

      if (bandResult.band !== 'band_2') {
        // Deterministic band — just record it
        await client.from('rss_items').update({
          ai_decision_status: 'skipped',
          ai_decision_band: bandResult.band,
        }).eq('id', itemId);
        results.push({ itemId, status: 'skipped', band: bandResult.band });
        continue;
      }

      // Band 2: call Mistral Stage One
      await client.from('rss_items').update({
        ai_decision_status: 'pending',
        ai_decision_band: 'band_2',
        ai_error: null,
      }).eq('id', itemId);

      const aiResult = await runStageOne(item);
      const now = new Date().toISOString();

      if (aiResult.success && aiResult.data) {
        await client.from('rss_items').update({
          ai_decision_status: 'stage_one_done',
          ai_stage_one_json: aiResult.data as any,
          ai_stage_one_confidence: aiResult.data.confidence,
          ai_stage_one_reason: aiResult.data.reason_text,
          ai_stage_one_decided_at: now,
          ai_firecrawl_decision: aiResult.data.crawl_target,
          ai_queue_priority: aiResult.data.queue_priority,
          ai_model_used: aiResult.model,
          ai_error: null,
        }).eq('id', itemId);
        results.push({ itemId, status: 'stage_one_done', band: 'band_2', decision: aiResult.data });
      } else {
        await client.from('rss_items').update({
          ai_decision_status: 'failed',
          ai_error: aiResult.error?.substring(0, 1000),
          ai_model_used: aiResult.model,
        }).eq('id', itemId);
        results.push({ itemId, status: 'failed', band: 'band_2', error: aiResult.error });
      }
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      await client.from('rss_items').update({
        ai_decision_status: 'failed',
        ai_error: errMsg.substring(0, 1000),
      }).eq('id', itemId);
      results.push({ itemId, status: 'failed', error: errMsg });
    }
  }

  return results;
}

// ── Core enrichment ──

interface EnrichResult {
  itemId: string;
  status: string;
  reason: string;
  aiStageOne?: string;
  aiStageTwo?: string;
  error?: string;
}

async function enrichItems(
  client: ReturnType<typeof createClient>,
  itemIds: string[],
  force: boolean
): Promise<EnrichResult[]> {
  const results: EnrichResult[] = [];

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
  force: boolean,
  sourceUsefulnessScore?: number
): Promise<EnrichResult> {
  const itemId = item.id as string;

  // ── Band computation ──
  const bandResult = computeBand(item, force);
  let aiStageOneStatus = '';

  // Band 1 low: skip enrichment entirely
  if (bandResult.band === 'band_1_low' && !force) {
    await client.from('rss_items').update({
      firecrawl_status: 'skipped',
      firecrawl_reason: 'band_1_low',
      ai_decision_status: 'skipped',
      ai_decision_band: 'band_1_low',
    }).eq('id', itemId);
    return { itemId, status: 'skipped', reason: 'band_1_low' };
  }

  // Band 2: run AI Stage One if not already done
  if (bandResult.band === 'band_2') {
    const existingAiStatus = item.ai_decision_status as string;
    if (existingAiStatus !== 'stage_one_done' && existingAiStatus !== 'stage_two_done') {
      console.log(`[rss-firecrawl-enrich] Running AI Stage One for item=${itemId}`);
      const aiResult = await runStageOne(item);
      const now = new Date().toISOString();

      if (aiResult.success && aiResult.data) {
        await client.from('rss_items').update({
          ai_decision_status: 'stage_one_done',
          ai_decision_band: 'band_2',
          ai_stage_one_json: aiResult.data as any,
          ai_stage_one_confidence: aiResult.data.confidence,
          ai_stage_one_reason: aiResult.data.reason_text,
          ai_stage_one_decided_at: now,
          ai_firecrawl_decision: aiResult.data.crawl_target,
          ai_queue_priority: aiResult.data.queue_priority,
          ai_model_used: aiResult.model,
          ai_error: null,
        }).eq('id', itemId);
        aiStageOneStatus = 'done';

        // If AI says skip enrichment and it's not forced, skip
        if (!aiResult.data.should_use_firecrawl && !force) {
          await client.from('rss_items').update({
            firecrawl_status: 'skipped',
            firecrawl_reason: `ai_skip:${aiResult.data.reason_code}`,
          }).eq('id', itemId);
          return { itemId, status: 'skipped', reason: `ai_skip:${aiResult.data.reason_code}`, aiStageOne: 'done' };
        }
      } else {
        // AI failed — fall back to deterministic rules
        await client.from('rss_items').update({
          ai_decision_status: 'failed',
          ai_decision_band: 'band_2',
          ai_error: aiResult.error?.substring(0, 1000),
          ai_model_used: aiResult.model,
        }).eq('id', itemId);
        aiStageOneStatus = 'failed';
        console.warn(`[rss-firecrawl-enrich] AI Stage One failed for item=${itemId}, falling back to deterministic rules`);
      }
    } else {
      aiStageOneStatus = 'pre-existing';
      // Check pre-existing AI decision
      if (existingAiStatus === 'stage_one_done') {
        const existingJson = item.ai_stage_one_json as StageOneOutput | null;
        if (existingJson && !existingJson.should_use_firecrawl && !force) {
          return { itemId, status: 'skipped', reason: 'ai_pre_existing_skip', aiStageOne: 'pre-existing' };
        }
      }
    }
  } else {
    // Band 1 high: record band, proceed with deterministic rules
    await client.from('rss_items').update({
      ai_decision_status: 'skipped',
      ai_decision_band: bandResult.band,
    }).eq('id', itemId);
  }

  // ── Deterministic enrichment decision (baseline) ──
  const decision = shouldEnrich(item, force);
  if (!decision.should) {
    await client.from('rss_items').update({
      firecrawl_status: 'skipped',
      firecrawl_reason: decision.reason,
    }).eq('id', itemId);
    return { itemId, status: 'skipped', reason: decision.reason, aiStageOne: aiStageOneStatus || undefined };
  }

  // Freshness check
  if (!force && item.firecrawl_status === 'success' && item.firecrawl_last_run_at) {
    const lastRun = new Date(item.firecrawl_last_run_at as string);
    const hoursAgo = (Date.now() - lastRun.getTime()) / (1000 * 60 * 60);
    if (hoursAgo < FRESHNESS_HOURS) {
      return { itemId, status: 'skipped', reason: 'already_fresh', aiStageOne: aiStageOneStatus || undefined };
    }
  }

  // ── Firecrawl execution ──
  await client.from('rss_items').update({
    firecrawl_status: 'running',
    firecrawl_reason: decision.reason,
    firecrawl_error: null,
  }).eq('id', itemId);

  // Determine URL — AI may override crawl target
  const aiDecision = item.ai_stage_one_json as StageOneOutput | null;
  let scrapeUrl: string | null = null;

  if (aiDecision?.crawl_target === 'pdf' && item.first_pdf_url) {
    scrapeUrl = item.first_pdf_url as string;
  } else if (aiDecision?.crawl_target === 'page' && item.item_link) {
    scrapeUrl = item.item_link as string;
  } else {
    // Default: prefer PDF, fall back to link
    scrapeUrl = (item.first_pdf_url as string | null) || (item.item_link as string | null);
  }

  if (!scrapeUrl) {
    await client.from('rss_items').update({
      firecrawl_status: 'failed',
      firecrawl_error: 'No URL available to scrape',
      firecrawl_last_run_at: new Date().toISOString(),
    }).eq('id', itemId);
    return { itemId, status: 'failed', reason: 'no_url', error: 'No URL available', aiStageOne: aiStageOneStatus || undefined };
  }

  const isPdf = isPdfUrl(scrapeUrl);
  const pdfMode = isPdf ? 'pdf_scrape' : null;

  console.log(`[rss-firecrawl-enrich] Scraping item=${itemId} url=${scrapeUrl} pdf=${isPdf} reason=${decision.reason}`);

  const scrapeResult = await scrapePage(scrapeUrl, {
    formats: ['markdown', 'links'],
    onlyMainContent: !isPdf,
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
    return { itemId, status: 'failed', reason: decision.reason, error: scrapeResult.error, aiStageOne: aiStageOneStatus || undefined };
  }

  const markdown = scrapeResult.markdown || '';
  const isPartial = markdown.length < MIN_MARKDOWN_LENGTH;
  const finalStatus = isPartial ? 'partial' : 'success';

  await client.from('rss_items').update({
    firecrawl_status: finalStatus,
    firecrawl_reason: decision.reason,
    firecrawl_source_url: scrapeUrl,
    firecrawl_content_markdown: markdown.substring(0, 100000),
    firecrawl_content_meta: scrapeResult.metadata || null,
    firecrawl_pdf_mode: pdfMode,
    firecrawl_error: isPartial ? 'Content too short (partial)' : null,
    firecrawl_last_run_at: now,
  }).eq('id', itemId);

  console.log(`[rss-firecrawl-enrich] Item ${itemId}: ${finalStatus}, ${markdown.length} chars`);

  // ── AI Stage Two: only if substantive content ──
  let aiStageTwoStatus = '';
  if (finalStatus === 'success' && hasSubstantiveContent(markdown) && bandResult.band === 'band_2') {
    console.log(`[rss-firecrawl-enrich] Running AI Stage Two for item=${itemId}`);
    // Re-fetch item to get updated firecrawl fields
    const { data: updatedItem } = await client.from('rss_items').select('*').eq('id', itemId).single();
    if (updatedItem) {
      const stageTwoResult = await runStageTwo(updatedItem, markdown);
      const stageTwoNow = new Date().toISOString();

      if (stageTwoResult.success && stageTwoResult.data) {
        await client.from('rss_items').update({
          ai_decision_status: 'stage_two_done',
          ai_stage_two_json: stageTwoResult.data as any,
          ai_stage_two_confidence: stageTwoResult.data.confidence,
          ai_stage_two_reason: stageTwoResult.data.reason_text,
          ai_stage_two_decided_at: stageTwoNow,
          ai_queue_priority: stageTwoResult.data.queue_priority, // Stage Two overrides
          ai_model_used: stageTwoResult.model,
          ai_error: null,
        }).eq('id', itemId);
        aiStageTwoStatus = 'done';
      } else {
        // Stage Two failure is non-blocking
        await client.from('rss_items').update({
          ai_error: `Stage2: ${stageTwoResult.error?.substring(0, 500)}`,
        }).eq('id', itemId);
        aiStageTwoStatus = 'failed';
        console.warn(`[rss-firecrawl-enrich] AI Stage Two failed for item=${itemId}: ${stageTwoResult.error}`);
      }
    }
  }

  return {
    itemId,
    status: finalStatus,
    reason: decision.reason,
    aiStageOne: aiStageOneStatus || undefined,
    aiStageTwo: aiStageTwoStatus || undefined,
  };
}

// ── Helpers ──

function jsonRes(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
