

# Plan Tightening Note — Pre-Implementation

## What Must Be Tightened

### 1. Job-Detail CTA
- Status changed from "no action needed" to: **implementation present, verification pending**
- Final verification report must explicitly confirm CTA presence, canonical destinations, and alert behavior across `GovtExamDetail`, `EmploymentNewsJobDetail`, and `JobDetail`
- Not silently closed — remains in verification checklist

### 2. Download / Free-Guide Flow
- Status changed from "no code fix needed" to: **no code change planned unless live verification reveals failure**
- Remains **live-verification pending** — not closed from code inspection alone
- If `file_url` data is missing for any resource family, report as data/content dependency honestly

### 3. Thin-Family Noindex Logic
- `noindex` applies **only when query returns zero published results and no active search/filter**
- Families with real content (e.g., `/sample-papers` with populated records) must NOT be noindexed
- Implementation: `noindex={results.length === 0 && !hasActiveFilters}` — condition-based, never family-wide

### 4. Companies Family
- Protection extends beyond listing page to **company detail pages**
- `CompanyDetail.tsx` must also get conditional noindex when: zero active jobs AND minimal company info (no description, no logo)
- Both listing and detail thinness are addressed

### 5. Sitemap Fix Path — Decision Made
- **Chosen route: Hardcode dept slugs into `dynamic-sitemap` edge function's `sitemap-pages.xml` generator**
- Reason: Dept slugs are a known fixed set (`VALID_DEPT_SLUGS` — 9 values). They don't change dynamically. Hardcoding is simpler, faster, has zero cache dependency, and avoids requiring admin cache-build runs to include them
- The `seo_page_cache` path would work but adds unnecessary operational overhead for 9 static URLs

### 6. SSC Issue
- Filter widening (`job_category.eq.SSC` addition) is a **technical mitigation attempt only**
- Full closure depends on whether SSC-tagged records actually exist in `employment_news_jobs`
- If zero records match even after widening, this is a **data population gap** — will be reported honestly, not overclaimed as fixed

## What Remains Implementation-Ready

- Duplicate title suffix fix (10 files) — straightforward, verified
- Auth page noindex (4 files) — straightforward
- `index.html` OG tag neutralization — straightforward
- `SEO.tsx` DEFAULT_TITLE alignment and double-suffix guard — ready
- `ResourceSEO.tsx` explicit robots meta — ready
- `ResourceListing.tsx` conditional noindex (with tightened condition) — ready
- `Companies.tsx` listing + detail conditional noindex — ready
- `deptMapping.ts` police SSB fix and SSC filter widening — ready
- `stateGovtJobsData.ts` UT copy fix — ready
- `dynamic-sitemap` dept slug hardcode — ready
- AdSense: footer ad suppression on empty listings — ready; Auto Ads = dashboard dependency (documented)

## What Must Stay Verification-Dependent

1. Job-detail CTA — live confirmation of all 3 families
2. Download flow — live test of actual file downloads across `/books`, `/sample-papers`, `/previous-year-papers`
3. SSC data — whether records exist post-filter-widening
4. Thin families — whether `/books`, `/previous-year-papers` currently have real published content or are genuinely empty
5. Company detail thinness — data-dependent assessment

## Plan Ready?

**Yes — ready for implementation after these 6 tightenings are accepted.** No structural changes to the plan, only precision improvements to closure language and condition logic.

