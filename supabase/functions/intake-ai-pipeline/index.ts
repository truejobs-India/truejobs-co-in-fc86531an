/**
 * intake-ai-pipeline — Sequential per-draft AI pipeline orchestrator.
 *
 * One call = one step for one draft. The frontend orchestrator loops
 * (calling with step:'auto') until next_step is null.
 *
 * Steps: deterministic → classify → enrich → improve_title →
 *        improve_summary → generate_slug → seo_fix → validate
 *
 * Conservative skip rules + shouldOverwrite() field protection ensure
 * strong existing values are never replaced with weaker AI output.
 *
 * Concurrency: compare-and-set lock on intake_drafts.pipeline_lock_token with
 * a 2-minute stale threshold based on pipeline_started_at. 409 if already locked.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  deterministicExtract, callAI,
  CLASSIFICATION_TOOL, SYSTEM_PROMPT, FILL_EMPTY_FIELDS_PROMPT,
  TARGETED_ACTIONS, IMPORTANT_FIELDS,
  getEmptyImportantFields, getCriticalBlockers, buildFillEmptyToolSchema,
  hasSubstantialEvidence, decideNextStep, shouldOverwrite,
  PIPELINE_STEPS, type PipelineStep,
} from '../_shared/intake-ai.ts';
import { buildEnrichmentEvidence } from '../_shared/intake-evidence.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Access-Control-Max-Age': '86400',
};

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// Build evidence string identical to legacy classify path
function buildEvidence(draft: any, extra?: { hints?: string }): string {
  let structuredPayload = '';
  if (draft.structured_data_json) {
    try {
      const sd = typeof draft.structured_data_json === 'string'
        ? draft.structured_data_json
        : JSON.stringify(draft.structured_data_json);
      structuredPayload = sd.slice(0, 3000);
    } catch { /* ignore */ }
  }
  const rawHtml = draft.raw_html ? (draft.raw_html as string).slice(0, 3000) : '';
  const rawTags = draft.secondary_tags;
  const parsedTags = Array.isArray(rawTags) ? rawTags
    : (typeof rawTags === 'string' ? (() => { try { return JSON.parse(rawTags); } catch { return []; } })() : []);

  return [
    draft.raw_title ? `Title: ${draft.raw_title}` : '',
    draft.source_url ? `Source URL: ${draft.source_url}` : '',
    draft.source_domain ? `Source Domain: ${draft.source_domain}` : '',
    draft.source_name ? `Source Name: ${draft.source_name}` : '',
    draft.raw_file_url ? `File URL: ${draft.raw_file_url}` : '',
    draft.raw_text ? `Content:\n${(draft.raw_text as string).slice(0, 4000)}` : '',
    parsedTags.length > 0 ? `Import tags: ${parsedTags.join(', ')}` : '',
    structuredPayload ? `Original Import Payload:\n${structuredPayload}` : '',
    rawHtml ? `Source HTML (excerpt):\n${rawHtml}` : '',
    extra?.hints ? `Pre-extracted Hints (deterministic):\n${extra.hints}` : '',
  ].filter(Boolean).join('\n\n');
}

function buildSmallEvidence(draft: any): string {
  return [
    draft.raw_title ? `Title: ${draft.raw_title}` : '',
    draft.normalized_title ? `Current Normalized Title: ${draft.normalized_title}` : '',
    draft.organisation_name ? `Organisation: ${draft.organisation_name}` : '',
    draft.post_name ? `Post: ${draft.post_name}` : '',
    draft.exam_name ? `Exam: ${draft.exam_name}` : '',
    draft.source_url ? `Source URL: ${draft.source_url}` : '',
    draft.raw_text ? `Content:\n${(draft.raw_text as string).slice(0, 3000)}` : '',
  ].filter(Boolean).join('\n\n');
}

async function logRun(
  client: any, draftId: string, step: PipelineStep, status: 'ok' | 'skipped' | 'error',
  reason: string | null, fieldsUpdated: string[], aiModel: string | null, durationMs: number,
) {
  try {
    await client.from('intake_pipeline_runs').insert({
      draft_id: draftId, step, status, reason, fields_updated: fieldsUpdated,
      ai_model: aiModel, duration_ms: durationMs,
    });
  } catch (e) {
    console.error('[pipeline] logRun error:', e);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const lovableKey = Deno.env.get('LOVABLE_API_KEY');
  if (!lovableKey) return json({ error: 'LOVABLE_API_KEY not configured' }, 500);

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Missing Authorization' }, 401);
    const token = authHeader.replace('Bearer ', '');
    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) return json({ error: 'Invalid token' }, 401);

    const { data: roleData } = await supabase
      .from('user_roles').select('role').eq('user_id', user.id).eq('role', 'admin').maybeSingle();
    if (!roleData) return json({ error: 'Admin required' }, 403);

    const body = await req.json().catch(() => ({}));
    const draftId = body.draft_id as string;
    const aiModel = (body.aiModel as string) || '';
    const stepArg = (body.step as string) || 'auto';
    const forceStep = body.force_step as string | undefined;
    const dryRun = body.dry_run === true;

    if (!draftId || typeof draftId !== 'string') {
      return json({ error: 'Missing draft_id' }, 400);
    }

    const client = createClient(supabaseUrl, serviceRoleKey);

    // ── Load draft ──
    const { data: draftPre, error: fetchErr } = await client
      .from('intake_drafts').select('*').eq('id', draftId).single();
    if (fetchErr || !draftPre) return json({ error: 'Draft not found' }, 404);

    // ── Decide step ──
    let chosenStep: PipelineStep | null;
    let skipReasons: Record<string, string> = {};
    if (forceStep && (PIPELINE_STEPS as readonly string[]).includes(forceStep)) {
      chosenStep = forceStep as PipelineStep;
    } else {
      const decision = decideNextStep(draftPre);
      chosenStep = decision.step;
      skipReasons = decision.skipReasons;
    }

    // ── Dry run: return planned next step + all skip reasons ──
    if (dryRun) {
      // Walk through ALL steps from scratch to show full plan
      const fullPlan: { step: PipelineStep; will_run: boolean; reason?: string }[] = [];
      let cursor = { ...draftPre, pipeline_current_step: null };
      for (let i = 0; i < PIPELINE_STEPS.length; i++) {
        const dec = decideNextStep(cursor);
        if (!dec.step) break;
        if (dec.step === PIPELINE_STEPS[i]) {
          fullPlan.push({ step: dec.step, will_run: true });
        } else {
          // Mark all skipped between i and dec.step
          for (let j = i; j < PIPELINE_STEPS.indexOf(dec.step); j++) {
            const sk = PIPELINE_STEPS[j];
            fullPlan.push({ step: sk, will_run: false, reason: dec.skipReasons[sk] || 'skipped' });
          }
          fullPlan.push({ step: dec.step, will_run: true });
          i = PIPELINE_STEPS.indexOf(dec.step);
        }
        cursor = { ...cursor, pipeline_current_step: dec.step };
      }
      return json({ dry_run: true, plan: fullPlan, next_step: chosenStep });
    }

    if (!chosenStep) {
      return json({ ran_step: null, status: 'ok', fields_updated: [], next_step: null, message: 'pipeline already complete' });
    }

    // ── Acquire lock with compare-and-set semantics ──
    const nowIso = new Date().toISOString();
    const lockStartedAtMs = draftPre.pipeline_started_at ? Date.parse(draftPre.pipeline_started_at) : NaN;
    const hasActiveLock = Boolean(
      draftPre.pipeline_lock_token &&
      (!Number.isFinite(lockStartedAtMs) || lockStartedAtMs > Date.now() - 2 * 60 * 1000)
    );

    if (hasActiveLock) {
      return json({ error: 'locked', message: 'Draft is being processed by another worker' }, 409);
    }

    const nextLockToken = crypto.randomUUID();
    let lockQuery = (client as any)
      .from('intake_drafts')
      .update({
        pipeline_lock_token: nextLockToken,
        pipeline_status: 'running',
        pipeline_started_at: nowIso,
      })
      .eq('id', draftId);

    if (draftPre.pipeline_lock_token) {
      lockQuery = lockQuery.eq('pipeline_lock_token', draftPre.pipeline_lock_token);
    } else {
      lockQuery = lockQuery.is('pipeline_lock_token', null);
    }

    const { data: lockRow, error: lockErr } = await lockQuery
      .select('id, pipeline_lock_token')
      .maybeSingle();

    if (lockErr) {
      console.error('[pipeline] lock error:', lockErr);
      return json({ error: `Lock error: ${lockErr.message}` }, 500);
    }
    if (!lockRow) return json({ error: 'locked', message: 'Draft is being processed by another worker' }, 409);

    const releaseLock = async (extra: Record<string, any> = {}) => {
      try {
        await (client as any).from('intake_drafts').update({
          pipeline_lock_token: null,
          ...extra,
        }).eq('id', draftId);
      } catch (e) {
        console.error('[pipeline] release lock error:', e);
      }
    };

    // Re-fetch fresh draft inside the lock
    const { data: draft } = await client.from('intake_drafts').select('*').eq('id', draftId).single();
    if (!draft) {
      await releaseLock({ pipeline_status: 'failed', pipeline_last_error: 'draft vanished' });
      return json({ error: 'Draft not found post-lock' }, 404);
    }

    const t0 = Date.now();
    let fieldsUpdated: string[] = [];
    let stepStatus: 'ok' | 'skipped' | 'error' = 'ok';
    let stepReason: string | null = null;
    let stepError: string | null = null;
    const update: Record<string, any> = { pipeline_current_step: chosenStep };

    try {
      // ─── STEP EXECUTION ─────────────────────────────────────────────────
      if (chosenStep === 'deterministic') {
        const pre = deterministicExtract(draft);
        for (const [k, v] of Object.entries(pre)) {
          if (v && shouldOverwrite(k, (draft as any)[k], v)) {
            update[k] = v;
            fieldsUpdated.push(k);
          }
        }
        if (fieldsUpdated.length === 0) {
          stepStatus = 'skipped';
          stepReason = 'no deterministic fields to fill';
        }
      }

      else if (chosenStep === 'classify') {
        const pre = deterministicExtract(draft);
        const hints = Object.entries(pre).filter(([, v]) => v).map(([k, v]) => `  ${k}: ${v}`).join('\n');
        const evidence = buildEvidence(draft, { hints });
        const userPrompt = `Classify this scraped record and extract ALL available fields:\n\n${evidence}`;
        const aiResult = await callAI(lovableKey, SYSTEM_PROMPT, userPrompt, CLASSIFICATION_TOOL, aiModel);

        // Auto second-pass if many empty fields
        const empty = getEmptyImportantFields(aiResult);
        if (empty.length >= 3 && hasSubstantialEvidence(draft)) {
          try {
            const fillTool = buildFillEmptyToolSchema(empty);
            const fillPrompt = `These fields are currently empty and need to be filled if evidence exists:\n${empty.join(', ')}\n\nEvidence:\n${evidence}`;
            const fillResult = await callAI(lovableKey, FILL_EMPTY_FIELDS_PROMPT, fillPrompt, fillTool, aiModel);
            for (const f of empty) {
              const v = fillResult[f];
              if (v !== undefined && v !== null && v !== '') aiResult[f] = v;
            }
          } catch (fe) {
            console.error('[pipeline] classify second-pass error:', fe);
          }
        }

        // Apply deterministic fallback
        for (const [k, v] of Object.entries(pre)) {
          if (v && (!aiResult[k] || aiResult[k] === '')) aiResult[k] = v;
        }

        // Tag merge
        const rawExistingTags = draft.secondary_tags;
        const existingTags: string[] = Array.isArray(rawExistingTags) ? rawExistingTags
          : (typeof rawExistingTags === 'string' ? (() => { try { const v = JSON.parse(rawExistingTags); return Array.isArray(v) ? v : []; } catch { return []; } })() : []);
        const aiTags = Array.isArray(aiResult.secondary_tags) ? aiResult.secondary_tags : [];
        const mergedTags = [...new Set([...existingTags, ...aiTags])];

        const aiBlockers = Array.isArray(aiResult.publish_blockers) ? aiResult.publish_blockers : [];
        const criticalBlockers = getCriticalBlockers(aiResult, aiResult.content_type || '');
        const mergedBlockers = [...new Set([...aiBlockers, ...criticalBlockers])];

        // Always-set classification fields
        const classifyAlways: Record<string, any> = {
          content_type: aiResult.content_type,
          primary_status: aiResult.primary_status,
          publish_target: (aiResult.publish_target === 'certificates' || aiResult.publish_target === 'marksheets')
            ? 'scholarships' : aiResult.publish_target,
          confidence_score: aiResult.confidence_score,
          classification_reason: aiResult.classification_reason,
          secondary_tags: mergedTags,
          publish_blockers: mergedBlockers,
          processing_status: 'ai_processed',
          ai_model_used: aiModel || 'default',
          ai_processed_at: new Date().toISOString(),
        };
        for (const [k, v] of Object.entries(classifyAlways)) {
          update[k] = v;
          fieldsUpdated.push(k);
        }

        // Optional content fields — protected
        const optional = [
          'normalized_title', 'seo_title', 'slug', 'meta_description', 'summary',
          'organisation_name', 'department_name', 'ministry_name', 'post_name', 'exam_name',
          'advertisement_no', 'reference_no', 'job_location', 'application_mode',
          'notification_date', 'opening_date', 'closing_date', 'correction_last_date',
          'exam_date', 'result_date', 'admit_card_date', 'answer_key_date',
          'vacancy_count', 'qualification_text', 'age_limit_text', 'salary_text',
          'application_fee_text', 'selection_process_text', 'how_to_apply_text',
          'official_notification_link', 'official_apply_link', 'official_website_link',
          'result_link', 'admit_card_link', 'answer_key_link',
          'draft_content_html',
        ];
        for (const f of optional) {
          if (aiResult[f] !== undefined && aiResult[f] !== null && aiResult[f] !== '') {
            if (shouldOverwrite(f, (draft as any)[f], aiResult[f])) {
              update[f] = aiResult[f];
              fieldsUpdated.push(f);
            }
          }
        }
        if (aiResult.key_points) { update.key_points_json = aiResult.key_points; fieldsUpdated.push('key_points_json'); }
      }

      else if (chosenStep === 'enrich') {
        const empty = getEmptyImportantFields(draft);
        if (empty.length === 0) {
          stepStatus = 'skipped';
          stepReason = 'no empty important fields';
        } else if (!hasSubstantialEvidence(draft)) {
          stepStatus = 'skipped';
          stepReason = 'insufficient evidence';
        } else {
          const pre = deterministicExtract(draft);
          for (const [k, v] of Object.entries(pre)) {
            if (v && empty.includes(k) && shouldOverwrite(k, (draft as any)[k], v)) {
              update[k] = v; fieldsUpdated.push(k);
            }
          }
          const stillEmpty = empty.filter(f => !update[f]);
          if (stillEmpty.length > 0) {
            const evidence = buildEvidence(draft);
            const fillTool = buildFillEmptyToolSchema(stillEmpty);
            const fillPrompt = `These fields are currently empty and need to be filled ONLY if grounded evidence exists:\n${stillEmpty.join(', ')}\n\nEvidence:\n${evidence}`;
            const fillResult = await callAI(lovableKey, FILL_EMPTY_FIELDS_PROMPT, fillPrompt, fillTool, aiModel);
            for (const f of stillEmpty) {
              const v = fillResult[f];
              if (v !== undefined && v !== null && v !== '' && shouldOverwrite(f, (draft as any)[f], v)) {
                update[f] = v; fieldsUpdated.push(f);
              }
            }
          }
          update.enrichment_result = fieldsUpdated.length > 0 ? 'enriched' : 'not_enriched_no_data';
        }
      }

      else if (chosenStep === 'improve_title' || chosenStep === 'improve_summary' || chosenStep === 'generate_slug' || chosenStep === 'seo_fix') {
        const def = TARGETED_ACTIONS[chosenStep];
        const evidence = buildSmallEvidence(draft);
        const props: Record<string, any> = {};
        for (const f of def.fields) {
          const original = (CLASSIFICATION_TOOL.parameters.properties as any)[f];
          props[f] = original ? { ...original } : { type: 'string' };
        }
        const tool = {
          name: `targeted_${chosenStep}`,
          description: def.prompt,
          parameters: { type: 'object', properties: props, required: def.fields },
        };
        const aiResult = await callAI(lovableKey, def.prompt, `Apply to this record:\n\n${evidence}`, tool, aiModel);
        for (const f of def.fields) {
          const v = aiResult[f];
          if (v !== undefined && v !== null && v !== '' && shouldOverwrite(f, (draft as any)[f], v)) {
            update[f] = v; fieldsUpdated.push(f);
          }
        }
        if (fieldsUpdated.length === 0) {
          stepStatus = 'skipped';
          stepReason = 'AI returned no improvement strong enough to overwrite';
        }
      }

      else if (chosenStep === 'validate') {
        // Recompute blockers from current state
        const blockers = getCriticalBlockers(draft, draft.content_type || '');
        update.publish_blockers = blockers;
        fieldsUpdated.push('publish_blockers');
        if (blockers.length === 0) {
          update.review_status = 'reviewed';
          fieldsUpdated.push('review_status');
        }
      }

    } catch (err) {
      stepStatus = 'error';
      stepError = err instanceof Error ? err.message : String(err);
      console.error(`[pipeline] step ${chosenStep} error for ${draftId}:`, stepError);
    }

    const duration = Date.now() - t0;

    // Decide pipeline state + write update
    let nextStep: PipelineStep | null = null;
    if (stepStatus !== 'error') {
      // Compute the post-update view to decide next step
      const postDraft = { ...draft, ...update };
      const dec = decideNextStep(postDraft);
      nextStep = dec.step;
    }

    if (stepStatus === 'error') {
      update.pipeline_status = 'failed';
      update.pipeline_last_error = `${chosenStep}: ${stepError || 'unknown'}`;
      update.pipeline_finished_at = new Date().toISOString();
    } else if (!nextStep) {
      update.pipeline_status = 'completed';
      update.pipeline_finished_at = new Date().toISOString();
      update.pipeline_last_error = null;
    } else {
      update.pipeline_status = 'running';
    }

    // Apply update + release lock in one go
    update.pipeline_lock_token = null;

    const { error: writeErr } = await (client as any).from('intake_drafts').update(update).eq('id', draftId);
    if (writeErr) {
      console.error('[pipeline] write error:', writeErr);
      await releaseLock({ pipeline_status: 'failed', pipeline_last_error: `write: ${writeErr.message}` });
      await logRun(client, draftId, chosenStep, 'error', `write: ${writeErr.message}`, [], aiModel, duration);
      return json({ error: writeErr.message, ran_step: chosenStep }, 500);
    }

    await logRun(client, draftId, chosenStep, stepStatus, stepReason || stepError, fieldsUpdated, aiModel, duration);

    return json({
      ran_step: chosenStep,
      status: stepStatus,
      reason: stepReason,
      error: stepError,
      fields_updated: fieldsUpdated,
      next_step: nextStep,
      duration_ms: duration,
    });
  } catch (e) {
    console.error('[intake-ai-pipeline] fatal:', e);
    return json({ error: e instanceof Error ? e.message : 'Internal error' }, 500);
  }
});
