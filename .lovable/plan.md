

# Revised Sarkari Jobs Recovery Plan

## 1. Executive Revision Summary

**What was correct in the first plan:**
- Root cause: `govt_exams` has 0 rows, `employment_news_jobs` has 1,158 published records
- All Sarkari Jobs pages query the empty `govt_exams` table
- State pages query `govt_exams` with state filter — always empty
- The fix direction of pivoting to `employment_news_jobs` is correct

**What needed revision:**
1. First plan left `/sarkari-jobs/:slug` broken for valid department slugs (railway, ssc, etc.), saying "that's correct behavior" — unacceptable
2. No differentiation strategy between 5 page families that would all query the same table
3. Department mapping was ad-hoc without confidence analysis
4. State/UT grid coverage was incomplete — no mapping table, no spelling audit, no UT coverage check
5. "No backend changes needed" was an unchecked assumption
6. No quality pass defined after functional recovery

**What changed in this revision:**
- Department slugs in `/sarkari-jobs/:slug` will be intercepted and rendered as filtered listing pages
- Each page family gets a distinct purpose, sort order, layout, and unique sections
- Full department mapping table with confidence ratings
- Full state/UT mapping table with DB-value mapping
- Architecture decision made explicit with justification
- Quality hardening sub-phase added

---

## 2. Revised Route Handling Model

### `/sarkari-jobs`
- **Component:** `SarkariJobs.tsx`
- **Change:** Switch query from `govt_exams` to `employment_news_jobs` where `status='published'`
- **Default sort:** `published_at desc`
- **Filters:** dept (via `job_category`/`org_name`), state, search
- **Cards link to:** `/jobs/employment-news/:slug`

### `/sarkari-jobs?dept=railway`
- Same component, `dept` URL param pre-selects the department filter
- Query adds appropriate `job_category`/`org_name` filter
- H1 stays "Sarkari Jobs & Government Exams", filter visually active

### `/sarkari-jobs?q=keyword`
- Same component, `q` URL param pre-fills search and triggers `ilike` on `org_name` and `post`

### `/sarkari-jobs/:slug` — CRITICAL FIX
- **Component:** `GovtExamDetail.tsx` — modify to intercept known department slugs
- **Logic:**
  1. Define a `VALID_DEPT_SLUGS` set: `{railway, ssc, banking, upsc, defence, teaching, police, psu, state}`
  2. If `slug` is in `VALID_DEPT_SLUGS` → render `SarkariJobs` component with that dept pre-selected (inline render, NOT a redirect — preserves URL for SEO)
  3. If `slug` is NOT in `VALID_DEPT_SLUGS` → try `govt_exams` lookup as before. If not found, also try `employment_news_jobs` by slug. If still not found → render NotFound component (not Navigate to /404)
- **Result:** `/sarkari-jobs/railway` renders a filtered listing page with Railway heading. `/sarkari-jobs/xyz-garbage` renders 404.
- **Files:** `GovtExamDetail.tsx` (add dept-slug detection at top), create a small shared `deptSlugs.ts` config

### `/govt-jobs-{state}`
- **Component:** `StateGovtJobsPage.tsx`
- **Change:** Switch query from `govt_exams` to `employment_news_jobs` with `state` filter
- **Mapping:** URL slug `uttar-pradesh` → `stateSlug` = `uttar pradesh` → DB `state` column value = `Uttar Pradesh` (title-cased)
- **Fallback:** If state-specific count < 3, also show all-India jobs (`state IS NULL`) clearly labeled

### `/latest-govt-jobs`
- **Component:** `LatestGovtJobs.tsx`
- **Change:** Switch from `govt_exams` to `employment_news_jobs`
- **Distinct sort:** `published_at desc` (most recently published first)
- **No filters** — pure chronological feed, limited to 40 most recent
- **Unique section:** "This Week's Highlights" showing jobs published in last 7 days with deadline badges

### `/all-sarkari-jobs`
- **Component:** `AllSarkariJobsHub.tsx`
- **Change:** Switch from `govt_exams` to `employment_news_jobs`
- **Distinct layout:** A-Z directory grouped by `org_name` first letter (already has this UI)
- **Unique value:** Complete browsable index — no pagination, loads all orgs
- **No filters needed** — this is an index/directory page

### `/jobs/employment-news`
- **Component:** `EmploymentNewsJobs.tsx`
- **NO CHANGES** — this already works correctly
- **Distinct purpose:** Source-attributed listing ("from Employment News / Rozgar Samachar")

---

## 3. Page-Family Differentiation Table

| Route Family | Purpose | Data Source | Sort | Unique Logic | Shared Logic | Duplication Risk | Prevention |
|---|---|---|---|---|---|---|---|
| `/sarkari-jobs` | Primary filterable govt jobs hub | `employment_news_jobs` | `published_at desc` | Dept + state + search filters, dept chips in hero | Card component, pagination | High vs `/jobs/employment-news` | Different hero, dept-first UX, no source branding |
| `/latest-govt-jobs` | Chronological "what's new" feed | `employment_news_jobs` | `published_at desc` | No filters, "This Week" highlight section, limited to 40 | Card component | Medium vs `/sarkari-jobs` | No filters, shorter list, editorial framing |
| `/all-sarkari-jobs` | A-Z browsable directory | `employment_news_jobs` | `org_name asc` | Grouped by letter, quick-nav alphabet bar, no pagination | None shared | Low | Completely different layout |
| `/govt-jobs-{state}` | State-specific landing | `employment_news_jobs` filtered by `state` | `published_at desc` | State intro content, state FAQs, state-specific breadcrumbs, all-India fallback | Card component | Medium vs `/sarkari-jobs` | State-specific H1/meta/content, different query |
| `/jobs/employment-news` | Source-specific listing | `employment_news_jobs` | `published_at desc` | Source attribution header, category + state filters | Card component | High vs `/sarkari-jobs` | Keep as source-branded; `/sarkari-jobs` is topic-branded |

---

## 4. Department Mapping Table

Create a shared file `src/lib/deptMapping.ts` used by both `SarkariJobs.tsx` and `GovtExamDetail.tsx`.

| Dept Slug | Matching Field(s) | Matching Rule | Weaknesses | Confidence | Future Hardening |
|---|---|---|---|---|---|
| `railway` | `job_category` | `eq('job_category', 'Railway')` | Only 3 records; low volume | High | Add `org_name ilike '%Railway%'` as OR fallback |
| `ssc` | `org_name` | `ilike '%SSC%' OR ilike '%Staff Selection%'` | No `job_category` for SSC; relies on org_name text | Medium | Add `job_category = 'SSC'` if column is enriched later |
| `banking` | `job_category` | `eq('job_category', 'Banking')` | Only 10 records | High | Stable |
| `upsc` | `org_name` | `ilike '%UPSC%' OR ilike '%Union Public Service%'` | No dedicated category | Medium | Same as SSC |
| `defence` | `job_category` | `eq('job_category', 'Defence')` | 105 records, good volume | High | Stable |
| `teaching` | `job_category` | `eq('job_category', 'Teaching')` | 78 records | High | Stable |
| `police` | `org_name` | `ilike '%Police%' OR ilike '%CRPF%' OR ilike '%BSF%' OR ilike '%CISF%' OR ilike '%ITBP%' OR ilike '%SSB%'` | No category; text matching is fragile | Low | Consider adding `job_category = 'Police'` via DB enrichment |
| `psu` | `job_category` | `eq('job_category', 'PSU')` | 190 records | High | Stable |
| `state` | `job_category` | `eq('job_category', 'State Government')` | 51 records | High | Stable |

**Shared helper function:**
```text
getDeptFilter(dept: string) → { field: string, op: 'eq' | 'ilike' | 'or', value: string }
```

This will be a single file (`src/lib/deptMapping.ts`) imported by any component needing dept filtering. This prevents logic duplication across pages.

---

## 5. State and UT Recovery Plan

### State Grid (StateQuickFilter.tsx)
Currently shows 15 states + "All States". The `stateGovtJobsData.ts` defines 37 states/UTs. The grid is a subset for the homepage.

**Grid corrections needed:** None — the StateQuickFilter grid is intentionally a curated subset (15 major states). The full list lives in `stateGovtJobsData.ts` and covers all 28 states + 8 UTs + Ladakh.

**Spelling audit of STATE_LIST (stateGovtJobsData.ts):**
All spellings are correct. Verified: Haryana ✓, Madhya Pradesh ✓, Chhattisgarh ✓, Uttarakhand ✓, Telangana ✓.

### State Slug → DB Value Mapping

The current code does: `stateSlug = slug.replace(/-/g, ' ')` → e.g. `uttar pradesh`. But `employment_news_jobs.state` stores title-cased values like `Uttar Pradesh`.

**Fix:** Title-case the `stateSlug` before querying: `state.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())`

But this breaks for `&` entries (Dadra & Nagar Haveli, Jammu & Kashmir). Need a manual override map for edge cases.

**State-to-DB mapping strategy:**

| URL Slug | stateGovtJobsData stateSlug | DB `state` value (expected) | Needs Manual Map? |
|---|---|---|---|
| `delhi` | `delhi` | `Delhi` | No (title-case works) |
| `uttar-pradesh` | `uttar pradesh` | `Uttar Pradesh` | No |
| `andhra-pradesh` | `andhra pradesh` | `Andhra Pradesh` | No |
| `jammu-kashmir` | `jammu kashmir` | `Jammu & Kashmir` OR `J&K` | Yes |
| `dadra-nagar-haveli` | `dadra nagar haveli` | `Dadra & Nagar Haveli` | Yes |
| `daman-diu` | `daman diu` | `Daman & Diu` | Yes |

**Fix:** Add a `STATE_DB_OVERRIDES` map in `stateGovtJobsData.ts` for the 3 special cases. For all others, use `titleCase(stateSlug)`.

**Fallback rules:**
- If state-specific query returns < 3 results → also fetch jobs where `state IS NULL` (central/all-India jobs) and show them in a separate "All-India Opportunities" section below state-specific results
- Never show ONLY the fallback — always show the state-specific section first (even if empty with "No state-specific jobs found currently")
- Never make the fallback section look like state-specific content

**Validation checklist per state:**
1. Route `/govt-jobs-{slug}` resolves to `StateGovtJobsPage`
2. Config exists in `stateGovtJobsData.ts`
3. DB query uses correct title-cased state name
4. Page renders with state-specific H1, breadcrumbs, intro
5. If 0 state jobs, all-India fallback shows with clear label

---

## 6. Architecture Decision

**Recommendation: Frontend-only with one shared utility file.**

**Justification:**
- The department mapping logic is the only duplicated piece. It can live in `src/lib/deptMapping.ts` — a single shared file.
- State mapping already lives in `stateGovtJobsData.ts` — just needs the DB override map added.
- No backend RPC or view is needed because `employment_news_jobs` already has the right columns (`job_category`, `org_name`, `state`) and RLS allows public read of published rows.
- The queries are simple `eq`/`ilike` filters — no joins, no aggregation.

**Where frontend-only could become brittle:**
- If department classification needs to be updated frequently (new orgs, new categories), editing a frontend file requires a deploy. But this is acceptable for a medium-level site.
- If `employment_news_jobs` grows past 5,000 rows, some queries (especially `ilike` on `org_name`) could slow down. But at 1,158 rows this is not a concern.

**What would justify backend work:**
- If a normalized `department` column were added to `employment_news_jobs` via a DB migration + trigger, the frontend mapping would become unnecessary. This is a FUTURE optimization, not needed now.

**Minimum-change safe architecture:**
1. `src/lib/deptMapping.ts` — shared department filter helper
2. Frontend query changes in 4 files
3. Route interception in `GovtExamDetail.tsx`
4. State DB override map in `stateGovtJobsData.ts`

---

## 7. Revised Phased Implementation Plan

### Phase 2A: Route Unification and Department Slug Fix

**Objective:** Make all `/sarkari-jobs/*` routes functional. No route shows "Exam Not Found" for valid departments.

**Files:**
- Create `src/lib/deptMapping.ts` (new)
- Modify `src/pages/jobs/GovtExamDetail.tsx`

**Logic changes:**
1. Create `deptMapping.ts` with:
   - `VALID_DEPT_SLUGS` set
   - `DEPT_CONFIG` map: slug → `{ label, filterFn }` where filterFn builds the Supabase query filter
   - `getDeptLabel(slug)` helper
2. In `GovtExamDetail.tsx`:
   - Import `VALID_DEPT_SLUGS` from `deptMapping.ts`
   - At top of component, before any fetch: if `slug` is in `VALID_DEPT_SLUGS`, render a `<DeptListingView dept={slug} />` instead of the exam detail view
   - `DeptListingView` is a lightweight wrapper that renders `SarkariJobs`-style filtered listing with dept-specific H1 and meta
   - For non-dept slugs: keep existing `govt_exams` lookup, but add a fallback to `employment_news_jobs` by slug
   - If both fail → render `<NotFound />` component directly (not `Navigate`)

**Risk level:** Medium — modifies a route handler, but changes are additive (dept detection is checked first, existing logic is fallback).

**Verification:**
- `/sarkari-jobs/railway` → shows Railway govt jobs listing
- `/sarkari-jobs/ssc` → shows SSC jobs
- `/sarkari-jobs/nonexistent` → shows 404
- `/sarkari-jobs?dept=defence` → still works as before

**Rollback:** Remove the dept-slug check from `GovtExamDetail.tsx`; delete `deptMapping.ts`.

---

### Phase 2B: Data Pipeline Recovery

**Objective:** All Sarkari Jobs listing pages show real `employment_news_jobs` data instead of empty `govt_exams`.

**Files:**
- `src/pages/jobs/SarkariJobs.tsx` — major rewrite of query
- `src/pages/jobs/LatestGovtJobs.tsx` — major rewrite of query
- `src/pages/seo/AllSarkariJobsHub.tsx` — major rewrite of query

**Logic changes per file:**

**SarkariJobs.tsx:**
- Replace `govt_exams` query with `employment_news_jobs` where `status='published'`
- Replace `department_slug` filter with `getDeptFilter()` from `deptMapping.ts`
- Replace `exam_name` search with `or(org_name.ilike, post.ilike)`
- Add state filter dropdown
- Update card rendering: `org_name` as title, `post` as subtitle, `vacancies`, `salary`, `last_date_resolved`, `state`, `job_category`
- Card links → `/jobs/employment-news/${slug}`
- Update `DEPT_OPTIONS` to use `deptMapping.ts` config
- Remove `STATUS_OPTIONS` (employment_news_jobs only has `published` visible)
- Update URL param sync: `setSearchParams` on filter change

**LatestGovtJobs.tsx:**
- Replace `govt_exams` query with `employment_news_jobs` ordered by `published_at desc`, limit 40
- Remove pagination (this is a "latest" feed, not a browsable list)
- Add "Published This Week" highlight badge on recent items
- Card links → `/jobs/employment-news/${slug}`

**AllSarkariJobsHub.tsx:**
- Replace `govt_exams` query with `employment_news_jobs`
- Group by `org_name` first letter instead of `exam_name`
- Update card rendering to use employment_news fields
- Card links → `/jobs/employment-news/${slug}`

**Risk level:** Medium — changing data source for 3 pages, but all are currently showing 0 results so there's nothing to break.

**Verification:**
- `/sarkari-jobs` shows 1,158 published jobs
- `/sarkari-jobs?dept=defence` shows ~105 results
- `/latest-govt-jobs` shows recent jobs
- `/all-sarkari-jobs` shows A-Z index of orgs

**Rollback:** Revert query changes in each file.

---

### Phase 2C: State/UT Page Repair

**Objective:** All state pages show real state-relevant jobs from `employment_news_jobs`.

**Files:**
- `src/pages/seo/StateGovtJobsPage.tsx` — query change
- `src/pages/seo/stateGovtJobsData.ts` — add DB override map

**Logic changes:**

**stateGovtJobsData.ts:**
- Add `STATE_DB_NAME_MAP`: `Record<string, string>` for edge cases (`jammu-kashmir` → `Jammu & Kashmir`, etc.)
- Add a `getStateDBName(stateSlug: string): string` function that checks the override map first, falls back to `titleCase(stateSlug)`
- Export this function

**StateGovtJobsPage.tsx:**
- Import `getStateDBName` from `stateGovtJobsData.ts`
- Replace `govt_exams` query with:
  ```
  .from('employment_news_jobs')
  .select('id, org_name, post, slug, vacancies, state, last_date, last_date_resolved, salary, job_category, published_at')
  .eq('status', 'published')
  .eq('state', getStateDBName(config.stateSlug))
  .order('published_at', { ascending: false })
  .limit(50)
  ```
- Add a second query for all-India fallback (where `state IS NULL`), limited to 10, only shown if state-specific count < 3
- Update card rendering and links → `/jobs/employment-news/${slug}`
- Keep existing intro content, FAQs, enrichment overlay, quick links

**Risk level:** Low-Medium — state pages currently show 0 jobs, so any change is an improvement.

**Verification per state family:**
- `/govt-jobs-delhi` → shows Delhi jobs (expected ~212)
- `/govt-jobs-uttar-pradesh` → shows UP jobs (expected ~58)
- `/govt-jobs-goa` → shows Goa jobs (expected ~10) + all-India fallback if < 3
- `/govt-jobs-sikkim` → likely 0 state jobs → shows all-India fallback section

**Rollback:** Revert the 2 file changes.

---

### Phase 2D: Page-Family Differentiation

**Objective:** Ensure the 4 pages querying `employment_news_jobs` feel distinct, not like clones.

**Files:**
- `src/pages/jobs/SarkariJobs.tsx` — add dept hero chips, state filter
- `src/pages/jobs/LatestGovtJobs.tsx` — add "this week" highlight, remove pagination
- `src/pages/seo/AllSarkariJobsHub.tsx` — keep directory layout, update grouping
- `src/pages/seo/StateGovtJobsPage.tsx` — keep state-specific editorial sections

**Differentiation rules:**

| Element | SarkariJobs | LatestGovtJobs | AllSarkariJobsHub | StateGovtJobs |
|---|---|---|---|---|
| H1 | "Sarkari Jobs & Government Exams" | "Latest Government Jobs 2026" | "All Sarkari Jobs — A to Z" | "Government Jobs in {State} 2026" |
| Filters | Dept + State + Search | None | Search only | None |
| Sort | User-selectable | Published date desc (fixed) | Alphabetical (fixed) | Published date desc (fixed) |
| Pagination | Yes (20/page) | No (40 max) | No (full list) | No (50 max) |
| Unique section | Dept chips in hero | "This Week" badges | Alphabet quick-nav | State intro, FAQ, enrichment |
| Card link target | `/jobs/employment-news/:slug` | Same | Same | Same |

**Risk level:** Low — purely UI/layout differentiation.

**Verification:** Open all 4 pages side by side and confirm visually distinct experience.

---

### Phase 2E: Quality Hardening

**Objective:** Polish headings, empty states, breadcrumbs, and internal links after functional recovery.

**Files:** All 4 modified listing pages + `GovtExamDetail.tsx`

**Checklist:**
1. **Headings:** Each page has a unique, descriptive H1. Department sub-views have "Railway Government Jobs 2026" style H1.
2. **Intro blocks:** `/sarkari-jobs` gets a 2-line intro. `/latest-govt-jobs` gets a "freshness" framing. State pages keep their editorial intros.
3. **Result count:** Show "{N} government jobs found" after loading, "{N} Railway jobs found" for dept filter.
4. **Narrow-filter fallback:** When a dept or state filter returns 0, show: "No {dept} jobs found currently. Browse all government jobs →" with link to `/sarkari-jobs`.
5. **Card consistency:** All cards show: org_name (bold), post, vacancies, salary, state, last_date. Consistent across all listing pages.
6. **Breadcrumbs:** SarkariJobs: Home > Sarkari Jobs. Dept sub-view: Home > Sarkari Jobs > Railway. State: Home > Sarkari Jobs > Delhi.
7. **Internal links:** Each listing page has a "Related" section linking to 3-4 sibling pages.
8. **URL sync:** Filter changes update URL params. Browser refresh preserves filter state.
9. **Mobile:** Verify filter dropdowns work on mobile viewports.

**Risk level:** Low — cosmetic improvements.

**Verification:** Manual review of each page on desktop and mobile.

---

## 8. Strict Non-Negotiables

1. No `/sarkari-jobs/:slug` route may show "Exam Not Found" for any of the 9 valid department slugs.
2. No listing page may show 0 results when `employment_news_jobs` has matching published data.
3. No two page families may have identical H1, meta title, or layout.
4. No state page may query the empty `govt_exams` table after implementation.
5. Department mapping logic must live in ONE shared file, not be duplicated.
6. Card links must point to `/jobs/employment-news/:slug` (the working detail page), never to `/sarkari-jobs/:slug` for employment news records.
7. State name mapping must handle `&` characters (J&K, D&NH, Daman & Diu) via explicit override map.
8. Empty-state messaging must be contextual ("No Railway jobs found currently") not generic ("No results").
9. All filter changes must sync to URL params so browser refresh preserves state.
10. The existing working `/jobs/employment-news` page must not be modified or broken.

