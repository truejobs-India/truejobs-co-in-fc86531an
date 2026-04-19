
## Plan: "Select all unfixed across all sections" toolbar action

### Audit findings (from reading `ChatGptAgentManager.tsx`)

**Predicate (already exists, will be reused verbatim):**
- `isAiFixed(runs: PipelineRun[]): boolean` at lines 112–122. A draft is "fixed" when the latest `validate` run is `ok` AND no step's latest status is `error`. "Needs fix" = `!isAiFixed(runs)`.
- Source of truth for runs: table `intake_pipeline_runs`, columns `draft_id, step, status, reason, created_at`. Already fetched by `fetchRunsForDrafts` (lines 171–189).
- No extraction needed — the helper is already a single shared function. The new scanner will call it directly. **Zero behavioral change.**

**Runner (already global-selection compatible — no fix required):**
- `runFullPipeline(ids: string[])` at line 580 iterates the `ids` array as-is — calls the edge function per-`draftId` with no dependency on visible/filtered rows or active tab.
- Trigger button at line 753: `runFullPipeline(Array.from(selected))` — passes the entire `selected` Set, not visible rows.
- Conclusion: selecting cross-section IDs and clicking "Run All Needed Fixes" already works end-to-end. No runner changes.

**Selection state:** `selected: Set<string>` at line 80. Cleared only at end of pipeline (line 693). Safe to replace via `setSelected(new Set(ids))`.

**Scope column:** screen is already strictly scoped to `source_channel = 'chatgpt_agent'` (lines 140, 164, 291…). The new scan uses the same filter.

### Implementation (single file: `ChatGptAgentManager.tsx`)

**1. New paginated scanner function `scanAllUnfixedAcrossSections`:**
- Page 1: query `intake_drafts` selecting only `id, section_bucket, publish_target` where `source_channel='chatgpt_agent'`, ordered by `id`, using `.range(from, from+999)` loop until a short page returns. (Per project pagination policy.)
- Collect all draft IDs.
- Second loop: fetch `intake_pipeline_runs` (`draft_id, step, status, created_at`) for those IDs in chunks of 500 via `.in('draft_id', chunk)`, also paginated by `.range()` to safely exceed 1000.
- Group runs by `draft_id` in a `Map`.
- For each draft id: apply `!isAiFixed(runsMap.get(id) || [])` → keep matching IDs.
- Return `{ matchedIds: string[], bySection: Record<string, number> }`.

**2. New state:**
- `scanning: boolean` (drives button label `Scanning…` and disables it).
- `crossSectionScope: { total, visibleHere, hiddenInOthers, bySection } | null` — persistent banner data; cleared when selection becomes empty or fully visible.

**3. New button** placed next to "Select all visible" (line 962 area):
- Label: `Select all unfixed across all sections`
- Disabled when `aiProcessing || scanning`.
- On click → `scanning=true` → run scanner → on success: `setSelected(new Set(matchedIds))`, set `crossSectionScope`, toast `Selected N unfixed drafts (Y in this tab, Z in other sections)`.
- On 0 matches: toast `No unfixed drafts found across any section`. **Do not touch `selected`. Do not touch `crossSectionScope`.**
- On fetch failure: toast `Failed to scan drafts: <message>`. **Do not touch `selected`. Do not touch `crossSectionScope`.**

**4. Persistent cross-section scope banner** (compact, below the button row, only when `crossSectionScope` is set and `hiddenInOthers > 0`):
```
Selection spans all sections — Total: X · Visible here: Y · Hidden in other sections: Z   [Clear]
```
- `[Clear]` clears `selected` and `crossSectionScope`.
- Auto-recompute `visibleHere`/`hiddenInOthers` from current `filteredDrafts` on each render so it stays accurate as the user switches tabs/filters.
- Auto-hide when `selected.size === 0`.

**5. Selection guarantees enforced:**
- Replace selection only after the full scan completes successfully.
- Do not clear prior selection on zero matches or on failure.
- Scanner ignores active tab, `filteredDrafts`, link filter, search, and dropdown filters — uses only `source_channel='chatgpt_agent'`.

### Strict scope guard (untouched)
Row ordering, all filter dropdowns, link filter, badges, tabs, scope banner copy, "Select all visible", "Run All Needed Fixes", advanced dropdown, edge functions, schema, RLS, other admin views.

### Verification report (delivered after implementation)
1. **Predicate audit** — quote the original `isAiFixed` lines 112–122; confirm the scanner imports/calls the same function reference; confirm no edits to its body.
2. **Runner audit** — quote line 753 (`runFullPipeline(Array.from(selected))`) confirming it already honored global selection; **no runner change applied**.
3. **Real counts** — invoke the new button live, capture `matchedIds.length`, and cross-check via `supabase--read_query` against `intake_drafts` joined to latest `intake_pipeline_runs` to confirm the same total. Report exact number.
4. **Cross-section proof** — print the `bySection` breakdown (counts per `section_bucket`) from the same scan results.
5. **Spot-check** — pick 3 selected IDs and 3 non-selected IDs from the scan; print their latest per-step run statuses; confirm selected rows truly violate `isAiFixed` and non-selected rows satisfy it.
6. **Regression** — confirm row order (locked fix intact), filter dropdowns, badges, tabs, "Select all visible", and "Run All Needed Fixes" on a small selection all behave identically.

### Risk
Low. One file. Additive UI + read-only paginated scan + selection replacement guarded by success. Predicate and runner reused verbatim — zero behavioral drift in existing flows.
