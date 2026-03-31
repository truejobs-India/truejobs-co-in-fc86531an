

# Fix DepartmentJobsPage — Pivot from `govt_exams` to `employment_news_jobs`

## Problem
`DepartmentJobsPage.tsx` (serving `/ssc-jobs`, `/railway-jobs`, `/banking-jobs`, `/defence-jobs`, `/upsc-jobs`) queries the empty `govt_exams` table. All 5 pages show zero results despite 1,158+ published jobs in `employment_news_jobs`.

## Single File Change: `src/pages/seo/DepartmentJobsPage.tsx`

### What changes

**1. Import `DEPT_CONFIG` from `deptMapping.ts`** — reuse existing department filter logic (same filters already working in `SarkariJobs.tsx`).

**2. Replace query (lines 25-37):**
- Table: `govt_exams` → `employment_news_jobs`
- Columns: `exam_name, conducting_body, total_vacancies, application_end` → `org_name, post, vacancies, last_date_resolved`
- Filter: custom `.or()` on `department_slug`/`exam_category` → `DEPT_CONFIG[deptKey].applyFilter(query)` + `.eq('status', 'published')`
- Sort: `updated_at` → `published_at`
- Query key: `dept-govt-exams` → `dept-employment-jobs`

**3. Update card rendering (lines 107-148):**
- `exam.exam_name` → `job.org_name` (card title — shows organization name)
- `exam.conducting_body` → `job.post` (subtitle — shows post/position name)
- `exam.total_vacancies` → `job.vacancies`
- `exam.application_end` → `job.last_date_resolved`
- Link: `/sarkari-jobs/${exam.slug}` → `/jobs/employment-news/${job.slug}`
- Variable names: `exams` → `jobs`, `exam` → `job`

**4. Headings** — no change needed. `Latest {config.department} Recruitment Notifications` correctly uses department name from `departmentJobsData.ts` config (SSC, Railway, Banking, Defence, UPSC). These match the `deptKey` values in `DEPT_CONFIG`.

**5. Empty-state** — no change needed. Already shows `No {config.department} recruitment notifications found at this time. Check back soon!` which is department-contextual.

**6. deptKey mapping verification:**

| Page slug | `config.deptKey` | `DEPT_CONFIG` key | Filter logic |
|---|---|---|---|
| `ssc-jobs` | `ssc` | `ssc` | `org_name.ilike.%SSC%,org_name.ilike.%Staff Selection%` |
| `railway-jobs` | `railway` | `railway` | `job_category.eq.Railway,org_name.ilike.%Railway%` |
| `banking-jobs` | `banking` | `banking` | `job_category.eq.Banking` |
| `defence-jobs` | `defence` | `defence` | `job_category.eq.Defence` |
| `upsc-jobs` | `upsc` | `upsc` | `org_name.ilike.%UPSC%,org_name.ilike.%Union Public Service%` |

All 5 `deptKey` values match keys in `DEPT_CONFIG` exactly. No mapping gap.

## Verification checklist

- **Headings**: `h1` and `h2` still use `config.department` (SSC, Railway, etc.) — unchanged, correct
- **Links**: All job cards point to `/jobs/employment-news/:slug` — the working detail page
- **Empty state**: Uses `config.department` for contextual messaging — unchanged, correct
- **No field duplication**: `org_name` → title, `post` → subtitle, `vacancies` → count, `last_date_resolved` → deadline badge — clean 1:1 mapping, no repeated data
- **Closing-soon badge**: Works with `last_date_resolved` (date type) same as `application_end` was

## Risk
Low. Identical pattern to what `SarkariJobs.tsx` already uses successfully. Same table, same `DEPT_CONFIG` filters, same column mapping.

