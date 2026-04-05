

# Final Universal Ad Coverage Implementation

## Root Causes

1. **Retry timeout leak** in `AdPlaceholder.tsx`: Recursive `setTimeout` inside `initAd` is never cleaned up on unmount — only the initial stagger timer is cleared. Stale retries can corrupt the AdSense queue.
2. **Only 5 pages have sidebar ads** out of ~35+ public page families. The remaining 30 pages use single-column layouts (often with `max-w-4xl`) that waste the right rail on desktop.
3. **No top banner** on the homepage near the fold.
4. **JobDetail.tsx** already has `lg:grid-cols-3` with a sidebar column but no `AdPlaceholder variant="sidebar"` in it.

## Left Sidebar Assessment — Template by Template

Every current template was evaluated for a 3-column layout (`300px | content | 300px`). On a 1280px viewport with container padding, this leaves ~580px for content.

| Template family | Left sidebar safe? | Reason |
|---|---|---|
| Homepage | No | Already 3-col hero + 2-col content/sidebar. Left sidebar = 4 columns, content collapses to ~400px |
| JobDetail | No | Already `lg:grid-cols-3` with sidebar. Adding left = 4 cols |
| GovtExamDetail | No | Dense data grids (`grid-cols-2 md:grid-cols-4`) need width |
| EmploymentNewsJobDetail | No | Internal `grid-cols-2` data grids would collapse |
| BlogPost | No | Already `lg:grid-cols-3` with TOC sidebar |
| Blog index / BlogCategory | No | Card grid (`md:grid-cols-2`) needs ~300px per card minimum; left+right sidebars = cards at ~250px |
| SEO listing pages (12) | No | Job card grids (`md:grid-cols-2`) collapse to single-column at 580px content width |
| Companies listing | No | Card grid (`md:grid-cols-2 lg:grid-cols-3`) needs full width |
| ResourceHub | No | 3-col card grid (`sm:grid-cols-2 lg:grid-cols-3`) requires width |
| Board result pages | No | Data tables and prose content need ~600px minimum |
| Jobs.tsx | No | Already has a 264px filter sidebar; adding left = 3 sidebars |
| SarkariJobs / LatestGovtJobs / PrivateJobs | No | Card grids (`md:grid-cols-2`) collapse |
| Tool pages | No | Interactive tools need full width for inputs/outputs |
| Legal pages | No | Low content density; dual sidebars would overwhelm text |
| Insurance / NearMe pages | No | Short pages; sidebar would be taller than content |

**Conclusion**: Left sidebar is not safely implementable on any current template. Every page uses internal multi-column card grids, data tables, or prose layouts that require >600px content width. A left sidebar would reduce content to ~580px, causing `md:grid-cols-2` card grids to collapse to single-column on desktop — defeating the purpose of the grid layout.

## Plan

### 1. Fix AdPlaceholder retry cleanup (stronger version)

**File**: `src/components/ads/AdPlaceholder.tsx`

- Add `timerIds` ref (array) to track every `setTimeout` return value
- Add `abortRef` to prevent execution after unmount
- In cleanup: iterate and `clearTimeout` all tracked timers, set abort flag
- On `push({})` catch: schedule one controlled retry (also tracked), only if not already retried
- Check `abortRef.current` at top of every `initAd` call

### 2. Add true top banner on homepage

**File**: `src/pages/Index.tsx`

Insert `<AdPlaceholder variant="banner" />` in a container div immediately after the hero section, before the main content grid.

### 3. Add sidebar ad to JobDetail

**File**: `src/pages/jobs/JobDetail.tsx`

Add `<AdPlaceholder variant="sidebar" />` below the existing Apply/Company cards in the sidebar column (the `lg:grid-cols-3` third column). No layout change needed — the column already exists.

### 4. Convert single-column pages to content + right sidebar

For each page below: remove `max-w-4xl` (or similar constraint), wrap the main content area in `lg:grid-cols-[1fr_300px]` grid, place existing content in left column, add `hidden lg:block` sticky sidebar with `<AdPlaceholder variant="sidebar" />` on the right.

**Content/detail pages (8 files):**

| File | Current constraint |
|---|---|
| `GovtExamDetail.tsx` | No max-w, single-column |
| `EmploymentNewsJobDetail.tsx` | `max-w-4xl` |
| `Blog.tsx` | `max-w-4xl` |
| `BlogCategory.tsx` | `max-w-4xl` |
| `Companies.tsx` | No max-w, single-column |
| `ResourceHub.tsx` | No max-w, single-column |
| `ResourceDownload.tsx` | `max-w-3xl` |
| `EmploymentNewsJobs.tsx` | No max-w, single-column |

**SEO pages (12 files):**

| File | Current constraint |
|---|---|
| `StateGovtJobsPage.tsx` | `max-w-4xl` |
| `CategoryJobsPage.tsx` | `max-w-4xl` |
| `CityJobsPage.tsx` | `max-w-4xl` |
| `DeadlineJobsPage.tsx` | No max-w |
| `TodayJobsPage.tsx` | `max-w-4xl` |
| `GovtComboPage.tsx` | `max-w-4xl` |
| `GovtSelectionPage.tsx` | `max-w-4xl` |
| `AllSarkariJobsHub.tsx` | No max-w |
| `DepartmentJobsPage.tsx` | `max-w-4xl` |
| `IndustryJobsPage.tsx` | `max-w-4xl` |
| `QualificationJobsPage.tsx` | `max-w-4xl` |
| `CustomLongTailPage.tsx` | `max-w-4xl` |

**Listing pages (4 files):**

| File | Current constraint |
|---|---|
| `SarkariJobs.tsx` | No max-w |
| `LatestGovtJobs.tsx` | No max-w |
| `PrivateJobs.tsx` | No max-w |
| `Notifications.tsx` | No max-w |

**Other content pages (4 files):**

| File | Current constraint |
|---|---|
| `ExamAuthorityPage.tsx` | `max-w-4xl` |
| `ExamClusterHub.tsx` | `max-w-4xl` |
| `BoardResultBoardPage.tsx` | `max-w-4xl` |
| `BoardResultStatePage.tsx` | `max-w-4xl` |

### Pages where right sidebar is NOT added

| Page | Reason |
|---|---|
| `Jobs.tsx` | Already has a 264px filter sidebar; adding ad sidebar = cramped 3-panel layout |
| `PremiumResultLanding.tsx` | Renders without `<Layout>` wrapper; article-only page with max-w-4xl prose. Adding sidebar requires restructuring the component to use Layout first |
| 14 tool pages | Interactive tools need full width for input areas, canvases, file pickers |
| 6 legal pages | Low-density text pages; sidebar would overwhelm the content and reduce trust |
| 3 insurance pages | Short niche landing pages; sidebar taller than content |
| `NearMeJobPage.tsx` | Short dynamic page; sidebar taller than content |

### 5. Auto Ads / Anchor / Vignette verification

The AdSense script in `index.html` uses the standard `adsbygoogle.js?client=ca-pub-...` URL which supports Auto Ads including anchor and vignette. Script loads only once, gated by hostname. Nothing in code blocks Auto Ads. These formats are controlled entirely in the AdSense dashboard — no code change needed or possible.

---

## Files Changed Summary

| # | File | Change |
|---|---|---|
| 1 | `AdPlaceholder.tsx` | Track all timer IDs, clear all on cleanup, abort ref, one-shot retry on push error |
| 2 | `Index.tsx` | Add top banner after hero |
| 3 | `JobDetail.tsx` | Add sidebar ad in existing right column |
| 4–7 | `GovtExamDetail.tsx`, `EmploymentNewsJobDetail.tsx`, `Blog.tsx`, `BlogCategory.tsx` | Convert to 2-col + sidebar |
| 8–11 | `Companies.tsx`, `ResourceHub.tsx`, `ResourceDownload.tsx`, `EmploymentNewsJobs.tsx` | Convert to 2-col + sidebar |
| 12–23 | 12 SEO pages | Remove max-w-4xl, convert to 2-col + sidebar |
| 24–27 | `SarkariJobs.tsx`, `LatestGovtJobs.tsx`, `PrivateJobs.tsx`, `Notifications.tsx` | Convert to 2-col + sidebar |
| 28–31 | `ExamAuthorityPage.tsx`, `ExamClusterHub.tsx`, `BoardResultBoardPage.tsx`, `BoardResultStatePage.tsx` | Convert to 2-col + sidebar |

**Total: 31 files**

## Expected Ad Visibility

| Placement | Desktop | Mobile |
|---|---|---|
| Top banner (homepage) | Yes | Yes |
| Banner (all pages) | Yes | Yes |
| In-content (all pages) | Yes | Yes |
| Right sidebar (29 page families, up from 5) | Yes | Hidden |
| Footer (global via Layout) | Yes | Yes |
| Left sidebar | Not implemented | N/A |

## Code vs Dashboard Control

| Feature | Controlled by |
|---|---|
| Manual units (banner, sidebar, in-content, footer) | Code |
| Anchor ads | AdSense dashboard |
| Vignette ads | AdSense dashboard |
| Auto Ads | AdSense dashboard |
| Fill rate | Google ad auction |

## Remaining Limitations
- Ads render only on `truejobs.co.in` production domain (by design)
- Ad blockers suppress all ads
- AdSense no-fill is server-side
- Left sidebar rejected for all templates due to content width constraints
- PremiumResultLanding needs Layout wrapper refactor before sidebar can be added (deferred)

