

# Reorganize Firecrawl Admin: Source Sections + Draft Separation

## Current State

- **Source types** in `firecrawl_sources`: `firecrawl_html`, `firecrawl_sitemap`, `government`
- `FirecrawlSourcesManager` shows all sources where `source_type != 'government'` (mixes HTML and sitemap)
- `GovtSourcesManager` shows `source_type = 'government'`
- Drafts table mixes all draft types with govt filters as secondary tabs
- Render order: `FirecrawlSourcesManager` → `GovtSourcesManager` → single drafts Card

## Plan

### 1. Split `FirecrawlSourcesManager` into two filtered sections

Instead of one component showing all non-govt sources, add a `sourceTypeFilter` prop:

- `<FirecrawlSourcesManager sourceTypeFilter="firecrawl_html" />` — labeled **"Private Sources"**
- `<FirecrawlSourcesManager sourceTypeFilter="firecrawl_sitemap" />` — labeled **"Sitemap Sources"**

**Query change**: Replace `.neq('source_type', 'government')` with `.eq('source_type', sourceTypeFilter)`.

**Title change**: Derive card title from the prop — `"Private Sources (HTML)"` for `firecrawl_html`, `"Sitemap Sources"` for `firecrawl_sitemap`.

**Empty state**: Each section shows "No sources of this type" when empty, with its own count badge.

All existing row actions, batch operations, stats, toggle, priority, seed URL editing remain identical — just filtered to their source type.

### 2. Render order in `FirecrawlDraftsManager` return block

```
<FirecrawlSourcesManager sourceTypeFilter="firecrawl_html" />    ← Private Sources
<FirecrawlSourcesManager sourceTypeFilter="firecrawl_sitemap" /> ← Sitemap Sources
<GovtSourcesManager />                                           ← Government Sources
<Card> ... Private/Sitemap Drafts table ... </Card>              ← General Drafts
<Card> ... Government Drafts table ... </Card>                   ← Govt Drafts
```

### 3. Split drafts into two Card sections

**General Drafts Card** — Shows drafts where `source_type_tag != 'government'` (or is null/general). Uses the existing non-govt filter tabs: All, Draft, Enriched, Reviewed, Approved, Published, Duplicates, Rejected.

**Government Drafts Card** — Shows drafts where `source_type_tag = 'government'`. Uses the existing govt filter tabs: All, Ready, Review, Incomplete, Retry, Auto-Eligible, Failed, Published, No Dates, No Links, Low Conf.

Both cards share the same table columns, row actions, AI step badges, bulk actions, and publish logic. The split is purely at the query filter and UI card level.

**Implementation approach**: Rather than duplicating the entire 1900-line component, add a `draftMode` state (`'general' | 'govt'`) that controls:
- Which filter tabs are shown
- The base query filter (append `.neq('source_type_tag', 'government')` for general, `.eq('source_type_tag', 'government')` for govt)
- The card title

Render two separate `<Card>` blocks, each with its own active filter state. This requires splitting the single `activeFilter`/`drafts` state into two independent filter+data sets, or more practically: rendering the drafts section as two collapsible cards where only one is expanded at a time, each with independent filter tabs.

**Simplest safe approach**: Create a thin wrapper that renders the drafts Card twice with a `section` prop. The `FirecrawlDraftsManager` component already has all the logic — we add a `draftSection` discriminator that:
- Filters `filterTabs` to show only the relevant group
- Appends the source_type_tag filter to the query
- Changes the card title

### 4. Files Changed

| File | Change |
|------|--------|
| `src/components/admin/firecrawl/FirecrawlSourcesManager.tsx` | Add `sourceTypeFilter` prop, filter query by it, derive title/icon from prop, add empty state |
| `src/components/admin/firecrawl/FirecrawlDraftsManager.tsx` | Render two source manager instances + split drafts into two Card sections with independent filters |

### 5. No Schema Changes

The existing `source_type` and `source_type_tag` columns already support this separation. No migrations needed.

### 6. Separation Logic Summary

**Sources:**
- Private Sources: `source_type = 'firecrawl_html'`
- Sitemap Sources: `source_type = 'firecrawl_sitemap'`
- Government Sources: `source_type = 'government'` (existing `GovtSourcesManager`)

**Drafts:**
- General Drafts: `source_type_tag != 'government'` (includes null and 'general')
- Government Drafts: `source_type_tag = 'government'`

### 7. Regression Checklist

1. Private Sources section shows only `firecrawl_html` sources with all actions working
2. Sitemap Sources section shows only `firecrawl_sitemap` sources with all actions working
3. Government Sources section unchanged
4. No source appears in multiple sections
5. General Drafts card shows non-govt drafts with standard filter tabs
6. Government Drafts card shows govt drafts with govt filter tabs
7. All bulk actions (Run All, Bulk Run All, AI steps) work within their section
8. TP Cleaner, dedup, publish gate all still function
9. Auto-publish batch and retry logic still targets correct drafts
10. Existing batch reports render correctly in their respective sections

