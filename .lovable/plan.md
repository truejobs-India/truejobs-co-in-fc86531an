
## Approved plan — proceed in this order

### Step 1: Prove the exact cause of 108 (read-only, no code changes)

Run two diagnostics:

1. SQL: `SELECT section_bucket, COUNT(*) FROM intake_drafts WHERE source_channel='chatgpt_agent' GROUP BY 1 ORDER BY 2 DESC` — confirms total per bucket (production_v1 + legacy combined).
2. Read `ChatGptAgentManager.tsx` — confirm default `activeSection` value, the fetch query's WHERE clauses, and any default secondary filter state.

Expected proof: default tab = `job_postings`; 108 = all chatgpt_agent rows in `job_postings` (43 new production_v1 + 65 pre-existing legacy). Will report exact numbers before touching code.

### Step 2: Implement 4 additive UI changes

Single file: `src/components/admin/chatgpt-agent/ChatGptAgentManager.tsx`. No DB, no parser, no schema.

**2a. Per-upload toast (this-run scope only)**
After import, group just-imported rows by `section_bucket` in memory:
```
Imported this run: 144 · 0 skipped · 0 failed
Jobs 43 · Admit Cards 27 · Results 26 · Other 23 · Answer Keys 20 · Exam Dates 5
```
Numbers come only from current upload payload — never mixed with totals.

**2b. Section tab badges (all-drafts scope)**
One lightweight query on mount + after each import:
`select section_bucket, count(*) from intake_drafts where source_channel='chatgpt_agent' group by 1`

Render count as `<Badge variant="secondary">` next to each tab label. Reflects ALL chatgpt_agent drafts in DB, not just latest upload.

**2c. "All Sections" tab**
Add `'__all__'` as the first tab. When active:
- fetch query drops the `section_bucket` filter
- table gains a "Section" column
- search + 5 filter dropdowns remain applied identically

**Scope clarity line (above table, All Sections only):**
```
Viewing all ChatGPT Agent drafts: 298 total
108 visible after filters
```
Always visible in All Sections view; the second line only appears when filters/search reduce the visible count below total.

**2d. Honest "Select all visible (N)" label**
Rename current "Select All" to `Select all visible (N)` where `N = filteredDrafts.length` (after section + status + search + filter dropdowns). Same behavior, truthful label. Works identically on per-section tabs and All Sections tab.

### Step 3: Post-implementation verification report

Will report:
- exact cause of 108 with SQL + code evidence
- exact counts: latest upload (per-bucket) vs all drafts (per-bucket)
- confirmation toast shows per-run counts only (never mixed with totals)
- confirmation badges show all-drafts counts with clear labeling
- confirmation `Select all visible (N)` matches the actual visible row count under all filter/search/tab combinations
- confirmation All Sections scope line renders correctly with and without active filters

### Files changed
- `src/components/admin/chatgpt-agent/ChatGptAgentManager.tsx` (only)

### Risk
Very low. Additive UI only. No DB writes, no parser changes, no schema. One file.
