

# Updated Plan: Bulk Run All + AI Step Indicators

## Files to Edit

| File | Changes |
|------|---------|
| `src/components/admin/firecrawl/FirecrawlDraftsManager.tsx` | Add bulk run button, progress UI, cancel support. Replace AI step dots with labeled badges using enrichment log data. Fetch `ai_enrichment_log` in query. |
| `supabase/functions/firecrawl-ai-enrich/index.ts` | In `handleAiRunAll`, persist failed/skipped step entries into `ai_enrichment_log` so failures are visible after the fact. |

---

## A. Bulk Run All — Default Eligibility

**Default rule (draft rows only):**
- `status === 'draft'` — reviewed, approved, rejected rows are **excluded**
- `dedup_status !== 'duplicate'`
- Not currently in `busyRows`

**Scope:** operates on the currently loaded/filtered list only. If the "Draft" filter tab is active, only those rows. If "All" is active, still only rows matching the eligibility rules above (i.e. draft-status rows within the visible set).

Reviewed rows are **not** included by default.

**UI:**
- Button in header: "⚡ Bulk Run All" (disabled when already running or no eligible rows)
- `window.confirm` with eligible count before starting
- Progress bar below filter tabs: "Processing 3/12 — Title..." with succeeded/failed/skipped counts
- Cancel button (stops after current row finishes)
- Persistent dismissible summary card at end showing succeeded/failed/skipped with failed row titles and errors
- Auto-refreshes draft list on completion

**Sequential execution:** Client-side `for` loop over eligible rows, calling existing `runAiAction(id, 'ai-run-all')` one at a time. Uses a `useRef` cancel flag checked between iterations.

---

## B. AI Step Indicators — State Determination

### Data source
Add `ai_enrichment_log` to the select query. This is a JSON array where each entry has `{ action, at, ...details }`.

### Backend change (edge function)
In `handleAiRunAll`, after processing all steps, persist failed step entries into `ai_enrichment_log`:

```typescript
// After the loop, write failure entries for steps that failed
const draft = await fetchDraft(draftId, client);
let log = draft.ai_enrichment_log || [];
for (const r of results) {
  if (!r.success) {
    log = [...log, { action: r.step, at: new Date().toISOString(), status: 'failed', error: r.error }];
  }
}
if (results.some(r => !r.success)) {
  await client.from('firecrawl_draft_jobs').update({ ai_enrichment_log: log }).eq('id', draftId);
}
```

Also add a `status: 'success'` field to existing `appendLog` calls so successful entries are explicitly tagged (backward compatible — existing entries without `status` are treated as success since they only get written on success).

### Step-to-field mapping

| Step | Timestamp field | Log action name |
|------|----------------|-----------------|
| Clean | `ai_clean_at` | `ai-clean` |
| Enrich | `ai_enrich_at` | `ai-enrich` |
| Links | `ai_links_at` | `ai-find-links` |
| Fix | `ai_fix_missing_at` | `ai-fix-missing` |
| SEO | `ai_seo_at` | `ai-seo` |
| Prompt | `ai_cover_prompt_at` | `ai-cover-prompt` |
| Image | `ai_cover_image_at` | `ai-cover-image` |

### State determination logic (per step)

```
function getStepState(draft, stepAction, timestampField, busyAction):
  if busyRows[draft.id] matches this step → "running"
  if draft[timestampField] is not null → "completed"
  
  // Check enrichment log for last entry matching this action
  lastEntry = last item in ai_enrichment_log where action === stepAction
  if lastEntry exists:
    if lastEntry.status === 'failed' → "failed" (tooltip: lastEntry.error)
    if lastEntry.status === 'skipped' → "skipped"
    // entry exists without explicit status = legacy success but timestamp missing
    // (e.g. after rollback) → "pending"
  
  → "pending" (never attempted)
```

| State | How determined | Badge |
|-------|---------------|-------|
| **Pending** | No timestamp, no log entry (or rolled back) | Gray outline: `○ Clean` |
| **Running** | `busyRows[id]` matches step or is `ai-run-all` and step is current | Blue spinning: `⟳ Clean` |
| **Completed** | `ai_*_at` timestamp exists | Green: `✓ Clean` |
| **Failed** | No timestamp + last log entry has `status: 'failed'` | Red: `✗ Clean` (tooltip shows error) |
| **Skipped** | No timestamp + last log entry has `status: 'skipped'` | Yellow/amber: `⊘ Clean` |

### Visual design
Replace the 7 tiny identical dots with a row of compact labeled mini-badges:

```text
✓Clean  ✓Enrich  ✗Links  ○Fix  ○SEO  ○Prompt  ○Image
```

Each badge is a small `<Badge>` with:
- Icon (CheckCircle / Loader2 spinning / Circle / XCircle / Ban)
- Short label (Clean, Enrich, Links, Fix, SEO, Prompt, Image)
- Color coding: green/blue/gray/red/amber
- Tooltip with timestamp (if completed) or error message (if failed)

---

## C. Safeguards Preserved

- All server-side guards (`checkStatusGuard`, `getProtectedFields`, `admin_edited_fields`) untouched
- No auto-publish — `ai-run-all` never touches `jobs` table
- Reviewed/approved/rejected rows excluded from bulk by default
- Dedup logic intact — duplicate rows excluded
- Sequential processing prevents rate-limit issues
- Existing row-level AI actions and dropdown menu unchanged

