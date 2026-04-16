

## Switch ChatGPT Agent AI actions from batched to one-by-one processing

**File:** `src/components/admin/chatgpt-agent/ChatGptAgentManager.tsx`

### Change

In `handleAiAction`, replace the `CHUNK = 5` batching loop with a sequential `for` loop that sends **one draft per request**.

### Logic
- Loop through selected `ids` one at a time
- For each id: invoke the edge function with `ids: [singleId]`, update progress, mark that single id as "Processing…"
- `totalBatches` becomes `ids.length` (each draft = its own batch)
- Keep existing stop/error handling, progress banner, per-row badge, and start/finish messages — they already work per-iteration

### Why
- Avoids 504 IDLE_TIMEOUT entirely (each request = ~15–20s, well under 150s)
- Per-row "Processing…" badge becomes accurate (one row at a time)
- Progress banner updates after every single draft instead of every 5
- Simpler mental model; failures isolated to one draft

### Tradeoff
- Slightly more total wall-clock time (no parallelism within edge function), but reliability + visibility outweigh this for admin tooling.

**~10 lines changed in one function, no new state, no UI changes.**

