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
    draft.row_prompt ? `Row Prompt (admin-provided guidance):\n${(draft.row_prompt as string).slice(0, 4000)}` : '',
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
    draft.row_prompt ? `Row Prompt:\n${(draft.row_prompt as string).slice(0, 2000)}` : '',
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

    // ── Background execution wrapper ──
    // Firecrawl PDF/HTML fetches + 180s DeepSeek calls easily exceed the
    // 150s edge idle timeout. Run the actual step in the background and
    // return immediately so the client (which polls draft status) never
    // hits a 504. The lock + final status write happen inside the bg task.
    const runStep = async () => {
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
      return;
    }
    if (!lockRow) {
      console.warn('[pipeline] lock lost mid-flight for', draftId);
      return;
    }

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
      return;
    }

    const t0 = Date.now();
    let fieldsUpdated: string[] = [];
    let stepStatus: 'ok' | 'skipped' | 'error' = 'ok';
    let stepReason: string | null = null;
    let stepError: string | null = null;
    // IMPORTANT: do NOT pre-set pipeline_current_step here. We only advance
    // the step pointer when the step actually succeeds — so transient
    // failures (parser, timeout, quota) are retried on the same step rather
    // than silently skipped on the next run.
    const update: Record<string, any> = {};

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
        // ── Three-state terminal contract for the enrich step ──
        // Every exit path MUST set enrichment_result to one of:
        //   'enriched' | 'not_enriched_no_grounded_evidence' | 'not_enriched_tech_error'
        // plus enrichment_reason. Grade/completeness/source-trace live in
        // additive columns and never affect the top-level enum.
        const empty = getEmptyImportantFields(draft);
        if (empty.length === 0) {
          // No empty important fields → row is already complete by definition.
          // This counts as enriched (richest possible) since every important
          // field is already populated from prior runs / direct upload.
          stepStatus = 'skipped';
          stepReason = 'no empty important fields';
          update.enrichment_result = 'enriched';
          update.enrichment_grade = 'full';
          update.enrichment_completeness = 100;
          update.enrichment_reason = 'all important fields already populated';
        } else {
          // Build evidence (Stages 1–3) with Firecrawl official refresh + discovery.
          let evidenceResult: Awaited<ReturnType<typeof buildEnrichmentEvidence>>;
          try {
            evidenceResult = await buildEnrichmentEvidence(draft, {
              allowOfficialFetch: true,
              persistFetch: async (patch) => {
                try { await (client as any).from('intake_drafts').update(patch).eq('id', draftId); }
                catch (e) { console.error('[pipeline] persistFetch error:', e); }
              },
            });
          } catch (eb) {
            // Evidence builder itself failed (Firecrawl/Network). Treat as tech error.
            throw eb;
          }

          // Apply deterministic hints first (cheap, never wrong).
          const pre = deterministicExtract(draft);
          for (const [k, v] of Object.entries(pre)) {
            if (v && empty.includes(k) && shouldOverwrite(k, (draft as any)[k], v)) {
              update[k] = v; fieldsUpdated.push(k);
            }
          }
          const stillEmpty = empty.filter(f => !update[f]);

          // Only call AI if Stage gates produced grounded evidence to lean on.
          if (stillEmpty.length > 0 && !evidenceResult.noDataDecision) {
            const fillTool = buildFillEmptyToolSchema(stillEmpty);
            const fillPrompt = `Fill ONLY the listed empty fields using ONLY the grounded evidence below.\n` +
              `Rules: prefer values tagged trust=primary; never invent; if all sources for a field are stale or only secondary, leave the field empty.\n\n` +
              `Empty fields:\n${stillEmpty.join(', ')}\n\nEvidence:\n${evidenceResult.bundle}`;
            const fillResult = await callAI(lovableKey, FILL_EMPTY_FIELDS_PROMPT, fillPrompt, fillTool, aiModel);
            for (const f of stillEmpty) {
              const v = fillResult[f];
              if (v !== undefined && v !== null && v !== '' && shouldOverwrite(f, (draft as any)[f], v)) {
                update[f] = v; fieldsUpdated.push(f);
              }
            }
          }

          // ── Grade + completeness decision (only when at least one field was written) ──
          const gs = evidenceResult.groundedSources;
          const hasExternalGroundedFact =
            gs.officialPdfFetched ||
            gs.officialHtmlFetched ||
            gs.discoveryPromoted ||
            // Tier-1 row/structured fields count as externally grounded ONLY if
            // they were already verified by source (verification_status verified
            // or source_verified_on present). Otherwise they are weak hints only.
            ((String(draft.verification_status || '').toLowerCase().includes('verified') ||
              !!draft.source_verified_on || !!draft.source_verified_on_date) &&
              gs.rowFields.length + gs.structuredJsonFields.length >= 1);

          // Strict rule: title normalization / guessed org alone NEVER counts.
          // We require either a Stage-2 fetched body or a verified row.
          const wroteFields = fieldsUpdated.length > 0;

          if (wroteFields && hasExternalGroundedFact) {
            // Pick a grade.
            let grade: string;
            if (gs.officialPdfFetched) grade = 'official_pdf';
            else if (gs.officialHtmlFetched) grade = 'official_refresh';
            else if (gs.discoveryPromoted) grade = 'partial_verified';
            else grade = fieldsUpdated.length >= 4 ? 'full' : (fieldsUpdated.length >= 2 ? 'partial_verified' : 'minimal_verified');
            const totalImportant = empty.length;
            const completeness = Math.min(100, Math.round((fieldsUpdated.length / Math.max(1, totalImportant)) * 100));
            update.enrichment_result = 'enriched';
            update.enrichment_grade = grade;
            update.enrichment_completeness = completeness;
            update.enrichment_reason = `enriched(${grade}): ${evidenceResult.reason}; wrote ${fieldsUpdated.length}/${totalImportant} fields`;
            update.enrichment_source_trace = {
              wrote_fields: fieldsUpdated,
              row_fields_grounded: gs.rowFields,
              structured_json_grounded_keys: gs.structuredJsonFields.slice(0, 30),
              official_pdf_fetched: gs.officialPdfFetched,
              official_html_fetched: gs.officialHtmlFetched,
              official_fetch_url: draft.official_fetch_url || null,
              official_fetch_at: draft.official_fetch_at || null,
              discovery: evidenceResult.discovery,
              evidence_reason: evidenceResult.reason,
            };
          } else {
            // No externally-grounded fact + nothing reliable to write → honest no-evidence.
            // (This is NOT a tech error — Stage 1–3 ran successfully and just
            //  found nothing trustworthy to lean on.)
            update.enrichment_result = 'not_enriched_no_grounded_evidence';
            update.enrichment_grade = null;
            update.enrichment_completeness = 0;
            update.enrichment_reason = wroteFields
              ? `no_grounded_evidence: AI returned values but none from a verified external source. ${evidenceResult.reason}`
              : `no_grounded_evidence: ${evidenceResult.reason}`;
            update.enrichment_source_trace = {
              wrote_fields: fieldsUpdated,
              official_pdf_fetched: gs.officialPdfFetched,
              official_html_fetched: gs.officialHtmlFetched,
              discovery: evidenceResult.discovery,
              evidence_reason: evidenceResult.reason,
            };
            // If AI proposed values without grounding, do NOT persist those weak writes.
            if (wroteFields) {
              for (const f of fieldsUpdated) delete update[f];
              fieldsUpdated.length = 0;
            }
          }
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
      // Only on success/skip do we advance the step pointer.
      update.pipeline_current_step = chosenStep;
      const postDraft = { ...draft, ...update };
      const dec = decideNextStep(postDraft);
      nextStep = dec.step;
    }

    if (stepStatus === 'error') {
      // Keep pipeline_current_step UNCHANGED so the next run retries this step.
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

    // Apply update + release lock in one go (lock is always cleared so orphan
    // running rows can never get stuck).
    update.pipeline_lock_token = null;

    // ── PRE-COMMIT ASSERTION: prevent NULL-result completed rows by construction ──
    // If the enrich step is the one we ran, enrichment_result MUST be one of the
    // three terminal states. If it's somehow missing, mark as tech_error so the
    // runner retries instead of silently writing a NULL-result completed row.
    if (chosenStep === 'enrich' && update.pipeline_status === 'completed') {
      const allowed = new Set(['enriched', 'not_enriched_no_grounded_evidence', 'not_enriched_tech_error']);
      const finalResult = (update.enrichment_result ?? draft.enrichment_result) as string | null | undefined;
      if (!finalResult || !allowed.has(finalResult)) {
        console.error('[pipeline] terminal-write contract violated for', draftId, 'result=', finalResult);
        update.pipeline_status = 'failed';
        update.pipeline_last_error = `enrich: terminal contract violated (result=${finalResult ?? 'null'})`;
        update.enrichment_result = 'not_enriched_tech_error';
        update.enrichment_reason = `terminal_contract_violated: result was ${finalResult ?? 'null'}`;
      }
    }

    const { error: writeErr } = await (client as any).from('intake_drafts').update(update).eq('id', draftId);
    if (writeErr) {
      console.error('[pipeline] write error:', writeErr);
      await releaseLock({
        pipeline_status: 'failed',
        pipeline_last_error: `write: ${writeErr.message}`,
        pipeline_finished_at: new Date().toISOString(),
      });
      await logRun(client, draftId, chosenStep, 'error', `write: ${writeErr.message}`, [], aiModel, duration);
      return;
    }

    await logRun(client, draftId, chosenStep, stepStatus, stepReason || stepError, fieldsUpdated, aiModel, duration);
    console.log(`[pipeline] bg done draft=${draftId} step=${chosenStep} status=${stepStatus} next=${nextStep} dur=${duration}ms`);
    };
    // Fire-and-forget. EdgeRuntime keeps the worker alive past the response.
    // @ts-ignore — EdgeRuntime is a Deno Deploy / Supabase Edge global
    if (typeof EdgeRuntime !== 'undefined' && (EdgeRuntime as any).waitUntil) {
      // @ts-ignore
      EdgeRuntime.waitUntil(runStep().catch(e => console.error('[pipeline] bg fatal:', e)));
    } else {
      runStep().catch(e => console.error('[pipeline] bg fatal (no EdgeRuntime):', e));
    }

    return json({
      accepted: true,
      ran_step: chosenStep,
      next_step: null, // unknown until bg completes; client should poll draft row
      message: 'step running in background; poll intake_drafts.pipeline_status',
    }, 202);
  } catch (e) {
    console.error('[intake-ai-pipeline] fatal:', e);
    return json({ error: e instanceof Error ? e.message : 'Internal error' }, 500);
  }
});
