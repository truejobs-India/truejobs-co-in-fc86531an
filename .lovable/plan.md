

# Fix: Bulk Auto-Fix Scan Always Shows Stale Count

## Problem

When you click "Scan and Auto Fix All by AI", the scan always finds ~398 fixable articles — even after most were already fixed — because it scans the **in-memory `posts` array** that was loaded when the page first opened. The fixes were written to the database, but the scan never fetches fresh data before analyzing.

## Root Cause

In `src/hooks/useBulkAutoFix.ts`, the `scanAll` function (line 134) uses `allPosts` from the React prop/closure. This is stale if the user hasn't manually refreshed or navigated away. Even though `fetchPosts()` is called after fixes complete, the *next* scan still captures whatever `allPosts` was at callback creation time.

## Fix

**File: `src/hooks/useBulkAutoFix.ts`**

Modify `scanAll` to call `fetchPosts()` first (which refreshes the parent's `posts` state), then use a fresh query from the database directly for scanning — ensuring the scan always operates on current data.

Specifically:
1. At the start of `scanAll`, before scanning, fetch fresh posts directly from the database via a lightweight Supabase query (select only the columns needed for compliance analysis).
2. Use that fresh data for the scan loop instead of the stale `allPosts` prop.
3. Also call `fetchPosts()` so the parent table UI updates simultaneously.

This ensures that even if the user runs scan → fix → scan again without page reload, the second scan reflects all previously applied fixes.

## Technical Detail

```text
scanAll() current flow:
  postsToScan = allPosts (stale in-memory)  ← BUG
  → scan each post locally

scanAll() fixed flow:
  await fetchPosts()                         ← refresh parent state
  freshPosts = await supabase.from('blog_posts').select(...)  ← fresh DB read
  postsToScan = targetPosts ?? freshPosts
  → scan each post locally with current data
```

Only `src/hooks/useBulkAutoFix.ts` is changed. No other files affected.

