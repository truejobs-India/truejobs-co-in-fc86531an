

# Root Cause: Force Rebuild Still Hardcodes `'manual'` in `handleSlugsMode`

## 1. Root cause found

**Line 444** of `supabase/functions/seo-cache-rebuild/index.ts`:

```typescript
const result = await rebuildSingleSlug(db, slug, 'manual', forceRebuild);
```

The batched Force Rebuild flow is:
1. Admin UI calls `mode: 'full-collect'` → returns canonical slugs like `blog/my-post`, `sarkari-jobs/ssc-cgl`, `jobs/employment-news/some-job` ✅
2. Admin UI sends those slugs in batches of 50 to `mode: 'slugs'` with `force: true` ✅
3. `handleSlugsMode` (line 444) calls `rebuildSingleSlug(db, slug, 'manual', forceRebuild)` — **hardcodes `'manual'`** ❌
4. `rebuildSingleSlug` (lines 624-630) checks: is `pageType === 'blog'`? No, it's `'manual'`. Is it `'govt-exam'`? No. Is it `'employment-news'`? No. → `pageData = null`
5. Lines 633-644: No page data → checks for existing cache row → if found, returns `'skipped'`; if not found, returns `'failed'`

**Result**: 1357 skipped (had existing cache rows), 11 failed (no cache rows), 0 rebuilt.

Note: The old `handleFullMode` (line 545) correctly passes `row.page_type` — but this path is no longer used since the batching refactor routes everything through `handleSlugsMode`.

## 2. Exact file and function

- **File**: `supabase/functions/seo-cache-rebuild/index.ts`
- **Function**: `handleSlugsMode`, line 444

## 3. Why the earlier plan missed this

The earlier plan correctly identified this bug and proposed the fix. However, the fix was **discussed and approved but never actually committed to the file**. The deployed edge function still has the original `'manual'` hardcode. The plan was approved multiple times but the actual code edit was never applied.

## 4. Minimal safe fix

Add a slug-prefix inference function and use it in `handleSlugsMode`:

**Add after `toBareDbSlug` (~line 706):**
```typescript
function inferPageTypeFromSlug(slug: string): string {
  if (slug.startsWith('blog/')) return 'blog';
  if (slug.startsWith('sarkari-jobs/')) return 'govt-exam';
  if (slug.startsWith('jobs/employment-news/')) return 'employment-news';
  return 'manual';
}
```

**Change line 444 from:**
```typescript
const result = await rebuildSingleSlug(db, slug, 'manual', forceRebuild);
```
**To:**
```typescript
const result = await rebuildSingleSlug(db, slug, inferPageTypeFromSlug(slug), forceRebuild);
```

Two changes. ~8 lines total.

## 5. Why this fix is safer than broader alternatives

- The `full-collect` mode already returns canonical-prefixed slugs — the prefix inference is deterministic and guaranteed correct
- Unknown prefixes fall back to `'manual'` — identical to current behavior, so no regression for programmatic/inventory pages
- No changes to `rebuildSingleSlug`, `handleFullMode`, fetchers, or any other function
- No changes to canonical cache key strategy
- No changes to the Worker

## 6. What must be redeployed

Only the `seo-cache-rebuild` edge function.

## 7. Expected result after rerunning Force Rebuild

~1,368 rebuilt, 0 skipped, 0 failed.

The 11 previously "failed" slugs should also succeed now — they failed because they had no existing cache row AND no page data (since `'manual'` type bypassed all fetchers). With correct type inference, the fetchers will find their source data.

