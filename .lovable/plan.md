
## Plan: Lock draft row order so enrichment doesn't reshuffle

### Root cause (confirmed via earlier analysis)
`fetchDrafts` in `ChatGptAgentManager.tsx` orders rows by `updated_at DESC`. Enrichment writes to the row → `updated_at` bumps → row jumps position on the next refetch. User saw "UKMSSB ANM Health Worker Online Form" move from row 1 → row 13 after enrichment.

### Fix (single file, minimal change)
**File:** `src/components/admin/chatgpt-agent/ChatGptAgentManager.tsx`
**Change:** In the `fetchDrafts` query, replace the existing `.order('updated_at', { ascending: false })` with:
```
.order('created_at', { ascending: false })
.order('id', { ascending: false })
```

- `created_at` is set once at INSERT and never mutated by enrichment, AI processing, edits, or status changes → row position is frozen at import time.
- `id` tiebreaker prevents flicker for rows sharing the same `created_at` (bulk imports).

### Strict scope guard
Touch ONLY the `.order(...)` line(s) in `fetchDrafts`. Do not modify:
- filter logic, fetch WHERE clauses, badges, tabs, toast, "Select all visible", scope banner, Section column
- enrichment edge function, schema, RLS, any other component
- any sort logic in other admin views

### Deep verification report (after change)

I will:
1. **Code audit** — read the modified `fetchDrafts` and confirm the only diff is the `.order()` line; diff against original to prove zero collateral edits elsewhere in the file.
2. **DB sanity** — SQL query the top 15 `chatgpt_agent` job_postings rows by `created_at DESC, id DESC` and list them. This is the order the UI must now show.
3. **Live preview check** — open the admin Drafts view, capture the top 15 rows in `job_postings`, confirm they match the SQL list exactly.
4. **Enrichment stability test** — pick the row currently at position #1 (e.g. "UKMSSB ANM Health Worker Online Form" if still top), trigger enrichment, refetch, confirm it remains at position #1. Capture before/after.
5. **Cross-tab spot check** — repeat row-order check on `admit_cards` and `All Sections` tabs to confirm consistent ordering everywhere `fetchDrafts` is used.
6. **Untouched-area regression** — confirm badges (108/55/46/35/24/8/1/1/278), filter dropdowns, "Select all visible (N)", scope banner, and import toast all still function identically (no value or label changed).

### Report format
A single summary will list:
- exact line(s) changed (before → after)
- SQL-derived expected top-15 vs UI-observed top-15 (match/mismatch per row)
- enrichment stability result (row stayed at #1: yes/no)
- regression check results for each untouched feature

### Risk
Minimal. One ordering change. No DB writes, no schema, no edge functions, no other UI.
