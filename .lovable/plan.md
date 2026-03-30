

# Complete Website URL Export for GSC

## Summary

Create a new "Export All Site URLs" button in the GSC section that generates a multi-sheet Excel file containing every URL on the website — static pages, programmatic SEO pages, and database-driven dynamic pages (blog posts, job listings, company pages, govt exams, employment news, custom pages, resources). Each URL is categorized by page type, index status, and priority.

## What Gets Included

### Sheet 1: Static & Core Pages (~20 URLs)
Homepage, /jobs, /private-jobs, /sarkari-jobs, /latest-govt-jobs, /jobs/employment-news, /blog, /companies, /tools, /sample-papers, /books, /previous-year-papers, /guides, /free-guides, legal pages (/privacypolicy, /termsofuse, /aboutus, /contactus, /disclaimer, /editorial-policy), tool pages (/govt-job-age-calculator, /percentage-calculator, /govt-salary-calculator, /photo-resizer, /image-resizer, /pdf-tools, /typing-test-for-government-exams, /govt-exam-eligibility-checker, /govt-exam-fee-calculator, /govt-exam-calendar), campaign pages (/enrol-now, /thankyou)

### Sheet 2: Programmatic SEO Pages (all from data files)
- SEO City pages (CITY_JOBS_DATA)
- Category pages (CATEGORY_JOBS_DATA)
- Industry pages (INDUSTRY_JOBS_DATA)
- Near Me pages (NEAR_ME_PAGES)
- Insurance State/City pages (INSURANCE_STATES, INSURANCE_CITIES)
- State Govt Job pages (getAllStateGovtSlugs)
- Department pages (getAllDepartmentSlugs)
- Qualification pages (getAllQualificationSlugs)
- Deadline pages (getAllDeadlineSlugs)
- Today pages (TODAY_PAGES — exported as getAllTodaySlugs)
- Combo pages (getAllComboSlugs)
- Custom long-tail pages (getAllCustomLongTailSlugs)
- Selection pages (govt-jobs-without-exam + permutations)
- Exam authority pages (getAllExamAuthoritySlugs)
- Hub pages (getAllHubSlugs)
- Previous year paper pages (getAllPYPSlugs)
- All Sarkari Jobs hub (/all-sarkari-jobs)

### Sheet 3: Database-Driven Pages (fetched from Supabase at export time)
- Published blog posts → /blog/{slug}
- Active jobs → /jobs/{id}
- Companies → /companies/{slug}
- Published govt exams → /sarkari-jobs/{slug}
- Published employment news → /jobs/employment-news/{slug}
- Published custom pages → /{slug}
- Published resources → /sample-papers/{slug}, /books/{slug}, /previous-year-papers/{slug}, /guides/{slug}
- Board result pages → /results/{state}, /results/{state}/{board}

### Sheet 4: Excluded Pages (for reference)
- /admin, /dashboard, /login, /signup, /phone-signup, /forgot-password, /profile, /employer/*, /offline, /tools/resume-checker, /tools/resume-builder (app-only tools)

### Sheet 5: Sitemaps
- All 6 sitemap URLs

## Columns Per Row
URL, Page Type, Category (Static/SEO/Dynamic/Excluded), Index Status, Sitemap Child, Priority, Notes

## Technical Details

### Files Changed
1. **`src/components/admin/GSCUrlExport.tsx`** — Add a second "Export All URLs" button that triggers the comprehensive export. Add `getAllTodaySlugs` export to TodayJobsPage first.

2. **`src/pages/seo/TodayJobsPage.tsx`** — Add missing `getAllTodaySlugs()` export function.

3. **`src/pages/seo/selectionPageData.ts`** — Add `getAllSelectionSlugs()` export that generates all valid selection page slugs from the known permutations of departments, qualifications, and states.

### Export Flow
- Static + SEO pages: built synchronously from imported data arrays and `getAll*Slugs()` functions
- DB pages: fetched via Supabase queries (blog_posts, jobs, companies, govt_exams, employment_news_jobs, custom_pages, pdf_resources, board results state/board combos)
- Button shows loading state during DB fetch
- Output: multi-sheet .xlsx with column widths pre-set

### Safety
- Excluded pages clearly marked as noindex
- Deduplication by URL before writing
- DB queries use `.select('slug')` with appropriate filters (is_published, status = 'active', etc.) to minimize payload

