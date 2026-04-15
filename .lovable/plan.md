

# GSC All URLs Export — Verification Report & Fix

## Verification Summary

I audited the export against the live database. Here is what I found:

### Current Database Counts
| Type | Count |
|------|-------|
| Blogs (published) | 2,645 |
| Employment News (published, with slug) | 1,561 (28 more have NULL slugs — correctly excluded) |
| Govt Exams | 25 |
| Active Jobs | 1 |
| Companies (approved) | 4 |
| Custom Pages (published) | 98 |
| PDF Resources (published) | 34 (all sample_paper type) |

### What Works Correctly
- Pagination for tables over 1,000 rows (blogs, emp news) — properly implemented
- Employment news entries with NULL slugs are correctly filtered out (28 entries)
- Deduplication across all sheets works
- Resource type `sample_paper` correctly maps to `/sample-papers/` prefix
- All programmatic SEO slug generators are included
- Static pages list is comprehensive

### Issue Found: Job URLs Use UUID Instead of Slug
The export generates URLs like:
`https://truejobs.co.in/jobs/ea55ae28-eec5-4d01-864e-7c7c7b958221`

But the canonical, SEO-friendly URL is:
`https://truejobs.co.in/jobs/financial-consultant-mnk674j7`

The page accepts both (tries slug first, falls back to UUID), but for GSC/Bing submission, the slug-based URL is what should be indexed.

## Fix Plan

### File: `src/components/admin/GSCAllUrlsExport.tsx`

**Change the jobs query** (line 160) from selecting `id` to selecting `slug`, and generate URLs using slug instead of UUID:

```typescript
// Before:
(supabase.from('jobs').select('id')).eq('status', 'active')
// → /jobs/${j.id}

// After:
(supabase.from('jobs').select('slug')).eq('status', 'active')
// → /jobs/${j.slug}   (skip if slug is null)
```

This is a 4-line change in the `buildDBRows` function (lines 160, 170-173).

## Impact
- Only 1 active job currently, so minimal immediate impact
- Ensures future job URLs in the export are the canonical slug-based versions that search engines should index
