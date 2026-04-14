

# Fix: Blog Stats Showing Inconsistent Article Counts

## Root Cause

Two critical bugs in `BlogAdminStats.fetchStats()`:

### 1. Non-deterministic pagination (PRIMARY CAUSE)
The `.range()` pagination has **no `.order()` clause**. Without a deterministic sort, PostgREST returns rows in arbitrary order across pages. Between the first batch (rows 0-999) and the second batch (rows 1000-1999), the database may reorder rows, causing **duplicates or gaps**. This is why the count fluctuates — sometimes the loop gets 1000 rows and stops (if the second batch happens to return 0 due to reordering), sometimes it gets all 2595.

### 2. Fetching `content` for 2,595 posts (CONTRIBUTING CAUSE)
The query selects the full `content` column for every post. With 2,595 articles, this is a massive payload that can cause response truncation, timeouts, or partial data — especially on slower connections. The `content` is needed only for compliance analysis (headings, intro/conclusion detection), but the stats for blocked/needsReview/policyRisk could use a lighter approach.

## Solution

**File: `src/components/admin/blog/BlogAdminStats.tsx`**

### Fix 1: Add deterministic ordering
Add `.order('id')` to the query to guarantee stable pagination. This is the critical fix.

### Fix 2: Split into two queries — lightweight stats + compliance sampling
- **Query 1 (fast, no content):** Fetch `id, is_published, meta_title, meta_description, cover_image_url, word_count, published_at, author_name` with `.order('id')` pagination. This handles: total, published, drafts, missingMeta, missingCover, thinContent, recentlyPublished, missingAuthor.
- **Query 2 (heavier, with content):** Fetch `id, title, slug, content, meta_title, meta_description, excerpt, cover_image_url, featured_image_alt, word_count, category, tags, faq_count, has_faq_schema, internal_links, canonical_url, is_published, author_name` with `.order('id')` pagination. This handles: blocked, needsReview, policyRisk via `blogPostToMetadata` + compliance analysis.

Both queries use `.order('id')` for deterministic pagination in 1000-row batches.

### Fix 3: Show partial stats immediately
Set the basic stats (total, published, drafts, etc.) as soon as Query 1 completes, then update blocked/needsReview/policyRisk when Query 2 finishes. This gives the user instant feedback while the heavier compliance scan runs.

## File Changed
- `src/components/admin/blog/BlogAdminStats.tsx`

