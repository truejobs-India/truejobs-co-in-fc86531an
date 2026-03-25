

# Audit Report & Fix Plan: Google AdSense on TrueJobs

## Audit Findings

### Finding 1: AdSense script IS preserved during Worker merge — CONFIRMED SAFE

The `mergeHTML()` function in `public/_worker.js` (line 95-130) only strips SEO meta tags (title, description, OG, twitter, canonical, robots, fragment). The AdSense `<script>` block in `index.html` (lines 50-58) is an inline script, not a meta/link/title tag. It survives the merge into `originHead`. **No issue here.**

### Finding 2: Cached `head_html` fragments do NOT contain AdSense — BY DESIGN, NOT A BUG

Both `seo-cache-rebuild` and `build-seo-cache` generate `head_html` containing only SEO tags (title, meta, OG, twitter, canonical, schema, CSS). They do NOT inject AdSense. This is correct because the Worker's merge logic preserves the origin shell's global scripts (including AdSense) and appends the cached `head_html` on top. The AdSense script comes from the origin `index.html`, not from the cache. **No issue here.**

### Finding 3: `/blog/:slug` is MISSING from `SEO_ROUTE_PATTERNS` — CRITICAL BUG

The Worker pattern list has `/blog$` but NOT `/blog/[slug]`. When a user directly visits `https://truejobs.co.in/blog/nic-scientist-b-2026-...`, the Worker falls through to the catch-all (step 8), serving a bare SPA shell with an empty `<div id="root"></div>`. AdSense Auto Ads scans this empty shell and finds no content to place ads against.

Also missing: `/companies/:slug`, `/employment-news/:slug`, `/blog/category/:slug`.

### Finding 4: `AdPlaceholder` is a FAKE empty div — CRITICAL BUG

The component (line 80-84) renders `<div class="ad-slot ad-slot-banner ...">` — a plain div with no `<ins class="adsbygoogle">`, no `data-ad-client`, no `adsbygoogle.push()`. Google AdSense completely ignores these elements. Manual ad placements on blog posts, job pages, and all other templates are purely cosmetic.

### Finding 5: 13+ public pages incorrectly use `noAds` — REVENUE LOSS

These public monetizable pages pass `noAds` to Layout, blocking all ads:
- `FeeCalculator`, `SalaryCalculator`, `PhotoResizer`, `OutreachAssets`, `Tools`, `ResumeChecker`, `PdfTools`, `ExamCalendar`, `TypingTest`, `PercentageCalculator`, `ImageResizer`, `EligibilityChecker`, `AgeCalculator`, `ResumeBuilder`

Only these should have `noAds`: `AdminDashboard`, `Login`, `Signup`, `PhoneSignup`, `ForgotPassword`, `EnrolNow`, `NotFound`, `Offline`.

### Finding 6: Admin exclusion is correct

`/admin` is in `PRIVATE_PREFIXES` and uses `startsWith`, so `/admin` and `/admin/*` are excluded from SEO rendering. `AdminDashboard.tsx` uses `<Layout noAds>`. The AdSense `<ins>` component will check `NoAdsContext` and return null. Safe.

---

## Implementation Plan

### Step 1: Add missing route patterns to `public/_worker.js`

Add these patterns to `SEO_ROUTE_PATTERNS`:
```
/^\/blog\/[a-z0-9-]+$/           — individual blog posts
/^\/blog\/category\/[a-z0-9-]+$/ — blog category pages
/^\/companies\/[a-z0-9-]+$/      — company detail pages
/^\/employment-news\/[a-z0-9-]+$/ — employment news detail
```

This ensures the Worker merges cached SEO HTML (with content) for these routes, giving AdSense scannable content on first load.

### Step 2: Replace `AdPlaceholder` with real AdSense component

Replace the fake div with a production-safe component that:
- Renders `<ins class="adsbygoogle">` with `data-ad-client="ca-pub-7353331010234724"`
- Uses distinct `data-ad-slot` values per variant (banner, sidebar, in-content, footer)
- Calls `(adsbygoogle = window.adsbygoogle || []).push({})` once per mount using a ref guard
- Returns null when `NoAdsContext` is true (admin pages)
- Guards against window undefined
- Reserves space with `min-height` to reduce CLS
- Only activates on production domain (`truejobs.co.in`)

### Step 3: Remove `noAds` from public tool pages

Remove `noAds` prop from all public tool/resource pages:
- `FeeCalculator.tsx`, `SalaryCalculator.tsx`, `PhotoResizer.tsx`, `OutreachAssets.tsx`, `Tools.tsx`, `ResumeChecker.tsx`, `PdfTools.tsx`, `ExamCalendar.tsx`, `TypingTest.tsx`, `PercentageCalculator.tsx`, `ImageResizer.tsx`, `EligibilityChecker.tsx`, `AgeCalculator.tsx`, `ResumeBuilder.tsx`

Keep `noAds` on: `AdminDashboard`, `Login`, `Signup`, `PhoneSignup`, `ForgotPassword`, `EnrolNow`, `NotFound`, `Offline`.

### Files Changed

| File | Change |
|---|---|
| `public/_worker.js` | Add 4 route patterns to `SEO_ROUTE_PATTERNS` |
| `src/components/ads/AdPlaceholder.tsx` | Replace fake div with real `<ins class="adsbygoogle">` component |
| 14 tool page files | Remove `noAds` from `<Layout>` |

### What stays unchanged
- `index.html` AdSense Auto Ads script — preserved as-is
- `mergeHTML` logic — already correct, preserves global scripts
- Admin exclusion — already correct
- Edge functions — no changes needed
- Cached `head_html`/`body_html` — correct by design (AdSense comes from origin shell, not cache)

### Ad-eligibility rule (single source of truth)
- **Ads allowed**: All pages EXCEPT `/admin` and `/admin/*`
- Enforced by: `NoAdsContext` in Layout (only `AdminDashboard` and auth/utility pages set `noAds`)
- AdSense component checks `NoAdsContext` and returns null when true
- Worker excludes `/admin` via `PRIVATE_PREFIXES`

