

# Fix: "Fix All" Button for Policy Risk Does Nothing

## Root Cause

In `handleBulkFix` (line 280), only two filters have actual implementation:
- `missing-seo` (lines 289-312) — loops through articles and calls `fixSingleArticle`
- `no-author` (lines 313-320) — batch-updates author name

For `policy-risk` and `needs-review`, the function falls through both `if` branches with **no action**, immediately calls `onRefresh?.()` (line 323), which re-fetches all posts and causes the apparent "page refresh".

## Fix

**File: `src/components/admin/blog/BlogStatsDrilldown.tsx`**

Add `else if (filter === 'policy-risk' || filter === 'needs-review')` branch inside `handleBulkFix` that:

1. Loops through each article in `articles`
2. Fetches full content from DB (same as the SEO path)
3. Calls the `improve-blog-content` edge function with the selected AI model, passing the article content and the compliance issues as context
4. Tracks fixed/failed counts and updates `fixResults` per article
5. Adds a 2-second delay between articles to avoid rate limits
6. Shows a completion toast

The edge function call will use the existing `supabase.functions.invoke('improve-blog-content', ...)` pattern already used elsewhere in the codebase, passing the article's compliance failure reasons so the AI knows what to fix.

### Technical Detail

```typescript
} else if (filter === 'policy-risk' || filter === 'needs-review') {
  for (const { post, reasons } of articles) {
    if (fixResults.get(post.id)?.status === 'fixed') continue;
    setFixingIds(prev => new Set([...prev, post.id]));
    try {
      const content = await fetchPostContent(post.id);
      const { data, error } = await supabase.functions.invoke('improve-blog-content', {
        body: {
          content,
          slug: post.slug,
          title: post.title,
          aiModel,
          mode: 'compliance-fix',
          issues: reasons,
        },
      });
      if (error) throw error;
      if (data?.improved_content) {
        await supabase.from('blog_posts')
          .update({ content: data.improved_content, updated_at: new Date().toISOString() })
          .eq('id', post.id);
        setFixResults(prev => new Map(prev).set(post.id, {
          slug: post.slug, status: 'fixed',
          reason: `Fixed ${reasons.length} compliance issue(s)`,
        }));
        fixedCount++;
      } else {
        setFixResults(prev => new Map(prev).set(post.id, {
          slug: post.slug, status: 'skipped', reason: 'No changes from AI',
        }));
      }
    } catch { failedCount++; }
    finally { setFixingIds(prev => { const n = new Set(prev); n.delete(post.id); return n; }); }
    await new Promise(r => setTimeout(r, 2000));
  }
  toast({ title: `✅ Compliance fix complete`, description: `${fixedCount} fixed, ${failedCount} failed` });
}
```

I also need to verify the `improve-blog-content` edge function supports a `compliance-fix` mode, or adapt to use its existing interface.

### Files Changed
- `src/components/admin/blog/BlogStatsDrilldown.tsx` — add policy-risk/needs-review branch in `handleBulkFix`
- Possibly `supabase/functions/improve-blog-content/index.ts` — add compliance-fix mode if not present

