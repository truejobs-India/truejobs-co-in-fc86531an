

# Fix: Publish All showing only 1,000 articles

## Root cause
`fetchPosts()` in `BlogPostEditor.tsx` (line 265) makes a single Supabase query with no `.range()` call. Supabase JS client defaults to returning a maximum of 1,000 rows. Since the blog has 2,595 articles, 1,595 are silently dropped. The "Publish All Drafts" button counts from this truncated array.

## Fix

### File: `src/components/admin/BlogPostEditor.tsx`

Replace the single-query `fetchPosts` with a paginated loop (same pattern already used in `BlogAdminStats.tsx`):

```typescript
const fetchPosts = async () => {
  const allData: any[] = [];
  let from = 0;
  const batchSize = 1000;
  const selectFields = 'id,title,slug,is_published,...(all existing fields)...';

  while (true) {
    const { data, error } = await supabase
      .from('blog_posts')
      .select(selectFields)
      .order('created_at', { ascending: false })
      .range(from, from + batchSize - 1);
    if (error || !data || data.length === 0) break;
    allData.push(...data);
    if (data.length < batchSize) break;
    from += batchSize;
  }

  setPosts(allData.map(d => ({ ...d, content: '' })) as BlogPost[]);
  setIsLoading(false);
};
```

This ensures all 2,595 articles are loaded, so the "Publish All Drafts" button (and all other bulk operations that rely on `posts`) will show and operate on the correct count.

### No other files changed
The `handlePublishAllDrafts` function already iterates over `posts.filter(p => !p.is_published)` and updates one-by-one, so it will automatically work with the full dataset once `fetchPosts` returns all rows.

