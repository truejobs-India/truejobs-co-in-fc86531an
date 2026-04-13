
# Fix: BlogAdminStats Pagination (Re-apply)

The file still contains the original single `select('*')` call (line 35) that hits the 1,000-row limit. The previous fix attempts did not persist.

## Change: `src/components/admin/blog/BlogAdminStats.tsx`

Replace `fetchStats` (lines 34-71) with paginated fetching:

```typescript
const fetchStats = async () => {
  const allData: any[] = [];
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
  if (allData.length === 0) return;

  // rest of stats logic uses allData instead of data
  // (same compliance loop + setStats block, just referencing allData)
```

All `.filter()` and loop references change from `data` to `allData`.

## Files changed: 1
- `src/components/admin/blog/BlogAdminStats.tsx` — paginated fetch replacing single query
