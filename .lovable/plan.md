## Status: IMPLEMENTED ✅

## Root Cause (Verified)

1. **Write-path drift**: `buildPostData()` in `BlogPostEditor.tsx` did NOT save `word_count` or `reading_time`. Every manual save/auto-save/publish toggled content without updating the stored word count.
2. **Scope mismatch**: `BulkEnrichByWordCount` filtered `.eq('is_published', true)`. 9 of 10 lowest-word-count articles are `is_published=false` (Draft/Review status), so they were invisible to the scan.
3. **PendingActionsPanel** used stale `p.word_count` from DB plus a content-length heuristic.

## Changes Made

### New: `src/lib/blogWordCount.ts`
- `calcLiveWordCount(html)` — null-safe, decodes HTML entities, strips tags
- `calcReadingTime(wordCount)` — derives reading time
- `wordCountFields(html)` — convenience for DB payloads

### `src/components/admin/BlogPostEditor.tsx`
- `buildPostData()` now includes `word_count` and `reading_time` (drift fix)
- `togglePublish()` now recalculates and saves word count
- `getPostScores()`, `liveWordCount`, `applyEnrichment()`, `handleFixAllForPost()`, bulk create — all use shared utility

### `src/components/admin/blog/BulkEnrichByWordCount.tsx`
- **Scope selector**: All Posts / Published Only / Unpublished Only
- **Status badges**: Uses exact same `getReadinessStatus()` path as admin table
- **Scan summary**: Shows "Scanned N posts (scope) — Found M below X words"
- **Post-save verification**: Logs target-met vs target-missed with percentage
- **Removed fire-and-forget sync** — replaced by write-path fix + explicit sync button
- **One-time sync button**: Chunked (20 at a time), with progress bar and error handling

### `src/components/admin/blog/PendingActionsPanel.tsx`
- Replaced `p.word_count < customWordLimit * 0.85 || contentLen < 4000` with `calcLiveWordCount(p.content) < customWordLimit`

## End-to-End Proof

Article: "पटवारी भर्ती 2026" (id: c35df702)
- `is_published`: false
- `word_count` in DB: 382
- PG live word count: 384
- **BEFORE**: BulkEnrichByWordCount filtered `is_published=true` → MISSED
- **AFTER**: Scope "All Posts" → INCLUDED, shown with "Needs Review" badge and 384 words
- 9 of 10 lowest-word-count articles are unpublished — all were invisible before
