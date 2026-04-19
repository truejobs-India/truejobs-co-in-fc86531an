
## Final plan: Full-fidelity Excel export of ChatGPT Agent drafts

### 1. Shared filter (single source of truth)
**New** `src/components/admin/chatgpt-agent/filter.ts`:
```ts
export const CHATGPT_AGENT_FILTER = {
  description: "<exact predicate read from ChatGptAgentManager.tsx at implementation time>",
  apply: (qb) => /* same chain the manager uses today */,
};
```
Refactor `ChatGptAgentManager.tsx` list query to call `CHATGPT_AGENT_FILTER.apply(qb)`. Export reuses it. Metadata sheet's `filter_predicate` cell reads from `CHATGPT_AGENT_FILTER.description` — guaranteed identical to what was fetched.

### 2. Schema RPC — plpgsql with internal admin gate
**New SQL migration**:
```sql
CREATE OR REPLACE FUNCTION public.get_intake_drafts_columns()
RETURNS TABLE(column_name text, data_type text, ordinal_position int)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, information_schema
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Admin role required';
  END IF;

  RETURN QUERY
  SELECT c.column_name::text, c.data_type::text, c.ordinal_position::int
  FROM information_schema.columns c
  WHERE c.table_schema = 'public' AND c.table_name = 'intake_drafts'
  ORDER BY c.ordinal_position;
END;
$$;

REVOKE ALL ON FUNCTION public.get_intake_drafts_columns() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_intake_drafts_columns() TO authenticated;
```
Canonical column list. NULL-only columns still appear. Admin-gated server-side.

### 3. Globally deterministic split-part headers
Three-pass build:
- **Pass A (measure):** for every row × every schema column, serialize and record `partsNeeded = ceil(len/32000)`. Track `maxParts[column]` across all rows.
- **Pass B (header):** in `ordinal_position` order emit `column`, then if `maxParts[column] >= 2` emit `column__part_2 … column__part_N` immediately after. Any row-key not in schema → appended at tail as `__unexpected__<key>` and flagged in metadata.
- **Pass C (write):** every row writes to the exact same global header set. Empty parts → blank cell.

Identical regardless of row order or fetch batching.

### 4. Force-string for byte-exact preservation (never mutate values)
Rules in `cellFor(value)`:
- `null/undefined` → blank cell, no type
- `boolean` → `{ t:'b', v }`
- `number` finite & safe (`Number.isSafeInteger(v)` or `|v|<1e15`) → `{ t:'n', v }`
- everything else (strings — including UUIDs, slugs, URLs, ISO timestamps, long numeric IDs, and **values starting with `=`, `+`, `-`, `@`**) → `{ t:'s', v: stringValue }`
- `object/array` → `{ t:'s', v: JSON.stringify(value) }`

**Critical:** formula-like values (`=SUM(...)`, `+1`, `-2`, `@cmd`) are NOT mutated, NOT prefixed with apostrophe, NOT zero-width-escaped. They are written with explicit `t:'s'` so SheetJS stores them as inline strings (`<is>` element), not formulas (`<f>`). Round-trip is byte-exact. The Export_Metadata sheet documents this so reviewers know cells displaying `=SUM(...)` are literal text from the DB, not Excel formulas.

### 5. Workbook structure
- **Sheet 1 `Drafts`** — header row frozen + bold, col widths capped at 60, one row per draft, all schema columns + split parts + any `__unexpected__*`.
- **Sheet 2 `Export_Metadata`** — `exported_at`, `exported_by`, `source_table=public.intake_drafts`, `filter_predicate` (from `CHATGPT_AGENT_FILTER.description`), `total_rows_in_db` (via `count:'exact', head:true`), `total_rows_exported`, `rows_match` (TRUE else hard-abort), `total_columns_from_schema`, `total_columns_written`, `unexpected_columns`, `formula_like_values_preserved_as_strings: TRUE`, `split_fields_count`, then a table `row_id | column | original_length | parts | data_type` for every split, then the reconstruction rule + 6-line Python snippet.

### 6. Files
- **New** `supabase/migrations/<ts>_get_intake_drafts_columns.sql`
- **New** `src/components/admin/chatgpt-agent/filter.ts`
- **New** `src/components/admin/chatgpt-agent/exportDrafts.ts` — paginated `.range()` 1000-row fetch (per project policy) → schema RPC → 3-pass workbook → browser download
- **Edit** `src/components/admin/chatgpt-agent/ChatGptAgentManager.tsx` — refactor list query to use shared filter; add toolbar button "⬇ Download all drafts as Excel" with progress toast and hard-fail on row-count mismatch
- **Dep**: ensure `xlsx` (SheetJS) is in `package.json`; add if missing

### 7. Hard-fail contract
If `count(*)` from DB ≠ rows fetched → abort, no download, real error toast. No silent partial export.

### 8. Verification after build
1. `total_rows_exported == SELECT count(*) FROM intake_drafts WHERE <filter>` — equality required
2. `total_columns_written == schema_columns + Σ(maxParts[c]-1) + unexpected_count` — arithmetic check
3. `unexpected_columns` empty
4. Spot-check 5 random rows by id: every schema column header present; values byte-equal to DB
5. Longest `enrichment_source_trace` / raw HTML row → reconstruct from parts, byte-equal to DB
6. UTF-8 / Devanagari row preserved
7. URL with query string preserved exactly
8. Long numeric ID rendered as text (no `1.23E+18`)
9. Synthetic spot-check: a value `=SUM(A1:A10)` in DB → cell in xlsx displays `=SUM(A1:A10)` as literal text, not evaluated as formula
10. `published_at`, `null`, `boolean`, `number` types preserved correctly

### Risk
Low. Read-only export, additive plpgsql RPC with admin gate inside, additive UI button, hard-fail on row-count mismatch. Fully reversible.
