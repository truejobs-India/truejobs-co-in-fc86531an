

# Reorganize Firecrawl Admin: 3 Source Sections + 3 Draft Sections

## Data Findings

- **Sources**: All 10 sources are `source_type = 'firecrawl_html'`. No `government` or `firecrawl_sitemap` sources exist yet. No null `source_type` values.
- **Drafts**: All 198 drafts have `source_type_tag = 'general'`, all linked to `firecrawl_html` sources. No government or sitemap drafts exist yet.
- **No null handling needed** for `source_type` on sources.
- **Backfill needed**: Change `source_type_tag` from `'general'` to match linked source's `source_type` (all will become `'firecrawl_html'`).

## Changes

### 1. Database Migration — Backfill `source_type_tag`

```sql
UPDATE firecrawl_draft_jobs d
SET source_type_tag = s.source_type
FROM firecrawl_sources s
WHERE d.firecrawl_source_id = s.id;
```

Uses linked source as truth for all rows regardless of current tag value.

### 2. Edge Function — 3 Draft Insert Paths to Patch

In `supabase/functions/firecrawl-ingest/index.ts`:

**Path 1 — Single extract** (~line 757 `rawDraftData`): The source is already fetched. Add:
```typescript
source_type_tag: source?.source_type ?? (() => { console.warn('[firecrawl-ingest] Missing source for draft, cannot determine source_type_tag'); return 'firecrawl_html'; })(),
```

**Path 2 — Batch extract** (~line 896 `rawBatchData`): Source is available as `item.firecrawl_sources`. Add:
```typescript
source_type_tag: source?.source_type ?? (() => { console.warn('[firecrawl-ingest] Missing source for batch draft'); return 'firecrawl_html'; })(),
```

**Path 3 — Govt scrape-extract** (~line 1436 `rawDraft`): Source is always a government source. Add:
```typescript
source_type_tag: 'government',
```

This patches all 3 upsert paths. No other insert paths exist in the codebase.

### 3. Source Section Reorder + Titles

**`FirecrawlSourcesManager.tsx`** line 89-92:
- `firecrawl_html` title → `"Firecrawl Private Sources"`
- `firecrawl_sitemap` title → `"Firecrawl Sitemap Sources"`

**`GovtSourcesManager.tsx`** line 432: Change `"Government Sources"` → `"Firecrawl Government Sources"`

**`FirecrawlDraftsManager.tsx`** render order:
```
FirecrawlSourcesManager(firecrawl_html)     → 1. Firecrawl Private Sources
GovtSourcesManager                          → 2. Firecrawl Government Sources
FirecrawlSourcesManager(firecrawl_sitemap)  → 3. Firecrawl Sitemap Sources
DraftJobsSection(firecrawl_html)            → 4. Private Draft Jobs
DraftJobsSection(government)                → 5. Government Draft Jobs
DraftJobsSection(firecrawl_sitemap)         → 6. Sitemap Draft Jobs
```

### 4. New Component: `DraftJobsSection.tsx`

Extract the entire draft Card logic (lines 291–1912, ~1600 lines) from `FirecrawlDraftsManager` into a standalone component.

**Props**: `sourceTypeTag: 'firecrawl_html' | 'government' | 'firecrawl_sitemap'`

**Each instance owns fully independent state**: `drafts`, `activeFilter`, `loading`, `busyRows`, all bulk states, all cancel refs, all report states, all dialog states (preview, publish, image preview), model selectors.

**Query filtering**: Every query appends `.eq('source_type_tag', sourceTypeTag)` — main fetch, bulk run candidates, field fix candidates, image candidates.

**Title mapping**:
- `firecrawl_html` → "Private Draft Jobs"
- `government` → "Government Draft Jobs"
- `firecrawl_sitemap` → "Sitemap Draft Jobs"

**Filter tabs**:
- `government`: All, Ready, Review, Incomplete, Retry, Auto-Eligible, Failed, Published, No Dates, No Links, Low Conf
- `firecrawl_html` / `firecrawl_sitemap`: All, Draft, Enriched, Reviewed, Approved, Published, Duplicates, Rejected

**Auto-publish rule**: Only `government` section shows Auto Publish, Retry Failed, Validate All. Private and Sitemap do NOT get these buttons.

**Shared features across all 3**: Table columns, row actions (TP Clean, Preview, Publish, Image, Run All, dropdown AI actions, status changes), AI step badges, status badges, model selectors, Bulk Run All, Bulk Images, Bulk Fix Fields, Dedup, Purge, TP Cleaner, progress bars, persistent reports, preview/publish dialogs.

### 5. Simplified `FirecrawlDraftsManager.tsx`

Becomes ~20-line thin container rendering 3 source + 3 draft sections.

## Files Changed

| File | Action |
|------|--------|
| DB migration | Backfill `source_type_tag` from linked source |
| `supabase/functions/firecrawl-ingest/index.ts` | Add `source_type_tag` to 3 draft upsert paths |
| `src/components/admin/firecrawl/DraftJobsSection.tsx` | **Create** (~1600 lines extracted) |
| `src/components/admin/firecrawl/FirecrawlDraftsManager.tsx` | **Replace** (~20 lines) |
| `src/components/admin/firecrawl/FirecrawlSourcesManager.tsx` | Update 2 titles |
| `src/components/admin/firecrawl/GovtSourcesManager.tsx` | Update 1 title |

## Confirmations

- **3 draft insert/upsert paths patched** (single extract, batch extract, govt scrape-extract)
- **Missing-source fallback**: Paths 1 and 2 use `source?.source_type` with a logged warning fallback to `'firecrawl_html'` only because those paths are always invoked from firecrawl_html pipelines. Path 3 hardcodes `'government'` since the govt pipeline only runs for government sources.
- **Auto-publish exists only in Government Draft Jobs**
- **All 3 draft sections are fully independent** — no shared state
- **Source-type verification done**: All 10 sources are `firecrawl_html`, no nulls, no unexpected values
- **Legacy backfill**: All 198 `'general'` → `'firecrawl_html'` via join to linked source

## Regression Checklist

1. Source sections render: Private → Government → Sitemap
2. No source in multiple sections
3. Private/Sitemap draft sections do NOT have Auto Publish/Retry/Validate
4. Government draft section retains Auto Publish, Retry Failed, Validate All
5. All 3 draft sections have: table, row actions, preview, publish, AI steps, badges, TP Cleaner, bulk actions
6. Each draft section has fully independent state
7. Bulk candidate fetches scoped to `source_type_tag`
8. Legacy drafts backfilled using linked source type
9. New drafts get correct `source_type_tag` at creation (3 paths patched)
10. Preview/publish dialogs work independently per section
11. Model selectors independent per section
12. Progress bars and reports independent per section

