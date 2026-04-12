

# Plan: Selective Firecrawl Enrichment Layer for RSS System

## Summary
Add Firecrawl as an optional second-stage enrichment on top of the working RSS pipeline. RSS ingestion remains untouched. Firecrawl runs only for qualifying items (High/Medium relevance, weak summary, PDF links, or manual trigger). A new edge function handles the scraping, and minimal DB columns are added to `rss_items`. Small UI additions let admins trigger, retry, and inspect enrichment.

---

## A. Database Changes

**Add 8 columns to `rss_items`** (no new table — keeps queries simple):

```sql
ALTER TABLE public.rss_items
  ADD COLUMN firecrawl_status text NOT NULL DEFAULT 'not_needed',
  ADD COLUMN firecrawl_reason text,
  ADD COLUMN firecrawl_last_run_at timestamptz,
  ADD COLUMN firecrawl_source_url text,
  ADD COLUMN firecrawl_content_markdown text,
  ADD COLUMN firecrawl_content_meta jsonb,
  ADD COLUMN firecrawl_pdf_mode text,
  ADD COLUMN firecrawl_error text;
```

Update the existing validation trigger `validate_rss_items_fields` to also validate `firecrawl_status`:

```sql
-- Add to trigger body:
IF NEW.firecrawl_status NOT IN ('not_needed','queued','running','success','failed','skipped','partial') THEN
  RAISE EXCEPTION 'Invalid rss_items.firecrawl_status: %', NEW.firecrawl_status;
END IF;
```

No new tables. No new indexes beyond what Postgres already has.

---

## B. New Edge Function: `rss-firecrawl-enrich`

Single new file: `supabase/functions/rss-firecrawl-enrich/index.ts`

**Actions:**
- `enrich-items`: Accept an array of `rss_item_id`s (max 10 per call). For each:
  1. Load the item from DB
  2. Run `shouldEnrich()` decision logic (skip if `firecrawl_status === 'success'` and not forced)
  3. Determine URL to scrape: `first_pdf_url` > `item_link`
  4. Call existing `scrapePage()` from `_shared/firecrawl/client.ts`
  5. Save markdown + metadata to the new columns
  6. Update `firecrawl_status` to `success` or `failed`

**Decision helper — `shouldEnrich(item, manual)`:**
```
if manual → return { should: true, reason: 'manual' }
if relevance_level in ('High','Medium') → { true, 'high_relevance' }
if item_summary is null/empty or length < 80 → { true, 'weak_summary' }
if first_pdf_url is not null → { true, 'direct_pdf' }
if linked_pdf_urls length > 0 → { true, 'linked_pdf' }
else → { false, 'low_value' }
```

**PDF handling policy:**
- For `.pdf` URLs: call Firecrawl scrape with `formats: ['markdown']` (Firecrawl handles PDF natively)
- Store `firecrawl_pdf_mode = 'pdf_scrape'`
- No OCR by default — Firecrawl's built-in PDF parser handles text-based PDFs
- If scrape returns empty/very short markdown (<50 chars), mark `firecrawl_status = 'partial'` with note

**Safety caps (hardcoded constants):**
- `MAX_ITEMS_PER_CALL = 10`
- `MAX_AUTO_PER_SOURCE_RUN = 5` — during automatic enrichment after ingestion
- Skip if `firecrawl_status === 'success'` and `firecrawl_last_run_at` is within last 24 hours (unless manual)

**Auth:** Same pattern as `rss-ingest` — JWT admin check or `x-cron-secret` header.

**Reuses:** `_shared/firecrawl/client.ts` (already has retries, timeouts, error handling).

---

## C. Automatic Enrichment Hook in `rss-ingest`

After a successful `processSource` run (line ~498 in `rss-ingest/index.ts`), add a lightweight post-processing step:

1. Collect IDs of newly inserted items (`itemsNew > 0`) that pass `shouldEnrich()`
2. Cap at `MAX_AUTO_PER_SOURCE_RUN = 5`
3. Fire-and-forget call to `rss-firecrawl-enrich` via `fetch()` to the function URL (non-blocking)
4. If the call fails, log a warning — do NOT fail the RSS run

This keeps RSS ingestion fast and decoupled. The enrichment runs asynchronously.

To support this, `processSource` will collect new item IDs as it processes, then after `finalizeRun`, conditionally dispatch the enrichment call.

---

## D. UI Changes

### In `RssFetchedItemsTab.tsx`:

**1. Add Firecrawl status column to table** — a small icon/badge after the existing AI column:
- `not_needed` → gray dash
- `queued` → clock icon
- `running` → spinner
- `success` → green check
- `failed` → red X
- `partial` → orange warning
- `skipped` → gray skip

**2. Add "Enrich with Firecrawl" to the per-item dropdown menu** (alongside existing Analyse/Enrich/Image/SEO):
```tsx
<DropdownMenuItem onClick={() => handleFirecrawlEnrich([item.id])}>
  <Globe className="h-4 w-4 mr-2" /> Firecrawl Enrich
</DropdownMenuItem>
```

**3. Add "Firecrawl Enrich" to bulk action toolbar** (when items selected).

**4. In expanded item detail**, show:
- Firecrawl status + reason
- Error message if failed
- PDF mode if applicable
- Markdown preview (first 500 chars) if success
- Last run timestamp
- "Retry" button if failed

### In `rssTypes.ts`:

Update `RssItem` interface with the 8 new fields.
Add `FIRECRAWL_STATUSES` constant.

---

## E. Files Changed

| # | File | Change |
|---|------|--------|
| 1 | `supabase/migrations/new.sql` | Add 8 columns to `rss_items`, update validation trigger |
| 2 | `supabase/functions/rss-firecrawl-enrich/index.ts` | **New** — enrichment edge function |
| 3 | `supabase/functions/rss-ingest/index.ts` | Add fire-and-forget enrichment dispatch after successful runs |
| 4 | `src/components/admin/rss-intake/rssTypes.ts` | Add firecrawl fields to `RssItem`, add constants |
| 5 | `src/components/admin/rss-intake/RssFetchedItemsTab.tsx` | Add FC status column, enrich button, retry, detail view |

---

## F. What Is Intentionally Left Out

- No full-site crawling or map discovery
- No automatic OCR — Firecrawl's native PDF parse only
- No new cron job for enrichment — relies on post-ingestion dispatch + manual triggers
- No separate enrichment queue table
- No enrichment_version column (status + timestamp is sufficient for v1)
- No changes to `monitoring_review_queue` routing
- No changes to existing AI processing pipeline
- No publishing pipeline from enriched items
- No `firecrawl_content_json` column (markdown + meta JSONB covers structured output)
- No `firecrawl_job_id` (Firecrawl scrape is synchronous, no async job to track)

