
## Final plan — three-state model + reprocess-before-relabel

### Three-state top-level result (single source of truth)
- `enriched` — ≥1 externally-grounded verified fact written; richness in `enrichment_grade` (`full | official_pdf | official_refresh | partial_verified | minimal_verified`) + `enrichment_completeness` + `enrichment_source_trace`
- `not_enriched_no_grounded_evidence` — full Stages 1–3 attempted, no trustworthy evidence found; **terminal, not retried, treated as fixed**
- `not_enriched_tech_error` — true tech failure; **retryable, treated as unfixed**

Single terminal-write contract in `runEnrichStep` + final assertion blocks any commit where `enrichment_result IS NULL` AND `pipeline_status='completed'`.

### Behavior matrix (consistent everywhere)
| Surface | enriched | no_grounded_evidence | tech_error |
|---|---|---|---|
| Select all unfixed | excluded | excluded | included |
| Run All Needed Fixes | skipped | skipped | retried |
| Toolbar counter | ✅ Enriched | ⚪ No grounded evidence | ❌ Tech failure |
| Bulk publish default | eligible | excluded (opt-in checkbox) | excluded |

### Strict "minimal_verified" rule
Requires ≥1 externally-grounded fact from a fetched + content-validated trusted source. Title normalization / guessed org / unfetched discovery candidates do NOT qualify.

### Stage-3 discovery (staged, never auto-promoted)
Candidates → Firecrawl fetch → domain-trust + content-relevance gates → stored in `discovered_*`. Promoted to `official_notification_url` only when `discovery_confidence='strong'` AND content matches title/org tokens.

### Domain trust (broadened beyond TLD)
1. Primary explicit official URLs from row
2. Prior promoted official URLs (`official_fetch_status='ok'` + content-validated)
3. Discovered URL passing BOTH domain check (`.gov.in`, `.nic.in`, `.ac.in`, `.edu.in` + seeded allowlist from `firecrawl_sources`) AND content check (institution markers, no aggregator host substrings)

TLD alone never sufficient.

### Schema (additive only)
```sql
ALTER TABLE intake_drafts
  ADD COLUMN IF NOT EXISTS enrichment_grade text,
  ADD COLUMN IF NOT EXISTS enrichment_completeness int,
  ADD COLUMN IF NOT EXISTS enrichment_source_trace jsonb,
  ADD COLUMN IF NOT EXISTS discovered_official_url text,
  ADD COLUMN IF NOT EXISTS discovery_confidence text,
  ADD COLUMN IF NOT EXISTS discovery_status text,
  ADD COLUMN IF NOT EXISTS discovery_evidence jsonb;
```

### Recovery sequence (reprocess BEFORE relabel — corrected)
**Step A — One-shot SQL (recovery only, no relabel):**
- 6 orphan `running` rows → `pipeline_status='failed'`, clear lock, `pipeline_last_error='orphan_recovered'` (re-runnable as tech_error class)
- 8 NULL-result completed rows → reset `pipeline_current_step='enrich'`, `pipeline_status='failed'`, `enrichment_result=NULL` (re-runnable)
- **205 historical `not_enriched_no_data` rows → reset `pipeline_current_step='enrich'`, `pipeline_status='failed'`, `enrichment_result=NULL`, set marker `enrichment_reason='requeued_for_new_pipeline'`** (re-runnable, NOT renamed)

**Step B — Run new pipeline on all requeued rows via existing "Run All Needed Fixes":**
- Full staged retrieval (Stage 1 → Stage 2 broadened official refresh + PDF → Stage 3 discovery)
- Each row terminates in exactly one of the three states based on real outcome

**Step C — Only after Step B:** rows that still have no trustworthy evidence are now legitimately written as `not_enriched_no_grounded_evidence` by the pipeline itself. No blanket rename.

### Root cause of 8 NULL-result completed rows
Historical bug: prior `enrich` step had an early-exit branch that wrote `pipeline_status='completed'` and advanced `pipeline_current_step` without setting `enrichment_result` when `hasSubstantialEvidence()` returned false AND no official URL existed. The new single terminal-write contract + pre-commit assertion eliminates this class by construction.

### Files changed
- `supabase/functions/_shared/intake-evidence.ts` — broadened Stage-2 triggers, NEW Stage-3 discovery + validation, completeness scoring, source-trace builder
- `supabase/functions/_shared/intake-ai.ts` — per-field source tags, grade extraction, evidence-tag verification (rejects fields whose source tag doesn't resolve)
- `supabase/functions/intake-ai-pipeline/index.ts` — single terminal-write contract, three-state writer, no-NULL pre-commit assertion
- One-shot SQL migration (recovery only — orphans + NULL-results + 205 requeue, NO rename)
- `src/components/admin/chatgpt-agent/ChatGptAgentManager.tsx` — three-state counters, grade badge, "Select all unfixed" reads new model, bulk runner reads real per-row state, opt-in "Include no-evidence rows" checkbox for bulk publish

### Out of scope
RLS, model dispatch, image generation, classification, row order, tabs, single-row publish flow, filters other than the new bucket.

### Verification I will deliver after coding (full 278)
1. Final three-state counts (sum = 278; zero NULL-result completed)
2. **From the historical 205-row bucket specifically (per user requirement):**
   - count flipped to `enriched` (broken down by which stage contributed: Stage-2 HTML, Stage-2 PDF, Stage-3 promoted, minimal_verified)
   - count terminating as `not_enriched_no_grounded_evidence`
   - count terminating as `not_enriched_tech_error`
3. From the 8 NULL-result rows: their new terminal states with reasons
4. From the 6 orphan rows: shown finalized + re-run outcome
5. Per-stage contribution across all 278 (A/B/C/D/E)
6. 5 spot-checks per `enriched` grade — written field next to source_trace entry (URL + fetched_at + excerpt)
7. Conflict spot-check: stale structured value correctly NOT used vs fresher PDF
8. Discovery spot-check: candidate → validation → promotion or rejection (with reason)
9. Negative spot-check: row tempting for `minimal_verified` from title-only signals — proof it landed in `not_enriched_no_grounded_evidence` instead
10. Proof `not_enriched_no_grounded_evidence` rows are excluded from "Select all unfixed" and not picked by re-running "Run All Needed Fixes"
11. Proof `not_enriched_tech_error` rows ARE retried by the runner
12. Confirm row order, tabs, filters, single-row publish, bulk publish unchanged

### Risk
Medium-low. Three-state enum is single source of truth. Reprocess-before-relabel guarantees no row is unfairly frozen into the no-evidence bucket. Discovery gated behind validation. Additive columns only. No model fallbacks.
