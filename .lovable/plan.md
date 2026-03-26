

# Harden & Tune Firecrawl Pipelines for Aggressive-but-Safe Operation

## Summary

Patch 4 backend files and 2 frontend files to maximize discovery/extraction coverage while adding domain-aware throttling, smart retry, multi-pass extraction recovery, and operational visibility — all within the existing architecture.

---

## A. Aggressive Discovery Tuning

### 1. Increase discovery limits (source-type-aware)

**File: `supabase/functions/firecrawl-ingest/index.ts`**

| Parameter | Current | New (Private) | New (Govt) | New (Sitemap) |
|-----------|---------|---------------|------------|---------------|
| `MAX_DETAIL_SCRAPES_PER_RUN` | 5 | 10 | 15 | 8 |
| `filterConfig.maxUrls` (discover-source) | 200 | 300 | — | 400 |
| `mapUrl limit` (discover-govt) | `maxPages*5, cap 500` | — | `maxPages*10, cap 2000` | — |
| `extract-batch maxItems cap` | 20 | 30 | — | 30 |
| `scrape-pending maxItems cap` | 50 | 50 | 50 | 50 |
| Inter-source delay (govt-run-all) | 2s | — | 3s | — |
| Inter-item delay (govt-scrape-extract) | 1s | — | 2s | — |

### 2. Accept more page types aggressively

**File: `supabase/functions/_shared/firecrawl/url-filter.ts`**

- Move `.pdf` from `REJECT_URL_SIGNALS` to `ACCEPT_URL_SIGNALS` (PDFs are often recruitment notices)
- Add new accept signals: `'career', 'careers', 'engagement', 'opportunity', 'circular', 'notice', 'tender', 'deputation', 'contractual', 'apprentice', 'detailed-notification', 'detailed_notification'`
- Add new reject signals: `'/archive/', '/archives/', '/wp-json/', '/feed/', '/rss/', '/amp/', '/print/', '.xml', '/page/\\d+'`
- For neutral URLs (no accept or reject signals), keep accepting them — they may be listing pages

### 3. Stronger page scoring for government

**File: `supabase/functions/_shared/firecrawl/page-classifier.ts`**

- Add strong signals (+3): `'career', 'careers', 'circular', 'notice', 'engagement', 'deputation'`
- Add moderate signals (+2): `'opportunity', 'tender', 'contractual', 'apprentice', 'detailed'`
- Add weak signals (+1): `'pdf', 'document', 'order', 'office-memorandum'`
- PDF bonus: increase from +2 to +3
- Deep path bonus: +1 for URLs with ≥3 path segments (e.g., `/dept/recruitment/2026/`)
- Add negative signals: `'/archive', '/old/', '/2020/', '/2021/', '/2022/'` (stale content penalty -1 each)

Also update `SINGLE_RECRUITMENT_SIGNALS` in the classifier with: `'career', 'careers', 'circular', 'notice', 'engagement', 'opportunity', 'deputation', 'apprentice'`

---

## B. Safe Operational Controls

### 4. Per-domain throttling and cooldown

**File: `supabase/functions/firecrawl-ingest/index.ts`**

Add a simple in-memory domain tracker at the top of the file:

```typescript
const domainLastFetch = new Map<string, number>();
const domainFailCount = new Map<string, number>();
const DOMAIN_MIN_INTERVAL_MS = 2000; // 2s between requests to same domain
const DOMAIN_COOLDOWN_THRESHOLD = 3; // after 3 consecutive failures
const DOMAIN_COOLDOWN_MS = 30_000; // 30s cooldown

function getDomainThrottleDelay(url: string): number { ... }
function recordDomainSuccess(url: string): void { ... }
function recordDomainFailure(url: string): boolean { ... } // returns true if cooled down
```

Apply `getDomainThrottleDelay` before every `scrapePage` call in:
- `handleDiscoverSource` (detail scrape loop)
- `handleScrapePending` (item loop)
- `handleGovtScrapeExtract` (item loop)

### 5. Content-hash skip for unchanged pages

In `handleScrapePending` and `handleGovtScrapeExtract`, after scraping, check if `content_hash` matches the existing staged item's hash. If identical, skip re-extraction and log "unchanged content, skipping".

### 6. Bounded retry with backoff in client

**File: `supabase/functions/_shared/firecrawl/client.ts`**

- Increase `MAX_RETRIES` from 2 to 3
- Use exponential backoff: `RETRY_DELAY_MS * 2^(attempt-1)` instead of linear `RETRY_DELAY_MS * attempt`
- Add 402 (insufficient credits) to non-retryable status codes — fail immediately, don't waste retries
- Log retry attempts with domain name for visibility

### 7. Cap runaway crawling

In `handleDiscoverSource`, add a hard cap: if `stats.pagesScraped >= 25`, stop detail scraping regardless of remaining candidates. In `handleGovtScrapeExtract`, the existing `maxItems` cap (50) is sufficient.

---

## C. Multi-Pass Extraction & Recovery

### 8. Second-pass extraction for weak drafts

**File: `supabase/functions/firecrawl-ingest/index.ts`**

Add a new action: `'recovery-pass'`

Logic:
1. Find drafts with `extraction_confidence IN ('low', 'none')` and `fields_extracted < 8` that haven't been retried (new column check: `recovery_attempted_at IS NULL`)
2. For each draft, look at `raw_links_found` for PDF links or detail-page links (URLs containing `/notification/`, `/pdf/`, `/detail/`, `/recruitment/`)
3. Scrape the best candidate link (highest `scoreGovtPage` score)
4. Re-extract fields from merged context: original `raw_scraped_text` + new page content
5. If new extraction has more `fields_extracted`, update the draft; otherwise keep original
6. Set `recovery_attempted_at = now()` to prevent re-running
7. Cap at 10 recovery attempts per invocation

This requires a new column:

```sql
ALTER TABLE firecrawl_draft_jobs ADD COLUMN IF NOT EXISTS recovery_attempted_at timestamptz;
```

### 9. PDF follow-up in govt-scrape-extract

In `handleGovtScrapeExtract`, after initial extraction, if `extraction.confidence === 'low'` and the scraped page's `links` contain PDF URLs from the same domain:
- Scrape the top-scoring PDF link
- Merge the PDF content with the original markdown
- Re-run `extractFields` on the merged content
- Update draft if improved

This is bounded: max 1 PDF follow-up per item.

---

## D. Operational Logging & Visibility

### 10. Enhanced run statistics

**File: `supabase/functions/firecrawl-ingest/index.ts`**

Expand the `stats` object in `handleDiscoverSource`, `handleGovtScrapeExtract`, and `handleScrapePending` to track:

```typescript
stats = {
  ...existing,
  pdfFollowUps: 0,
  detailPageFollowUps: 0,
  recoveryAttempts: 0,
  recoverySuccesses: 0,
  domainCooldowns: 0,
  unchangedSkips: 0,
  weakExtractions: 0,
  strongExtractions: 0,
}
```

Return these in the JSON response so the frontend receives them.

### 11. Surface stats in admin UI

**File: `src/components/admin/firecrawl/GovtSourcesManager.tsx`**

In the batch progress card, after each source completes, show a mini summary line:
`"Source X: discovered Y, scraped Z, extracted W, PDFs: N, skipped: M, cooldowns: C"`

**File: `src/components/admin/firecrawl/DraftJobsSection.tsx`**

No changes needed — the existing persistent report blocks already display whatever the backend returns. The enriched stats will automatically appear.

---

## Files Changed

| File | Changes |
|------|---------|
| `supabase/functions/_shared/firecrawl/client.ts` | Retry bump to 3, exponential backoff, 402 non-retryable, domain logging |
| `supabase/functions/_shared/firecrawl/url-filter.ts` | Move PDF to accept, add 12 new accept signals, add 8 new reject signals |
| `supabase/functions/_shared/firecrawl/page-classifier.ts` | Add 10+ scoring signals, PDF bonus +3, deep path bonus, stale year penalty, new recruitment signals |
| `supabase/functions/firecrawl-ingest/index.ts` | Domain throttling, discovery limits up, content-hash skip, PDF follow-up in govt, recovery-pass action, enhanced stats, hard scrape cap |
| `src/components/admin/firecrawl/GovtSourcesManager.tsx` | Display per-source mini summary in batch progress |
| DB migration | Add `recovery_attempted_at` column to `firecrawl_draft_jobs` |

## Practical Defaults

| Control | Value |
|---------|-------|
| Domain min interval | 2s |
| Domain cooldown threshold | 3 consecutive failures |
| Domain cooldown duration | 30s |
| Max detail scrapes (private) | 10 |
| Max detail scrapes (govt) | 15 |
| Max detail scrapes (sitemap) | 8 |
| Hard scrape cap per discover run | 25 |
| Discovery URL filter cap (private) | 300 |
| Discovery URL filter cap (sitemap) | 400 |
| Govt map limit | min(maxPages*10, 2000) |
| Client retries | 3 (exponential backoff: 3s, 6s, 12s) |
| Recovery pass max per invocation | 10 |
| PDF follow-up per item | max 1 |
| Inter-source delay (govt batch) | 3s |
| Inter-item delay (govt scrape) | 2s |

## Regression Checklist

1. Existing discover-source, run-source, scrape-pending actions still work
2. Existing govt-run-all, discover-govt, govt-scrape-extract still work
3. Domain throttling does not block first request to any domain
4. PDF URLs now accepted by url-filter, not rejected
5. Government page scoring returns higher scores for recruitment-related pages
6. Content-hash skip correctly avoids re-extracting unchanged pages
7. Recovery-pass only targets low/none confidence drafts not previously attempted
8. PDF follow-up bounded to 1 per item
9. 402 errors fail immediately without retrying
10. Enhanced stats appear in API responses
11. GovtSourcesManager batch progress shows per-source summary
12. Auto-publish remains only in Government Draft Jobs section
13. 6-section layout order preserved
14. No changes to DraftJobsSection component behavior

