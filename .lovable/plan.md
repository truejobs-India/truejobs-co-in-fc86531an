

## Problem

The "Search & Enrich" scan uses the `word_count` column stored in the database (`WHERE word_count < 800`), but this column is **stale and inaccurate**. The table UI shows correct word counts because it recalculates them live from content using regex (`content.replace(/<[^>]+>/g, '').split(/\s+/)...`). This mismatch means the scan misses most eligible articles.

**Evidence from database query**: Articles showing 382-663 words in the UI actually have `word_count` values of 1131+ in the database — the stored values were never updated after content changes or were set incorrectly during enrichment.

## Plan

### Step 1: Fix the scan to use live word count calculation

Instead of relying on the stale `word_count` DB column, the scan in `BulkEnrichByWordCount.tsx` should:

1. Fetch all published articles (with content)
2. Calculate word count live from content on the client side
3. Filter articles where the live word count is below the threshold

This matches exactly how the table UI displays word counts, ensuring consistency.

### Step 2: Sync stale `word_count` column during scan

As a bonus, after calculating live word counts, batch-update the `word_count` column in the database for all scanned articles so the DB stays in sync. This fixes the root cause — stale DB values.

### Step 3: Use the live word count for enrichment validation

In the enrichment loop, use the freshly calculated word count (not `post.word_count` from DB) as `originalWc` for the growth check (`actualWc > originalWc`). This prevents false negatives where the DB says 1131 but content is actually 400 words.

### Technical Details

**File**: `src/components/admin/blog/BulkEnrichByWordCount.tsx`

- **Scan handler**: Remove `.lt('word_count', searchBelow)` from the query. Fetch all published posts with `id, title, slug, content, word_count, category, tags`. Calculate live word count client-side using the same formula the table uses. Filter results where `liveWc < searchBelow`. Store `liveWc` on each `FoundArticle` object.
- **DB sync**: For articles where `liveWc !== post.word_count`, issue batch updates to correct the `word_count` column.
- **Enrich handler**: Use `post.word_count` (now set to `liveWc` from scan) instead of the stale DB value for the `originalWc` comparison.
- **Pagination**: Since we need content for all published posts, fetch in batches of 500 using `.range()` to handle large datasets beyond the 1000-row default limit.

