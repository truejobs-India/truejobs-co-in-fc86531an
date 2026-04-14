

# Fix: "Download Titles (.txt)" Only Downloads 1000 Titles

## Root Cause

The `handleDownloadArticleTitles` function (line 510) performs a single Supabase query without pagination:

```typescript
const { data } = await supabase.from('blog_posts').select('title').order('created_at', { ascending: false });
```

Supabase JS client has a **default limit of 1000 rows**. With 2,595+ blog posts, this silently truncates the result.

The same bug also exists in `handleCheckDuplicateSlugs` (line 525).

## Solution

**File: `src/components/admin/BlogPostEditor.tsx`**

Replace both functions with paginated fetching using the same `fetchAllPaginated` pattern already used elsewhere in the project (e.g., `BlogAdminStats.tsx`). Key points:

1. **`handleDownloadArticleTitles`**: Loop in batches of 1000 using `.range(from, to)` with `.order('id')` for deterministic pagination. Concatenate all titles, then trigger the download.

2. **`handleCheckDuplicateSlugs`**: Same paginated approach — fetch all slugs across batches before checking for duplicates.

Both will use `.order('id')` (not `created_at`) for stable pagination, consistent with the project's pagination policy.

## File Changed
- `src/components/admin/BlogPostEditor.tsx` — two functions updated

