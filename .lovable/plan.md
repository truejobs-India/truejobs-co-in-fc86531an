
## Audit findings

| Question | Answer (verified) |
|---|---|
| Can admin delete from `intake_drafts` directly? | Yes — RLS policy `Admin delete intake_drafts USING has_role(auth.uid(),'admin')` is already in place. No edge function needed. |
| What rows depend on a draft id? | Only `intake_pipeline_runs.draft_id` (FK with `ON DELETE CASCADE`). No other tables reference draft ids. |
| Does deleting a draft affect the public live record? | **No.** `published_record_id` + `published_table_name` are stored values, not FKs. The live row in `employment_news_jobs` / `govt_exams` / `govt_results` / `govt_admit_cards` / `govt_answer_keys` is fully independent. Deleting the draft leaves the public page live and intact. |
| Existing unpublish behavior | `handleUnpublish` sets the live row's `status='draft'` (hides it) and clears `published_at` + `review_status` on the draft. It does NOT delete the live row. |
| What "Published" means in this UI | `processing_status === 'published'` (matches the existing Published tab filter). |
| Current totals | 278 chatgpt_agent drafts: 2 published, 276 unpublished. |

## Safest delete design (decision)

1. **Delete unpublished drafts** → permanent `DELETE FROM intake_drafts` for rows where `source_channel='chatgpt_agent' AND processing_status<>'published'`. Pipeline runs cascade-clean. Public site untouched. Safe.
2. **Delete selected drafts** → permanent delete of exactly the selected ids, scoped to `source_channel='chatgpt_agent'` as a defensive guard. If the selection contains any `processing_status='published'` rows, the confirm dialog flags them with a separate count and forces a second checkbox before proceeding.
3. **Delete published drafts** → split into two clearly-labeled actions, only the safe one enabled by default:
   - **"Delete published drafts (keep public pages live)"** — deletes only the draft row. Public live record stays published. This is the safe, recommended path.
   - We do **NOT** ship a "delete draft + public record" bulk action. The live tables are shared with non-chatgpt-agent content and have their own admin views. The existing per-row Unpublish toggle remains the one true way to take a public page down.

## Scope rule (always full DB, never visible-only)

All three bulk actions operate on the **full chatgpt_agent dataset across all sections**, not the current tab/filter. This is the safest reading of "all published / all unpublished" because the manager paginates and a hidden filter could otherwise silently exclude rows. The confirm dialog states scope explicitly: "This will delete N drafts across all sections (ignoring current filters)."

"Delete selected" uses exactly `Array.from(selected)` ids — no filter coupling.

## Implementation (smallest correct)

**One file edited**: `src/components/admin/chatgpt-agent/ChatGptAgentManager.tsx`

Add a small destructive zone in the toolbar (right side, separated, red-tinted dropdown):

```
[ Trash2 ▾ Delete ]
  ├── Delete selected drafts (N)
  ├── ─────────
  ├── Delete all unpublished drafts (276)
  └── Delete all published drafts — drafts only, public pages stay live (2)
```

Each item opens an `AlertDialog` with:
- Exact resolved count (re-queried at click time via `count: 'exact', head: true` using `CHATGPT_AGENT_FILTER`)
- Scope statement ("across all sections" / "exactly the N selected ids")
- Explicit warning for the published action: "Public live pages will remain published. Use per-row Unpublish to take pages down."
- Type-to-confirm `DELETE` for any bulk action affecting >50 rows
- Hard `Confirm delete` button

On confirm:
- Chunked `DELETE` in batches of 500 ids using `.in('id', chunk)` with the safety guard `.eq('source_channel','chatgpt_agent')` always present
- Track `deleted` and `failed` counts; surface real Postgres errors via `addMessage('error', ...)`
- After completion: clear `selected`, clear `crossSectionScope`, call `fetchDrafts()` + `fetchCounts()`
- Toast summary: `Deleted X of Y drafts. Z failed.`

**Reuses**: `CHATGPT_AGENT_FILTER` (single source of truth), existing `addMessage`, existing `fetchDrafts`/`fetchCounts`, existing `Dialog`/`AlertDialog` primitives.

**No new files. No new RPC. No edge function.** Pure additive client-side delete under the existing admin RLS policy.

## Files changed
- `src/components/admin/chatgpt-agent/ChatGptAgentManager.tsx` — add delete dropdown, three confirm dialogs, one shared `executeDelete(ids, label)` helper.

## Verification I will run after implementation
1. Pre/post counts of `intake_drafts WHERE source_channel='chatgpt_agent'` for each action.
2. Confirm `intake_pipeline_runs` for deleted ids is auto-cleaned (FK cascade).
3. Confirm a published draft's `published_record_id` row in the live table still exists with `status='published'` after "delete drafts only".
4. Confirm no rows outside `source_channel='chatgpt_agent'` were touched (count of other channels unchanged).
5. Confirm filters/tabs/selection/counters/export/pipeline still work (manual click-through).
6. Confirm error path: simulate failure (e.g., bad id format) → toast surfaces real error, no silent partial delete claim.
