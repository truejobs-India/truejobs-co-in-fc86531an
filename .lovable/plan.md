

# RSS Ingestion Module — Implementation Plan

## Overview
Build an end-to-end RSS intake system: 4 database tables, 4 shared edge function modules + 1 orchestrator, 6 admin UI components, and a DB function for server-side status sync. Integrated as a new "RSS Intake" tab in AdminDashboard.

## Final Refinements Applied
1. `run-due-sources` records `trigger_source` as `'manual_admin'` or `'cron_secret'` in `rss_fetch_runs.run_mode` field (extended allowed values)
2. `monitoring_review_queue` uses `UNIQUE INDEX ON (channel, source_item_id) WHERE source_item_id IS NOT NULL` (partial unique)
3. Status sync via a `sync_rss_review_status` DB function (SECURITY DEFINER) — updates both `monitoring_review_queue.review_status` and `rss_items.current_status` atomically
4. All queries/sorts use `COALESCE(published_at, first_seen_at)` for feeds missing `published_at`

---

## Database Migration

### Tables
1. **rss_sources** — feed registry (priority, status, ETag/Last-Modified, check_interval_hours)
2. **rss_fetch_runs** — per-source fetch audit log (run_mode includes `manual`, `scheduled`, `test`, `manual_admin`, `cron_secret`)
3. **rss_items** — parsed items with 3-tier dedup indexes:
   - Partial unique: `(rss_source_id, item_guid) WHERE item_guid IS NOT NULL`
   - Partial unique: `(rss_source_id, canonical_link) WHERE canonical_link IS NOT NULL`
   - Unique: `(normalized_hash)` as fallback
4. **monitoring_review_queue** — multi-channel review queue with partial unique: `(channel, source_item_id) WHERE source_item_id IS NOT NULL`

### DB Function: `sync_rss_review_status`
- Input: `p_review_queue_id UUID, p_new_status TEXT`
- Updates `monitoring_review_queue.review_status` + `reviewed_at`
- Maps status to `rss_items.current_status` (`approved→reviewed`, `rejected→reviewed`, `ignored→ignored`, `duplicate→duplicate`, `on_hold→queued`)
- SECURITY DEFINER, admin-only via `has_role` check

### Supporting
- Validation triggers (not CHECK constraints) for all enum-like fields
- `updated_at` triggers using existing `update_updated_at_column()`
- RLS: admin-only on all 4 tables via `has_role(auth.uid(), 'admin')`
- Btree indexes on `rss_items(rss_source_id)`, `(current_status)`, `(published_at)`, `(item_type)`, `(relevance_level)`

---

## Edge Function Modules

### Shared modules in `supabase/functions/_shared/rss/`
1. **feed-parser.ts** — RSS 2.0 + Atom detection and parsing, relative URL resolution, returns `ParsedFeedItem[]` + `FeedMeta`
2. **classifier.ts** — keyword-based `item_type` + `relevance_level` + `detection_reason` from title/summary/categories (Hindi keywords included)
3. **deduper.ts** — SHA-256 hash generation, PDF extraction (enclosures + HTML hrefs + `.pdf` links only), URL normalization
4. **queue-router.ts** — shouldQueue logic (High/Medium relevance), upsert into `monitoring_review_queue`

### Orchestrator: `supabase/functions/rss-ingest/index.ts`
- `verify_jwt = true` (default, no config.toml entry needed)
- Auth: JWT admin check for all actions except `run-due-sources` which also accepts `X-Cron-Secret` header
- Actions: `test-source`, `run-source`, `run-due-sources`, `requeue-item`, `import-sources`
- `run-due-sources` sets `run_mode` to `'manual_admin'` or `'cron_secret'` based on auth method
- 18-second fetch timeout, batch size 5
- ETag/Last-Modified support, 304 handling
- 3-tier upsert: try guid conflict → canonical_link conflict → normalized_hash conflict
- Falls back to `first_seen_at` when `published_at` is null

---

## Admin UI

### New files in `src/components/admin/rss-intake/`
1. **rssTypes.ts** — TypeScript types for all 4 tables
2. **RssIntakeManager.tsx** — wrapper with 4 sub-tabs (Dashboard, Sources, Items, Review)
3. **RssDashboardCards.tsx** — stat cards (total/active/broken sources, items 7d, pending reviews)
4. **RssSourcesTab.tsx** — CRUD table, Add/Edit dialogs, Test Feed preview, Run Now, Run Due, CSV import
5. **RssFetchedItemsTab.tsx** — items browser with filters, expandable detail rows, Queue/Ignore actions
6. **RssReviewQueueTab.tsx** — review queue with Approve/Reject/Ignore/Duplicate/Hold, QA notes, calls `sync_rss_review_status` RPC

### Integration
- Add "RSS Intake" tab to `AdminDashboard.tsx` after Chatbot tab
- Icon: `Rss` from lucide-react
- Import `RssIntakeManager`

---

## Files Created/Modified

| Action | File |
|--------|------|
| Create | DB migration (4 tables + indexes + triggers + RLS + `sync_rss_review_status` function) |
| Create | `supabase/functions/_shared/rss/feed-parser.ts` |
| Create | `supabase/functions/_shared/rss/classifier.ts` |
| Create | `supabase/functions/_shared/rss/deduper.ts` |
| Create | `supabase/functions/_shared/rss/queue-router.ts` |
| Create | `supabase/functions/rss-ingest/index.ts` |
| Create | `src/components/admin/rss-intake/rssTypes.ts` |
| Create | `src/components/admin/rss-intake/RssIntakeManager.tsx` |
| Create | `src/components/admin/rss-intake/RssDashboardCards.tsx` |
| Create | `src/components/admin/rss-intake/RssSourcesTab.tsx` |
| Create | `src/components/admin/rss-intake/RssFetchedItemsTab.tsx` |
| Create | `src/components/admin/rss-intake/RssReviewQueueTab.tsx` |
| Modify | `src/pages/admin/AdminDashboard.tsx` (add tab) |

## Secret Required
- `RSS_CRON_SECRET` — for unauthenticated cron calls to `run-due-sources`

