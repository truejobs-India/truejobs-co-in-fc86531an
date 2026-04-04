

# Plan: Permanently Delete the `firecrawl_html` Private Pipeline

## Data to be deleted

| Table | Rows | Filter |
|---|---|---|
| `firecrawl_draft_jobs` | 198 | `source_type_tag = 'firecrawl_html'` |
| `firecrawl_staged_items` | 1,191 | joined via `firecrawl_source_id` to html sources |
| `firecrawl_fetch_runs` | 81 | joined via `firecrawl_source_id` to html sources |
| `firecrawl_sources` | 10 | `source_type = 'firecrawl_html'` |

Government data (200 sources, 466 drafts) is untouched.

## Steps

### Step 0 — Export backup
Run a script to export all 4 tables' `firecrawl_html` rows to CSV files in `/mnt/documents/` before any deletion.

### Step 1 — Delete data (4 DELETE statements via insert tool)
Delete in FK order:
1. `DELETE FROM firecrawl_draft_jobs WHERE source_type_tag = 'firecrawl_html'`
2. `DELETE FROM firecrawl_staged_items WHERE firecrawl_source_id IN (SELECT id FROM firecrawl_sources WHERE source_type = 'firecrawl_html')`
3. `DELETE FROM firecrawl_fetch_runs WHERE firecrawl_source_id IN (SELECT id FROM firecrawl_sources WHERE source_type = 'firecrawl_html')`
4. `DELETE FROM firecrawl_sources WHERE source_type = 'firecrawl_html'`

### Step 2 — Database migration: block `firecrawl_html` in validation trigger
Update `validate_firecrawl_sources_fields()` to only allow `('firecrawl_sitemap', 'government')`, removing `'firecrawl_html'`.

### Step 3 — Frontend: `FirecrawlDraftsManager.tsx`
Remove 2 lines:
- `<FirecrawlSourcesManager sourceTypeFilter="firecrawl_html" />`
- `<DraftJobsSection sourceTypeTag="firecrawl_html" />`

### Step 4 — Frontend: `FirecrawlSourcesManager.tsx`
Remove the `firecrawl_html` entry from `SOURCE_TYPE_CONFIG` (line 90). Component stays for sitemap use.

### Step 5 — Frontend: `DraftJobsSection.tsx`
Remove `firecrawl_html` from `TITLE_MAP` (line 216) and from the `sourceTypeTag` union type (line 225).

### Step 6 — Edge function: `firecrawl-ingest/index.ts`
Change 3 fallback defaults from `'firecrawl_html'` to `'government'` (lines 882, 892, 957, 1027, 1037). These are just warning-path defaults when source_type is missing.

### Step 7 — Verify government pipeline still works
Query government source/draft counts to confirm no data was lost. Visually confirm the admin UI renders government + sitemap sections correctly.

## Files changed

| # | File | Change |
|---|---|---|
| 1 | CSV exports | Backup 4 tables to `/mnt/documents/` |
| 2 | Data (insert tool) | 4 DELETE statements |
| 3 | Migration SQL | Update `validate_firecrawl_sources_fields()` |
| 4 | `src/components/admin/firecrawl/FirecrawlDraftsManager.tsx` | Remove 2 lines |
| 5 | `src/components/admin/firecrawl/FirecrawlSourcesManager.tsx` | Remove 1 config entry |
| 6 | `src/components/admin/firecrawl/DraftJobsSection.tsx` | Remove from title map + type union |
| 7 | `supabase/functions/firecrawl-ingest/index.ts` | Change 3 fallback defaults |

## What is NOT touched
- `GovtSourcesManager.tsx` — completely separate component
- All government rows in all 4 firecrawl tables
- `firecrawl-cleanup-branding` edge function — works on any drafts, no `firecrawl_html` specifics
- `firecrawl-ai-enrich` edge function — source-type agnostic
- All intake pipeline code, RSS pipeline, Azure pipeline

