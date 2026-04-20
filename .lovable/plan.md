

## Goal
Add a new **"Firecrawl - P" (Peak)** admin tab that mirrors every option of the existing Firecrawl section but runs at **5× aggression**, is **fully isolated** from the regular Firecrawl pool, and exposes **download buttons** so all scraped/crawled data can be exported.

## Architecture — fully isolated, zero rebuild
Reuse the existing `firecrawl_sources`, `firecrawl_staged_items`, `firecrawl_draft_jobs`, and `firecrawl_fetch_runs` tables. Isolation via two new `source_type` tag values:

- `firecrawl_sitemap_peak` (mirrors `firecrawl_sitemap`)
- `government_peak` (mirrors `government`)

All Peak rows carry these tags end-to-end, so the existing tab cannot see them and vice-versa.

## Changes

### 1. DB migration
- Update `validate_firecrawl_sources_fields` trigger to accept `firecrawl_sitemap_peak` and `government_peak`.
- No schema changes, no new tables, no RLS changes.

### 2. Edge function `firecrawl-ingest` — peak-aware (gated)
Add `isPeak(sourceType)` helper. All non-peak behaviour stays byte-identical.

**Peak limits (5× current):**
- `HARD_SCRAPE_CAP_PEAK = 125` (was 25)
- `maxDetailScrapes`: 75 govt / 40 sitemap
- `discoverMaxUrls`: 2500 govt / 2000 sitemap
- Map limit: `maxPages * 20`, capped at 10 000 (was *10, cap 2000)
- Default `max_pages_per_run` for new peak sources: 250

**Peak concurrency & throttling:**
- 5-wide `Promise.allSettled` worker pool in `scrape-pending`, `extract-batch`, `govt-scrape-extract` (serial path retained for non-peak).
- `DOMAIN_MIN_INTERVAL_MS`: 750 ms (was 2000)
- `DOMAIN_COOLDOWN_THRESHOLD`: 5 failures (was 3)
- Cooldown duration: 20 s (was 30 s)

**Safety guardrails kept:**
- Per-invocation hard cap (125) is non-negotiable
- Per-domain failure cooldown still engages
- Existing dedup + branding sanitizer + validation triggers run on every Peak row
- All runs logged to `firecrawl_fetch_runs` as `manual_admin`
- Firecrawl client retries + 4xx non-retryable behaviour unchanged

### 3. UI — three new files in `src/components/admin/firecrawl-peak/`
- `FirecrawlPeakManager.tsx` — container (clone of `FirecrawlDraftsManager`) with red "PEAK" badge + warning banner: *"Aggressive mode — 5× scrape volume, parallel workers, reduced throttle. Quotas burn faster."*
- `FirecrawlPeakSourcesManager.tsx` — clone of `FirecrawlSourcesManager`, hard-codes `sourceTypeFilter='firecrawl_sitemap_peak'` and inserts new sources with `max_pages_per_run = 250`.
- `GovtPeakSourcesManager.tsx` — clone of `GovtSourcesManager`, hard-codes `source_type='government_peak'`.

`DraftJobsSection` is **reused as-is** — it already takes a `sourceTypeTag` prop. Peak passes `'firecrawl_sitemap_peak'` and `'government_peak'`.

### 4. Download / export buttons (Peak section)
Each section in the Peak tab gets an **"Export .xlsx"** button next to existing controls, using `xlsx` (already a dep, see `GSCUrlExport.tsx`):

- **Sources export** — all rows from `firecrawl_sources` filtered by peak source_type. Columns: name, url, source_type, priority, crawl_mode, extraction_mode, max_pages_per_run, enabled, created_at, last_run_at.
- **Staged items export** — all rows from `firecrawl_staged_items` whose source has peak source_type. Columns: source_url, title, bucket, status, extraction_status, content_hash, raw_markdown (truncated to 32 KB per cell to stay within Excel limits), created_at.
- **Draft jobs export** — all rows from `firecrawl_draft_jobs` tagged peak. Columns: title, organization, location, qualification, last_date, source_url, status, extraction_confidence, created_at, plus a JSON-stringified `details` column.
- **Fetch runs export** — all rows from `firecrawl_fetch_runs` tied to peak sources. Columns: started_at, finished_at, status, run_mode, action, items_processed, errors_json.
- **Raw bundle (.zip)** — single button at the top of the Peak tab that calls a new edge function `firecrawl-peak-export-bundle` returning a JSZip-built archive with one CSV per table above + one `.md` file per staged item containing the full raw markdown (no truncation). Downloaded via blob link. Admin-gated, paginated reads using `.range()` per project pagination policy.

All four per-table exports run client-side from already-loaded data + a paginated fetch (`.range(from, to)` loop) so they handle >1000 rows safely.

### 5. AdminDashboard wiring
- Add `<TabsTrigger value="firecrawl-peak">` with `Zap` icon, label "Firecrawl - P", placed right after the existing `firecrawl` trigger.
- Add `<TabsContent value="firecrawl-peak">` rendering `<FirecrawlPeakManager />`.

## Safety summary
- **Isolation**: separate `source_type` tag → existing Firecrawl tab is unchanged
- **Hard caps remain**: 125-page invocation cap, 5-wide concurrency cap, 5-failure cooldown
- **Dedup, sanitizer, validation triggers** still run on every Peak row
- **No automatic image/model fallbacks** added (per project policy)
- **Pagination policy** honoured for all bulk reads in exports

## Verification (after implementation)
1. Deploy migration + `firecrawl-ingest` + new export edge function.
2. Create one peak govt source and one peak sitemap source via UI → confirm `_peak` source_type in DB and that they don't appear in the regular Firecrawl tab.
3. Trigger `discover-govt` → edge logs show `peak limits` line and the 5-wide worker pool.
4. Run `extract-batch` → confirm ≤125 scrapes per invocation, dedup runs, drafts land only in Peak tab.
5. Click each of the 4 per-table "Export .xlsx" buttons → verify file opens in Excel with correct columns and full row counts.
6. Click "Raw bundle (.zip)" → verify zip contains 4 CSVs + per-item markdown files.
7. Force a 5xx on a domain → cooldown engages at 5 failures.
8. Confirm regular Firecrawl tab is byte-identical (no regression).

## Out of scope
- No new tables, no schema changes beyond the trigger update
- No changes to `_shared/firecrawl/*` helpers
- No changes to RSS or Employment News pipelines
- No new edge functions besides `firecrawl-peak-export-bundle`

