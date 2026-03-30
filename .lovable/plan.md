

# Fix: Force Rebuild Missing 158 Employment News Pages

## Root Cause

Two issues found:

1. **1000-row query limit (CRITICAL)**: The `handleFullMode` function in `seo-cache-rebuild` queries `employment_news_jobs` without `.limit()` override. The Supabase JS client defaults to 1000 rows. You have 1,158 published employment news jobs, so 158 are silently dropped every rebuild.

2. **The 1 "skipped" page**: `jobs/employment-news/mecon-junior-engineer-officer-medical-officer-recruitment-2026` — it was cached from a prior build but happened to fall outside the 1000 rows returned this time. Since it wasn't in the rebuild target list, it wasn't processed at all. The actual 1 skip came from a different page where `rebuildSingleSlug` returned 'skipped' due to its fetcher returning null while an existing cache entry was present. This is a symptom of the same 1000-row truncation.

## Fix

### File: `supabase/functions/seo-cache-rebuild/index.ts`

**Change**: In `handleFullMode` (line ~468-472), add a pagination helper that fetches ALL rows from each table, not just the first 1000. The standard pattern is to use `.range()` in a loop.

```text
Current (broken):
  db.from('employment_news_jobs').select('slug').eq('status','published')
  → Returns max 1000 rows silently

Fixed:
  fetchAllSlugs(db, 'employment_news_jobs', { status: 'published' })
  → Paginates with .range() to get all 1158+ rows
```

**Implementation**: Add a `fetchAllRows` helper function that:
- Fetches in batches of 1000 using `.range(from, to)`
- Continues until a batch returns fewer than 1000 rows
- Returns the complete array

Apply to all three queries (blog_posts, govt_exams, employment_news_jobs) for future-proofing.

### Scope

- Single file change: `supabase/functions/seo-cache-rebuild/index.ts`
- Add ~15 lines for the pagination helper
- Modify 3 lines in `handleFullMode` to use the helper
- Redeploy edge function
- Then re-run Force Rebuild from admin panel

### Risk

- Zero regression risk — the function already handles these slugs correctly, it just wasn't receiving all of them
- After fix, Force Rebuild should report ~1368 rebuilt, 0 skipped, 0 failed

