/**
 * Third Party Cleaner — Edge function for cleaning aggregator branding from firecrawl drafts.
 * Actions: clean-single, clean-batch, backfill-all
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  sanitizeDraftFields,
  detectBrandingTraces,
  isAggregatorUrl,
  sanitizeTextField,
} from '../_shared/firecrawl/branding-sanitizer.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const client = createClient(supabaseUrl, serviceRoleKey);

  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action as string;

    if (!action) return json({ error: 'Missing action' }, 400);

    switch (action) {
      case 'clean-single':
        return await handleCleanSingle(body.draft_id, client);
      case 'clean-batch':
        return await handleCleanBatch(body.draft_ids, client);
      case 'backfill-all':
        return await handleBackfillAll(client);
      default:
        return json({ error: `Unknown action: ${action}` }, 400);
    }
  } catch (e) {
    console.error('[firecrawl-cleanup-branding] Error:', e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

// ── Clean a single draft ──

async function handleCleanSingle(draftId: string, client: ReturnType<typeof createClient>) {
  if (!draftId) return json({ error: 'Missing draft_id' }, 400);

  const { data: draft, error } = await client
    .from('firecrawl_draft_jobs')
    .select('*')
    .eq('id', draftId)
    .single();

  if (error || !draft) return json({ error: 'Draft not found' }, 404);

  try {
    const result = sanitizeDraftFields(draft as Record<string, unknown>);

    // Build update payload
    const update: Record<string, unknown> = {
      ...result.sanitizedFields,
      tp_clean_status: 'cleaned',
      tp_cleaned_at: new Date().toISOString(),
      tp_contamination_count: result.totalTraces,
      tp_clean_log: [
        ...((draft.tp_clean_log as unknown[]) || []),
        {
          action: 'clean-single',
          at: new Date().toISOString(),
          traces_found: result.totalTraces,
          fields_changed: result.fieldsChanged,
          trace_details: result.traceDetails.slice(0, 50), // cap log size
        },
      ],
    };

    // Post-clean validation: re-check critical fields for remaining traces
    const postCleanTraces: string[] = [];
    const titleVal = (result.sanitizedFields.title ?? draft.title) as string;
    const orgVal = (result.sanitizedFields.organization_name ?? draft.organization_name) as string;
    if (titleVal) postCleanTraces.push(...detectBrandingTraces(titleVal));
    if (orgVal) postCleanTraces.push(...detectBrandingTraces(orgVal));

    if (postCleanTraces.length > 0) {
      update.tp_clean_status = 'failed';
      (update.tp_clean_log as unknown[]).push({
        warning: 'Post-clean validation found remaining traces',
        remaining: postCleanTraces,
      });
    }

    const { error: updateError } = await client
      .from('firecrawl_draft_jobs')
      .update(update)
      .eq('id', draftId);

    if (updateError) throw updateError;

    return json({
      success: true,
      draft_id: draftId,
      status: update.tp_clean_status,
      traces_found: result.totalTraces,
      fields_changed: result.fieldsChanged,
      trace_details: result.traceDetails.slice(0, 20),
    });
  } catch (e) {
    // Mark as failed
    await client.from('firecrawl_draft_jobs').update({
      tp_clean_status: 'failed',
      tp_clean_log: [
        ...((draft.tp_clean_log as unknown[]) || []),
        { action: 'clean-single', at: new Date().toISOString(), error: String(e) },
      ],
    }).eq('id', draftId);

    throw e;
  }
}

// ── Clean a batch of drafts ──

async function handleCleanBatch(draftIds: string[], client: ReturnType<typeof createClient>) {
  if (!Array.isArray(draftIds) || draftIds.length === 0) {
    return json({ error: 'Missing or empty draft_ids array' }, 400);
  }

  // Cap at 200 per batch
  const ids = draftIds.slice(0, 200);
  let cleaned = 0;
  let failed = 0;
  let skipped = 0;
  const errors: { id: string; error: string }[] = [];

  for (const id of ids) {
    try {
      const result = await handleCleanSingle(id, client);
      const body = await result.json();
      if (body.success && body.status === 'cleaned') {
        cleaned++;
      } else if (body.success && body.status === 'failed') {
        failed++;
      } else {
        skipped++;
      }
    } catch (e) {
      failed++;
      errors.push({ id, error: String(e) });
    }
  }

  return json({
    success: true,
    total: ids.length,
    cleaned,
    failed,
    skipped,
    errors: errors.slice(0, 10),
  });
}

// ── Backfill all uncleaned drafts ──

async function handleBackfillAll(client: ReturnType<typeof createClient>) {
  const batchSize = 100;
  let totalProcessed = 0;
  let totalCleaned = 0;
  let totalFailed = 0;
  let hasMore = true;

  while (hasMore && totalProcessed < 2000) {
    const { data: drafts, error } = await client
      .from('firecrawl_draft_jobs')
      .select('id')
      .neq('tp_clean_status', 'cleaned')
      .order('created_at', { ascending: true })
      .limit(batchSize);

    if (error) return json({ error: error.message }, 500);
    if (!drafts || drafts.length === 0) {
      hasMore = false;
      break;
    }

    for (const draft of drafts) {
      try {
        const result = await handleCleanSingle(draft.id, client);
        const body = await result.json();
        if (body.status === 'cleaned') totalCleaned++;
        else totalFailed++;
      } catch {
        totalFailed++;
      }
      totalProcessed++;
    }

    if (drafts.length < batchSize) hasMore = false;
  }

  // Also clean published employment_news_jobs from firecrawl
  let publishedCleaned = 0;
  const { data: publishedJobs } = await client
    .from('employment_news_jobs')
    .select('id, org_name, post, enriched_title, description, enriched_description, meta_title, meta_description, source')
    .eq('source', 'firecrawl')
    .limit(500);

  if (publishedJobs) {
    for (const job of publishedJobs) {
      const updates: Record<string, unknown> = { source: 'TrueJobs' };
      let changed = false;

      for (const field of ['org_name', 'post', 'enriched_title', 'description', 'enriched_description', 'meta_title', 'meta_description'] as const) {
        const val = (job as Record<string, unknown>)[field];
        if (typeof val === 'string' && val.trim()) {
          const { cleaned, tracesFound } = sanitizeTextField(val);
          if (tracesFound.length > 0) {
            updates[field] = cleaned;
            changed = true;
          }
        }
      }

      if (changed || job.source === 'firecrawl') {
        await client.from('employment_news_jobs').update(updates).eq('id', job.id);
        publishedCleaned++;
      }
    }
  }

  return json({
    success: true,
    drafts_processed: totalProcessed,
    drafts_cleaned: totalCleaned,
    drafts_failed: totalFailed,
    published_cleaned: publishedCleaned,
  });
}
