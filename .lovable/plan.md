

# Automatic SEO Cache Rebuild System — Implementation Plan

## Overview

Three-tier system: DB triggers queue changes → pg_cron processes queue every 5 min → `seo-cache-rebuild` edge function rebuilds affected pages, computes content hashes, purges Cloudflare cache, and logs results.

## 1. Database Migration

### New table: `seo_rebuild_queue`
- `id uuid PK`, `slug text NOT NULL`, `page_type text DEFAULT 'unknown'`, `reason text DEFAULT 'manual'`
- `status text DEFAULT 'pending'` (pending/processing/done/failed)
- `retry_count integer DEFAULT 0`, `max_retries integer DEFAULT 3`, `last_retry_at timestamptz`
- `created_at timestamptz DEFAULT now()`, `processed_at timestamptz`, `error_message text`
- Partial unique index: `CREATE UNIQUE INDEX idx_rebuild_queue_pending_slug ON seo_rebuild_queue(slug) WHERE status = 'pending'` — ensures one pending entry per slug

### New table: `seo_rebuild_log`
- `id uuid PK`, `rebuild_type text` (single/batch/full), `slugs_requested int`, `slugs_rebuilt int`, `slugs_skipped int`, `slugs_failed int`, `cf_purged int`, `duration_ms int`, `error_details jsonb`, `trigger_source text`, `created_at timestamptz DEFAULT now()`

### Alter `seo_page_cache`
- Add `content_hash text` column

### Trigger function: `queue_seo_rebuild()`
- SECURITY DEFINER, handles `govt_exams`, `blog_posts`, `employment_news_jobs`
- Uses `INSERT ... ON CONFLICT (slug) WHERE status = 'pending' DO UPDATE SET reason = reason || ' + ' || EXCLUDED.reason, created_at = now()`
- For `govt_exams`: queues new slug, old slug (if changed, as `-stale`), old/new department pages, old/new state pages
- For `blog_posts`: queues on publish/update, queues old slug as `-stale` on unpublish/slug-change/delete
- For `employment_news_jobs`: same pattern — publish queues rebuild, unpublish/delete/slug-change queues stale

### Three triggers
- `trg_govt_exams_seo_rebuild` AFTER INSERT/UPDATE/DELETE
- `trg_blog_posts_seo_rebuild` AFTER INSERT/UPDATE/DELETE
- `trg_employment_news_seo_rebuild` AFTER INSERT/UPDATE/DELETE

## 2. New Edge Function: `seo-cache-rebuild`

**Security**: Protected by dual auth — admin JWT OR `SEO_REBUILD_SECRET` bearer token. `verify_jwt = false` in config (validated in code).

**Three modes**:
- `mode: 'queue'` — claim pending rows (up to 50), set to `processing`, rebuild each, mark `done`/`failed`. Failed items increment `retry_count`; items exceeding `max_retries` are marked `failed` permanently.
- `mode: 'slugs'` — rebuild specific slugs passed in body
- `mode: 'full'` — rebuild all programmatic pages (reuses `build-seo-cache` HTML generation logic, duplicated server-side for the standalone/static pages; for DB-sourced pages like blog/govt-exams, fetches from DB)

**Processing logic per slug**:
1. If page_type ends in `-stale`: DELETE from `seo_page_cache`, purge CF cache, done
2. Otherwise: generate `head_html` + `body_html` using same `generateHeadHTML`/`generateBodyHTML` functions (copied from `build-seo-cache`)
3. Compute `content_hash = MD5(head_html + body_html)` — if hash matches existing row, skip upsert (mark as skipped)
4. If hash changed: upsert to `seo_page_cache`, purge CF cache for that URL
5. Log results to `seo_rebuild_log`

**Cloudflare purge**: Calls `POST https://api.cloudflare.com/client/v4/zones/{zone_id}/purge_cache` with changed URLs. Skips silently if `CLOUDFLARE_ZONE_ID` or `CLOUDFLARE_API_TOKEN` secrets are missing.

**Concurrency**: Uses `pg_advisory_xact_lock(hashtext(slug))` when processing each slug.

## 3. Update `build-seo-cache`

Add `content_hash` (MD5 of head_html + body_html) to each upserted row.

## 4. Update `SEOCacheBuilder.tsx` Admin UI

Add below existing "Build SEO Cache" button:
- **Rebuild Slug** — text input + button, calls `seo-cache-rebuild` with `mode: 'slugs'`
- **Queue Status** — badge showing pending queue count
- **Recent Rebuild Log** — table showing last 10 entries from `seo_rebuild_log` (type, rebuilt/skipped/failed counts, duration, trigger source, timestamp)
- **Failed Queue Items** — if any items with `retry_count >= max_retries`, show them with slug, reason, error, and a "Retry" button that resets retry_count

## 5. Config Changes

Add to `supabase/config.toml`:
```toml
[functions.seo-cache-rebuild]
verify_jwt = false
```

## 6. pg_cron Job (via insert tool, not migration)

```sql
SELECT cron.schedule(
  'process-seo-rebuild-queue',
  '*/5 * * * *',
  $$ SELECT net.http_post(
    url:='https://riktrtfgpnrqiwatppcq.supabase.co/functions/v1/seo-cache-rebuild',
    headers:='{"Content-Type":"application/json","Authorization":"Bearer <SEO_REBUILD_SECRET>"}'::jsonb,
    body:='{"mode":"queue"}'::jsonb
  ) AS request_id; $$
);
```

## 7. Secrets Needed

- `SEO_REBUILD_SECRET` — new secret for internal auth (will prompt user)
- `CLOUDFLARE_ZONE_ID` — optional, for cache purge
- `CLOUDFLARE_API_TOKEN` — optional, for cache purge

## Files Changed

| File | Action |
|------|--------|
| DB migration | NEW — queue table, log table, content_hash column, trigger function, 3 triggers |
| `supabase/functions/seo-cache-rebuild/index.ts` | NEW |
| `supabase/functions/build-seo-cache/index.ts` | EDIT — add content_hash to upsert |
| `src/components/admin/SEOCacheBuilder.tsx` | EDIT — add rebuild controls, queue status, log viewer, failed items |
| `supabase/config.toml` | EDIT — add seo-cache-rebuild entry |
| pg_cron insert | NEW — via insert tool after secrets are configured |

## Trigger Summary

| Change | Trigger Type | Pages Affected |
|--------|-------------|----------------|
| govt_exam content edit | DB trigger → queue | Exam slug + department + state pages |
| govt_exam slug rename | DB trigger → queue | New slug (rebuild) + old slug (stale delete) |
| Blog publish/update | DB trigger → queue | Blog slug |
| Blog unpublish/delete | DB trigger → queue | Blog slug (stale delete) |
| Employment news publish | DB trigger → queue | News slug |
| Shared template/CSS change | Manual or deploy hook | Full rebuild (all pages) |

