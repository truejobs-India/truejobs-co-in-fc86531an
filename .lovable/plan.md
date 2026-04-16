

Looking at the request, I need to:
1. Add a "Stop" button to gracefully halt the running pipeline
2. Improve the completion message to show counts (succeeded/failed/skipped)
3. Add an "AI Fixed" badge on rows that completed successfully

Let me explore the relevant files first.
<lov-tool-use id="toolu_vrtx_01ScreNppXCtagWZ5D8dZrP5" name="code--search_files" integration-id="code" data="{\"query\": \"runFullPipeline|Run All Needed Fixes|intake-ai-pipeline\", \"include_patterns\": \"*.tsx,*.ts\", \"exclude_dirs\": \"supabase/functions,node_modules\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01B5LoAUeQzL4cuiV9i2PMfw" name="code--search_files" integration-id="code" data="{\"query\": \"runFullPipeline|Run All Needed Fixes|intake-ai-pipeline\", \"include_patterns\": \"*.tsx,*.ts\", \"exclude_dirs\": \"supabase/functions,node_modules\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01SChPpUhko1vUYT25rdE4kr" name="code--view" integration-id="code" data="{\"file_path\": \"src/components/admin/chatgpt-agent/ChatGptAgentManager.tsx\", \"lines\": \"280-490\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_016R8b1ZxrFFcqvLigMt1qDM" name="code--view" integration-id="code" data="{\"file_path\": \"src/components/admin/chatgpt-agent/ChatGptAgentManager.tsx\", \"lines\": \"1-110\"}">
</lov-tool-use>
I have enough context. Let me look at the row rendering briefly to find where to add the badge.
<lov-tool-use id="toolu_vrtx_015jvd1cfu2wozujrB3JR9gH" name="code--view" integration-id="code" data="{\"file_path\": \"src/components/admin/chatgpt-agent/ChatGptAgentManager.tsx\", \"lines\": \"580-767\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01JyaVdA7fvUeZuSDFNThU81" name="code--view" integration-id="code" data="{\"file_path\": \"src/components/admin/chatgpt-agent/ChatGptAgentManager.tsx\", \"lines\": \"540-585\"}">
</lov-tool-use>
I have enough context to plan.

<lov-plan>

## Plan: Stop button + detailed summary + AI Fixed badge

### 1. Graceful stop for "Run All Needed Fixes"
In `ChatGptAgentManager.tsx`:
- Add `const stopRequestedRef = useRef(false)` and a `stopping` state.
- Add a "Stop" button next to the Run button, visible only while `aiProcessing` is true. Clicking it sets `stopRequestedRef.current = true` and `setStopping(true)`.
- In `runFullPipeline`'s outer `for` loop (between drafts) and inner `while` loop (between steps of a draft), check `stopRequestedRef.current`. If true: break out cleanly, finish the current in-flight HTTP call (we don't kill mid-request — that's "graceful"), and stop scheduling more.
- Reset `stopRequestedRef.current = false` and `setStopping(false)` in the finally block.

### 2. Detailed success/failure summary
Currently `runFullPipeline` ends with a single generic "Pipeline complete · Processed N draft(s)" message. Replace with proper accounting:
- Track per-draft outcome inside the loop:
  - `succeeded: string[]` — drafts that finished with no `next_step` and no error.
  - `failed: { id, step, error }[]` — drafts where a step returned `res.error` or `res.data.error`.
  - `skipped: string[]` — drafts skipped because stop was pressed before they ran.
  - Optional: count of `ok` vs `skipped` step runs aggregated from `res.data.ran_step` + `res.data.status`.
- Final `addMessage`:
  - type = `error` if any failed, `warning` if stopped early, else `success`.
  - title = `Pipeline finished — ✅ X succeeded · ⚠️ Y failed · ⏭ Z skipped (of N)`.
  - description = multi-line: list each failed draft as `• <title-or-id-8>: <step> — <error>` and list skipped IDs. Truncated to first ~10 entries with `… and K more`.
- Also update the per-draft error `addMessage` calls to include the draft's title (look up from `drafts` array) instead of just index.

### 3. "AI Fixed" badge on each successful row
A draft is considered "AI fixed" when it has at least one successful pipeline run for the `validate` step (the final step), OR when all 8 steps have an `ok`/`skipped` run (no `error`) in `intake_pipeline_runs`.
- In the row Title cell (around line 567–574), add a small green badge after the title:
  ```
  {isAiFixed(draftRuns[d.id]) && (
    <Badge variant="outline" className="text-[10px] gap-1 border-green-500 text-green-700 bg-green-50">
      <Sparkles className="h-2.5 w-2.5" /> AI Fixed
    </Badge>
  )}
  ```
- Helper `isAiFixed(runs)`: latest run per step → returns true if `validate` exists with status `ok` AND no step has latest status `error`.
- Ensure `fetchDrafts()` also bulk-loads runs for visible drafts (currently runs are loaded only after a pipeline completes per draft via `fetchRunsForDrafts([draftId])`). Add a one-shot `fetchRunsForDrafts(drafts.map(d => d.id))` call inside `fetchDrafts` after drafts load, so the badge shows for previously-fixed rows on page load.

### 4. Files touched
- `src/components/admin/chatgpt-agent/ChatGptAgentManager.tsx` — add stop button + ref, rewrite final summary, add AI Fixed badge in row, bulk-load runs after fetchDrafts.
- `src/components/admin/chatgpt-agent/PipelineStepBadges.tsx` — export a small helper `isDraftAiFixed(runs)` (or define locally in the manager — single use, keep local).

### 5. Deliberately unchanged
- Edge function `intake-ai-pipeline` (no server changes — stop is client-side only; in-flight request finishes naturally, which keeps the row lock honored).
- DB schema (no new columns).
- Legacy "Advanced (manual)" dropdown flow.
- Existing `PipelineStepBadges` rendering.

### 6. Risks / follow-up
- Stop is "between requests". A draft already mid-step will finish that single step before stopping (acceptable, ~10–30s). We do NOT call any abort RPC server-side.
- Bulk loading runs for up to 500 drafts per section is one extra Supabase query (`in('draft_id', ids)`), kept to a single round-trip and capped at PAGE_SIZE×... acceptable for this admin page.

