

# Fix: Word Count Shows 0 in Blog Admin Table

## Root Cause

The previous optimization (excluding `content` from the list query) caused a cascading bug:

- **Line 933**: `getPostScores()` calls `calcLiveWordCount(post.content)` — but `post.content` is now `undefined` (not fetched), so it returns **0**.
- **Line 934**: This zero overwrites the real `word_count` from the database: `{ ...post, word_count: liveWc }`.
- **Line 2185**: The table displays `scores.wordCount` which is this calculated zero.

The stored `word_count` in the database is correct (all 660 posts have non-zero values), but the UI recalculates from missing content and displays 0.

Secondary breakage:
- **Line 449**: `togglePublish` calls `wordCountFields(post.content)` — would also write 0 to the database if toggled from the list (content is undefined).
- **Line 1176**: Auto-fix also recalculates from `post.content` which is undefined in the list context.

## Fix (1 file)

### `src/components/admin/BlogPostEditor.tsx`

**Change 1 — `getPostScores()`** (line 932-939): Use the stored `post.word_count` from the database instead of recalculating from content. Content is no longer available in list context. Only recalculate when content is actually present (edit mode).

```typescript
const getPostScores = (post: BlogPost) => {
  const wc = post.content ? calcLiveWordCount(post.content) : (post.word_count || 0);
  const postWithWc = { ...post, word_count: wc };
  const meta = blogPostToMetadata(postWithWc);
  const q = analyzeQuality(meta);
  const s = analyzeSEO(meta);
  const r = getReadinessStatus(q, s, meta);
  return { quality: q.totalScore, seo: s.totalScore, readiness: r, wordCount: wc };
};
```

**Change 2 — `togglePublish()`** (line 448-455): Guard against undefined content — use stored word_count if content isn't loaded.

```typescript
const { word_count, reading_time } = post.content 
  ? wordCountFields(post.content)
  : { word_count: post.word_count || 0, reading_time: post.reading_time || 1 };
```

**Change 3 — auto-fix recalculation** (line 1175-1178): Same guard — skip word count recalculation if content isn't loaded.

## What is NOT changed

- Database values (all correct)
- Select query (optimization stays)
- Lazy-load on edit (stays)
- Editor word count display (uses formData.content which is loaded on edit)

