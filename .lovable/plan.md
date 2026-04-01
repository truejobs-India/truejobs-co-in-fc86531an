

# AI-First Intake Pipeline — Final Plan (with two clarifications)

This is the same approved plan with two points made explicit:

## Clarification 1: Scoping auto-processing to the current import

After upload, the importer will return the **list of inserted row IDs** (not just a count). The auto-processing loop in `IntakeDraftsManager` will use these specific IDs to call `intake-ai-classify`, not a generic query like "all rows where `processing_status = 'imported'`".

**Implementation detail:**
- `IntakeCsvUploader.onImportComplete` callback changes from `(count: number)` → `(importedIds: string[])`
- The processing loop fetches batches using `.in('id', nextBatchOfIds)` instead of `.eq('processing_status', 'imported')`
- The AI retry pass similarly scopes to `manual_check` rows **within the same set of IDs**
- If the page refreshes mid-processing, a "Resume Processing" button will query for rows from this import that are still `processing_status = 'imported'`. To identify them, the importer will tag all rows with a shared `scrape_run_id` (a generated UUID per import session). The resume query uses `.eq('scrape_run_id', sessionId).eq('processing_status', 'imported')`.

This guarantees nearby/older imports are never accidentally mixed into the current processing run.

## Clarification 2: Delete All Permanently — explicit scope labeling

The "Delete All Permanently" button will always state its exact scope in both the button label and the confirmation dialog:

- On the **Ready Drafts** tab → button reads **"Delete All Ready Drafts"**, confirmation says "This will permanently delete X ready drafts."
- On the **Low Confidence** tab → button reads **"Delete All Low Confidence Drafts"**, confirmation says "This will permanently delete X low-confidence drafts."
- On the **Published** tab → button reads **"Delete All Published Drafts"** (draft records only, not the live published content — this is stated in the dialog).
- If a search/filter is active → the label appends **(filtered)** and the confirmation shows the exact count: "This will permanently delete X drafts matching your current filter."

The type-to-confirm ("Type DELETE") safety gate remains for all "Delete All" variants.

There will never be an ambiguous "Delete All" button with unclear scope.

## Everything else: unchanged from the approved plan

### Files changed (4 total)
| File | Change |
|------|--------|
| `IntakeCsvUploader.tsx` | Excel support, auto-skip mapping, return imported IDs + scrape_run_id |
| `IntakeDraftsManager.tsx` | Draft-first dashboard, ID-scoped auto-processing, bulk approve & publish, scoped delete all |
| `IntakeDraftDetailDialog.tsx` | Add Approve & Publish + Delete buttons |
| `intake-ai-classify/index.ts` | Add `retry_enhanced` prompt mode (strict standards) |

### No database changes needed.

### Admin experience
```text
Upload Excel → auto-map → auto-import (tagged with scrape_run_id)
→ auto-AI pass 1 (scoped to imported IDs)
→ auto-AI pass 2 retry (scoped to same IDs, strict standards)
→ dashboard shows Ready Drafts tab
→ Approve & Publish Selected / All Ready
→ Delete All [tab-specific label] Permanently (with type-to-confirm)
→ Done
```

