
## Deep end-to-end verification plan for ChatGPT Agent enrichment system

This is a verification-only task (no new feature build), but it requires write-capable tools (deploy edge functions, invoke pipeline, query DB after live runs, capture screenshots). Read-only mode cannot perform steps 2, 9, partial 8.

### What I will verify, and how

**1. Migration & schema (DB read)**
- Confirm columns exist and are typed correctly: `enrichment_grade`, `enrichment_completeness`, `enrichment_source_trace`, `discovered_official_url`, `discovery_confidence`, `discovery_status`, `discovery_evidence` via `information_schema.columns`
- Confirm zero rows with `pipeline_status='completed' AND enrichment_result IS NULL`
- Confirm 218 requeued rows are in correct pre-run state
- Confirm 6 orphan `running` rows finalized

**2. Edge function deployment (deploy + diff)**
- Re-deploy `intake-ai-pipeline` to ensure latest code is live
- Curl-invoke a tiny dry-run to confirm boot + version

**3. Code-path audit (read-only)**
For each function in `supabase/functions/_shared/intake-evidence.ts`, `intake-ai.ts`, and `intake-ai-pipeline/index.ts`:
- Single terminal-write contract (grep all exit paths)
- Pre-commit no-NULL assertion
- Stage-2 trigger broadening
- Stage-3 discovery: candidate → fetch → domain+content gates → staging-only write
- Aggregator blocklist applied at every promotion site
- Conflict resolver: fresher official wins
- AI evidence-tag verification (rejects fields whose source tag doesn't resolve)
- JSON cleanup parser robustness
- Lock acquire/release on all paths (including throws)
- Timeout + retry classes mapped to `not_enriched_tech_error`

**4. State-model behavior (DB + UI)**
Tabulate writes for each of the 3 terminal states by grepping `enrichment_result =` writes; confirm UI reads (`isAiFixed`, `terminalStateOf`, `scanAllUnfixedAcrossSections`, bulk runner toast) match the matrix.

**5. Live full-run (write)**
- Trigger "Run All Needed Fixes" on the 218 requeued rows in batches via `supabase--curl_edge_functions` (or by clicking through browser if needed)
- Wait for completion; poll `intake_drafts` until `pipeline_status` settles for all
- Report final 3-state counts on all 278

**6. Per-stage contribution counts**
Query `enrichment_source_trace` + `enrichment_grade` to bucket: row-evidence-only, official-HTML-contributed, official-PDF-contributed, discovery-promoted, minimal_verified

**7. Spot-checks (10 rows)**
- 2 rows per grade (full / official_pdf / official_refresh / partial / minimal_verified)
- 1 conflict resolution example (stale structured value vs fresher PDF)
- 1 successful discovery promotion
- 1 rejected discovery candidate (kept in `discovered_*` only)
- 1 row terminating as `not_enriched_no_grounded_evidence` with reason
- 1 row terminating as `not_enriched_tech_error` with error class
For each: show written fields next to source-trace URL + fetched_at + excerpt.

**8. UI verification (browser)**
Screenshot `/admin` → ChatGPT Agent section showing:
- 3-state counter banner with real numbers
- Per-row grade badges
- "Select all unfixed" yields zero after run (proves no_grounded_evidence is excluded)
- Re-running "Run All Needed Fixes" picks zero rows (proves terminal states stay terminal)
- Tech-error row, if any, IS included

**9. Regression checks (read + UI)**
- Row ordering query unchanged
- Tabs/filter counts match DB
- Single-row publish dry-run unchanged
- Bulk publish excludes no_grounded_evidence by default; opt-in includes them

**10. Final report** delivered in the exact 9-section structure requested, with raw counts, code excerpts proving each claim, DB query results, and screenshots.

### Capabilities required (currently blocked in read-only)
- `supabase--deploy_edge_functions` for #2
- `supabase--curl_edge_functions` to run the pipeline batches for #5
- `psql` / migration tool to run the live-run polling and post-run analytics queries
- `browser--*` for UI screenshots in #8
- ~30–60 minutes of pipeline run time for the 218 requeued rows (uses `EdgeRuntime.waitUntil`)

### What I will NOT do
- No code changes unless I find a bug during the audit; if I find one I will stop and report it before fixing
- No new features
- No changes outside the verification surface

Approve and I will execute this audit and deliver the 9-section report with hard evidence.
