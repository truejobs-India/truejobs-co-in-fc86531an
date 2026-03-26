

# Phase 1: Government Sources Foundation — Implementation Plan

## Current Architecture Summary

- `firecrawl_sources` table holds source configs (seed_url, source_type, crawl_mode, etc.)
- `FirecrawlSourcesManager.tsx` (816 lines) renders source cards with discovery/scrape/extract actions
- `FirecrawlDraftsManager.tsx` (1651 lines) renders draft jobs table and embeds `FirecrawlSourcesManager` at the top
- Both live under the "Firecrawl" tab in `AdminDashboard.tsx`
- `firecrawl_sources.source_type` currently only supports `firecrawl_html` and `firecrawl_sitemap` (enforced by trigger)
- Sources flow: discover URLs → scrape pending → extract to draft jobs

## Approach

Extend the existing `firecrawl_sources` table with a new `source_type = 'government'` value and a `govt_meta` JSONB column for flexible government-specific metadata. Add a new `GovtSourcesManager.tsx` component rendered as a collapsible section inside `FirecrawlDraftsManager`, parallel to `FirecrawlSourcesManager`. Reuse all existing discovery/scrape/extract edge function flows.

## Database Changes

**Migration 1: Extend firecrawl_sources for government sources**

1. Update the `validate_firecrawl_sources_fields` trigger function to accept `source_type = 'government'` alongside existing values
2. Add `govt_meta JSONB DEFAULT '{}'` column to `firecrawl_sources` — stores ministry, department, state, category, crawl_depth, domain_label flexibly
3. No new tables needed — government sources are just firecrawl sources with `source_type = 'government'`

## Frontend Changes

### New File: `src/components/admin/firecrawl/GovtSourcesManager.tsx`

A focused component for government source management with:

1. **Source listing table** — filters `firecrawl_sources` where `source_type = 'government'`, shows:
   - Domain label (auto-inferred from URL)
   - URL, state, ministry/dept (from `govt_meta`)
   - Status (enabled/disabled), last run, items found, last error
   - Row actions: Run Discovery, Pause, Disable

2. **Bulk Import dialog** with:
   - Textarea for one URL per line (primary input)
   - URL normalization (trim, lowercase host, remove trailing slash, add https://)
   - Deduplication against existing sources (by normalized seed_url)
   - Government domain validation — warn on non-.gov.in / non-.nic.in domains, allow override
   - Auto-infer `source_name` from domain (e.g., `upsc.gov.in` → "UPSC")
   - Optional per-row metadata: state, ministry, category
   - Preview table before save showing valid/duplicate/suspicious URLs
   - Save all valid URLs as `firecrawl_sources` with `source_type = 'government'`

3. **Validate Sources** button — checks all government sources for DNS resolution / HTTP reachability (via a lightweight edge function ping)

4. **Bulk actions toolbar** — Run Discovery All, Scrape & Extract All (reuses existing `firecrawl-ingest` edge function)

### Modified File: `src/components/admin/firecrawl/FirecrawlDraftsManager.tsx`

- Add `GovtSourcesManager` as a collapsible section below `FirecrawlSourcesManager`, or as a sub-tab within the Firecrawl area
- Keep draft jobs table unchanged — government-sourced drafts flow into the same `firecrawl_draft_jobs` table

### Modified File: `src/components/admin/firecrawl/FirecrawlSourcesManager.tsx`

- Filter out `source_type = 'government'` from the existing sources list so they don't appear in both places

## Edge Function Changes

### Modified: `firecrawl-ingest/index.ts`

- No changes needed if the existing discover/scrape/extract actions work generically with any `firecrawl_sources` row
- Government sources will use `crawl_mode = 'map'` by default for aggressive URL discovery, with `max_pages_per_run = 50` for deeper coverage

## Government Domain Validation (Client-Side)

```text
Known government TLDs/patterns:
  .gov.in, .nic.in, .ac.in (universities)
  Direct matches: upsc, ssc, ibps, rbi, etc.
  
Validation levels:
  ✅ Confirmed govt (.gov.in, .nic.in)
  ⚠️ Likely govt (.ac.in, known org domains)
  ❌ Non-govt (allow with explicit override checkbox)
```

## Default Source Configuration for Government URLs

When bulk importing, each source gets these defaults:
- `source_type = 'government'`
- `crawl_mode = 'map'` (aggressive discovery)
- `extraction_mode = 'markdown'`
- `max_pages_per_run = 50`
- `is_enabled = false` (safe default, admin enables manually)
- `default_bucket = 'staging'`
- `priority = 'Medium'`
- `allowed_domains` = auto-set to the source domain

## UI Layout

```text
Firecrawl Tab
├── Firecrawl Sources (existing, excludes govt)
├── Government Sources (new section)
│   ├── [Add Source] [Bulk Import] [Validate All] [Run Discovery All]
│   ├── Source table with filters
│   └── Per-row: Enable/Disable, Run Discovery, Scrape, Extract
└── Firecrawl Draft Jobs (existing table, shows all drafts including govt-sourced)
```

## File Change Summary

| File | Action |
|------|--------|
| `src/components/admin/firecrawl/GovtSourcesManager.tsx` | **Create** — ~500 lines |
| `src/components/admin/firecrawl/FirecrawlDraftsManager.tsx` | **Edit** — import and render GovtSourcesManager |
| `src/components/admin/firecrawl/FirecrawlSourcesManager.tsx` | **Edit** — filter out government sources |
| DB migration | **Create** — add `government` to source_type validation, add `govt_meta` JSONB column |

## Regression Checklist

1. Existing Firecrawl sources still load and work (not filtered out incorrectly)
2. Discovery / Scrape / Extract still work for existing sources
3. Draft jobs table still shows all drafts regardless of source type
4. Government sources appear only in the new section
5. Bulk import handles edge cases: empty lines, duplicates, malformed URLs
6. No breakage to existing trigger validation

