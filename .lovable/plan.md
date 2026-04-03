

# Phase 4 (Continued): Remaining Gaps After Initial Pass

The previous Phase 4 implementation successfully handled: expanded categories, removed duplicate footer ad, fixed banner margin, widened header, added share row, fixed FAQ contrast, and added table/TOC CSS. However, several issues remain.

## Remaining Issues Found

### 1. CategoryCluster renders all 16 categories — overwhelming
The cluster strip dumps 16 pills on every article page. On mobile (375px), this wraps into 4-5 rows and pushes content down significantly. Should limit to ~8 pills, always including the current category.

### 2. Sidebar dead space on long articles
Only the ad div is `sticky top-24` (lines 584-588). The DistributionSidebar, RelatedBlogs, and RelatedJobs sit below as normal flow — they scroll away quickly and leave blank sidebar space for the rest of a long article. The sticky wrapper should include all sidebar content, not just the ad.

### 3. Content area horizontal padding too aggressive on mobile
`.content-area` has `padding: 1.5rem 2rem`. On a 375px screen with container padding, the 2rem (32px) horizontal padding leaves very little width for text, making lines extremely short and hard to read.

### 4. Cover image sizing conflict
The cover image container has `aspect-[1200/630]` but the `img` inside has `h-auto`, which means the image doesn't fill the aspect-ratio container — it just sits at its natural height while the container reserves the full aspect ratio. Should use `object-cover h-full` to fill properly.

---

## Plan

### File 1: `src/components/blog/CategoryCluster.tsx`
- Limit displayed pills to 8 max
- Always include the current category (prioritized first)
- Fill remaining slots from the full list, skipping the current one

### File 2: `src/pages/blog/BlogPost.tsx`
- **Sidebar**: Wrap ALL sidebar content (ad + distribution + related blogs + related jobs) inside a single sticky container so the entire sidebar stays visible as the user scrolls
- **Cover image**: Change `h-auto` to `h-full object-cover` so image fills the aspect-ratio container

### File 3: `src/index.css`
- Add responsive padding for `.content-area`: reduce horizontal padding to `1rem` on mobile (`@media (max-width: 640px)`)

---

## Ad-Safety
- Sidebar ad stays sticky and gains better viewability by being in a larger sticky block
- No ads removed or repositioned
- Mobile padding fix improves readability without affecting ad placements

## Files Changed
1. `src/components/blog/CategoryCluster.tsx` — limit to 8 pills
2. `src/pages/blog/BlogPost.tsx` — fix sidebar stickiness + cover image fill
3. `src/index.css` — mobile padding fix

## Verification Checklist
1. CategoryCluster shows ≤8 pills, current category highlighted
2. Sidebar stays visible while scrolling long articles on desktop
3. Cover image fills aspect-ratio container without distortion
4. Content area readable on 375px mobile — no excessively short lines
5. All ads render correctly

