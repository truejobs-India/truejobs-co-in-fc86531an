

# Phase 2: CLS Verification, Refinement, and Gap-Fixing

## Phase 1 Verification Summary

### Correctly Implemented
1. **AdPlaceholder.tsx** — outer wrapper `min-h` correctly applied: banner/footer `min-h-[110px]`, sidebar `min-h-[280px]`, in-content `min-h-[280px]`
2. **Navbar.tsx** — logo `width={160} height={40}`, employer button `width={120} height={48}`, candidate button `width={120} height={40}` — all correct
3. **Footer.tsx** — logo `width={160} height={40}` — correct
4. **GovtJobCategories.tsx** — `width={200} height={200} loading="lazy"` — correct
5. **StateQuickFilter.tsx** — `width={200} height={200} loading="lazy"` — correct
6. **InfoCardsRow.tsx** — `width={300} height={300} loading="lazy"` — correct
7. **HeroSideCards.tsx** — channel logos `width={14} height={14}` — correct
8. **JobAlertCTA.tsx** — channel buttons `width={16/20} height={16/20}`, email logos `width={16/20} height={20}` — correct
9. **BlogCTA.tsx** — button images `width={120} height={40/48}` — correct
10. **RelatedBlogs.tsx** — thumbnails `width={64} height={64}`, empty state returns Card with "No related articles" — correct
11. **RelatedJobs.tsx** — empty state returns Card with "No related jobs" — correct
12. **LatestGovtJobs.tsx** — empty state returns section with placeholder text — correct
13. **LatestPrivateJobs.tsx** — empty state returns section with placeholder text — correct
14. **EmploymentNewsJobDetail.tsx** — skeleton has `min-h-[500px]`, includes banner ad space `h-[110px]`, info grid, and content — correct
15. **BlogPost.tsx** — skeleton has `min-h-[600px]`, includes banner ad space `h-[110px]`, cover image `width={1200} height={630}` — correct
16. **index.html** — font preload link added, AdSense conditional script — correct
17. **MSMECredibility.tsx** — already has `width="80" height="80"` — correct

### Remaining Issues Found

#### Issue 1: Blog cover image has no aspect-ratio container
The `<figure>` wrapping the blog cover image (line 418) has no height reservation. The `width={1200} height={630}` on the `<img>` helps the browser calculate intrinsic ratio, but only if the image element has a definite inline-size. Since the image uses `w-full h-auto`, modern browsers should handle this — but adding `aspect-ratio` on the figure as a fallback would be safer.

**Fix**: Add `aspect-[1200/630]` to the `<figure>` element to guarantee space reservation before image loads.

#### Issue 2: Blog sidebar ad is conditionally rendered
At `BlogPost.tsx` line 505, the sidebar ad is wrapped in `{post.content?.length > 800 && ...}`. This is fine because it's inside a `sticky` container in a sidebar column that already exists — the sidebar column has its grid space regardless. **No fix needed.**

#### Issue 3: Blog `mt-[60px]` on header banner container
At `BlogPost.tsx` line 346, the banner ad container has `mt-[60px]`. This is static and deterministic — no CLS concern. **No fix needed.**

#### Issue 4: StickyMobileCTA is defined but not imported anywhere
The component exists but is unused. The footer ad's `mb-[88px] md:mb-5` reserves space for it on mobile, but since it's not actually rendered, this `mb-[88px]` creates unnecessary bottom margin on mobile pages. However, this doesn't cause CLS (it's static from first render). **Low priority — note only.**

#### Issue 5: Candidate login button has responsive height `h-10 sm:h-12`
At Navbar line 408, the candidate button image uses `h-10 sm:h-12` but has `height={40}`. On `sm+` breakpoints, CSS overrides to `h-12` (48px). The intrinsic `height=40` is fine because CSS takes precedence and the container is fixed-height `h-16`. **No CLS risk.**

#### Issue 6: Preview mode banner in BlogPost causes shift
At BlogPost line 272-280, when `isPreview` is true, a yellow banner is inserted above the article. This pushes content down. However, this only affects admin preview mode and is not visible to public users. **No fix needed for public CLS.**

#### Issue 7: Chatbot FAB icon lacks dimensions
`JobSearchBot.tsx` line 20 imports `iconChatbot` image. The chatbot renders as a fixed-position floating button — any size change would not cause CLS to page content because it's `position: fixed`. **No CLS risk.**

## Conclusion

**Phase 1 was implemented correctly and comprehensively.** After thorough audit, I found only one minor refinement worth implementing:

### Single Refinement: Blog cover image aspect-ratio container

Add `aspect-[1200/630]` to the blog cover `<figure>` element so the space is reserved even before the image starts decoding. This is a belt-and-suspenders fix — modern browsers already use the `width`/`height` attributes, but older browsers or edge cases benefit from the explicit aspect ratio.

**File**: `src/pages/blog/BlogPost.tsx` line 418
**Change**: Add `className="aspect-[1200/630] overflow-hidden"` to `<figure>`

### No Other Changes Needed

All other Phase 1 fixes are correctly applied and verified. The ad slot reservations are well-calibrated. Empty states are stable. Skeletons match approximate content height. Images have intrinsic dimensions.

### Remaining Uncontrollable Risks
1. **Google Auto Ads**: May inject ads at unpredictable positions — no mitigation possible
2. **Fluid in-article ads**: Can exceed 280px reservation — inherent to the format
3. **Banner on mobile rare 300x250**: AdSense `auto` format can serve tall units in horizontal slots — reserving 250px would waste space 90% of the time

### Manual Verification Checklist
1. Homepage: ad banner/footer reserve space; images stable; govt/private sections don't collapse
2. Employment-news detail: skeleton taller with ad space; info grid stable; no shift on badges
3. Blog detail: cover image reserves aspect ratio space; skeleton includes ad; sidebar doesn't collapse
4. Listing/jobs page: ad areas stable
5. Mobile (375px) and desktop — both viewports
6. Chrome DevTools → Performance → Web Vitals overlay

