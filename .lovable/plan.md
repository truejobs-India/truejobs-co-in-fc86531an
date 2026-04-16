

## Root cause (verified, not guessed)

Direct curl to `https://riktrtfgpnrqiwatppcq.supabase.co/functions/v1/intake-ai-pipeline` returns:

```
HTTP/2 404
sb-error-code: NOT_FOUND
{"code":"NOT_FOUND","message":"Requested function was not found"}
```

The function **does not exist on the Supabase Edge Runtime**. Files exist locally (`supabase/functions/intake-ai-pipeline/index.ts`, `supabase/functions/_shared/intake-ai.ts`) and `supabase/config.toml` declares it — but the function was never deployed, so every one of the 40 sequential POSTs failed at the network layer. The browser shows it as `Failed to fetch` because the OPTIONS preflight 404 also lacks proper CORS headers for the `content-type` request header, so the browser blocks the POST before sending.

Why the orchestrator marked all 40 as failed: `runFullPipeline` catches `res.error` per draft, logs it, and moves on — exactly what you saw.

## Fix (one action, very small)

Trigger a deploy of the new edge function. In Lovable's default (write) mode, simply re-saving / writing the function file causes auto-deploy. Plan:

1. **Re-write `supabase/functions/intake-ai-pipeline/index.ts`** with identical content (no logic change) to force the deploy pipeline to pick it up and push it.
2. **Re-write `supabase/functions/_shared/intake-ai.ts`** the same way (it's a dependency; safer to re-emit so the bundler refreshes).
3. After the function is live, the existing UI will work as already implemented — no frontend changes needed.

Optional small safety improvement (also include): widen the CORS allow-headers in the edge function to match what `supabase-js` actually sends, preventing future preflight surprises:

```ts
'Access-Control-Allow-Headers':
  'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version'
```

## Verification after deploy

- `curl -i .../functions/v1/intake-ai-pipeline -X OPTIONS` should return **204** (or 200) with `access-control-allow-headers` including `content-type`.
- A POST with a real auth JWT and `{ "draft_id": "...", "aiModel": "...", "step": "auto" }` should return JSON with `ran_step` and `next_step`.
- In the admin UI, "Run All Needed Fixes" on a single draft should advance through `deterministic → classify → … → validate`, populating the `intake_pipeline_runs` table (currently empty per the GET responses you saw).

## What is NOT the cause

- Not a 150s edge timeout — nothing ran.
- Not auth — 404 is returned before auth check.
- Not the 40-draft volume — the very first POST already 404'd; sequential orchestration is fine.
- Not a missing import / boot error — the function file isn't on the runtime at all.
- Not the queue-architecture suggestion in the stack-overflow context — irrelevant here.

## Files to touch

1. `supabase/functions/intake-ai-pipeline/index.ts` — rewrite identical content + widen CORS headers (one constant).
2. `supabase/functions/_shared/intake-ai.ts` — touch (no logic change) to force re-bundle.

That's it. No schema, no UI, no orchestration changes.

