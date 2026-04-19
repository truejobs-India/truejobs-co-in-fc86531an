
## Issue
Pipeline step `improve_title` failed with "Failed to send a request to the Edge Function" — a network/transport error before the function executed (not an in-function error). Likely causes: function crash on boot, deploy issue, timeout on cold start, or CORS preflight failure.

## Investigation (read-only)
1. Identify which edge function handles `improve_title` (likely `intake-ai-pipeline` based on logs showing DeepSeek calls).
2. Check `supabase/functions/intake-ai-pipeline/index.ts` for the `improve_title` step and how it's invoked from the client.
3. Check edge function logs for `intake-ai-pipeline` around the failure — look for boot errors, crashes, timeouts.
4. Check the client caller (likely in `ChatGptAgentManager.tsx` or a related pipeline file) for how it invokes the function and handles errors.
5. Confirm whether `improve_title` is a separate function or a sub-step inside `intake-ai-pipeline`.

## Likely root causes (rank-ordered)
1. **Cold-start timeout** — `improve_title` calls Azure DeepSeek, which can take 30+ s. If the function boots cold AND the AI call is slow, the supabase-js client may abort with "Failed to send a request" before the function returns.
2. **Function crash on boot** — recent edit broke the function; check logs for boot errors.
3. **Per-step network blip** — single transient failure; retry would succeed.

## Fix plan

**Step 1: Diagnose first (no code changes)**
- Read the relevant edge function source.
- Read recent logs filtered for `improve_title` or the failed row's title.
- Confirm whether the function booted, ran, and crashed — OR never received the request.

**Step 2: Apply targeted fix based on diagnosis**

- **If cold-start/timeout:** Add per-step retry (1 retry with 2 s backoff) on the client side for transient `Failed to send a request` errors. Single file: the pipeline caller.
- **If function crash:** Fix the specific bug in `intake-ai-pipeline/index.ts`.
- **If transient:** Add the same retry-once safety net so a single network blip doesn't fail the whole row.

**Step 3: Improve error visibility**
- In the failure toast, distinguish "transport error (will retry)" vs "function returned error" so future debugging is clearer.

## Strict scope guard
- Touch ONLY the failing step's caller and/or the edge function itself.
- Do NOT modify: row ordering (just fixed), filters, badges, tabs, scope banner, "Select all visible", or any other pipeline step.

## Verification after fix
1. Re-run pipeline on the same NHPC row → confirm it succeeds.
2. Run pipeline on 5 mixed rows → confirm no transport errors and no regressions in other steps.
3. Confirm row ordering still locked (the just-shipped fix).
4. Confirm filter/badge/tab UI untouched.

## Files likely changed (TBD after diagnosis)
- `supabase/functions/intake-ai-pipeline/index.ts` (only if function bug found), OR
- The client pipeline caller (only if adding retry-once safety net)

## Risk
Low. Minimal targeted change after evidence-based diagnosis.
