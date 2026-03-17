

# 3 Micro-Corrections to Board Result Batch Pipeline Plan

These are targeted naming/logic fixes applied to the hardened plan before implementation begins. No architectural changes.

---

## Correction 1: Duplicate Title Matching → Explicit `board_name` Naming

**Problem**: The plan uses generic "title match" terminology for duplicate detection, but the actual matching source is the structured `board_name` field — which could be confused with `display_title`, `meta_title`, or `custom_pages.title`.

**Fix**: Rename all duplicate class identifiers and helper logic that reference "title" matching to explicitly use `board_name`:

| Old name | New name |
|----------|----------|
| `exact_title_match` | `exact_board_name_match` |
| `near_title_match` | `near_board_name_match` |

In the `duplicate_matches` table CHECK constraint, the allowed `duplicate_type` values become:
- `exact_slug_match`
- `exact_board_name_match`
- `near_board_name_match`
- `exact_result_url_match`
- `exact_official_url_match`
- `exact_structured_field_identity`
- `same_board_variant_fields`
- `possible_overlap`

In `useBatchPipeline.ts` duplicate detection helpers:
- Normalization function: `normalizeBoardName(name: string)` (not `normalizeTitle`)
- Comparison function: `checkBoardNameMatch(a, b)` (not `checkTitleMatch`)
- UI labels in `DuplicateReviewPanel`: "Board Name Match" / "Near Board Name Match" (not "Title Match")
- Comments explicitly state: "Matching uses `board_name` — not display_title, meta_title, or custom_pages.title"

**Files affected**: Migration SQL (CHECK constraint values), `useBatchPipeline.ts`, `DuplicateReviewPanel.tsx` — all not yet created, so corrections are applied at creation time.

---

## Correction 2: Visible Title Year Fallback

**Problem**: `display_title = "{board_name} Result {year} - {state_ut}"` breaks if year is unavailable. No `result_year` column exists on `board_result_batch_rows` currently.

**Fix — no new column needed**: The year is derived deterministically at Enrich time, not stored as a dedicated field. Derivation rule with fallback:

```
function deriveDisplayTitle(boardName: string, stateUt: string): string {
  const year = new Date().getFullYear(); // current calendar year as safe default
  return `${boardName} Result ${year} - ${stateUt}`;
}
```

Rationale: Board result pages are inherently tied to the current exam cycle year. Using `new Date().getFullYear()` is the correct deterministic fallback since:
- These are generated in batch for the current cycle
- The Excel data doesn't carry a year column
- Current year is always a safe assumption for board results being actively uploaded

The `display_title` field (added in the migration as `TEXT` on `board_result_batch_rows`) is populated during Enrich. If Enrich hasn't run, Publish falls back to just `board_name` as the page title:

```sql
-- In publish RPC:
title = COALESCE(v_row.display_title, v_row.board_name)
```

This means: no broken titles ever — worst case is just the raw `board_name` without year decoration.

**Files affected**: `useBatchPipeline.ts` (Enrich action), publish RPC — applied at creation time.

---

## Correction 3: Backend Publish Resync Is Authoritative

**Problem**: Need to ensure correctness never depends on frontend calling resync after publish.

**Fix — already designed correctly, just needs explicit documentation enforcement**:

The `publish_board_result_row` RPC already recomputes all batch counters atomically inside the transaction:
```sql
UPDATE import_batches SET
  published_count = (SELECT count(*) FROM board_result_batch_rows WHERE ...),
  enriched_count = ...,
  -- etc
WHERE id = v_row.batch_id;
```

The clarification is:
1. The RPC is the **sole authoritative source** of counter correctness after publish
2. Frontend `afterRowStateChange()` helper that calls `resync_batch_counters` is **optional redundancy only** — a convenience for non-publish state changes (soft delete, skip, enrich, etc.)
3. After a publish call, frontend should **refetch batch data** (which reads the already-resynced counters), not call resync again
4. Comments in `useBatchPipeline.ts` will state: `// Backend publish RPC handles counter resync atomically. Frontend resync is non-essential redundancy.`
5. The `resync_batch_counters` RPC remains available for manual admin use and for non-publish mutations, but is never required for publish correctness

**Files affected**: `useBatchPipeline.ts` comments, publish RPC comments — applied at creation time.

---

## Summary

| Correction | Change | New field? | Files |
|-----------|--------|-----------|-------|
| 1. Duplicate naming | `exact_title_match` → `exact_board_name_match`, `near_title_match` → `near_board_name_match`, helpers renamed | No | Migration SQL, `useBatchPipeline.ts`, `DuplicateReviewPanel.tsx` |
| 2. Visible title fallback | `display_title` uses `new Date().getFullYear()` as deterministic year; publish falls back to raw `board_name` | No new column beyond already-planned `display_title` | `useBatchPipeline.ts` Enrich logic, publish RPC |
| 3. Backend resync authority | Publish RPC is sole authority; frontend resync is optional redundancy; comments enforce this | No | `useBatchPipeline.ts` comments, RPC comments |

All corrections are applied at creation time since the pipeline components and migration don't exist yet.

