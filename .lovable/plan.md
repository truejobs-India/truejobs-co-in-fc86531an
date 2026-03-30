

# Improve GSCAllUrlsExport — 5 Safe Changes

## File: `src/components/admin/GSCAllUrlsExport.tsx` (single file, no backend changes)

## Verified Facts

- **Dedup ALREADY EXISTS** at lines 201-207: a shared `Set<string>` filters `staticRows → seoRows → dbRows` sequentially, keeping first occurrence. It does NOT cover `excludedRows` or `sitemapRows`. It does NOT track how many duplicates were removed.
- **`govt_exams` has NO `is_published` column**. It has `status` (default `'upcoming'`), with values like `upcoming`, `active`, `closed`, etc. `slug` is `NOT NULL`. All rows represent public pages. The current filter `['is_published', true]` silently returns 0 rows.
- **`employment_news_jobs` has 1,158+ published rows** — exceeds the 1,000-row Supabase default limit.

## Changes

### 1. Add pagination helper (before `buildDBRows`)
Simple `fetchAllRows` function using `.range()` in a while-loop. Apply to `employment_news_jobs`, `blog_posts`, `custom_pages`, and `govt_exams`.

### 2. Fix `govt_exams` query
Remove the broken `['is_published', true]` filter. Export all `govt_exams` rows — every row has a slug and represents a public page.

### 3. Refactor `buildDBRows` to return per-table counts
Return `{ rows: Row[], counts: { blogs, empNews, companies, customPages, resources, jobs, exams } }` so the summary sheet can show per-table breakdowns from the actual fetched data.

### 4. Enhance existing dedup to track removals
Add `dupCount` counter and `dupExamples` array (max 20) to the existing dedup function at lines 201-207. Dedup scope stays the same (static + SEO + DB sheets only — not excluded/sitemaps). Label it accurately in the summary.

### 5. Add "Export Summary" sheet as the FIRST sheet
A 2-column `Metric | Value` sheet built from **final post-dedup arrays** (`s1`, `s2`, `s3`) and `excludedRows`/`sitemapRows`:

```
Generated At              | 2026-03-30 06:33 PM
Total Workbook URLs       | (s1 + s2 + s3 + excluded + sitemaps)
Static Pages              | s1.length
Programmatic SEO          | s2.length
Database-Driven           | s3.length
  - Blog                  | s3.filter(r => r[1] === 'Blog').length
  - Employment News       | s3.filter(r => r[1] === 'Employment News').length
  - Companies             | s3.filter(r => r[1] === 'Company').length
  - Custom Pages          | s3.filter(r => r[1].startsWith('Custom')).length
  - PDF Resources         | s3.filter(r => r[1].startsWith('Resource')).length
  - Jobs                  | s3.filter(r => r[1] === 'Job Listing').length
  - Govt Exams            | s3.filter(r => r[1] === 'Govt Exam').length
Excluded Routes           | excludedRows.length
Sitemap URLs              | sitemapRows.length
Duplicates Removed        | dupCount
(first 20 dup URLs listed below if any)
```

All counts come from the final written data, not raw query counts.

### 6. Enhanced toast
```
"1,543 URLs exported (33 static, 581 SEO, 1,371 DB). 2 duplicates removed. File generated successfully."
```

## Technical Detail

**Pagination helper:**
```typescript
async function fetchAllRows<T>(table: string, cols: string, filter?: [string, unknown]): Promise<T[]> {
  const PAGE = 1000;
  let all: T[] = [];
  let from = 0;
  while (true) {
    let query = supabase.from(table as any).select(cols) as any;
    if (filter) query = query.eq(filter[0], filter[1]);
    const { data } = await query.range(from, from + PAGE - 1);
    if (!data || data.length === 0) break;
    all = all.concat(data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return all;
}
```

**`buildDBRows` refactored** to use `fetchAllRows` for all tables, remove the broken `is_published` filter on `govt_exams`, and return both the rows array and per-table counts.

**Dedup enhanced** — same `Set<string>` logic, same scope (static + SEO + DB), but now counts removals and captures first 20 examples.

**Summary sheet** inserted as sheet index 0 using a simple `aoa_to_sheet` with `[['Metric', 'Value'], ...]`.

## Risk Assessment
- Single file, no backend, no new libraries
- Pagination is a simple while-loop
- govt_exams fix removes a broken filter (can only improve)
- Dedup scope unchanged — just adds counting
- Summary sheet is purely additive

