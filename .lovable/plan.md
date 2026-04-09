

# Fix: Inline Image Slots Always Show "0/2" in Blog Table

## Root Cause

Same pattern as the word count bug. The performance optimization (line 273) sets `content: ''` and `article_images: null` for all posts in the list view. But the inline image status column (line 2221) calls `detectInlineSlots(post.content || '', post.article_images)` — with empty content and null images, both slots always appear unfilled, showing "0/2".

## Fix — 1 file: `src/components/admin/BlogPostEditor.tsx`

### Change 1: Include `article_images` in the list query

Add `article_images` to the `fetchPosts` select string (line 268). This is a small JSON field, not a large content blob — safe to include without performance impact.

### Change 2: Stop overwriting `article_images` to null

On line 273, change:
```typescript
setPosts(data.map(d => ({ ...d, content: '', article_images: null })) as BlogPost[]);
```
to:
```typescript
setPosts(data.map(d => ({ ...d, content: '' })) as BlogPost[]);
```

This preserves the real `article_images` data from the database while still excluding `content` for performance.

### Why this is sufficient

`detectInlineSlots` has two detection paths:
1. Parse `data-inline-slot` attributes from HTML content — won't work without content
2. Check `articleImages.inline` JSON metadata — **will work** once we stop nullifying it

Path 2 also verifies the URL appears in `html`, so with empty content it still won't detect filled slots purely from JSON. Therefore we also need the content — but loading full content defeats the optimization.

**Better approach**: Since the inline slot status is really just metadata (are there 0, 1, or 2 inline images), we should compute and display it from the `article_images` JSON alone in the list view, without requiring content:

### Change 3: Use `article_images` JSON directly for list display

Replace the inline status cell logic (lines 2220-2239) to count filled slots from the `article_images.inline` array directly, without calling `detectInlineSlots` (which needs content):

```typescript
{(() => {
  const ai = post.article_images;
  const inlineArr = Array.isArray(ai?.inline) ? ai.inline : [];
  const filledCount = inlineArr.filter((s: any) => s?.url).length;
  const isLoading = perArticleLoading[post.id] === 'inline';
  if (filledCount >= 2) {
    return <Badge variant="secondary" className="text-[10px]">2/2</Badge>;
  }
  return (
    <Button ...>
      {isLoading ? <Loader2 .../> : <Badge ...>{filledCount}/2</Badge>}
    </Button>
  );
})()}
```

This shows accurate counts without needing the heavy `content` column.

## What is NOT changed
- The `fetchPosts` select query still excludes `content` (performance optimization preserved)
- `detectInlineSlots` function unchanged
- Edit dialog still lazy-loads full content + article_images
- No database changes

