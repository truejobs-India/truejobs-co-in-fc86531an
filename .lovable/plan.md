

# Fix: Persist H1 on Early-Clean Return Path

## Problem
After the deterministic H1 insertion at line 820-832, the compliance check at line 839 may find zero issues (the H1 was the only problem). The early-return at lines 840-846 stamps `ai_fixed_at` but never writes `post.content` back to the DB. The H1 fix is lost.

## Fix
Expand the early-clean return's DB update (line 841) to include the modified content, word count, and reading time when `h1WasInserted` is true.

**File**: `src/hooks/useBulkAutoFix.ts`, lines 839-847

Replace:
```typescript
if (failedChecks.length === 0) {
  await supabase.from('blog_posts').update({ ai_fixed_at: new Date().toISOString() }).eq('id', post.id);
  await stampBulkFixStatus(post.id, 'fixed', 0);
  return {
    postId: post.id, slug: post.slug, title: post.title,
    status: 'fixed', issuesFound: 0, fixesApplied: [], fixesSkipped: [],
  };
}
```

With:
```typescript
if (failedChecks.length === 0) {
  const cleanUpdate: Record<string, any> = { ai_fixed_at: new Date().toISOString() };
  if (h1WasInserted) {
    cleanUpdate.content = post.content;
    const wf = wordCountFields(post.content);
    cleanUpdate.word_count = wf.word_count;
    cleanUpdate.reading_time = wf.reading_time;
  }
  await supabase.from('blog_posts').update(cleanUpdate).eq('id', post.id);
  await stampBulkFixStatus(post.id, 'fixed', 0);
  return {
    postId: post.id, slug: post.slug, title: post.title,
    status: 'fixed', issuesFound: 0,
    fixesApplied: h1WasInserted
      ? [{ field: 'content (H1)', fixType: 'h1', beforeValue: '(no H1)', afterValue: 'Deterministic H1 inserted' }]
      : [],
    fixesSkipped: [],
  };
}
```

## What this does
- When `h1WasInserted` is true and the article is immediately clean, the updated content (with H1) is persisted along with recalculated word count and reading time.
- When `h1WasInserted` is false, behavior is identical to current code.
- The fix is also reported in `fixesApplied` so the result popup accurately reflects what happened.

## Everything else unchanged
All other plan items (H1/intro handler separation, FAQ brace fix, functional second pass, `no_action_taken` re-eligibility, edge-function H1 rescue) remain exactly as previously approved.

