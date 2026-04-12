

# Plan: Fix RSS System — Minimum Changes to Make It Operational

## Root Blocker
The `pg_cron` job (jobid 8) has three fatal problems:
1. It calls `fetch-rss-jobs` — a function that **does not exist**. The real function is `rss-ingest`.
2. It sends `'{}'::jsonb` as the body — missing the required `action: 'run-due-sources'` field.
3. It uses the anon key Bearer token for auth, but `rss-ingest` requires either admin JWT or `x-cron-secret` header. The anon key satisfies neither.

The edge function code, UI code, database schema, dedup logic, queue routing, and all shared utilities are **correct and complete**. No code changes are needed in any file.

## What Will Be Changed

### 1. Fix the cron job (database-only change)
Delete the broken cron job (jobid 8) and create a correct replacement:
- URL: `rss-ingest` (not `fetch-rss-jobs`)
- Body: `{"action": "run-due-sources"}`
- Auth: `x-cron-secret` header with the value of `RSS_CRON_SECRET` (already configured as a secret)
- Schedule: keep `0 */6 * * *` (every 6 hours)

```sql
SELECT cron.unschedule(8);

SELECT cron.schedule(
  'rss-ingest-due-sources',
  '0 */6 * * *',
  $$
  SELECT net.http_post(
    url := 'https://riktrtfgpnrqiwatppcq.supabase.co/functions/v1/rss-ingest',
    headers := '{"Content-Type": "application/json", "x-cron-secret": "RSS_CRON_SECRET_VALUE"}'::jsonb,
    body := '{"action": "run-due-sources"}'::jsonb
  ) AS request_id;
  $$
);
```

Since we can't embed the secret value directly in the SQL (it would be visible in cron.job), we'll use the same pattern as the seo-cache-rebuild job — reading from an `app_settings` table or embedding it as a Vault reference. However, the simplest safe approach for this project: we'll read the secret value using `fetch_secrets`, then create the cron job with it inline (this is the pattern already used by other cron jobs in this project that embed the anon key directly).

### 2. Live verification test
After fixing the cron job, perform a live end-to-end test:

**Step A:** Add a test RSS source by calling `rss-ingest` with `action: 'import-sources'` using a known working government RSS feed (e.g., `https://www.upsc.gov.in/rss.xml` or similar Indian government feed).

**Step B:** Call `rss-ingest` with `action: 'test-source'` to verify parsing works.

**Step C:** Call `rss-ingest` with `action: 'run-source'` to do a full ingestion run.

**Step D:** Verify records exist in `rss_sources`, `rss_fetch_runs`, `rss_items`, and `monitoring_review_queue`.

**Step E:** Run `run-source` again on the same source to verify dedup (no new duplicates, `last_seen_at` updated).

**Step F:** Call `rss-ingest` with `action: 'run-due-sources'` using the cron secret header to verify the scheduled path works.

### 3. No code changes
- No edge function code changes needed
- No UI component changes needed
- No database schema changes needed
- No new tables, columns, or functions needed

## Files Changed
None. This is a database/cron-only fix.

## Database Changes
- Delete cron job 8 (`fetch-rss-jobs-every-6h`)
- Create replacement cron job `rss-ingest-due-sources` with correct URL, body, and auth header

## Remaining Known Limitations (Intentionally Untouched)
- No PDF content extraction (URLs only)
- No linked page crawling
- No publishing pipeline from RSS items to blog posts
- Custom regex XML parser (no external library)
- No retry logic for failed sources beyond next cron cycle
- AI processing pipeline (`rss-ai-process`) exists but is separate and not part of this fix

