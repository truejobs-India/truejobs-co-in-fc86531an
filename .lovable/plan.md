
## Refined fix plan (incorporates your refinements)

### Root cause (confirmed)
1. **Retry whitelist bug** — first-call dispatcher supports `azure-deepseek-r1`; retry path uses hardcoded `if (model === 'mistral' || ...)` that excludes it → throws `JSON parse retry not supported for model: azure-deepseek-r1`.
2. **Audit writes bypassed on failure** — audit insert + `last_enrichment_*` stamping live downstream of the throw, so failures never log.
3. Combination of #1 and #2.

### A. Refactor `supabase/functions/enrich-employment-news/index.ts`

**Single shared raw caller** (one source of truth for model dispatch):
```ts
async function callRawAI(model, prompt, opts: { maxTokens; systemPrompt? }): Promise<string>
```
Used identically by attempt 1 and attempt 2. **Whitelist deleted.**

**Cleanup + strict parser (per your refinement #2 and #3):**
```ts
function cleanJsonText(raw: string): string {
  // strip BOM, trim, strip ```json / ``` fences only
}

function tryParseJson(raw: string): unknown | null {
  // 1. direct JSON.parse on cleaned text → return result on success
  // 2. on failure: scan for top-level balanced {...} or [...] blocks
  //    - if exactly ONE clear candidate → parse it
  //    - if zero or multiple competing candidates → return null (fail clean, no guessing)
  // 3. always return null on any parse failure (never undefined, never throw)
}
```

**Two-attempt flow with strict null check (per refinement #2):**
```ts
let raw = await callRawAI(model, prompt, opts);
let parsed = tryParseJson(cleanJsonText(raw));
if (parsed === null) {
  const stricter = prompt + '\n\nReturn ONLY valid JSON matching the required schema. No markdown fences. No explanation.';
  raw = await callRawAI(model, stricter, opts);
  parsed = tryParseJson(cleanJsonText(raw));
}
if (parsed === null) throw new Error(`JSON parse failed after 2 attempts on model=${model}`);
```

### B. Guaranteed audit/status writes (per refinement #1)

```ts
const t0 = Date.now();
let outcome = { status: 'failed', error: null as string | null, apiModel, provider, maxTokens };
try {
  // ... enrichment logic; on completion: outcome.status = 'success'
} catch (e) {
  outcome.error = String(e?.message || e);
} finally {
  const durationMs = Date.now() - t0;
  try {
    await supabase.from('employment_news_enrichment_runs').insert({
      job_id, selected_model_id: model, provider: outcome.provider,
      api_model: outcome.apiModel, max_tokens: outcome.maxTokens,
      status: outcome.status, error_message: outcome.error,
      duration_ms: durationMs, attempted_at: new Date().toISOString()
    });
    const stamp: Record<string, unknown> = {
      last_enrichment_model: model,
      last_enrichment_provider: outcome.provider,
      last_enrichment_api_model: outcome.apiModel,
      last_enrichment_at: new Date().toISOString(),
      // refinement #1: clear stale error on success, set real error on failure
      enrichment_error: outcome.status === 'success' ? null : outcome.error,
    };
    // do NOT touch status here — main success path owns status transitions
    await supabase.from('employment_news_jobs').update(stamp).eq('id', job_id);
  } catch (auditErr) {
    console.error('[audit-write-failed]', auditErr); // never masks real error
  }
}
```

### C. Out of scope
No new providers, no model fallback, no third repair stage, no token-budget changes, no unrelated flows touched.

### D. One-time SQL repair (per refinement #5 — not a migration)

Run as a one-time scoped query (not a permanent migration):
```sql
UPDATE public.employment_news_jobs
SET enrichment_error = NULL,
    enrichment_attempts = 0
WHERE status = 'pending'
  AND enrichment_error LIKE '%JSON parse retry not supported%';
```
Touches only the ~30 poisoned rows.

### E. Deploy + verify (per refinement #4 — concrete row sample)

1. Deploy `enrich-employment-news`.
2. Re-run a few stuck jobs with `azure-deepseek-r1`.
3. Collect evidence:
   - **Counts:** `pending` count before vs after; count of fresh rows in `employment_news_enrichment_runs` from last 10 min.
   - **Edge logs:** must NOT contain `JSON parse retry not supported`.
   - **One concrete sample row** from `employment_news_jobs` (any recently retried job) showing all populated:
     - `last_enrichment_model`
     - `last_enrichment_provider`
     - `last_enrichment_api_model`
     - `last_enrichment_at`
   - **Matching audit row** in `employment_news_enrichment_runs` for that same `job_id` with matching model/provider/timestamp.
   - On any remaining failure: real cause now visible in DB row + audit row.

### Files touched
- `supabase/functions/enrich-employment-news/index.ts` — single refactor
- One-time SQL repair (not a migration)
- Deploy `enrich-employment-news`

### Risk: low
Dispatcher consolidation is mechanical. Parser only relaxes input acceptance and fails clean on ambiguity. Final-block stamp does not touch `status` — success path unchanged. Repair filtered by exact known error string.
