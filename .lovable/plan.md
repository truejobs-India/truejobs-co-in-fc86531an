

# Fix: Policy Risk Drilldown Shows All Articles Instead of 56

## Root Cause

The drilldown receives posts from `BlogPostEditor` with `content: ''` (stripped for performance at line 284). When `filterPosts` runs `analyzePublishCompliance` on these empty-content posts, the **thin-doorway** check (line 279) fails for every post because `wordCount = 0 < 300`. Since `thin-doorway` has `category: 'adsense-safety'` and `status: 'fail'`, the filter at line 154:

```typescript
return compliance.checks.some(c => c.category === 'adsense-safety' && c.status === 'fail');
```

...matches **all 2,595 posts**, not just the actual 56 with policy violations.

Meanwhile, `BlogAdminStats` correctly fetches `content` from the database and computes the real count (56).

## Fix

**File: `src/components/admin/blog/BlogStatsDrilldown.tsx`**

The drilldown's `filterPosts` function must fetch actual content from the database for compliance-dependent filters (`blocked`, `needs-review`, `policy-risk`) instead of running compliance analysis on empty content.

**Approach**: Make `filterPosts` async for compliance filters. When the drilldown opens with one of these filters, batch-fetch `content` for all posts from the database (paginated to handle 2,595+), then run the compliance checks on real content.

### Changes

1. Add a `useEffect` in the drilldown component that triggers when `filter` is `blocked`, `needs-review`, or `policy-risk`:
   - Batch-fetch `id, content` from `blog_posts` in 1000-row pages
   - Build a `Map<id, content>` lookup
   - Run `filterPosts` with content-enriched posts
   - Store filtered results in state

2. For non-compliance filters (`published`, `drafts`, `missing-seo`, `no-cover`, `no-author`, `this-week`), keep the existing synchronous filtering — no content needed.

3. Show a loading spinner while content is being fetched for compliance filters.

4. Update `getArticleReasons` similarly — it also runs `analyzePublishCompliance` on the same empty-content posts for the reason text.

### File Changed
- `src/components/admin/blog/BlogStatsDrilldown.tsx`

