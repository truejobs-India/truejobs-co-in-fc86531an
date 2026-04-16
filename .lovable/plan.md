

## Sequential per-draft AI pipeline for ChatGPT Agent

Build a new orchestration layer alongside the existing `intake-ai-classify` (kept untouched as legacy/manual). One draft completes all needed steps before the next begins. One step per HTTP call to stay well under the 150s edge timeout.

---

### Files to create / modify

1. **Migration** — `supabase/migrations/<timestamp>_intake_pipeline.sql`
2. **New shared module** — `supabase/functions/_shared/intake-ai.ts`
3. **New edge function** — `supabase/functions/intake-ai-pipeline/index.ts`
4. **Config** — `supabase/config.toml` (add `[functions.intake-ai-pipeline] verify_jwt = false`)
5. **Frontend** — `src/components/admin/chatgpt-agent/ChatGptAgentManager.tsx`
6. **New small component** — `src/components/admin/chatgpt-agent/PipelineStepBadges.tsx`
7. **Untouched** — `supabase/functions/intake-ai-classify/index.ts` keeps working for the legacy "Advanced (manual)" dropdown.

---

### Schema changes (migration)

```sql
ALTER TABLE intake_drafts
  ADD COLUMN IF NOT EXISTS pipeline_status text,
  ADD COLUMN IF NOT EXISTS pipeline_current_step text,
  ADD COLUMN IF NOT EXISTS pipeline_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS pipeline_finished_at timestamptz,
  ADD COLUMN IF NOT EXISTS pipeline_lock_token uuid,
  ADD COLUMN IF NOT EXISTS pipeline_lock_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS pipeline_last_error text;

CREATE TABLE IF NOT EXISTS intake_pipeline_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_id uuid NOT NULL REFERENCES intake_drafts(id) ON DELETE CASCADE,
  step text NOT NULL,
  status text NOT NULL,            -- 'ok' | 'skipped' | 'error'
  reason text,
  fields_updated text[] DEFAULT '{}',
  ai_model text,
  duration_ms integer,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pipeline_runs_draft ON intake_pipeline_runs(draft_id, created_at DESC);

ALTER TABLE intake_pipeline_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read pipeline runs" ON intake_pipeline_runs
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
-- Inserts via service role only (edge function bypasses RLS)

-- Validation trigger (no CHECK constraints per project policy)
CREATE OR REPLACE FUNCTION public.validate_pipeline_runs()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.status NOT IN ('ok','skipped','error') THEN
    RAISE EXCEPTION 'Invalid intake_pipeline_runs.status: %', NEW.status;
  END IF;
  IF NEW.step NOT IN ('deterministic','classify','enrich','improve_title','improve_summary','generate_slug','seo_fix','validate') THEN
    RAISE EXCEPTION 'Invalid intake_pipeline_runs.step: %', NEW.step;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_validate_pipeline_runs BEFORE INSERT OR UPDATE ON intake_pipeline_runs
  FOR EACH ROW EXECUTE FUNCTION public.validate_pipeline_runs();
```

---

### Shared module `_shared/intake-ai.ts`

Lift verbatim from `intake-ai-classify/index.ts` (no rewriting):
- `deterministicExtract`, `PreExtracted`
- `callAI` + provider routing maps (`GATEWAY_MODEL_MAP`, `GEMINI_DIRECT_MODEL_MAP`, `BEDROCK_MODELS`, `AZURE_OPENAI_MODELS`, `AZURE_DEEPSEEK_MODELS`)
- `SYSTEM_PROMPT`, `RETRY_ENHANCED_PREFIX`, `FILL_EMPTY_FIELDS_PROMPT`, `TARGETED_ACTIONS`, `CLASSIFICATION_TOOL`
- `IMPORTANT_FIELDS`, `getEmptyImportantFields`, `getCriticalBlockers`

Then update `intake-ai-classify/index.ts` to import from this shared module (single-line import swap, no behavior change). New helpers added in the shared module:

```ts
export const PIPELINE_STEPS = ['deterministic','classify','enrich','improve_title','improve_summary','generate_slug','seo_fix','validate'] as const;

// Conservative quality gates — true means "good enough, skip"
export function isStrongTitle(t?: string): boolean { /* 25-110 chars, mixed case, ≠ raw */ }
export function isStrongSummary(s?: string): boolean { /* 80-400 chars */ }
export function isStrongMetaDesc(m?: string): boolean { /* 100-160 chars */ }
export function isValidSlug(s?: string): boolean { /* /^[a-z0-9][a-z0-9-]{2,68}[a-z0-9]$/ */ }
export function isStrongSeoTitle(t?: string): boolean { /* 30-60 chars */ }
export function isClassified(d: any): boolean { /* ai_processed + content_type set + confidence>=70 + organisation_name */ }

// Field-protection: never overwrite a strong existing value with a weaker AI output
export function shouldOverwrite(field: string, oldVal: any, newVal: any): boolean { ... }
```

---

### Edge function `intake-ai-pipeline/index.ts`

**Request body:**
```ts
{ draft_id: string, aiModel: string, step?: 'auto', force_step?: string, dry_run?: boolean }
```

**Flow per call (one step only):**
1. CORS + admin auth (mirror existing pattern: `supabase.auth.getUser()` from JWT → `has_role(uid,'admin')`).
2. Load draft.
3. **Acquire lock** atomically:
   ```sql
   UPDATE intake_drafts
   SET pipeline_lock_token = gen_random_uuid(),
       pipeline_lock_expires_at = now() + interval '2 minutes',
       pipeline_status = 'running',
       pipeline_started_at = COALESCE(pipeline_started_at, now())
   WHERE id = $1
     AND (pipeline_lock_expires_at IS NULL OR pipeline_lock_expires_at < now())
   RETURNING pipeline_lock_token;
   ```
   If 0 rows → return HTTP 409 `{ error: 'locked' }`.
4. **Decide next step** via skip-rules (see below). If `force_step`, use it.
5. If `dry_run` → return planned step + skip reasons for all 8 steps without running anything; release lock.
6. Run the one step (reuses shared helpers), apply `shouldOverwrite` per field, write only changed fields.
7. Insert into `intake_pipeline_runs` (status, fields_updated, duration, model, reason).
8. Update `pipeline_current_step`, `pipeline_last_error`, and `pipeline_status`/`pipeline_finished_at` if `next_step` is null.
9. **Release lock** (`pipeline_lock_token = null, pipeline_lock_expires_at = null`).
10. Return `{ ran_step, status, fields_updated, next_step, blockers? }`.

**Skip rules (conservative):**

| Step | Run if |
|---|---|
| `deterministic` | always (cheap, no AI) — fills only empty fields via `shouldOverwrite` |
| `classify` | NOT `isClassified(draft)` |
| `enrich` | `getEmptyImportantFields(draft).length > 0` AND has substantial evidence |
| `improve_title` | NOT `isStrongTitle(normalized_title)` |
| `improve_summary` | NOT (`isStrongSummary(summary)` AND `isStrongMetaDesc(meta_description)`) |
| `generate_slug` | NOT `isValidSlug(slug)` |
| `seo_fix` | NOT (`isStrongSeoTitle(seo_title)` AND `isStrongMetaDesc(meta_description)`) |
| `validate` | always (recomputes blockers, sets `review_status='reviewed'` if no blockers) |

Each AI step reuses the **exact prompt strings** already in `intake-ai-classify` — no prompt rewrites.

---

### Frontend changes (`ChatGptAgentManager.tsx`)

New state:
```ts
const [pipelineProgress, setPipelineProgress] = useState<{
  draftIndex: number; totalDrafts: number;
  currentStep: string; stepIndex: number;
  draftId: string;
} | null>(null);
const [draftRuns, setDraftRuns] = useState<Record<string, any[]>>({}); // last runs per draft
```

New orchestrator (replaces nothing — added as new flow):
```ts
async function runFullPipeline(ids: string[]) {
  setAiProcessing(true);
  for (let i = 0; i < ids.length; i++) {
    const draftId = ids[i];
    setProcessingChunkIds(new Set([draftId]));
    let safety = 0;
    while (safety++ < 8) {
      const res = await supabase.functions.invoke('intake-ai-pipeline', {
        body: { draft_id: draftId, aiModel, step: 'auto' },
      });
      if (res.error || res.data?.error) {
        addMessage('error', `Draft ${i+1}: step ${res.data?.ran_step || '?'} failed`, res.data?.error || res.error?.message);
        break;
      }
      setPipelineProgress({
        draftIndex: i+1, totalDrafts: ids.length,
        currentStep: res.data.ran_step, stepIndex: safety, draftId,
      });
      if (!res.data.next_step) break;
    }
    await refreshOneDraft(draftId);
  }
  setAiProcessing(false);
  setPipelineProgress(null);
  setProcessingChunkIds(new Set());
}
```

UI additions:
- **Primary button**: `✨ Run All Needed Fixes` (visible when ≥1 selected) — calls `runFullPipeline(selectedIds)`.
- **Per-row dropdown item**: "Run pipeline for this draft" (single id).
- **Per-row dropdown item**: "Preview plan (dry run)" — calls with `dry_run:true`, shows toast with WILL RUN / SKIP list.
- **Per-row dropdown item**: "Retry from {failed_step}" (visible when `pipeline_status='failed'`).
- **Banner** (shown while running): `Draft 2 of 5 · Step: enrich (3 of 8)` + progress bar.
- **Per-row chip** via new `PipelineStepBadges.tsx`: 8 small pills (queued / running spinner / done / skipped / failed) populated from `intake_pipeline_runs` last 8 rows.
- **Existing AI Actions dropdown** kept, relabeled `Advanced (manual)`.

---

### Concurrency, idempotency, safety

- DB-level atomic lock via the `UPDATE ... WHERE pipeline_lock_expires_at IS NULL OR < now()` pattern — no race possible.
- 2-minute TTL means a crashed call self-recovers.
- All step writes use `shouldOverwrite` — strong existing values are protected.
- Enrich step writes only fields that were originally empty (existing safety re-check pattern preserved).
- Re-running a step with same input is idempotent (no append-only fields touched).
- Frontend orchestrator processes drafts strictly sequentially; on 409 it logs & moves on.

---

### What's deliberately NOT changed

- `intake-ai-classify/index.ts` behavior is preserved — only its imports point to `_shared/intake-ai.ts`. Old single-action buttons keep working.
- No prompt strings are modified.
- No changes to provider routing logic.
- No changes to `CLASSIFICATION_TOOL` schema.
- No changes to `intake_drafts` content columns.

---

### Risks / follow-up

- Two pieces of code (legacy classify + new pipeline) share helpers — if a future prompt change is needed, edit only `_shared/intake-ai.ts`.
- Long-term: legacy single-action buttons could be removed once admin confirms new pipeline covers all cases. Out of scope here.
- The `validate` step recomputes blockers but does NOT auto-publish — admin still clicks publish manually (matches existing flow).

