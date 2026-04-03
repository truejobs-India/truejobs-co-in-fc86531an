

# Full-Site AdSense Revenue Optimization & Rendering Stability (Corrected)

## Corrections Applied

### Correction 1: Accurate unique file count

The previous plan listed 32 files changed but double-counted `src/components/resources/ResourceListing.tsx` (once in the main list at #32, and again separately as "File 32 (indirect)"). The true unique file count is **31 files**. All summary tables and counts below reflect this corrected total.

### Correction 2: Robust AdSense readiness strategy

The previous plan described checking whether `window.adsbygoogle` is a "real initialized array (not just [] from our own fallback)." This is brittle and vague. The corrected readiness strategy is a multi-signal gate:

**Before calling `adsbygoogle.push({})`, ALL of the following must be true:**

1. **Script presence**: The AdSense `<script>` element with `src` containing `adsbygoogle.js` or `adsbygoogle` actually exists in the DOM (not just our own `window.adsbygoogle = []` fallback).
2. **Container width**: `adRef.current.offsetWidth > 0` — the `<ins>` element has measurable rendered width, meaning it is not inside a hidden, collapsed, or zero-width parent.
3. **Document visibility**: `document.visibilityState === 'visible'` — the page tab is active and visible.

**If any condition fails**: Retry up to 3 times at 1-second intervals via `setTimeout`. After 3 failures, stop silently (do not throw, do not log in production).

**Dev-mode logging**: In non-production, emit `console.debug` with variant, pathname, container width, script-present status, visibility state, and outcome (pushed / retrying / gave up).

This replaces the single array-type check with a defensible multi-signal approach.

---

## Root Causes

**1. AdPlaceholder.tsx has 3 critical bugs:**
- `adsbygoogle.push({})` fires immediately on mount without any readiness checks.
- `adRef` is attached to `<ins>` but never read — no container validation.
- Line 105: `config.format === 'fluid' ? 'fluid' : 'auto'` means banner (config `horizontal`) and sidebar (config `auto`) both render as `data-ad-format="auto"` in the DOM. The intended format values are never used. Auto-format in narrow containers collapses to zero height.

**2. Severe under-monetization:**
- Homepage: 1 manual ad. No sidebar, no in-content.
- 28 listing/SEO pages: 1 banner each.
- BlogCategory: 0 ads.
- GovtExamDetail (long high-intent page): 1 banner.

---

## Technical Changes

### File 1: `src/components/ads/AdPlaceholder.tsx`

**Format fix**: Replace line 105 logic. Use the config format value directly in `data-ad-format`:
- banner → `"horizontal"`, sidebar → `"vertical"` (change config from `auto` to `vertical`), footer → `"horizontal"`, in-content → `"fluid"` (unchanged)

**Multi-signal readiness gate**: Before `push({})`:
1. Check script presence: `document.querySelector('script[src*="adsbygoogle"]') !== null`
2. Check container width: `adRef.current?.offsetWidth > 0`
3. Check visibility: `document.visibilityState === 'visible'`
4. If any fails, retry (max 3, 1s apart)

**Dev logging**: `console.debug` in non-production with variant, pathname, width, script-present, visibility, outcome.

**Preserved**: noAds context, domain safety, pushed ref, AdLabel, all slot IDs.

### File 2: `src/pages/Index.tsx`

Wrap content below hero in `lg:grid-cols-[1fr_300px]` grid. Left column: all existing sections. Right column: sticky sidebar ad (hidden below `lg`). Add 2 `in-content` ads (after LatestGovtJobs, after InfoCardsRow). Keep existing banner.

### Files 3–30: Add `in-content` ads to 28 pages

Each gets 1 `<AdPlaceholder variant="in-content" />` at a natural content break:

| # | File | Position |
|---|------|----------|
| 3 | SarkariJobs.tsx | After job cards, before PopularExamsBlock |
| 4 | LatestGovtJobs.tsx | After job cards |
| 5 | Jobs.tsx | After job listings grid |
| 6 | PrivateJobs.tsx | After job listings |
| 7 | Notifications.tsx | After notification cards |
| 8 | EmploymentNewsJobs.tsx | After job cards |
| 9 | Blog.tsx | After blog post grid |
| 10 | Companies.tsx | After company cards |
| 11 | GovtExamDetail.tsx | After Selection Process, before FAQ |
| 12 | ExamClusterHub.tsx | After subtopic grid, before FAQ |
| 13 | ExamAuthorityPage.tsx | After main content |
| 14 | BoardResultStatePage.tsx | After results content |
| 15 | BoardResultBoardPage.tsx | After results content |
| 16 | ResourceHub.tsx | After resource cards |
| 17 | ResourceDownload.tsx | After download content |
| 18 | ResourceListing.tsx (shared) | After listing grid — propagates to SamplePapers, Books, PreviousYearPapers, Guides |
| 19 | StateGovtJobsPage.tsx | After job listings |
| 20 | DepartmentJobsPage.tsx | After main content |
| 21 | GovtComboPage.tsx | After listings |
| 22 | GovtSelectionPage.tsx | After main content |
| 23 | CategoryJobsPage.tsx | After listings |
| 24 | CityJobsPage.tsx | After listings |
| 25 | QualificationJobsPage.tsx | After listings |
| 26 | IndustryJobsPage.tsx | After listings |
| 27 | CustomLongTailPage.tsx | After listings |
| 28 | DeadlineJobsPage.tsx | After listings |
| 29 | TodayJobsPage.tsx | After listings |
| 30 | AllSarkariJobsHub.tsx | After listings |

### File 31: `src/pages/blog/BlogCategory.tsx`

Add 1 `<AdPlaceholder variant="banner" />` after category header, before posts grid. Currently has 0 ads.

---

## Pages Intentionally Unchanged

| Page(s) | Current ads | Reason category |
|---------|-------------|-----------------|
| BlogPost.tsx | 3 (banner+in-content+sidebar) | Already sufficient |
| CompanyDetail.tsx | 3 | Already sufficient |
| ResourceDetail.tsx | 3 | Already sufficient |
| JobDetail.tsx | 2 (banner+in-content) | Already sufficient |
| EmploymentNewsJobDetail.tsx | 2 | Already sufficient |
| PremiumResultLanding.tsx | 2 | Already sufficient |
| 13 Tool pages | 1 banner each | UX risk — interactive tools |
| Tools.tsx (index) | 1 banner | Thin content |
| 6 Legal pages | 1 banner each | Policy/trust |
| 3 Insurance pages | 1 banner each | Thin content |
| NearMeJobPage.tsx | 1 banner | Thin content |
| EnrolNow.tsx | 0 | Conversion sensitivity |
| ThankYou.tsx | 0 | Conversion sensitivity |
| NotFound.tsx | 0 | Technical inappropriateness |
| Offline.tsx | 0 | Technical inappropriateness |
| All admin/auth pages | 0 | noAds protection |

---

## Summary

| Metric | Before | After |
|--------|--------|-------|
| **Unique files changed** | — | **31** |
| Homepage manual ads | 1 | 4 |
| Pages with 0 public ads | 1 (BlogCategory) | 0 |
| AdPlaceholder format bug | Active | Fixed |
| Readiness strategy | None | Multi-signal gate with 3 retries |
| Public pages left unreviewed | — | 0 |

