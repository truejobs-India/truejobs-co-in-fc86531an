

## Add visible processing indicator for AI actions

**File:** `src/components/admin/chatgpt-agent/ChatGptAgentManager.tsx`

### Changes

1. **Progress state**
   - `aiProgress: { action, current, total, batchIndex, totalBatches } | null`
   - `processingChunkIds: Set<string>`
   - Update inside the existing chunk loop in `handleAiAction` — set before each batch, clear on completion

2. **Sticky processing banner** (below `<AdminMessageLog>`)
   - Visible only when `aiProcessing === true`
   - Shows: spinner + "AI {action} in progress" + "Batch X of Y · N of M drafts" + selected model name
   - Determinate `<Progress>` bar (`current / total * 100`)
   - Amber/blue accent border matching existing message log aesthetic

3. **Per-row "Processing…" badge**
   - In the drafts table, when a row's id is in `processingChunkIds`, render a small badge with spinner next to the title

4. **Keep existing**: button spinner + start/finish admin messages (complementary, not replaced)

### Result
User sees a live banner ("Batch 2 of 5 · 10 of 25 drafts"), a filling progress bar, and per-row "Processing…" badges on drafts in the current batch.

~30 lines added, 1 file changed.

