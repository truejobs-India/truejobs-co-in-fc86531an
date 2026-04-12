

# Fix: Selected-Scope By-ID Fetch + Paginated Bulk Fetch

## Problem
The `scanAll` function fetches all blog posts in a single unpaginated query (line 228-230), hitting Supabase's default 1000-row limit. Selected articles outside the first 1000 rows are silently dropped, causing "0 scanned."

## Changes

### File: `src/hooks/useBulkAutoFix.ts` (lines 226-274)

Replace the single monolithic fetch + scope filtering with scope-aware fetching:

```typescript
const SELECT_COLS = 'id, title, slug, content, excerpt, cover_image_url, featured_image_alt, is_published, meta_title, meta_description, canonical_url, author_name, faq_count, has_faq_schema, faq_schema, internal_links, word_count, updated_at, last_bulk_scanned_at, last_bulk_fixed_at, last_bulk_fix_status, remaining_auto_fixable_count';

let allFetchedPosts: BlogPost[];
let postsToScan: BlogPost[];
const stateBreakdown = { neverBulkFixed: 0, changed: 0, failed: 0, partial: 0, noActionTaken: 0, skippedUnchanged: 0, alreadyClean: 0 };

if (scope === 'selected' && targetPosts && targetPosts.length > 0) {
  // Direct by-ID fetch — no 1000-row limit risk
  const targetIds = targetPosts.map(p => p.id);
  console.log(`[BULK_AUTO_FIX] Selected scope: fetching ${targetIds.length} posts by ID`);
  const { data, error } = await supabase
    .from('blog_posts')
    .select(SELECT_COLS)
    .in('id', targetIds);
  if (error || !data) {
    console.error('[BULK_AUTO_FIX] Failed to fetch selected posts:', error);
    allFetchedPosts = [];
  } else {
    allFetchedPosts = data as BlogPost[];
  }
  postsToScan = allFetchedPosts;
  if (postsToScan.length === 0 && targetIds.length > 0) {
    console.error(`[BULK_AUTO_FIX] Selected ${targetIds.length} posts but 0 matched in DB fetch — IDs may be stale`);
  }
  console.log(`[BULK_AUTO_FIX] Selected scope: ${postsToScan.length}/${targetIds.length} fetched`);
} else {
  // Paginated fetch for all/smart/failed_partial
  allFetchedPosts = [];
  let from = 0;
  const BATCH = 1000;
  while (true) {
    const { data: batch, error } = await supabase
      .from('blog_posts')
      .select(SELECT_COLS)
      .order('id', { ascending: true })
      .range(from, from + BATCH - 1);
    if (error || !batch || batch.length === 0) break;
    allFetchedPosts.push(...(batch as BlogPost[]));
    if (batch.length < BATCH) break;
    from += BATCH;
  }
  console.log(`[BULK_AUTO_FIX] Paginated fetch: ${allFetchedPosts.length} total posts`);

  // Apply scope filtering
  if (scope === 'all') {
    postsToScan = allFetchedPosts;
  } else if (scope === 'failed_partial') {
    postsToScan = allFetchedPosts.filter(p => isEligibleForFailedPartialScope(p));
  } else {
    // Smart scope
    postsToScan = [];
    for (const post of allFetchedPosts) {
      const { eligible, reason } = isEligibleForSmartScope(post);
      if (eligible) {
        postsToScan.push(post);
        if (reason === 'neverBulkFixed') stateBreakdown.neverBulkFixed++;
        else if (reason === 'changed') stateBreakdown.changed++;
        else if (reason === 'failed') stateBreakdown.failed++;
        else if (reason === 'partial') stateBreakdown.partial++;
      } else {
        stateBreakdown.skippedUnchanged++;
      }
    }
  }
  console.log(`[BULK_AUTO_FIX] Scope "${scope}": ${postsToScan.length} candidates after filtering`);
}
```

The `stateBreakdown` declaration and its usage in the rest of the scan loop (lines 276+) remain unchanged.

### File: `src/components/admin/BlogPostEditor.tsx` (line 1208-1220)

Add debug logs inside `handleBulkFixScan`:

```typescript
const handleBulkFixScan = (scopeOverride?: ...) => {
  const scope = scopeOverride || (selectedPostIds.size > 0 ? 'selected' : bulkScanScope);
  console.log(`[BULK_FIX_UI] handleBulkFixScan scope=${scope}, selectedPostIds=${selectedPostIds.size}`);
  if (scope === 'selected') {
    const selectedPosts = posts.filter(p => selectedPostIds.has(p.id));
    console.log(`[BULK_FIX_UI] Selected posts resolved: ${selectedPosts.length}, IDs:`, selectedPosts.map(p => p.id));
    // ... rest unchanged
  }
  // ... rest unchanged
};
```

### Improved zero-scan message

In the scan report dialog rendering in `BlogPostEditor.tsx`, when `totalScanned === 0` and scope was `'selected'`, show a more truthful message like:

> "Selected articles could not be loaded for scanning. They may have been deleted or the selection was stale."

Instead of the generic "No articles matched the scan criteria."

## What this fixes
- **Selected scope**: fetches exactly the chosen articles by ID — no truncation possible
- **Bulk scopes**: paginated with deterministic `order('id')` — fetches all 1400+ articles
- **Debug logs**: trace scope, IDs, fetch counts at every stage
- **Zero-scan reason**: explicit message when selected articles fail to load

## What stays unchanged
- All analyzer logic, thresholds, scoring
- H1 persistence, FAQ fix, second pass, re-eligibility, edge-function rescue
- Compliance check flow after fetch
- `executeAutoFix` and `processOneArticle`

