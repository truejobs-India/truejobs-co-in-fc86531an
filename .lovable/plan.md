

# Fix: BlogAdminStats Showing Wrong Counts (1000 Instead of 2595)

## Root Cause
`BlogAdminStats.fetchStats()` calls `supabase.from('blog_posts').select('*')` which hits the **Supabase default 1,000 row limit**. Only 1,000 of 2,595 articles are fetched, making every stat wrong.

## Fix

### File: `src/components/admin/blog/BlogAdminStats.tsx`

**A. Use server-side counting via paginated fetches**

Replace the single `.select('*')` with a paginated approach that fetches only needed columns:

```typescript
// Fetch ALL posts in batches of 1000, only needed columns
const allData = [];
let from = 0;
const batchSize = 1000;
while (true) {
  const { data } = await supabase
    .from('blog_posts')
    .select('id, is_published, meta_title, meta_description, cover_image_url, word_count, published_at, author_name, content')
    .range(from, from + batchSize - 1);
  if (!data || data.length === 0) break;
  allData.push(...data);
  if (data.length < batchSize) break;
  from += batchSize;
}
```

Note: `content` is needed for the compliance checks (`blogPostToMetadata` / `analyzePublishCompliance`). If the compliance logic can work without full content, we'll exclude it too — but the current code passes full post objects to `blogPostToMetadata`, so we keep it for correctness.

**B. Use `allData` instead of `data` for all stat calculations**

All `.filter()` calls and the compliance loop operate on `allData` instead of the capped `data`.

## Result
- Stats will show the real **2,595 Total** (and correct Published, Drafts, etc.)
- Only metadata columns fetched per batch (smaller payload per request)
- Works for any number of posts

## Files changed: 1
- `src/components/admin/blog/BlogAdminStats.tsx`

