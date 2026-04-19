
## Diagnosis: why the toast says "278/278 not enriched"

The toast IS truthful now (it reads real DB state per row). The actual numbers:

| Bucket | Count | What it really is |
|---|---|---|
| ✅ enriched | 88 | already good (59 completed + 18 legacy + 10 mid-flight + 1 seo_fix-failed) |
| ⚪ no_grounded_evidence | 14 | 12 + 2 honestly terminal (pipeline went through enrich, found nothing) |
| ❌ tech_error | 0 | none |
| ⏳ pending (NULL `enrichment_result`) | **194 + 2 legacy = 196** | requeued rows still parked at `classify` |
| 🔄 stuck `running` (orphans) | 24 | crashed mid-pipeline; the ones with `enrichment_result` set are partial |

**Two real problems to fix, not toast-level:**

### Problem 1 — 24 orphan "running" rows
Their `pipeline_lock_token IS NULL` but `pipeline_status='running'` from earlier crashed batches. The runner never finalized them. `terminalStateOf` reads their already-written `enrichment_result` (so 10 already correctly show `enriched`, 14 show `no_grounded_evidence`), but the row is still locked-looking to the rest of the system because `pipeline_status='running'`. Need to flip these to `completed` (since `enrichment_result` is set) so they stop blocking.

### Problem 2 — 194 requeued rows never advanced
They were reset to `pipeline_current_step='classify'`, `pipeline_status='failed'`, `pipeline_last_error='requeued_for_new_three_state_pipeline'`, `enrichment_result=NULL`. The "Run All Needed Fixes" runner DOES select them (correctly — they're `pending` per `terminalStateOf`). But during the most recent run the user only processed a subset — the runner stopped, was killed, or hit batch limits. They are sitting healthy and re-runnable.

### Plan

**Step 1 — One-shot SQL recovery (orphans + cleanup):**
- For the 24 `pipeline_status='running'` rows where `enrichment_result IN ('enriched','not_enriched_no_grounded_evidence')`: set `pipeline_status='completed'`, `pipeline_current_step='validate'`, clear lock fields. They're done.
- For the 2 legacy `not_enriched_no_data` rows: reset to `pipeline_status='failed'`, `pipeline_current_step='classify'`, `enrichment_result=NULL` so they get the new three-state path.

**Step 2 — Re-run "Run All Needed Fixes" on the now-clean 196 unfixed:**
- After Step 1, "Select all unfixed across all sections" will pick exactly the 194 + 2 = 196 truly pending rows.
- Click "Run All Needed Fixes" — these will go classify → enrich → improve_title → ... → validate → completed, each terminating in one of the three states.
- The toast will then show truthful final counts: ~90+ enriched / some no-evidence / some tech-error / 0 pending.

**Step 3 — Verification queries after run:**
- Count `enrichment_result` distribution (should sum to 278, zero NULL with `pipeline_status='completed'`)
- Per-stage contribution from `enrichment_grade`
- Spot-check 5 of the 194 → confirm grounded source_trace

### Why this is the right fix
- The toast is no longer lying — fixing it would re-introduce the dishonest "succeeded" inflation. Keep the truthful toast.
- The 194 are honestly NOT enriched yet because the previous bulk run didn't finish them. The system isn't broken; the work just wasn't completed.
- After Step 2 they'll each get an honest terminal state.

### Files / actions
- One small SQL migration (orphan finalize + 2-row reset). No code changes.
- User clicks "Select all unfixed" → "Run All Needed Fixes" → wait → I deliver final verification.

### Risk
Low. SQL only touches misclassified pipeline-state fields, never overwrites real `enrichment_result` values.
